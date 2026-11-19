enum ApiErrorKind {
  configuration,
  invalidRequest,
  connection,
  timeout,
  http,
  invalidResponse,
  closed,
}

/// No conserva URI, cabeceras, cuerpos ni excepciones originales sensibles.
class ApiException implements Exception {
  const ApiException(
    this.kind, {
    this.statusCode,
    this.fieldErrors = const {},
    this.generalErrors = const [],
    this.retryAfter,
  });

  /// Los mensajes remotos pueden reflejar secretos. Solo se conservan campos
  /// conocidos y mensajes locales; nunca texto arbitrario ni trazas del servidor.
  factory ApiException.fromHttp(
    int status, {
    Object? payload,
    String? retryAfterHeader,
  }) {
    final fields = <String, List<String>>{};
    const allowedFields = {
      'email',
      'password',
      'phone',
      'preferredLanguage',
      'signupRole',
      'firstName',
      'lastName',
      'displayName',
      'bio',
      'city',
      'state',
      'country',
      'postalCode',
      'investorType',
      'addressLine1',
      'addressLine2',
      'companyName',
      'addressLine',
      'website',
      'linkedinUrl',
    };
    if (status == 422 && payload is Map<String, dynamic>) {
      final errors = payload['errors'];
      if (errors is Map<String, dynamic>) {
        for (final field in allowedFields) {
          final messages = errors[field];
          if (messages is List &&
              messages.any((m) => m is String && m.trim().isNotEmpty)) {
            fields[field] = const ['Revisa el valor de este campo.'];
          }
        }
      }
    }
    final base = ApiException(ApiErrorKind.http, statusCode: status);
    return ApiException(
      ApiErrorKind.http,
      statusCode: status,
      fieldErrors: Map.unmodifiable(fields),
      generalErrors: List.unmodifiable([base.message]),
      retryAfter: RetryAfter.parse(retryAfterHeader),
    );
  }

  final ApiErrorKind kind;
  final int? statusCode;
  final Map<String, List<String>> fieldErrors;
  final List<String> generalErrors;
  final RetryAfter? retryAfter;

  String get message => switch (kind) {
    ApiErrorKind.configuration => 'El servicio aún no está configurado.',
    ApiErrorKind.invalidRequest => 'La solicitud no es válida.',
    ApiErrorKind.connection => 'No se pudo conectar con el servicio.',
    ApiErrorKind.timeout => 'El servicio tardó demasiado en responder.',
    ApiErrorKind.http => switch (statusCode) {
      401 => 'No se pudo autenticar la solicitud.',
      403 => 'No tienes permiso para realizar esta operación.',
      404 => 'No se encontró el recurso solicitado.',
      409 => 'El recurso ya existe o está en conflicto.',
      422 => 'Revisa los datos enviados.',
      429 => 'Demasiadas solicitudes. Inténtalo más tarde.',
      _ => 'El servicio no pudo completar la solicitud.',
    },
    ApiErrorKind.invalidResponse => 'La respuesta del servicio no es válida.',
    ApiErrorKind.closed => 'El cliente del servicio ya está cerrado.',
  };

  @override
  String toString() =>
      'ApiException(${kind.name}${statusCode == null ? '' : ', $statusCode'}): '
      '$message';
}

/// Metadatos de espera, sin temporizadores ni reintentos automáticos.
class RetryAfter {
  const RetryAfter._({this.delay, this.date});
  final Duration? delay;
  final DateTime? date;

  static RetryAfter? parse(String? header) {
    if (header == null || header.length > 128) return null;
    final value = header.trim();
    if (RegExp(r'^\d{1,9}$').hasMatch(value)) {
      return RetryAfter._(delay: Duration(seconds: int.parse(value)));
    }
    // Formato HTTP IMF-fixdate, independiente de locale y reloj del cliente.
    final match = RegExp(
      r'^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$',
    ).firstMatch(value);
    if (match == null) return null;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final day = int.parse(match[1]!);
    final month = months.indexOf(match[2]!) + 1;
    final year = int.parse(match[3]!);
    final hour = int.parse(match[4]!);
    final minute = int.parse(match[5]!);
    final second = int.parse(match[6]!);
    final date = DateTime.utc(year, month, day, hour, minute, second);
    if (date.day != day ||
        date.month != month ||
        date.hour != hour ||
        date.minute != minute ||
        date.second != second) {
      return null;
    }
    return RetryAfter._(date: date);
  }
}
