import 'package:flutter/material.dart';

import '../application/account_profile_controller.dart';
import '../domain/profile_details.dart';

String profileTypeLabel(String? type) => switch (type) {
  'individual' => 'Individual',
  'institutional' => 'Institucional',
  'angel' => 'Ángel',
  null => 'Sin especificar',
  _ => 'Otro tipo registrado',
};

class ProfileForm extends StatefulWidget {
  const ProfileForm({
    super.key,
    required this.controller,
    required this.onDone,
  });
  final AccountProfileController controller;
  final VoidCallback onDone;

  @override
  State<ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends State<ProfileForm> {
  final form = GlobalKey<FormState>();
  late final fields = ProfileField.forKind(widget.controller.kind);
  late final inputs = {
    for (final f in fields)
      f.name: TextEditingController(
        text: widget.controller.details?.values[f.name] ?? '',
      ),
  };
  late String? investorType =
      widget.controller.details?.values['investorType'] ??
      (widget.controller.details == null ? 'individual' : null);

  @override
  void dispose() {
    for (final input in inputs.values) {
      input.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    FocusScope.of(context).unfocus();
    if (!form.currentState!.validate()) return;
    final success = await widget.controller.save({
      for (final entry in inputs.entries) entry.key: entry.value.text,
      if (widget.controller.kind == ProfileKind.investor &&
          investorType != null)
        'investorType': investorType,
    });
    if (mounted && success) widget.onDone();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final saving = controller.status == ProfileStatus.saving;
    final enabled = !saving && !controller.needsReload;
    return Form(
      key: form,
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          const Text('Los campos marcados con * son obligatorios.'),
          const SizedBox(height: 16),
          for (final field in fields) ...[
            TextFormField(
              key: Key('profile.${field.name}'),
              controller: inputs[field.name],
              enabled: enabled,
              decoration: InputDecoration(
                labelText: '${field.label}${field.required ? ' *' : ''}',
                errorText: controller.fieldErrors[field.name]?.firstOrNull,
              ),
              validator: field.validate,
              maxLines: field.name == 'bio' ? 4 : 1,
              keyboardType: field.url
                  ? TextInputType.url
                  : field.name == 'bio'
                  ? TextInputType.multiline
                  : TextInputType.text,
              textCapitalization: field.url
                  ? TextCapitalization.none
                  : TextCapitalization.sentences,
              autocorrect: !field.url,
              onChanged: (_) {
                if (controller.fieldErrors.isNotEmpty) {
                  setState(() {
                    controller.fieldErrors = {...controller.fieldErrors}
                      ..remove(field.name);
                  });
                }
              },
            ),
            const SizedBox(height: 16),
          ],
          if (controller.kind == ProfileKind.investor) ...[
            DropdownButtonFormField<String>(
              key: const Key('profile.investorType'),
              initialValue: investorType,
              decoration: InputDecoration(
                labelText: 'Tipo de donante',
                errorText: controller.fieldErrors['investorType']?.firstOrNull,
              ),
              items: [
                for (final type in ['individual', 'institutional', 'angel'])
                  DropdownMenuItem(
                    value: type,
                    child: Text(profileTypeLabel(type)),
                  ),
                if (investorType != null &&
                    ![
                      'individual',
                      'institutional',
                      'angel',
                    ].contains(investorType))
                  DropdownMenuItem(
                    value: investorType,
                    enabled: false,
                    child: const Text('Otro tipo registrado'),
                  ),
              ],
              onChanged: enabled
                  ? (value) => setState(() => investorType = value)
                  : null,
            ),
            const SizedBox(height: 16),
          ],
          if (controller.message != null) ...[
            Text(controller.message!, key: const Key('profile.saveMessage')),
            const SizedBox(height: 16),
          ],
          if (controller.needsReload)
            FilledButton(
              key: const Key('profile.verify'),
              onPressed: () async {
                final loaded = await controller.load();
                if (mounted && loaded) widget.onDone();
              },
              child: const Text('Verificar estado del perfil'),
            )
          else
            FilledButton(
              key: const Key('profile.save'),
              onPressed: saving ? null : save,
              child: saving
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Guardar perfil'),
            ),
          TextButton(
            onPressed: saving ? null : widget.onDone,
            child: const Text('Cancelar'),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
