import 'api_contract.dart';
import 'auth_user.dart';

/// Valor en memoria. No calcula vencimientos, restaura ni persiste credenciales.
class AuthSession {
  const AuthSession._({
    required this.accessToken,
    required this.tokenType,
    required this.expiresIn,
    required this.user,
  });

  factory AuthSession.fromJson(Object? value) {
    final json = ApiContract.object(value);
    final token = ApiContract.string(json, 'accessToken');
    final type = ApiContract.string(json, 'tokenType');
    final expires = ApiContract.string(json, 'expiresIn');
    if (!RegExp(r'^[A-Za-z0-9\-._~+/|]+=*$').hasMatch(token) ||
        type != 'Bearer' ||
        expires != '24h') {
      ApiContract.invalid();
    }
    return AuthSession._(
      accessToken: token,
      tokenType: type,
      expiresIn: expires,
      user: AuthUser.fromJson(json['user']),
    );
  }

  final String accessToken;
  final String tokenType;
  final String expiresIn;
  final AuthUser user;

  @override
  String toString() => 'AuthSession(redacted)';
}

class RegisterResponse {
  const RegisterResponse(this.user);

  factory RegisterResponse.fromJson(Object? value) =>
      RegisterResponse(AuthUser.fromJson(ApiContract.data(value, status: 201)));

  final AuthUser user;
}

class LoginResponse {
  const LoginResponse(this.session);

  factory LoginResponse.fromJson(Object? value) =>
      LoginResponse(AuthSession.fromJson(ApiContract.data(value, status: 200)));

  final AuthSession session;

  @override
  String toString() => 'LoginResponse(redacted)';
}
