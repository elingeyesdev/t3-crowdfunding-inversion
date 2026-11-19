import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:movil/core/storage/flutter_encrypted_session_backend.dart';
import 'package:movil/core/storage/secure_session_store.dart';
import 'package:movil/core/storage/session_store.dart';

// Se simula el canal oficial; no verifica Android Keystore ni el cifrado nativo.
class StubBackend implements EncryptedSessionBackend {
  String? value;
  @override
  Future<String?> read(String key) async => value;
  @override
  Future<void> write(String key, String value) async => this.value = value;
  @override
  Future<void> delete(String key) async => value = null;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  const backend = FlutterEncryptedSessionBackend();
  final values = <String, String>{};
  final calls = <MethodCall>[];
  String? failingMethod;
  Object? nativeRead;

  StoredSession fixture() => StoredSession(
    accessToken: '1|synthetic-token',
    apiIdentity: 'production|https://api.example.com/api/v1/',
    issuedAt: DateTime.utc(2026, 11, 16),
  );

  setUp(() {
    debugDefaultTargetPlatformOverride = TargetPlatform.android;
    values.clear();
    calls.clear();
    failingMethod = null;
    nativeRead = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
          calls.add(call);
          if (call.method == failingMethod) {
            throw PlatformException(
              code: 'native-secret',
              message: 'synthetic-token',
              details: {
                'trace': 'private-native-path',
                'password': 'synthetic-password',
              },
            );
          }
          final args = call.arguments as Map;
          final key = args['key'] as String;
          switch (call.method) {
            case 'read':
              return nativeRead ?? values[key];
            case 'write':
              values[key] = args['value'] as String;
              return null;
            case 'delete':
              values.remove(key);
              return null;
            default:
              throw MissingPluginException('Unexpected method');
          }
        });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
    debugDefaultTargetPlatformOverride = null;
  });

  test('construcción de backend y store no accede al canal', () {
    expect(createPlatformSessionStore(), isA<SecureSessionStore>());
    expect(backend.toString(), 'FlutterEncryptedSessionBackend()');
    expect(calls, isEmpty);
  });

  test(
    'backend real delega lectura, escritura y eliminación al canal',
    () async {
      expect(await backend.read('test'), isNull);
      await backend.write('test', 'synthetic-value');
      expect(await backend.read('test'), 'synthetic-value');
      await backend.delete('test');
      expect(await backend.read('test'), isNull);
      expect(calls.map((c) => c.method), [
        'read',
        'write',
        'read',
        'delete',
        'read',
      ]);
    },
  );

  test(
    'cada operación mantiene AndroidOptions sin namespace ni nuevos almacenes',
    () async {
      await backend.write('test', 'synthetic-value');
      await backend.read('test');
      await backend.delete('test');
      for (final call in calls) {
        final options = (call.arguments as Map)['options'] as Map;
        expect(options['storageNamespace'], '');
        expect(options.containsKey('sharedPreferencesName'), isFalse);
        expect(options['preferencesKeyPrefix'], '');
        expect(options['migrateWithBackup'], 'false');
        expect(options['enforceBiometrics'], 'false');
        expect(options['requireBiometricsPerOperation'], 'false');
        expect(
          options['keyCipherAlgorithm'],
          'RSA_ECB_OAEPwithSHA_256andMGF1Padding',
        );
        expect(options['storageCipherAlgorithm'], 'AES_GCM_NoPadding');
      }
    },
  );

  test(
    'composición conserva el formato mínimo de SecureSessionStore',
    () async {
      final store = createPlatformSessionStore();
      await store.write(fixture());
      final encoded = values[SecureSessionStore.storageKey]!;
      final json = jsonDecode(encoded) as Map;
      expect(
        json.keys,
        unorderedEquals([
          'formatVersion',
          'apiIdentity',
          'accessToken',
          'tokenType',
          'issuedAt',
          'expiresAt',
        ]),
      );
      final restored = (await store.read())!;
      expect(restored.accessToken, fixture().accessToken);
      expect(restored.apiIdentity, fixture().apiIdentity);
      expect(restored.expiresAt, fixture().expiresAt);
      await store.delete();
      expect(values, isEmpty);
    },
  );

  test(
    'datos ausentes no se sustituyen ni se escriben en otro almacén',
    () async {
      expect(await createPlatformSessionStore().read(), isNull);
      expect(calls.map((c) => c.method), ['read']);
      expect(values, isEmpty);
    },
  );

  test(
    'datos corruptos producen error de formato sin borrado automático Dart',
    () async {
      values[SecureSessionStore.storageKey] = '{synthetic-secret';
      await expectLater(
        createPlatformSessionStore().read(),
        throwsA(
          isA<SessionStoreException>().having(
            (e) => e.kind,
            'kind',
            SessionStoreError.corrupt,
          ),
        ),
      );
      expect(calls.map((c) => c.method), ['read']);
      expect(values.length, 1);
    },
  );

  for (final method in ['read', 'write', 'delete']) {
    test('backend sanitiza PlatformException de $method', () async {
      failingMethod = method;
      final Future<void> Function() operation = switch (method) {
        'read' => () async {
          await backend.read('test');
        },
        'write' => () => backend.write('test', 'synthetic-token'),
        _ => () => backend.delete('test'),
      };
      await expectLater(
        operation(),
        throwsA(
          isA<SessionStoreException>()
              .having((e) => e.kind, 'kind', SessionStoreError.unavailable)
              .having(
                (e) => e.toString(),
                'safe',
                allOf(
                  isNot(contains('synthetic')),
                  isNot(contains('private-native-path')),
                  isNot(contains('native-secret')),
                ),
              ),
        ),
      );
      expect(calls.length, 1);
      expect(values, isEmpty);
    });

    test(
      'SecureSessionStore propaga error seguro de $method sin fallback',
      () async {
        failingMethod = method;
        final store = createPlatformSessionStore();
        final Future<void> Function() operation = switch (method) {
          'read' => () async {
            await store.read();
          },
          'write' => () => store.write(fixture()),
          _ => store.delete,
        };
        await expectLater(
          operation(),
          throwsA(
            isA<SessionStoreException>().having(
              (e) => e.kind,
              'kind',
              SessionStoreError.unavailable,
            ),
          ),
        );
        expect(calls.length, 1);
        expect(values, isEmpty);
      },
    );
  }

  test(
    'plugin ausente falla de forma segura sin crear almacenamiento alternativo',
    () async {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null);
      await expectLater(
        backend.read('test'),
        throwsA(
          isA<SessionStoreException>().having(
            (e) => e.kind,
            'kind',
            SessionStoreError.unavailable,
          ),
        ),
      );
      expect(values, isEmpty);
    },
  );

  test('respuesta nativa con tipo inesperado se sanitiza', () async {
    nativeRead = 42;
    await expectLater(
      backend.read('test'),
      throwsA(
        isA<SessionStoreException>().having(
          (e) => e.kind,
          'kind',
          SessionStoreError.unavailable,
        ),
      ),
    );
  });

  test('la inyección simulada existente no utiliza el canal', () async {
    final simulated = StubBackend();
    final store = SecureSessionStore(backend: simulated);
    await store.write(fixture());
    expect((await store.read())!.accessToken, fixture().accessToken);
    await store.delete();
    expect(calls, isEmpty);
  });
}
