import 'dart:typed_data';

import '../../../core/network/api_client.dart';
import '../../auth/application/app_dependencies.dart';
import '../../auth/domain/api_contract.dart';
import '../domain/contribution.dart';
import 'contribution_ledger.dart';

class ContributionRepository {
  const ContributionRepository(this.dependencies);
  final AppDependencies dependencies;
  Future<T> _private<T>(Future<T> Function(ApiClient api) action) =>
      dependencies.authenticated(action);
  Future<ContributionCampaign> campaign(String id) async {
    contributionId(id);
    final c = ContributionCampaign.fromJson(
      ApiContract.data(
        await dependencies.publicApi.get(
          'campaigns/public/$id',
          authenticated: false,
        ),
        status: 200,
      ),
    );
    if (c.campaign.id.toLowerCase() != id.toLowerCase()) ApiContract.invalid();
    return c;
  }

  Future<List<ContributionReward>> rewards(String id) async {
    contributionId(id);
    final raw = ApiContract.data(
      await dependencies.publicApi.get(
        'campaigns/$id/rewards',
        authenticated: false,
      ),
      status: 200,
    );
    if (raw is! List) ApiContract.invalid();
    final rows = raw.map(ContributionReward.fromJson).toList();
    if (rows.any((r) => r.campaignId != id.toLowerCase()) ||
        rows.map((r) => r.id).toSet().length != rows.length) {
      ApiContract.invalid();
    }
    return List.unmodifiable(rows);
  }

  Future<ContributionCapital> capital() => _private(
    (api) async => ContributionCapital.fromJson(
      ApiContract.data(await api.get('investors/me/capital'), status: 200),
    ),
  );
  Future<List<ContributionReceipt>> receipts() => _private((api) async {
    final raw = ApiContract.data(await api.get('investments/me'), status: 200);
    if (raw is! List || raw.length > 20000) ApiContract.invalid();
    final rows = raw.map((j) => ContributionReceipt.fromJson(j)).toList();
    if (rows.map((r) => r.id).toSet().length != rows.length) {
      ApiContract.invalid();
    }
    return List.unmodifiable(rows);
  });
  Future<ContributionReceipt> contribute(PendingContribution p) =>
      _private((api) async {
        final result = ApiContract.object(
          ApiContract.data(
            await api.post(
              'investments',
              body: {
                'campaignId': p.campaignId,
                'amount': Money.decimal(p.amount),
                if (p.rewardId != null) 'rewardTierId': p.rewardId,
              },
            ),
            status: 201,
          ),
        );
        final receipt = ContributionReceipt.fromJson(
          result['ticket'],
          ticket: true,
        );
        if (receipt.campaignId != p.campaignId ||
            receipt.amount != p.amount ||
            receipt.rewardId != p.rewardId ||
            receipt.currency != p.currency ||
            receipt.status != 'completed') {
          ApiContract.invalid();
        }
        return receipt;
      });
  Future<ContributionCapital> addCapital(int cents) => _private((api) async {
    if (cents < 1 || cents > 100000000000) ApiContract.invalid();
    final result = ApiContract.object(
      ApiContract.data(
        await api.post(
          'investors/me/capital/add',
          body: {'amount': Money.decimal(cents)},
        ),
        status: 200,
      ),
    );
    return ContributionCapital.fromJson({
      'availableCapital': result['availableCapital'],
      'maxInvestmentLimit': result['newMax'],
    });
  });
  Future<Uint8List> pdf(String id) => _private((api) async {
    contributionId(id);
    final bytes = await api.getBytes(
      'investments/$id/receipt',
      maxBytes: 10 * 1024 * 1024,
    );
    if (bytes.length < 5 || String.fromCharCodes(bytes.take(5)) != '%PDF-') {
      ApiContract.invalid();
    }
    return bytes;
  });
}
