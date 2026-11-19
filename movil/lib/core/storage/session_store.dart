import 'dart:convert';

import '../config/app_config.dart';

enum SessionStoreError { unavailable, corrupt, incompatible }

class SessionStoreException implements Exception {
  const SessionStoreException(this.kind);
  final SessionStoreError kind;

  @override
  String toString() => 'SessionStoreException(${kind.name})';
}

/// Credencial mínima. No contiene usuario, perfil ni contraseña.
class StoredSession {
  StoredSession({
    required this.accessToken,
    required this.apiIdentity,
    required DateTime issuedAt,
  }) : issuedAt = issuedAt.toUtc(),
       expiresAt = issuedAt.toUtc().add(const Duration(hours: 24)) {
    if (!RegExp(r'^[A-Za-z0-9\-._~+/|]+=*$').hasMatch(accessToken) ||
        accessToken.length > 4096 ||
        apiIdentity.isEmpty ||
        apiIdentity.length > 2048) {
      throw const SessionStoreException(SessionStoreError.corrupt);
    }
  }

  final String accessToken;
  final String apiIdentity;
  final DateTime issuedAt;
  final DateTime expiresAt;

  static String identityFor(AppConfig config) {
    if (config.apiBaseUrl == null) {
      throw const SessionStoreException(SessionStoreError.incompatible);
    }
    return '${config.environment.name}|${config.apiBaseUrl}';
  }

  bool isExpired(DateTime now) => !now.toUtc().isBefore(expiresAt);

  String encode() => jsonEncode({
    'formatVersion': 1,
    'apiIdentity': apiIdentity,
    'accessToken': accessToken,
    'tokenType': 'Bearer',
    'issuedAt': issuedAt.toIso8601String(),
    'expiresAt': expiresAt.toIso8601String(),
  });

  static StoredSession decode(String source) {
    try {
      if (source.length > 8192) {
        throw const SessionStoreException(SessionStoreError.corrupt);
      }
      final value = jsonDecode(source);
      if (value is! Map<String, dynamic>) {
        throw const SessionStoreException(SessionStoreError.corrupt);
      }
      if (value['formatVersion'] != 1 || value['formatVersion'] is! int) {
        throw const SessionStoreException(SessionStoreError.incompatible);
      }
      if (value['tokenType'] != 'Bearer') {
        throw const SessionStoreException(SessionStoreError.incompatible);
      }
      final token = value['accessToken'];
      final identity = value['apiIdentity'];
      final issued = value['issuedAt'];
      final expires = value['expiresAt'];
      if (token is! String ||
          identity is! String ||
          issued is! String ||
          expires is! String ||
          !issued.endsWith('Z') ||
          !expires.endsWith('Z')) {
        throw const SessionStoreException(SessionStoreError.corrupt);
      }
      final session = StoredSession(
        accessToken: token,
        apiIdentity: identity,
        issuedAt: DateTime.parse(issued),
      );
      if (session.expiresAt != DateTime.parse(expires)) {
        throw const SessionStoreException(SessionStoreError.corrupt);
      }
      return session;
    } on SessionStoreException {
      rethrow;
    } catch (_) {
      throw const SessionStoreException(SessionStoreError.corrupt);
    }
  }

  @override
  String toString() => 'StoredSession(redacted)';
}

abstract interface class SessionStore {
  Future<StoredSession?> read();
  Future<void> write(StoredSession session);
  Future<void> delete();
}
