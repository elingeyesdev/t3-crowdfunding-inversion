import 'package:flutter/foundation.dart';

import '../../../core/network/api_exception.dart';
import '../data/catalog_repository.dart';
import '../domain/public_campaign.dart';

enum CatalogStatus { loading, ready, empty, error }

class CatalogController extends ChangeNotifier {
  CatalogController(this.repository);
  final CatalogRepository repository;
  CatalogStatus status = CatalogStatus.loading;
  List<PublicCampaign> campaigns = const [];
  List<CampaignCategory> categories = const [];
  CatalogQuery query = const CatalogQuery();
  CampaignPage? _page;
  bool loadingMore = false, loadingCategories = false;
  String? error, pageError, categoriesError;
  int _revision = 0, _categoriesRevision = 0;
  bool _disposed = false;
  bool get hasMore => _page?.hasMore ?? false;
  int get total => _page?.total ?? 0;
  void _notify() {
    if (!_disposed) notifyListeners();
  }

  static String message(Object error) => error is ApiException
      ? error.message
      : 'No se pudo consultar el catálogo.';

  Future<void> initialize() async {
    await Future.wait([loadCategories(), loadFirst(query)]);
  }

  Future<void> refresh() => initialize();

  Future<void> loadCategories() async {
    if (_disposed) return;
    final revision = ++_categoriesRevision;
    loadingCategories = true;
    categoriesError = null;
    _notify();
    try {
      final result = await repository.categories();
      if (_disposed || revision != _categoriesRevision) return;
      categories = result;
    } catch (e) {
      if (_disposed || revision != _categoriesRevision) return;
      categoriesError = message(e);
    } finally {
      if (!_disposed && revision == _categoriesRevision) {
        loadingCategories = false;
        _notify();
      }
    }
  }

  Future<void> loadFirst(CatalogQuery next) async {
    if (_disposed) return;
    final revision = ++_revision;
    query = next;
    campaigns = const [];
    _page = null;
    loadingMore = false;
    error = pageError = null;
    status = CatalogStatus.loading;
    _notify();
    try {
      final result = await repository.list(next);
      if (_disposed || revision != _revision) return;
      _page = result;
      campaigns = List.unmodifiable(
        {for (final c in result.items) c.id: c}.values,
      );
      status = campaigns.isEmpty ? CatalogStatus.empty : CatalogStatus.ready;
    } catch (e) {
      if (_disposed || revision != _revision) return;
      error = message(e);
      status = CatalogStatus.error;
    }
    if (!_disposed && revision == _revision) _notify();
  }

  Future<void> loadMore() async {
    if (_disposed || loadingMore || status != CatalogStatus.ready || !hasMore) {
      return;
    }
    final revision = _revision;
    final next = _page!.page + 1;
    loadingMore = true;
    pageError = null;
    _notify();
    try {
      final result = await repository.list(query, page: next);
      if (_disposed || revision != _revision) return;
      campaigns = List.unmodifiable(
        {
          for (final c in campaigns) c.id: c,
          for (final c in result.items) c.id: c,
        }.values,
      );
      _page = result;
    } catch (e) {
      if (_disposed || revision != _revision) return;
      pageError = message(e);
    } finally {
      if (!_disposed && revision == _revision) {
        loadingMore = false;
        _notify();
      }
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _revision++;
    _categoriesRevision++;
    super.dispose();
  }
}

enum CampaignDetailStatus { loading, ready, notFound, error }

class CampaignDetailController extends ChangeNotifier {
  CampaignDetailController(this.repository);
  final CatalogRepository repository;
  CampaignDetailStatus status = CampaignDetailStatus.loading;
  PublicCampaign? campaign;
  String? error;
  int _revision = 0;
  bool _disposed = false;
  Future<void> load(String id) async {
    if (_disposed) return;
    final revision = ++_revision;
    status = CampaignDetailStatus.loading;
    campaign = null;
    error = null;
    notifyListeners();
    try {
      final result = await repository.detail(id);
      if (_disposed || revision != _revision) return;
      campaign = result;
      status = CampaignDetailStatus.ready;
    } catch (e) {
      if (_disposed || revision != _revision) return;
      status = e is ApiException && e.statusCode == 404
          ? CampaignDetailStatus.notFound
          : CampaignDetailStatus.error;
      error = CatalogController.message(e);
    }
    if (!_disposed && revision == _revision) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _revision++;
    campaign = null;
    super.dispose();
  }
}
