import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/storage/session_store.dart';
import '../data/auth_repository.dart';
import '../domain/auth_session.dart';
import 'session_state.dart';

/// Ticket ligado al controlador y al inicio del login, no a su respuesta tardía.
class AuthenticationAttempt {
  const AuthenticationAttempt._(this._owner, this._generation, this.startedAt);
  final Object _owner;
  final int _generation;
  final DateTime startedAt;
}

/// Cada repositorio DEBE usar un proveedor de token fijo al argumento recibido.
/// Así me/logout nunca toman accidentalmente el token de una sesión posterior.
typedef SessionRepositoryFactory = AuthRepository Function(String token);

class SessionController extends ChangeNotifier {
  SessionController({
    required this._store,
    required this._repositoryForToken,
    required String apiIdentity,
    DateTime Function()? clock,
  }) : _apiIdentity = apiIdentity,
       _clock = clock ?? DateTime.now {
    if (apiIdentity.isEmpty) throw ArgumentError('Falta identidad de API.');
  }

  final SessionStore _store;
  final SessionRepositoryFactory _repositoryForToken;
  final String _apiIdentity;
  final DateTime Function() _clock;
  final Object _owner = Object();
  Future<void> _tail = Future.value();
  SessionState _state = const SessionState(SessionStatus.guest);
  StoredSession? _credential;
  int _generation = 0;
  bool _needsCleanup = false;
  bool _disposed = false;
  AuthenticationAttempt? _activeAttempt;

  SessionState get state => _state;

  /// Identificador no sensible para descartar UI y resultados de otra sesión.
  int get generation => _generation;

  bool isCurrentAttempt(AuthenticationAttempt attempt) =>
      identical(attempt._owner, _owner) && _current(attempt._generation);

  Duration? get timeUntilExpiration =>
      _credential?.expiresAt.difference(_clock());

  /// Solo para proveedores HTTP futuros. Durante comprobación/cierre es null.
  String? get accessToken =>
      _state.status == SessionStatus.authenticated &&
          _credential != null &&
          !_credential!.isExpired(_clock())
      ? _credential!.accessToken
      : null;

  bool _current(int generation) => !_disposed && generation == _generation;

  void _publish(int generation, SessionState state) {
    if (!_current(generation)) return;
    _state = state;
    notifyListeners();
  }

  int _begin(SessionStatus status) {
    if (_disposed) throw const SessionOperationException();
    final generation = ++_generation;
    _activeAttempt = null;
    _credential = null;
    _publish(generation, SessionState(status));
    return generation;
  }

  /// Serializa disco y operaciones del ciclo de vida. El transporte inyectado
  /// debe conservar sus timeouts; un Future ya enviado no se puede cancelar.
  Future<T> _serial<T>(Future<T> Function() operation) {
    final result = _tail.then((_) => operation());
    _tail = result.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return result;
  }

  Future<bool> _erase(int generation) async {
    _needsCleanup = true;
    try {
      await _store.delete();
      _needsCleanup = false;
      return true;
    } catch (_) {
      _publish(
        generation,
        const SessionState(
          SessionStatus.recoverableError,
          issue: SessionIssue.localDeletionFailed,
        ),
      );
      return false;
    }
  }

  Future<bool> _prepare(int generation) async =>
      !_needsCleanup || await _erase(generation);

  AuthenticationAttempt beginAuthentication() {
    final generation = _begin(SessionStatus.checking);
    final attempt = AuthenticationAttempt._(
      _owner,
      generation,
      _clock().toUtc(),
    );
    if (!_current(generation)) return attempt;
    _activeAttempt = attempt;
    // El intento nuevo no deja una credencial anterior restaurable por accidente.
    _needsCleanup = true;
    unawaited(
      _serial(() async {
        if (_current(generation)) await _erase(generation);
      }),
    );
    return attempt;
  }

  Future<void> acceptLogin(
    AuthenticationAttempt attempt,
    LoginResponse response,
  ) {
    if (!identical(_activeAttempt, attempt)) return Future.value();
    _activeAttempt = null; // Ticket de un solo uso, antes del primer await.
    return _serial(() async {
      final generation = attempt._generation;
      if (!identical(attempt._owner, _owner) || !_current(generation)) return;
      if (!await _prepare(generation) || !_current(generation)) return;
      final session = response.session;
      final credential = StoredSession(
        accessToken: session.accessToken,
        apiIdentity: _apiIdentity,
        issuedAt: attempt.startedAt,
      );
      if (credential.isExpired(_clock())) {
        _publish(
          generation,
          const SessionState(SessionStatus.guest, issue: SessionIssue.expired),
        );
        return;
      }
      _needsCleanup =
          true; // También cubre escrituras que fallan tras persistir.
      try {
        await _store.write(credential);
      } catch (_) {
        if (await _erase(generation)) {
          _publish(
            generation,
            const SessionState(
              SessionStatus.recoverableError,
              issue: SessionIssue.persistenceFailed,
            ),
          );
        }
        return;
      }
      if (!_current(generation)) {
        await _erase(generation);
        return;
      }
      if (credential.isExpired(_clock())) {
        await _clearInvalid(generation, SessionIssue.expired);
        return;
      }
      _needsCleanup = false;
      _credential = credential;
      _publish(
        generation,
        SessionState(SessionStatus.authenticated, user: session.user),
      );
    });
  }

  /// Finaliza un login fallido sin conservar la contraseña ni su excepción.
  Future<void> cancelAuthentication(AuthenticationAttempt attempt) {
    if (!isCurrentAttempt(attempt) || _state.status != SessionStatus.checking) {
      return Future.value();
    }
    final generation = _begin(SessionStatus.checking);
    return _serial(() async {
      if (!_current(generation)) return;
      if (await _prepare(generation)) {
        _publish(generation, const SessionState(SessionStatus.guest));
      }
    });
  }

  Future<void> restore() {
    final generation = _begin(SessionStatus.checking);
    return _serial(() async {
      if (!_current(generation) ||
          !await _prepare(generation) ||
          !_current(generation)) {
        return;
      }
      StoredSession? stored;
      try {
        stored = await _store.read();
      } catch (error) {
        final issue = error is SessionStoreException
            ? switch (error.kind) {
                SessionStoreError.corrupt => SessionIssue.corruptStorage,
                SessionStoreError.incompatible =>
                  SessionIssue.incompatibleStorage,
                SessionStoreError.unavailable =>
                  SessionIssue.storageUnavailable,
              }
            : SessionIssue.storageUnavailable;
        _publish(
          generation,
          SessionState(SessionStatus.recoverableError, issue: issue),
        );
        return;
      }
      if (!_current(generation)) return;
      if (stored == null) {
        _publish(generation, const SessionState(SessionStatus.guest));
        return;
      }
      if (stored.apiIdentity != _apiIdentity) {
        _publish(
          generation,
          const SessionState(
            SessionStatus.recoverableError,
            issue: SessionIssue.apiMismatch,
          ),
        );
        return;
      }
      if (stored.isExpired(_clock())) {
        await _clearInvalid(generation, SessionIssue.expired);
        return;
      }
      try {
        final user = await _repositoryForToken(stored.accessToken).me();
        if (!_current(generation)) return;
        if (stored.isExpired(_clock())) {
          await _clearInvalid(generation, SessionIssue.expired);
          return;
        }
        _credential = stored;
        _publish(
          generation,
          SessionState(SessionStatus.authenticated, user: user),
        );
      } catch (error) {
        if (!_current(generation)) return;
        if (error is ApiException && error.statusCode == 401) {
          await _clearInvalid(generation, SessionIssue.unauthorized);
        } else {
          final issue =
              error is ApiException &&
                  (error.kind == ApiErrorKind.connection ||
                      error.kind == ApiErrorKind.timeout)
              ? SessionIssue.network
              : error is ApiException && (error.statusCode ?? 0) >= 500
              ? SessionIssue.server
              : SessionIssue.requestFailed;
          _publish(
            generation,
            SessionState(SessionStatus.recoverableError, issue: issue),
          );
        }
      }
    });
  }

  Future<void> _clearInvalid(int generation, SessionIssue issue) async {
    _credential = null;
    if (await _erase(generation)) {
      _publish(generation, SessionState(SessionStatus.guest, issue: issue));
    }
  }

  /// Para reanudar la app/antes de operaciones privadas: no depende de la UI.
  Future<void> checkExpiration() {
    if (_credential == null || !_credential!.isExpired(_clock())) {
      return Future.value();
    }
    final generation = _begin(SessionStatus.checking);
    return _serial(() async {
      if (_current(generation)) {
        await _clearInvalid(generation, SessionIssue.expired);
      }
    });
  }

  /// El callback recibe un token fijo. Un resultado de otra generación se descarta.
  Future<T> runAuthenticated<T>(Future<T> Function(String token) action) async {
    final generation = _generation;
    final token = accessToken;
    if (token == null) {
      await checkExpiration();
      throw const SessionOperationException();
    }
    try {
      final result = await action(token);
      if (!_current(generation) ||
          _state.status != SessionStatus.authenticated) {
        throw const SessionOperationException();
      }
      await checkExpiration();
      if (!_current(generation)) throw const SessionOperationException();
      return result;
    } catch (error) {
      if (!_current(generation)) throw const SessionOperationException();
      if (error is ApiException && error.statusCode == 401) {
        final invalid = _begin(SessionStatus.checking);
        await _serial(() async {
          if (_current(invalid)) {
            await _clearInvalid(invalid, SessionIssue.unauthorized);
          }
        });
      }
      // Solo las excepciones HTTP sanitizadas forman parte del contrato público.
      if (error is ApiException || error is SessionOperationException) rethrow;
      throw const SessionOperationException();
    }
  }

  Future<LogoutResult> logout() {
    var credential = _credential;
    final generation = _begin(SessionStatus.closing); // Bloqueo inmediato.
    return _serial(() async {
      if (!_current(generation)) {
        return const LogoutResult(
          remote: RemoteRevocation.notAttempted,
          localCleared: false,
        );
      }
      if (credential == null) {
        try {
          credential = await _store.read();
        } catch (_) {
          // Aun sin poder leer, intentar borrar. No se inventa revocación.
        }
      }
      // Limpiar primero el disco impide restaurar durante una revocación fallida.
      final cleared = await _erase(generation);
      var remote = RemoteRevocation.notAttempted;
      final toRevoke = credential;
      if (toRevoke != null && toRevoke.apiIdentity == _apiIdentity) {
        try {
          await _repositoryForToken(toRevoke.accessToken).logout();
          remote = RemoteRevocation.confirmed;
        } catch (error) {
          remote = error is ApiException && error.statusCode == 401
              ? RemoteRevocation.rejectedUnauthorized
              : RemoteRevocation.failed;
        }
      }
      if (cleared) {
        _publish(generation, const SessionState(SessionStatus.guest));
      }
      return LogoutResult(remote: remote, localCleared: cleared);
    });
  }

  /// Recuperación explícita tras corrupción, mismatch o fallo de eliminación.
  Future<bool> discardStoredSession() {
    final generation = _begin(SessionStatus.closing);
    return _serial(() async {
      if (!_current(generation)) return false;
      final cleared = await _erase(generation);
      if (cleared) {
        _publish(generation, const SessionState(SessionStatus.guest));
      }
      return cleared;
    });
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _credential = null;
    super.dispose();
  }
}
