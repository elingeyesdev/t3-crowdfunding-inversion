import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'secure_session_store.dart';
import 'session_store.dart';

/// Backend real de plataforma; en Android el plugin cifra usando Keystore.
/// Los AndroidOptions por defecto se fuerzan en cada operación para conservar
/// los nombres excluidos en backup_rules.xml y data_extraction_rules.xml.
class FlutterEncryptedSessionBackend implements EncryptedSessionBackend {
  const FlutterEncryptedSessionBackend();

  static const _androidOptions = AndroidOptions();
  static const _storage = FlutterSecureStorage(aOptions: _androidOptions);

  Future<T> _guard<T>(Future<T> Function() operation) async {
    try {
      return await operation();
    } catch (_) {
      // No conserva PlatformException, detalles nativos, tokens ni trazas.
      throw const SessionStoreException(SessionStoreError.unavailable);
    }
  }

  @override
  Future<String?> read(String key) =>
      _guard(() => _storage.read(key: key, aOptions: _androidOptions));

  @override
  Future<void> write(String key, String value) => _guard(
    () => _storage.write(key: key, value: value, aOptions: _androidOptions),
  );

  @override
  Future<void> delete(String key) =>
      _guard(() => _storage.delete(key: key, aOptions: _androidOptions));

  @override
  String toString() => 'FlutterEncryptedSessionBackend()';
}

/// Composición explícita, sin iniciar Flutter ni acceder al disco al construir.
/// Invocar las operaciones después de inicializar los bindings de Flutter.
SecureSessionStore createPlatformSessionStore() =>
    const SecureSessionStore(backend: FlutterEncryptedSessionBackend());
