import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/presentation/account_page.dart';
import '../../features/auth/application/app_dependencies.dart';
import '../../features/auth/application/session_state.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/presentation/register_page.dart';
import '../../features/auth/presentation/session_status_view.dart';
import '../../features/catalog/presentation/explore_page.dart';
import '../../features/catalog/presentation/campaign_detail_page.dart';
import '../../features/contributions/presentation/contribution_page.dart';
import '../../features/contributions/presentation/investor_gate.dart';
import '../../features/contributions/presentation/receipt_page.dart';
import '../../features/notifications/presentation/notifications_page.dart';
import '../../features/tracking/presentation/tracking_page.dart';
import '../../features/tracking/presentation/tracking_campaign_page.dart';
import '../../shared/widgets/feature_pending_view.dart';
import '../shell/main_shell.dart';
import 'app_routes.dart';

abstract final class AppRouter {
  static GoRouter create({
    required AppDependencies dependencies,
    String initialLocation = AppRoutes.root,
  }) {
    final session = dependencies.session;
    final rootNavigatorKey = GlobalKey<NavigatorState>();
    return GoRouter(
      navigatorKey: rootNavigatorKey,
      initialLocation: initialLocation,
      refreshListenable: session,
      redirect: (context, state) {
        final path = state.uri.path;
        final status = session.state.status;
        final authenticated =
            status == SessionStatus.authenticated &&
            session.accessToken != null;
        final destination = AppRoutes.safeReturn(
          state.uri.queryParameters['from'],
        );
        if (status == SessionStatus.authenticated && !authenticated) {
          scheduleMicrotask(session.checkExpiration);
        }
        if (authenticated) {
          final donor = session.state.user?.roles.contains('investor') ?? false;
          if ([
            AppRoutes.access,
            AppRoutes.register,
            AppRoutes.session,
          ].contains(path)) {
            return !donor && AppRoutes.requiresDonor(destination)
                ? AppRoutes.explore
                : destination;
          }
          if (!donor && AppRoutes.requiresDonor(path)) {
            return AppRoutes.explore;
          }
          return null;
        }
        if (status == SessionStatus.closing &&
            path != AppRoutes.explore &&
            path != AppRoutes.account) {
          return AppRoutes.account;
        }
        if (AppRoutes.isPrivate(path)) {
          final target = status == SessionStatus.guest
              ? AppRoutes.access
              : AppRoutes.session;
          return Uri(path: target, queryParameters: {'from': path}).toString();
        }
        if (path == AppRoutes.session && status == SessionStatus.guest) {
          return Uri(
            path: AppRoutes.access,
            queryParameters: {'from': destination},
          ).toString();
        }
        return null;
      },
      errorBuilder: (context, state) => const _NotFoundPage(),
      routes: [
        GoRoute(path: AppRoutes.root, redirect: (_, _) => AppRoutes.explore),
        GoRoute(
          path: AppRoutes.access,
          name: AppRoutes.accessName,
          builder: (_, state) => LoginPage(
            dependencies: dependencies,
            registered: state.extra == AuthNotice.registered,
            returnTo: AppRoutes.safeReturn(state.uri.queryParameters['from']),
          ),
        ),
        GoRoute(
          path: AppRoutes.register,
          name: AppRoutes.registerName,
          // La restauración puede finalizar sin cambiar la URI. El refresh
          // del router reevalúa redirecciones, pero no garantiza reconstruir
          // una página cuya coincidencia de ruta sigue siendo la misma.
          builder: (_, state) => ListenableBuilder(
            listenable: session,
            builder: (_, _) => session.state.status == SessionStatus.guest
                ? RegisterPage(
                    dependencies: dependencies,
                    returnTo: AppRoutes.safeReturn(
                      state.uri.queryParameters['from'],
                    ),
                  )
                : _SessionPage(dependencies: dependencies),
          ),
        ),
        GoRoute(
          path: AppRoutes.session,
          name: AppRoutes.sessionName,
          builder: (_, _) => _SessionPage(dependencies: dependencies),
        ),
        GoRoute(
          path: AppRoutes.receipts,
          name: AppRoutes.receiptsName,
          builder: (_, _) => InvestorGate(
            dependencies: dependencies,
            builder: () => ReceiptListPage(dependencies: dependencies),
          ),
          routes: [
            GoRoute(
              path: ':id',
              name: AppRoutes.receiptName,
              builder: (_, state) => InvestorGate(
                dependencies: dependencies,
                builder: () => ReceiptPage(
                  key: ValueKey(state.pathParameters['id']),
                  dependencies: dependencies,
                  investmentId: state.pathParameters['id']!,
                ),
              ),
            ),
          ],
        ),
        StatefulShellRoute.indexedStack(
          pageBuilder: (context, state, shell) => NoTransitionPage(
            key: state.pageKey,
            child: MainShell(navigationShell: shell, session: session),
          ),
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.explore,
                  name: AppRoutes.exploreName,
                  builder: (_, _) => ExplorePage(dependencies: dependencies),
                  routes: [
                    GoRoute(
                      parentNavigatorKey: rootNavigatorKey,
                      path: 'campanas/:id',
                      name: AppRoutes.campaignName,
                      builder: (_, state) => CampaignDetailPage(
                        dependencies: dependencies,
                        campaignId: state.pathParameters['id']!,
                      ),
                      routes: [
                        GoRoute(
                          parentNavigatorKey: rootNavigatorKey,
                          path: 'aportar',
                          name: AppRoutes.contributionName,
                          builder: (_, state) => InvestorGate(
                            dependencies: dependencies,
                            builder: () => ContributionPage(
                              key: ValueKey(state.pathParameters['id']),
                              dependencies: dependencies,
                              campaignId: state.pathParameters['id']!,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.tracking,
                  name: AppRoutes.trackingName,
                  builder: (_, _) => InvestorGate(
                    dependencies: dependencies,
                    builder: () => TrackingPage(dependencies: dependencies),
                  ),
                  routes: [
                    GoRoute(
                      parentNavigatorKey: rootNavigatorKey,
                      path: 'campanas/:id',
                      name: AppRoutes.trackingCampaignName,
                      builder: (_, state) => InvestorGate(
                        dependencies: dependencies,
                        builder: () => TrackingCampaignPage(
                          key: ValueKey(state.pathParameters['id']),
                          dependencies: dependencies,
                          campaignId: state.pathParameters['id']!,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.notifications,
                  name: AppRoutes.notificationsName,
                  builder: (_, _) => _PrivateView(
                    dependencies: dependencies,
                    child: const NotificationsPage(),
                  ),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.account,
                  name: AppRoutes.accountName,
                  builder: (_, _) => AccountPage(dependencies: dependencies),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

class _SessionPage extends StatelessWidget {
  const _SessionPage({required this.dependencies});
  final AppDependencies dependencies;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Sesión')),
    body: SessionStatusView(dependencies: dependencies),
  );
}

class _PrivateView extends StatelessWidget {
  const _PrivateView({required this.dependencies, required this.child});
  final AppDependencies dependencies;
  final Widget child;
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: dependencies.session,
    builder: (_, _) => dependencies.session.accessToken != null
        ? child
        : SessionStatusView(dependencies: dependencies),
  );
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
