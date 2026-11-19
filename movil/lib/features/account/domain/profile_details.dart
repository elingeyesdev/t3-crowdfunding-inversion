import 'entrepreneur_profile.dart';
import 'entrepreneur_profile_requests.dart';
import 'field_update.dart';
import 'investor_profile.dart';
import 'investor_profile_requests.dart';

enum ProfileKind {
  investor('investor', 'donante'),
  entrepreneur('entrepreneur', 'emprendedor');

  const ProfileKind(this.role, this.label);
  final String role;
  final String label;
}

/// Solo los campos editables del contrato móvil; excluye capital, KYC y bancos.
class ProfileDetails {
  ProfileDetails({required this.userId, required Map<String, String?> values})
    : values = Map.unmodifiable(values);

  factory ProfileDetails.investor(InvestorProfile p) => ProfileDetails(
    userId: p.userId,
    values: {
      'firstName': p.firstName,
      'lastName': p.lastName,
      'displayName': p.displayName,
      'bio': p.bio,
      'city': p.city,
      'state': p.state,
      'country': p.country,
      'postalCode': p.postalCode,
      'investorType': p.investorType,
      'addressLine1': p.addressLine1,
      'addressLine2': p.addressLine2,
    },
  );

  factory ProfileDetails.entrepreneur(EntrepreneurProfile p) => ProfileDetails(
    userId: p.userId,
    values: {
      'firstName': p.firstName,
      'lastName': p.lastName,
      'displayName': p.displayName,
      'bio': p.bio,
      'city': p.city,
      'state': p.state,
      'country': p.country,
      'postalCode': p.postalCode,
      'companyName': p.companyName,
      'addressLine': p.addressLine,
      'website': p.website,
      'linkedinUrl': p.linkedinUrl,
    },
  );

  final String userId;
  final Map<String, String?> values;

  @override
  String toString() => 'ProfileDetails(redacted)';
}

class ProfileField {
  const ProfileField(
    this.name,
    this.label, {
    this.max = 255,
    this.required = false,
    this.url = false,
  });
  final String name, label;
  final int max;
  final bool required, url;

  String? validate(String? value) {
    final text = (value ?? '').trim();
    if (required && text.runes.length < 2) {
      return 'Ingresa al menos 2 caracteres.';
    }
    if (text.runes.length > max) return 'Admite hasta $max caracteres.';
    if (url && text.isNotEmpty) {
      final uri = Uri.tryParse(text);
      if (uri == null ||
          !['http', 'https'].contains(uri.scheme) ||
          uri.host.isEmpty ||
          uri.userInfo.isNotEmpty ||
          RegExp(r'\s').hasMatch(text)) {
        return 'Ingresa una dirección completa con http:// o https://.';
      }
    }
    return null;
  }

  static List<ProfileField> forKind(ProfileKind kind) => [
    const ProfileField('firstName', 'Nombres', max: 100, required: true),
    const ProfileField('lastName', 'Apellidos', max: 100, required: true),
    const ProfileField('displayName', 'Nombre público', max: 150),
    const ProfileField('bio', 'Acerca de mí', max: 2000),
    const ProfileField('city', 'Ciudad'),
    const ProfileField('state', 'Departamento o provincia'),
    const ProfileField('country', 'País'),
    const ProfileField('postalCode', 'Código postal'),
    if (kind == ProfileKind.investor) ...[
      const ProfileField('addressLine1', 'Dirección'),
      const ProfileField('addressLine2', 'Complemento de dirección'),
    ] else ...[
      const ProfileField('companyName', 'Nombre de la organización'),
      const ProfileField('addressLine', 'Dirección'),
      const ProfileField('website', 'Sitio web', max: 512, url: true),
      const ProfileField('linkedinUrl', 'LinkedIn', max: 512, url: true),
    ],
  ];
}

/// Construye escrituras parciales: omitir conserva; null limpia un campo opcional.
class ProfileChanges {
  ProfileChanges(this.values, this.previous);
  final Map<String, String?> values;
  final ProfileDetails? previous;

  FieldUpdate<String?> _optional(String key) =>
      !values.containsKey(key) || values[key] == previous?.values[key]
      ? const FieldUpdate.absent()
      : FieldUpdate.value(values[key]);
  FieldUpdate<String> _required(String key) =>
      !values.containsKey(key) || values[key] == previous?.values[key]
      ? const FieldUpdate.absent()
      : FieldUpdate.value(values[key]!);

  InvestorType? get _type => InvestorType.values
      .where((t) => t.name == values['investorType'])
      .firstOrNull;

  CreateInvestorProfileRequest createInvestor() => CreateInvestorProfileRequest(
    firstName: values['firstName']!,
    lastName: values['lastName']!,
    displayName: values['displayName'],
    bio: values['bio'],
    city: values['city'],
    state: values['state'],
    country: values['country'],
    postalCode: values['postalCode'],
    addressLine1: values['addressLine1'],
    addressLine2: values['addressLine2'],
    investorType: _type,
  );

  UpdateInvestorProfileRequest updateInvestor() => UpdateInvestorProfileRequest(
    firstName: _required('firstName'),
    lastName: _required('lastName'),
    displayName: _optional('displayName'),
    bio: _optional('bio'),
    city: _optional('city'),
    state: _optional('state'),
    country: _optional('country'),
    postalCode: _optional('postalCode'),
    addressLine1: _optional('addressLine1'),
    addressLine2: _optional('addressLine2'),
    investorType:
        _type == null ||
            values['investorType'] == previous?.values['investorType']
        ? const FieldUpdate.absent()
        : FieldUpdate.value(_type!),
  );

  CreateEntrepreneurProfileRequest createEntrepreneur() =>
      CreateEntrepreneurProfileRequest(
        firstName: values['firstName']!,
        lastName: values['lastName']!,
        displayName: values['displayName'],
        bio: values['bio'],
        city: values['city'],
        state: values['state'],
        country: values['country'],
        postalCode: values['postalCode'],
        companyName: values['companyName'],
        addressLine: values['addressLine'],
        website: values['website'],
        linkedinUrl: values['linkedinUrl'],
      );

  UpdateEntrepreneurProfileRequest updateEntrepreneur() =>
      UpdateEntrepreneurProfileRequest(
        firstName: _required('firstName'),
        lastName: _required('lastName'),
        displayName: _optional('displayName'),
        bio: _optional('bio'),
        city: _optional('city'),
        state: _optional('state'),
        country: _optional('country'),
        postalCode: _optional('postalCode'),
        companyName: _optional('companyName'),
        addressLine: _optional('addressLine'),
        website: _optional('website'),
        linkedinUrl: _optional('linkedinUrl'),
      );
}
