import { useAsyncResource } from './useAsyncResource.ts';
import { getApiErrorMessage } from '../utils/apiError.ts';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPublicCampaigns, type PublicCampaignFilters } from '../api/public-campaigns.api';

/**
 * Reads initial filter values from URL search params so that
 * navigating back from CampaignDetailPage restores the previous state.
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

export function usePublicCampaigns(initialFilters: PublicCampaignFilters = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL on first render
  const [filters, setFilters] = useState<PublicCampaignFilters>(() => ({
    ...filtersFromSearchParams(searchParams),
    ...initialFilters,
  }));

  // Sync filters → URL (replace, don't push, to avoid polluting history)
  useEffect(() => {
    setSearchParams(filtersToSearchParams(filters), { replace: true });
  }, [filters, setSearchParams]);

  const load = useCallback(() => fetchPublicCampaigns(filters), [filters]);
  const resource = useAsyncResource(load);
  const campaigns = resource.data?.data ?? [];
  const meta = resource.data?.meta ?? null;
  const loading = resource.loading;
  const error = resource.error ? getApiErrorMessage(resource.error, 'Error al cargar campañas') : null;
  const updateFilters = useCallback((partial: Partial<PublicCampaignFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...partial,
      page: partial.page ?? 1, // reset page on filter change unless specified
    }));
  }, []);

  const goToPage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

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
