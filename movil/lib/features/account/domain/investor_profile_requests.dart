import 'field_update.dart';

class CreateInvestorProfileRequest {
  const CreateInvestorProfileRequest({
    required this.firstName,
    required this.lastName,
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

  final String firstName;
  final String lastName;
  final String? displayName;
  final String? bio;
  final String? city;
  final String? state;
  final String? country;
  final String? postalCode;
  final InvestorType? investorType;
  final String? addressLine1;
  final String? addressLine2;

  Map<String, Object?> toJson() => {
    'firstName': firstName,
    'lastName': lastName,
    if (displayName != null) 'displayName': displayName,
    if (bio != null) 'bio': bio,
    if (city != null) 'city': city,
    if (state != null) 'state': state,
    if (country != null) 'country': country,
    if (postalCode != null) 'postalCode': postalCode,
    if (investorType != null) 'investorType': investorType!.name,
    if (addressLine1 != null) 'addressLine1': addressLine1,
    if (addressLine2 != null) 'addressLine2': addressLine2,
  };
}

class UpdateInvestorProfileRequest {
  const UpdateInvestorProfileRequest({
    this.firstName = const FieldUpdate.absent(),
    this.lastName = const FieldUpdate.absent(),
    this.displayName = const FieldUpdate.absent(),
    this.bio = const FieldUpdate.absent(),
    this.city = const FieldUpdate.absent(),
    this.state = const FieldUpdate.absent(),
    this.country = const FieldUpdate.absent(),
    this.postalCode = const FieldUpdate.absent(),
    this.investorType = const FieldUpdate.absent(),
    this.addressLine1 = const FieldUpdate.absent(),
    this.addressLine2 = const FieldUpdate.absent(),
  });

  final FieldUpdate<String> firstName;
  final FieldUpdate<String> lastName;
  final FieldUpdate<String?> displayName;
  final FieldUpdate<String?> bio;
  final FieldUpdate<String?> city;
  final FieldUpdate<String?> state;
  final FieldUpdate<String?> country;
  final FieldUpdate<String?> postalCode;
  final FieldUpdate<InvestorType> investorType;
  final FieldUpdate<String?> addressLine1;
  final FieldUpdate<String?> addressLine2;

  Map<String, Object?> toJson() => {
    if (firstName.isPresent) 'firstName': firstName.value,
    if (lastName.isPresent) 'lastName': lastName.value,
    if (displayName.isPresent) 'displayName': displayName.value,
    if (bio.isPresent) 'bio': bio.value,
    if (city.isPresent) 'city': city.value,
    if (state.isPresent) 'state': state.value,
    if (country.isPresent) 'country': country.value,
    if (postalCode.isPresent) 'postalCode': postalCode.value,
    if (investorType.isPresent) 'investorType': investorType.value.name,
    if (addressLine1.isPresent) 'addressLine1': addressLine1.value,
    if (addressLine2.isPresent) 'addressLine2': addressLine2.value,
  };
}
