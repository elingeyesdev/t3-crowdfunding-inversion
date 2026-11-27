import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/app/router/app_routes.dart';
import 'package:movil/features/auth/domain/auth_session.dart';

import 'contribution_test_support.dart';

Future<void> tapContribution(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder.hitTestable(),
    150,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
  expect(finder.hitTestable(), findsOneWidget);
  await tester.tap(finder.hitTestable());
  await tester.pumpAndSettle();
}

void main() {
  final path = '/explorar/campanas/${campaignId(1)}/aportar';
  const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';
  testWidgets(
    'invitado se autentica antes de acceder al formulario de aporte',
    (tester) async {
      final api = ContributionApi();
      final deps = contributionDependencies(api);
      await pumpAuthApp(tester, deps, location: path);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('login.email')), findsOneWidget);
      expect(api.posts, 0);
      expect(find.byKey(const Key('contribution.amount')), findsNothing);
    },
  );
  testWidgets('rol emprendedor solo no puede ver saldo ni realizar aporte', (
    tester,
  ) async {
    final api = ContributionApi()..roles = ['entrepreneur'];
    final deps = contributionDependencies(api);
    final attempt = deps.session.beginAuthentication();
    await deps.session.acceptLogin(
      attempt,
      LoginResponse.fromJson({
        'data': {
          ...testLoginData(),
          'user': testUser(roles: ['entrepreneur']),
        },
        'statusCode': 200,
      }),
    );
    await pumpAuthApp(tester, deps, location: path);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('contribution.amount')), findsNothing);
    expect(
      find.text('Esta función requiere una sesión de donante.'),
      findsNothing,
    );
    expect(api.requests.where((r) => r.url.path.endsWith('/capital')), isEmpty);
  });
  testWidgets('cancelar revisión no escribe; confirmar permite consultar PDF', (
    tester,
  ) async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(const MethodChannel('unifundme/receipt'), (
          call,
        ) async {
          expect(call.method, 'render');
          expect((call.arguments as Map)['bytes'], isA<Uint8List>());
          return {'png': base64Decode(png), 'pages': 2};
        });
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('unifundme/receipt'),
            null,
          ),
    );
    final api = ContributionApi();
    final deps = contributionDependencies(api);
    await authenticateTest(deps);
    await pumpAuthApp(tester, deps, location: path);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('contribution.amount')),
      '100,00',
    );
    await tapContribution(tester, find.byKey(const Key('contribution.review')));
    expect(find.text('Confirmar aporte'), findsOneWidget);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(api.posts, 0);
    await tapContribution(tester, find.byKey(const Key('contribution.review')));
    await tester.tap(find.byKey(const Key('contribution.confirm')));
    await tester.pumpAndSettle();
    expect(api.posts, 1);
    expect(find.byKey(const Key('contribution.success')), findsOneWidget);
    await tapContribution(tester, find.text('Consultar comprobante PDF'));
    expect(find.text('Comprobante PDF'), findsOneWidget);
    expect(find.text('Página 1 de 2'), findsOneWidget);
    await tester.tap(find.byTooltip('Página siguiente'));
    await tester.pumpAndSettle();
    expect(find.text('Página 2 de 2'), findsOneWidget);
    expect(tester.takeException(), null);
  });
  testWidgets('monto inválido muestra validación y no envía escrituras', (
    tester,
  ) async {
    final api = ContributionApi();
    final deps = contributionDependencies(api);
    await authenticateTest(deps);
    await pumpAuthApp(tester, deps, location: path);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('contribution.amount')),
      '1.001',
    );
    await tapContribution(tester, find.byKey(const Key('contribution.review')));
    expect(find.textContaining('Introduce un monto positivo'), findsOneWidget);
    expect(api.posts, 0);
  });
  testWidgets('422 mantiene el monto y no muestra éxito', (tester) async {
    final api = ContributionApi()..postStatus = 422;
    final deps = contributionDependencies(api);
    await authenticateTest(deps);
    await pumpAuthApp(tester, deps, location: path);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('contribution.amount')), '100');
    await tapContribution(tester, find.byKey(const Key('contribution.review')));
    await tester.tap(find.byKey(const Key('contribution.confirm')));
    await tester.pumpAndSettle();
    expect(find.textContaining('El servicio rechazó'), findsOneWidget);
    expect(find.byKey(const Key('contribution.success')), findsNothing);
    expect(
      tester
          .widget<TextField>(find.byKey(const Key('contribution.amount')))
          .controller!
          .text,
      '100',
    );
  });
  testWidgets('sesión cerrada durante revisión oculta el resumen y no envía', (
    tester,
  ) async {
    final api = ContributionApi();
    final deps = contributionDependencies(api);
    await authenticateTest(deps);
    await pumpAuthApp(tester, deps, location: path);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('contribution.amount')), '100');
    await tapContribution(tester, find.byKey(const Key('contribution.review')));
    await deps.logout();
    await tester.pumpAndSettle();
    expect(find.text('Confirmar aporte'), findsNothing);
    expect(find.byKey(const Key('contribution.confirm')), findsNothing);
    expect(api.posts, 0);
    expect(tester.takeException(), null);
  });
  testWidgets('lista sin aportes muestra que todavía no hay comprobantes', (
    tester,
  ) async {
    final api = ContributionApi();
    final deps = contributionDependencies(api);
    await authenticateTest(deps);
    await pumpAuthApp(tester, deps, location: AppRoutes.receipts);
    await tester.pumpAndSettle();
    expect(find.text('Todavía no tienes comprobantes.'), findsOneWidget);
  });
  testWidgets('fallo del visor PDF permite reintentar y logout retira el PDF', (
    tester,
  ) async {
    var fail = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(const MethodChannel('unifundme/receipt'), (
          _,
        ) async {
          if (fail) throw PlatformException(code: 'receipt_unavailable');
          return {'png': base64Decode(png), 'pages': 1};
        });
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('unifundme/receipt'),
            null,
          ),
    );
    final api = ContributionApi();
    final deps = contributionDependencies(api);
    await authenticateTest(deps);
    await pumpAuthApp(
      tester,
      deps,
      location: '/comprobantes/${campaignId(20)}',
    );
    await tester.pumpAndSettle();
    expect(find.text('Reintentar comprobante'), findsOneWidget);
    fail = false;
    await tester.tap(find.text('Reintentar comprobante'));
    await tester.pumpAndSettle();
    expect(find.text('Página 1 de 1'), findsOneWidget);
    await deps.logout();
    await tester.pumpAndSettle();
    expect(find.text('Página 1 de 1'), findsNothing);
    expect(find.byType(InteractiveViewer), findsNothing);
    expect(api.posts, 0);
  });
  testWidgets('320x480 con texto doble permite revisar aporte sin overflow', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 480);
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final api = ContributionApi();
    final deps = contributionDependencies(api);
    await authenticateTest(deps);
    await pumpAuthApp(tester, deps, location: path);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byKey(const Key('contribution.amount')),
      150,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('contribution.amount')), '100');
    await tapContribution(tester, find.byKey(const Key('contribution.review')));
    expect(find.text('Confirmar aporte'), findsOneWidget);
    expect(tester.takeException(), null);
  });
}
