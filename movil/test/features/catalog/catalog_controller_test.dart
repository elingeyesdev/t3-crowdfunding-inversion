import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_client.dart';
import 'package:movil/features/catalog/application/catalog_controller.dart';
import 'package:movil/features/catalog/data/catalog_repository.dart';
import 'package:movil/features/catalog/domain/public_campaign.dart';

import '../auth/auth_test_support.dart' show testResponse;
import 'catalog_test_support.dart';

CatalogRepository repository(
  Future<http.Response> Function(http.Request) handler,
) {
  final client = MockClient(handler);
  addTearDown(client.close);
  return CatalogRepository(
    ApiClient(
      client: client,
      config: AppConfig.fromValues(
        apiBaseUrl: 'https://api.example.test/api/v1',
      ),
    ),
  );
}

void main() {
  test(
    'distingue carga, vacío y error recuperable sin datos anteriores',
    () async {
      var fail = false;
      final controller = CatalogController(
        repository(
          (_) async => fail
              ? testResponse(null, status: 503)
              : testResponse(pageFixture([])),
        ),
      );
      addTearDown(controller.dispose);
      expect(controller.status, CatalogStatus.loading);
      await controller.loadFirst(const CatalogQuery());
      expect(controller.status, CatalogStatus.empty);
      fail = true;
      await controller.refresh();
      expect(controller.status, CatalogStatus.error);
      expect(controller.campaigns, isEmpty);
      fail = false;
      await controller.loadFirst(const CatalogQuery());
      expect(controller.status, CatalogStatus.empty);
    },
  );
  test(
    'fallo de categorías no bloquea campañas y tiene reintento independiente',
    () async {
      var categoryError = true;
      final controller = CatalogController(
        repository((r) async {
          if (r.url.path.endsWith('categories')) {
            return categoryError
                ? testResponse(null, status: 503)
                : testResponse([categoryFixture()]);
          }
          return testResponse(pageFixture([campaignFixture()]));
        }),
      );
      addTearDown(controller.dispose);
      await controller.initialize();
      expect(controller.status, CatalogStatus.ready);
      expect(controller.categoriesError, isNotNull);
      categoryError = false;
      await controller.loadCategories();
      expect(controller.categories.single.id, categoryId);
      expect(controller.categoriesError, null);
    },
  );
  test(
    'paginación bloquea duplicados simultáneos y unifica IDs repetidos',
    () async {
      final gate = Completer<http.Response>();
      var secondCalls = 0;
      final controller = CatalogController(
        repository((r) async {
          if (r.url.queryParameters['page'] == '2') {
            secondCalls++;
            return gate.future;
          }
          return testResponse(
            pageFixture([campaignFixture()], pages: 2, total: 2),
          );
        }),
      );
      addTearDown(controller.dispose);
      await controller.loadFirst(const CatalogQuery());
      final pending = controller.loadMore();
      await controller.loadMore();
      gate.complete(
        testResponse(
          pageFixture(
            [campaignFixture(), campaignFixture(number: 2)],
            page: 2,
            pages: 2,
            total: 2,
          ),
        ),
      );
      await pending;
      expect(secondCalls, 1);
      expect(controller.campaigns.map((c) => c.id), [
        campaignId(1),
        campaignId(2),
      ]);
      expect(controller.hasMore, false);
    },
  );
  test(
    'fallo de una página conserva lo cargado y reintenta el mismo número',
    () async {
      var fail = true;
      final calls = <String>[];
      final controller = CatalogController(
        repository((r) async {
          final page = r.url.queryParameters['page']!;
          calls.add(page);
          if (page == '2' && fail) return testResponse(null, status: 500);
          return testResponse(
            pageFixture(
              [campaignFixture(number: int.parse(page))],
              page: int.parse(page),
              pages: 2,
              total: 2,
            ),
          );
        }),
      );
      addTearDown(controller.dispose);
      await controller.loadFirst(const CatalogQuery());
      await controller.loadMore();
      expect(controller.campaigns.single.id, campaignId(1));
      expect(controller.pageError, isNotNull);
      fail = false;
      await controller.loadMore();
      expect(calls, ['1', '2', '2']);
      expect(controller.campaigns.length, 2);
      expect(controller.pageError, null);
    },
  );
  test('una búsqueda anterior no sustituye el filtro vigente', () async {
    final gate = Completer<http.Response>();
    final controller = CatalogController(
      repository(
        (r) async => r.url.queryParameters['q'] == 'anterior'
            ? gate.future
            : testResponse(pageFixture([campaignFixture(number: 2)])),
      ),
    );
    addTearDown(controller.dispose);
    final pending = controller.loadFirst(
      const CatalogQuery(search: 'anterior'),
    );
    await controller.loadFirst(const CatalogQuery(search: 'actual'));
    gate.complete(testResponse(pageFixture([campaignFixture()])));
    await pending;
    expect(controller.query.search, 'actual');
    expect(controller.campaigns.single.id, campaignId(2));
  });
  test('detalle distingue 404 de fallo de servicio y se recupera', () async {
    var status = 404;
    final controller = CampaignDetailController(
      repository(
        (_) async => testResponse(
          status == 200 ? campaignFixture() : null,
          status: status,
        ),
      ),
    );
    addTearDown(controller.dispose);
    await controller.load(campaignId(1));
    expect(controller.status, CampaignDetailStatus.notFound);
    status = 503;
    await controller.load(campaignId(1));
    expect(controller.status, CampaignDetailStatus.error);
    status = 200;
    await controller.load(campaignId(1));
    expect(controller.status, CampaignDetailStatus.ready);
    expect(controller.campaign!.id, campaignId(1));
  });
  test('detalle ignora respuesta tardía de otra campaña', () async {
    final gate = Completer<http.Response>();
    final controller = CampaignDetailController(
      repository(
        (r) async => r.url.path.endsWith(campaignId(1))
            ? gate.future
            : testResponse(campaignFixture(number: 2)),
      ),
    );
    addTearDown(controller.dispose);
    final pending = controller.load(campaignId(1));
    await controller.load(campaignId(2));
    gate.complete(testResponse(campaignFixture()));
    await pending;
    expect(controller.campaign!.id, campaignId(2));
  });
  test('dispose invalida peticiones pendientes sin publicar cambios', () async {
    final gate = Completer<http.Response>();
    final controller = CatalogController(repository((_) => gate.future));
    var notifications = 0;
    controller.addListener(() => notifications++);
    final pending = controller.loadFirst(const CatalogQuery());
    controller.dispose();
    final before = notifications;
    gate.complete(testResponse(pageFixture([campaignFixture()])));
    await pending;
    expect(notifications, before);
    expect(controller.campaigns, isEmpty);
  });
}
