import 'field_update.dart';

class CreateEntrepreneurProfileRequest {
  const CreateEntrepreneurProfileRequest({
    required this.firstName,
    required this.lastName,
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

  final String firstName;
  final String lastName;
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

  Map<String, Object?> toJson() => {
    'firstName': firstName,
    'lastName': lastName,
    if (displayName != null) 'displayName': displayName,
    if (bio != null) 'bio': bio,
    if (city != null) 'city': city,
    if (state != null) 'state': state,
    if (country != null) 'country': country,
    if (postalCode != null) 'postalCode': postalCode,
    if (companyName != null) 'companyName': companyName,
    if (addressLine != null) 'addressLine': addressLine,
    if (website != null) 'website': website,
    if (linkedinUrl != null) 'linkedinUrl': linkedinUrl,
  };
}

class UpdateEntrepreneurProfileRequest {
  const UpdateEntrepreneurProfileRequest({
    this.firstName = const FieldUpdate.absent(),
    this.lastName = const FieldUpdate.absent(),
    this.displayName = const FieldUpdate.absent(),
    this.bio = const FieldUpdate.absent(),
    this.city = const FieldUpdate.absent(),
    this.state = const FieldUpdate.absent(),
    this.country = const FieldUpdate.absent(),
    this.postalCode = const FieldUpdate.absent(),
    this.companyName = const FieldUpdate.absent(),
    this.addressLine = const FieldUpdate.absent(),
    this.website = const FieldUpdate.absent(),
    this.linkedinUrl = const FieldUpdate.absent(),
  });

  final FieldUpdate<String> firstName;
  final FieldUpdate<String> lastName;
  final FieldUpdate<String?> displayName;
  final FieldUpdate<String?> bio;
  final FieldUpdate<String?> city;
  final FieldUpdate<String?> state;
  final FieldUpdate<String?> country;
  final FieldUpdate<String?> postalCode;
  final FieldUpdate<String?> companyName;
  final FieldUpdate<String?> addressLine;
  final FieldUpdate<String?> website;
  final FieldUpdate<String?> linkedinUrl;

  Map<String, Object?> toJson() => {
    if (firstName.isPresent) 'firstName': firstName.value,
    if (lastName.isPresent) 'lastName': lastName.value,
    if (displayName.isPresent) 'displayName': displayName.value,
    if (bio.isPresent) 'bio': bio.value,
    if (city.isPresent) 'city': city.value,
    if (state.isPresent) 'state': state.value,
    if (country.isPresent) 'country': country.value,
    if (postalCode.isPresent) 'postalCode': postalCode.value,
    if (companyName.isPresent) 'companyName': companyName.value,
    if (addressLine.isPresent) 'addressLine': addressLine.value,
    if (website.isPresent) 'website': website.value,
    if (linkedinUrl.isPresent) 'linkedinUrl': linkedinUrl.value,
  };
}
