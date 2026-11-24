import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../auth/domain/api_contract.dart';
import '../domain/public_campaign.dart';

class CatalogRepository {
  const CatalogRepository(this.api);
  final ApiClient api;

  Future<List<CampaignCategory>> categories() async {
    final data = ApiContract.data(
      await api.get('categories', authenticated: false),
      status: 200,
    );
    if (data is! List) ApiContract.invalid();
    final result = data.map(CampaignCategory.fromJson).toList();
    if (result.map((c) => c.id).toSet().length != result.length) {
      ApiContract.invalid();
    }
    return List.unmodifiable(result);
  }

  Future<CampaignPage> list(CatalogQuery query, {int page = 1}) async {
    if (page < 1 ||
        query.search.runes.length > 200 ||
        (query.categoryId != null && !isCampaignId(query.categoryId!))) {
      throw const ApiException(ApiErrorKind.invalidRequest);
    }
    final result = CampaignPage.fromJson(
      ApiContract.data(
        await api.get(
          'campaigns/public',
          queryParameters: query.parameters(page),
          authenticated: false,
        ),
        status: 200,
      ),
    );
    if (result.page != page) ApiContract.invalid();
    return result;
  }

  Future<PublicCampaign> detail(String id) async {
    if (!isCampaignId(id)) {
      throw const ApiException(ApiErrorKind.http, statusCode: 404);
    }
    final canonical = id.toLowerCase();
    final campaign = PublicCampaign.fromJson(
      ApiContract.data(
        await api.get('campaigns/public/$canonical', authenticated: false),
        status: 200,
      ),
    );
    if (campaign.id.toLowerCase() != canonical) ApiContract.invalid();
    return campaign;
  }
}
