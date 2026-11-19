import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/config/app_config.dart';
import '../features/auth/application/app_dependencies.dart';
import '../features/auth/application/session_state.dart';
import 'router/app_router.dart';
import 'router/app_routes.dart';
import 'theme/app_theme.dart';

class UniFundMeApp extends StatefulWidget {
  const UniFundMeApp({
    super.key,
    this.configLoader,
    this.dependenciesBuilder,
    this.initialLocation = AppRoutes.root,
  });

  final AppConfig Function()? configLoader;
  final AppDependencies Function(AppConfig)? dependenciesBuilder;
  final String initialLocation;

  @override
  State<UniFundMeApp> createState() => _UniFundMeAppState();
}

class _UniFundMeAppState extends State<UniFundMeApp>
    with WidgetsBindingObserver {
  GoRouter? _router;
  AppDependencies? _dependencies;
  final Set<GoRouter> _retiredRouters = {};
  Timer? _expiration;
  bool _wasAuthenticated = false;
  late final AppConfig? _config;
  String? _configurationError;

  @override
  void initState() {
    super.initState();
    try {
      _config = (widget.configLoader ?? AppConfig.fromEnvironment)();
      final dependencies =
          (widget.dependenciesBuilder ?? AppDependencies.create)(_config!);
      _dependencies = dependencies;
      _wasAuthenticated =
          dependencies.session.state.status == SessionStatus.authenticated;
      _router = AppRouter.create(
        dependencies: dependencies,
        initialLocation: widget.initialLocation,
      );
      dependencies.session.addListener(_sessionChanged);
      WidgetsBinding.instance.addObserver(this);
      unawaited(dependencies.restore());
    } on AppConfigException catch (error) {
      _config = null;
      _router = null;
      _configurationError = error.message;
    }
  }

  void _sessionChanged() {
    final dependencies = _dependencies!;
    final authenticated =
        dependencies.session.state.status == SessionStatus.authenticated;
    _expiration?.cancel();
    if (authenticated) {
      dependencies.logoutResult.value = null;
      final remaining = dependencies.session.timeUntilExpiration;
      if (remaining != null) {
        _expiration = Timer(
          remaining.isNegative ? Duration.zero : remaining,
          () {
            if (mounted) unawaited(dependencies.session.checkExpiration());
          },
        );
      }
    }
    if (_wasAuthenticated && !authenticated && mounted) {
      final old = _router!;
      final path = old.routeInformationProvider.value.uri.path;
      final location =
          dependencies.session.state.status == SessionStatus.closing
          ? AppRoutes.account
          : AppRoutes.isPrivate(path)
          ? Uri(
              path: AppRoutes.session,
              queryParameters: {'from': path},
            ).toString()
          : AppRoutes.safeReturn(path);
      // Crear ramas nuevas elimina también las pilas ocultas del indexedStack.
      setState(
        () => _router = AppRouter.create(
          dependencies: dependencies,
          initialLocation: location,
        ),
      );
      _retiredRouters.add(old);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_retiredRouters.remove(old)) old.dispose();
      });
    }
    _wasAuthenticated = authenticated;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final dependencies = _dependencies;
    if (state != AppLifecycleState.resumed || dependencies == null) return;
    if (dependencies.session.state.status == SessionStatus.authenticated ||
        dependencies.session.state.status == SessionStatus.recoverableError) {
      unawaited(dependencies.restore());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _expiration?.cancel();
    _dependencies?.session.removeListener(_sessionChanged);
    _router?.dispose();
    for (final router in _retiredRouters) {
      router.dispose();
    }
    _retiredRouters.clear();
    _dependencies?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_config == null) {
      return MaterialApp(
        title: 'UniFundMe',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: Scaffold(
          appBar: AppBar(title: const Text('UniFundMe')),
          body: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'No se pudo iniciar UniFundMe',
                        textAlign: TextAlign.center,
                        style: AppTheme.light.textTheme.headlineSmall,
                      ),
                      const SizedBox(height: 16),
                      Text(_configurationError!, textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      const Text(
                        'Solicita una versión con la configuración corregida.',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }
    return MaterialApp.router(
      title: 'UniFundMe',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: _router,
    );
  }
}
