import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/application/session_controller.dart';
import '../../features/auth/application/session_state.dart';

class MainShell extends StatelessWidget {
  const MainShell({
    super.key,
    required this.navigationShell,
    required this.session,
  });

  final StatefulNavigationShell navigationShell;
  final SessionController session;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: session,
    builder: (context, _) {
      final donor =
          session.accessToken != null &&
          (session.state.user?.roles.contains('investor') ?? false);
      final showTracking = session.state.status == SessionStatus.guest || donor;
      // Los índices del router permanecen estables al ocultar una pestaña.
      final branches = [0, if (showTracking) 1, 2, 3];
      final selected = branches.indexOf(navigationShell.currentIndex);
      return Scaffold(
        appBar: AppBar(title: const Text('UniFundMe')),
        body: navigationShell,
        bottomNavigationBar: NavigationBar(
          selectedIndex: selected < 0 ? 0 : selected,
          onDestinationSelected: (index) =>
              navigationShell.goBranch(branches[index]),
          destinations: [
            const NavigationDestination(
              icon: Icon(Icons.explore_outlined),
              selectedIcon: Icon(Icons.explore),
              label: 'Explorar',
            ),
            if (showTracking)
              const NavigationDestination(
                icon: Icon(Icons.bookmark_outline),
                selectedIcon: Icon(Icons.bookmark),
                label: 'Seguimiento',
              ),
            const NavigationDestination(
              icon: Icon(Icons.notifications_outlined),
              selectedIcon: Icon(Icons.notifications),
              label: 'Notificaciones',
            ),
            const NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Cuenta',
            ),
          ],
        ),
      );
    },
  );
}
