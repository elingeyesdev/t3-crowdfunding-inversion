import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_client.dart';
import 'package:movil/core/network/api_exception.dart';
import 'package:movil/features/catalog/data/catalog_repository.dart';
import 'package:movil/features/catalog/domain/public_campaign.dart';
import 'package:movil/features/catalog/presentation/campaign_widgets.dart';

import '../auth/auth_test_support.dart' show testResponse;
import 'catalog_test_support.dart';

void main() {
  test(
    'lecturas públicas codifican filtros y no consultan ni envían el token',
    () async {
      var tokenReads = 0;
      final paths = <String>[];
      final client = MockClient((request) async {
        expect(request.headers['authorization'], null);
        paths.add(request.url.path);
        if (request.url.path.endsWith('categories')) {
          return testResponse([categoryFixture()]);
        }
        if (request.url.path.endsWith('public')) {
          expect(request.url.queryParameters['q'], 'salud & educación');
          expect(request.url.queryParameters['categoryId'], categoryId);
          expect(request.url.queryParameters['page'], '2');
          expect(request.url.queryParameters['limit'], '20');
          return testResponse(
            pageFixture([campaignFixture()], page: 2, pages: 2),
          );
        }
        return testResponse(campaignFixture());
      });
      addTearDown(client.close);
      final repo = CatalogRepository(
        ApiClient(
          client: client,
          config: AppConfig.fromValues(
            apiBaseUrl: 'https://api.example.test/api/v1',
          ),
          tokenProvider: () {
            tokenReads++;
            return '1|synthetic-only';
          },
        ),
      );
      expect((await repo.categories()).single.name, 'Tecnología');
      await repo.list(
        const CatalogQuery(
          search: ' salud & educación ',
          categoryId: categoryId,
        ),
        page: 2,
      );
      expect(
        (await repo.detail(campaignId(1).toUpperCase())).id,
        campaignId(1),
      );
      expect(tokenReads, 0);
      expect(paths, [
        '/api/v1/categories',
        '/api/v1/campaigns/public',
        '/api/v1/campaigns/public/${campaignId(1)}',
      ]);
    },
  );

  test(
    'contrato admite decimales, opcionales y no conserva atributos privados',
    () {
      final campaign = PublicCampaign.fromJson({
        ...campaignFixture(),
        'goalAmount': '1000.00',
        'currentAmount': '250.50',
        'endDate': null,
        'description': null,
        'entrepreneurDisplayName': 'Equipo',
        'bankAccountNumber': 'private-value',
      });
      expect(campaign.raised, 250.5);
      expect(campaign.creator, 'Equipo');
      expect(campaign.endDate, null);
      expect(campaign.description, null);
      expect(campaign.toString(), isNot(contains('private-value')));
    },
  );
  for (final invalid in [null, 'invalid', -1, double.nan, double.infinity]) {
    test('importe inválido $invalid produce error controlado', () {
      expect(
        () => PublicCampaign.fromJson({
          ...campaignFixture(),
          'currentAmount': invalid,
        }),
        throwsA(isA<ApiException>()),
      );
    });
  }
  test(
    'meta cero, UUID o fecha inválidos no se representan como campaña válida',
    () {
      for (final change in [
        {'goalAmount': 0},
        {'id': '../private'},
        {'endDate': 'not-a-date'},
      ]) {
        expect(
          () => PublicCampaign.fromJson({...campaignFixture(), ...change}),
          throwsA(isA<ApiException>()),
        );
      }
    },
  );
  test('metadatos corruptos se distinguen de lista vacía', () {
    expect(CampaignPage.fromJson(pageFixture([])).items, isEmpty);
    expect(
      () => CampaignPage.fromJson({
        ...pageFixture([]),
        'meta': {
          'currentPage': 1,
          'totalPages': 1,
          'totalItems': 1,
          'itemCount': 2,
        },
      }),
      throwsA(isA<ApiException>()),
    );
  });
  test('parámetros e ID inválidos no realizan peticiones', () async {
    var requests = 0;
    final client = MockClient((_) async {
      requests++;
      return testResponse(null);
    });
    addTearDown(client.close);
    final repo = CatalogRepository(
      ApiClient(
        client: client,
        config: AppConfig.fromValues(
          apiBaseUrl: 'https://api.example.test/api/v1',
        ),
      ),
    );
    await expectLater(repo.detail('../private'), throwsA(isA<ApiException>()));
    await expectLater(
      repo.list(const CatalogQuery(categoryId: 'invalid')),
      throwsA(isA<ApiException>()),
    );
    await expectLater(
      repo.list(const CatalogQuery(), page: 0),
      throwsA(isA<ApiException>()),
    );
    expect(requests, 0);
  });
  test(
    'se rechaza otra identidad o una página distinta de la solicitada',
    () async {
      final client = MockClient(
        (r) async => testResponse(
          r.url.path.endsWith('public')
              ? pageFixture([], page: 2, pages: 2)
              : campaignFixture(number: 2),
        ),
      );
      addTearDown(client.close);
      final repo = CatalogRepository(
        ApiClient(
          client: client,
          config: AppConfig.fromValues(
            apiBaseUrl: 'https://api.example.test/api/v1',
          ),
        ),
      );
      await expectLater(
        repo.detail(campaignId(1)),
        throwsA(isA<ApiException>()),
      );
      await expectLater(
        repo.list(const CatalogQuery()),
        throwsA(isA<ApiException>()),
      );
    },
  );
  test(
    'portadas resuelven contra origen y rechazan esquemas o rutas privadas',
    () {
      final dev = AppConfig.fromValues(
        apiBaseUrl: 'http://127.0.0.1:8765/api/v1',
      );
      expect(
        campaignCover('/storage/cover.png', dev).toString(),
        'http://127.0.0.1:8765/storage/cover.png',
      );
      expect(
        campaignCover('storage/cover.png', dev).toString(),
        'http://127.0.0.1:8765/storage/cover.png',
      );
      for (final bad in [
        'javascript:alert(1)',
        'data:image/png;base64,a',
        '//other.test/image',
        'http://other.test/image',
        '/api/v1/private-files/kyc/file.jpg',
        'https://user:secret@other.test/a',
      ]) {
        expect(campaignCover(bad, dev), null);
      }
      final prod = AppConfig.fromValues(
        appEnv: 'production',
        apiBaseUrl: 'https://api.example.test/api/v1',
      );
      expect(campaignCover('http://api.example.test/a', prod), null);
      expect(campaignCover('https://cdn.example.test/a', prod), isNotNull);
    },
  );
  test('importes localizados y porcentaje real por encima de la meta', () {
    expect(campaignMoney(1234.5, 'BOB'), 'Bs 1.234,50');
    expect(campaignMoney(0, 'USD'), 'USD 0,00');
    final model = PublicCampaign.fromJson({
      ...campaignFixture(),
      'currentAmount': 1250,
    });
    expect(model.progress, 1.25);
  });
}
