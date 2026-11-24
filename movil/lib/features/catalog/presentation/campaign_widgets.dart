import 'package:flutter/material.dart';

import '../../../core/config/app_config.dart';
import '../domain/public_campaign.dart';

String campaignMoney(double value, String currency) {
  final parts = value.toStringAsFixed(2).split('.');
  final integer = parts.first.replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
    (m) => '${m[1]}.',
  );
  return '${currency == 'BOB' ? 'Bs' : currency} $integer,${parts.last}';
}

Uri? campaignCover(String? value, AppConfig config) {
  if (value == null || value.trim().isEmpty || config.apiBaseUrl == null) {
    return null;
  }
  final raw = Uri.tryParse(value.trim());
  if (raw == null ||
      raw.userInfo.isNotEmpty ||
      (raw.hasAuthority && !raw.hasScheme)) {
    return null;
  }
  final uri = raw.hasScheme
      ? raw
      : config.apiBaseUrl!.resolve(
          '/${value.trim().replaceFirst(RegExp(r'^/'), '')}',
        );
  if (!['http', 'https'].contains(uri.scheme) ||
      uri.host.isEmpty ||
      uri.path.contains('/private-files/') ||
      uri.path.contains('/kyc/') ||
      (uri.scheme == 'http' &&
          (config.isProduction || uri.origin != config.apiBaseUrl!.origin))) {
    return null;
  }
  return uri;
}

class CampaignCover extends StatelessWidget {
  const CampaignCover({
    super.key,
    required this.campaign,
    required this.config,
  });
  final PublicCampaign campaign;
  final AppConfig config;
  @override
  Widget build(BuildContext context) {
    final uri = campaignCover(campaign.cover, config);
    final placeholder = ColoredBox(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: const Center(child: Icon(Icons.image_outlined, size: 44)),
    );
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: uri == null
          ? placeholder
          : Image.network(
              uri.toString(),
              fit: BoxFit.cover,
              excludeFromSemantics: true,
              frameBuilder: (_, child, frame, synchronous) =>
                  synchronous || frame != null ? child : placeholder,
              errorBuilder: (_, _, _) => placeholder,
            ),
    );
  }
}

class CampaignProgress extends StatelessWidget {
  const CampaignProgress({super.key, required this.campaign});
  final PublicCampaign campaign;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        '${campaignMoney(campaign.raised, campaign.currency)} recaudados',
        style: Theme.of(context).textTheme.titleMedium,
      ),
      const SizedBox(height: 8),
      LinearProgressIndicator(
        value: campaign.progress.clamp(0.0, 1.0),
        semanticsLabel: 'Progreso de recaudación',
        semanticsValue: '${(campaign.progress * 100).toStringAsFixed(1)} %',
      ),
      const SizedBox(height: 8),
      Text('Meta: ${campaignMoney(campaign.goal, campaign.currency)}'),
      Text(
        '${(campaign.progress * 100).toStringAsFixed(1).replaceAll('.', ',')} % de la meta',
      ),
    ],
  );
}

class CampaignCard extends StatelessWidget {
  const CampaignCard({
    super.key,
    required this.campaign,
    required this.config,
    required this.onTap,
  });
  final PublicCampaign campaign;
  final AppConfig config;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CampaignCover(campaign: campaign, config: config),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  campaign.title,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                Text(
                  [
                    campaign.category,
                    campaign.statusLabel,
                  ].whereType<String>().where((v) => v.isNotEmpty).join(' · '),
                ),
                if (campaign.summary?.isNotEmpty == true) ...[
                  const SizedBox(height: 8),
                  Text(
                    campaign.summary!,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 16),
                CampaignProgress(campaign: campaign),
                const SizedBox(height: 12),
                const Text('Ver campaña'),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
