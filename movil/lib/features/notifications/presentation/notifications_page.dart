import 'package:flutter/material.dart';

import '../../../shared/widgets/feature_pending_view.dart';

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      child: FeaturePendingView(
        icon: Icons.notifications_outlined,
        title: 'Notificaciones',
        description:
            'Aquí podrás consultar los avisos relacionados con tus '
            'campañas y aportes.',
      ),
    );
  }
}
