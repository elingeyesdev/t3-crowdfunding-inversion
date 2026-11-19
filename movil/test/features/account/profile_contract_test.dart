import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_client.dart';
import 'package:movil/core/network/api_exception.dart';
import 'package:movil/features/account/data/profile_repository.dart';
import 'package:movil/features/account/domain/field_update.dart';
import 'package:movil/features/account/domain/investor_profile.dart';
import 'package:movil/features/account/domain/investor_profile_requests.dart';
import 'package:movil/features/account/domain/entrepreneur_profile.dart';
import 'package:movil/features/account/domain/entrepreneur_profile_requests.dart';

Map<String, Object?> profileFixture() => {
  'id': 'profile-test',
  'userId': 'user-test',
  'firstName': 'Ana',
  'lastName': 'Prueba',
  'displayName': null,
  'bio': null,
  'city': 'Santa Cruz',
  'investorType': 'future-type',
  'companyName': 'Empresa de prueba',
  'website': 'https://example.com',
  'bankAccountNumber': 'sensitive-ignored',
  'verificationDocuments': ['ignored'],
  'unknown': true,
};

void main() {
  test(
    'modelos separados permiten nulos y extras sin conservar campos sensibles',
    () {
      final investor = InvestorProfile.fromJson(profileFixture());
      final entrepreneur = EntrepreneurProfile.fromJson(profileFixture());
      expect(investor.userId, 'user-test');
      expect(investor.displayName, isNull);
      expect(investor.investorType, 'future-type');
      expect(entrepreneur.companyName, 'Empresa de prueba');
      expect(entrepreneur.website, 'https://example.com');
      expect(investor.toString(), isNot(contains('sensitive-ignored')));
      expect(entrepreneur.toString(), isNot(contains('sensitive-ignored')));
    },
  );

  for (final key in ['id', 'userId', 'firstName', 'website', 'investorType']) {
    test('rechaza tipos inválidos de perfil: $key', () {
      final fixture = {...profileFixture(), key: 42};
      final parse = key == 'website'
          ? EntrepreneurProfile.fromJson
          : InvestorProfile.fromJson;
      expect(() => parse(fixture), throwsA(isA<ApiException>()));
    });
  }

  test(
    'actualizaciones distinguen omitido, null y valor sin enviar extras',
    () {
      const request = UpdateInvestorProfileRequest(
        displayName: FieldUpdate.value(null),
        city: FieldUpdate.value('Montero'),
        investorType: FieldUpdate.value(InvestorType.angel),
      );
      expect(request.toJson(), {
        'displayName': null,
        'city': 'Montero',
        'investorType': 'angel',
      });
      expect(const UpdateInvestorProfileRequest().toJson(), isEmpty);
      expect(
        const UpdateEntrepreneurProfileRequest(
          bio: FieldUpdate.value(null),
          website: FieldUpdate.value('https://example.com'),
        ).toJson(),
        {'bio': null, 'website': 'https://example.com'},
      );
      expect(() => const FieldUpdate<String>.absent().value, throwsStateError);
    },
  );

  test('creación incluye nombres y únicamente campos del tipo correcto', () {
    const investor = CreateInvestorProfileRequest(
      firstName: 'Ana',
      lastName: 'Prueba',
      investorType: InvestorType.institutional,
      addressLine1: 'Dirección de prueba',
    );
    const entrepreneur = CreateEntrepreneurProfileRequest(
      firstName: 'Ana',
      lastName: 'Prueba',
      companyName: 'Empresa',
      linkedinUrl: 'https://example.com',
    );
    expect(investor.toJson(), {
      'firstName': 'Ana',
      'lastName': 'Prueba',
      'investorType': 'institutional',
      'addressLine1': 'Dirección de prueba',
    });
    expect(entrepreneur.toJson(), {
      'firstName': 'Ana',
      'lastName': 'Prueba',
      'companyName': 'Empresa',
      'linkedinUrl': 'https://example.com',
    });
  });

  test('seis operaciones usan GET/POST/PUT, envolturas y Bearer', () async {
    final observed = <String>[];
    final client = MockClient((request) async {
      observed.add('${request.method} ${request.url.path}');
      expect(request.headers['Authorization'], 'Bearer 2|synthetic');
      expect(request.followRedirects, isFalse);
      if (request.method == 'POST') {
        expect(jsonDecode(request.body), {
          'firstName': 'Ana',
          'lastName': 'Prueba',
        });
      }
      if (request.method == 'PUT') {
        expect(jsonDecode(request.body), {'bio': null});
      }
      final status = request.method == 'POST' ? 201 : 200;
      return http.Response(
        jsonEncode({
          'data': profileFixture(),
          'statusCode': status,
          'message': 'Operación exitosa',
        }),
        status,
        headers: {'content-type': 'application/json'},
      );
    });
    addTearDown(client.close);
    final repo = ProfileRepository(
      ApiClient(
        client: client,
        config: AppConfig.fromValues(
          apiBaseUrl: 'https://api.example.com/api/v1',
        ),
        tokenProvider: () => '2|synthetic',
      ),
    );
    expect((await repo.getInvestorProfile()).id, 'profile-test');
    await repo.createInvestorProfile(
      const CreateInvestorProfileRequest(firstName: 'Ana', lastName: 'Prueba'),
    );
    await repo.updateInvestorProfile(
      const UpdateInvestorProfileRequest(bio: FieldUpdate.value(null)),
    );
    await repo.getEntrepreneurProfile();
    await repo.createEntrepreneurProfile(
      const CreateEntrepreneurProfileRequest(
        firstName: 'Ana',
        lastName: 'Prueba',
      ),
    );
    await repo.updateEntrepreneurProfile(
      const UpdateEntrepreneurProfileRequest(bio: FieldUpdate.value(null)),
    );
    expect(observed, [
      'GET /api/v1/investors/me/profile',
      'POST /api/v1/investors/me/profile',
      'PUT /api/v1/investors/me/profile',
      'GET /api/v1/entrepreneurs/me/profile',
      'POST /api/v1/entrepreneurs/me/profile',
      'PUT /api/v1/entrepreneurs/me/profile',
    ]);
  });

  for (final status in [401, 403, 404, 409, 422, 429]) {
    test(
      'perfil propaga $status sin crear, transformar ni reintentar',
      () async {
        var calls = 0;
        final client = MockClient((_) async {
          calls++;
          return http.Response('{}', status);
        });
        addTearDown(client.close);
        final repo = ProfileRepository(
          ApiClient(
            client: client,
            config: AppConfig.fromValues(
              apiBaseUrl: 'https://api.example.com/api/v1',
            ),
          ),
        );
        await expectLater(
          repo.getInvestorProfile(),
          throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'HTTP', status),
          ),
        );
        expect(calls, 1);
      },
    );
  }

  for (final (index, data) in [
    null,
    [],
    {'firstName': 'Ana'},
    {...profileFixture(), 'userId': null},
  ].indexed) {
    test('repositorio rechaza perfil malformado $index', () async {
      final client = MockClient(
        (_) async =>
            http.Response(jsonEncode({'data': data, 'statusCode': 200}), 200),
      );
      addTearDown(client.close);
      final repo = ProfileRepository(
        ApiClient(
          client: client,
          config: AppConfig.fromValues(
            apiBaseUrl: 'https://api.example.com/api/v1',
          ),
        ),
      );
      await expectLater(
        repo.getEntrepreneurProfile(),
        throwsA(
          isA<ApiException>().having(
            (e) => e.kind,
            'kind',
            ApiErrorKind.invalidResponse,
          ),
        ),
      );
    });
  }
}
