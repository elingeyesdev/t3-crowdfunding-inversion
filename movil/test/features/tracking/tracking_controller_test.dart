import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movil/features/tracking/application/tracking_controller.dart';
import 'package:movil/features/tracking/data/tracking_repository.dart';

import 'tracking_test_support.dart';

void main() {
  test(
    'fallo de novedades no oculta aportes; reintentar recupera novedades',
    () async {
      final api = TrackingApi()..feedStatus = 503;
      final deps = trackingDependencies(api);
      addTearDown(deps.dispose);
      await authenticateTest(deps);
      final c = TrackingController(TrackingRepository(deps));
      addTearDown(c.dispose);
      await c.refresh();
      expect(c.contributions, hasLength(3));
      expect(c.updatesError, isNotNull);
      api.feedStatus = 200;
      await c.loadUpdates();
      expect(c.updates!.items, hasLength(1));
      expect(c.updatesError, isNull);
    },
  );
  test('descarta página tardía de otro filtro', () async {
    final first = Completer<http.Response>();
    final api = TrackingApi();
    api.feedOverride = (r) => r.url.queryParameters['campaignId'] == null
        ? first.future
        : Future.value(
            testResponse(updatesFixture(campaignIdFilter: campaignId(2))),
          );
    final deps = trackingDependencies(api);
    addTearDown(deps.dispose);
    await authenticateTest(deps);
    final c = TrackingController(TrackingRepository(deps));
    addTearDown(c.dispose);
    final pending = c.loadUpdates();
    await c.selectCampaign(campaignId(2));
    first.complete(testResponse(updatesFixture()));
    await pending;
    expect(c.campaignFilter, campaignId(2));
    expect(c.updates!.items.single.campaignId, campaignId(2));
  });
  test('cambio de cuenta vacía datos y descarta historial en vuelo', () async {
    final api = TrackingApi();
    final deps = trackingDependencies(api);
    addTearDown(deps.dispose);
    await authenticateTest(deps);
    final c = TrackingController(TrackingRepository(deps));
    addTearDown(c.dispose);
    await c.refresh();
    expect(c.contributions, isNotEmpty);
    api.historyGate = Completer<void>();
    final pending = c.loadHistory();
    await authenticateTest(deps);
    expect(c.contributions, isEmpty);
    expect(c.updates, isNull);
    api.historyGate!.complete();
    await pending;
    expect(c.contributions, isEmpty);
  });
  test(
    'página vaciada por cambios del servidor vuelve al inicio una sola vez',
    () async {
      final api = TrackingApi();
      final deps = trackingDependencies(api);
      addTearDown(deps.dispose);
      await authenticateTest(deps);
      api.feedOverride = (r) async => testResponse(
        updatesFixture(
          page: int.parse(r.url.queryParameters['page']!),
          empty: r.url.queryParameters['page'] == '2',
        ),
      );
      final c = TrackingController(TrackingRepository(deps));
      addTearDown(c.dispose);
      await c.loadUpdates(page: 2);
      expect(c.updates!.page, 1);
      expect(
        api.requests.where((r) => r.url.path.endsWith('/updates')),
        hasLength(2),
      );
    },
  );
  test('401 revoca la sesión y elimina el seguimiento visible', () async {
    final api = TrackingApi();
    final deps = trackingDependencies(api);
    addTearDown(deps.dispose);
    await authenticateTest(deps);
    final c = TrackingController(TrackingRepository(deps));
    addTearDown(c.dispose);
    await c.refresh();
    api.historyStatus = 401;
    await c.loadHistory();
    expect(deps.session.accessToken, isNull);
    expect(c.contributions, isEmpty);
    expect(c.updates, isNull);
  });
}
