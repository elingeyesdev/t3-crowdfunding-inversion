import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../core/network/api_exception.dart';
import '../../auth/application/app_dependencies.dart';
import '../data/profile_repository.dart';
import '../domain/profile_details.dart';

enum ProfileStatus { unavailable, loading, missing, ready, saving, error }

class AccountProfileController extends ChangeNotifier {
  AccountProfileController(this.dependencies, this.kind) {
    dependencies.session.addListener(_sessionChanged);
    _sessionChanged();
  }

  final AppDependencies dependencies;
  final ProfileKind kind;
  ProfileStatus status = ProfileStatus.unavailable;
  ProfileDetails? details;
  String? message;
  Map<String, List<String>> fieldErrors = const {};
  bool needsReload = false;
  int _generation = -1, _operation = 0;
  bool _disposed = false;
  bool _wasAllowed = false;

  bool get allowed =>
      dependencies.session.accessToken != null &&
      (dependencies.session.state.user?.roles.contains(kind.role) ?? false);
  int get generation => _generation;
  bool _current(int operation, int generation) =>
      !_disposed &&
      allowed &&
      operation == _operation &&
      generation == dependencies.session.generation;

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  void _sessionChanged() {
    final session = dependencies.session;
    if (_generation == session.generation && allowed == _wasAllowed) return;
    _generation = session.generation;
    _wasAllowed = allowed;
    _operation++;
    details = null;
    message = null;
    fieldErrors = const {};
    needsReload = false;
    status = ProfileStatus.unavailable;
    if (allowed) {
      unawaited(load());
    } else {
      _notify();
    }
  }

  Future<bool> load() async {
    if (!allowed || _disposed || status == ProfileStatus.saving) return false;
    final operation = ++_operation, generation = _generation;
    status = ProfileStatus.loading;
    details = null;
    message = null;
    fieldErrors = const {};
    _notify();
    try {
      final result = await dependencies.authenticated((api) async {
        final repo = ProfileRepository(api);
        return kind == ProfileKind.investor
            ? ProfileDetails.investor(await repo.getInvestorProfile())
            : ProfileDetails.entrepreneur(await repo.getEntrepreneurProfile());
      });
      if (!_current(operation, generation)) return false;
      if (result.userId != dependencies.session.state.user?.id) {
        throw const ApiException(ApiErrorKind.invalidResponse);
      }
      details = result;
      status = ProfileStatus.ready;
      needsReload = false;
      _notify();
      return true;
    } catch (error) {
      if (!_current(operation, generation)) return false;
      if (error is ApiException && error.statusCode == 404) {
        status = ProfileStatus.missing;
        needsReload = false;
        _notify();
        return true;
      }
      status = ProfileStatus.error;
      message = error is ApiException
          ? error.message
          : 'No se pudo consultar el perfil.';
      _notify();
      return false;
    }
  }

  Future<bool> save(Map<String, String?> input) async {
    if (_disposed ||
        !allowed ||
        needsReload ||
        ![ProfileStatus.ready, ProfileStatus.missing].contains(status)) {
      return false;
    }
    final values = <String, String?>{};
    final errors = <String, List<String>>{};
    for (final field in ProfileField.forKind(kind)) {
      final value = input[field.name]?.trim();
      values[field.name] = value == null || value.isEmpty ? null : value;
      final error = field.validate(values[field.name]);
      if (error != null) errors[field.name] = [error];
    }
    if (kind == ProfileKind.investor && input.containsKey('investorType')) {
      values['investorType'] = input['investorType'];
      const known = ['individual', 'institutional', 'angel'];
      if (!known.contains(input['investorType']) &&
          (details == null ||
              input['investorType'] != details?.values['investorType'])) {
        errors['investorType'] = ['Selecciona un tipo de donante válido.'];
      }
    }
    fieldErrors = Map.unmodifiable(errors);
    message = null;
    if (errors.isNotEmpty) {
      _notify();
      return false;
    }
    final creating = status == ProfileStatus.missing;
    final changes = ProfileChanges(values, details);
    final operation = ++_operation, generation = _generation;
    status = ProfileStatus.saving;
    _notify();
    try {
      final result = await dependencies.authenticated((api) async {
        final repo = ProfileRepository(api);
        return switch (kind) {
          ProfileKind.investor => ProfileDetails.investor(
            creating
                ? await repo.createInvestorProfile(changes.createInvestor())
                : await repo.updateInvestorProfile(changes.updateInvestor()),
          ),
          ProfileKind.entrepreneur => ProfileDetails.entrepreneur(
            creating
                ? await repo.createEntrepreneurProfile(
                    changes.createEntrepreneur(),
                  )
                : await repo.updateEntrepreneurProfile(
                    changes.updateEntrepreneur(),
                  ),
          ),
        };
      });
      if (!_current(operation, generation)) return false;
      if (result.userId != dependencies.session.state.user?.id) {
        throw const ApiException(ApiErrorKind.invalidResponse);
      }
      details = result;
      status = ProfileStatus.ready;
      message = 'Perfil guardado.';
      _notify();
      return true;
    } catch (error) {
      if (!_current(operation, generation)) return false;
      status = creating ? ProfileStatus.missing : ProfileStatus.ready;
      if (error is ApiException) {
        fieldErrors = error.fieldErrors;
        needsReload = ![422, 403, 429].contains(error.statusCode);
        message = error.statusCode == 409
            ? 'El perfil cambió o ya existe. Consulta su estado antes de volver a guardar.'
            : needsReload
            ? 'No se pudo confirmar el guardado. Verifica el estado del perfil antes de reenviar.'
            : error.message;
      } else {
        needsReload = true;
        message = 'No se pudo confirmar el guardado. Verifica el estado del perfil antes de reenviar.';
      }
      _notify();
      return false;
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _operation++;
    details = null;
    dependencies.session.removeListener(_sessionChanged);
    super.dispose();
  }
}
