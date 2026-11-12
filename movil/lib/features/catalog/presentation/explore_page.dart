import 'package:flutter/material.dart';

import '../../../shared/widgets/feature_pending_view.dart';

class ExplorePage extends StatelessWidget {
  const ExplorePage({super.key});

  @override
  Widget build(BuildContext context) {
    return const SafeArea(
      child: FeaturePendingView(
        icon: Icons.explore_outlined,
        title: 'Explorar',
        description:
            'Aquí podrás descubrir campañas y conocer los proyectos que '
            'buscan apoyo.',
      ),
    );
  }
}
