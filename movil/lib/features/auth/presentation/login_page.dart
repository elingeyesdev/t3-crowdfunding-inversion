import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../core/network/api_exception.dart';
import '../application/app_dependencies.dart';
import '../application/session_controller.dart';
import '../application/session_state.dart';
import '../domain/auth_requests.dart';
import 'auth_messages.dart';
import 'auth_validation.dart';
import 'session_status_view.dart';

enum AuthNotice { registered }

class LoginPage extends StatefulWidget {
  const LoginPage({
    super.key,
    required this.dependencies,
    this.registered = false,
    this.returnTo,
  });
  final AppDependencies dependencies;
  final bool registered;
  final String? returnTo;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  String? _error;
  Set<String> _fieldErrors = {};
  AuthenticationAttempt? _attempt;

  Future<void> _submit() async {
    if (_busy || !widget.dependencies.config.hasApi) return;
    setState(() {
      _fieldErrors = {};
      _error = null;
    });
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    final session = widget.dependencies.session;
    final attempt = session.beginAuthentication();
    _attempt = attempt;
    try {
      final response = await widget.dependencies.auth.login(
        LoginRequest(email: _email.text.trim(), password: _password.text),
      );
      if (!mounted || !session.isCurrentAttempt(attempt)) return;
      await session.acceptLogin(attempt, response);
      // La redirección reactiva ocurre solo después del guardado seguro.
      if (!mounted || !session.isCurrentAttempt(attempt)) return;
      if (session.state.status != SessionStatus.authenticated) {
        setState(() => _error = AuthMessages.issue(session.state.issue));
      } else {
        widget.dependencies.logoutResult.value = null;
      }
    } catch (error) {
      if (!mounted || !session.isCurrentAttempt(attempt)) return;
      final cancellation = session.cancelAuthentication(attempt);
      final cancelledGeneration = session.generation;
      await cancellation;
      if (!mounted || session.generation != cancelledGeneration) return;
      setState(() {
        _error = AuthMessages.error(error, login: true);
        _fieldErrors = error is ApiException
            ? error.fieldErrors.keys.toSet()
            : {};
      });
      _form.currentState?.validate();
    } finally {
      if (mounted) {
        _password.clear();
        setState(() => _busy = false);
      }
    }
  }

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.explore);
    }
  }

  @override
  void dispose() {
    final attempt = _attempt;
    if (attempt != null &&
        widget.dependencies.session.isCurrentAttempt(attempt)) {
      unawaited(widget.dependencies.session.cancelAuthentication(attempt));
    }
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_busy,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Acceso'),
        leading: IconButton(
          tooltip: 'Volver',
          onPressed: _busy ? null : _back,
          icon: const Icon(Icons.arrow_back),
        ),
      ),
      body: ListenableBuilder(
        listenable: widget.dependencies.session,
        builder: (context, _) {
          final status = widget.dependencies.session.state.status;
          if (!_busy &&
              (status == SessionStatus.checking ||
                  status == SessionStatus.closing ||
                  status == SessionStatus.recoverableError)) {
            return SessionStatusView(dependencies: widget.dependencies);
          }
          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Form(
                    key: _form,
                    child: AutofillGroup(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            'Bienvenido a UniFundMe',
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          if (widget.registered)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 16),
                              child: Text(
                                'Registro correcto. Inicia sesión para continuar.',
                              ),
                            ),
                          if (widget.dependencies.session.state.issue != null &&
                              !_busy)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              child: Text(
                                AuthMessages.issue(
                                  widget.dependencies.session.state.issue,
                                ),
                              ),
                            ),
                          if (!widget.dependencies.config.hasApi)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 16),
                              child: Text(
                                'El servicio aún no está configurado.',
                              ),
                            ),
                          const SizedBox(height: 24),
                          TextFormField(
                            key: const Key('login.email'),
                            controller: _email,
                            enabled: !_busy,
                            decoration: const InputDecoration(
                              labelText: 'Correo electrónico',
                            ),
                            keyboardType: TextInputType.emailAddress,
                            autofillHints: const [AutofillHints.username],
                            autocorrect: false,
                            onChanged: (_) =>
                                setState(() => _fieldErrors.remove('email')),
                            validator: (value) => _fieldErrors.contains('email')
                                ? 'Revisa este campo.'
                                : AuthValidation.email(value),
                          ),
                          const SizedBox(height: 16),
                          TextFormField(
                            key: const Key('login.password'),
                            controller: _password,
                            enabled: !_busy,
                            obscureText: _obscure,
                            enableSuggestions: false,
                            autocorrect: false,
                            autofillHints: const [AutofillHints.password],
                            decoration: InputDecoration(
                              labelText: 'Contraseña',
                              suffixIcon: IconButton(
                                tooltip: _obscure
                                    ? 'Mostrar contraseña'
                                    : 'Ocultar contraseña',
                                onPressed: _busy
                                    ? null
                                    : () =>
                                          setState(() => _obscure = !_obscure),
                                icon: Icon(
                                  _obscure
                                      ? Icons.visibility
                                      : Icons.visibility_off,
                                ),
                              ),
                            ),
                            onChanged: (_) =>
                                setState(() => _fieldErrors.remove('password')),
                            validator: (value) =>
                                _fieldErrors.contains('password')
                                ? 'Revisa este campo.'
                                : AuthValidation.password(value),
                            onFieldSubmitted: (_) => _submit(),
                          ),
                          if (_error != null)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              child: Text(
                                _error!,
                                key: const Key('login.error'),
                              ),
                            ),
                          const SizedBox(height: 24),
                          FilledButton(
                            key: const Key('login.submit'),
                            onPressed:
                                _busy || !widget.dependencies.config.hasApi
                                ? null
                                : _submit,
                            child: Text(
                              _busy ? 'Iniciando sesión…' : 'Iniciar sesión',
                            ),
                          ),
                          TextButton(
                            onPressed: _busy
                                ? null
                                : () => context.pushNamed(
                                    AppRoutes.registerName,
                                    queryParameters: {
                                      if (widget.returnTo != null)
                                        'from': widget.returnTo!,
                                    },
                                  ),
                            child: const Text('Crear una cuenta'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
        },
      ),
    ),
  );
}
