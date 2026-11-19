import '../../../core/network/api_exception.dart';

/// Lectura estricta del contrato JSON; nunca adjunta valores a los errores.
abstract final class ApiContract {
  static Never invalid() =>
      throw const ApiException(ApiErrorKind.invalidResponse);

  static Map<String, dynamic> object(Object? value) {
    if (value is! Map<String, dynamic>) invalid();
    return value;
  }

  static Object? data(Object? value, {required int status}) {
    final json = object(value);
    if (json['statusCode'] is! int ||
        json['statusCode'] != status ||
        !json.containsKey('data')) {
      invalid();
    }
    return json['data'];
  }

  static String string(Map<String, dynamic> json, String key) {
    final value = json[key];
    if (value is! String || value.isEmpty) invalid();
    return value;
  }

  static String? optionalString(Map<String, dynamic> json, String key) {
    final value = json[key];
    if (value != null && value is! String) invalid();
    return value as String?;
  }

  static bool? optionalBool(Map<String, dynamic> json, String key) {
    final value = json[key];
    if (value != null && value is! bool) invalid();
    return value as bool?;
  }
}
