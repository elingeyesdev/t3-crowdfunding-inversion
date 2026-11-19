import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/flutter_encrypted_session_backend.dart';
import '../../../core/storage/session_store.dart';
import '../data/auth_repository.dart';
import 'session_controller.dart';
import 'session_state.dart';

/// Una composición por aplicación. Los clientes autenticados capturan el token
/// de su operación; comparten transporte, sin releer un token posterior.
class AppDependencies {
  AppDependencies._(
    this.config,
    this._client,
    this._ownsClient,
    this.auth,
    this.session,
  );

  factory AppDependencies.create(
    AppConfig config, {
    http.Client? client,
    SessionStore? store,
    DateTime Function()? clock,
  }) {
    final transport = client ?? http.Client();
    final auth = AuthRepository(ApiClient(client: transport, config: config));
    final session = SessionController(
      store: store ?? createPlatformSessionStore(),
      clock: clock,
      apiIdentity: config.hasApi
          ? StoredSession.identityFor(config)
          : 'development|unconfigured',
      repositoryForToken: (token) => AuthRepository(
        ApiClient(
          client: transport,
          config: config,
          tokenProvider: () => token,
        ),
      ),
    );
    return AppDependencies._(config, transport, client == null, auth, session);
  }

  final AppConfig config;
  final http.Client _client;
  final bool _ownsClient;
  final AuthRepository auth;
  final SessionController session;
  final ValueNotifier<LogoutResult?> logoutResult = ValueNotifier(null);
  Future<void>? _restoring;
  bool _disposed = false;

  Future<void> restore() {
    if (_disposed || !config.hasApi) return Future.value();
    return _restoring ??= session.restore().whenComplete(
      () => _restoring = null,
    );
  }

  Future<LogoutResult?> logout() async {
    if (_disposed || session.state.status == SessionStatus.closing) return null;
    logoutResult.value = null;
    final operation = session.logout();
    final generation = session.generation;
    final result = await operation;
    if (!_disposed && session.generation == generation) {
      logoutResult.value = result;
    }
    return result;
  }

  /// Punto de acceso previsto para futuras operaciones privadas (Fase 5+).
  Future<T> authenticated<T>(Future<T> Function(ApiClient api) action) =>
      session.runAuthenticated(
        (token) => action(
          ApiClient(
            client: _client,
            config: config,
            tokenProvider: () => token,
          ),
        ),
      );

  void dispose() {
    _disposed = true;
    session.dispose();
    logoutResult.dispose();
    if (_ownsClient) _client.close();
  }
}
