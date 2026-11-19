import 'session_store.dart';

/// Límite inyectable del almacenamiento cifrado. La implementación de plataforma
/// está en flutter_encrypted_session_backend.dart; los tests pueden simularlo.
/// No se ofrece fallback a archivos/preferencias sin cifrar.
abstract interface class EncryptedSessionBackend {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// Adaptador de formato y errores; el cifrado lo aporta el backend inyectado.
/// No es un motor criptográfico ni activa persistencia por sí mismo.
class SecureSessionStore implements SessionStore {
  const SecureSessionStore({required this._backend});

  static const storageKey = 'unifundme.session';
  final EncryptedSessionBackend _backend;

  @override
  Future<StoredSession?> read() async {
    String? value;
    try {
      value = await _backend.read(storageKey);
    } catch (_) {
      throw const SessionStoreException(SessionStoreError.unavailable);
    }
    return value == null ? null : StoredSession.decode(value);
  }

  @override
  Future<void> write(StoredSession session) async {
    try {
      await _backend.write(storageKey, session.encode());
    } catch (_) {
      throw const SessionStoreException(SessionStoreError.unavailable);
    }
  }

  @override
  Future<void> delete() async {
    try {
      // Solo la credencial de UniFundMe; nunca deleteAll del dispositivo.
      await _backend.delete(storageKey);
    } catch (_) {
      throw const SessionStoreException(SessionStoreError.unavailable);
    }
  }
}
