import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_client.dart';
import 'package:movil/core/network/api_exception.dart';
import 'package:movil/core/storage/session_store.dart';
import 'package:movil/features/auth/application/session_controller.dart';
import 'package:movil/features/auth/application/session_state.dart';
import 'package:movil/features/auth/data/auth_repository.dart';
import 'package:movil/features/auth/domain/auth_session.dart';

const apiIdentity = 'production|https://api.example.com/api/v1/';
final initialTime = DateTime.utc(2026, 11, 16, 12);

class FakeSessionStore implements SessionStore {
  StoredSession? value;
  bool failRead = false, failWrite = false, failDelete = false;
  SessionStoreError readError = SessionStoreError.unavailable;
  int deletes = 0, writes = 0;
  Completer<void>? writeGate, writeStarted;

  @override
  Future<StoredSession?> read() async {
    if (failRead) throw SessionStoreException(readError);
    return value;
  }

  @override
  Future<void> write(StoredSession session) async {
    writes++;
    writeStarted?.complete();
    if (writeGate != null) await writeGate!.future;
    value = session; // Simula incluso fallo después de persistir.
    if (failWrite) throw StateError('synthetic-token-secret');
  }

  @override
  Future<void> delete() async {
    deletes++;
    if (failDelete) throw StateError('synthetic-token-secret');
    value = null;
  }
}

StoredSession credential({
  String token = '1|synthetic',
  String identity = apiIdentity,
  DateTime? issuedAt,
}) => StoredSession(
  accessToken: token,
  apiIdentity: identity,
  issuedAt: issuedAt ?? initialTime,
);

LoginResponse login({String token = '1|synthetic', String id = 'user-one'}) =>
    LoginResponse.fromJson({
      'statusCode': 200,
      'data': {
        'accessToken': token,
        'tokenType': 'Bearer',
        'expiresIn': '24h',
        'user': {
          'id': id,
          'email': 'test@example.com',
          'roles': ['investor', 'future'],
        },
      },
    });

http.Response meResponse([String id = 'user-one']) => http.Response(
  jsonEncode({
    'statusCode': 200,
    'data': {
      'id': id,
      'email': 'test@example.com',
      'roles': ['investor', 'future'],
    },
  }),
  200,
  headers: {'content-type': 'application/json'},
);

SessionController makeController(
  FakeSessionStore store, {
  Future<http.Response> Function(http.Request)? handler,
  DateTime Function()? clock,
  Duration timeout = const Duration(seconds: 1),
}) {
  final client = MockClient(handler ?? (_) async => meResponse());
  addTearDown(client.close);
  final controller = SessionController(
    store: store,
    apiIdentity: apiIdentity,
    clock: clock ?? () => initialTime,
    repositoryForToken: (token) => AuthRepository(
      ApiClient(
        client: client,
        config: AppConfig.fromValues(
          appEnv: 'production',
          apiBaseUrl: 'https://api.example.com/api/v1',
        ),
        tokenProvider: () => token,
        timeout: timeout,
      ),
    ),
  );
  addTearDown(controller.dispose);
  return controller;
}

Future<void> signIn(
  SessionController controller, {
  String token = '1|synthetic',
  String id = 'user-one',
}) async {
  final attempt = controller.beginAuthentication();
  await controller.acceptLogin(attempt, login(token: token, id: id));
}

void main() {
  test('cancelar durante escritura invalida el ticket y elimina el resultado tardío', () async {
    final store = FakeSessionStore()
      ..writeGate = Completer<void>()
      ..writeStarted = Completer<void>();
    final controller = makeController(store);
    final attempt = controller.beginAuthentication();
    final saving = controller.acceptLogin(attempt, login());
    await store.writeStarted!.future;
    final cancellation = controller.cancelAuthentication(attempt);
    expect(controller.isCurrentAttempt(attempt), isFalse);
    store.writeGate!.complete();
    await saving;
    await cancellation;
    expect(store.value, isNull);
    expect(controller.state.status, SessionStatus.guest);
    expect(controller.accessToken, isNull);
  });

  test('cancelar un ticket ya autenticado no cierra la sesión', () async {
    final controller = makeController(FakeSessionStore());
    final attempt = controller.beginAuthentication();
    await controller.acceptLogin(attempt, login());
    await controller.cancelAuthentication(attempt);
    expect(controller.state.status, SessionStatus.authenticated);
  });
  test(
    'login persiste antes de autenticar; mantiene usuario y notifica',
    () async {
      final store = FakeSessionStore();
      final controller = makeController(store);
      final states = <SessionStatus>[];
      controller.addListener(() => states.add(controller.state.status));
      await signIn(controller);
      expect(store.value!.accessToken, '1|synthetic');
      expect(controller.state.status, SessionStatus.authenticated);
      expect(controller.state.user!.roles, ['investor', 'future']);
      expect(states, [SessionStatus.checking, SessionStatus.authenticated]);
      expect(controller.state.toString(), isNot(contains('synthetic')));
    },
  );

  test('sin token es visitante y no consulta HTTP', () async {
    final controller = makeController(
      FakeSessionStore(),
      handler: (_) async {
        fail('No debe consultar');
      },
    );
    await controller.restore();
    expect(controller.state.status, SessionStatus.guest);
  });

  test(
    'restauración valida auth/me con token fijo antes de exponer usuario',
    () async {
      final gate = Completer<http.Response>();
      final entered = Completer<void>();
      final store = FakeSessionStore()..value = credential();
      final controller = makeController(
        store,
        handler: (request) async {
          expect(request.url.path, '/api/v1/auth/me');
          expect(request.headers['Authorization'], 'Bearer 1|synthetic');
          entered.complete();
          return gate.future;
        },
      );
      final restoring = controller.restore();
      await entered.future;
      expect(controller.state.status, SessionStatus.checking);
      expect(controller.state.user, isNull);
      expect(controller.accessToken, isNull);
      gate.complete(meResponse());
      await restoring;
      expect(controller.state.status, SessionStatus.authenticated);
    },
  );

  test('token vencido se borra sin abrir HTTP', () async {
    final store = FakeSessionStore()
      ..value = credential(
        issuedAt: initialTime.subtract(const Duration(hours: 24)),
      );
    final controller = makeController(
      store,
      handler: (_) async {
        fail('No debe consultar');
      },
    );
    await controller.restore();
    expect(store.value, isNull);
    expect(controller.state.issue, SessionIssue.expired);
    expect(controller.state.status, SessionStatus.guest);
  });

  test('401 de restauración invalida y limpia', () async {
    final store = FakeSessionStore()..value = credential();
    final controller = makeController(
      store,
      handler: (_) async => http.Response('{}', 401),
    );
    await controller.restore();
    expect(store.value, isNull);
    expect(controller.state.issue, SessionIssue.unauthorized);
  });

  for (final status in [403, 404, 409, 422, 429, 500, 503]) {
    test(
      'restauración HTTP $status conserva credenciales sin usuario validado',
      () async {
        final store = FakeSessionStore()..value = credential();
        var failRequest = true;
        final controller = makeController(
          store,
          handler: (_) async =>
              failRequest ? http.Response('{}', status) : meResponse(),
        );
        await controller.restore();
        expect(store.value, isNotNull);
        expect(controller.state.status, SessionStatus.recoverableError);
        expect(controller.state.user, isNull);
        expect(controller.accessToken, isNull);
        failRequest = false;
        await controller.restore();
        expect(controller.state.status, SessionStatus.authenticated);
      },
    );
  }

  test('timeout conserva credencial y permite reintentar', () async {
    final store = FakeSessionStore()..value = credential();
    final gate = Completer<http.Response>();
    final controller = makeController(
      store,
      handler: (_) => gate.future,
      timeout: const Duration(milliseconds: 5),
    );
    await controller.restore();
    expect(controller.state.issue, SessionIssue.network);
    expect(store.value, isNotNull);
    gate.complete(meResponse());
    expect(controller.state.user, isNull);
  });

  test('fallo de conexión no hace logout', () async {
    final store = FakeSessionStore()..value = credential();
    final controller = makeController(
      store,
      handler: (_) async {
        throw StateError('secret');
      },
    );
    await controller.restore();
    expect(controller.state.issue, SessionIssue.network);
    expect(store.deletes, 0);
  });

  for (final kind in SessionStoreError.values) {
    test('almacenamiento $kind permite recuperación explícita', () async {
      final store = FakeSessionStore()
        ..failRead = true
        ..readError = kind;
      final controller = makeController(store);
      await controller.restore();
      expect(controller.state.status, SessionStatus.recoverableError);
      expect(controller.accessToken, isNull);
      store.failRead = false;
      expect(await controller.discardStoredSession(), isTrue);
      expect(controller.state.status, SessionStatus.guest);
    });
  }

  test('sesión de otra API no se envía ni se borra automáticamente', () async {
    final store = FakeSessionStore()
      ..value = credential(
        identity: 'development|https://other.example/api/v1/',
      );
    final controller = makeController(
      store,
      handler: (_) async {
        fail('No debe enviar');
      },
    );
    await controller.restore();
    expect(controller.state.issue, SessionIssue.apiMismatch);
    expect(store.value, isNotNull);
  });

  test('escritura fallida limpia residuo y no autentica', () async {
    final store = FakeSessionStore()..failWrite = true;
    final controller = makeController(store);
    await signIn(controller);
    expect(controller.state.issue, SessionIssue.persistenceFailed);
    expect(store.value, isNull);
    expect(controller.accessToken, isNull);
  });

  for (final status in [200, 401, 503]) {
    test(
      'logout remoto $status distingue revocación de limpieza local',
      () async {
        final store = FakeSessionStore();
        final controller = makeController(
          store,
          handler: (request) async {
            expect(request.url.path, '/api/v1/auth/logout');
            expect(request.headers['Authorization'], 'Bearer 1|synthetic');
            return http.Response(
              jsonEncode({'statusCode': status, 'data': null}),
              status,
            );
          },
        );
        await signIn(controller);
        final future = controller.logout();
        expect(controller.state.status, SessionStatus.closing);
        expect(controller.accessToken, isNull);
        final result = await future;
        expect(result.localCleared, isTrue);
        expect(
          result.remote,
          status == 200
              ? RemoteRevocation.confirmed
              : status == 401
              ? RemoteRevocation.rejectedUnauthorized
              : RemoteRevocation.failed,
        );
        expect(store.value, isNull);
        expect(controller.state.status, SessionStatus.guest);
      },
    );
  }

  test('logout con fallo de red no promete revocación', () async {
    final controller = makeController(
      FakeSessionStore(),
      handler: (_) async {
        throw StateError('secret');
      },
    );
    await signIn(controller);
    final result = await controller.logout();
    expect(result.remote, RemoteRevocation.failed);
    expect(result.localCleared, isTrue);
  });

  test(
    'eliminación fallida bloquea sesión y permite reintentar limpieza',
    () async {
      final store = FakeSessionStore();
      final controller = makeController(
        store,
        handler: (_) async =>
            http.Response('{"statusCode":200,"data":null}', 200),
      );
      await signIn(controller);
      store.failDelete = true;
      final result = await controller.logout();
      expect(result.localCleared, isFalse);
      expect(result.remote, RemoteRevocation.confirmed);
      expect(controller.state.issue, SessionIssue.localDeletionFailed);
      await expectLater(
        controller.runAuthenticated((_) async => 1),
        throwsA(isA<SessionOperationException>()),
      );
      store.failDelete = false;
      expect(await controller.discardStoredSession(), isTrue);
    },
  );

  test(
    'dos intentos de login: solo gana el último y cada ticket es de un uso',
    () async {
      final store = FakeSessionStore();
      final controller = makeController(store);
      final old = controller.beginAuthentication();
      final latest = controller.beginAuthentication();
      await controller.acceptLogin(
        latest,
        login(token: '2|latest', id: 'user-two'),
      );
      await controller.acceptLogin(old, login());
      await controller.acceptLogin(latest, login());
      expect(store.writes, 1);
      expect(store.value!.accessToken, '2|latest');
      expect(controller.state.user!.id, 'user-two');
    },
  );

  test(
    'respuesta de login posterior a logout no puede restaurar sesión',
    () async {
      final store = FakeSessionStore();
      final controller = makeController(store);
      final attempt = controller.beginAuthentication();
      await controller.logout();
      await controller.acceptLogin(attempt, login());
      expect(store.value, isNull);
      expect(controller.state.status, SessionStatus.guest);
    },
  );

  test('escritura antigua en vuelo se limpia antes del nuevo login', () async {
    final store = FakeSessionStore()
      ..writeGate = Completer<void>()
      ..writeStarted = Completer<void>();
    final controller = makeController(store);
    final old = controller.beginAuthentication();
    final pending = controller.acceptLogin(old, login());
    await store.writeStarted!.future;
    final latest = controller.beginAuthentication();
    store.writeGate!.complete();
    await pending;
    store.writeGate = null;
    store.writeStarted = null;
    await controller.acceptLogin(latest, login(token: '2|latest'));
    expect(store.value!.accessToken, '2|latest');
  });

  test('restauración tardía no altera el login posterior', () async {
    final gate = Completer<http.Response>();
    final entered = Completer<void>();
    final store = FakeSessionStore()..value = credential();
    final controller = makeController(
      store,
      handler: (_) async {
        entered.complete();
        return gate.future;
      },
    );
    final restoring = controller.restore();
    await entered.future;
    final attempt = controller.beginAuthentication();
    final accepting = controller.acceptLogin(
      attempt,
      login(token: '2|latest', id: 'user-two'),
    );
    gate.complete(meResponse('old-user'));
    await restoring;
    await accepting;
    expect(controller.state.user!.id, 'user-two');
  });

  test('401 de petición antigua no cierra una sesión nueva', () async {
    final controller = makeController(FakeSessionStore());
    await signIn(controller);
    final gate = Completer<int>();
    final entered = Completer<void>();
    final pending = controller.runAuthenticated((token) {
      entered.complete();
      return gate.future;
    });
    final expectation = expectLater(
      pending,
      throwsA(isA<SessionOperationException>()),
    );
    await entered.future;
    await signIn(controller, token: '2|latest', id: 'user-two');
    gate.completeError(const ApiException(ApiErrorKind.http, statusCode: 401));
    await expectation;
    expect(controller.state.user!.id, 'user-two');
  });

  test('dos 401 concurrentes invalidan una sola generación', () async {
    final store = FakeSessionStore();
    final controller = makeController(store);
    await signIn(controller);
    final before = store.deletes;
    final first = Completer<int>();
    final second = Completer<int>();
    var entered = 0;
    final bothEntered = Completer<void>();
    Future<int> action(Completer<int> gate) => controller.runAuthenticated((_) {
      if (++entered == 2) bothEntered.complete();
      return gate.future;
    });
    final a = expectLater(action(first), throwsA(isA<ApiException>()));
    final b = expectLater(
      action(second),
      throwsA(isA<SessionOperationException>()),
    );
    await bothEntered.future;
    first.completeError(const ApiException(ApiErrorKind.http, statusCode: 401));
    second.completeError(
      const ApiException(ApiErrorKind.http, statusCode: 401),
    );
    await Future.wait([a, b]);
    expect(store.deletes, before + 1);
    expect(controller.state.status, SessionStatus.guest);
  });

  test('expiración en memoria impide nuevas operaciones privadas', () async {
    var now = initialTime;
    final store = FakeSessionStore();
    final controller = makeController(store, clock: () => now);
    await signIn(controller);
    now = now.add(const Duration(hours: 24));
    expect(controller.accessToken, isNull);
    await controller.checkExpiration();
    expect(controller.state.issue, SessionIssue.expired);
    expect(store.value, isNull);
  });

  test('cancelar intento invalida su respuesta posterior', () async {
    final controller = makeController(FakeSessionStore());
    final attempt = controller.beginAuthentication();
    await controller.cancelAuthentication(attempt);
    await controller.acceptLogin(attempt, login());
    expect(controller.state.status, SessionStatus.guest);
  });

  test(
    'excepción desconocida de operación privada no filtra secreto',
    () async {
      final controller = makeController(FakeSessionStore());
      await signIn(controller);
      await expectLater(
        controller.runAuthenticated((_) async {
          throw StateError('synthetic-token-secret');
        }),
        throwsA(
          isA<SessionOperationException>().having(
            (e) => e.toString(),
            'sanitized',
            isNot(contains('synthetic')),
          ),
        ),
      );
    },
  );
  test(
    'dos restauraciones concurrentes descartan la primera respuesta',
    () async {
      final gate = Completer<http.Response>();
      final entered = Completer<void>();
      var calls = 0;
      final store = FakeSessionStore()..value = credential();
      final controller = makeController(
        store,
        handler: (_) async {
          if (++calls == 1) {
            entered.complete();
            return gate.future;
          }
          return meResponse('latest-user');
        },
      );
      final first = controller.restore();
      await entered.future;
      final second = controller.restore();
      gate.complete(http.Response('{}', 401));
      await Future.wait([first, second]);
      expect(store.value, isNotNull);
      expect(controller.state.user!.id, 'latest-user');
      expect(store.deletes, 0);
    },
  );

  test('logout remoto tardío no borra un login posterior', () async {
    final gate = Completer<http.Response>();
    final entered = Completer<void>();
    final store = FakeSessionStore();
    final controller = makeController(
      store,
      handler: (_) async {
        entered.complete();
        return gate.future;
      },
    );
    await signIn(controller);
    final closing = controller.logout();
    await entered.future;
    final attempt = controller.beginAuthentication();
    final accepting = controller.acceptLogin(
      attempt,
      login(token: '2|latest', id: 'user-two'),
    );
    gate.complete(http.Response('{"statusCode":200,"data":null}', 200));
    await closing;
    await accepting;
    expect(store.value!.accessToken, '2|latest');
    expect(controller.state.user!.id, 'user-two');
  });

  test(
    'respuesta privada exitosa tardía se descarta después de logout',
    () async {
      final controller = makeController(FakeSessionStore());
      await signIn(controller);
      final gate = Completer<int>();
      final pending = controller.runAuthenticated((_) => gate.future);
      final expectation = expectLater(
        pending,
        throwsA(isA<SessionOperationException>()),
      );
      await controller.logout();
      gate.complete(1);
      await expectation;
      expect(controller.state.status, SessionStatus.guest);
    },
  );

  test('403 en una operación privada conserva la sesión', () async {
    final controller = makeController(FakeSessionStore());
    await signIn(controller);
    await expectLater(
      controller.runAuthenticated((_) async {
        throw const ApiException(ApiErrorKind.http, statusCode: 403);
      }),
      throwsA(isA<ApiException>()),
    );
    expect(controller.state.status, SessionStatus.authenticated);
  });

  test('ticket de otro controlador no es aceptado', () async {
    final first = makeController(FakeSessionStore());
    final secondStore = FakeSessionStore();
    final second = makeController(secondStore);
    final attempt = first.beginAuthentication();
    await second.acceptLogin(attempt, login());
    expect(second.state.status, SessionStatus.guest);
    expect(secondStore.writes, 0);
  });

  test('vencimiento durante escritura no publica autenticado', () async {
    var now = initialTime;
    final store = FakeSessionStore()
      ..writeGate = Completer<void>()
      ..writeStarted = Completer<void>();
    final controller = makeController(store, clock: () => now);
    final attempt = controller.beginAuthentication();
    final pending = controller.acceptLogin(attempt, login());
    await store.writeStarted!.future;
    now = now.add(const Duration(hours: 24));
    store.writeGate!.complete();
    await pending;
    expect(controller.state.status, SessionStatus.guest);
    expect(controller.state.issue, SessionIssue.expired);
    expect(store.value, isNull);
  });
}
