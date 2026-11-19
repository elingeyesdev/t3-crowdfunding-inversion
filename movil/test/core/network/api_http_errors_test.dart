import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_client.dart';
import 'package:movil/core/network/api_exception.dart';

void main() {
  test(
    '422 conserva campos conocidos y sanitiza TODOS los textos remotos',
    () async {
      const secret = 'password-secret 12|token-secret /server/trace';
      final client = MockClient(
        (_) async => http.Response(
          jsonEncode({
            'message': [secret],
            'errors': {
              'email': [secret],
              'password': [secret],
              'displayName': ['Taken'],
              secret: ['Bad'],
              'bio': 123,
              'city': [],
            },
            'trace': secret,
            'accessToken': secret,
          }),
          422,
          headers: {'content-type': 'application/json'},
        ),
      );
      addTearDown(client.close);
      final api = ApiClient(
        client: client,
        config: AppConfig.fromValues(
          apiBaseUrl: 'https://api.example.com/api/v1',
        ),
      );
      try {
        await api.post('users/register');
        fail('Debe fallar');
      } on ApiException catch (error) {
        expect(error.statusCode, 422);
        expect(
          error.fieldErrors.keys,
          unorderedEquals(['email', 'password', 'displayName']),
        );
        expect(error.generalErrors, ['Revisa los datos enviados.']);
        for (final exposed in [
          error.toString(),
          error.message,
          error.fieldErrors.toString(),
          error.generalErrors.toString(),
        ]) {
          expect(exposed, isNot(contains('secret')));
          expect(exposed, isNot(contains('/server')));
        }
        expect(() => error.fieldErrors.clear(), throwsUnsupportedError);
        expect(
          () => error.fieldErrors['email']!.add('x'),
          throwsUnsupportedError,
        );
        expect(() => error.generalErrors.clear(), throwsUnsupportedError);
      }
    },
  );

  for (final status in [401, 403, 404, 409, 422, 429]) {
    for (final body in [
      '{malformed',
      '[]',
      'null',
      '{"message":"secret","trace":"secret"}',
    ]) {
      test(
        'HTTP $status conserva código ante cuerpo $body y no reintenta',
        () async {
          var calls = 0;
          final client = MockClient((_) async {
            calls++;
            return http.Response(
              body,
              status,
              headers: {
                'content-type': 'application/json',
                'retry-after': '60',
              },
            );
          });
          addTearDown(client.close);
          final api = ApiClient(
            client: client,
            config: AppConfig.fromValues(
              apiBaseUrl: 'https://api.example.com/api/v1',
            ),
          );
          try {
            await api.get('auth/me');
            fail('Debe fallar');
          } on ApiException catch (error) {
            expect(error.kind, ApiErrorKind.http);
            expect(error.statusCode, status);
            expect(error.retryAfter!.delay, const Duration(seconds: 60));
            expect(error.fieldErrors, isEmpty);
            expect(error.toString(), isNot(contains('secret')));
          }
          expect(calls, 1);
        },
      );
    }
  }

  test('Retry-After acepta segundos y fecha HTTP sin decidir reintentos', () {
    expect(RetryAfter.parse(' 0 ')!.delay, Duration.zero);
    expect(
      RetryAfter.parse('Mon, 16 Nov 2026 12:30:00 GMT')!.date,
      DateTime.utc(2026, 11, 16, 12, 30),
    );
    for (final value in [
      null,
      '-1',
      '1.5',
      'secret',
      '999999999999999999999',
      'Mon, 31 Feb 2026 12:30:00 GMT',
      'Mon, 16 Nov 2026 25:30:00 GMT',
    ]) {
      expect(RetryAfter.parse(value), isNull);
    }
  });

  test(
    'cuerpo no JSON, UTF8 inválido o demasiado grande no filtra detalles',
    () async {
      for (final response in [
        http.Response(
          '{"errors":{"email":["secret"]}}',
          422,
          headers: {'content-type': 'text/html'},
        ),
        http.Response.bytes(
          [255],
          422,
          headers: {'content-type': 'application/json'},
        ),
        http.Response(
          jsonEncode({
            'errors': {
              'email': ['x' * 65537],
            },
          }),
          422,
          headers: {'content-type': 'application/json'},
        ),
      ]) {
        final client = MockClient((_) async => response);
        addTearDown(client.close);
        final api = ApiClient(
          client: client,
          config: AppConfig.fromValues(
            apiBaseUrl: 'https://api.example.com/api/v1',
          ),
        );
        await expectLater(
          api.get('auth/me'),
          throwsA(
            isA<ApiException>()
                .having((e) => e.statusCode, 'HTTP', 422)
                .having((e) => e.fieldErrors, 'fields', isEmpty),
          ),
        );
      }
    },
  );
}
