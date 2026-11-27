import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../core/config/app_config.dart';
import '../../contributions/domain/contribution.dart';
import '../domain/donor_tracking.dart';

Uri? trackingLink(String? value, {AppConfig? config, bool attachment = false}) {
  if (value == null ||
      value.trim().isEmpty ||
      value.length > 4096 ||
      RegExp(r'[\x00-\x20\x7f\\]|%(?![0-9a-fA-F]{2})').hasMatch(value)) {
    return null;
  }
  final raw = Uri.tryParse(value);
  if (raw == null ||
      raw.userInfo.isNotEmpty ||
      (raw.hasAuthority && !raw.hasScheme)) {
    return null;
  }
  final uri = raw.hasScheme
      ? raw
      : config?.apiBaseUrl?.resolve(
          '/${value.replaceFirst(RegExp(r'^/'), '')}',
        );
  if (uri == null ||
      !['http', 'https'].contains(uri.scheme) ||
      uri.host.isEmpty ||
      uri.userInfo.isNotEmpty) {
    return null;
  }
  if (attachment) {
    String path;
    try {
      path = Uri.decodeFull(uri.path).toLowerCase();
    } on FormatException {
      return null;
    }
    if (path.contains('%') ||
        path.contains('private-files') ||
        path.contains('/kyc/') ||
        path.contains('..') ||
        (uri.scheme == 'http' &&
            (config == null ||
                config.isProduction ||
                uri.origin != config.apiBaseUrl?.origin))) {
      return null;
    }
  } else if (!raw.hasScheme) {
    return null;
  }
  return uri;
}

class TrackingLink extends StatefulWidget {
  const TrackingLink({super.key, required this.uri, required this.label});
  final Uri uri;
  final String label;
  @override
  State<TrackingLink> createState() => _TrackingLinkState();
}

class _TrackingLinkState extends State<TrackingLink> {
  static const _channel = MethodChannel('unifundme/external');
  bool _busy = false;
  String? _error;
  Future<void> _open() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final opened = await _channel.invokeMethod<bool>('open', {
        'url': widget.uri.toString(),
      });
      if (opened != true && mounted) {
        setState(() => _error = 'No se pudo abrir el enlace. Puedes copiarlo.');
      }
    } on PlatformException {
      if (mounted) {
        setState(() => _error = 'No se pudo abrir el enlace. Puedes copiarlo.');
      }
    } on MissingPluginException {
      if (mounted) {
        setState(
          () => _error = 'Puedes copiar el enlace y abrirlo en tu navegador.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Wrap(
        spacing: 8,
        children: [
          TextButton.icon(
            onPressed: _busy ? null : _open,
            icon: const Icon(Icons.open_in_new),
            label: Text(widget.label),
          ),
          TextButton(
            onPressed: () async {
              await Clipboard.setData(
                ClipboardData(text: widget.uri.toString()),
              );
              if (mounted) setState(() => _error = 'Enlace copiado.');
            },
            child: const Text('Copiar enlace'),
          ),
        ],
      ),
      if (_error != null) Text(_error!, semanticsLabel: _error),
    ],
  );
}

class TrackingAttachments extends StatelessWidget {
  const TrackingAttachments({
    super.key,
    required this.items,
    required this.config,
  });
  final List<TrackingAttachment> items;
  final AppConfig config;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: items.map((a) {
      final uri = trackingLink(a.url, config: config, attachment: true);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (a.text?.trim().isNotEmpty == true) SelectableText(a.text!),
          if (uri != null)
            TrackingLink(
              uri: uri,
              label: a.title?.trim().isNotEmpty == true
                  ? a.title!
                  : switch (a.type) {
                      'image' => 'Abrir imagen',
                      'video' => 'Abrir video',
                      _ => 'Abrir evidencia',
                    },
            ),
          if (a.url != null && uri == null)
            const Text('Enlace de evidencia no disponible.'),
        ],
      );
    }).toList(),
  );
}

class TrackingError extends StatelessWidget {
  const TrackingError({super.key, required this.message, required this.retry});
  final String message;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(liveRegion: true, child: Text(message)),
        const SizedBox(height: 8),
        FilledButton.tonal(onPressed: retry, child: const Text('Reintentar')),
      ],
    ),
  );
}

class ContributionTrackingCard extends StatelessWidget {
  const ContributionTrackingCard({
    super.key,
    required this.row,
    this.reward = false,
    this.showCampaign = true,
  });
  final TrackedContribution row;
  final bool reward;
  final bool showCampaign;
  @override
  Widget build(BuildContext context) {
    final r = row.receipt;
    final link = trackingLink(row.trackingUrl);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              reward
                  ? r.rewardTitle ?? 'Recompensa asociada al aporte'
                  : r.title,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (reward) Text(r.title),
            const SizedBox(height: 8),
            Text(Money.label(r.amount, r.currency)),
            Text('Aporte: ${r.statusLabel} · ${trackingDate(r.date)}'),
            Text('Campaña: ${row.campaignLabel}'),
            SelectableText('Referencia: ${r.id}'),
            if (reward) ...[
              const Divider(),
              Text(
                'Recompensa: ${row.rewardLabel}',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              if (row.description?.isNotEmpty == true) Text(row.description!),
              if (row.estimatedDelivery != null)
                Text(
                  'Entrega estimada: ${trackingDate(row.estimatedDelivery!, dateOnly: true)}',
                ),
              if (row.trackingNumber?.isNotEmpty == true)
                SelectableText('Guía: ${row.trackingNumber}'),
              if (row.shippedAt != null)
                Text('Enviada: ${trackingDate(row.shippedAt!)}'),
              if (row.deliveredAt != null)
                Text('Entregada: ${trackingDate(row.deliveredAt!)}'),
              if (link != null)
                TrackingLink(uri: link, label: 'Rastrear envío'),
              if (row.trackingUrl?.isNotEmpty == true && link == null)
                const Text('Enlace de seguimiento no disponible.'),
            ] else if (row.hasReward)
              Text('Recompensa: ${row.rewardLabel}')
            else
              const Text('Aporte sin recompensa'),
            Wrap(
              spacing: 8,
              children: [
                TextButton(
                  onPressed: () => context.pushNamed(
                    AppRoutes.receiptName,
                    pathParameters: {'id': r.id},
                  ),
                  child: const Text('Ver comprobante'),
                ),
                if (showCampaign)
                  TextButton(
                    onPressed: () => context.pushNamed(
                      AppRoutes.trackingCampaignName,
                      pathParameters: {'id': r.campaignId},
                    ),
                    child: const Text('Ver avances'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
