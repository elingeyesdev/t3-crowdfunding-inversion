import '../domain/auth_user.dart';

enum SessionStatus { guest, checking, authenticated, recoverableError, closing }

enum SessionIssue {
  expired,
  unauthorized,
  storageUnavailable,
  corruptStorage,
  incompatibleStorage,
  apiMismatch,
  network,
  server,
  requestFailed,
  persistenceFailed,
  localDeletionFailed,
}

class SessionState {
  const SessionState(this.status, {this.user, this.issue});
  final SessionStatus status;
  final AuthUser? user;
  final SessionIssue? issue;

  @override
  String toString() => 'SessionState(${status.name}, ${issue?.name})';
}

enum RemoteRevocation { confirmed, rejectedUnauthorized, failed, notAttempted }

class LogoutResult {
  const LogoutResult({required this.remote, required this.localCleared});
  final RemoteRevocation remote;
  final bool localCleared;
}

class SessionOperationException implements Exception {
  const SessionOperationException();

  @override
  String toString() => 'La operación no pertenece a una sesión válida.';
}
