import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/features/auth/application/app_dependencies.dart';

import '../contributions/contribution_test_support.dart';
export '../contributions/contribution_test_support.dart';

Map<String, Object?> trackedFixture({
  int n = 20,
  String status = 'completed',
  String? rewardState = 'shipped',
  String currency = 'BOB',
}) => {
  ...receiptFixture(n: n, rewardId: n == 20 ? campaignId(10) : null),
  'investmentStatus': status,
  'currency': currency,
  'campaignStatus': status == 'refunded' ? 'failed' : 'published',
  'rewardClaimId': n == 20 ? campaignId(30) : null,
  'rewardTitle': n == 20 ? 'Kit de agradecimiento' : 'Aporte Directo',
  'rewardClaimStatus': rewardState,
  'rewardDescription': 'Producto del proyecto',
  'rewardEstimatedDelivery': '2026-12-15',
  'trackingNumber': 'GUIA-20',
  'trackingUrl': 'https://tracking.example.test/20',
  'shippedAt': '2026-11-25T12:00:00Z',
  'deliveredAt': null,
};
Map<String, Object?> updateFixture(int n, {int campaign = 1}) => {
  'id': campaignId(100 + n),
  'campaignId': campaignId(campaign),
  'title': 'Avance $n',
  'content': 'Contenido público del avance $n',
  'campaignTitle': 'Campaña $campaign',
  'entrepreneurName': 'Emprendedor',
  'createdAt': '2026-11-25T12:00:00Z',
  'campaignCurrentAmount': '250.00',
  'campaignGoalAmount': '1000.00',
  'attachments': [
    {'type': 'text', 'text': 'Evidencia de avance'},
  ],
};
Map<String, Object?> updatesFixture({
  int page = 1,
  String? campaignIdFilter,
  bool empty = false,
}) => {
  'data': empty
      ? []
      : [
          updateFixture(
            page,
            campaign: campaignIdFilter == campaignId(2) ? 2 : 1,
          ),
        ],
  'campaigns': [
    for (var i = 1; i <= 2; i++) {'id': campaignId(i), 'title': 'Campaña $i'},
  ],
  'meta': {
    'currentPage': page,
    'totalPages': empty ? 1 : 2,
    'totalItems': empty ? 0 : 2,
    'itemCount': empty ? 0 : 1,
    'itemsPerPage': 10,
  },
};
Map<String, Object?> milestoneFixture() => {
  'id': campaignId(200),
  'campaignId': campaignId(1),
  'title': 'Prototipo',
  'description': 'Construcción del prototipo',
  'status': 'in_progress',
  'progressPercentage': 60,
  'sortOrder': 1,
  'targetDate': '2026-12-01',
  'completedDate': null,
  'evidenceUrls': [],
};

class TrackingApi {
  List<Map<String, Object?>> rows = [
    trackedFixture(),
    trackedFixture(n: 21, status: 'refunded'),
    trackedFixture(n: 22, currency: 'USD'),
  ];
  List<Map<String, Object?>> milestones = [milestoneFixture()];
  final requests = <http.Request>[];
  int historyStatus = 200, feedStatus = 200, campaignStatus = 200;
  bool emptyFeed = false;
  Future<http.Response> Function(http.Request)? feedOverride;
  Completer<void>? historyGate;
  Future<http.Response> call(http.Request r) async {
    requests.add(r);
    final path = r.url.path;
    if (path.contains('/campaigns/') || path.endsWith('/categories')) {
      expectSync(r.headers['authorization'], isNull);
    } else {
      expectSync(r.headers['authorization'], isNotNull);
    }
    if (path.endsWith('/investments/me')) {
      final snapshot = List<Map<String, Object?>>.of(rows);
      if (historyGate != null) await historyGate!.future;
      return testResponse(snapshot, status: historyStatus);
    }
    if (path.endsWith('/backed-campaigns/updates')) {
      if (feedOverride != null) return feedOverride!(r);
      return testResponse(
        updatesFixture(
          page: int.parse(r.url.queryParameters['page']!),
          campaignIdFilter: r.url.queryParameters['campaignId'],
          empty: emptyFeed,
        ),
        status: feedStatus,
      );
    }
    if (path.contains('/campaigns/public/')) {
      return testResponse(contributionCampaign(), status: campaignStatus);
    }
    if (path.endsWith('/milestones')) return testResponse(milestones);
    return testResponse(testUser());
  }
}

AppDependencies trackingDependencies(TrackingApi api) {
  final client = MockClient(api.call);
  addTearDown(client.close);
  return AppDependencies.create(
    AppConfig.fromValues(apiBaseUrl: 'https://api.example.com/api/v1'),
    client: client,
    store: MemorySessionStore(),
    contributionBackend: MemoryContributionBackend(),
  );
}
