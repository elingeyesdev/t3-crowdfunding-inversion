import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:movil/app/router/app_router.dart';
import 'package:movil/app/router/app_routes.dart';
import 'package:movil/app/shell/main_shell.dart';
import 'package:movil/features/account/presentation/account_page.dart';
import 'package:movil/features/auth/application/app_dependencies.dart';
import 'package:movil/features/auth/domain/auth_session.dart';
import 'package:movil/features/catalog/presentation/explore_page.dart';
import 'package:movil/features/notifications/presentation/notifications_page.dart';

import '../features/auth/auth_test_support.dart';
import '../features/catalog/catalog_test_support.dart';

Future<void> authenticateAs(AppDependencies deps, List<String> roles) async {
  final attempt = deps.session.beginAuthentication();
  await deps.session.acceptLogin(
    attempt,
    LoginResponse.fromJson({
      'statusCode': 200,
      'data': {...testLoginData(), 'user': testUser(roles: roles)},
    }),
  );
}

List<String> destinationLabels(WidgetTester tester) => tester
    .widgetList<NavigationDestination>(find.byType(NavigationDestination))
    .map((destination) => destination.label)
    .toList();

void main() {
  for (final roles in [
    <String>['investor'],
    <String>['entrepreneur'],
    <String>['investor', 'entrepreneur'],
    <String>['future_role'],
    <String>[],
  ]) {
    testWidgets('Los destinos y sus índices respetan los roles $roles', (
      tester,
    ) async {
      final deps = testDependencies(
        handler: (_) async => testResponse(testUser(roles: roles)),
      );
      await authenticateAs(deps, roles);
      await pumpAuthApp(tester, deps);
      await tester.pumpAndSettle();
      final donor = roles.contains('investor');
      final labels = [
        'Explorar',
        if (donor) 'Seguimiento',
        'Notificaciones',
        'Cuenta',
      ];
      expect(destinationLabels(tester), labels);

      // Una pestaña oculta no puede desplazar Notificaciones hacia Seguimiento.
      await tester.tap(
        find.byType(NavigationDestination).at(labels.indexOf('Notificaciones')),
      );
      await tester.pumpAndSettle();
      expect(find.byType(NotificationsPage), findsOneWidget);
      final router = GoRouter.of(tester.element(find.byType(MainShell)));
      expect(
        router.routeInformationProvider.value.uri.path,
        AppRoutes.notifications,
      );

      await tester.tap(find.byType(NavigationDestination).last);
      await tester.pumpAndSettle();
      expect(find.byType(AccountPage), findsOneWidget);
      expect(
        find.byKey(const Key('account.receipts')),
        donor ? findsOneWidget : findsNothing,
      );
      expect(router.routeInformationProvider.value.uri.path, AppRoutes.account);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('El emprendedor vuelve al catálogo desde rutas de donante', (
    tester,
  ) async {
    final requested = <String>[];
    final deps = testDependencies(
      includeTracking: true,
      handler: (request) async {
        requested.add(request.url.path);
        return testResponse(null);
      },
    );
    await authenticateAs(deps, ['entrepreneur']);
    final paths = [
      AppRoutes.tracking,
      '${AppRoutes.tracking}/campanas/${campaignId(1)}',
      AppRoutes.receipts,
      '${AppRoutes.receipts}/${campaignId(1)}',
      '/explorar/campanas/${campaignId(1)}/aportar',
    ];
    for (final path in paths) {
      final router = AppRouter.create(
        dependencies: deps,
        initialLocation: path,
      );
      await tester.pumpWidget(MaterialApp.router(routerConfig: router));
      await tester.pumpAndSettle();
      expect(router.routeInformationProvider.value.uri.path, AppRoutes.explore);
      expect(find.byType(ExplorePage), findsOneWidget);
      expect(destinationLabels(tester), [
        'Explorar',
        'Notificaciones',
        'Cuenta',
      ]);
      expect(requested, isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
      router.dispose();
    }
    deps.dispose();
  });

  testWidgets('El login de emprendedor descarta un retorno de donante', (
    tester,
  ) async {
    final deps = testDependencies();
    await pumpAuthApp(tester, deps, location: AppRoutes.tracking);
    await tester.pumpAndSettle();
    expect(find.text('Acceso'), findsOneWidget);
    await authenticateAs(deps, ['entrepreneur']);
    await tester.pumpAndSettle();
    expect(find.byType(ExplorePage), findsOneWidget);
    expect(destinationLabels(tester), ['Explorar', 'Notificaciones', 'Cuenta']);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Cambiar de donante a emprendedor elimina el destino anterior', (
    tester,
  ) async {
    final deps = testDependencies();
    await authenticateAs(deps, ['investor']);
    await pumpAuthApp(tester, deps, location: AppRoutes.tracking);
    await tester.pumpAndSettle();
    expect(destinationLabels(tester), contains('Seguimiento'));
    await authenticateAs(deps, ['entrepreneur']);
    await tester.pumpAndSettle();
    final router = GoRouter.of(tester.element(find.byType(MainShell)));
    expect(router.routeInformationProvider.value.uri.path, AppRoutes.explore);
    expect(destinationLabels(tester), ['Explorar', 'Notificaciones', 'Cuenta']);
    await authenticateAs(deps, ['investor']);
    await tester.pumpAndSettle();
    expect(destinationLabels(tester), contains('Seguimiento'));
    expect(tester.takeException(), isNull);
  });

  testWidgets('Aportar se actualiza por rol sin volver a cargar la campaña', (
    tester,
  ) async {
    var detailRequests = 0;
    final deps = testDependencies(
      includeCatalog: true,
      handler: (request) async {
        if (request.url.path.endsWith('/auth/logout')) {
          return testResponse(null);
        }
        if (request.url.path == '/api/v1/categories') return testResponse([]);
        if (request.url.path == '/api/v1/campaigns/public') {
          return testResponse(pageFixture([]));
        }
        detailRequests++;
        return testResponse(campaignFixture());
      },
    );
    await authenticateAs(deps, ['investor']);
    final router = AppRouter.create(
      dependencies: deps,
      initialLocation: '/explorar/campanas/${campaignId(1)}',
    );
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byKey(const Key('campaign.contribute')),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('campaign.contribute')), findsOneWidget);
    expect(detailRequests, 1);

    await authenticateAs(deps, ['entrepreneur']);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('campaign.contribute')), findsNothing);
    expect(
      router.routeInformationProvider.value.uri.path,
      '/explorar/campanas/${campaignId(1)}',
    );
    expect(detailRequests, 1);

    await authenticateAs(deps, ['investor', 'entrepreneur']);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('campaign.contribute')), findsOneWidget);
    expect(detailRequests, 1);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    router.dispose();
    deps.dispose();
  });
}
