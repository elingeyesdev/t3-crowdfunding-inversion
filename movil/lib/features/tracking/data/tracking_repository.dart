import '../../../core/network/api_exception.dart';
import '../../auth/application/app_dependencies.dart';
import '../../auth/domain/api_contract.dart';
import '../../catalog/data/catalog_repository.dart';
import '../../contributions/domain/contribution.dart';
import '../domain/donor_tracking.dart';

class TrackingRepository {
  const TrackingRepository(this.dependencies);
  final AppDependencies dependencies;

  Future<List<TrackedContribution>> contributions() =>
      dependencies.authenticated((api) async {
        final raw = ApiContract.data(
          await api.get('investments/me'),
          status: 200,
        );
        if (raw is! List || raw.length > 20000) ApiContract.invalid();
        final rows = raw.map(TrackedContribution.fromJson).toList();
        if (rows.map((r) => r.receipt.id).toSet().length != rows.length) {
          ApiContract.invalid();
        }
        rows.sort((a, b) {
          final date = b.receipt.date.compareTo(a.receipt.date);
          return date != 0 ? date : b.receipt.id.compareTo(a.receipt.id);
        });
        return List.unmodifiable(rows);
      });

  Future<BackedUpdatesPage> updates({int page = 1, String? campaignId}) =>
      dependencies.authenticated((api) async {
        if (page < 1) throw const ApiException(ApiErrorKind.invalidRequest);
        if (campaignId != null) contributionId(campaignId);
        final result = BackedUpdatesPage.fromJson(
          ApiContract.data(
            await api.get(
              'investments/backed-campaigns/updates',
              queryParameters: {
                'page': '$page',
                'limit': '10',
                'campaignId': ?campaignId,
              },
            ),
            status: 200,
          ),
        );
        if (result.page != page ||
            (campaignId != null &&
                result.items.any(
                  (u) => u.campaignId != campaignId.toLowerCase(),
                ))) {
          ApiContract.invalid();
        }
        return result;
      });

  Future<TrackingCampaign> campaign(String id) async {
    final canonical = contributionId(id);
    final generation = dependencies.session.generation;
    final rows = (await contributions())
        .where((r) => r.receipt.campaignId == canonical)
        .toList();
    if (rows.isEmpty) {
      throw const ApiException(ApiErrorKind.http, statusCode: 404);
    }
    final campaign = await CatalogRepository(dependencies.publicApi)
        .detail(canonical);
    final raw = ApiContract.data(
      await dependencies.publicApi.get(
        'campaigns/$canonical/milestones',
        authenticated: false,
      ),
      status: 200,
    );
    if (raw is! List) ApiContract.invalid();
    final milestones = raw.map(TrackedMilestone.fromJson).toList();
    if (milestones.any((m) => m.campaignId != canonical) ||
        milestones.map((m) => m.id).toSet().length != milestones.length) {
      ApiContract.invalid();
    }
    milestones.sort((a, b) {
      final order = a.sortOrder.compareTo(b.sortOrder);
      return order != 0 ? order : a.id.compareTo(b.id);
    });
    if (generation != dependencies.session.generation ||
        dependencies.session.accessToken == null) {
      throw const ApiException(ApiErrorKind.closed);
    }
    return TrackingCampaign(
      campaign,
      List.unmodifiable(rows),
      List.unmodifiable(milestones),
    );
  }
}
