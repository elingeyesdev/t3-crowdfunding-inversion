import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:movil/features/auth/application/session_state.dart';
import 'package:movil/features/auth/presentation/auth_validation.dart';
import 'package:movil/features/auth/presentation/login_page.dart';
import 'package:movil/features/auth/presentation/register_page.dart';
import 'package:movil/features/auth/presentation/session_status_view.dart';

import 'auth_test_support.dart';

Future<void> submit(WidgetTester tester, String key) async {
  final button = find.byKey(Key(key));
  await tester.ensureVisible(button);
  await tester.tap(button);
  await tester.pump();
}

void main() {
  testWidgets(
    'Registro construye el formulario al terminar la restauración sin cambiar de ruta',
    (tester) async {
      final store = MemorySessionStore()..readGate = Completer<void>();
      final dependencies = testDependencies(store: store);
      await pumpAuthApp(tester, dependencies, location: '/registro');
      final pendingView = find.byType(SessionStatusView);
      expect(dependencies.session.state.status, SessionStatus.checking);
      expect(pendingView, findsOneWidget);
      expect(find.byType(RegisterPage), findsNothing);
      expect(find.byKey(const Key('register.email')), findsNothing);
      final router = GoRouter.of(tester.element(pendingView));
      expect(router.routeInformationProvider.value.uri.path, '/registro');

      store.readGate!.complete();
      await tester.pumpAndSettle();

      expect(dependencies.session.state.status, SessionStatus.guest);
      expect(find.byType(SessionStatusView), findsNothing);
      expect(find.byType(RegisterPage), findsOneWidget);
      expect(find.byType(TextFormField), findsNWidgets(3));
      expect(find.byKey(const Key('register.email')), findsOneWidget);
      expect(find.byKey(const Key('register.password')), findsOneWidget);
      expect(find.byKey(const Key('register.submit')), findsOneWidget);
      expect(
        GoRouter.of(tester.element(find.byType(RegisterPage))),
        same(router),
      );
      expect(router.routeInformationProvider.value.uri.path, '/registro');
      expect(store.reads, 1);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Registro recupera el formulario tras reintentar un error de almacenamiento',
    (tester) async {
      final store = MemorySessionStore()..failRead = true;
      final dependencies = testDependencies(store: store);
      await pumpAuthApp(tester, dependencies, location: '/registro');
      await tester.pumpAndSettle();
      expect(dependencies.session.state.status, SessionStatus.recoverableError);
      expect(find.byType(SessionStatusView), findsOneWidget);
      expect(find.byType(RegisterPage), findsNothing);
      final router = GoRouter.of(
        tester.element(find.byType(SessionStatusView)),
      );

      store.failRead = false;
      await tester.tap(find.text('Reintentar validación'));
      await tester.pumpAndSettle();

      expect(dependencies.session.state.status, SessionStatus.guest);
      expect(find.byType(SessionStatusView), findsNothing);
      expect(find.byType(RegisterPage), findsOneWidget);
      expect(find.byKey(const Key('register.email')), findsOneWidget);
      expect(router.routeInformationProvider.value.uri.path, '/registro');
      expect(
        GoRouter.of(tester.element(find.byType(RegisterPage))),
        same(router),
      );
      expect(tester.takeException(), isNull);
    },
  );

  test('Las validaciones locales diferencian login y registro', () {
    expect(AuthValidation.email('incorrecto'), isNotNull);
    expect(AuthValidation.email('test@example.com'), isNull);
    expect(AuthValidation.password('a'), isNull);
    expect(AuthValidation.password('a', registration: true), isNotNull);
    expect(
      AuthValidation.password('synthetic1', registration: true),
      isNotNull,
    );
    expect(AuthValidation.password('Synthetic', registration: true), isNotNull);
    expect(AuthValidation.password('Synthetic1', registration: true), isNull);
    expect(
      AuthValidation.password('A1${'a' * 127}', registration: true),
      isNotNull,
    );
    expect(AuthValidation.phone('1' * 21), isNotNull);
    expect(AuthValidation.phone(''), isNull);
    expect(
      AuthValidation.email('${'a' * 250}@test.com', registration: true),
      isNotNull,
    );
  });

  testWidgets('Login inválido no envía solicitudes', (tester) async {
    var requests = 0;
    final dependencies = testDependencies(
      handler: (_) async {
        requests++;
        return testResponse(testLoginData());
      },
    );
    await pumpAuthApp(tester, dependencies, location: '/acceso');
    await tester.pumpAndSettle();
    await submit(tester, 'login.submit');
    expect(requests, 0);
    expect(find.text('Ingresa tu correo electrónico.'), findsOneWidget);
    expect(find.text('Ingresa tu contraseña.'), findsOneWidget);
  });

  testWidgets('Login guarda antes de autenticar y bloquea doble envío', (
    tester,
  ) async {
    final response = Completer<http.Response>();
    final store = MemorySessionStore()..writeGate = Completer<void>();
    var requests = 0;
    final dependencies = testDependencies(
      store: store,
      handler: (request) async {
        requests++;
        expect(request.url.path, '/api/v1/auth/login');
        expect(request.headers['authorization'], isNull);
        return response.future;
      },
    );
    await pumpAuthApp(tester, dependencies, location: '/acceso');
    await tester.pumpAndSettle();
    await fillLogin(tester);
    await submit(tester, 'login.submit');
    await submit(tester, 'login.submit');
    expect(requests, 1);
    expect(dependencies.session.accessToken, isNull);
    response.complete(testResponse(testLoginData()));
    await tester.pump();
    await tester.pump();
    expect(dependencies.session.state.status, SessionStatus.checking);
    expect(find.byKey(const Key('account.email')), findsNothing);
    store.writeGate!.complete();
    await tester.pumpAndSettle();
    expect(store.value, isNotNull);
    expect(dependencies.session.state.status, SessionStatus.authenticated);
    expect(find.byKey(const Key('account.email')), findsOneWidget);
    expect(
      find.textContaining('investor, entrepreneur, future_role'),
      findsOneWidget,
    );
  });

  for (final status in [401, 422, 429, 500]) {
    testWidgets('Login HTTP $status muestra error seguro', (tester) async {
      final dependencies = testDependencies(
        handler: (_) async => http.Response(
          jsonEncode({
            'message': 'synthetic-private-secret',
            'errors': {
              'email': ['synthetic-private-secret'],
            },
          }),
          status,
          headers: {'retry-after': '30', 'content-type': 'application/json'},
        ),
      );
      await pumpAuthApp(tester, dependencies, location: '/acceso');
      await tester.pumpAndSettle();
      await fillLogin(tester);
      await submit(tester, 'login.submit');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('login.error')), findsOneWidget);
      expect(find.textContaining('synthetic-private-secret'), findsNothing);
      expect(dependencies.session.accessToken, isNull);
      if (status == 429) {
        expect(find.textContaining('30 segundos'), findsOneWidget);
      }
      if (status == 422) {
        expect(find.text('Revisa este campo.'), findsOneWidget);
      }
      final password = tester.widget<TextFormField>(
        find.byKey(const Key('login.password')),
      );
      expect(password.controller!.text, isEmpty);
    });
  }

  for (final path in ['/acceso', '/registro']) {
    testWidgets('$path oculta y permite mostrar la contraseña', (tester) async {
      final dependencies = testDependencies();
      await pumpAuthApp(tester, dependencies, location: path);
      await tester.pumpAndSettle();
      final field = find.byKey(
        Key(path == '/acceso' ? 'login.password' : 'register.password'),
      );
      TextField password() => tester.widget<TextField>(
        find.descendant(of: field, matching: find.byType(TextField)),
      );
      expect(password().obscureText, isTrue);
      await tester.tap(find.byTooltip('Mostrar contraseña'));
      await tester.pump();
      expect(password().obscureText, isFalse);
      await tester.tap(find.byTooltip('Ocultar contraseña'));
      await tester.pump();
      expect(password().obscureText, isTrue);
    });
  }

  testWidgets('Fallo de persistencia no permite entrar a Cuenta privada', (
    tester,
  ) async {
    final store = MemorySessionStore()..failWrite = true;
    final dependencies = testDependencies(store: store);
    await pumpAuthApp(tester, dependencies, location: '/acceso');
    await tester.pumpAndSettle();
    await fillLogin(tester);
    await submit(tester, 'login.submit');
    await tester.pumpAndSettle();
    expect(dependencies.session.state.issue, SessionIssue.persistenceFailed);
    expect(
      find.text('No se pudo guardar la sesión de forma segura.'),
      findsOneWidget,
    );
    expect(store.value, isNull);
    expect(find.byKey(const Key('account.email')), findsNothing);
  });

  testWidgets('Registro confirma y vuelve a login sin iniciar sesión', (
    tester,
  ) async {
    final store = MemorySessionStore();
    final requests = <String>[];
    final dependencies = testDependencies(
      store: store,
      handler: (request) async {
        requests.add(request.url.path);
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['signupRole'], 'entrepreneur');
        expect(body['preferredLanguage'], 'en');
        expect(body['phone'], '70000000');
        return testResponse(testUser(), status: 201);
      },
    );
    await pumpAuthApp(tester, dependencies, location: '/registro');
    await tester.pumpAndSettle();
    await fillRegistration(tester);
    await tester.enterText(find.byKey(const Key('register.phone')), '70000000');
    await tester.ensureVisible(find.byKey(const Key('register.role')));
    await tester.tap(find.byKey(const Key('register.role')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Emprendedor').last);
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('register.language')));
    await tester.tap(find.byKey(const Key('register.language')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Inglés').last);
    await tester.pumpAndSettle();
    await submit(tester, 'register.submit');
    await tester.pumpAndSettle();
    expect(requests, ['/api/v1/users/register']);
    expect(find.byType(LoginPage), findsOneWidget);
    expect(
      find.text('Registro correcto. Inicia sesión para continuar.'),
      findsOneWidget,
    );
    expect(store.writes, 0);
    expect(dependencies.session.state.status, SessionStatus.guest);
  });

  testWidgets('Registro 422 conserva campos y elimina el secreto', (
    tester,
  ) async {
    final dependencies = testDependencies(
      handler: (_) async => http.Response(
        jsonEncode({
          'errors': {
            'email': ['private-secret'],
            'phone': ['private-secret'],
            'signupRole': ['private-secret'],
          },
        }),
        422,
        headers: {'content-type': 'application/json'},
      ),
    );
    await pumpAuthApp(tester, dependencies, location: '/registro');
    await tester.pumpAndSettle();
    await fillRegistration(tester);
    await submit(tester, 'register.submit');
    await tester.pumpAndSettle();
    expect(find.text('Revisa este campo.'), findsNWidgets(3));
    expect(find.textContaining('private-secret'), findsNothing);
    expect(
      tester
          .widget<TextFormField>(find.byKey(const Key('register.email')))
          .controller!
          .text,
      'test@example.com',
    );
    expect(
      tester
          .widget<TextFormField>(find.byKey(const Key('register.password')))
          .controller!
          .text,
      isEmpty,
    );
  });

  testWidgets(
    'Registro bloquea doble envío y descarta respuestas de otra sesión',
    (tester) async {
      final response = Completer<http.Response>();
      var requests = 0;
      final dependencies = testDependencies(
        handler: (_) async {
          requests++;
          return response.future;
        },
      );
      await pumpAuthApp(tester, dependencies, location: '/registro');
      await tester.pumpAndSettle();
      await fillRegistration(tester);
      await submit(tester, 'register.submit');
      await submit(tester, 'register.submit');
      expect(requests, 1);
      await authenticateTest(dependencies);
      await tester.pumpAndSettle();
      response.complete(testResponse(testUser(), status: 201));
      await tester.pumpAndSettle();
      expect(
        find.text('Registro correcto. Inicia sesión para continuar.'),
        findsNothing,
      );
      expect(dependencies.session.state.status, SessionStatus.authenticated);
    },
  );

  testWidgets('Login tardío no recupera una sesión cerrada', (tester) async {
    final response = Completer<http.Response>();
    final dependencies = testDependencies(handler: (_) => response.future);
    await pumpAuthApp(tester, dependencies, location: '/acceso');
    await tester.pumpAndSettle();
    await fillLogin(tester);
    await submit(tester, 'login.submit');
    await dependencies.session.discardStoredSession();
    response.complete(testResponse(testLoginData()));
    await tester.pumpAndSettle();
    expect(dependencies.session.state.status, SessionStatus.guest);
    expect(find.byKey(const Key('account.email')), findsNothing);
  });

  testWidgets('Acceso sin API permanece deshabilitado', (tester) async {
    final dependencies = testDependencies(configured: false);
    await pumpAuthApp(tester, dependencies, location: '/acceso');
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('login.submit')))
          .onPressed,
      isNull,
    );
    expect(find.text('El servicio aún no está configurado.'), findsOneWidget);
  });

  testWidgets('Registro admite pantalla pequeña y texto ampliado', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 480);
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await pumpAuthApp(tester, testDependencies(), location: '/registro');
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('register.submit')));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
