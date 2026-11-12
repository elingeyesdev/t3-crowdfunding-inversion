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
  const ApiException(this.kind, {this.statusCode});

  final ApiErrorKind kind;
  final int? statusCode;

  String get message => switch (kind) {
    ApiErrorKind.configuration => 'El servicio aún no está configurado.',
    ApiErrorKind.invalidRequest => 'La solicitud no es válida.',
    ApiErrorKind.connection => 'No se pudo conectar con el servicio.',
    ApiErrorKind.timeout => 'El servicio tardó demasiado en responder.',
    ApiErrorKind.http => 'El servicio no pudo completar la solicitud.',
    ApiErrorKind.invalidResponse => 'La respuesta del servicio no es válida.',
    ApiErrorKind.closed => 'El cliente del servicio ya está cerrado.',
  };

  @override
  String toString() =>
      'ApiException(${kind.name}${statusCode == null ? '' : ', $statusCode'}): '
      '$message';
}
