import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../auth/application/app_dependencies.dart';
import '../../auth/application/session_state.dart';
import '../../auth/presentation/auth_messages.dart';
import '../../auth/presentation/session_status_view.dart';

class AccountPage extends StatelessWidget {
  const AccountPage({super.key, required this.dependencies});
  final AppDependencies dependencies;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: dependencies.session,
    builder: (context, _) {
      final state = dependencies.session.state;
      return ValueListenableBuilder<LogoutResult?>(
        valueListenable: dependencies.logoutResult,
        builder: (context, result, _) {
          final user =
              state.status == SessionStatus.authenticated &&
                  dependencies.session.accessToken != null
              ? state.user
              : null;
          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Cuenta',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  if (result != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        AuthMessages.logout(result),
                        key: const Key('account.logoutResult'),
                      ),
                    ),
                  if ([
                    SessionStatus.checking,
                    SessionStatus.closing,
                    SessionStatus.recoverableError,
                  ].contains(state.status))
                    SessionStatusView(dependencies: dependencies)
                  else if (user != null) ...[
                    const SizedBox(height: 24),
                    Text(user.email, key: const Key('account.email')),
                    if (user.phone != null) Text(user.phone!),
                    const SizedBox(height: 16),
                    Text(
                      user.roles.isEmpty
                          ? 'Sin roles asignados'
                          : 'Roles: ${user.roles.join(', ')}',
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      key: const Key('account.logout'),
                      onPressed: () => dependencies.logout(),
                      child: const Text('Cerrar sesión'),
                    ),
                  ] else ...[
                    const SizedBox(height: 16),
                    Text(
                      state.issue == null
                          ? 'Accede a tu cuenta para continuar.'
                          : AuthMessages.issue(state.issue),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => context.pushNamed(AppRoutes.accessName),
                      child: const Text('Ir a Acceso'),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      );
    },
  );
}
