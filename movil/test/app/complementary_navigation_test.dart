import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:movil/app/router/app_router.dart';
import 'package:movil/app/router/app_routes.dart';
import 'package:movil/app/shell/main_shell.dart';
import 'package:movil/app/unifundme_app.dart';
import 'package:movil/features/account/presentation/account_page.dart';
import 'package:movil/features/catalog/presentation/explore_page.dart';
import 'package:movil/features/tracking/presentation/tracking_page.dart';

Future<void> openAccessFromAccount(WidgetTester tester) async {
  await tester.pumpWidget(const UniFundMeApp());
  await tester.pumpAndSettle();
  await tester.tap(find.byType(NavigationDestination).at(3));
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.text('Ir a Acceso'));
  await tester.tap(find.text('Ir a Acceso'));
  await tester.pumpAndSettle();
}

void expectAccountSelected(WidgetTester tester) {
  expect(find.byType(AccountPage), findsOneWidget);
  expect(
    tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
    3,
  );
}

void main() {
  testWidgets('Cuenta abre Acceso y la flecha regresa a Cuenta', (
    tester,
  ) async {
    await openAccessFromAccount(tester);

    expect(find.text('Acceso'), findsNWidgets(2));
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.byType(TextField), findsNothing);
    final router = GoRouter.of(tester.element(find.byType(BackButton)));
    expect(router.canPop(), isTrue);

    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();

    expectAccountSelected(tester);
    expect(router.canPop(), isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('El evento Atrás del sistema cierra Acceso y conserva Cuenta', (
    tester,
  ) async {
    await openAccessFromAccount(tester);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expectAccountSelected(tester);
    expect(find.byType(BackButton), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Acceso conserva el origen de la pila sin forzar Cuenta', (
    tester,
  ) async {
    await tester.pumpWidget(const UniFundMeApp());
    await tester.pumpAndSettle();
    await tester.tap(find.byType(NavigationDestination).at(1));
    await tester.pumpAndSettle();
    final router = GoRouter.of(tester.element(find.byType(MainShell)));
    router.pushNamed<void>(AppRoutes.accessName);
    await tester.pumpAndSettle();

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.byType(TrackingPage), findsOneWidget);
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      1,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Acceso abierto directamente permite volver a Explorar', (
    tester,
  ) async {
    final router = AppRouter.create(initialLocation: AppRoutes.access);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    expect(router.canPop(), isFalse);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();

    expect(find.byType(ExplorePage), findsOneWidget);
    expect(router.routeInformationProvider.value.uri.path, AppRoutes.explore);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    router.dispose();
  });

  testWidgets('Una ruta inicial desconocida permite recuperar Explorar', (
    tester,
  ) async {
    final router = AppRouter.create(initialLocation: '/pantalla-inexistente');
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    expect(find.text('Página no encontrada'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(
      find.text('Esta funcionalidad estará disponible próximamente.'),
      findsNothing,
    );
    await tester.tap(find.text('Volver a Explorar'));
    await tester.pumpAndSettle();

    expect(find.byType(ExplorePage), findsOneWidget);
    expect(router.canPop(), isFalse);
    expect(router.routeInformationProvider.value.uri.path, AppRoutes.explore);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    router.dispose();
  });

  testWidgets(
    'La recuperación desde una ruta inválida no deja el error debajo',
    (tester) async {
      await tester.pumpWidget(const UniFundMeApp());
      await tester.pumpAndSettle();
      await tester.tap(find.byType(NavigationDestination).at(3));
      await tester.pumpAndSettle();
      final router = GoRouter.of(tester.element(find.byType(MainShell)));
      router.go('/otra-ruta-inexistente');
      await tester.pumpAndSettle();

      expect(find.text('Página no encontrada'), findsOneWidget);
      await tester.tap(find.text('Volver a Explorar'));
      await tester.pumpAndSettle();

      expect(find.byType(ExplorePage), findsOneWidget);
      expect(router.canPop(), isFalse);
      expect(
        tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
        0,
      );
      expect(find.text('Página no encontrada'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Acceso y recuperación admiten texto ampliado en pantalla pequeña',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 480);
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await openAccessFromAccount(tester);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expectAccountSelected(tester);

      final router = GoRouter.of(tester.element(find.byType(MainShell)));
      router.go('/ruta-inexistente');
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Volver a Explorar'));
      await tester.tap(find.text('Volver a Explorar'));
      await tester.pumpAndSettle();

      expect(find.byType(ExplorePage), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
