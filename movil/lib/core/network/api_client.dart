import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'api_exception.dart';

typedef AccessTokenProvider = FutureOr<String?> Function();

/// Transporte sin lógica de dominio, almacenamiento, registros ni reintentos.
class ApiClient {
  ApiClient({
    required this._client,
    required this._config,
    this._tokenProvider,
    this.timeout = const Duration(seconds: 15),
    this.ownsClient = false,
  }) {
    if (timeout <= Duration.zero) {
      throw const ApiException(ApiErrorKind.invalidRequest);
    }
  }

  final http.Client _client;
  final AppConfig _config;
  final AccessTokenProvider? _tokenProvider;
  final Duration timeout;

  /// Por defecto, el propietario del cliente inyectado debe cerrarlo.
  final bool ownsClient;
  bool _closed = false;

  Future<Object?> get(String path, {Map<String, String>? queryParameters}) =>
      _json('GET', path, queryParameters: queryParameters);

  Future<Object?> post(
    String path, {
    Object? body,
    Map<String, String>? queryParameters,
  }) => _json('POST', path, body: body, queryParameters: queryParameters);

  Future<Object?> put(
    String path, {
    Object? body,
    Map<String, String>? queryParameters,
  }) => _json('PUT', path, body: body, queryParameters: queryParameters);

  Future<Object?> patch(
    String path, {
    Object? body,
    Map<String, String>? queryParameters,
  }) => _json('PATCH', path, body: body, queryParameters: queryParameters);

  Future<Object?> delete(
    String path, {
    Object? body,
    Map<String, String>? queryParameters,
  }) => _json('DELETE', path, body: body, queryParameters: queryParameters);

  /// Para archivos como PDF; no intenta interpretar sus bytes como JSON.
  Future<Uint8List> getBytes(
    String path, {
    Map<String, String>? queryParameters,
  }) async {
    final response = await _send(
      'GET',
      path,
      queryParameters: queryParameters,
      accept: 'application/octet-stream',
    );
    return response.bodyBytes;
  }

  Future<Object?> _json(
    String method,
    String path, {
    Object? body,
    Map<String, String>? queryParameters,
  }) async {
    final response = await _send(
      method,
      path,
      body: body,
      queryParameters: queryParameters,
    );
    if (response.statusCode == 204 || response.bodyBytes.isEmpty) return null;
    final contentType = response.headers['content-type']
        ?.split(';')
        .first
        .trim()
        .toLowerCase();
    if (contentType != null &&
        contentType != 'application/json' &&
        !(contentType.startsWith('application/') &&
            contentType.endsWith('+json'))) {
      throw const ApiException(ApiErrorKind.invalidResponse);
    }
    try {
      // Conserva la envoltura Laravel y cualquier valor JSON, sin mapear modelos.
      return jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      throw const ApiException(ApiErrorKind.invalidResponse);
    }
  }

  Uri _buildUri(String path, Map<String, String>? queryParameters) {
    final base = _config.apiBaseUrl;
    if (base == null) throw const ApiException(ApiErrorKind.configuration);

    // Los segmentos se reciben sin codificar. La consulta se pasa por separado.
    // Rechazar '%' evita separadores y traversal codificados una o varias veces.
    final segments = path.isEmpty ? <String>[] : path.split('/');
    if (RegExp(r'[\s\x00-\x1f\x7f]').hasMatch(path) ||
        RegExp(r'[:\\%?#]').hasMatch(path) ||
        segments.any(
          (segment) => segment.isEmpty || segment == '.' || segment == '..',
        ) ||
        (segments.length >= 2 && segments[0] == 'api' && segments[1] == 'v1')) {
      throw const ApiException(ApiErrorKind.invalidRequest);
    }
    final target = base.resolveUri(
      Uri(pathSegments: segments, queryParameters: queryParameters),
    );
    if (target.scheme != base.scheme ||
        target.authority != base.authority ||
        !target.path.startsWith(base.path)) {
      throw const ApiException(ApiErrorKind.invalidRequest);
    }
    return target;
  }

  Future<http.Response> _send(
    String method,
    String path, {
    Object? body,
    Map<String, String>? queryParameters,
    String accept = 'application/json',
  }) async {
    if (_closed) throw const ApiException(ApiErrorKind.closed);
    final uri = _buildUri(path, queryParameters);
    final request = http.Request(method, uri)
      ..followRedirects = false
      ..headers['Accept'] = accept;
    if (body != null) {
      try {
        request.bodyBytes = utf8.encode(jsonEncode(body));
        request.headers['Content-Type'] = 'application/json; charset=utf-8';
      } catch (_) {
        throw const ApiException(ApiErrorKind.invalidRequest);
      }
    }

    final provider = _tokenProvider;
    if (provider != null) {
      String? token;
      try {
        token = await Future<String?>.sync(provider).timeout(timeout);
      } on TimeoutException {
        throw const ApiException(ApiErrorKind.timeout);
      } catch (_) {
        throw const ApiException(ApiErrorKind.invalidRequest);
      }
      if (token != null && token.isNotEmpty) {
        // Sanctum utiliza tokens opacos con el separador «id|token».
        if (!RegExp(r'^[A-Za-z0-9\-._~+/|]+=*$').hasMatch(token)) {
          throw const ApiException(ApiErrorKind.invalidRequest);
        }
        request.headers['Authorization'] = 'Bearer $token';
      }
    }
    if (_closed) throw const ApiException(ApiErrorKind.closed);

    http.Response response;
    try {
      response = await (() async {
        final streamed = await _client.send(request);
        return http.Response.fromStream(streamed);
      })().timeout(timeout);
    } on TimeoutException {
      // Limita la espera; no garantiza cancelar una operación ya enviada.
      throw const ApiException(ApiErrorKind.timeout);
    } catch (_) {
      throw const ApiException(ApiErrorKind.connection);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(ApiErrorKind.http, statusCode: response.statusCode);
    }
    return response;
  }

  /// Idempotente. Solo cierra el transporte si se transfirió su propiedad.
  void close() {
    if (_closed) return;
    _closed = true;
    if (ownsClient) _client.close();
  }
}
