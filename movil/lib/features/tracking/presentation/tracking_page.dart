import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../auth/application/app_dependencies.dart';
import '../application/tracking_controller.dart';
import '../data/tracking_repository.dart';
import '../domain/donor_tracking.dart';
import 'tracking_widgets.dart';

class TrackingPage extends StatefulWidget {
  const TrackingPage({super.key, required this.dependencies});
  final AppDependencies dependencies;
  @override
  State<TrackingPage> createState() => _TrackingPageState();
}

class _TrackingPageState extends State<TrackingPage>
    with WidgetsBindingObserver {
  late final TrackingController _controller;
  final _search = TextEditingController();
  int _tab = 0;
  String _contributionStatus = 'all', _rewardStatus = 'all';
  GoRouter? _router;
  String? _lastPath;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controller = TrackingController(TrackingRepository(widget.dependencies));
    unawaited(_controller.refresh());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final router = GoRouter.maybeOf(context);
    if (router == _router) return;
    _router?.routeInformationProvider.removeListener(_routeChanged);
    _router = router;
    _lastPath = router?.routeInformationProvider.value.uri.path;
    router?.routeInformationProvider.addListener(_routeChanged);
  }

  void _routeChanged() {
    final path = _router?.routeInformationProvider.value.uri.path;
    final returned = path == AppRoutes.tracking && _lastPath != path;
    _lastPath = path;
    if (returned) {
      scheduleMicrotask(() {
        if (mounted) unawaited(_controller.refresh());
      });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        (_router == null ||
            _router!.routeInformationProvider.value.uri.path ==
                AppRoutes.tracking)) {
      unawaited(_controller.refresh());
    }
  }

  @override
  void dispose() {
    _router?.routeInformationProvider.removeListener(_routeChanged);
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Column(
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 12),
          child: Text(
            'Mi seguimiento',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
          ),
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.all(8),
          child: Wrap(
            spacing: 8,
            children: [
              for (final (i, label) in [
                'Aportes',
                'Recompensas',
                'Novedades',
              ].indexed)
                ChoiceChip(
                  key: ValueKey('tracking.tab.$i'),
                  label: Text(label),
                  selected: _tab == i,
                  onSelected: (_) => setState(() => _tab = i),
                ),
            ],
          ),
        ),
        Expanded(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (_, _) => RefreshIndicator(
              onRefresh: _controller.refresh,
              child: ListView(
                key: ValueKey('tracking.list.$_tab'),
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: _tab == 2 ? _updates() : _history(),
              ),
            ),
          ),
        ),
      ],
    ),
  );

  List<Widget> _history() {
    if (_controller.loadingHistory) {
      return const [Center(child: CircularProgressIndicator())];
    }
    if (_controller.historyError != null) {
      return [
        TrackingError(
          message: _controller.historyError!,
          retry: _controller.loadHistory,
        ),
      ];
    }
    final all = _controller.contributions;
    final rewards = _tab == 1;
    final source = all.where((r) => !rewards || r.hasReward).toList();
    final query = _search.text.trim().toLowerCase();
    final rows = source
        .where(
          (r) =>
              (rewards
                  ? _rewardStatus == 'all' || _rewardStatus == r.rewardState
                  : _contributionStatus == 'all' ||
                        _contributionStatus == r.receipt.status) &&
              '${r.receipt.title} ${r.receipt.rewardTitle ?? ''} ${r.receipt.id}'
                  .toLowerCase()
                  .contains(query),
        )
        .toList();
    return [
      if (!rewards) ...[
        Text(
          '${all.map((r) => r.receipt.campaignId).toSet().length} campañas · ${all.length} aportes',
        ),
        for (final (status, label) in [
          ('completed', 'Aportes registrados'),
          ('refunded', 'Reembolsados'),
          ('pending', 'Pendientes'),
        ])
          for (final total in contributionTotals(all, status).entries)
            Text('$label: ${trackingTotalLabel(total.value, total.key)}'),
        const SizedBox(height: 12),
      ],
      if (source.isNotEmpty) ...[
        TextField(
          key: const ValueKey('tracking.search'),
          controller: _search,
          maxLength: 200,
          decoration: const InputDecoration(
            labelText: 'Buscar campaña, recompensa o referencia',
            prefixIcon: Icon(Icons.search),
          ),
          onChanged: (_) => setState(() {}),
        ),
        DropdownButtonFormField<String>(
          key: ValueKey(
            'tracking.status.$rewards.${rewards ? _rewardStatus : _contributionStatus}',
          ),
          initialValue: rewards ? _rewardStatus : _contributionStatus,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: rewards ? 'Estado de recompensa' : 'Estado del aporte',
          ),
          items:
              (rewards
                      ? {'all': 'Todas', ...rewardStates}
                      : {
                          'all': 'Todos',
                          'completed': 'Registrado',
                          'refunded': 'Reembolsado',
                          'pending': 'Pendiente',
                          'failed': 'No completado',
                        })
                  .entries
                  .map(
                    (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
                  )
                  .toList(),
          onChanged: (value) {
            if (value != null) {
              setState(() {
                if (rewards) {
                  _rewardStatus = value;
                } else {
                  _contributionStatus = value;
                }
              });
            }
          },
        ),
        const SizedBox(height: 12),
      ],
      if (rows.isEmpty) ...[
        Text(
          source.isEmpty
              ? rewards
                    ? 'Aún no tienes recompensas asociadas.'
                    : 'Aún no tienes aportes registrados.'
              : 'No hay resultados para estos filtros.',
        ),
        if (source.isNotEmpty)
          TextButton(
            onPressed: () => setState(() {
              _search.clear();
              _contributionStatus = _rewardStatus = 'all';
            }),
            child: const Text('Limpiar filtros'),
          ),
        if (source.isEmpty)
          TextButton(
            onPressed: () => context.go(AppRoutes.explore),
            child: const Text('Explorar campañas'),
          ),
      ],
      for (final row in rows)
        ContributionTrackingCard(
          key: ValueKey(row.receipt.id),
          row: row,
          reward: rewards,
        ),
      const SizedBox(height: 16),
      OutlinedButton.icon(
        onPressed: _controller.loadHistory,
        icon: const Icon(Icons.refresh),
        label: const Text('Actualizar seguimiento'),
      ),
    ];
  }

  List<Widget> _updates() {
    final result = _controller.updates;
    final filter = _controller.campaignFilter;
    return [
      const Text('Novedades públicas de las campañas que has apoyado.'),
      const SizedBox(height: 12),
      DropdownButtonFormField<String>(
        key: ValueKey('tracking.campaign.${filter ?? 'all'}'),
        initialValue: filter ?? 'all',
        isExpanded: true,
        decoration: const InputDecoration(labelText: 'Campaña'),
        items: [
          const DropdownMenuItem(
            value: 'all',
            child: Text('Todas mis campañas'),
          ),
          if (filter != null &&
              result?.campaigns.any((c) => c.id == filter) != true)
            DropdownMenuItem(
              value: filter,
              child: const Text('Campaña seleccionada'),
            ),
          for (final c in result?.campaigns ?? <BackedCampaignOption>[])
            DropdownMenuItem(
              value: c.id,
              child: Text(
                c.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
        onChanged: (value) {
          if (value != null) {
            unawaited(
              _controller.selectCampaign(value == 'all' ? null : value),
            );
          }
        },
      ),
      const SizedBox(height: 16),
      if (_controller.loadingUpdates)
        const Center(child: CircularProgressIndicator())
      else if (_controller.updatesError != null)
        TrackingError(
          message: _controller.updatesError!,
          retry: () => _controller.loadUpdates(),
        )
      else ...[
        if (result == null || result.items.isEmpty)
          const Text('Todavía no hay novedades públicas para esta selección.'),
        for (final u in result?.items ?? <BackedUpdate>[])
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    u.campaignTitle,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text('${u.author} · ${trackingDate(u.createdAt)}'),
                  const SizedBox(height: 8),
                  Text(u.title, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  SelectableText(u.content),
                  const SizedBox(height: 12),
                  LinearProgressIndicator(
                    value: u.progress,
                    semanticsLabel: 'Recaudación de la campaña',
                  ),
                  Text(
                    '${(u.raised * 100 / u.goal).toStringAsFixed(1)} % de la meta de recaudación',
                  ),
                  TrackingAttachments(
                    items: u.attachments,
                    config: widget.dependencies.config,
                  ),
                  TextButton(
                    onPressed: () => context.pushNamed(
                      AppRoutes.trackingCampaignName,
                      pathParameters: {'id': u.campaignId},
                    ),
                    child: const Text('Ver avances de la campaña'),
                  ),
                ],
              ),
            ),
          ),
        if (result != null && result.pages > 1)
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              TextButton(
                key: const ValueKey('tracking.previous'),
                onPressed: result.page > 1
                    ? () => _controller.loadUpdates(page: result.page - 1)
                    : null,
                child: const Text('Anterior'),
              ),
              Text(
                'Página ${result.page} de ${result.pages} · ${result.total} novedades',
              ),
              TextButton(
                key: const ValueKey('tracking.next'),
                onPressed: result.page < result.pages
                    ? () => _controller.loadUpdates(page: result.page + 1)
                    : null,
                child: const Text('Siguiente'),
              ),
            ],
          ),
        OutlinedButton.icon(
          onPressed: () => _controller.loadUpdates(),
          icon: const Icon(Icons.refresh),
          label: const Text('Actualizar novedades'),
        ),
      ],
    ];
  }
}
