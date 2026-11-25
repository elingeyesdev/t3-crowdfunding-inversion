import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../account/domain/profile_details.dart';
import '../../account/presentation/profile_page.dart';
import '../../auth/application/app_dependencies.dart';
import '../application/contribution_controller.dart';
import '../domain/contribution.dart';

class ContributionPage extends StatefulWidget {
  const ContributionPage({
    super.key,
    required this.dependencies,
    required this.campaignId,
  });
  final AppDependencies dependencies;
  final String campaignId;
  @override
  State<ContributionPage> createState() => _ContributionPageState();
}

class _ContributionPageState extends State<ContributionPage> {
  late final controller = ContributionController(
    widget.dependencies,
    widget.campaignId,
  );
  final amount = TextEditingController();
  String? rewardId, localError;
  bool dialogOpen = false;
  @override
  void initState() {
    super.initState();
    unawaited(controller.load());
  }

  @override
  void dispose() {
    controller.dispose();
    amount.dispose();
    super.dispose();
  }

  Future<void> review({bool topUp = false}) async {
    if (controller.busy || dialogOpen) return;
    final cents = Money.input(amount.text);
    setState(
      () => localError = topUp
          ? (cents == null || cents < 1 || cents > 100000000000
                ? 'Introduce un monto de saldo válido, hasta 1.000.000.000,00.'
                : null)
          : controller.validate(cents, rewardId),
    );
    if (localError != null) return;
    final generation = widget.dependencies.session.generation;
    final selected = controller.rewards
        .where((r) => r.id == rewardId)
        .firstOrNull;
    dialogOpen = true;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => ListenableBuilder(
        listenable: widget.dependencies.session,
        builder: (_, _) {
          if (generation != widget.dependencies.session.generation ||
              !controller.allowed) {
            return AlertDialog(
              title: const Text('La sesión cambió'),
              content: const Text('Cierra esta revisión y vuelve a tu cuenta.'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('Cerrar'),
                ),
              ],
            );
          }
          return AlertDialog(
            scrollable: true,
            title: Text(topUp ? 'Agregar saldo simulado' : 'Confirmar aporte'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(controller.campaign!.campaign.title),
                  Text(
                    'Monto: ${Money.label(cents!, controller.campaign!.campaign.currency)}',
                  ),
                  if (!topUp)
                    Text('Recompensa: ${selected?.title ?? 'Sin recompensa'}'),
                  const SizedBox(height: 12),
                  Text(
                    topUp
                        ? 'Se agregará saldo de simulación. No se cargará dinero a una cuenta bancaria.'
                        : 'El aporte utiliza tu saldo simulado. Confirma solo una vez.',
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                key: const Key('contribution.confirm'),
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Confirmar'),
              ),
            ],
          );
        },
      ),
    );
    dialogOpen = false;
    if (!mounted ||
        confirm != true ||
        generation != widget.dependencies.session.generation ||
        !controller.allowed) {
      return;
    }
    if (topUp) {
      await controller.topUp(cents!);
    } else {
      await controller.submit(cents!, rewardId);
    }
  }

  Widget button(String text, VoidCallback? onPressed, {String? key}) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: FilledButton(
      key: key == null ? null : Key(key),
      onPressed: onPressed,
      child: Text(text),
    ),
  );

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: controller,
    builder: (_, _) => PopScope(
      canPop: !controller.busy,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Aportar'),
          automaticallyImplyLeading: !controller.busy,
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: _content(),
          ),
        ),
      ),
    ),
  );
  List<Widget> _content() {
    final c = controller;
    if (!c.allowed) return [const Text('La sesión ya no está disponible.')];
    if (c.status == ContributionStatus.loading) {
      return [const Center(child: CircularProgressIndicator())];
    }
    if (c.status == ContributionStatus.success) {
      final r = c.receipt!;
      return [
        const Text('Aporte registrado', key: Key('contribution.success')),
        Text(Money.label(r.amount, r.currency)),
        SelectableText('Referencia: ${r.id}'),
        if (c.message != null) Text(c.message!),
        button(
          'Consultar comprobante PDF',
          () => context.pushNamed(
            AppRoutes.receiptName,
            pathParameters: {'id': r.id},
          ),
        ),
        TextButton(
          onPressed: () => context.goNamed(
            AppRoutes.campaignName,
            pathParameters: {'id': widget.campaignId},
          ),
          child: const Text('Volver a la campaña'),
        ),
      ];
    }
    if (c.status == ContributionStatus.pending) {
      return [
        const Text(
          'Operación pendiente de comprobar',
          key: Key('contribution.pending'),
        ),
        if (c.pending != null) ...[
          Text(c.pending!.capital ? 'Carga de saldo simulado' : 'Aporte'),
          Text(Money.label(c.pending!.amount, c.pending!.currency)),
          SelectableText('Campaña: ${c.pending!.campaignId}'),
        ],
        Text(c.message ?? 'Consulta el resultado antes de volver a aportar.'),
        button('Comprobar resultado', c.busy ? null : () => c.reconcile()),
        TextButton(
          onPressed: c.busy
              ? null
              : () => context.pushNamed(AppRoutes.receiptsName),
          child: const Text('Mis comprobantes'),
        ),
        if (c.busy) const LinearProgressIndicator(),
      ];
    }
    if (c.status == ContributionStatus.missingProfile) {
      return [
        const Text('No se pudo cargar la campaña o tu perfil de donante.'),
        button('Revisar perfil de donante', () async {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => ProfilePage(
                dependencies: widget.dependencies,
                kind: ProfileKind.investor,
              ),
            ),
          );
          if (mounted) await c.load();
        }),
        button('Reintentar consulta', () => c.load()),
      ];
    }
    if (c.status == ContributionStatus.error || c.campaign == null) {
      return [
        Text(c.message ?? 'No se pudo preparar el aporte.'),
        button('Actualizar datos', () => c.load()),
      ];
    }
    final campaign = c.campaign!;
    final currency = campaign.campaign.currency;
    return [
      Text(
        campaign.campaign.title,
        style: Theme.of(context).textTheme.headlineSmall,
      ),
      const SizedBox(height: 12),
      const Text(
        'Este sistema utiliza saldo simulado. No realiza cobros bancarios.',
      ),
      Text('Saldo simulado disponible: ${Money.label(c.capital!.available)}'),
      Text('Moneda de la campaña: $currency'),
      Text('Mínimo: ${Money.label(campaign.minimum, currency)}'),
      if (campaign.maximum != null)
        Text('Máximo: ${Money.label(campaign.maximum!, currency)}'),
      Text('Falta para la meta: ${Money.label(campaign.remaining, currency)}'),
      const SizedBox(height: 20),
      TextField(
        key: const Key('contribution.amount'),
        controller: amount,
        enabled: !c.busy,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        maxLength: 16,
        onChanged: (_) => setState(() => localError = null),
        decoration: InputDecoration(
          labelText: 'Monto',
          suffixText: currency,
          helperText: 'Hasta dos decimales. Sin separadores de miles.',
          errorText: localError,
          errorMaxLines: 4,
        ),
      ),
      const SizedBox(height: 12),
      DropdownButtonFormField<String>(
        key: ValueKey('reward:${rewardId ?? 'none'}'),
        initialValue: rewardId ?? '',
        isExpanded: true,
        decoration: const InputDecoration(labelText: 'Recompensa opcional'),
        items: [
          const DropdownMenuItem(value: '', child: Text('Sin recompensa')),
          for (final r in c.rewards)
            DropdownMenuItem(
              value: r.id,
              enabled: r.available(DateTime.now()),
              child: Text(
                r.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
        ],
        onChanged: c.busy
            ? null
            : (value) => setState(() => rewardId = value == '' ? null : value),
      ),
      for (final r in c.rewards.where((r) => r.id == rewardId)) ...[
        const SizedBox(height: 12),
        if (r.description != null) Text(r.description!),
        Text('Desde ${Money.label(r.amount, r.currency)}; ${r.range}'),
        Text(
          r.limit == null
              ? 'Sin cupo máximo'
              : 'Cupos restantes: ${(r.limit! - r.claimed).clamp(0, r.limit!)}',
        ),
        if (r.delivery != null)
          Text(
            'Entrega estimada: ${r.delivery!.toLocal().toString().split(' ').first}',
          ),
        if (r.expires != null)
          Text(
            'Vigente hasta: ${r.expires!.toLocal().toString().split(' ').first}',
          ),
        Text(r.includesShipping ? 'Incluye envío' : 'Envío no incluido'),
        if (r.shipping != null) Text(r.shipping!),
        for (final item in r.items) Text('• $item'),
      ],
      if (c.message != null)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text(c.message!, key: const Key('contribution.message')),
        ),
      button(
        'Revisar aporte',
        c.busy ? null : () => review(),
        key: 'contribution.review',
      ),
      OutlinedButton(
        onPressed: c.busy ? null : () => review(topUp: true),
        child: const Text('Agregar este monto a mi saldo simulado'),
      ),
      TextButton(
        onPressed: c.busy
            ? null
            : () {
                setState(() => rewardId = null);
                unawaited(c.load());
              },
        child: const Text('Actualizar saldo y recompensas'),
      ),
      TextButton(
        onPressed: c.busy
            ? null
            : () => context.pushNamed(AppRoutes.receiptsName),
        child: const Text('Mis comprobantes'),
      ),
      if (c.busy) const LinearProgressIndicator(),
    ];
  }
}
