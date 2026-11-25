import 'package:flutter/foundation.dart';

import '../../../core/network/api_exception.dart';
import '../../auth/application/app_dependencies.dart';
import '../../auth/application/session_state.dart';
import '../data/contribution_ledger.dart';
import '../data/contribution_repository.dart';
import '../domain/contribution.dart';

enum ContributionStatus {
  loading,
  ready,
  missingProfile,
  error,
  submitting,
  pending,
  success,
  unavailable,
}

class ContributionController extends ChangeNotifier {
  ContributionController(
    this.dependencies,
    this.campaignId, {
    DateTime Function()? clock,
  }) : repository = ContributionRepository(dependencies),
       clock = clock ?? DateTime.now {
    dependencies.session.addListener(_sessionChanged);
    _generation = dependencies.session.generation;
  }
  final AppDependencies dependencies;
  final String campaignId;
  final ContributionRepository repository;
  final DateTime Function() clock;
  late int _generation;
  int _revision = 0;
  bool _disposed = false, _loading = false;
  ContributionStatus status = ContributionStatus.loading;
  ContributionCampaign? campaign;
  ContributionCapital? capital;
  List<ContributionReward> rewards = [];
  ContributionReceipt? receipt;
  PendingContribution? pending;
  String? message;
  bool get allowed =>
      !_disposed &&
      dependencies.session.state.status == SessionStatus.authenticated &&
      dependencies.session.state.user?.roles.contains('investor') == true &&
      dependencies.session.accessToken != null;
  bool get busy => status == ContributionStatus.submitting || _loading;
  String get _user => dependencies.session.state.user!.id;
  bool _current(int revision) =>
      !_disposed &&
      revision == _revision &&
      allowed &&
      _generation == dependencies.session.generation;
  void _emit() {
    if (!_disposed) notifyListeners();
  }

  void _sessionChanged() {
    if (_generation == dependencies.session.generation && allowed) return;
    _revision++;
    _generation = dependencies.session.generation;
    campaign = null;
    capital = null;
    rewards = [];
    receipt = null;
    pending = null;
    status = ContributionStatus.unavailable;
    _emit();
  }

  Future<void> load() async {
    if (_loading || status == ContributionStatus.submitting) return;
    if (!allowed) {
      status = ContributionStatus.unavailable;
      _emit();
      return;
    }
    final revision = ++_revision;
    _generation = dependencies.session.generation;
    final user = _user;
    _loading = true;
    status = ContributionStatus.loading;
    message = null;
    _emit();
    var loadingCapital = false;
    try {
      final marker = await dependencies.contributionLedger.read(user);
      if (!_current(revision)) return;
      pending = marker;
      if (marker != null) {
        status = ContributionStatus.pending;
        message = 'Hay una operación sin respuesta confirmada. Consulta su resultado antes de realizar otra.';
        return;
      }
      final c = await repository.campaign(campaignId);
      final rs = await repository.rewards(campaignId);
      loadingCapital = true;
      final balance = await repository.capital();
      if (!_current(revision)) return;
      campaign = c;
      rewards = rs;
      capital = balance;
      status = ContributionStatus.ready;
    } catch (e) {
      if (!_current(revision)) return;
      status = loadingCapital && e is ApiException && e.statusCode == 404
          ? ContributionStatus.missingProfile
          : ContributionStatus.error;
      message = _error(e);
    } finally {
      _loading = false;
      if (_current(revision)) _emit();
    }
  }

  String? validate(int? cents, String? rewardId) {
    final c = campaign;
    if (!allowed || c == null || capital == null) {
      return 'La sesión o la campaña no están disponibles.';
    }
    if (!c.accepts(clock())) return 'La campaña no acepta aportes actualmente.';
    if (c.creatorId == _user.toLowerCase()) {
      return 'No puedes aportar a tu propia campaña.';
    }
    if (cents == null || cents < 1 || cents > Money.max) {
      return 'Introduce un monto positivo con hasta dos decimales, sin separadores de miles.';
    }
    if (cents < c.minimum) return 'El aporte es menor al mínimo de la campaña.';
    if (c.maximum != null && cents > c.maximum!) {
      return 'El aporte supera el máximo de la campaña.';
    }
    if (cents > c.remaining) {
      return 'El aporte supera lo que falta para alcanzar la meta.';
    }
    if (cents > capital!.available) return 'Saldo simulado insuficiente.';
    if (rewardId != null) {
      final selected = rewards.where((r) => r.id == rewardId);
      if (selected.length != 1 ||
          !selected.single.eligible(cents, c, clock())) {
        return 'La recompensa no cumple el monto, la moneda, el plazo o el cupo. Revisa tu selección.';
      }
    }
    return null;
  }

  Future<void> submit(int cents, String? rewardId) async {
    if (status != ContributionStatus.ready || busy) return;
    message = validate(cents, rewardId);
    if (message != null) {
      _emit();
      return;
    }
    await _write(cents, rewardId, false);
  }

  Future<void> topUp(int cents) async {
    if (status != ContributionStatus.ready || busy) return;
    if (cents < 1 ||
        cents > 100000000000 ||
        capital!.limit + cents > Money.max) {
      message = 'El saldo a agregar debe estar entre 0,01 y 1.000.000.000,00.';
      _emit();
      return;
    }
    await _write(cents, null, true);
  }

  Future<void> _write(int cents, String? rewardId, bool topUp) async {
    final revision = _revision, user = _user;
    status = ContributionStatus.submitting;
    message = null;
    _emit();
    var sent = false, recorded = false;
    PendingContribution? marker;
    try {
      final before = topUp
          ? <ContributionReceipt>[]
          : await repository.receipts();
      if (!_current(revision)) return;
      marker = PendingContribution(
        campaignId: campaignId.toLowerCase(),
        amount: cents,
        rewardId: rewardId,
        currency: campaign!.campaign.currency,
        before: before.map((r) => r.id).toSet(),
        capital: topUp,
        capitalLimit: capital!.limit,
      );
      await dependencies.contributionLedger.begin(user, marker);
      recorded = true;
      pending = marker;
      if (!_current(revision)) {
        await dependencies.contributionLedger.clear(user, expected: marker);
        return;
      }
      sent = true;
      if (topUp) {
        capital = await repository.addCapital(cents);
      } else {
        receipt = await repository.contribute(marker);
      }
      if (!_current(revision)) return;
      await dependencies.contributionLedger.clear(user, expected: marker);
      if (!_current(revision)) return;
      pending = null;
      status = topUp ? ContributionStatus.ready : ContributionStatus.success;
      if (topUp) {
        if (_current(revision)) message = 'Saldo simulado actualizado.';
      }
    } catch (e) {
      // Un 401 se conoce como rechazo aunque el controlador de sesión ya haya
      // invalidado su generación. No dejar un falso intento pendiente.
      if (recorded && e is ApiException && e.statusCode == 401) {
        try {
          await dependencies.contributionLedger.clear(user, expected: marker);
        } catch (_) {
          /* Conservar el marcador si el almacenamiento no responde. */
        }
      }
      if (!_current(revision)) return;
      final rejected =
          e is ApiException &&
          e.kind == ApiErrorKind.http &&
          [400, 403, 404, 409, 422, 429].contains(e.statusCode);
      if (recorded && sent && !rejected) {
        status = ContributionStatus.pending;
        message = 'No se pudo confirmar la respuesta. El envío no se repetirá automáticamente. Consulta el resultado.';
      } else {
        if (recorded) {
          try {
            await dependencies.contributionLedger.clear(user, expected: marker);
            pending = null;
          } catch (_) {
            status = ContributionStatus.pending;
            _emit();
            return;
          }
        }
        if (!_current(revision)) return;
        status = ContributionStatus.ready;
        message = e is ApiException && e.statusCode == 422
            ? 'El servicio rechazó la operación. Revisa saldo, monto, límites y recompensa; actualiza los datos antes de volver a confirmar.'
            : _error(e);
      }
    } finally {
      if (_current(revision)) _emit();
    }
  }

  Future<void> reconcile() async {
    if (!allowed || _loading || status != ContributionStatus.pending) return;
    final revision = _revision, user = _user;
    _loading = true;
    message = null;
    _emit();
    try {
      final marker = await dependencies.contributionLedger.read(user);
      if (!_current(revision)) return;
      if (marker == null) {
        status = ContributionStatus.error;
        message = 'Actualiza la consulta para continuar.';
        return;
      }
      if (marker.capital) {
        final balance = await repository.capital();
        if (!_current(revision)) return;
        if (balance.limit < marker.capitalLimit + marker.amount) {
          message =
              'El saldo aún no confirma la carga. No se repetirá el envío.';
          return;
        }
        await dependencies.contributionLedger.clear(user, expected: marker);
        if (!_current(revision)) return;
        pending = null;
        status = ContributionStatus.error;
        message =
            'El saldo refleja la carga. Actualiza los datos para continuar.';
      } else {
        final rows = await repository.receipts();
        if (!_current(revision)) return;
        final matches = rows.where(marker.matches).toList();
        if (matches.length == 1) {
          await dependencies.contributionLedger.clear(user, expected: marker);
          if (!_current(revision)) return;
          receipt = matches.single;
          pending = null;
          status = ContributionStatus.success;
          message = 'Se encontró un aporte coincidente en tu historial. Revisa su comprobante.';
        } else {
          message = matches.isEmpty
              ? 'Todavía no aparece un aporte coincidente. Puedes consultar tus comprobantes y volver a comprobar; no se enviará otro aporte.'
              : 'Hay varios aportes coincidentes. Revisa los comprobantes con el responsable del sistema antes de repetir la operación.';
        }
      }
    } catch (e) {
      if (_current(revision)) message = _error(e);
    } finally {
      _loading = false;
      if (_current(revision)) _emit();
    }
  }

  String _error(Object e) => e is ApiException
      ? e.message
      : e is SessionOperationException
      ? 'La sesión cambió. Vuelve a iniciar sesión.'
      : 'No se pudo preparar la operación de forma segura. Actualiza la consulta.';
  @override
  void dispose() {
    _disposed = true;
    _revision++;
    dependencies.session.removeListener(_sessionChanged);
    super.dispose();
  }
}
