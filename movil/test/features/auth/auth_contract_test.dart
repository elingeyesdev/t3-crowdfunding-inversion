import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_client.dart';
import 'package:movil/core/network/api_exception.dart';
import 'package:movil/features/auth/data/auth_repository.dart';
import 'package:movil/features/auth/domain/auth_requests.dart';
import 'package:movil/features/auth/domain/auth_session.dart';
import 'package:movil/features/auth/domain/auth_user.dart';

Map<String, Object?> userFixture() => {
  'id': 'user-test',
  'email': 'test@example.com',
  'roles': ['investor', 'entrepreneur', 'future_role'],
  'phone': null,
  'preferredLanguage': 'es',
  'isActive': true,
  'emailVerified': false,
  'unknown': {'ignored': true},
};

Map<String, Object?> sessionFixture() => {
  'accessToken': '1|synthetic-test-token',
  'tokenType': 'Bearer',
  'expiresIn': '24h',
  'user': userFixture(),
};

Map<String, Object?> envelope(Object? data, [int status = 200]) => {
  'data': data,
  'message': 'Operación exitosa',
  'statusCode': status,
};

void main() {
  test('usuario conserva roles múltiples y desconocidos, omite extras', () {
    final user = AuthUser.fromJson(userFixture());
    expect(user.roles, ['investor', 'entrepreneur', 'future_role']);
    expect(user.phone, isNull);
    expect(user.isActive, isTrue);
    expect(() => user.roles.add('admin'), throwsUnsupportedError);
  });

  test('roles vacíos no inventan investor', () {
    final user = AuthUser.fromJson({...userFixture(), 'roles': <String>[]});
    expect(user.roles, isEmpty);
  });

  for (final entry in <String, Object?>{
    'id': null,
    'email': 42,
    'roles': ['investor', null],
    'phone': false,
    'isActive': 'true',
    'preferredLanguage': 1,
  }.entries) {
    test('usuario rechaza ${entry.key} malformado sin exponer valores', () {
      expect(
        () => AuthUser.fromJson({...userFixture(), entry.key: entry.value}),
        throwsA(
          isA<ApiException>().having(
            (e) => e.kind,
            'kind',
            ApiErrorKind.invalidResponse,
          ),
        ),
      );
    });
  }

  test('registro envuelve exclusivamente usuario; login conserva 24h', () {
    final registered = RegisterResponse.fromJson(envelope(userFixture(), 201));
    expect(registered.user.id, 'user-test');
    final login = LoginResponse.fromJson(envelope(sessionFixture()));
    expect(login.session.expiresIn, '24h');
    expect(login.session.tokenType, 'Bearer');
    expect(login.session.user.roles, contains('future_role'));
    expect(login.toString(), isNot(contains('synthetic-test-token')));
    expect(login.session.toString(), isNot(contains('synthetic-test-token')));
  });

  for (final (index, value) in [
    null,
    [],
    {'data': userFixture()},
    envelope(null),
    envelope(userFixture(), 201),
    {...envelope(sessionFixture()), 'statusCode': 200.0},
  ].indexed) {
    test('login rechaza envoltura inválida $index', () {
      expect(() => LoginResponse.fromJson(value), throwsA(isA<ApiException>()));
    });
  }

  for (final entry in <String, Object?>{
    'accessToken': 'secret\r\nHeader: injected',
    'expiresIn': 86400,
    'tokenType': 'JWT',
    'user': null,
  }.entries) {
    test('sesión rechaza ${entry.key} fuera de contrato', () {
      expect(
        () =>
            AuthSession.fromJson({...sessionFixture(), entry.key: entry.value}),
        throwsA(isA<ApiException>()),
      );
    });
  }

  test('solicitudes no alteran contraseña y no la imprimen', () {
    const login = LoginRequest(
      email: 'test@example.com',
      password: ' Synthetic1 ',
    );
    const register = RegisterRequest(
      email: 'test@example.com',
      password: ' Synthetic1 ',
      phone: '000',
      preferredLanguage: PreferredLanguage.es,
      signupRole: SignupRole.entrepreneur,
    );
    expect(login.toJson()['password'], ' Synthetic1 ');
    expect(register.toJson()['signupRole'], 'entrepreneur');
    expect(register.toJson()['preferredLanguage'], 'es');
    expect(login.toString(), isNot(contains('Synthetic1')));
    expect(register.toString(), isNot(contains('Synthetic1')));
    expect(
      const RegisterRequest(email: 'e', password: 'p').toJson().keys,
      unorderedEquals(['email', 'password']),
    );
  });

  test(
    'repositorio usa rutas relativas y omite Bearer en registro/login',
    () async {
      var providerCalls = 0;
      final paths = <String>[];
      final transport = MockClient((request) async {
        paths.add(request.url.path);
        expect(request.url.origin, 'https://api.example.com');
        expect(request.followRedirects, isFalse);
        final public =
            request.url.path.endsWith('register') ||
            request.url.path.endsWith('login');
        expect(
          request.headers['Authorization'],
          public ? isNull : 'Bearer 1|synthetic',
        );
        if (public) {
          expect(request.method, 'POST');
          expect(jsonDecode(request.body)['password'], 'Synthetic1');
        }
        Object? data = userFixture();
        var status = 200;
        if (request.url.path.endsWith('register')) status = 201;
        if (request.url.path.endsWith('login')) data = sessionFixture();
        if (request.url.path.endsWith('logout')) {
          expect(request.method, 'POST');
          data = null;
        }
        if (request.url.path.endsWith('/me')) expect(request.method, 'GET');
        return http.Response(
          jsonEncode(envelope(data, status)),
          status,
          headers: {'content-type': 'application/json'},
        );
      });
      addTearDown(transport.close);
      final repo = AuthRepository(
        ApiClient(
          client: transport,
          config: AppConfig.fromValues(
            appEnv: 'production',
            apiBaseUrl: 'https://api.example.com/api/v1',
          ),
          tokenProvider: () {
            providerCalls++;
            return '1|synthetic';
          },
        ),
      );
      expect(
        (await repo.register(
          const RegisterRequest(
            email: 'test@example.com',
            password: 'Synthetic1',
          ),
        )).user.id,
        'user-test',
      );
      expect(
        (await repo.login(
          const LoginRequest(email: 'test@example.com', password: 'Synthetic1'),
        )).session.expiresIn,
        '24h',
      );
      expect((await repo.me()).id, 'user-test');
      await repo.logout();
      expect(providerCalls, 2);
      expect(paths, [
        '/api/v1/users/register',
        '/api/v1/auth/login',
        '/api/v1/auth/me',
        '/api/v1/auth/logout',
      ]);
    },
  );

  for (final status in [401, 403, 404, 409, 422, 429]) {
    test('repositorio propaga HTTP $status una sola vez', () async {
      var calls = 0;
      final client = MockClient((_) async {
        calls++;
        return http.Response('{}', status);
      });
      addTearDown(client.close);
      final repo = AuthRepository(
        ApiClient(
          client: client,
          config: AppConfig.fromValues(
            apiBaseUrl: 'https://api.example.com/api/v1',
          ),
        ),
      );
      await expectLater(
        repo.me(),
        throwsA(
          isA<ApiException>().having((e) => e.statusCode, 'HTTP', status),
        ),
      );
      expect(calls, 1);
    });
  }
}
