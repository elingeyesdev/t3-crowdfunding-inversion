import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_exception.dart';
import 'package:movil/features/auth/application/app_dependencies.dart';
import 'package:movil/features/auth/domain/auth_session.dart';
import 'package:movil/features/contributions/application/contribution_controller.dart';
import 'package:movil/features/contributions/data/contribution_ledger.dart';
import 'package:movil/features/contributions/data/contribution_repository.dart';

import '../features/contributions/contribution_test_support.dart'
    show MemoryContributionBackend, MemorySessionStore, campaignId;

const url = String.fromEnvironment('UNIFUNDME_TEST_API_URL');
const isolated = bool.fromEnvironment('UNIFUNDME_ISOLATED_TEST');
const fixtures = bool.fromEnvironment('UNIFUNDME_CONTRIBUTION_FIXTURES');

class _RealHttp extends HttpOverrides {}

int sequence = 0;
Future<AppDependencies> donor() async {
  expect(['localhost', '127.0.0.1'], contains(Uri.parse(url).host));
  final client = http.Client();
  addTearDown(client.close);
  final deps = AppDependencies.create(
    AppConfig.fromValues(apiBaseUrl: url),
    client: client,
    store: MemorySessionStore(),
    contributionBackend: MemoryContributionBackend(),
  );
  final email =
      'mobile27-${DateTime.now().microsecondsSinceEpoch}-${++sequence}@example.test';
  await deps.publicApi.post(
    'users/register',
    body: {
      'email': email,
      'password': 'SyntheticOnly27',
      'signupRole': 'investor',
    },
  );
  final response = LoginResponse.fromJson(
    await deps.publicApi.post(
      'auth/login',
      body: {'email': email, 'password': 'SyntheticOnly27'},
    ),
  );
  final attempt = deps.session.beginAuthentication();
  await deps.session.acceptLogin(attempt, response);
  addTearDown(deps.dispose);
  return deps;
}

Future<void> profile(AppDependencies deps) => deps.authenticated((api) async {
  await api.post(
    'investors/me/profile',
    body: {'firstName': 'Donante', 'lastName': 'Movil', 'country': 'Bolivia'},
  );
});
void main() {
  final skip = url.isEmpty || !isolated || !fixtures;
  test(
    'Laravel HTTP #27: perfil, saldo, recompensa, aporte y PDF propios',
    () => HttpOverrides.runWithHttpOverrides(() async {
      final deps = await donor();
      final c = ContributionController(deps, campaignId(1));
      addTearDown(c.dispose);
      await c.load();
      expect(c.status, ContributionStatus.missingProfile);
      await profile(deps);
      await c.load();
      expect(c.status, ContributionStatus.ready);
      expect(c.capital!.available, 0);
      expect(c.validate(10025, campaignId(10)), contains('insuficiente'));
      await c.topUp(50025);
      expect(c.capital!.available, 50025);
      await c.submit(10025, campaignId(10));
      expect(c.status, ContributionStatus.success, reason: c.message);
      expect(c.receipt!.rewardId, campaignId(10));
      final repo = ContributionRepository(deps);
      final history = await repo.receipts();
      expect(history.single.id, c.receipt!.id);
      expect(history.single.amount, 10025);
      expect((await repo.capital()).available, 40000);
      final pdf = await repo.pdf(c.receipt!.id);
      expect(String.fromCharCodes(pdf.take(5)), '%PDF-');
      expect(pdf.length, greaterThan(1000));
    }, _RealHttp()),
    skip: skip,
  );
  test(
    'Laravel HTTP #27: servidor rechaza mínimo, recompensa ajena y campaña financiada',
    () => HttpOverrides.runWithHttpOverrides(() async {
      final deps = await donor();
      await profile(deps);
      final repo = ContributionRepository(deps);
      await repo.addCapital(50000);
      for (final pending in [
        PendingContribution(
          campaignId: campaignId(1),
          amount: 1,
          currency: 'BOB',
          before: {},
        ),
        PendingContribution(
          campaignId: campaignId(1),
          amount: 10000,
          currency: 'BOB',
          rewardId: campaignId(11),
          before: {},
        ),
        PendingContribution(
          campaignId: campaignId(3),
          amount: 10000,
          currency: 'BOB',
          before: {},
        ),
      ]) {
        await expectLater(
          repo.contribute(pending),
          throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'status', 422),
          ),
        );
      }
      expect(await repo.receipts(), isEmpty);
      expect((await repo.capital()).available, 50000);
    }, _RealHttp()),
    skip: skip,
  );
  test(
    'Laravel HTTP #27: otra cuenta no obtiene el comprobante privado',
    () => HttpOverrides.runWithHttpOverrides(() async {
      final own = await donor();
      await profile(own);
      final repo = ContributionRepository(own);
      await repo.addCapital(50000);
      final receipt = await repo.contribute(
        PendingContribution(
          campaignId: campaignId(1),
          amount: 10000,
          currency: 'BOB',
          before: {},
        ),
      );
      final other = await donor();
      await expectLater(
        ContributionRepository(other).pdf(receipt.id),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 404)),
      );
      expect(await ContributionRepository(other).receipts(), isEmpty);
    }, _RealHttp()),
    skip: skip,
  );
}
