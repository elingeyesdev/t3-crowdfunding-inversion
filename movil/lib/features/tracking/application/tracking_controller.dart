import 'package:flutter/foundation.dart';

import '../../../core/network/api_exception.dart';
import '../data/tracking_repository.dart';
import '../domain/donor_tracking.dart';

class TrackingController extends ChangeNotifier {
  TrackingController(this.repository)
    : _generation = repository.dependencies.session.generation {
    repository.dependencies.session.addListener(_sessionChanged);
  }
  final TrackingRepository repository;
  final int _generation;
  List<TrackedContribution> contributions = const [];
  BackedUpdatesPage? updates;
  String? historyError, updatesError, campaignFilter;
  bool loadingHistory = false, loadingUpdates = false;
  int _historyRequest = 0, _updatesRequest = 0;
  bool _disposed = false;
  bool get _active =>
      !_disposed &&
      _generation == repository.dependencies.session.generation &&
      repository.dependencies.session.accessToken != null;
  void _emit() {
    if (!_disposed) notifyListeners();
  }

  void _sessionChanged() {
    if (_active) return;
    contributions = const [];
    updates = null;
    historyError = updatesError = null;
    loadingHistory = loadingUpdates = false;
    _historyRequest++;
    _updatesRequest++;
    _emit();
  }

  Future<void> refresh() async {
    await Future.wait([loadHistory(), loadUpdates()]);
  }

  Future<void> loadHistory() async {
    if (!_active) return;
    final request = ++_historyRequest;
    loadingHistory = true;
    historyError = null;
    contributions = const [];
    _emit();
    try {
      final result = await repository.contributions();
      if (_active && request == _historyRequest) contributions = result;
    } catch (e) {
      if (_active && request == _historyRequest) historyError = _message(e);
    } finally {
      if (_active && request == _historyRequest) {
        loadingHistory = false;
        _emit();
      }
    }
  }

  Future<void> selectCampaign(String? id) async {
    campaignFilter = id;
    await loadUpdates();
  }

  Future<void> loadUpdates({int page = 1}) async {
    if (!_active) return;
    final request = ++_updatesRequest;
    final filter = campaignFilter;
    loadingUpdates = true;
    updatesError = null;
    _emit();
    try {
      var result = await repository.updates(page: page, campaignId: filter);
      if (!_active || request != _updatesRequest) return;
      // Si una eliminación o cambio de visibilidad vacía la última página,
      // volver una sola vez al inicio con el mismo filtro.
      if (result.page > result.pages) {
        result = await repository.updates(campaignId: filter);
      }
      if (_active && request == _updatesRequest) updates = result;
    } catch (e) {
      if (_active && request == _updatesRequest) {
        updates = null;
        updatesError = _message(e);
      }
    } finally {
      if (_active && request == _updatesRequest) {
        loadingUpdates = false;
        _emit();
      }
    }
  }

  static String _message(Object e) =>
      e is ApiException ? e.message : 'No se pudo cargar el seguimiento.';
  @override
  void dispose() {
    _disposed = true;
    repository.dependencies.session.removeListener(_sessionChanged);
    super.dispose();
  }
}
