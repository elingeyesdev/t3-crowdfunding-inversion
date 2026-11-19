import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/storage/secure_session_store.dart';
import 'package:movil/core/storage/session_store.dart';

// Simula el límite cifrado; no pretende verificar criptografía Android.
class FakeEncryptedBackend implements EncryptedSessionBackend {
  final values = <String, String>{};
  bool fail = false;
  void check() {
    if (fail) throw StateError('synthetic-secret token trace');
  }

  @override
  Future<String?> read(String key) async {
    check();
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    check();
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    check();
    values.remove(key);
  }
}

StoredSession storedFixture() => StoredSession(
  accessToken: '1|synthetic',
  apiIdentity: 'production|https://api.example.com/api/v1/',
  issuedAt: DateTime.utc(2026, 11, 16, 12),
);

void main() {
  test(
    'guardar, leer y eliminar exclusivamente la credencial propia',
    () async {
      final backend = FakeEncryptedBackend();
      backend.values['other'] = 'untouched';
      final store = SecureSessionStore(backend: backend);
      expect(await store.read(), isNull);
      await store.write(storedFixture());
      final read = (await store.read())!;
      expect(read.accessToken, '1|synthetic');
      expect(read.apiIdentity, storedFixture().apiIdentity);
      expect(read.issuedAt, DateTime.utc(2026, 11, 16, 12));
      expect(read.expiresAt, DateTime.utc(2026, 11, 17, 12));
      final json = jsonDecode(backend.values[SecureSessionStore.storageKey]!);
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
      expect(read.toString(), isNot(contains('synthetic')));
      await store.delete();
      expect(await store.read(), isNull);
      expect(backend.values, {'other': 'untouched'});
    },
  );

  for (final operation in ['read', 'write', 'delete']) {
    test('fallo $operation no revela secretos ni trazas', () async {
      final backend = FakeEncryptedBackend()..fail = true;
      final store = SecureSessionStore(backend: backend);
      try {
        switch (operation) {
          case 'read':
            await store.read();
          case 'write':
            await store.write(storedFixture());
          case 'delete':
            await store.delete();
        }
        fail('Debe fallar');
      } on SessionStoreException catch (error) {
        expect(error.kind, SessionStoreError.unavailable);
        expect(error.toString(), isNot(contains('synthetic')));
        expect(error.toString(), isNot(contains('trace')));
      }
    });
  }

  for (final (index, bad) in [
    '{secret',
    'null',
    '[]',
    '',
    'x' * 8193,
    jsonEncode({
      ...jsonDecode(storedFixture().encode()) as Map,
      'accessToken': null,
    }),
    jsonEncode({
      ...jsonDecode(storedFixture().encode()) as Map,
      'expiresAt': '2026-11-18T12:00:00.000Z',
    }),
  ].indexed) {
    test(
      'rechaza almacenamiento corrupto $index sin borrar implícitamente',
      () async {
        final backend = FakeEncryptedBackend();
        backend.values[SecureSessionStore.storageKey] = bad;
        final store = SecureSessionStore(backend: backend);
        await expectLater(
          store.read(),
          throwsA(
            isA<SessionStoreException>().having(
              (e) => e.kind,
              'kind',
              SessionStoreError.corrupt,
            ),
          ),
        );
        expect(backend.values[SecureSessionStore.storageKey], bad);
      },
    );
  }

  for (final entry in {'formatVersion': 2, 'tokenType': 'JWT'}.entries) {
    test('rechaza formato incompatible ${entry.key}', () async {
      final backend = FakeEncryptedBackend();
      backend.values[SecureSessionStore.storageKey] = jsonEncode({
        ...jsonDecode(storedFixture().encode()) as Map,
        entry.key: entry.value,
      });
      await expectLater(
        SecureSessionStore(backend: backend).read(),
        throwsA(
          isA<SessionStoreException>().having(
            (e) => e.kind,
            'kind',
            SessionStoreError.incompatible,
          ),
        ),
      );
    });
  }

  test('identidad separa API y entorno sin asumir configuración', () {
    final production = AppConfig.fromValues(
      appEnv: 'production',
      apiBaseUrl: 'https://api.example.com/api/v1',
    );
    final development = AppConfig.fromValues(
      apiBaseUrl: 'https://api.example.com/api/v1',
    );
    expect(
      StoredSession.identityFor(production),
      isNot(StoredSession.identityFor(development)),
    );
    expect(
      () => StoredSession.identityFor(AppConfig.fromValues()),
      throwsA(isA<SessionStoreException>()),
    );
  });

  test('vencimiento en el límite de 24 horas es inclusivo', () {
    final stored = storedFixture();
    expect(
      stored.isExpired(
        stored.expiresAt.subtract(const Duration(microseconds: 1)),
      ),
      isFalse,
    );
    expect(stored.isExpired(stored.expiresAt), isTrue);
  });
}
