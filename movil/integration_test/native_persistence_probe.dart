// Entrypoint instrumental exclusivo del Paso 90. No usa main.dart ni el router.
// Compilar una sola vez y lanzar /fase3/<runId>/write, read o cleanup mediante ADB.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/material.dart';
import 'package:movil/core/storage/flutter_encrypted_session_backend.dart';
import 'package:movil/core/storage/session_store.dart';

const _enabled = bool.fromEnvironment('F3_PROBE_ENABLED');
const _runId = String.fromEnvironment('F3_PROBE_RUN_ID');
const _issuedAtMs = int.fromEnvironment('F3_PROBE_ISSUED_AT_MS');
const _package = 'com.unifoundme.movil';
const _root =
    '/data/user/0/$_package'; // El coordinador exige usuario Android 0.
final _status = File('$_root/files/unifundme_fase3_probe/status.json');
final _receipt = File('$_root/files/unifundme_fase3_probe/write_receipt.json');

class _ProbeFailure implements Exception {
  const _ProbeFailure();
}

void _require(bool condition) {
  if (!condition) throw const _ProbeFailure();
}

StoredSession _fixture() => StoredSession(
  accessToken: 'fase3-synthetic-$_runId',
  apiIdentity: 'fase3-persistence-probe|$_runId',
  issuedAt: DateTime.fromMillisecondsSinceEpoch(_issuedAtMs, isUtc: true),
);

bool _matches(StoredSession? session) {
  final expected = _fixture();
  return session != null &&
      session.accessToken == expected.accessToken &&
      session.apiIdentity == expected.apiIdentity &&
      session.issuedAt == expected.issuedAt &&
      session.expiresAt == expected.expiresAt;
}

Future<void> _writeMetadata(File file, String stage) async {
  await file.parent.create(recursive: true);
  await file.writeAsString(
    jsonEncode({'runId': _runId, 'stage': stage, 'pid': pid}),
    flush: true,
  );
}

Future<String> _property(String name) async {
  final result = await Process.run('/system/bin/getprop', [name]);
  _require(result.exitCode == 0);
  return (result.stdout as String).trim();
}

Future<void> _guardEnvironment() async {
  _require(_enabled && Platform.isAndroid);
  _require(RegExp(r'^[a-f0-9]{32}$').hasMatch(_runId) && _issuedAtMs > 0);
  _require(await Directory(_root).exists());
  final qemu = await _property('ro.kernel.qemu');
  final bootQemu = await _property('ro.boot.qemu');
  _require(qemu == '1' || bootQemu == '1');
  _require(await _property('ro.build.version.sdk') == '36');
  _require(await _property('ro.product.cpu.abi') == 'x86_64');
  // El nombre obligatorio se valida además con `adb emu avd name` en el host.
  for (final name in ['ro.boot.qemu.avd_name', 'ro.kernel.qemu.avd_name']) {
    final value = await _property(name);
    _require(value.isEmpty || value == 'UniFundMe_Fase3_Test');
  }
}

Future<void> _requirePristineStore() async {
  // ANTES de inicializar el plugin predeterminado: no arriesgar recuperación
  // automática sobre claves o credenciales existentes, ni siquiera sintéticas.
  const names = [
    'FlutterSecureStorage',
    'FlutterSecureKeyStorage',
    'FlutterSecureStorageConfiguration:FlutterSecureStorage',
    'FlutterSecureStorageConfiguration',
  ];
  for (final name in names) {
    for (final suffix in ['.xml', '.xml.bak']) {
      _require(!await File('$_root/shared_prefs/$name$suffix').exists());
    }
  }
}

Future<void> _cleanupOwnedFixture() async {
  final ownership = jsonDecode(await _receipt.readAsString());
  _require(
    ownership is Map &&
        ownership['runId'] == _runId &&
        (ownership['stage'] == 'owned' ||
            ownership['stage'] == 'write_verified'),
  );
  final store = createPlatformSessionStore();
  final existing = await store.read();
  if (existing == null) return;
  _require(_matches(existing)); // Nunca eliminar una sesión desconocida.
  await store.delete();
  _require(await createPlatformSessionStore().read() == null);
}

Future<String> _execute() async {
  await _guardEnvironment();
  final route = Uri.tryParse(PlatformDispatcher.instance.defaultRouteName);
  final segments = route?.pathSegments ?? [];
  _require(
    segments.length == 3 && segments[0] == 'fase3' && segments[1] == _runId,
  );
  final mode = segments[2];
  _require(mode == 'write' || mode == 'read' || mode == 'cleanup');

  if (mode == 'write') {
    await _requirePristineStore();
    await _writeMetadata(_status, 'write_starting');
    final store = createPlatformSessionStore();
    _require(await store.read() == null);
    await _writeMetadata(_receipt, 'owned');
    try {
      await store.write(_fixture());
      _require(_matches(await store.read()));
      await _writeMetadata(_receipt, 'write_verified');
      await _writeMetadata(_status, 'write_verified');
      // Intencional: conservar la credencial hasta el siguiente PROCESO.
      return 'Etapa A verificada. Esperando terminación del proceso.';
    } catch (_) {
      await _cleanupOwnedFixture();
      rethrow;
    }
  }

  if (mode == 'read') {
    final previous = jsonDecode(await _receipt.readAsString());
    _require(
      previous is Map &&
          previous['runId'] == _runId &&
          previous['stage'] == 'write_verified' &&
          previous['pid'] is int &&
          previous['pid'] != pid,
    );
    await _writeMetadata(_status, 'read_starting');
    try {
      final store = createPlatformSessionStore(); // Nueva instancia/proceso.
      _require(_matches(await store.read()));
    } finally {
      await _cleanupOwnedFixture();
    }
    await _writeMetadata(_status, 'read_verified_cleaned');
    return 'Etapa B verificada y credencial sintética eliminada.';
  }

  // Recuperación de una ejecución interrumpida: no equivale a prueba superada.
  await _cleanupOwnedFixture();
  await _writeMetadata(_status, 'cleanup_verified');
  return 'Limpieza verificada. Esto no confirma persistencia.';
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final message = ValueNotifier(
    'Sonda instrumental de persistencia de Fase 3.',
  );
  runApp(
    MaterialApp(
      initialRoute:
          '/', // La ruta del Intent solo selecciona la etapa de la sonda.
      home: Scaffold(
        body: SafeArea(
          child: Center(
            child: ValueListenableBuilder<String>(
              valueListenable: message,
              builder: (_, value, _) =>
                  Text(value, textAlign: TextAlign.center),
            ),
          ),
        ),
      ),
    ),
  );
  try {
    message.value = await _execute();
  } catch (_) {
    // Nunca publicar la excepción nativa, el contenido leído ni el token.
    message.value = 'Prueba detenida. No se confirma persistencia.';
    if (_enabled &&
        Platform.isAndroid &&
        RegExp(r'^[a-f0-9]{32}$').hasMatch(_runId)) {
      try {
        await _writeMetadata(_status, 'failed');
      } catch (_) {
        /* sin logs */
      }
    }
  }
}
