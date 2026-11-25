import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_client.dart';
import 'package:movil/core/network/api_exception.dart';
import 'package:movil/features/contributions/data/contribution_ledger.dart';
import 'package:movil/features/contributions/data/contribution_repository.dart';
import 'package:movil/features/contributions/domain/contribution.dart';
import 'package:movil/app/router/app_routes.dart';

import 'contribution_test_support.dart';

void main() {
  test('dinero acepta coma o punto y conserva centavos exactos', () {
    expect(Money.input('10,25'), 1025);
    expect(Money.input(' 0.01 '), 1);
    expect(Money.input('9999999999999.99'), Money.max);
    expect(Money.decimal(Money.max), '9999999999999.99');
    expect(Money.label(123456, 'BOB'), '1.234,56 BOB');
    for (final raw in [
      '1.234,56',
      '-1',
      'NaN',
      '1e2',
      '1.001',
      '10000000000000',
      '',
    ]) {
      expect(Money.input(raw), null, reason: raw);
    }
  });
  test('recompensa usa cuatro decimales y productos exactos sin overflow', () {
    final c = ContributionCampaign.fromJson(contributionCampaign());
    final r = ContributionReward.fromJson(rewardFixture());
    final now = DateTime(2026);
    expect(r.eligible(10000, c, now), true);
    expect(r.eligible(20000, c, now), true);
    expect(r.eligible(9999, c, now), false);
    expect(r.eligible(20001, c, now), false);
    final boundary = ContributionReward.fromJson({
      ...rewardFixture(),
      'amount': 0,
      'minPercentage': '0.0001',
      'maxPercentage': '0.0001',
    });
    expect(boundary.eligible(1, c, now), false);
    final large = ContributionCampaign.fromJson({
      ...contributionCampaign(),
      'goalAmount': '9999999999999.99',
    });
    final all = ContributionReward.fromJson({
      ...rewardFixture(),
      'minPercentage': 0,
      'maxPercentage': 100,
    });
    expect(all.eligible(Money.max, large, now), true);
  });
  test('recompensas agotadas, vencidas, inactivas o de otra moneda no son elegibles', () {
    final c = ContributionCampaign.fromJson(contributionCampaign());
    for (final change in [
      {'maxClaims': 1, 'currentClaims': 1},
      {'isActive': false},
      {'expiresAt': '2020-01-01T00:00:00Z'},
      {'currency': 'USD'},
    ]) {
      expect(
        ContributionReward.fromJson({...rewardFixture(), ...change})
            .eligible(10000, c, DateTime(2026)),
        false,
      );
    }
  });
  test('contratos incompletos o corruptos producen errores controlados', () {
    for (final payload in [
      {...rewardFixture(), 'id': '../secret'},
      {...rewardFixture(), 'minPercentage': 101},
      {...rewardFixture(), 'currentClaims': -1},
      {...rewardFixture(), 'expiresAt': 'invalid'},
    ]) {
      expect(
        () => ContributionReward.fromJson(payload),
        throwsA(isA<ApiException>()),
      );
    }
    expect(
      () => ContributionCampaign.fromJson({
        ...contributionCampaign(),
        'minInvestment': null,
      }),
      throwsA(isA<ApiException>()),
    );
  });
  test('repositorio usa importe decimal y token fijo; 201 sin default SQL es válido', () async {
    final api = ContributionApi();
    final deps = contributionDependencies(api);
    await authenticateTest(deps);
    final repo = ContributionRepository(deps);
    await repo.campaign(campaignId(1));
    await repo.rewards(campaignId(1));
    final receipt = await repo.contribute(
      PendingContribution(
        campaignId: campaignId(1),
        amount: 10000,
        currency: 'BOB',
        rewardId: campaignId(10),
        before: {},
      ),
    );
    expect(receipt.status, 'completed');
    expect(receipt.rewardId, campaignId(10));
    expect(api.posts, 1);
    expect(
      api.requests.last.headers['authorization'],
      'Bearer 1|synthetic-only',
    );
    expect(api.requests.last.body, contains('"amount":"100.00"'));
    expect(await repo.pdf(receipt.id), isA<Uint8List>());
  });
  test(
    'descarga acotada rechaza longitud anunciada o stream demasiado grandes',
    () async {
      for (final announced in [true, false]) {
        final client = MockClient.streaming(
          (request, body) async => http.StreamedResponse(
            Stream.value(List.filled(12, 1)),
            200,
            contentLength: announced ? 12 : null,
          ),
        );
        final api = ApiClient(
          client: client,
          config: AppConfig.fromValues(
            apiBaseUrl: 'https://api.example.com/api/v1',
          ),
        );
        await expectLater(
          api.getBytes('file', maxBytes: 10),
          throwsA(
            isA<ApiException>().having(
              (e) => e.kind,
              'kind',
              ApiErrorKind.invalidResponse,
            ),
          ),
        );
        client.close();
      }
    },
  );
  test(
    'rutas privadas conservan retorno exacto y rechazan consultas o traversal',
    () {
      final path = '/explorar/campanas/${campaignId(1)}/aportar';
      final receipt = '/comprobantes/${campaignId(20)}';
      for (final route in [path, receipt, '/comprobantes']) {
        expect(AppRoutes.isPrivate(route), true);
        expect(AppRoutes.safeReturn(route), route);
        expect(AppRoutes.safeReturn('$route?token=secret'), AppRoutes.account);
      }
      expect(
        AppRoutes.safeReturn('/comprobantes/../cuenta'),
        AppRoutes.account,
      );
    },
  );
}
