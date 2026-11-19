import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../core/network/api_exception.dart';
import '../application/app_dependencies.dart';
import '../domain/auth_requests.dart';
import 'auth_messages.dart';
import 'auth_validation.dart';
import 'login_page.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key, required this.dependencies, this.returnTo});
  final AppDependencies dependencies;
  final String? returnTo;

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _phone = TextEditingController();
  SignupRole _role = SignupRole.investor;
  PreferredLanguage _language = PreferredLanguage.es;
  bool _busy = false;
  bool _obscure = true;
  String? _error;
  Set<String> _fieldErrors = {};

  Future<void> _submit() async {
    if (_busy || !widget.dependencies.config.hasApi) return;
    setState(() {
      _error = null;
      _fieldErrors = {};
    });
    if (!_form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() => _busy = true);
    final generation = widget.dependencies.session.generation;
    try {
      await widget.dependencies.auth.register(
        RegisterRequest(
          email: _email.text.trim(),
          password: _password.text,
          phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
          signupRole: _role,
          preferredLanguage: _language,
        ),
      );
      if (!mounted || generation != widget.dependencies.session.generation) {
        return;
      }
      _password.clear();
      context.goNamed(
        AppRoutes.accessName,
        extra: AuthNotice.registered,
        queryParameters: {
          if (widget.returnTo != null) 'from': widget.returnTo!,
        },
      );
    } catch (error) {
      if (!mounted || generation != widget.dependencies.session.generation) {
        return;
      }
      setState(() {
        _error = AuthMessages.error(error);
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

  String? _server(String field) =>
      _fieldErrors.contains(field) ? 'Revisa este campo.' : null;

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.access);
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_busy,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Registro'),
        leading: IconButton(
          tooltip: 'Volver',
          onPressed: _busy ? null : _back,
          icon: const Icon(Icons.arrow_back),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Crea tu cuenta',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    if (!widget.dependencies.config.hasApi)
                      const Text('El servicio aún no está configurado.'),
                    const SizedBox(height: 24),
                    TextFormField(
                      key: const Key('register.email'),
                      controller: _email,
                      enabled: !_busy,
                      decoration: const InputDecoration(
                        labelText: 'Correo electrónico',
                      ),
                      keyboardType: TextInputType.emailAddress,
                      autocorrect: false,
                      onChanged: (_) =>
                          setState(() => _fieldErrors.remove('email')),
                      validator: (v) =>
                          _server('email') ??
                          AuthValidation.email(v, registration: true),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      key: const Key('register.password'),
                      controller: _password,
                      enabled: !_busy,
                      obscureText: _obscure,
                      autocorrect: false,
                      enableSuggestions: false,
                      decoration: InputDecoration(
                        labelText: 'Contraseña',
                        helperText:
                            '8–128 caracteres, una mayúscula y un número.',
                        helperMaxLines: 3,
                        suffixIcon: IconButton(
                          tooltip: _obscure
                              ? 'Mostrar contraseña'
                              : 'Ocultar contraseña',
                          onPressed: _busy
                              ? null
                              : () => setState(() => _obscure = !_obscure),
                          icon: Icon(
                            _obscure ? Icons.visibility : Icons.visibility_off,
                          ),
                        ),
                      ),
                      onChanged: (_) =>
                          setState(() => _fieldErrors.remove('password')),
                      validator: (v) =>
                          _server('password') ??
                          AuthValidation.password(v, registration: true),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      key: const Key('register.phone'),
                      controller: _phone,
                      enabled: !_busy,
                      decoration: const InputDecoration(
                        labelText: 'Teléfono (opcional)',
                      ),
                      keyboardType: TextInputType.phone,
                      onChanged: (_) =>
                          setState(() => _fieldErrors.remove('phone')),
                      validator: (v) =>
                          _server('phone') ?? AuthValidation.phone(v),
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<SignupRole>(
                      key: const Key('register.role'),
                      initialValue: _role,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Rol inicial',
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: SignupRole.investor,
                          child: Text('Inversor'),
                        ),
                        DropdownMenuItem(
                          value: SignupRole.entrepreneur,
                          child: Text('Emprendedor'),
                        ),
                      ],
                      onChanged: _busy
                          ? null
                          : (v) => setState(() {
                              _role = v!;
                              _fieldErrors.remove('signupRole');
                            }),
                      validator: (_) => _server('signupRole'),
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<PreferredLanguage>(
                      key: const Key('register.language'),
                      initialValue: _language,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Idioma preferido',
                      ),
                      items: const [
                        DropdownMenuItem(
                          value: PreferredLanguage.es,
                          child: Text('Español'),
                        ),
                        DropdownMenuItem(
                          value: PreferredLanguage.en,
                          child: Text('Inglés'),
                        ),
                      ],
                      onChanged: _busy
                          ? null
                          : (v) => setState(() {
                              _language = v!;
                              _fieldErrors.remove('preferredLanguage');
                            }),
                      validator: (_) => _server('preferredLanguage'),
                    ),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text(_error!, key: const Key('register.error')),
                      ),
                    const SizedBox(height: 24),
                    FilledButton(
                      key: const Key('register.submit'),
                      onPressed: _busy || !widget.dependencies.config.hasApi
                          ? null
                          : _submit,
                      child: Text(_busy ? 'Registrando…' : 'Registrarme'),
                    ),
                    TextButton(
                      onPressed: _busy ? null : _back,
                      child: const Text('Ya tengo una cuenta'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
