import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/config/app_config.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';

class UniFundMeApp extends StatefulWidget {
  const UniFundMeApp({super.key, this.configLoader});

  final AppConfig Function()? configLoader;

  @override
  State<UniFundMeApp> createState() => _UniFundMeAppState();
}

class _UniFundMeAppState extends State<UniFundMeApp> {
  late final GoRouter? _router;
  late final AppConfig? _config;
  String? _configurationError;

  @override
  void initState() {
    super.initState();
    try {
      _config = (widget.configLoader ?? AppConfig.fromEnvironment)();
      _router = AppRouter.create();
    } on AppConfigException catch (error) {
      _config = null;
      _router = null;
      _configurationError = error.message;
    }
  }

  @override
  void dispose() {
    _router?.dispose();
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
