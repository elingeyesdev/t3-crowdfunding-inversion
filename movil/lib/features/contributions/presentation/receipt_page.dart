import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../core/network/api_exception.dart';
import '../../auth/application/app_dependencies.dart';
import '../data/contribution_repository.dart';
import '../domain/contribution.dart';

class ReceiptListPage extends StatefulWidget {
  const ReceiptListPage({super.key, required this.dependencies});
  final AppDependencies dependencies;
  @override
  State<ReceiptListPage> createState() => _ReceiptListPageState();
}

class _ReceiptListPageState extends State<ReceiptListPage> {
  List<ContributionReceipt> rows = [];
  bool loading = true;
  String? error;
  int revision = 0;
  @override
  void initState() {
    super.initState();
    unawaited(load());
  }

  Future<void> load() async {
    final request = ++revision;
    final generation = widget.dependencies.session.generation;
    setState(() {
      loading = true;
      error = null;
      rows = [];
    });
    try {
      final result = await ContributionRepository(widget.dependencies)
          .receipts();
      if (mounted &&
          request == revision &&
          generation == widget.dependencies.session.generation) {
        setState(() => rows = result);
      }
    } catch (e) {
      if (mounted && request == revision) {
        setState(
          () => error = e is ApiException
              ? e.message
              : 'La sesión ya no está disponible.',
        );
      }
    } finally {
      if (mounted && request == revision) setState(() => loading = false);
    }
  }

  @override
  void dispose() {
    revision++;
    rows = [];
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Mis comprobantes'),
      leading: BackButton(
        onPressed: () =>
            context.canPop() ? context.pop() : context.go(AppRoutes.account),
      ),
    ),
    body: SafeArea(
      child: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          children: [
            const Text('Operaciones con saldo simulado.'),
            if (loading)
              const Center(child: CircularProgressIndicator())
            else if (error != null) ...[
              Text(error!),
              FilledButton(
                onPressed: load,
                child: const Text('Reintentar consulta'),
              ),
            ] else if (rows.isEmpty)
              const Text('Todavía no tienes comprobantes.')
            else
              for (final r in rows)
                Card(
                  child: ListTile(
                    title: Text(r.title),
                    subtitle: Text(
                      '${Money.label(r.amount, r.currency)}\n${r.date.toLocal().toString().split('.').first}\nEstado: ${r.statusLabel}${r.rewardTitle == null ? '' : '\nRecompensa: ${r.rewardTitle!}'}',
                    ),
                    isThreeLine: true,
                    trailing: const Icon(Icons.picture_as_pdf),
                    onTap: () => context.pushNamed(
                      AppRoutes.receiptName,
                      pathParameters: {'id': r.id},
                    ),
                  ),
                ),
          ],
        ),
      ),
    ),
  );
}

class ReceiptPage extends StatefulWidget {
  const ReceiptPage({
    super.key,
    required this.dependencies,
    required this.investmentId,
  });
  final AppDependencies dependencies;
  final String investmentId;
  @override
  State<ReceiptPage> createState() => _ReceiptPageState();
}

class _ReceiptPageState extends State<ReceiptPage> {
  static const channel = MethodChannel('unifundme/receipt');
  Uint8List? pdf, png;
  int page = 0, pages = 0, revision = 0;
  bool loading = true;
  String? error;
  @override
  void initState() {
    super.initState();
    unawaited(load());
  }

  @override
  void dispose() {
    revision++;
    pdf = null;
    png = null;
    super.dispose();
  }

  Future<void> load() async {
    final request = ++revision,
        generation = widget.dependencies.session.generation;
    setState(() {
      loading = true;
      error = null;
      pdf = null;
      png = null;
      page = 0;
      pages = 0;
    });
    try {
      final bytes = await ContributionRepository(widget.dependencies)
          .pdf(widget.investmentId);
      if (!mounted ||
          request != revision ||
          generation != widget.dependencies.session.generation) {
        return;
      }
      pdf = bytes;
      await render(0);
    } catch (e) {
      if (mounted && request == revision) {
        setState(() {
          error = e is ApiException
              ? e.message
              : 'No se pudo consultar el comprobante.';
          loading = false;
        });
      }
    }
  }

  Future<void> render(int index) async {
    if (pdf == null) return;
    final request = ++revision,
        generation = widget.dependencies.session.generation;
    setState(() {
      loading = true;
      error = null;
      png = null;
    });
    try {
      final result = await channel.invokeMapMethod<String, Object?>('render', {
        'bytes': pdf,
        'page': index,
        'width': 1400,
      });
      if (!mounted ||
          request != revision ||
          generation != widget.dependencies.session.generation) {
        return;
      }
      final image = result?['png'], count = result?['pages'];
      if (image is! Uint8List || count is! int || count < 1 || index >= count) {
        throw const FormatException();
      }
      setState(() {
        png = image;
        page = index;
        pages = count;
        loading = false;
      });
    } catch (_) {
      if (mounted && request == revision) {
        setState(() {
          loading = false;
          error =
              'No se pudo mostrar esta página del PDF. Reintenta la consulta.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Comprobante PDF'),
      leading: BackButton(
        onPressed: () =>
            context.canPop() ? context.pop() : context.go(AppRoutes.receipts),
      ),
    ),
    body: SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(
              'Aporte con saldo simulado\nReferencia: ${widget.investmentId}',
            ),
          ),
          Expanded(
            child: loading
                ? const Center(child: CircularProgressIndicator())
                : error != null
                ? ListView(
                    padding: const EdgeInsets.all(24),
                    children: [
                      Text(error!),
                      FilledButton(
                        onPressed: load,
                        child: const Text('Reintentar comprobante'),
                      ),
                    ],
                  )
                : InteractiveViewer(
                    key: ValueKey(page),
                    minScale: 0.5,
                    maxScale: 5,
                    child: Center(
                      child: Image.memory(
                        png!,
                        gaplessPlayback: false,
                        semanticLabel: 'Página del comprobante PDF',
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 12,
              children: [
                IconButton(
                  tooltip: 'Página anterior',
                  onPressed: loading || page == 0
                      ? null
                      : () => render(page - 1),
                  icon: const Icon(Icons.chevron_left),
                ),
                Text(pages == 0 ? 'PDF' : 'Página ${page + 1} de $pages'),
                IconButton(
                  tooltip: 'Página siguiente',
                  onPressed: loading || page + 1 >= pages
                      ? null
                      : () => render(page + 1),
                  icon: const Icon(Icons.chevron_right),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
