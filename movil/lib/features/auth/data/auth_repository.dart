import '../../../core/network/api_client.dart';
import '../domain/api_contract.dart';
import '../domain/auth_requests.dart';
import '../domain/auth_session.dart';
import '../domain/auth_user.dart';

/// No conserva sesión ni decide navegación. El cliente se inyecta desde fuera.
class AuthRepository {
  const AuthRepository(this._api);

  final ApiClient _api;

  Future<RegisterResponse> register(RegisterRequest request) async =>
      RegisterResponse.fromJson(
        await _api.post(
          'users/register',
          body: request.toJson(),
          authenticated: false,
        ),
      );

  Future<LoginResponse> login(LoginRequest request) async =>
      LoginResponse.fromJson(
        await _api.post(
          'auth/login',
          body: request.toJson(),
          authenticated: false,
        ),
      );

  Future<AuthUser> me() async => AuthUser.fromJson(
    ApiContract.data(await _api.get('auth/me'), status: 200),
  );

  Future<void> logout() async {
    final data = ApiContract.data(await _api.post('auth/logout'), status: 200);
    if (data != null) ApiContract.invalid();
  }
}
