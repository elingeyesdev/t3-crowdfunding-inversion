import 'package:flutter_test/flutter_test.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_exception.dart';
import 'package:movil/features/tracking/data/tracking_repository.dart';
import 'package:movil/features/tracking/domain/donor_tracking.dart';
import 'package:movil/features/tracking/presentation/tracking_widgets.dart';

import 'tracking_test_support.dart';

void main() {
  test('totales exactos separados por moneda y estado', () {
    final rows = [
      trackedFixture(),
      trackedFixture(n: 21, status: 'refunded'),
      trackedFixture(n: 22, currency: 'USD'),
    ].map(TrackedContribution.fromJson).toList();
    expect(contributionTotals(rows, 'completed'), {
      'BOB': BigInt.from(10000),
      'USD': BigInt.from(10000),
    });
    expect(contributionTotals(rows, 'refunded'), {'BOB': BigInt.from(10000)});
  });
  test(
    'totales extensos no desbordan y las fechas civiles no cambian de día',
    () {
      final row = TrackedContribution.fromJson({
        ...trackedFixture(),
        'amount': '9999999999999.99',
      });
      final total = contributionTotals(
        List.filled(20000, row),
        'completed',
      )['BOB']!;
      expect(total, BigInt.parse('19999999999999980000'));
      expect(
        trackingTotalLabel(total, 'BOB'),
        '199.999.999.999.999.800,00 BOB',
      );
      expect(
        trackingDate(DateTime.utc(2026, 12, 15), dateOnly: true),
        '15/12/2026',
      );
    },
  );
  test(
    'recompensa se identifica por IDs y el estado desconocido no es pendiente',
    () {
      expect(
        TrackedContribution.fromJson(trackedFixture(n: 21)).hasReward,
        isFalse,
      );
      final row = TrackedContribution.fromJson(
        trackedFixture(rewardState: 'future_status'),
      );
      expect(row.hasReward, isTrue);
      expect(row.rewardState, 'unknown');
      expect(row.rewardLabel, 'Sin seguimiento disponible');
    },
  );
  for (final status in rewardStates.keys) {
    test('conserva estado de recompensa $status', () {
      expect(
        TrackedContribution.fromJson(trackedFixture(rewardState: status))
            .rewardState,
        status,
      );
    });
  }
  for (final url in [
    'javascript:alert(1)',
    'intent://tracking',
    'file:///secret',
    '//external.test/path',
    'https://user:pass@host.test',
    'https://host.test/\nsecret',
  ]) {
    test(
      'rechaza enlace externo inseguro ${Uri.encodeComponent(url)}',
      () => expect(trackingLink(url), isNull),
    );
  }
  test('evidencias no exponen archivos privados ni traversal codificado', () {
    final config = AppConfig.fromValues(
      apiBaseUrl: 'https://api.example.com/api/v1',
    );
    for (final path in [
      '/api/v1/private-files/test',
      '/%70rivate-files/test',
      '/storage/../kyc/test',
      'https://host.test/%ZZ',
    ]) {
      expect(trackingLink(path, config: config, attachment: true), isNull);
    }
    expect(
      trackingLink(
        '/storage/public-image.png',
        config: config,
        attachment: true,
      )?.toString(),
      'https://api.example.com/storage/public-image.png',
    );
    expect(trackingLink('https://tracking.example.test/20'), isNotNull);
  });
  test('rechaza hitos fuera del rango y páginas inconsistentes', () {
    expect(
      () => TrackedMilestone.fromJson({
        ...milestoneFixture(),
        'progressPercentage': 101,
      }),
      throwsA(isA<ApiException>()),
    );
    final page = updatesFixture();
    page['data'] = [updateFixture(1), updateFixture(1)];
    expect(
      () => BackedUpdatesPage.fromJson(page),
      throwsA(isA<ApiException>()),
    );
  });
  test(
    'historial y novedades usan token; avances públicos nunca lo envían',
    () async {
      final api = TrackingApi();
      final deps = trackingDependencies(api);
      addTearDown(deps.dispose);
      await authenticateTest(deps);
      final repo = TrackingRepository(deps);
      expect(await repo.contributions(), hasLength(3));
      final page = await repo.updates(page: 2, campaignId: campaignId(2));
      expect(page.page, 2);
      expect(page.items.single.campaignId, campaignId(2));
      final c = await repo.campaign(campaignId(1));
      expect(c.milestones.single.progress, 60);
      expect(api.requests.every((r) => r.method == 'GET'), isTrue);
    },
  );
  test(
    'no consulta avances de campaña ajena ni acepta un hito cruzado',
    () async {
      final api = TrackingApi();
      final deps = trackingDependencies(api);
      addTearDown(deps.dispose);
      await authenticateTest(deps);
      final repo = TrackingRepository(deps);
      await expectLater(
        repo.campaign(campaignId(2)),
        throwsA(isA<ApiException>()),
      );
      expect(
        api.requests.where((r) => r.url.path.contains('/campaigns/')),
        isEmpty,
      );
      api.milestones = [
        {...milestoneFixture(), 'campaignId': campaignId(2)},
      ];
      await expectLater(
        repo.campaign(campaignId(1)),
        throwsA(isA<ApiException>()),
      );
    },
  );
}
