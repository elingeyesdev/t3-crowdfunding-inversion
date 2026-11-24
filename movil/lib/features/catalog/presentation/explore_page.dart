import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/app_routes.dart';
import '../../../core/network/api_exception.dart';
import '../../auth/application/app_dependencies.dart';
import '../application/catalog_controller.dart';
import '../data/catalog_repository.dart';
import '../domain/public_campaign.dart';
import 'campaign_widgets.dart';

class ExplorePage extends StatefulWidget {
  const ExplorePage({super.key, required this.dependencies});
  final AppDependencies dependencies;
  @override
  State<ExplorePage> createState() => _ExplorePageState();
}

class _ExplorePageState extends State<ExplorePage> {
  late final controller = CatalogController(
    CatalogRepository(widget.dependencies.publicApi),
  );
  final search = TextEditingController();
  String? selectedCategory;
  @override
  void initState() {
    super.initState();
    if (widget.dependencies.config.hasApi) {
      unawaited(controller.initialize());
    }
  }

  @override
  void dispose() {
    controller.dispose();
    search.dispose();
    super.dispose();
  }

  void apply() {
    FocusScope.of(context).unfocus();
    unawaited(
      controller.loadFirst(
        CatalogQuery(search: search.text.trim(), categoryId: selectedCategory),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: !widget.dependencies.config.hasApi
        ? ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(
                'Explorar',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 16),
              Text(const ApiException(ApiErrorKind.configuration).message),
            ],
          )
        : ListenableBuilder(
            listenable: controller,
            builder: (context, _) => RefreshIndicator(
              onRefresh: controller.refresh,
              child: ListView(
                key: const PageStorageKey('catalog.scroll'),
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                children: [
                  Text(
                    'Explorar',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          key: const Key('catalog.search'),
                          controller: search,
                          maxLength: 200,
                          textInputAction: TextInputAction.search,
                          onSubmitted: (_) => apply(),
                          decoration: const InputDecoration(
                            labelText: 'Buscar campañas',
                            counterText: '',
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        key: const Key('catalog.searchSubmit'),
                        tooltip: 'Buscar',
                        onPressed: apply,
                        icon: const Icon(Icons.search),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  InputDecorator(
                    decoration: const InputDecoration(labelText: 'Categoría'),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        key: const Key('catalog.category'),
                        isExpanded: true,
                        value: selectedCategory ?? '',
                        items: [
                          const DropdownMenuItem(
                            value: '',
                            child: Text(
                              'Todas las categorías',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          for (final category in controller.categories)
                            DropdownMenuItem(
                              value: category.id,
                              child: Text(
                                category.name,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          if (selectedCategory != null &&
                              !controller.categories.any(
                                (c) => c.id == selectedCategory,
                              ))
                            DropdownMenuItem(
                              value: selectedCategory,
                              enabled: false,
                              child: const Text(
                                'Categoría no disponible',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        onChanged: (value) {
                          setState(
                            () => selectedCategory = value == '' ? null : value,
                          );
                          apply();
                        },
                      ),
                    ),
                  ),
                  if (controller.loadingCategories)
                    const LinearProgressIndicator(),
                  if (controller.categoriesError != null) ...[
                    const SizedBox(height: 8),
                    const Text('No se pudieron cargar las categorías.'),
                    TextButton(
                      onPressed: controller.loadCategories,
                      child: const Text('Reintentar categorías'),
                    ),
                  ],
                  if (controller.query.search.isNotEmpty ||
                      controller.query.categoryId != null)
                    TextButton(
                      key: const Key('catalog.clear'),
                      onPressed: () {
                        search.clear();
                        setState(() => selectedCategory = null);
                        apply();
                      },
                      child: const Text('Limpiar filtros'),
                    ),
                  const SizedBox(height: 24),
                  if (controller.status == CatalogStatus.loading)
                    const Center(child: CircularProgressIndicator())
                  else if (controller.status == CatalogStatus.error) ...[
                    Text(controller.error!, key: const Key('catalog.error')),
                    FilledButton(
                      onPressed: () => controller.loadFirst(controller.query),
                      child: const Text('Reintentar catálogo'),
                    ),
                  ] else if (controller.status == CatalogStatus.empty)
                    Text(
                      controller.query.search.isNotEmpty ||
                              controller.query.categoryId != null
                          ? 'No hay campañas que coincidan con tu búsqueda.'
                          : 'Todavía no hay campañas disponibles.',
                      key: const Key('catalog.empty'),
                    )
                  else ...[
                    Text(
                      '${controller.total} campañas',
                      key: const Key('catalog.total'),
                    ),
                    const SizedBox(height: 12),
                    for (final campaign in controller.campaigns) ...[
                      CampaignCard(
                        key: Key('campaign.${campaign.id}'),
                        campaign: campaign,
                        config: widget.dependencies.config,
                        onTap: () => context.pushNamed(
                          AppRoutes.campaignName,
                          pathParameters: {'id': campaign.id},
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    if (controller.pageError != null)
                      Text(
                        controller.pageError!,
                        key: const Key('catalog.pageError'),
                      ),
                    if (controller.hasMore)
                      FilledButton(
                        key: const Key('catalog.more'),
                        onPressed: controller.loadingMore
                            ? null
                            : controller.loadMore,
                        child: controller.loadingMore
                            ? const SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(
                                controller.pageError == null
                                    ? 'Cargar más'
                                    : 'Reintentar carga',
                              ),
                      ),
                  ],
                ],
              ),
            ),
          ),
  );
}
