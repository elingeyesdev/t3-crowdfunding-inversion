import '../../auth/domain/api_contract.dart';
import '../../catalog/domain/public_campaign.dart';
import '../../contributions/domain/contribution.dart';

const rewardStates = <String, String>{
  'pending': 'Pendiente',
  'processing': 'En preparación',
  'shipped': 'Enviada',
  'delivered': 'Entregada',
  'issue_reported': 'Incidencia reportada',
  'cancelled': 'Cancelada',
  'unknown': 'Sin seguimiento disponible',
};

String trackingDate(DateTime value, {bool dateOnly = false}) {
  final d = dateOnly ? value : value.toLocal();
  return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
}

class TrackedContribution {
  TrackedContribution.fromJson(Object? value) {
    receipt = ContributionReceipt.fromJson(value);
    final j = ApiContract.object(value);
    campaignStatus = ApiContract.string(j, 'campaignStatus');
    claimId = j['rewardClaimId'] == null
        ? null
        : contributionId(j['rewardClaimId']);
    description = ApiContract.optionalString(j, 'rewardDescription');
    final rawStatus = ApiContract.optionalString(j, 'rewardClaimStatus');
    rewardState = rewardStates.containsKey(rawStatus) ? rawStatus! : 'unknown';
    trackingNumber = ApiContract.optionalString(j, 'trackingNumber');
    trackingUrl = ApiContract.optionalString(j, 'trackingUrl');
    estimatedDelivery = contributionDate(j['rewardEstimatedDelivery']);
    shippedAt = contributionDate(j['shippedAt']);
    deliveredAt = contributionDate(j['deliveredAt']);
  }
  late final ContributionReceipt receipt;
  late final String campaignStatus, rewardState;
  late final String? claimId, description, trackingNumber, trackingUrl;
  late final DateTime? estimatedDelivery, shippedAt, deliveredAt;
  bool get hasReward => receipt.rewardId != null || claimId != null;
  String get rewardLabel => rewardStates[rewardState]!;
  String get campaignLabel => campaignStatusLabel(campaignStatus);
}

String campaignStatusLabel(String status) => switch (status) {
  'published' => 'Activa',
  'partially_funded' => 'En recaudación',
  'funded' => 'Meta alcanzada',
  'completed' => 'Completada',
  'failed' => 'Finalizada sin alcanzar la meta',
  'cancelled' => 'Cancelada',
  _ => 'Estado no reconocido',
};

/// No mezcla monedas ni suma reembolsos como aportes vigentes.
Map<String, BigInt> contributionTotals(
  Iterable<TrackedContribution> rows,
  String status,
) {
  final result = <String, BigInt>{};
  for (final row in rows) {
    final r = row.receipt;
    if (r.status == status) {
      result.update(
        r.currency,
        (v) => v + BigInt.from(r.amount),
        ifAbsent: () => BigInt.from(r.amount),
      );
    }
  }
  return Map.unmodifiable(result);
}

String trackingTotalLabel(BigInt cents, String currency) {
  final digits = cents.toString().padLeft(3, '0');
  final whole = digits
      .substring(0, digits.length - 2)
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]}.');
  return '$whole,${digits.substring(digits.length - 2)} $currency';
}

class BackedCampaignOption {
  BackedCampaignOption.fromJson(Object? value) {
    final j = ApiContract.object(value);
    id = contributionId(j['id']);
    title = ApiContract.string(j, 'title');
  }
  late final String id, title;
}

class TrackingAttachment {
  TrackingAttachment.fromJson(Object? value) {
    final j = ApiContract.object(value);
    title = ApiContract.optionalString(j, 'title');
    type = ApiContract.optionalString(j, 'type');
    url = ApiContract.optionalString(j, 'url');
    text = ApiContract.optionalString(j, 'text');
  }
  late final String? title, type, url, text;
}

List<TrackingAttachment> trackingAttachments(Object? value) {
  if (value == null) return const [];
  if (value is! List || value.length > 100) ApiContract.invalid();
  return List.unmodifiable(value.map(TrackingAttachment.fromJson));
}

class BackedUpdate {
  BackedUpdate.fromJson(Object? value) {
    final j = ApiContract.object(value);
    id = contributionId(j['id']);
    campaignId = contributionId(j['campaignId']);
    title = ApiContract.string(j, 'title');
    content = ApiContract.string(j, 'content');
    campaignTitle = ApiContract.string(j, 'campaignTitle');
    author = ApiContract.optionalString(j, 'entrepreneurName') ?? 'Emprendedor';
    createdAt = contributionDate(j['createdAt']) ?? ApiContract.invalid();
    raised = Money.read(j['campaignCurrentAmount']);
    goal = Money.read(j['campaignGoalAmount']);
    if (goal < 1) ApiContract.invalid();
    attachments = trackingAttachments(j['attachments']);
  }
  late final String id, campaignId, title, content, campaignTitle, author;
  late final DateTime createdAt;
  late final int raised, goal;
  late final List<TrackingAttachment> attachments;
  double get progress => (raised / goal).clamp(0, 1);
}

class BackedUpdatesPage {
  BackedUpdatesPage.fromJson(Object? value) {
    final j = ApiContract.object(value);
    final raw = j['data'], options = j['campaigns'];
    if (raw is! List || raw.length > 100 || options is! List) {
      ApiContract.invalid();
    }
    items = List.unmodifiable(raw.map(BackedUpdate.fromJson));
    campaigns = List.unmodifiable(options.map(BackedCampaignOption.fromJson));
    if (items.map((u) => u.id).toSet().length != items.length ||
        campaigns.map((c) => c.id).toSet().length != campaigns.length) {
      ApiContract.invalid();
    }
    final meta = ApiContract.object(j['meta']);
    int count(String key, int min) {
      final v = meta[key];
      if (v is! int || v < min) ApiContract.invalid();
      return v;
    }

    page = count('currentPage', 1);
    pages = count('totalPages', 1);
    total = count('totalItems', 0);
    if (count('itemCount', 0) != items.length || total < items.length) {
      ApiContract.invalid();
    }
  }
  late final List<BackedUpdate> items;
  late final List<BackedCampaignOption> campaigns;
  late final int page, pages, total;
}

class TrackedMilestone {
  TrackedMilestone.fromJson(Object? value) {
    final j = ApiContract.object(value);
    id = contributionId(j['id']);
    campaignId = contributionId(j['campaignId']);
    title = ApiContract.string(j, 'title');
    description = ApiContract.optionalString(j, 'description');
    status = ApiContract.string(j, 'status');
    final p = j['progressPercentage'], order = j['sortOrder'];
    if (p is! int || p < 0 || p > 100 || order is! int) ApiContract.invalid();
    progress = p;
    sortOrder = order;
    target = contributionDate(j['targetDate']);
    completed = contributionDate(j['completedDate']);
    evidence = trackingAttachments(j['evidenceUrls']);
  }
  late final String id, campaignId, title, status;
  late final String? description;
  late final int progress, sortOrder;
  late final DateTime? target, completed;
  late final List<TrackingAttachment> evidence;
  String get statusLabel => switch (status) {
    'pending' => 'Pendiente',
    'in_progress' => 'En desarrollo',
    'completed' => 'Completado',
    'delayed' => 'Retrasado',
    _ => 'Estado no reconocido',
  };
}

class TrackingCampaign {
  const TrackingCampaign(this.campaign, this.contributions, this.milestones);
  final PublicCampaign campaign;
  final List<TrackedContribution> contributions;
  final List<TrackedMilestone> milestones;
}
