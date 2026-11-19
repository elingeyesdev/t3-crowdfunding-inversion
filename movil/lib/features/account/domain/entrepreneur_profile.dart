import '../../auth/domain/api_contract.dart';

class EntrepreneurProfile {
  const EntrepreneurProfile({
    required this.id,
    required this.userId,
    this.firstName,
    this.lastName,
    this.displayName,
    this.bio,
    this.city,
    this.state,
    this.country,
    this.postalCode,
    this.companyName,
    this.addressLine,
    this.website,
    this.linkedinUrl,
  });

  factory EntrepreneurProfile.fromJson(Object? value) {
    final json = ApiContract.object(value);
    return EntrepreneurProfile(
      id: ApiContract.string(json, 'id'),
      userId: ApiContract.string(json, 'userId'),
      firstName: ApiContract.optionalString(json, 'firstName'),
      lastName: ApiContract.optionalString(json, 'lastName'),
      displayName: ApiContract.optionalString(json, 'displayName'),
      bio: ApiContract.optionalString(json, 'bio'),
      city: ApiContract.optionalString(json, 'city'),
      state: ApiContract.optionalString(json, 'state'),
      country: ApiContract.optionalString(json, 'country'),
      postalCode: ApiContract.optionalString(json, 'postalCode'),
      companyName: ApiContract.optionalString(json, 'companyName'),
      addressLine: ApiContract.optionalString(json, 'addressLine'),
      website: ApiContract.optionalString(json, 'website'),
      linkedinUrl: ApiContract.optionalString(json, 'linkedinUrl'),
    );
  }

  final String id;
  final String userId;
  final String? firstName;
  final String? lastName;
  final String? displayName;
  final String? bio;
  final String? city;
  final String? state;
  final String? country;
  final String? postalCode;
  final String? companyName;
  final String? addressLine;
  final String? website;
  final String? linkedinUrl;
}
