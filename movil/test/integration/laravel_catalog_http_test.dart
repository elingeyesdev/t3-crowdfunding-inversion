import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_client.dart';
import 'package:movil/core/network/api_exception.dart';
import 'package:movil/features/catalog/data/catalog_repository.dart';
import 'package:movil/features/catalog/domain/public_campaign.dart';

import '../features/catalog/catalog_test_support.dart' show campaignId;

// Ejecutar solo contra una API y base temporales con los fixtures de docs/#26.
const apiUrl = String.fromEnvironment('UNIFUNDME_TEST_API_URL');
const isolated = bool.fromEnvironment('UNIFUNDME_ISOLATED_TEST');
const fixtures = bool.fromEnvironment('UNIFUNDME_CATALOG_FIXTURES');

class _LocalHttpOverrides extends HttpOverrides {}

Future<void> withRepository(Future<void> Function(CatalogRepository) action) =>
    HttpOverrides.runWithHttpOverrides(() async {
      expect(['127.0.0.1', 'localhost'], contains(Uri.parse(apiUrl).host));
      final client = http.Client();
      addTearDown(client.close);
      await action(
        CatalogRepository(
          ApiClient(
            client: client,
            config: AppConfig.fromValues(apiBaseUrl: apiUrl),
          ),
        ),
      );
    }, _LocalHttpOverrides());

void main() {
  test(
    'Laravel HTTP real: categorías, búsqueda, filtro y paginación pública',
    () => withRepository((repo) async {
      final categories = await repo.categories();
      final first = await repo.list(const CatalogQuery());
      expect(first.items.length, 20);
      expect(first.total, 24);
      expect(first.hasMore, true);
      final second = await repo.list(const CatalogQuery(), page: 2);
      expect(second.items.length, 4);
      expect(
        {
          ...first.items.map((c) => c.id),
          ...second.items.map((c) => c.id),
        }.length,
        24,
      );
      expect(
        (await repo.list(CatalogQuery(categoryId: categories.first.id))).total,
        12,
      );
      final search = await repo.list(
        const CatalogQuery(search: 'Campana de prueba 01'),
      );
      expect(search.items.single.id, campaignId(1));
      expect(
        (await repo.list(const CatalogQuery(search: 'sin-resultados-xyz')))
            .items,
        isEmpty,
      );
    }),
    skip: apiUrl.isEmpty || !isolated || !fixtures,
  );

  test(
    'Laravel HTTP real: detalle, histórico y privacidad',
    () => withRepository((repo) async {
      final campaign = await repo.detail(campaignId(1));
      expect(campaign.title, 'Campana de prueba 01');
      expect(campaign.goal, 1000);
      expect(campaign.raised, 250);
      expect(campaign.progress, .25);
      expect(campaign.creator, 'Responsable de prueba');
      expect(campaign.description, contains('API real'));
      expect((await repo.detail(campaignId(26))).status, 'completed');
      for (final id in [campaignId(25), campaignId(999)]) {
        await expectLater(
          repo.detail(id),
          throwsA(
            isA<ApiException>().having(
              (error) => error.statusCode,
              'status',
              404,
            ),
          ),
        );
      }
    }),
    skip: apiUrl.isEmpty || !isolated || !fixtures,
  );
}
