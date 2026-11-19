import '../../auth/domain/api_contract.dart';

class InvestorProfile {
  const InvestorProfile({
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
    this.investorType,
    this.addressLine1,
    this.addressLine2,
  });

  factory InvestorProfile.fromJson(Object? value) {
    final json = ApiContract.object(value);
    return InvestorProfile(
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
      investorType: ApiContract.optionalString(json, 'investorType'),
      addressLine1: ApiContract.optionalString(json, 'addressLine1'),
      addressLine2: ApiContract.optionalString(json, 'addressLine2'),
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
  final String? investorType;
  final String? addressLine1;
  final String? addressLine2;
}
