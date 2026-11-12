import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:movil/app/router/app_router.dart';
import 'package:movil/app/router/app_routes.dart';
import 'package:movil/app/shell/main_shell.dart';
import 'package:movil/app/unifundme_app.dart';
import 'package:movil/features/account/presentation/account_page.dart';
import 'package:movil/features/catalog/presentation/explore_page.dart';
import 'package:movil/features/notifications/presentation/notifications_page.dart';
import 'package:movil/features/tracking/presentation/tracking_page.dart';
import 'package:movil/shared/widgets/feature_pending_view.dart';

void main() {
  testWidgets('La raíz redirige a Explorar y selecciona la primera pestaña', (
    tester,
  ) async {
    final router = AppRouter.create();
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    expect(router.routeInformationProvider.value.uri.path, AppRoutes.explore);
    expect(find.byType(ExplorePage), findsOneWidget);
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      0,
    );
    expect(find.byType(NavigationDestination), findsNWidgets(4));

    await tester.pumpWidget(const SizedBox.shrink());
    router.dispose();
  });

  testWidgets('Las cuatro pestañas muestran su página y actualizan la ruta', (
    tester,
  ) async {
    await tester.pumpWidget(const UniFundMeApp());
    await tester.pumpAndSettle();
    final router = GoRouter.of(tester.element(find.byType(MainShell)));
    final pages = [ExplorePage, TrackingPage, NotificationsPage, AccountPage];
    final paths = [
      AppRoutes.explore,
      AppRoutes.tracking,
      AppRoutes.notifications,
      AppRoutes.account,
    ];
    final labels = ['Explorar', 'Seguimiento', 'Notificaciones', 'Cuenta'];

    // Incluye volver a la primera pestaña después de visitar las demás.
    for (final index in [0, 1, 2, 3, 0]) {
      await tester.tap(find.byType(NavigationDestination).at(index));
      await tester.pumpAndSettle();

      expect(find.byType(pages[index]), findsOneWidget);
      expect(find.byType(FeaturePendingView), findsOneWidget);
      expect(router.routeInformationProvider.value.uri.path, paths[index]);
      final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
      expect(bar.selectedIndex, index);
      final destination = bar.destinations[index] as NavigationDestination;
      expect(destination.label, labels[index]);
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('Abrir una ruta principal directamente sincroniza la pestaña', (
    tester,
  ) async {
    final paths = [
      AppRoutes.explore,
      AppRoutes.tracking,
      AppRoutes.notifications,
      AppRoutes.account,
    ];
    for (var index = 0; index < paths.length; index++) {
      final router = AppRouter.create(initialLocation: paths[index]);
      await tester.pumpWidget(MaterialApp.router(routerConfig: router));
      await tester.pumpAndSettle();

      expect(router.routeInformationProvider.value.uri.path, paths[index]);
      expect(
        tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
        index,
      );
      expect(find.byType(FeaturePendingView), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      router.dispose();
    }
  });

  testWidgets(
    'La navegación mantiene el destino al reconstruir la aplicación',
    (tester) async {
      await tester.pumpWidget(const UniFundMeApp());
      await tester.pumpAndSettle();
      await tester.tap(find.byType(NavigationDestination).at(3));
      await tester.pumpAndSettle();
      final router = GoRouter.of(tester.element(find.byType(MainShell)));

      // Una nueva instancia del widget conserva su State y el router existente.
      await tester.pumpWidget(UniFundMeApp());
      await tester.pumpAndSettle();

      expect(GoRouter.of(tester.element(find.byType(MainShell))), same(router));
      expect(find.byType(AccountPage), findsOneWidget);
      expect(
        tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
        3,
      );
      expect(tester.takeException(), isNull);
    },
  );
}
