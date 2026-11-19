import '../../../core/network/api_exception.dart';
import '../application/session_state.dart';

abstract final class AuthMessages {
  static String error(Object error, {bool login = false}) {
    if (error is! ApiException) {
      return 'No se pudo completar la operación. Inténtalo de nuevo.';
    }
    if (login && error.statusCode == 401) {
      return 'No se pudo iniciar sesión. Revisa tus credenciales o el estado de tu cuenta.';
    }
    if (error.statusCode == 429) {
      final seconds = error.retryAfter?.delay?.inSeconds;
      return seconds == null
          ? 'Demasiados intentos. Espera antes de volver a intentar.'
          : 'Demasiados intentos. Espera $seconds segundos antes de volver a intentar.';
    }
    return error.message;
  }

  static String issue(SessionIssue? issue) => switch (issue) {
    SessionIssue.expired => 'Tu sesión expiró. Inicia sesión nuevamente.',
    SessionIssue.unauthorized =>
      'La sesión dejó de ser válida. Inicia sesión nuevamente.',
    SessionIssue.network =>
      'No se pudo validar la sesión por un problema de conexión.',
    SessionIssue.server =>
      'El servicio no pudo validar la sesión en este momento.',
    SessionIssue.apiMismatch => 'La sesión guardada pertenece a otro entorno.',
    SessionIssue.localDeletionFailed => 'No se pudieron eliminar las credenciales locales. El acceso privado está bloqueado.',
    SessionIssue.persistenceFailed =>
      'No se pudo guardar la sesión de forma segura.',
    SessionIssue.storageUnavailable ||
    SessionIssue.corruptStorage ||
    SessionIssue.incompatibleStorage =>
      'No se pudo recuperar la sesión guardada de forma segura.',
    _ => 'No se pudo validar la sesión. Puedes volver a intentarlo.',
  };

  static String logout(LogoutResult result) {
    if (!result.localCleared) {
      final remote = switch (result.remote) {
        RemoteRevocation.confirmed => 'La revocación remota fue confirmada.',
        RemoteRevocation.rejectedUnauthorized =>
          'El servidor rechazó el token; no se confirmó una revocación nueva.',
        RemoteRevocation.failed => 'No se pudo confirmar la revocación remota.',
        RemoteRevocation.notAttempted => 'No se solicitó revocación remota.',
      };
      return 'No se confirmó la limpieza local. El acceso privado sigue bloqueado. $remote';
    }
    return switch (result.remote) {
      RemoteRevocation.confirmed =>
        'Sesión cerrada y revocación remota confirmada.',
      RemoteRevocation.rejectedUnauthorized => 'Sesión local cerrada. El servidor rechazó el token; no se confirmó una revocación nueva.',
      RemoteRevocation.failed =>
        'Sesión local cerrada. No se pudo confirmar la revocación remota.',
      RemoteRevocation.notAttempted =>
        'Credenciales locales eliminadas. No se solicitó revocación remota.',
    };
  }
}
