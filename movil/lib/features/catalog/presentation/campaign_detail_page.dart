import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../auth/application/app_dependencies.dart';
import '../../auth/application/session_state.dart';
import '../application/catalog_controller.dart';
import '../data/catalog_repository.dart';
import 'campaign_widgets.dart';

class CampaignDetailPage extends StatefulWidget {
  const CampaignDetailPage({
    super.key,
    required this.dependencies,
    required this.campaignId,
  });
  final AppDependencies dependencies;
  final String campaignId;
  @override
  State<CampaignDetailPage> createState() => _CampaignDetailPageState();
}

class _CampaignDetailPageState extends State<CampaignDetailPage> {
  late final controller = CampaignDetailController(
    CatalogRepository(widget.dependencies.publicApi),
  );
  @override
  void initState() {
    super.initState();
    unawaited(controller.load(widget.campaignId));
  }

  @override
  void didUpdateWidget(CampaignDetailPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.campaignId != oldWidget.campaignId) {
      unawaited(controller.load(widget.campaignId));
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  void back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.goNamed(AppRoutes.exploreName);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Campaña'),
      leading: BackButton(onPressed: back),
    ),
    body: SafeArea(
      child: ListenableBuilder(
        listenable: Listenable.merge([controller, widget.dependencies.session]),
        builder: (context, _) {
          if (controller.status == CampaignDetailStatus.loading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (controller.status != CampaignDetailStatus.ready) {
            return ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(
                  controller.status == CampaignDetailStatus.notFound
                      ? 'La campaña no está disponible.'
                      : controller.error!,
                  key: const Key('campaign.detailError'),
                ),
                const SizedBox(height: 16),
                if (controller.status == CampaignDetailStatus.error)
                  FilledButton(
                    onPressed: () => controller.load(widget.campaignId),
                    child: const Text('Reintentar consulta'),
                  ),
                TextButton(
                  onPressed: back,
                  child: const Text('Volver al catálogo'),
                ),
              ],
            );
          }
          final campaign = controller.campaign!;
          final date = campaign.endDate?.toLocal();
          final session = widget.dependencies.session;
          final canContribute =
              session.state.status == SessionStatus.guest ||
              (session.accessToken != null &&
                  (session.state.user?.roles.contains('investor') ?? false));
          return RefreshIndicator(
            onRefresh: () => controller.load(widget.campaignId),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(24),
              children: [
                CampaignCover(
                  campaign: campaign,
                  config: widget.dependencies.config,
                ),
                const SizedBox(height: 20),
                Text(
                  campaign.title,
                  key: const Key('campaign.title'),
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 12),
                Text(campaign.statusLabel),
                if (campaign.category?.isNotEmpty == true)
                  Text(campaign.category!),
                const SizedBox(height: 16),
                CampaignProgress(campaign: campaign),
                if (canContribute &&
                    [
                      'published',
                      'partially_funded',
                    ].contains(campaign.status) &&
                    campaign.raised < campaign.goal &&
                    (campaign.endDate == null ||
                        campaign.endDate!.isAfter(DateTime.now()))) ...[
                  const SizedBox(height: 16),
                  FilledButton(
                    key: const Key('campaign.contribute'),
                    onPressed: () async {
                      await context.pushNamed(
                        AppRoutes.contributionName,
                        pathParameters: {'id': campaign.id},
                      );
                      if (mounted) await controller.load(widget.campaignId);
                    },
                    child: const Text('Aportar'),
                  ),
                ],
                const SizedBox(height: 24),
                Text(
                  'Responsable',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(
                  campaign.creator?.trim().isNotEmpty == true
                      ? campaign.creator!
                      : 'Emprendedor',
                ),
                if (campaign.location?.isNotEmpty == true)
                  Text(campaign.location!),
                if (date != null)
                  Text(
                    'Cierre: ${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}',
                  ),
                const SizedBox(height: 24),
                Text(
                  'Descripción',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                SelectableText(
                  campaign.description?.trim().isNotEmpty == true
                      ? campaign.description!
                      : campaign.summary?.trim().isNotEmpty == true
                      ? campaign.summary!
                      : 'Sin descripción disponible.',
                  key: const Key('campaign.description'),
                ),
              ],
            ),
          );
        },
      ),
    ),
  );
}
