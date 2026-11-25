import '../../auth/domain/api_contract.dart';
import '../../catalog/domain/public_campaign.dart';

/// Unidades menores exactas; los saldos no se calculan con double.
abstract final class Money {
  static const max = 999999999999999;
  static int? input(String value) =>
      scaled(value.trim().replaceAll(',', '.'), 2);
  static int? scaled(Object? value, int decimals) {
    if (value is! String && value is! num) return null;
    final text = value.toString();
    if (!RegExp('^\\d{1,13}(?:\\.\\d{1,$decimals})?\$').hasMatch(text)) {
      return null;
    }
    final parts = text.split('.');
    final amount = int.tryParse(
      parts.first +
          (parts.length == 2 ? parts.last : '').padRight(decimals, '0'),
    );
    return amount != null && amount <= max ? amount : null;
  }

  static int read(Object? value) => scaled(value, 2) ?? ApiContract.invalid();
  static String decimal(int cents) =>
      '${cents ~/ 100}.${(cents % 100).toString().padLeft(2, '0')}';
  static String label(int cents, [String currency = '']) {
    final whole = (cents ~/ 100).toString().replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (m) => '${m[1]!}.',
    );
    final fraction = (cents % 100).toString().padLeft(2, '0');
    final suffix = currency.isEmpty ? '' : ' $currency';
    return '$whole,$fraction$suffix';
  }
}

String contributionId(Object? value) {
  if (value is! String || !isCampaignId(value)) ApiContract.invalid();
  return value.toLowerCase();
}

DateTime? contributionDate(Object? value) {
  if (value == null) return null;
  if (value is! String) ApiContract.invalid();
  return DateTime.tryParse(value) ?? ApiContract.invalid();
}

class ContributionCampaign {
  ContributionCampaign.fromJson(Object? value) {
    final j = ApiContract.object(value);
    campaign = PublicCampaign.fromJson(value);
    goal = Money.read(j['goalAmount']);
    raised = Money.read(j['currentAmount']);
    minimum = Money.read(j['minInvestment']);
    maximum = j['maxInvestment'] == null
        ? null
        : Money.read(j['maxInvestment']);
    creatorId = contributionId(j['creatorId'] ?? j['entrepreneurUserId']);
    if (maximum != null && maximum! < minimum) ApiContract.invalid();
  }
  late final PublicCampaign campaign;
  late final int goal, raised, minimum;
  late final int? maximum;
  late final String creatorId;
  int get remaining => goal > raised ? goal - raised : 0;
  bool accepts(DateTime now) =>
      ['published', 'partially_funded'].contains(campaign.status) &&
      remaining > 0 &&
      (campaign.endDate == null || campaign.endDate!.isAfter(now));
}

class ContributionReward {
  ContributionReward.fromJson(Object? value) {
    final j = ApiContract.object(value);
    id = contributionId(j['id']);
    campaignId = contributionId(j['campaignId']);
    title = ApiContract.string(j, 'title');
    description = ApiContract.optionalString(j, 'description');
    currency = ApiContract.string(j, 'currency');
    amount = Money.read(j['amount']);
    minimum = Money.scaled(j['minPercentage'], 4) ?? ApiContract.invalid();
    maximum = Money.scaled(j['maxPercentage'], 4) ?? ApiContract.invalid();
    if (minimum > maximum || maximum > 1000000) ApiContract.invalid();
    if (j['isActive'] is! bool) ApiContract.invalid();
    active = j['isActive'] as bool;
    int count(String key) {
      final v = j[key];
      if (v is! int || v < 0) ApiContract.invalid();
      return v;
    }

    claimed = count('currentClaims');
    limit = j['maxClaims'] == null ? null : count('maxClaims');
    expires = contributionDate(j['expiresAt']);
    delivery = contributionDate(j['estimatedDelivery']);
    shipping = ApiContract.optionalString(j, 'shippingDetails');
    includesShipping = ApiContract.optionalBool(j, 'includesShipping') ?? false;
    final rawItems = j['items'];
    items = rawItems is List
        ? List.unmodifiable(rawItems.whereType<String>())
        : const [];
  }
  late final String id, campaignId, title, currency;
  late final String? description, shipping;
  late final int amount, minimum, maximum, claimed;
  late final int? limit;
  late final bool active, includesShipping;
  late final DateTime? expires, delivery;
  late final List<String> items;
  bool available(DateTime now) =>
      active &&
      (limit == null || claimed < limit!) &&
      (expires == null || expires!.isAfter(now));
  bool eligible(int cents, ContributionCampaign c, DateTime now) {
    final weighted = BigInt.from(cents) * BigInt.from(1000000);
    return available(now) &&
        currency == c.campaign.currency &&
        cents >= amount &&
        weighted >= BigInt.from(c.goal) * BigInt.from(minimum) &&
        weighted <= BigInt.from(c.goal) * BigInt.from(maximum);
  }

  String get range => '${minimum / 10000}%–${maximum / 10000}% de la meta';
}

class ContributionReceipt {
  ContributionReceipt.fromJson(Object? value, {bool ticket = false}) {
    final j = ApiContract.object(value);
    id = contributionId(j['id']);
    campaignId = contributionId(j['campaignId']);
    amount = Money.read(j['amount']);
    if (amount < 1) ApiContract.invalid();
    currency = ApiContract.string(j, 'currency');
    // Eloquent devuelve el ticket recién creado sin hidratar defaults SQL.
    // El endpoint 201 aplica la operación completa; la tabla usa completed.
    status = ticket
        ? (ApiContract.optionalString(j, 'status') ?? 'completed')
        : ApiContract.string(j, 'investmentStatus');
    date = contributionDate(j['createdAt']) ?? ApiContract.invalid();
    rewardId = j['rewardTierId'] == null
        ? null
        : contributionId(j['rewardTierId']);
    title = ApiContract.optionalString(j, 'campaignTitle') ?? 'Campaña';
    rewardTitle = ApiContract.optionalString(j, 'rewardTitle');
  }
  late final String id, campaignId, currency, status, title;
  late final String? rewardId, rewardTitle;
  late final int amount;
  late final DateTime date;
  String get statusLabel => switch (status) {
    'completed' => 'Registrado',
    'pending' => 'Pendiente',
    'refunded' => 'Reembolsado',
    'failed' => 'No completado',
    _ => 'Estado no reconocido',
  };
}

class ContributionCapital {
  ContributionCapital.fromJson(Object? value) {
    final j = ApiContract.object(value);
    available = Money.read(j['availableCapital']);
    limit = Money.read(j['maxInvestmentLimit']);
  }
  late final int available, limit;
}
