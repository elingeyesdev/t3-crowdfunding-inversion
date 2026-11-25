import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../auth/application/app_dependencies.dart';
import '../../auth/application/session_state.dart';

/// La generación destruye inmediatamente cualquier vista privada anterior.
class InvestorGate extends StatelessWidget {
  const InvestorGate({
    super.key,
    required this.dependencies,
    required this.builder,
  });
  final AppDependencies dependencies;
  final Widget Function() builder;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: dependencies.session,
    builder: (_, _) {
      if (dependencies.session.state.status != SessionStatus.authenticated ||
          dependencies.session.accessToken == null ||
          dependencies.session.state.user?.roles.contains('investor') != true) {
        return Scaffold(
          appBar: AppBar(title: const Text('Aportes')),
          body: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const Text('Esta función requiere una sesión de donante.'),
              TextButton(
                onPressed: () => context.go(AppRoutes.account),
                child: const Text('Ir a Cuenta'),
              ),
            ],
          ),
        );
      }
      return KeyedSubtree(
        key: ValueKey(dependencies.session.generation),
        child: builder(),
      );
    },
  );
}
