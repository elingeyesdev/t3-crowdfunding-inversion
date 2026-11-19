import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../application/app_dependencies.dart';
import '../application/session_state.dart';
import 'auth_messages.dart';

class SessionStatusView extends StatelessWidget {
  const SessionStatusView({super.key, required this.dependencies});
  final AppDependencies dependencies;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: dependencies.session,
    builder: (context, _) {
      final state = dependencies.session.state;
      final busy =
          state.status == SessionStatus.checking ||
          state.status == SessionStatus.closing;
      return SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                busy
                    ? (state.status == SessionStatus.closing
                          ? 'Cerrando sesión…'
                          : 'Comprobando sesión…')
                    : 'Sesión pendiente de validación',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              if (busy)
                const CircularProgressIndicator()
              else ...[
                Text(AuthMessages.issue(state.issue)),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () => dependencies.restore(),
                  child: const Text('Reintentar validación'),
                ),
                TextButton(
                  onPressed: () => dependencies.session.discardStoredSession(),
                  child: const Text('Eliminar credenciales locales'),
                ),
              ],
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => context.go(AppRoutes.explore),
                child: const Text('Continuar en Explorar'),
              ),
            ],
          ),
        ),
      );
    },
  );
}
