import 'package:flutter_test/flutter_test.dart';
import 'package:movil/core/config/app_config.dart';

void main() {
  group('Desarrollo', () {
    test('permite API ausente sin inventar una dirección', () {
      final config = AppConfig.fromValues();
      expect(config.environment, AppEnvironment.development);
      expect(config.isProduction, isFalse);
      expect(config.hasApi, isFalse);
      expect(config.apiBaseUrl, isNull);
    });

    test('considera una URL en blanco como ausente', () {
      expect(AppConfig.fromValues(apiBaseUrl: '  ').apiBaseUrl, isNull);
    });

    test('admite HTTP con puerto explícito y conserva /api/v1', () {
      final config = AppConfig.fromValues(
        apiBaseUrl: 'http://192.0.2.1:8765/api/v1',
      );
      expect(config.hasApi, isTrue);
      expect(config.apiBaseUrl.toString(), 'http://192.0.2.1:8765/api/v1/');
      expect(
        config.apiBaseUrl!.resolve('categories').toString(),
        'http://192.0.2.1:8765/api/v1/categories',
      );
    });

    test('admite HTTPS y una barra final sin duplicarla', () {
      final config = AppConfig.fromValues(
        apiBaseUrl: ' https://api.example.com/api/v1/ ',
      );
      expect(config.apiBaseUrl.toString(), 'https://api.example.com/api/v1/');
    });
  });

  group('Producción', () {
    test('exige URL sin establecer un valor por defecto', () {
      expect(
        () => AppConfig.fromValues(appEnv: 'production'),
        throwsA(isA<AppConfigException>()),
      );
    });

    test('rechaza HTTP', () {
      expect(
        () => AppConfig.fromValues(
          appEnv: 'production',
          apiBaseUrl: 'http://api.example.com/api/v1',
        ),
        throwsA(isA<AppConfigException>()),
      );
    });

    test('admite HTTPS con el prefijo correcto', () {
      final config = AppConfig.fromValues(
        appEnv: 'production',
        apiBaseUrl: 'https://api.example.com/api/v1',
      );
      expect(config.isProduction, isTrue);
      expect(config.apiBaseUrl.toString(), 'https://api.example.com/api/v1/');
    });
  });

  for (final env in ['', 'staging', 'Production']) {
    test('rechaza entorno no admitido: "$env"', () {
      expect(
        () => AppConfig.fromValues(appEnv: env),
        throwsA(isA<AppConfigException>()),
      );
    });
  }

  final invalidUrls = <String, String>{
    'ruta relativa': '/api/v1',
    'sin esquema': 'api.example.com/api/v1',
    'sin host': 'https:///api/v1',
    'esquema diferente': 'ftp://api.example.com/api/v1',
    'espacios internos': 'https://api.example.com/api /v1',
    'barra inversa': r'https://api.example.com\api\v1',
    'sin prefijo': 'https://api.example.com',
    'versión diferente': 'https://api.example.com/api/v2',
    'endpoint adicional': 'https://api.example.com/api/v1/categories',
    'prefijo duplicado': 'https://api.example.com/api/v1/api/v1',
    'credenciales': 'https://usuario:ejemplo@api.example.com/api/v1',
    'query': 'https://api.example.com/api/v1?key=ejemplo',
    'fragmento': 'https://api.example.com/api/v1#ejemplo',
    'puerto cero': 'https://api.example.com:0/api/v1',
    'puerto fuera de rango': 'https://api.example.com:65536/api/v1',
    'puerto no numérico': 'https://api.example.com:abc/api/v1',
  };
  for (final entry in invalidUrls.entries) {
    test('rechaza URL inválida: ${entry.key}', () {
      expect(
        () => AppConfig.fromValues(apiBaseUrl: entry.value),
        throwsA(isA<AppConfigException>()),
      );
    });
  }

  test('los errores no incluyen la dirección ni valores sensibles', () {
    const value = 'https://usuario:valor-privado@api.example.com/api/v1';
    expect(
      () => AppConfig.fromValues(apiBaseUrl: value),
      throwsA(
        isA<AppConfigException>().having(
          (error) => error.toString(),
          'mensaje seguro',
          allOf(
            isNot(contains(value)),
            isNot(contains('valor-privado')),
            isNot(contains('usuario')),
          ),
        ),
      ),
    );
  });
}
