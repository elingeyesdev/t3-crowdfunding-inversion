import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movil/features/account/application/account_profile_controller.dart';
import 'package:movil/features/account/domain/profile_details.dart';
import 'package:movil/features/auth/domain/auth_session.dart';

import '../auth/auth_test_support.dart';

Map<String, Object?> profileData({
  String name = 'Ana',
  String userId = 'synthetic-user',
}) => {
  'id': 'profile-id',
  'userId': userId,
  'firstName': name,
  'lastName': 'Flores',
  'bio': 'Biografía anterior',
  'city': 'Santa Cruz',
  'investorType': 'individual',
};

Future<void> loaded(AccountProfileController controller) {
  if (controller.status != ProfileStatus.loading) return Future.value();
  final done = Completer<void>();
  void listener() {
    if (controller.status != ProfileStatus.loading && !done.isCompleted) {
      controller.removeListener(listener);
      done.complete();
    }
  }

  controller.addListener(listener);
  return done.future;
}

void main() {
  test(
    '404 permite completar explícitamente, sin crear ni adquirir otro rol',
    () async {
      final requests = <http.Request>[];
      final deps = testDependencies(
        handler: (r) async {
          requests.add(r);
          return testResponse(null, status: 404);
        },
      );
      await authenticateTest(deps);
      final c = AccountProfileController(deps, ProfileKind.investor);
      addTearDown(() {
        c.dispose();
        deps.dispose();
      });
      await loaded(c);
      expect(c.status, ProfileStatus.missing);
      expect(requests.single.method, 'GET');
      expect(requests.single.url.path, '/api/v1/investors/me/profile');
      expect(
        requests.single.headers['authorization'],
        'Bearer 1|synthetic-only',
      );
    },
  );

  for (final kind in ProfileKind.values) {
    test(
      '${kind.name}: crear, cargar respuesta persistida y editar con PUT parcial',
      () async {
        final writes = <http.Request>[];
        var exists = false;
        final saved = profileData();
        final deps = testDependencies(
          handler: (r) async {
            expect(
              r.url.path,
              '/api/v1/${kind == ProfileKind.investor ? 'investors' : 'entrepreneurs'}/me/profile',
            );
            if (r.method == 'GET') {
              return testResponse(
                exists ? saved : null,
                status: exists ? 200 : 404,
              );
            }
            writes.add(r);
            saved.addAll((jsonDecode(r.body) as Map).cast<String, Object?>());
            exists = true;
            return testResponse(saved, status: r.method == 'POST' ? 201 : 200);
          },
        );
        await authenticateTest(deps);
        final c = AccountProfileController(deps, kind);
        addTearDown(() {
          c.dispose();
          deps.dispose();
        });
        await loaded(c);
        expect(
          await c.save({
            'firstName': ' Ana ',
            'lastName': 'Flores',
            'bio': 'Hola',
          }),
          true,
        );
        expect(writes.single.method, 'POST');
        expect(c.details!.values['firstName'], 'Ana');
        expect(c.message, 'Perfil guardado.');
        expect(await c.save({...c.details!.values, 'bio': ''}), true);
        expect(writes.last.method, 'PUT');
        expect(jsonDecode(writes.last.body), {'bio': null});
        expect(c.details!.values['bio'], null);
      },
    );
  }

  test('un rol ajeno o desconocido no consulta ni crea perfiles', () async {
    var requests = 0;
    final deps = testDependencies(
      handler: (_) async {
        requests++;
        return testResponse(profileData());
      },
    );
    final attempt = deps.session.beginAuthentication();
    await deps.session.acceptLogin(
      attempt,
      LoginResponse.fromJson({
        'statusCode': 200,
        'data': {
          ...testLoginData(),
          'user': testUser(roles: ['entrepreneur', 'future_role']),
        },
      }),
    );
    final c = AccountProfileController(deps, ProfileKind.investor);
    addTearDown(() {
      c.dispose();
      deps.dispose();
    });
    expect(c.allowed, false);
    expect(await c.load(), false);
    expect(await c.save({'firstName': 'Ana', 'lastName': 'Flores'}), false);
    expect(requests, 0);
  });

  test(
    'valida límites y URL antes de enviar; ignora capital, KYC y campos ajenos',
    () async {
      final writes = <http.Request>[];
      final deps = testDependencies(
        handler: (r) async {
          if (r.method != 'GET') writes.add(r);
          return testResponse(profileData());
        },
      );
      await authenticateTest(deps);
      final c = AccountProfileController(deps, ProfileKind.entrepreneur);
      addTearDown(() {
        c.dispose();
        deps.dispose();
      });
      await loaded(c);
      expect(
        await c.save({
          'firstName': 'A',
          'lastName': 'Flores',
          'website': 'javascript:bad',
        }),
        false,
      );
      expect(c.fieldErrors.keys, containsAll(['firstName', 'website']));
      expect(writes, isEmpty);
      expect(
        await c.save({
          ...c.details!.values,
          'bankAccountNumber': 'secret',
          'kycStatus': 'approved',
          'maxInvestment': '100000',
        }),
        true,
      );
      final payload = jsonDecode(writes.single.body) as Map;
      expect(payload.keys, isNot(contains('bankAccountNumber')));
      expect(payload.keys, isNot(contains('kycStatus')));
      expect(payload.keys, isNot(contains('maxInvestment')));
    },
  );

  test('tipo de inversor desconocido se conserva sin reenviarlo', () async {
    http.Request? write;
    final deps = testDependencies(
      handler: (r) async {
        if (r.method != 'GET') write = r;
        return testResponse({...profileData(), 'investorType': 'future_type'});
      },
    );
    await authenticateTest(deps);
    final c = AccountProfileController(deps, ProfileKind.investor);
    addTearDown(() {
      c.dispose();
      deps.dispose();
    });
    await loaded(c);
    expect(await c.save({...c.details!.values, 'firstName': 'Andrea'}), true);
    expect(jsonDecode(write!.body), {'firstName': 'Andrea'});
  });

  test(
    '422 conserva el perfil y expone solo mensajes de validación sanitizados',
    () async {
      final deps = testDependencies(
        handler: (r) async => r.method == 'GET'
            ? testResponse(profileData())
            : http.Response(
                jsonEncode({
                  'errors': {
                    'displayName': ['secret-token-in-response'],
                  },
                }),
                422,
                headers: {'content-type': 'application/json'},
              ),
      );
      await authenticateTest(deps);
      final c = AccountProfileController(deps, ProfileKind.investor);
      addTearDown(() {
        c.dispose();
        deps.dispose();
      });
      await loaded(c);
      expect(
        await c.save({...c.details!.values, 'displayName': 'ocupado'}),
        false,
      );
      expect(c.details!.values['firstName'], 'Ana');
      expect(c.needsReload, false);
      expect(c.fieldErrors['displayName'], ['Revisa el valor de este campo.']);
      expect(c.message, isNot(contains('secret-token')));
    },
  );

  for (final code in [409, 500]) {
    test(
      '$code no reintenta escrituras y exige reconciliar antes de reenviar',
      () async {
        var writes = 0, reads = 0;
        final deps = testDependencies(
          handler: (r) async {
            if (r.method == 'GET') {
              reads++;
              return testResponse(profileData());
            }
            writes++;
            return testResponse(null, status: code);
          },
        );
        await authenticateTest(deps);
        final c = AccountProfileController(deps, ProfileKind.investor);
        addTearDown(() {
          c.dispose();
          deps.dispose();
        });
        await loaded(c);
        final draft = {...c.details!.values, 'firstName': 'Andrea'};
        expect(await c.save(draft), false);
        expect(c.needsReload, true);
        expect(await c.save(draft), false);
        expect(writes, 1);
        expect(await c.load(), true);
        expect(c.needsReload, false);
        expect(reads, 2);
      },
    );
  }

  test('doble envío se bloquea mientras hay una escritura en curso', () async {
    final response = Completer<http.Response>();
    var writes = 0;
    final deps = testDependencies(
      handler: (r) async {
        if (r.method == 'GET') return testResponse(profileData());
        writes++;
        return response.future;
      },
    );
    await authenticateTest(deps);
    final c = AccountProfileController(deps, ProfileKind.investor);
    addTearDown(() {
      c.dispose();
      deps.dispose();
    });
    await loaded(c);
    final draft = {...c.details!.values, 'firstName': 'Andrea'};
    final first = c.save(draft);
    expect(c.status, ProfileStatus.saving);
    expect(await c.save(draft), false);
    response.complete(testResponse(profileData(name: 'Andrea')));
    expect(await first, true);
    expect(writes, 1);
  });

  test('logout descarta inmediatamente perfil y respuesta tardía', () async {
    final pending = Completer<http.Response>();
    final deps = testDependencies(
      handler: (r) async =>
          r.url.path.endsWith('logout') ? testResponse(null) : pending.future,
    );
    await authenticateTest(deps);
    final c = AccountProfileController(deps, ProfileKind.investor);
    addTearDown(() {
      c.dispose();
      deps.dispose();
    });
    await deps.logout();
    pending.complete(testResponse(profileData()));
    await Future<void>.delayed(Duration.zero);
    expect(c.details, null);
    expect(c.allowed, false);
    expect(c.status, ProfileStatus.unavailable);
  });

  test('401 en una consulta invalida la sesión y limpia el perfil', () async {
    final deps = testDependencies(
      handler: (_) async => testResponse(null, status: 401),
    );
    await authenticateTest(deps);
    final c = AccountProfileController(deps, ProfileKind.investor);
    addTearDown(() {
      c.dispose();
      deps.dispose();
    });
    await loaded(c);
    expect(deps.session.accessToken, null);
    expect(c.details, null);
    expect(c.status, ProfileStatus.unavailable);
  });

  test(
    'restaurar sesión vuelve a consultar sin reutilizar datos anteriores',
    () async {
      var reads = 0;
      final deps = testDependencies(
        handler: (r) async {
          if (r.url.path.endsWith('auth/me')) return testResponse(testUser());
          reads++;
          return testResponse(profileData(name: reads == 1 ? 'Ana' : 'Andrea'));
        },
      );
      await authenticateTest(deps);
      final c = AccountProfileController(deps, ProfileKind.investor);
      addTearDown(() {
        c.dispose();
        deps.dispose();
      });
      await loaded(c);
      await deps.restore();
      await loaded(c);
      expect(reads, 2);
      expect(c.details!.values['firstName'], 'Andrea');
    },
  );

  test('rechaza respuestas con un propietario distinto', () async {
    final deps = testDependencies(
      handler: (_) async => testResponse(profileData(userId: 'another-user')),
    );
    await authenticateTest(deps);
    final c = AccountProfileController(deps, ProfileKind.investor);
    addTearDown(() {
      c.dispose();
      deps.dispose();
    });
    await loaded(c);
    expect(c.status, ProfileStatus.error);
    expect(c.details, null);
  });

  test(
    'validadores respetan Unicode, límites y protocolos de los formularios',
    () {
      final fields = {
        for (final f in ProfileField.forKind(ProfileKind.entrepreneur))
          f.name: f,
      };
      expect(fields['firstName']!.validate('Áé'), null);
      expect(fields['firstName']!.validate('😀' * 101), isNotNull);
      expect(fields['bio']!.validate('a' * 2001), isNotNull);
      expect(fields['website']!.validate('ftp://example.com'), isNotNull);
      expect(fields['website']!.validate('https://example.com'), null);
      expect(fields['website']!.validate(''), null);
    },
  );
}
