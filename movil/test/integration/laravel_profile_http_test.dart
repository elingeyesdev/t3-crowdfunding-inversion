import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:movil/core/config/app_config.dart';
import 'package:movil/core/network/api_client.dart';
import 'package:movil/core/network/api_exception.dart';
import 'package:movil/features/account/application/account_profile_controller.dart';
import 'package:movil/features/account/domain/profile_details.dart';
import 'package:movil/features/auth/application/app_dependencies.dart';
import 'package:movil/features/auth/data/auth_repository.dart';
import 'package:movil/features/auth/domain/auth_requests.dart';

import '../features/auth/auth_test_support.dart' show MemorySessionStore;

// Solo ejecutar con una API local y una base de pruebas aisladas, como se
// documenta en docs/issue-25-acceso-perfil.md. Crea datos y revoca sus tokens.
const apiUrl = String.fromEnvironment('UNIFUNDME_TEST_API_URL');
const isolated = bool.fromEnvironment('UNIFUNDME_ISOLATED_TEST');

// Flutter puede sustituir HttpClient en las pruebas de widgets. Esta prueba
// optativa necesita transporte real, limitado al servidor local desechable.
class _LocalHttpOverrides extends HttpOverrides {}

Future<void> waitForProfile(AccountProfileController controller) async {
  if (controller.status != ProfileStatus.loading) return;
  final done = Completer<void>();
  void listener() {
    if (controller.status != ProfileStatus.loading) {
      controller.removeListener(listener);
      done.complete();
    }
  }

  controller.addListener(listener);
  try {
    await done.future.timeout(const Duration(seconds: 20));
  } finally {
    controller.removeListener(listener);
  }
}

void main() {
  for (final kind in ProfileKind.values) {
    test(
      'Laravel HTTP real: ${kind.name}, registro, sesión, crear, editar y revocar',
      () => HttpOverrides.runWithHttpOverrides(() async {
        expect(
          ['127.0.0.1', 'localhost'],
          contains(Uri.parse(apiUrl).host),
          reason: 'La prueba solo admite el servidor local desechable.',
        );
        final client = http.Client();
        final config = AppConfig.fromValues(apiBaseUrl: apiUrl);
        final deps = AppDependencies.create(
          config,
          client: client,
          store: MemorySessionStore(),
        );
        AccountProfileController? profile;
        addTearDown(() {
          profile?.dispose();
          deps.dispose();
          client.close();
        });
        final email =
            'mobile-${kind.role}-${DateTime.now().microsecondsSinceEpoch}@example.test';
        const password = 'OnlyDisposableTest7';
        final registered = await deps.auth.register(
          RegisterRequest(
            email: email,
            password: password,
            signupRole: kind == ProfileKind.investor
                ? SignupRole.investor
                : SignupRole.entrepreneur,
          ),
        );
        expect(registered.user.roles, [kind.role]);
        final attempt = deps.session.beginAuthentication();
        final response = await deps.auth.login(
          LoginRequest(email: email, password: password),
        );
        await deps.session.acceptLogin(attempt, response);
        final token = deps.session.accessToken!;
        profile = AccountProfileController(deps, kind);
        final controller = profile;
        await waitForProfile(controller);
        expect(controller.status, ProfileStatus.missing);
        expect(
          await controller.save({
            'firstName': 'Ana',
            'lastName': 'Flores',
            'bio': 'Perfil de prueba HTTP',
            'city': 'Santa Cruz',
            if (kind == ProfileKind.investor) 'investorType': 'individual',
            if (kind == ProfileKind.entrepreneur)
              'website': 'https://example.test',
          }),
          true,
        );
        expect(controller.details!.userId, registered.user.id);
        expect(await controller.load(), true);
        expect(controller.details!.values['bio'], 'Perfil de prueba HTTP');
        expect(
          await controller.save({
            ...controller.details!.values,
            'bio': '',
            'city': 'Montero',
          }),
          true,
        );
        expect(await controller.load(), true);
        expect(controller.details!.values['bio'], null);
        expect(controller.details!.values['city'], 'Montero');

        await deps.restore();
        await waitForProfile(controller);
        expect(deps.session.accessToken == token, isTrue);
        expect(controller.details!.values['city'], 'Montero');
        final user = await deps.authenticated(
          (api) => AuthRepository(api).me(),
        );
        expect(user.roles, [kind.role]);
        final logout = await deps.logout();
        expect(logout!.localCleared, true);
        expect(deps.session.accessToken, null);
        expect(controller.details, null);
        await expectLater(
          AuthRepository(
            ApiClient(
              client: client,
              config: config,
              tokenProvider: () => token,
            ),
          ).me(),
          throwsA(
            isA<ApiException>().having(
              (error) => error.statusCode,
              'status',
              401,
            ),
          ),
        );
      }, _LocalHttpOverrides()),
      skip: apiUrl.isEmpty || !isolated,
    );
  }
}
