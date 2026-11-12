import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_client.dart';
import 'package:movil/core/network/api_exception.dart';

// Direcciones y rutas de prueba: MockClient nunca abre conexiones reales.
AppConfig testConfig() => AppConfig.fromValues(
  appEnv: 'production',
  apiBaseUrl: 'https://api.example.com/api/v1',
);

http.Response jsonResponse(Object? value, {int status = 200}) =>
    http.Response.bytes(
      utf8.encode(jsonEncode(value)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

TypeMatcher<ApiException> apiError(ApiErrorKind kind, {int? status}) =>
    isA<ApiException>()
        .having((error) => error.kind, 'kind', kind)
        .having((error) => error.statusCode, 'statusCode', status);

class TrackedClient extends MockClient {
  TrackedClient() : super((_) async => jsonResponse(null));

  int closeCount = 0;

  @override
  void close() {
    closeCount++;
    super.close();
  }
}

void main() {
  test(
    'conserva /api/v1 y codifica segmentos y consulta sin concatenación',
    () async {
      final transport = MockClient((request) async {
        expect(request.url.origin, 'https://api.example.com');
        expect(request.url.path, '/api/v1/recurso/ni%C3%B1o');
        expect(request.url.pathSegments, ['api', 'v1', 'recurso', 'niño']);
        expect(request.url.queryParameters, {'q': 'a & b/ñ?x=1', 'page': '2'});
        expect(request.url.fragment, isEmpty);
        return jsonResponse({'data': []});
      });
      addTearDown(transport.close);
      final api = ApiClient(client: transport, config: testConfig());
      await api.get(
        'recurso/niño',
        queryParameters: {'q': 'a & b/ñ?x=1', 'page': '2'},
      );
    },
  );

  test('permite la ruta relativa vacía sin perder el prefijo', () async {
    final transport = MockClient((request) async {
      expect(request.url.path, '/api/v1/');
      return jsonResponse(null);
    });
    addTearDown(transport.close);
    await ApiClient(client: transport, config: testConfig()).get('');
  });

  test(
    'GET incluye Accept y omite Content-Type y Bearer sin proveedor',
    () async {
      final transport = MockClient((request) async {
        expect(request.method, 'GET');
        expect(request.headers['Accept'], 'application/json');
        expect(request.headers.containsKey('Content-Type'), isFalse);
        expect(request.headers.containsKey('Authorization'), isFalse);
        expect(request.followRedirects, isFalse);
        return jsonResponse({'data': 'ok'});
      });
      addTearDown(transport.close);
      await ApiClient(client: transport, config: testConfig()).get('recurso');
    },
  );

  for (final method in ['POST', 'PUT', 'PATCH', 'DELETE']) {
    test('$method serializa JSON UTF-8 y conserva consulta', () async {
      final transport = MockClient((request) async {
        expect(request.method, method);
        expect(request.headers['Accept'], 'application/json');
        expect(
          request.headers['Content-Type'],
          'application/json; charset=utf-8',
        );
        expect(jsonDecode(utf8.decode(request.bodyBytes)), {
          'texto': 'acción',
          'n': 2,
        });
        expect(request.url.queryParameters, {'mode': 'test'});
        return jsonResponse({'data': true}, status: 201);
      });
      addTearDown(transport.close);
      final api = ApiClient(client: transport, config: testConfig());
      final operations = {
        'POST': api.post,
        'PUT': api.put,
        'PATCH': api.patch,
        'DELETE': api.delete,
      };
      expect(
        await operations[method]!(
          'recurso',
          body: {'texto': 'acción', 'n': 2},
          queryParameters: {'mode': 'test'},
        ),
        {'data': true},
      );
    });
  }

  test(
    'no cambia la envoltura Laravel ni interpreta modelos del dominio',
    () async {
      final envelope = {
        'data': {
          'items': [1, 2],
        },
        'message': 'Operación exitosa',
        'statusCode': 200,
      };
      final transport = MockClient((_) async => jsonResponse(envelope));
      addTearDown(transport.close);
      expect(
        await ApiClient(client: transport, config: testConfig()).get('recurso'),
        envelope,
      );
    },
  );

  for (final value in <Object?>[
    null,
    [1, 2],
    'texto',
    3,
    true,
  ]) {
    test('acepta un valor JSON ${value.runtimeType}', () async {
      final transport = MockClient((_) async => jsonResponse(value));
      addTearDown(transport.close);
      expect(
        await ApiClient(client: transport, config: testConfig()).get('recurso'),
        value,
      );
    });
  }

  for (final status in [200, 204]) {
    test('HTTP $status sin cuerpo devuelve null', () async {
      final transport = MockClient((_) async => http.Response('', status));
      addTearDown(transport.close);
      expect(
        await ApiClient(client: transport, config: testConfig()).get('recurso'),
        isNull,
      );
    });
  }

  test(
    'proveedor asíncrono entrega Bearer Sanctum y se consulta en cada llamada',
    () async {
      var providerCalls = 0;
      final tokens = <String?>['12|valor-de-prueba', null, ''];
      var requests = 0;
      final transport = MockClient((request) async {
        expect(
          request.headers['Authorization'],
          requests++ == 0 ? 'Bearer 12|valor-de-prueba' : null,
        );
        return jsonResponse(null);
      });
      addTearDown(transport.close);
      final api = ApiClient(
        client: transport,
        config: testConfig(),
        tokenProvider: () async => tokens[providerCalls++],
      );
      for (var i = 0; i < 3; i++) {
        await api.get('recurso');
      }
      expect(providerCalls, 3);
      expect(requests, 3);
    },
  );

  test('un token con salto de línea se rechaza antes de enviar', () async {
    var requests = 0;
    final transport = MockClient((_) async {
      requests++;
      return jsonResponse(null);
    });
    addTearDown(transport.close);
    final api = ApiClient(
      client: transport,
      config: testConfig(),
      tokenProvider: () => 'valor\r\nX-Test: secreto',
    );
    await expectLater(
      api.get('recurso'),
      throwsA(apiError(ApiErrorKind.invalidRequest)),
    );
    expect(requests, 0);
  });

  for (final status in [400, 401, 403, 404, 422, 500, 302]) {
    test(
      'HTTP $status conserva el código sin divulgar cuerpo ni reintentar',
      () async {
        var requests = 0;
        final transport = MockClient((_) async {
          requests++;
          return http.Response(
            'contraseña-privada',
            status,
            headers: {'location': 'https://otro.example/privado'},
          );
        });
        addTearDown(transport.close);
        final api = ApiClient(client: transport, config: testConfig());
        await expectLater(
          api.post('recurso', body: {'dato': 'privado'}),
          throwsA(
            apiError(ApiErrorKind.http, status: status).having(
              (error) => error.toString(),
              'mensaje',
              isNot(contains('privad')),
            ),
          ),
        );
        expect(requests, 1);
      },
    );
  }

  test('JSON inválido no se devuelve como éxito', () async {
    final transport = MockClient((_) async => http.Response('{secreto', 200));
    addTearDown(transport.close);
    await expectLater(
      ApiClient(client: transport, config: testConfig()).get('recurso'),
      throwsA(apiError(ApiErrorKind.invalidResponse)),
    );
  });

  test('UTF-8 inválido produce un error de respuesta', () async {
    final transport = MockClient((_) async => http.Response.bytes([255], 200));
    addTearDown(transport.close);
    await expectLater(
      ApiClient(client: transport, config: testConfig()).get('recurso'),
      throwsA(apiError(ApiErrorKind.invalidResponse)),
    );
  });

  test(
    'un tipo binario no se interpreta como JSON aunque el cuerpo parezca JSON',
    () async {
      final transport = MockClient(
        (_) async => http.Response(
          '{}',
          200,
          headers: {'content-type': 'application/pdf'},
        ),
      );
      addTearDown(transport.close);
      await expectLater(
        ApiClient(client: transport, config: testConfig()).get('recurso'),
        throwsA(apiError(ApiErrorKind.invalidResponse)),
      );
    },
  );

  test('admite tipos application/*+json', () async {
    final transport = MockClient(
      (_) async => http.Response(
        '{"ok":true}',
        200,
        headers: {'content-type': 'application/problem+json'},
      ),
    );
    addTearDown(transport.close);
    expect(
      await ApiClient(client: transport, config: testConfig()).get('recurso'),
      {'ok': true},
    );
  });

  test('getBytes devuelve PDF sin intentar decodificar JSON', () async {
    final bytes = [37, 80, 68, 70, 255];
    final transport = MockClient((request) async {
      expect(request.headers['Accept'], 'application/octet-stream');
      return http.Response.bytes(
        bytes,
        200,
        headers: {'content-type': 'application/pdf'},
      );
    });
    addTearDown(transport.close);
    expect(
      await ApiClient(
        client: transport,
        config: testConfig(),
      ).getBytes('archivo'),
      bytes,
    );
  });

  test('un fallo de conexión se sanitiza y no se reintenta', () async {
    var requests = 0;
    final transport = MockClient((_) async {
      requests++;
      throw http.ClientException('token-privado en https://privado.example');
    });
    addTearDown(transport.close);
    try {
      await ApiClient(client: transport, config: testConfig()).post('recurso');
      fail('Debió fallar');
    } on ApiException catch (error) {
      expect(error.kind, ApiErrorKind.connection);
      expect(error.toString(), isNot(contains('privado')));
    }
    expect(requests, 1);
  });

  test('timeout limita la espera sin reintentar', () async {
    final pending = Completer<http.Response>();
    var requests = 0;
    final transport = MockClient((_) {
      requests++;
      return pending.future;
    });
    addTearDown(transport.close);
    final api = ApiClient(
      client: transport,
      config: testConfig(),
      timeout: const Duration(milliseconds: 10),
    );
    await expectLater(
      api.post('recurso'),
      throwsA(apiError(ApiErrorKind.timeout)),
    );
    expect(requests, 1);
    pending.complete(jsonResponse(null));
  });

  test('timeout del proveedor no envía la solicitud más tarde', () async {
    final token = Completer<String?>();
    var requests = 0;
    final transport = MockClient((_) async {
      requests++;
      return jsonResponse(null);
    });
    addTearDown(transport.close);
    final api = ApiClient(
      client: transport,
      config: testConfig(),
      tokenProvider: () => token.future,
      timeout: const Duration(milliseconds: 10),
    );
    await expectLater(
      api.post('recurso'),
      throwsA(apiError(ApiErrorKind.timeout)),
    );
    token.complete('valor');
    await Future<void>.delayed(Duration.zero);
    expect(requests, 0);
  });

  final unsafePaths = [
    '/recurso',
    '//otro.example/recurso',
    'https://otro.example/recurso',
    '../recurso',
    'a/../../recurso',
    './recurso',
    'a/./b',
    r'a\..\recurso',
    '%2e%2e/recurso',
    '%252e%252e/recurso',
    'a%2fb',
    'a//b',
    'api/v1/recurso',
    'recurso?token=privado',
    'recurso#fragmento',
    'recurso\nprivado',
    'recurso con espacios',
  ];
  for (var i = 0; i < unsafePaths.length; i++) {
    test('rechaza ruta insegura $i antes del proveedor y transporte', () async {
      var requests = 0;
      var tokenCalls = 0;
      final transport = MockClient((_) async {
        requests++;
        return jsonResponse(null);
      });
      addTearDown(transport.close);
      final api = ApiClient(
        client: transport,
        config: testConfig(),
        tokenProvider: () {
          tokenCalls++;
          return 'valor';
        },
      );
      await expectLater(
        api.get(unsafePaths[i]),
        throwsA(apiError(ApiErrorKind.invalidRequest)),
      );
      expect(requests, 0);
      expect(tokenCalls, 0);
    });
  }

  test('sin API configurada falla controladamente antes de enviar', () async {
    var requests = 0;
    final transport = MockClient((_) async {
      requests++;
      return jsonResponse(null);
    });
    addTearDown(transport.close);
    await expectLater(
      ApiClient(
        client: transport,
        config: AppConfig.fromValues(),
      ).get('recurso'),
      throwsA(apiError(ApiErrorKind.configuration)),
    );
    expect(requests, 0);
  });

  test('un cuerpo no serializable no se envía', () async {
    var requests = 0;
    final transport = MockClient((_) async {
      requests++;
      return jsonResponse(null);
    });
    addTearDown(transport.close);
    await expectLater(
      ApiClient(
        client: transport,
        config: testConfig(),
      ).post('recurso', body: Object()),
      throwsA(apiError(ApiErrorKind.invalidRequest)),
    );
    expect(requests, 0);
  });

  test('el cierre compartido no cierra el cliente inyectado', () async {
    final transport = TrackedClient();
    addTearDown(transport.close);
    final api = ApiClient(client: transport, config: testConfig());
    api.close();
    expect(transport.closeCount, 0);
    await expectLater(
      api.get('recurso'),
      throwsA(apiError(ApiErrorKind.closed)),
    );
  });

  test('el cierre con propiedad es idempotente', () {
    final transport = TrackedClient();
    final api = ApiClient(
      client: transport,
      config: testConfig(),
      ownsClient: true,
    );
    api.close();
    api.close();
    expect(transport.closeCount, 1);
  });

  test('rechaza un timeout no positivo', () {
    final transport = TrackedClient();
    addTearDown(transport.close);
    expect(
      () => ApiClient(
        client: transport,
        config: testConfig(),
        timeout: Duration.zero,
      ),
      throwsA(apiError(ApiErrorKind.invalidRequest)),
    );
  });
}
