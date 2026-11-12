enum AppEnvironment { development, production }

class AppConfigException implements Exception {
  const AppConfigException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AppConfig {
  const AppConfig._({required this.environment, required this.apiBaseUrl});

  factory AppConfig.fromEnvironment() {
    // Una compilación release no debe asumir desarrollo por omisión.
    const defaultEnvironment = bool.fromEnvironment('dart.vm.product')
        ? 'production'
        : 'development';
    return AppConfig.fromValues(
      appEnv: const String.fromEnvironment(
        'APP_ENV',
        defaultValue: defaultEnvironment,
      ),
      apiBaseUrl: const String.fromEnvironment('API_BASE_URL'),
    );
  }

  /// Permite validar valores explícitos sin red ni parámetros de compilación.
  factory AppConfig.fromValues({
    String appEnv = 'development',
    String apiBaseUrl = '',
  }) {
    final environment = switch (appEnv.trim()) {
      'development' => AppEnvironment.development,
      'production' => AppEnvironment.production,
      _ => throw const AppConfigException(
        'El entorno de la aplicación no es válido.',
      ),
    };
    final value = apiBaseUrl.trim();
    if (value.isEmpty) {
      if (environment == AppEnvironment.production) {
        throw const AppConfigException(
          'Falta la dirección del servicio para producción.',
        );
      }
      return AppConfig._(environment: environment, apiBaseUrl: null);
    }

    final uri = Uri.tryParse(value);
    if (uri == null ||
        RegExp(r'\s').hasMatch(value) ||
        value.contains('\\') ||
        !uri.hasAuthority ||
        uri.host.isEmpty ||
        (uri.scheme != 'http' && uri.scheme != 'https')) {
      throw const AppConfigException(
        'La dirección del servicio debe ser una URL HTTP o HTTPS válida.',
      );
    }
    if (uri.userInfo.isNotEmpty || uri.hasQuery || uri.hasFragment) {
      throw const AppConfigException(
        'La dirección del servicio no debe incluir credenciales, '
        'parámetros ni fragmentos.',
      );
    }
    if (uri.hasPort && (uri.port < 1 || uri.port > 65535)) {
      throw const AppConfigException('El puerto del servicio no es válido.');
    }
    if (uri.path != '/api/v1' && uri.path != '/api/v1/') {
      throw const AppConfigException(
        'La dirección del servicio debe terminar en /api/v1.',
      );
    }
    if (environment == AppEnvironment.production && uri.scheme != 'https') {
      throw const AppConfigException(
        'La conexión del servicio debe utilizar HTTPS en producción.',
      );
    }

    return AppConfig._(
      environment: environment,
      apiBaseUrl: uri.replace(path: '/api/v1/'),
    );
  }

  final AppEnvironment environment;

  /// Ausente únicamente cuando desarrollo aún no tiene un servicio configurado.
  /// La barra final permite resolver posteriormente endpoints relativos.
  final Uri? apiBaseUrl;

  bool get isProduction => environment == AppEnvironment.production;
  bool get hasApi => apiBaseUrl != null;
}
