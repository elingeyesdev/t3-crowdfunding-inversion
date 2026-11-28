import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:movil/features/auth/domain/auth_session.dart';
import 'package:movil/features/tracking/presentation/tracking_page.dart';
import 'package:movil/features/tracking/presentation/tracking_campaign_page.dart';
import 'package:movil/features/tracking/presentation/tracking_widgets.dart';

import 'tracking_test_support.dart';

Future<void> trackingTap(WidgetTester tester, Finder finder) async {
  if (finder.evaluate().isEmpty) {
    await tester.scrollUntilVisible(
      finder,
      180,
      scrollable: find
          .descendant(
            of: find.byType(ListView).last,
            matching: find.byType(Scrollable),
          )
          .first,
    );
  }
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder.hitTestable());
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'invitado vuelve a acceso y emprendedor no consulta datos privados',
    (tester) async {
      final api = TrackingApi();
      final deps = trackingDependencies(api);
      await pumpAuthApp(tester, deps, location: '/seguimiento');
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('login.email')), findsOneWidget);
      expect(api.requests, isEmpty);
      final attempt = deps.session.beginAuthentication();
      await deps.session.acceptLogin(
        attempt,
        LoginResponse.fromJson({
          'statusCode': 200,
          'data': {
            ...testLoginData(),
            'user': testUser(roles: ['entrepreneur']),
          },
        }),
      );
      await tester.pumpAndSettle();
      expect(find.byType(TrackingPage), findsNothing);
      expect(
        find.text('Esta función requiere una sesión de donante.'),
        findsNothing,
      );
      expect(
        api.requests.where((r) => r.url.path.startsWith('/api/v1/investments')),
        isEmpty,
      );
      expect(
        api.requests.every((r) => !r.headers.containsKey('authorization')),
        isTrue,
      );
    },
  );
  testWidgets(
    'historial muestra reembolso sin mezclar monedas y permite buscar',
    (tester) async {
      final api = TrackingApi();
      final deps = trackingDependencies(api);
      await authenticateTest(deps);
      await pumpAuthApp(tester, deps, location: '/seguimiento');
      await tester.pumpAndSettle();
      expect(find.text('Aportes registrados: 100,00 BOB'), findsOneWidget);
      expect(find.text('Aportes registrados: 100,00 USD'), findsOneWidget);
      expect(find.text('Reembolsados: 100,00 BOB'), findsOneWidget);
      await tester.enterText(
        find.byKey(const ValueKey('tracking.search')),
        'sin coincidencias',
      );
      await tester.pumpAndSettle();
      expect(
        find.text('No hay resultados para estos filtros.'),
        findsOneWidget,
      );
      await trackingTap(tester, find.text('Limpiar filtros'));
      expect(find.text('No hay resultados para estos filtros.'), findsNothing);
    },
  );
  testWidgets('recompensas incluyen guía y novedades cambian de página', (
    tester,
  ) async {
    final api = TrackingApi();
    final deps = trackingDependencies(api);
    await authenticateTest(deps);
    await pumpAuthApp(tester, deps, location: '/seguimiento');
    await tester.pumpAndSettle();
    await trackingTap(tester, find.byKey(const ValueKey('tracking.tab.1')));
    expect(find.text('Kit de agradecimiento'), findsOneWidget);
    expect(find.text('Recompensa: Enviada'), findsOneWidget);
    await trackingTap(tester, find.byKey(const ValueKey('tracking.tab.2')));
    expect(find.text('Avance 1'), findsOneWidget);
    await trackingTap(tester, find.byKey(const ValueKey('tracking.next')));
    expect(find.text('Avance 2'), findsOneWidget);
    expect(find.text('Avance 1'), findsNothing);
    await trackingTap(tester, find.byKey(const ValueKey('tracking.previous')));
    expect(find.text('Avance 1'), findsOneWidget);
  });
  testWidgets(
    'avances muestran recaudación e hitos y 404 conserva acceso al historial',
    (tester) async {
      final api = TrackingApi();
      final deps = trackingDependencies(api);
      await authenticateTest(deps);
      await pumpAuthApp(
        tester,
        deps,
        location: '/seguimiento/campanas/${campaignId(1)}',
      );
      await tester.pumpAndSettle();
      expect(find.byType(TrackingCampaignPage), findsOneWidget);
      expect(find.text('Hitos del proyecto'), findsOneWidget);
      expect(find.text('Prototipo'), findsOneWidget);
      final router = GoRouter.of(
        tester.element(find.byType(TrackingCampaignPage)),
      );
      api.campaignStatus = 404;
      router.go('/seguimiento');
      await tester.pumpAndSettle();
      router.go('/seguimiento/campanas/${campaignId(1)}');
      await tester.pumpAndSettle();
      expect(
        find.textContaining(
          'Tus aportes y comprobantes siguen en Seguimiento.',
        ),
        findsOneWidget,
      );
    },
  );
  testWidgets(
    'volver desde otra pestaña actualiza los aportes; sesión nueva oculta los anteriores',
    (tester) async {
      final api = TrackingApi();
      final deps = trackingDependencies(api);
      await authenticateTest(deps);
      await pumpAuthApp(tester, deps, location: '/seguimiento');
      await tester.pumpAndSettle();
      final router = GoRouter.of(tester.element(find.byType(TrackingPage)));
      router.go('/explorar');
      await tester.pumpAndSettle();
      api.rows = [];
      router.go('/seguimiento');
      await tester.pumpAndSettle();
      expect(find.text('Aún no tienes aportes registrados.'), findsOneWidget);
      await authenticateTest(deps);
      await tester.pumpAndSettle();
      expect(find.text('Kit de agradecimiento'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('pantalla 320 y texto doble admiten las tres vistas', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 640);
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final api = TrackingApi();
    final deps = trackingDependencies(api);
    await authenticateTest(deps);
    await pumpAuthApp(tester, deps, location: '/seguimiento');
    await tester.pumpAndSettle();
    for (final i in [0, 1, 2]) {
      await trackingTap(tester, find.byKey(ValueKey('tracking.tab.$i')));
      expect(tester.takeException(), isNull);
    }
  });
  testWidgets('fallo de aplicación externa ofrece copiar el enlace', (
    tester,
  ) async {
    const channel = MethodChannel('unifundme/external');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          SystemChannels.platform,
          (call) async => null,
        );
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(SystemChannels.platform, null),
    );
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (_) async => false);
    addTearDown(
      () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: TrackingLink(
            uri: Uri.parse('https://tracking.example.test/20'),
            label: 'Rastrear envío',
          ),
        ),
      ),
    );
    await tester.tap(find.text('Rastrear envío'));
    await tester.pumpAndSettle();
    expect(
      find.text('No se pudo abrir el enlace. Puedes copiarlo.'),
      findsOneWidget,
    );
    await tester.tap(find.text('Copiar enlace'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();
    expect(find.text('Enlace copiado.'), findsOneWidget);
  });
}
