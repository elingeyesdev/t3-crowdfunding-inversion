import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/app/router/app_routes.dart';
import 'package:movil/features/catalog/presentation/campaign_detail_page.dart';

import '../auth/auth_test_support.dart';
import 'catalog_test_support.dart';

Future<void> tapCatalog(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder.hitTestable(),
    200,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
  expect(finder.hitTestable(), findsOneWidget);
  await tester.tap(finder.hitTestable());
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('invitado abre detalle y vuelve al catálogo sin autenticarse', (
    tester,
  ) async {
    final paths = <String>[];
    final deps = testDependencies(
      includeCatalog: true,
      handler: (r) async {
        expect(r.headers['authorization'], null);
        paths.add(r.url.path);
        if (r.url.path.endsWith('categories')) {
          return testResponse([categoryFixture()]);
        }
        if (r.url.path.endsWith('public')) {
          return testResponse(pageFixture([campaignFixture()]));
        }
        return testResponse(campaignFixture());
      },
    );
    await pumpAuthApp(tester, deps);
    await tester.pumpAndSettle();
    await tapCatalog(tester, find.text('Ver campaña'));
    expect(find.byType(CampaignDetailPage), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    await tester.scrollUntilVisible(
      find.byKey(const Key('campaign.description')),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Descripción completa del proyecto.'), findsOneWidget);
    expect(paths, contains('/api/v1/campaigns/public/${campaignId(1)}'));
    expect(paths, isNot(contains('/api/v1/auth/login')));
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.byType(CampaignDetailPage), findsNothing);
  });
  testWidgets('búsqueda sin resultados se puede limpiar', (tester) async {
    final queries = <String?>[];
    final deps = testDependencies(
      includeCatalog: true,
      handler: (r) async {
        if (r.url.path.endsWith('categories')) return testResponse([]);
        queries.add(r.url.queryParameters['q']);
        return testResponse(
          pageFixture(
            r.url.queryParameters.containsKey('q') ? [] : [campaignFixture()],
          ),
        );
      },
    );
    await pumpAuthApp(tester, deps);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('catalog.search')),
      'sin resultados',
    );
    await tester.tap(find.byKey(const Key('catalog.searchSubmit')));
    await tester.pumpAndSettle();
    expect(
      find.text('No hay campañas que coincidan con tu búsqueda.'),
      findsOneWidget,
    );
    expect(queries.last, 'sin resultados');
    await tapCatalog(tester, find.byKey(const Key('catalog.clear')));
    expect(queries.last, null);
    expect(
      tester
          .widget<TextField>(find.byKey(const Key('catalog.search')))
          .controller!
          .text,
      '',
    );
    await tester.enterText(find.byKey(const Key('catalog.search')), '   ');
    await tester.tap(find.byKey(const Key('catalog.searchSubmit')));
    await tester.pumpAndSettle();
    expect(queries.last, null);
    expect(find.byKey(const Key('catalog.clear')), findsNothing);
  });
  testWidgets('categoría se combina con búsqueda y limpia ambos filtros', (
    tester,
  ) async {
    final queries = <Map<String, String>>[];
    final deps = testDependencies(
      includeCatalog: true,
      handler: (r) async {
        if (r.url.path.endsWith('categories')) {
          return testResponse([categoryFixture()]);
        }
        queries.add(r.url.queryParameters);
        return testResponse(pageFixture([]));
      },
    );
    await pumpAuthApp(tester, deps);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('catalog.search')),
      'educación',
    );
    await tester.tap(find.byKey(const Key('catalog.searchSubmit')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('catalog.category')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tecnología').last);
    await tester.pumpAndSettle();
    expect(queries.last['q'], 'educación');
    expect(queries.last['categoryId'], categoryId);
    await tapCatalog(tester, find.byKey(const Key('catalog.clear')));
    expect(queries.last.containsKey('q'), false);
    expect(queries.last.containsKey('categoryId'), false);
  });
  testWidgets('error de catálogo permite reintentar sin simular lista vacía', (
    tester,
  ) async {
    var fail = true;
    final deps = testDependencies(
      includeCatalog: true,
      handler: (r) async {
        if (r.url.path.endsWith('categories')) return testResponse([]);
        return fail
            ? testResponse(null, status: 503)
            : testResponse(pageFixture([]));
      },
    );
    await pumpAuthApp(tester, deps);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('catalog.error')), findsOneWidget);
    expect(find.byKey(const Key('catalog.empty')), findsNothing);
    fail = false;
    await tapCatalog(tester, find.text('Reintentar catálogo'));
    expect(find.byKey(const Key('catalog.empty')), findsOneWidget);
  });
  testWidgets(
    'página adicional fallida conserva campañas y reintenta la misma página',
    (tester) async {
      var fail = true;
      final pages = <String>[];
      final deps = testDependencies(
        includeCatalog: true,
        handler: (r) async {
          if (r.url.path.endsWith('categories')) return testResponse([]);
          final page = r.url.queryParameters['page']!;
          pages.add(page);
          if (page == '2' && fail) return testResponse(null, status: 503);
          return testResponse(
            pageFixture(
              [campaignFixture(number: int.parse(page))],
              page: int.parse(page),
              pages: 2,
              total: 2,
            ),
          );
        },
      );
      await pumpAuthApp(tester, deps);
      await tester.pumpAndSettle();
      await tapCatalog(tester, find.byKey(const Key('catalog.more')));
      expect(find.byKey(const Key('catalog.pageError')), findsOneWidget);
      expect(find.byKey(Key('campaign.${campaignId(1)}')), findsOneWidget);
      fail = false;
      await tapCatalog(tester, find.byKey(const Key('catalog.more')));
      expect(pages, ['1', '2', '2']);
      expect(find.byKey(Key('campaign.${campaignId(2)}')), findsOneWidget);
      expect(find.byKey(const Key('catalog.more')), findsNothing);
    },
  );
  testWidgets('detalle privado o inexistente ofrece salida al catálogo', (
    tester,
  ) async {
    final deps = testDependencies(
      includeCatalog: true,
      handler: (r) async {
        if (r.url.path.endsWith('categories')) return testResponse([]);
        if (r.url.path.endsWith('public')) return testResponse(pageFixture([]));
        return testResponse(null, status: 404);
      },
    );
    await pumpAuthApp(
      tester,
      deps,
      location: '/explorar/campanas/${campaignId(1)}',
    );
    await tester.pumpAndSettle();
    expect(find.text('La campaña no está disponible.'), findsOneWidget);
    await tester.tap(find.text('Volver al catálogo'));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsOneWidget);
  });
  testWidgets('detalle recupera su contenido después de error temporal', (
    tester,
  ) async {
    var fail = true;
    final deps = testDependencies(
      includeCatalog: true,
      handler: (r) async {
        if (r.url.path.endsWith('categories')) return testResponse([]);
        if (r.url.path.endsWith('public')) return testResponse(pageFixture([]));
        return fail
            ? testResponse(null, status: 503)
            : testResponse(campaignFixture());
      },
    );
    await pumpAuthApp(
      tester,
      deps,
      location: '/explorar/campanas/${campaignId(1)}',
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('campaign.detailError')), findsOneWidget);
    fail = false;
    await tapCatalog(tester, find.text('Reintentar consulta'));
    expect(find.byKey(const Key('campaign.title')), findsOneWidget);
  });
  testWidgets('catálogo en 320x480 y texto al doble admite desplazamiento', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 480);
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final deps = testDependencies(
      includeCatalog: true,
      handler: (r) async => r.url.path.endsWith('categories')
          ? testResponse([categoryFixture()])
          : testResponse(pageFixture([campaignFixture()])),
    );
    await pumpAuthApp(tester, deps);
    await tester.pumpAndSettle();
    await tapCatalog(tester, find.text('Ver campaña'));
    expect(tester.takeException(), null);
  });
  test('retorno acepta solo detalle UUID exacto y no URLs externas', () {
    final path = '/explorar/campanas/${campaignId(1)}';
    expect(AppRoutes.safeReturn(path), path);
    for (final unsafe in [
      'https://evil.test',
      '$path?secret=1',
      '/explorar/campanas/../cuenta',
      '/explorar/otro',
    ]) {
      expect(AppRoutes.safeReturn(unsafe), AppRoutes.account);
    }
  });
}
