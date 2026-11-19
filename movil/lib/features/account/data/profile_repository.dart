import '../../../core/network/api_client.dart';
import '../../auth/domain/api_contract.dart';
import '../domain/investor_profile.dart';
import '../domain/investor_profile_requests.dart';
import '../domain/entrepreneur_profile.dart';
import '../domain/entrepreneur_profile_requests.dart';

/// No convierte 404 en creación ni inicia flujos de adquisición de roles.
/// Laravel añade el rol del tipo al guardar: el llamador debe respetar la
/// política que apruebe el equipo antes de exponer estas operaciones en la UI.
class ProfileRepository {
  const ProfileRepository(this._api);
  final ApiClient _api;

  Future<InvestorProfile> getInvestorProfile() async =>
      InvestorProfile.fromJson(
        ApiContract.data(await _api.get('investors/me/profile'), status: 200),
      );

  Future<InvestorProfile> createInvestorProfile(
    CreateInvestorProfileRequest request,
  ) async => InvestorProfile.fromJson(
    ApiContract.data(
      await _api.post('investors/me/profile', body: request.toJson()),
      status: 201,
    ),
  );

  Future<InvestorProfile> updateInvestorProfile(
    UpdateInvestorProfileRequest request,
  ) async => InvestorProfile.fromJson(
    ApiContract.data(
      await _api.put('investors/me/profile', body: request.toJson()),
      status: 200,
    ),
  );

  Future<EntrepreneurProfile> getEntrepreneurProfile() async =>
      EntrepreneurProfile.fromJson(
        ApiContract.data(
          await _api.get('entrepreneurs/me/profile'),
          status: 200,
        ),
      );

  Future<EntrepreneurProfile> createEntrepreneurProfile(
    CreateEntrepreneurProfileRequest request,
  ) async => EntrepreneurProfile.fromJson(
    ApiContract.data(
      await _api.post('entrepreneurs/me/profile', body: request.toJson()),
      status: 201,
    ),
  );

  Future<EntrepreneurProfile> updateEntrepreneurProfile(
    UpdateEntrepreneurProfileRequest request,
  ) async => EntrepreneurProfile.fromJson(
    ApiContract.data(
      await _api.put('entrepreneurs/me/profile', body: request.toJson()),
      status: 200,
    ),
  );
}
