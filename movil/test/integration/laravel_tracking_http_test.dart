import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_exception.dart';
import 'package:movil/features/auth/application/app_dependencies.dart';
import 'package:movil/features/auth/domain/auth_session.dart';
import 'package:movil/features/tracking/data/tracking_repository.dart';
import 'package:movil/features/tracking/domain/donor_tracking.dart';

import '../features/tracking/tracking_test_support.dart'
    show MemorySessionStore, MemoryContributionBackend, campaignId;

const apiUrl = String.fromEnvironment('UNIFUNDME_TEST_API_URL');
const isolated = bool.fromEnvironment('UNIFUNDME_ISOLATED_TEST');
const fixtures = bool.fromEnvironment('UNIFUNDME_TRACKING_FIXTURES');

class _RealHttp extends HttpOverrides {}

Future<AppDependencies> fixtureDonor(String name) async {
  expect(['127.0.0.1', 'localhost'], contains(Uri.parse(apiUrl).host));
  final client = http.Client();
  addTearDown(client.close);
  final deps = AppDependencies.create(
    AppConfig.fromValues(apiBaseUrl: apiUrl),
    client: client,
    store: MemorySessionStore(),
    contributionBackend: MemoryContributionBackend(),
  );
  final response = LoginResponse.fromJson(
    await deps.publicApi.post(
      'auth/login',
      body: {
        'email': 'tracking28-$name@example.test',
        'password': 'SyntheticOnly28',
      },
    ),
  );
  final attempt = deps.session.beginAuthentication();
  await deps.session.acceptLogin(attempt, response);
  addTearDown(deps.dispose);
  return deps;
}

void main() {
  final skip = apiUrl.isEmpty || !isolated || !fixtures;
  test(
    'Laravel #28: historial propio con reembolso y estados de recompensa',
    () => HttpOverrides.runWithHttpOverrides(() async {
      final deps = await fixtureDonor('donor');
      final rows = await TrackingRepository(deps).contributions();
      expect(rows, hasLength(4));
      expect(rows.where((r) => r.receipt.id == campaignId(205)), isEmpty);
      final refunded = rows.singleWhere((r) => r.receipt.id == campaignId(203));
      expect(refunded.receipt.status, 'refunded');
      expect(refunded.rewardState, 'cancelled');
      expect(contributionTotals(rows, 'refunded'), {'BOB': BigInt.from(8000)});
      expect(
        rows.singleWhere((r) => r.receipt.id == campaignId(201)).trackingNumber,
        'GUIA-28',
      );
      expect(
        rows.singleWhere((r) => r.receipt.id == campaignId(202)).hasReward,
        isFalse,
      );
    }, _RealHttp()),
    skip: skip,
  );
  test(
    'Laravel #28: novedades paginadas sin duplicados ni contenido privado',
    () => HttpOverrides.runWithHttpOverrides(() async {
      final deps = await fixtureDonor('donor');
      final repo = TrackingRepository(deps);
      final first = await repo.updates();
      final second = await repo.updates(page: 2);
      expect(first.total, 13);
      expect(first.pages, 2);
      expect(first.items, hasLength(10));
      expect(second.items, hasLength(3));
      expect({
        ...first.items.map((u) => u.id),
        ...second.items.map((u) => u.id),
      }, hasLength(13));
      expect(first.campaigns.map((c) => c.id).toSet(), {
        campaignId(1),
        campaignId(2),
      });
      expect(
        (await repo.updates(campaignId: campaignId(2))).items.single.title,
        'Campaña reembolsada',
      );
    }, _RealHttp()),
    skip: skip,
  );
  test(
    'Laravel #28: avances públicos e historial aislado por donante',
    () => HttpOverrides.runWithHttpOverrides(() async {
      final deps = await fixtureDonor('donor');
      final repo = TrackingRepository(deps);
      final progress = await repo.campaign(campaignId(1));
      expect(progress.campaign.raised, 300);
      expect(progress.contributions, hasLength(2));
      expect(progress.milestones.single.progress, 60);
      await expectLater(
        repo.campaign(campaignId(3)),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 404)),
      );
      final other = await fixtureDonor('other');
      final otherRepo = TrackingRepository(other);
      expect(
        (await otherRepo.contributions()).single.receipt.id,
        campaignId(205),
      );
      expect((await otherRepo.updates()).campaigns.single.id, campaignId(1));
      expect(
        (await otherRepo.updates(campaignId: campaignId(2))).items,
        isEmpty,
      );
    }, _RealHttp()),
    skip: skip,
  );
}
