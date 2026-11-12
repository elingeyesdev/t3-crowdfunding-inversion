import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/app/unifundme_app.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/features/catalog/presentation/explore_page.dart';
import 'package:movil/main.dart' as entrypoint;

void main() {
  testWidgets('Desarrollo sin API conserva la navegación', (tester) async {
    await tester.pumpWidget(
      UniFundMeApp(configLoader: () => AppConfig.fromValues()),
    );
    await tester.pumpAndSettle();

    expect(find.byType(ExplorePage), findsOneWidget);
    expect(find.byType(NavigationDestination), findsNWidgets(4));
    await tester.tap(find.byType(NavigationDestination).at(3));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Ir a Acceso'));
    await tester.tap(find.text('Ir a Acceso'));
    await tester.pumpAndSettle();
    expect(find.text('Acceso'), findsNWidgets(2));
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('Ir a Acceso'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Producción sin API muestra un error comprensible', (
    tester,
  ) async {
    await tester.pumpWidget(
      UniFundMeApp(
        configLoader: () => AppConfig.fromValues(appEnv: 'production'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No se pudo iniciar UniFundMe'), findsOneWidget);
    expect(
      find.text('Falta la dirección del servicio para producción.'),
      findsOneWidget,
    );
    expect(find.byType(NavigationBar), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('La vista de error no expone parámetros sensibles', (
    tester,
  ) async {
    await tester.pumpWidget(
      UniFundMeApp(
        configLoader: () => AppConfig.fromValues(
          appEnv: 'production',
          apiBaseUrl: 'https://usuario:valor-privado@api.example.com/api/v1',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No se pudo iniciar UniFundMe'), findsOneWidget);
    expect(find.textContaining('valor-privado'), findsNothing);
    expect(find.textContaining('usuario'), findsNothing);
    expect(find.textContaining('api.example.com'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Producción válida conserva Explorar y el tema', (tester) async {
    await tester.pumpWidget(
      UniFundMeApp(
        configLoader: () => AppConfig.fromValues(
          appEnv: 'production',
          apiBaseUrl: 'https://api.example.com/api/v1',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(ExplorePage), findsOneWidget);
    final context = tester.element(find.byType(ExplorePage));
    expect(Theme.of(context).useMaterial3, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('UniFundMe arranca en Explorar sin el contador', (tester) async {
    entrypoint.main();
    await tester.pumpAndSettle();

    expect(find.text('UniFundMe'), findsOneWidget);
    expect(find.byType(ExplorePage), findsOneWidget);
    expect(
      find.text('Esta funcionalidad estará disponible próximamente.'),
      findsOneWidget,
    );
    expect(find.byType(FloatingActionButton), findsNothing);
    expect(find.text('Flutter Demo Home Page'), findsNothing);
    expect(find.text('0'), findsNothing);

    final context = tester.element(find.byType(ExplorePage));
    expect(Theme.of(context).useMaterial3, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Explorar admite pantalla pequeña y texto ampliado', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 480);
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(const UniFundMeApp());
    await tester.pumpAndSettle();

    expect(find.byType(ExplorePage), findsOneWidget);
    await tester.ensureVisible(
      find.text('Esta funcionalidad estará disponible próximamente.'),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
