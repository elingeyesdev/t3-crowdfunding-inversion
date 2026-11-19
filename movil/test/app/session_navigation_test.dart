import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:movil/app/router/app_routes.dart';
import 'package:movil/app/shell/main_shell.dart';
import 'package:movil/core/storage/session_store.dart';
import 'package:movil/features/auth/application/session_state.dart';
import 'package:movil/features/auth/presentation/login_page.dart';
import 'package:movil/features/tracking/presentation/tracking_page.dart';

import '../features/auth/auth_test_support.dart';

StoredSession saved(String identity, {bool expired = false}) => StoredSession(
  accessToken: '1|synthetic-only',
  apiIdentity: identity,
  issuedAt: DateTime.now().subtract(Duration(hours: expired ? 25 : 1)),
);

void main() {
  for (final roles in [
    <String>['unrecognized_role'],
    <String>[],
  ]) {
    testWidgets('Cuenta respeta roles $roles sin asignar inversor', (
      tester,
    ) async {
      final dependencies = testDependencies(
        handler: (_) async => testResponse(testUser(roles: roles)),
      );
      await authenticateTest(dependencies);
      await pumpAuthApp(tester, dependencies, location: '/cuenta');
      await tester.pumpAndSettle();
      expect(
        find.text(
          roles.isEmpty ? 'Sin roles asignados' : 'Roles: unrecognized_role',
        ),
        findsOneWidget,
      );
      expect(find.textContaining('investor'), findsNothing);
      final router = GoRouter.of(tester.element(find.byType(MainShell)));
      router.go('/registro');
      await tester.pumpAndSettle();
      expect(router.routeInformationProvider.value.uri.path, '/cuenta');
      expect(find.byKey(const Key('register.submit')), findsNothing);
    });
  }

  testWidgets('La expiración activa oculta datos y bloquea rutas privadas', (
    tester,
  ) async {
    var now = DateTime.utc(2026, 11, 18);
    final store = MemorySessionStore();
    final dependencies = testDependencies(store: store, clock: () => now);
    await authenticateTest(dependencies);
    await pumpAuthApp(tester, dependencies, location: '/cuenta');
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('account.email')), findsOneWidget);
    now = now.add(const Duration(hours: 24));
    await tester.pump(const Duration(hours: 24));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('account.email')), findsNothing);
    expect(dependencies.session.state.issue, SessionIssue.expired);
    expect(store.value, isNull);
  });

  test('El destino de retorno acepta solo rutas internas conocidas', () {
    for (final value in [
      'https://evil.test',
      '//evil.test',
      '/acceso',
      '/registro',
      '/seguimiento?token=secret',
      null,
    ]) {
      expect(AppRoutes.safeReturn(value), AppRoutes.account);
    }
    expect(AppRoutes.safeReturn(AppRoutes.tracking), AppRoutes.tracking);
  });

  for (final path in ['/seguimiento', '/notificaciones']) {
    testWidgets('Visitante no entra mediante enlace directo $path', (
      tester,
    ) async {
      final dependencies = testDependencies();
      await pumpAuthApp(tester, dependencies, location: path);
      await tester.pumpAndSettle();
      expect(find.byType(LoginPage), findsOneWidget);
      expect(find.byType(TrackingPage), findsNothing);
      final router = GoRouter.of(tester.element(find.byType(LoginPage)));
      expect(
        router.routeInformationProvider.value.uri.queryParameters['from'],
        path,
      );
      await authenticateTest(dependencies);
      await tester.pumpAndSettle();
      expect(router.routeInformationProvider.value.uri.path, path);
      expect(
        tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
        path == '/seguimiento' ? 1 : 2,
      );
    });
  }

  testWidgets('Restauración inicial oculta datos hasta validar auth/me', (
    tester,
  ) async {
    final response = Completer<http.Response>();
    final store = MemorySessionStore()..readGate = Completer<void>();
    final dependencies = testDependencies(
      store: store,
      handler: (request) {
        expect(request.url.path, '/api/v1/auth/me');
        expect(request.headers['authorization'], 'Bearer 1|synthetic-only');
        return response.future;
      },
    );
    store.value = saved(StoredSession.identityFor(dependencies.config));
    await pumpAuthApp(tester, dependencies, location: '/seguimiento');
    expect(dependencies.session.state.status, SessionStatus.checking);
    expect(find.byType(TrackingPage), findsNothing);
    expect(find.text('test@example.com'), findsNothing);
    store.readGate!.complete();
    await tester.pump();
    response.complete(testResponse(testUser()));
    await tester.pumpAndSettle();
    expect(dependencies.session.state.status, SessionStatus.authenticated);
    expect(find.byType(TrackingPage), findsOneWidget);
    expect(store.reads, 1);
  });

  testWidgets(
    'Error de conexión conserva credencial, bloquea y permite reintentar',
    (tester) async {
      var disconnected = true;
      final store = MemorySessionStore();
      final dependencies = testDependencies(
        store: store,
        handler: (_) async {
          if (disconnected) {
            throw http.ClientException('sensitive-native-secret');
          }
          return testResponse(testUser());
        },
      );
      store.value = saved(StoredSession.identityFor(dependencies.config));
      await pumpAuthApp(tester, dependencies, location: '/seguimiento');
      await tester.pumpAndSettle();
      expect(dependencies.session.state.issue, SessionIssue.network);
      expect(store.value, isNotNull);
      expect(find.byType(TrackingPage), findsNothing);
      expect(find.textContaining('sensitive-native-secret'), findsNothing);
      disconnected = false;
      await tester.tap(find.text('Reintentar validación'));
      await tester.pumpAndSettle();
      expect(find.byType(TrackingPage), findsOneWidget);
    },
  );

  for (final status in [401, 503]) {
    testWidgets(
      'Restauración HTTP $status diferencia rechazo y fallo temporal',
      (tester) async {
        final store = MemorySessionStore();
        final dependencies = testDependencies(
          store: store,
          handler: (_) async => http.Response('{}', status),
        );
        store.value = saved(StoredSession.identityFor(dependencies.config));
        await pumpAuthApp(tester, dependencies, location: '/cuenta');
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('account.email')), findsNothing);
        expect(store.value == null, status == 401);
        expect(
          dependencies.session.state.status,
          status == 401 ? SessionStatus.guest : SessionStatus.recoverableError,
        );
      },
    );
  }

  testWidgets('Credencial vencida no llama al servidor ni muestra datos', (
    tester,
  ) async {
    var requests = 0;
    final store = MemorySessionStore();
    final dependencies = testDependencies(
      store: store,
      handler: (_) async {
        requests++;
        return testResponse(testUser());
      },
    );
    store.value = saved(
      StoredSession.identityFor(dependencies.config),
      expired: true,
    );
    await pumpAuthApp(tester, dependencies, location: '/seguimiento');
    await tester.pumpAndSettle();
    expect(requests, 0);
    expect(store.value, isNull);
    expect(
      find.text('Tu sesión expiró. Inicia sesión nuevamente.'),
      findsOneWidget,
    );
    expect(find.byType(LoginPage), findsOneWidget);
  });

  testWidgets(
    'Almacenamiento inaccesible ofrece recuperación sin datos privados',
    (tester) async {
      final store = MemorySessionStore()..failRead = true;
      final dependencies = testDependencies(store: store);
      await pumpAuthApp(tester, dependencies, location: '/cuenta');
      await tester.pumpAndSettle();
      expect(dependencies.session.state.issue, SessionIssue.storageUnavailable);
      expect(find.byKey(const Key('account.email')), findsNothing);
      store.failRead = false;
      await tester.tap(find.text('Reintentar validación'));
      await tester.pumpAndSettle();
      expect(dependencies.session.state.status, SessionStatus.guest);
      expect(find.text('Ir a Acceso'), findsOneWidget);
    },
  );

  for (final remoteFails in [false, true]) {
    testWidgets('Logout con error remoto=$remoteFails elimina pilas privadas', (
      tester,
    ) async {
      final store = MemorySessionStore();
      final remote = Completer<http.Response>();
      final dependencies = testDependencies(
        store: store,
        handler: (request) async {
          if (request.url.path.endsWith('logout')) return remote.future;
          return testResponse(testUser());
        },
      );
      await authenticateTest(dependencies);
      await pumpAuthApp(tester, dependencies, location: '/seguimiento');
      await tester.pumpAndSettle();
      var router = GoRouter.of(tester.element(find.byType(MainShell)));
      router.push('/cuenta');
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('account.logout')));
      await tester.pump();
      expect(dependencies.session.state.status, SessionStatus.closing);
      expect(dependencies.session.accessToken, isNull);
      expect(find.byKey(const Key('account.email')), findsNothing);
      if (remoteFails) {
        remote.completeError(http.ClientException('private-error'));
      } else {
        remote.complete(testResponse(null));
      }
      await tester.pumpAndSettle();
      expect(store.value, isNull);
      expect(find.byKey(const Key('account.logoutResult')), findsOneWidget);
      expect(
        find.text(
          remoteFails
              ? 'Sesión local cerrada. No se pudo confirmar la revocación remota.'
              : 'Sesión cerrada y revocación remota confirmada.',
        ),
        findsOneWidget,
      );
      router = GoRouter.of(tester.element(find.byType(MainShell)));
      expect(router.canPop(), isFalse);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byType(TrackingPage), findsNothing);
      expect(find.byKey(const Key('account.email')), findsNothing);
      router.go('/seguimiento');
      await tester.pumpAndSettle();
      expect(find.byType(LoginPage), findsOneWidget);
    });
  }

  testWidgets(
    'Fallo de eliminación local mantiene bloqueo y recuperación explícita',
    (tester) async {
      final store = MemorySessionStore();
      final dependencies = testDependencies(store: store);
      await authenticateTest(dependencies);
      await pumpAuthApp(tester, dependencies, location: '/cuenta');
      await tester.pumpAndSettle();
      store.failDelete = true;
      await tester.tap(find.byKey(const Key('account.logout')));
      await tester.pumpAndSettle();
      expect(
        dependencies.session.state.issue,
        SessionIssue.localDeletionFailed,
      );
      expect(find.byKey(const Key('account.email')), findsNothing);
      expect(
        find.textContaining(
          'No se confirmó la limpieza local. El acceso privado sigue bloqueado.',
        ),
        findsOneWidget,
      );
      store.failDelete = false;
      await tester.tap(find.text('Eliminar credenciales locales'));
      await tester.pumpAndSettle();
      expect(store.value, isNull);
      expect(dependencies.session.state.status, SessionStatus.guest);
    },
  );

  testWidgets('Reanudar revalida y agrupa eventos concurrentes', (
    tester,
  ) async {
    final validation = Completer<http.Response>();
    var checks = 0;
    var hold = false;
    final dependencies = testDependencies(
      handler: (_) async {
        checks++;
        return hold ? validation.future : testResponse(testUser());
      },
    );
    await authenticateTest(dependencies);
    await pumpAuthApp(tester, dependencies, location: '/cuenta');
    await tester.pumpAndSettle();
    expect(checks, 1);
    hold = true;
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    expect(find.byKey(const Key('account.email')), findsNothing);
    validation.complete(testResponse(testUser()));
    await tester.pumpAndSettle();
    expect(checks, 2);
    expect(find.byKey(const Key('account.email')), findsOneWidget);
  });

  testWidgets('Respuesta auth/me anterior no revive sesión tras logout', (
    tester,
  ) async {
    final response = Completer<http.Response>();
    final store = MemorySessionStore();
    final dependencies = testDependencies(
      store: store,
      handler: (request) async {
        if (request.url.path.endsWith('logout')) return testResponse(null);
        return response.future;
      },
    );
    store.value = saved(StoredSession.identityFor(dependencies.config));
    await pumpAuthApp(tester, dependencies, location: '/seguimiento');
    await tester.pump();
    final logout = dependencies.logout();
    response.complete(testResponse(testUser()));
    await tester.pumpAndSettle();
    await logout;
    await tester.pumpAndSettle();
    expect(dependencies.session.state.status, SessionStatus.guest);
    expect(find.byType(TrackingPage), findsNothing);
  });
}
