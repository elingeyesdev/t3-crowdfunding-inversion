import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/presentation/account_page.dart';
import '../../features/catalog/presentation/explore_page.dart';
import '../../features/notifications/presentation/notifications_page.dart';
import '../../features/tracking/presentation/tracking_page.dart';
import '../../shared/widgets/feature_pending_view.dart';
import '../shell/main_shell.dart';
import 'app_routes.dart';

abstract final class AppRouter {
  static GoRouter create({String initialLocation = AppRoutes.root}) {
    return GoRouter(
      initialLocation: initialLocation,
      errorBuilder: (context, state) => const _NotFoundPage(),
      routes: [
        GoRoute(
          path: AppRoutes.root,
          redirect: (context, state) => AppRoutes.explore,
        ),
        GoRoute(
          path: AppRoutes.access,
          name: AppRoutes.accessName,
          builder: (context, state) => const _AccessPage(),
        ),
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) =>
              MainShell(navigationShell: navigationShell),
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.explore,
                  name: AppRoutes.exploreName,
                  builder: (context, state) => const ExplorePage(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.tracking,
                  name: AppRoutes.trackingName,
                  builder: (context, state) => const TrackingPage(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.notifications,
                  name: AppRoutes.notificationsName,
                  builder: (context, state) => const NotificationsPage(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.account,
                  name: AppRoutes.accountName,
                  builder: (context, state) => const AccountPage(),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

class _AccessPage extends StatelessWidget {
  const _AccessPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Acceso'),
        leading: BackButton(
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              // Apertura directa sin una pantalla de origen en la pila.
              context.goNamed(AppRoutes.exploreName);
            }
          },
        ),
      ),
      body: const SafeArea(
        child: FeaturePendingView(
          icon: Icons.login,
          title: 'Acceso',
          description: 'Próximamente podrás iniciar sesión en UniFundMe.',
        ),
      ),
    );
  }
}

class _NotFoundPage extends StatelessWidget {
  const _NotFoundPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('UniFundMe'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: FeaturePendingView(
          icon: Icons.wrong_location_outlined,
          title: 'Página no encontrada',
          description: 'La dirección solicitada no corresponde a una pantalla.',
          showPendingMessage: false,
          action: FilledButton(
            onPressed: () => context.goNamed(AppRoutes.exploreName),
            child: const Text('Volver a Explorar'),
          ),
        ),
      ),
    );
  }
}
