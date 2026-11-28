import { useAsyncResource } from './useAsyncResource.ts';
import { getApiErrorMessage } from '../utils/apiError.ts';
import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPublicCampaigns, type PublicCampaignFilters } from '../api/public-campaigns.api';

/**
 * The current URL determines the filters, including browser history navigation.
 */
function filtersFromSearchParams(sp: URLSearchParams): PublicCampaignFilters {
  return {
    page: sp.has('page') ? Number(sp.get('page')) : 1,
    limit: sp.has('limit') ? Number(sp.get('limit')) : 12,
    sortBy: (sp.get('sortBy') as PublicCampaignFilters['sortBy']) || 'created_at',
    sortOrder: (sp.get('sortOrder') as PublicCampaignFilters['sortOrder']) || 'DESC',
    categoryId: sp.get('categoryId') || undefined,
    campaignType: sp.get('campaignType') || undefined,
    q: sp.get('q') || undefined,
  };
}

/**
 * Converts filter state to URLSearchParams, omitting default/empty values
 * to keep the URL clean.
 */
function filtersToSearchParams(f: PublicCampaignFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.page && f.page > 1) params.set('page', String(f.page));
  if (f.limit && f.limit !== 12) params.set('limit', String(f.limit));
  if (f.sortBy && f.sortBy !== 'created_at') params.set('sortBy', f.sortBy);
  if (f.sortOrder && f.sortOrder !== 'DESC') params.set('sortOrder', f.sortOrder);
  if (f.categoryId) params.set('categoryId', f.categoryId);
  if (f.campaignType) params.set('campaignType', f.campaignType);
  if (f.q) params.set('q', f.q);
  return params;
}

export function usePublicCampaigns() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);

  const load = useCallback(() => fetchPublicCampaigns(filters), [filters]);
  const resource = useAsyncResource(load);
  const campaigns = resource.data?.data ?? [];
  const meta = resource.data?.meta ?? null;
  const loading = resource.loading;
  const error = resource.error ? getApiErrorMessage(resource.error, 'Error al cargar campañas') : null;
  const updateFilters = useCallback((partial: Partial<PublicCampaignFilters>) => {
    setSearchParams(previous => filtersToSearchParams({
      ...filtersFromSearchParams(previous),
      ...partial,
      page: partial.page ?? 1, // reset page on filter change unless specified
    }));
  }, [setSearchParams]);

  const goToPage = useCallback((page: number) => {
    updateFilters({ page });
  }, [updateFilters]);

  const refresh = resource.retry;

  return {
    campaigns,
    meta,
    loading,
    error,
    filters,
    updateFilters,
    goToPage,
    refresh,
  };
}
