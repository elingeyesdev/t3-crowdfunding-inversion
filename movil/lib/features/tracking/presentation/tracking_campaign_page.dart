import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../core/network/api_exception.dart';
import '../../auth/application/app_dependencies.dart';
import '../../catalog/presentation/campaign_widgets.dart';
import '../data/tracking_repository.dart';
import '../domain/donor_tracking.dart';
import 'tracking_widgets.dart';

class TrackingCampaignPage extends StatefulWidget {
  const TrackingCampaignPage({
    super.key,
    required this.dependencies,
    required this.campaignId,
  });
  final AppDependencies dependencies;
  final String campaignId;
  @override
  State<TrackingCampaignPage> createState() => _TrackingCampaignPageState();
}

class _TrackingCampaignPageState extends State<TrackingCampaignPage> {
  TrackingCampaign? _data;
  String? _error;
  bool _loading = true;
  int _request = 0;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final request = ++_request;
    final generation = widget.dependencies.session.generation;
    setState(() {
      _loading = true;
      _error = null;
      _data = null;
    });
    try {
      final data = await TrackingRepository(widget.dependencies)
          .campaign(widget.campaignId);
      if (mounted &&
          request == _request &&
          generation == widget.dependencies.session.generation) {
        setState(() => _data = data);
      }
    } catch (e) {
      if (mounted &&
          request == _request &&
          generation == widget.dependencies.session.generation) {
        setState(
          () => _error = e is ApiException && e.statusCode == 404
              ? 'La campaña ya no está disponible para consulta. Tus aportes y comprobantes siguen en Seguimiento.'
              : e is ApiException
              ? e.message
              : 'No se pudieron consultar los avances.',
        );
      }
    } finally {
      if (mounted &&
          request == _request &&
          generation == widget.dependencies.session.generation) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Avances de la campaña')),
    body: SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          children: [
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_error != null)
              TrackingError(message: _error!, retry: _load)
            else if (_data case final data?) ...[
              Text(
                data.campaign.title,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              Text(data.campaign.statusLabel),
              const SizedBox(height: 16),
              CampaignProgress(campaign: data.campaign),
              TextButton(
                onPressed: () => context.pushNamed(
                  AppRoutes.campaignName,
                  pathParameters: {'id': data.campaign.id},
                ),
                child: const Text('Ver detalle público'),
              ),
              const Divider(),
              Text(
                'Hitos del proyecto',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const Text(
                'El avance de los hitos es independiente de la recaudación.',
              ),
              if (data.milestones.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text('El emprendedor todavía no ha publicado hitos.'),
                ),
              for (final m in data.milestones)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          m.title,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        Text(m.statusLabel),
                        if (m.description?.isNotEmpty == true)
                          Text(m.description!),
                        const SizedBox(height: 8),
                        LinearProgressIndicator(
                          value: m.progress / 100,
                          semanticsLabel: 'Avance del hito',
                          semanticsValue: '${m.progress} %',
                        ),
                        Text('${m.progress} % completado'),
                        if (m.target != null)
                          Text(
                            'Fecha prevista: ${trackingDate(m.target!, dateOnly: true)}',
                          ),
                        if (m.completed != null)
                          Text(
                            'Completado: ${trackingDate(m.completed!, dateOnly: true)}',
                          ),
                        TrackingAttachments(
                          items: m.evidence,
                          config: widget.dependencies.config,
                        ),
                      ],
                    ),
                  ),
                ),
              const Divider(),
              Text(
                'Mis aportes a esta campaña',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              for (final row in data.contributions)
                ContributionTrackingCard(row: row, showCampaign: false),
            ],
          ],
        ),
      ),
    ),
  );
}
