import 'package:flutter/material.dart';

class FeaturePendingView extends StatelessWidget {
  const FeaturePendingView({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    this.action,
    this.showPendingMessage = true,
  });

  final IconData icon;
  final String title;
  final String description;
  final Widget? action;
  final bool showPendingMessage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ExcludeSemantics(
                child: Icon(icon, size: 64, color: theme.colorScheme.primary),
              ),
              const SizedBox(height: 24),
              Semantics(
                header: true,
                child: Text(
                  title,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineMedium,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                description,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge,
              ),
              if (showPendingMessage) ...[
                const SizedBox(height: 16),
                Text(
                  'Esta funcionalidad estará disponible próximamente.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
              if (action != null) ...[const SizedBox(height: 24), action!],
            ],
          ),
        ),
      ),
    );
  }
}
