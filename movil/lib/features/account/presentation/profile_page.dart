import 'package:flutter/material.dart';

import '../../auth/application/app_dependencies.dart';
import '../application/account_profile_controller.dart';
import '../domain/profile_details.dart';
import 'profile_form.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({
    super.key,
    required this.dependencies,
    required this.kind,
  });
  final AppDependencies dependencies;
  final ProfileKind kind;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  late final controller = AccountProfileController(
    widget.dependencies,
    widget.kind,
  );
  bool editing = false;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (context, _) => PopScope(
      canPop: controller.status != ProfileStatus.saving,
      child: Scaffold(
        appBar: AppBar(title: Text('Perfil de ${widget.kind.label}')),
        body: SafeArea(
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: _content(),
            ),
          ),
        ),
      ),
    ),
  );

  Widget _content() {
    if (!controller.allowed) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          'Este perfil no está disponible para la sesión actual.',
          key: Key('profile.unavailable'),
        ),
      );
    }
    if (controller.status == ProfileStatus.loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (controller.status == ProfileStatus.error) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(controller.message!, key: const Key('profile.loadError')),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: controller.load,
              child: const Text('Reintentar consulta'),
            ),
          ],
        ),
      );
    }
    if (editing) {
      return ProfileForm(
        key: ValueKey(controller.generation),
        controller: controller,
        onDone: () => setState(() => editing = false),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        if (controller.message != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(
              controller.message!,
              key: const Key('profile.notice'),
              semanticsLabel: controller.message,
            ),
          ),
        if (controller.status == ProfileStatus.missing) ...[
          const Text(
            'Todavía no completaste tu perfil.',
            key: Key('profile.missing'),
          ),
          const SizedBox(height: 16),
          FilledButton(
            key: const Key('profile.create'),
            onPressed: () => setState(() => editing = true),
            child: const Text('Completar perfil'),
          ),
        ] else if (controller.details != null) ...[
          for (final field in ProfileField.forKind(widget.kind))
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(field.label),
              subtitle: Text(
                controller.details!.values[field.name] ?? 'Sin especificar',
                key: Key('profile.value.${field.name}'),
              ),
            ),
          if (widget.kind == ProfileKind.investor)
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Tipo de donante'),
              subtitle: Text(
                profileTypeLabel(controller.details!.values['investorType']),
              ),
            ),
          const SizedBox(height: 16),
          FilledButton(
            key: const Key('profile.edit'),
            onPressed: () => setState(() => editing = true),
            child: const Text('Editar perfil'),
          ),
          TextButton(
            onPressed: controller.load,
            child: const Text('Actualizar perfil'),
          ),
        ],
      ],
    );
  }
}
