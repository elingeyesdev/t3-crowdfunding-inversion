import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/storage/secure_session_store.dart';
import 'package:movil/features/auth/application/app_dependencies.dart';

import '../../features/auth/auth_test_support.dart';
import '../catalog/catalog_test_support.dart';

export '../catalog/catalog_test_support.dart' show campaignId, campaignFixture;
export '../auth/auth_test_support.dart';

class MemoryContributionBackend implements EncryptedSessionBackend {
  final values = <String, String>{};
  bool failWrite = false, failDelete = false;
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<void> write(String key, String value) async {
    if (failWrite) throw StateError('storage');
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    if (failDelete) throw StateError('storage');
    values.remove(key);
  }
}

Map<String, Object?> contributionCampaign() => {
  ...campaignFixture(),
  'minInvestment': '10.00',
  'maxInvestment': '500.00',
  'creatorId': campaignId(999),
  'endDate': null,
};
Map<String, Object?> rewardFixture({int n = 10}) => {
  'id': campaignId(n),
  'campaignId': campaignId(1),
  'title': 'Recompensa $n',
  'description': 'Entrega de agradecimiento',
  'currency': 'BOB',
  'amount': 100,
  'minPercentage': '10.0000',
  'maxPercentage': '20.0000',
  'currentClaims': 0,
  'maxClaims': 2,
  'isActive': true,
  'estimatedDelivery': null,
  'expiresAt': null,
  'includesShipping': false,
};
Map<String, Object?> receiptFixture({
  int n = 20,
  String? rewardId,
  String amount = '100.00',
}) => {
  'id': campaignId(n),
  'campaignId': campaignId(1),
  'amount': amount,
  'currency': 'BOB',
  'investmentStatus': 'completed',
  'status': 'completed',
  'createdAt': '2026-11-25T12:00:00Z',
  'rewardTierId': rewardId,
  'campaignTitle': 'Campaña 1',
};

class ContributionApi {
  List<String> roles = ['investor', 'entrepreneur', 'future_role'];
  int posts = 0, capitalPosts = 0, available = 50000, limit = 50000;
  int capitalStatus = 200, campaignStatus = 200, postStatus = 201;
  bool loseResponse = false;
  Completer<void>? gate;
  Map<String, Object?> campaign = contributionCampaign();
  List<Object?> rewards = [rewardFixture()];
  List<Map<String, Object?>> history = [];
  final requests = <http.Request>[];
  Future<http.Response> call(http.Request r) async {
    requests.add(r);
    final path = r.url.path;
    if (path.contains('/campaigns/public/') || path.endsWith('/rewards')) {
      expect(r.headers['authorization'], null);
    } else {
      expect(r.headers['authorization'], isNotNull);
    }
    if (path.endsWith('/capital/add')) {
      capitalPosts++;
      final body = jsonDecode(r.body) as Map<String, dynamic>;
      final cents = (double.parse(body['amount'] as String) * 100).round();
      available += cents;
      limit += cents;
      return testResponse({
        'availableCapital': available / 100,
        'newMax': limit / 100,
      });
    }
    if (path.endsWith('/capital')) {
      return testResponse({
        'availableCapital': available / 100,
        'maxInvestmentLimit': limit / 100,
      }, status: capitalStatus);
    }
    if (path.endsWith('/rewards')) return testResponse(rewards);
    if (path.contains('/campaigns/public/')) {
      return testResponse(campaign, status: campaignStatus);
    }
    if (path.endsWith('/investments/me')) return testResponse(history);
    if (path.endsWith('/investments') && r.method == 'POST') {
      posts++;
      if (gate != null) await gate!.future;
      if (postStatus != 201) return testResponse(null, status: postStatus);
      final data = jsonDecode(r.body) as Map<String, dynamic>;
      final row = receiptFixture(
        n: 20 + history.length,
        rewardId: data['rewardTierId'] as String?,
        amount: data['amount'] as String,
      );
      history.add(row);
      if (loseResponse) throw http.ClientException('connection lost');
      // Como Laravel: el default SQL status no está hidratado en el ticket.
      final ticket = {...row}
        ..remove('status')
        ..remove('investmentStatus');
      return testResponse({
        'ticket': ticket,
        'remainingBalance': 400,
      }, status: 201);
    }
    if (path.endsWith('/receipt')) {
      return http.Response('%PDF-1.4\nfixture', 200);
    }
    return testResponse(testUser(roles: roles));
  }
}

AppDependencies contributionDependencies(
  ContributionApi api, {
  MemoryContributionBackend? backend,
}) {
  final client = MockClient(api.call);
  addTearDown(client.close);
  return AppDependencies.create(
    AppConfig.fromValues(apiBaseUrl: 'https://api.example.com/api/v1'),
    client: client,
    store: MemorySessionStore(),
    contributionBackend: backend ?? MemoryContributionBackend(),
  );
}
