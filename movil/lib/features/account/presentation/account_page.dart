import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../shared/widgets/feature_pending_view.dart';

class AccountPage extends StatelessWidget {
  const AccountPage({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: FeaturePendingView(
        icon: Icons.person_outline,
        title: 'Cuenta',
        description: 'Aquí podrás acceder a tu cuenta y administrar tu perfil.',
        action: FilledButton(
          onPressed: () => context.pushNamed<void>(AppRoutes.accessName),
          child: const Text('Ir a Acceso'),
        ),
      ),
    );
  }
}
