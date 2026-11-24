import '../../auth/domain/api_contract.dart';

bool isCampaignId(String value) => RegExp(
  r'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$',
).hasMatch(value);

class CampaignCategory {
  const CampaignCategory({required this.id, required this.name});
  factory CampaignCategory.fromJson(Object? value) {
    final json = ApiContract.object(value);
    final id = ApiContract.string(json, 'id');
    if (!isCampaignId(id)) ApiContract.invalid();
    final display = ApiContract.optionalString(json, 'displayName');
    return CampaignCategory(
      id: id,
      name: display?.trim().isNotEmpty == true
          ? display!
          : ApiContract.string(json, 'name'),
    );
  }
  final String id, name;
}

/// Proyección pública: no retiene KYC, datos bancarios ni aportes individuales.
class PublicCampaign {
  const PublicCampaign({
    required this.id,
    required this.title,
    required this.goal,
    required this.raised,
    required this.currency,
    required this.status,
    this.description,
    this.summary,
    this.cover,
    this.category,
    this.creator,
    this.location,
    this.endDate,
  });

  factory PublicCampaign.fromJson(Object? value) {
    final json = ApiContract.object(value);
    final id = ApiContract.string(json, 'id');
    if (!isCampaignId(id)) ApiContract.invalid();
    double money(String key, {bool positive = false}) {
      final raw = json[key];
      final parsed = raw is num
          ? raw.toDouble()
          : raw is String
          ? double.tryParse(raw)
          : null;
      if (parsed == null ||
          !parsed.isFinite ||
          parsed < 0 ||
          parsed > 9999999999999.99 ||
          (positive && parsed < 1)) {
        ApiContract.invalid();
      }
      return parsed;
    }

    final end = ApiContract.optionalString(json, 'endDate');
    final date = end == null ? null : DateTime.tryParse(end);
    if (end != null && date == null) ApiContract.invalid();
    final display = ApiContract.optionalString(json, 'entrepreneurDisplayName');
    return PublicCampaign(
      id: id,
      title: ApiContract.string(json, 'title'),
      goal: money('goalAmount', positive: true),
      raised: money('currentAmount'),
      currency: ApiContract.string(json, 'currency'),
      status: ApiContract.string(json, 'status'),
      description: ApiContract.optionalString(json, 'description'),
      summary: ApiContract.optionalString(json, 'shortDescription'),
      cover: ApiContract.optionalString(json, 'coverImageUrl'),
      category: ApiContract.optionalString(json, 'categoryName'),
      creator: display?.trim().isNotEmpty == true
          ? display
          : ApiContract.optionalString(json, 'entrepreneurName'),
      location: ApiContract.optionalString(json, 'location'),
      endDate: date,
    );
  }

  final String id, title, currency, status;
  final double goal, raised;
  final String? description, summary, cover, category, creator, location;
  final DateTime? endDate;
  double get progress => raised / goal;
  String get statusLabel => switch (status) {
    'published' => 'Activa',
    'partially_funded' => 'En recaudación',
    'funded' => 'Meta alcanzada',
    'completed' => 'Completada',
    'failed' => 'Finalizada sin alcanzar la meta',
    _ => 'Estado: $status',
  };
}

class CampaignPage {
  CampaignPage({
    required Iterable<PublicCampaign> items,
    required this.page,
    required this.pages,
    required this.total,
  }) : items = List.unmodifiable(items);
  final List<PublicCampaign> items;
  final int page, pages, total;
  bool get hasMore => items.isNotEmpty && page < pages;

  factory CampaignPage.fromJson(Object? value) {
    final json = ApiContract.object(value);
    final data = json['data'];
    if (data is! List) ApiContract.invalid();
    final meta = ApiContract.object(json['meta']);
    int count(String key, int minimum) {
      final v = meta[key];
      if (v is! int || v < minimum) ApiContract.invalid();
      return v;
    }

    final total = count('totalItems', 0);
    if (count('itemCount', 0) != data.length || total < data.length) {
      ApiContract.invalid();
    }
    return CampaignPage(
      items: data.map(PublicCampaign.fromJson),
      page: count('currentPage', 1),
      pages: count('totalPages', 1),
      total: total,
    );
  }
}

class CatalogQuery {
  const CatalogQuery({this.search = '', this.categoryId});
  final String search;
  final String? categoryId;
  Map<String, String> parameters(int page) => {
    'page': '$page',
    'limit': '20',
    'sortBy': 'created_at',
    'sortOrder': 'DESC',
    if (search.trim().isNotEmpty) 'q': search.trim(),
    'categoryId': ?categoryId,
  };
}
