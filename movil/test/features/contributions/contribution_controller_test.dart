import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:movil/features/contributions/application/contribution_controller.dart';
import 'package:movil/features/contributions/data/contribution_ledger.dart';

import 'contribution_test_support.dart';

void main() {
  Future<ContributionController> controller(
    ContributionApi api, {
    MemoryContributionBackend? backend,
  }) async {
    final deps = contributionDependencies(api, backend: backend);
    await authenticateTest(deps);
    final c = ContributionController(deps, campaignId(1));
    addTearDown(c.dispose);
    await c.load();
    return c;
  }

  test('valida monto, saldo, meta y condiciones de recompensa', () async {
    final c = await controller(ContributionApi());
    expect(c.status, ContributionStatus.ready);
    expect(c.validate(10000, campaignId(10)), null);
    expect(c.validate(null, null), isNotNull);
    expect(c.validate(999, null), contains('mínimo'));
    expect(c.validate(50001, null), contains('máximo'));
    expect(c.validate(10001, campaignId(99)), isNotNull);
    expect(c.validate(10000, null), null);
  });
  test(
    'doble confirmación en vuelo produce un solo POST y limpia marcador',
    () async {
      final api = ContributionApi()..gate = Completer<void>();
      final backend = MemoryContributionBackend();
      final c = await controller(api, backend: backend);
      final first = c.submit(10000, null);
      while (api.posts == 0) {
        await Future<void>.delayed(Duration.zero);
      }
      await c.submit(10000, null);
      expect(api.posts, 1);
      expect(backend.values, isNotEmpty);
      api.gate!.complete();
      await first;
      expect(c.status, ContributionStatus.success);
      expect(c.receipt!.amount, 10000);
      expect(backend.values, isEmpty);
    },
  );
  test('sin almacenamiento seguro no se envía ningún aporte', () async {
    final backend = MemoryContributionBackend()..failWrite = true;
    final api = ContributionApi();
    final c = await controller(api, backend: backend);
    await c.submit(10000, null);
    expect(api.posts, 0);
    expect(c.status, ContributionStatus.ready);
  });
  test('respuesta perdida persiste entre controladores y se recupera sin otro POST', () async {
    final backend = MemoryContributionBackend();
    final api = ContributionApi()..loseResponse = true;
    final c = await controller(api, backend: backend);
    await c.submit(10000, campaignId(10));
    expect(c.status, ContributionStatus.pending);
    await c.submit(10000, null);
    expect(api.posts, 1);
    final next = ContributionController(c.dependencies, campaignId(2));
    addTearDown(next.dispose);
    await next.load();
    expect(next.status, ContributionStatus.pending);
    await next.reconcile();
    expect(next.status, ContributionStatus.success);
    expect(next.receipt!.id, campaignId(20));
    expect(api.posts, 1);
    expect(backend.values, isEmpty);
  });
  test(
    'sin coincidencia o con varias no se inventa éxito ni se repite POST',
    () async {
      for (final count in [0, 2]) {
        final api = ContributionApi()..loseResponse = true;
        final c = await controller(api);
        await c.submit(10000, null);
        api.history = List.generate(count, (n) => receiptFixture(n: 50 + n));
        await c.reconcile();
        expect(c.status, ContributionStatus.pending);
        expect(api.posts, 1);
      }
    },
  );
  test(
    '422 conserva entrada y permite revisar datos sin reenvío automático',
    () async {
      final api = ContributionApi()..postStatus = 422;
      final backend = MemoryContributionBackend();
      final c = await controller(api, backend: backend);
      await c.submit(10000, null);
      expect(c.status, ContributionStatus.ready);
      expect(c.message, contains('rechazó'));
      expect(api.posts, 1);
      expect(backend.values, isEmpty);
    },
  );
  test('perfil ausente se distingue de campaña inexistente', () async {
    final profile = await controller(ContributionApi()..capitalStatus = 404);
    expect(profile.status, ContributionStatus.missingProfile);
    final campaign = await controller(ContributionApi()..campaignStatus = 404);
    expect(campaign.status, ContributionStatus.error);
  });
  test(
    'carga de saldo usa API existente y valida monto sin hacer aportes',
    () async {
      final api = ContributionApi();
      final c = await controller(api);
      await c.topUp(100000000001);
      expect(api.capitalPosts, 0);
      await c.topUp(10000);
      expect(c.status, ContributionStatus.ready);
      expect(c.capital!.available, 60000);
      expect(api.capitalPosts, 1);
      expect(api.posts, 0);
    },
  );
  test('logout durante POST impide mostrar ticket; marcador queda para la cuenta original', () async {
    final api = ContributionApi()..gate = Completer<void>();
    final backend = MemoryContributionBackend();
    final c = await controller(api, backend: backend);
    final pending = c.submit(10000, null);
    while (api.posts == 0) {
      await Future<void>.delayed(Duration.zero);
    }
    await c.dependencies.logout();
    api.gate!.complete();
    await pending;
    expect(c.allowed, false);
    expect(c.receipt, null);
    expect(backend.values, isNotEmpty);
  });
  test('marcadores se aíslan por usuario y origen API', () async {
    final backend = MemoryContributionBackend();
    final a = ContributionLedger(backend, 'api-a');
    final b = ContributionLedger(backend, 'api-b');
    await a.begin(
      'one',
      PendingContribution(
        campaignId: campaignId(1),
        amount: 100,
        currency: 'BOB',
        before: {},
      ),
    );
    expect(await a.read('one'), isNotNull);
    expect(await a.read('two'), null);
    expect(await b.read('one'), null);
    await expectLater(
      a.begin(
        'one',
        PendingContribution(
          campaignId: campaignId(1),
          amount: 100,
          currency: 'BOB',
          before: {},
        ),
      ),
      throwsStateError,
    );
  });
  test(
    '401 invalida sesión y retira el intento rechazado por el servidor',
    () async {
      final api = ContributionApi()..postStatus = 401;
      final backend = MemoryContributionBackend();
      final c = await controller(api, backend: backend);
      await c.submit(10000, null);
      expect(c.allowed, false);
      expect(c.receipt, null);
      expect(backend.values, isEmpty);
    },
  );
  test(
    'un resultado anterior no borra un marcador posterior de la misma cuenta',
    () async {
      final backend = MemoryContributionBackend();
      final ledger = ContributionLedger(backend, 'api');
      PendingContribution marker() => PendingContribution(
        campaignId: campaignId(1),
        amount: 10000,
        currency: 'BOB',
        before: {},
      );
      final first = marker(), second = marker();
      await ledger.begin('one', first);
      await ledger.clear('one', expected: first);
      await ledger.begin('one', second);
      await ledger.clear('one', expected: first);
      expect((await ledger.read('one'))!.nonce, second.nonce);
    },
  );
}
