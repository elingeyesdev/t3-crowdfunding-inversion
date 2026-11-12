import 'package:flutter/material.dart';

import '../../../shared/widgets/feature_pending_view.dart';

class TrackingPage extends StatelessWidget {
  const TrackingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      child: FeaturePendingView(
        icon: Icons.bookmark_outline,
        title: 'Seguimiento',
        description:
            'Aquí podrás consultar tus aportes y las novedades de los '
            'proyectos que apoyes.',
      ),
    );
  }
}
