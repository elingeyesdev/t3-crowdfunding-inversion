import 'dart:io';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:movil/core/storage/secure_session_store.dart';
import 'package:movil/core/storage/session_store.dart';

// Sin namespace/prefijo personalizado ni cambio de algoritmos/archivos.
// Solo el test desactiva recuperaciones que podrían modificar datos ajenos.
const _testOptions = AndroidOptions(
  resetOnError: false,
  migrateOnAlgorithmChange: false,
);

FlutterSecureStorage _newStorage() =>
    const FlutterSecureStorage(aOptions: _testOptions);

String _nonce() {
  final random = Random.secure();
  return List.generate(
    32,
    (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'),
  ).join();
}

/// Solo existe en integration_test. Redirige la clave fija de SessionStore a
/// una clave exclusiva sin leer, sobrescribir ni borrar unifundme.session.
/// Usa el plugin NATIVO, sin mocks, conservando opciones de recuperación seguras.
class _IsolatedPluginBackend implements EncryptedSessionBackend {
  _IsolatedPluginBackend(this.storage, this.testKey);
  final FlutterSecureStorage storage;
  final String testKey;

  void _checkKey(String key) {
    if (key != SecureSessionStore.storageKey) {
      throw const SessionStoreException(SessionStoreError.incompatible);
    }
  }

  @override
  Future<String?> read(String key) async {
    _checkKey(key);
    return storage.read(key: testKey, aOptions: _testOptions);
  }

  @override
  Future<void> write(String key, String value) async {
    _checkKey(key);
    await storage.write(key: testKey, value: value, aOptions: _testOptions);
  }

  @override
  Future<void> delete(String key) async {
    _checkKey(key);
    await storage.delete(key: testKey, aOptions: _testOptions);
  }
}

/// El cleanup elimina únicamente una clave cuya ausencia comprobó el test.
/// Los fallos se publican sin valores, claves ni detalles de excepciones nativas.
Future<void> _withExclusiveKey(
  Future<void> Function(FlutterSecureStorage storage, String key) operation,
) async {
  final storage = _newStorage();
  final key = 'unifundme.integration.secure_storage.${_nonce()}';
  var owned = false;
  var cleanupFailed = false;
  try {
    if (await storage.containsKey(key: key, aOptions: _testOptions)) {
      throw TestFailure(
        'Colisión de clave: prueba detenida sin modificar datos.',
      );
    }
    owned = true;
    await operation(storage, key);
  } on TestFailure {
    rethrow;
  } catch (_) {
    throw TestFailure(
      'Falló una operación del plugin/canal nativo. No se muestran sus detalles.',
    );
  } finally {
    if (owned) {
      try {
        await storage.delete(key: key, aOptions: _testOptions);
        cleanupFailed = await storage.containsKey(
          key: key,
          aOptions: _testOptions,
        );
      } catch (_) {
        cleanupFailed = true;
      }
      if (cleanupFailed) {
        throw TestFailure(
          'No se pudo confirmar la limpieza de la clave sintética.',
        );
      }
    }
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    if (!Platform.isAndroid) {
      throw TestFailure('Esta prueba requiere un dispositivo Android real.');
    }
  });

  testWidgets('Plugin Android real: escritura, otra instancia y eliminación', (
    _,
  ) async {
    await _withExclusiveKey((storage, key) async {
      final synthetic = 'integration-only-${_nonce()}';
      await storage.write(key: key, value: synthetic, aOptions: _testOptions);
      // Comparaciones booleanas: un fallo nunca imprime el contenido almacenado.
      expect(
        await storage.read(key: key, aOptions: _testOptions) == synthetic,
        isTrue,
        reason: 'La primera lectura no coincide.',
      );
      // new (no const) obtiene una instancia Dart distinta. El proceso y el
      // servicio nativo siguen siendo los mismos: NO verifica reinicio de app.
      final another = FlutterSecureStorage(aOptions: _testOptions);
      expect(identical(storage, another), isFalse);
      expect(
        await another.read(key: key, aOptions: _testOptions) == synthetic,
        isTrue,
        reason: 'La lectura desde otra instancia no coincide.',
      );
      await storage.delete(key: key, aOptions: _testOptions);
      expect(
        await another.read(key: key, aOptions: _testOptions) == null,
        isTrue,
        reason: 'El valor eliminado sigue disponible.',
      );
    });
  });

  testWidgets(
    'SecureSessionStore sobre plugin Android real con clave aislada',
    (_) async {
      await _withExclusiveKey((storage, key) async {
        final first = SecureSessionStore(
          backend: _IsolatedPluginBackend(storage, key),
        );
        final synthetic = StoredSession(
          accessToken: 'integration-only-${_nonce()}',
          apiIdentity: 'integration-test|https://storage-test.invalid/api/v1/',
          issuedAt: DateTime.now().toUtc(),
        );
        expect(await first.read() == null, isTrue);
        await first.write(synthetic);
        final second = SecureSessionStore(
          backend: _IsolatedPluginBackend(
            FlutterSecureStorage(aOptions: _testOptions),
            key,
          ),
        );
        final recovered = await second.read();
        expect(
          recovered != null,
          isTrue,
          reason: 'No se recuperó la sesión sintética.',
        );
        expect(recovered?.accessToken == synthetic.accessToken, isTrue);
        expect(recovered?.apiIdentity == synthetic.apiIdentity, isTrue);
        expect(recovered?.issuedAt == synthetic.issuedAt, isTrue);
        expect(recovered?.expiresAt == synthetic.expiresAt, isTrue);
        await first.delete();
        expect(
          await second.read() == null,
          isTrue,
          reason: 'La sesión sintética eliminada sigue disponible.',
        );
      });
    },
  );
}
