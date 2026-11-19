import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movil/core/network/api_exception.dart';
import 'package:movil/features/auth/application/session_state.dart';

import 'auth_test_support.dart';

void main() {
  test(
    'Restauraciones simultáneas comparten la operación de almacenamiento',
    () async {
      final store = MemorySessionStore()..readGate = Completer<void>();
      final dependencies = testDependencies(store: store);
      addTearDown(dependencies.dispose);
      final first = dependencies.restore();
      final second = dependencies.restore();
      expect(identical(first, second), isTrue);
      store.readGate!.complete();
      await first;
      expect(store.reads, 1);
      expect(dependencies.session.state.status, SessionStatus.guest);
    },
  );

  test(
    'Dos 401 concurrentes limpian la misma sesión sin exponer credenciales',
    () async {
      final responses = [
        Completer<http.Response>(),
        Completer<http.Response>(),
      ];
      final requested = Completer<void>();
      var calls = 0;
      final store = MemorySessionStore();
      final dependencies = testDependencies(
        store: store,
        handler: (request) {
          expect(request.headers['authorization'], 'Bearer 1|synthetic-only');
          final response = responses[calls++];
          if (calls == 2) requested.complete();
          return response.future;
        },
      );
      addTearDown(dependencies.dispose);
      await authenticateTest(dependencies);
      final first = dependencies.authenticated((api) => api.get('auth/me'));
      final second = dependencies.authenticated((api) => api.get('auth/me'));
      final firstResult = expectLater(
        first,
        throwsA(
          isA<ApiException>().having(
            (error) => error.toString(),
            'mensaje',
            isNot(contains('synthetic-only')),
          ),
        ),
      );
      final secondResult = expectLater(
        second,
        throwsA(isA<SessionOperationException>()),
      );
      await requested.future;
      responses[0].complete(http.Response('{}', 401));
      await firstResult;
      responses[1].complete(http.Response('{}', 401));
      await secondResult;
      expect(store.value, isNull);
      expect(dependencies.session.state.status, SessionStatus.guest);
    },
  );

  test('401 de otra generación no invalida un login posterior', () async {
    final response = Completer<http.Response>();
    final requested = Completer<void>();
    final dependencies = testDependencies(
      handler: (_) {
        requested.complete();
        return response.future;
      },
    );
    addTearDown(dependencies.dispose);
    await authenticateTest(dependencies);
    final pending = dependencies.authenticated((api) => api.get('auth/me'));
    final result = expectLater(
      pending,
      throwsA(isA<SessionOperationException>()),
    );
    await requested.future;
    await authenticateTest(dependencies);
    response.complete(http.Response('{}', 401));
    await result;
    expect(dependencies.session.state.status, SessionStatus.authenticated);
  });

  test('403 en una operación privada conserva la sesión', () async {
    final dependencies = testDependencies(
      handler: (_) async => http.Response('{}', 403),
    );
    addTearDown(dependencies.dispose);
    await authenticateTest(dependencies);
    await expectLater(
      dependencies.authenticated((api) => api.get('auth/me')),
      throwsA(isA<ApiException>()),
    );
    expect(dependencies.session.state.status, SessionStatus.authenticated);
  });
}
