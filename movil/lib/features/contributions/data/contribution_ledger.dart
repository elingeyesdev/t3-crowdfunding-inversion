import 'dart:convert';
import 'dart:math';

import '../../../core/storage/secure_session_store.dart';
import '../../auth/domain/api_contract.dart';
import '../domain/contribution.dart';

class PendingContribution {
  PendingContribution({
    required this.campaignId,
    required this.amount,
    required this.currency,
    required Set<String> before,
    this.rewardId,
    this.capital = false,
    this.capitalLimit = 0,
    String? nonce,
  }) : before = Set.unmodifiable(before),
       nonce =
           nonce ??
           '${DateTime.now().microsecondsSinceEpoch}-${Random.secure().nextInt(1 << 32)}';
  factory PendingContribution.decode(String encoded) {
    final j = ApiContract.object(jsonDecode(encoded));
    final ids = j['before'];
    if (j['version'] != 1 ||
        ids is! List ||
        ids.length > 20000 ||
        j['amount'] is! int ||
        j['capital'] is! bool ||
        j['capitalLimit'] is! int ||
        (j['amount'] as int) < 1 ||
        (j['amount'] as int) > Money.max ||
        (j['capitalLimit'] as int) < 0) {
      ApiContract.invalid();
    }
    return PendingContribution(
      campaignId: contributionId(j['campaignId']),
      amount: j['amount'] as int,
      currency: ApiContract.string(j, 'currency'),
      rewardId: j['rewardId'] == null ? null : contributionId(j['rewardId']),
      before: ids.map(contributionId).toSet(),
      capital: j['capital'] as bool,
      capitalLimit: j['capitalLimit'] as int,
      nonce: ApiContract.string(j, 'nonce'),
    );
  }
  final String campaignId, currency;
  final String? rewardId;
  final int amount, capitalLimit;
  final Set<String> before;
  final bool capital;
  final String nonce;
  String encode() => jsonEncode({
    'version': 1,
    'campaignId': campaignId,
    'amount': amount,
    'currency': currency,
    'rewardId': rewardId,
    'before': before.toList(),
    'capital': capital,
    'capitalLimit': capitalLimit,
    'nonce': nonce,
  });
  bool matches(ContributionReceipt r) =>
      !capital &&
      !before.contains(r.id) &&
      r.campaignId == campaignId &&
      r.amount == amount &&
      r.currency == currency &&
      r.rewardId == rewardId &&
      r.status == 'completed';
}

/// Marcador cifrado por API/cuenta, independiente de la credencial.
/// Se escribe ANTES del POST y no se elimina al cerrar sesión.
class ContributionLedger {
  ContributionLedger(this.backend, this.apiIdentity);
  final EncryptedSessionBackend backend;
  final String apiIdentity;
  Future<void> _tail = Future.value();
  String _key(String user) =>
      'unifundme.contribution.v1.${base64Url.encode(utf8.encode('$apiIdentity|$user'))}';
  Future<T> _serial<T>(Future<T> Function() operation) {
    final result = _tail.then((_) => operation());
    _tail = result.then<void>((_) {}, onError: (Object _, StackTrace _) {});
    return result;
  }

  Future<PendingContribution?> _read(String user) async {
    final raw = await backend.read(_key(user));
    return raw == null ? null : PendingContribution.decode(raw);
  }

  Future<PendingContribution?> read(String user) => _serial(() => _read(user));
  Future<void> begin(String user, PendingContribution pending) =>
      _serial(() async {
        if (await _read(user) != null) {
          throw StateError('Existe una operación pendiente.');
        }
        await backend.write(_key(user), pending.encode());
      });
  Future<void> clear(String user, {PendingContribution? expected}) =>
      _serial(() async {
        if (expected != null && (await _read(user))?.nonce != expected.nonce) {
          return;
        }
        await backend.delete(_key(user));
      });
}
