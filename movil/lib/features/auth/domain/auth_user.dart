import 'api_contract.dart';

/// Identidad de cuenta, independiente de los perfiles por actividad.
class AuthUser {
  AuthUser({
    required this.id,
    required this.email,
    required Iterable<String> roles,
    this.phone,
    this.preferredLanguage,
    this.isActive,
    this.emailVerified,
  }) : roles = List.unmodifiable(roles);

  factory AuthUser.fromJson(Object? value) {
    final json = ApiContract.object(value);
    final roles = json['roles'];
    if (roles is! List ||
        roles.any((role) => role is! String || role.isEmpty)) {
      ApiContract.invalid();
    }
    return AuthUser(
      id: ApiContract.string(json, 'id'),
      email: ApiContract.string(json, 'email'),
      roles: roles.cast<String>(),
      phone: ApiContract.optionalString(json, 'phone'),
      preferredLanguage: ApiContract.optionalString(json, 'preferredLanguage'),
      isActive: ApiContract.optionalBool(json, 'isActive'),
      emailVerified: ApiContract.optionalBool(json, 'emailVerified'),
    );
  }

  final String id;
  final String email;
  final List<String> roles;
  final String? phone;
  final String? preferredLanguage;
  final bool? isActive;
  final bool? emailVerified;
}
