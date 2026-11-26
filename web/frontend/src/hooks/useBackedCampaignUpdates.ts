import { useState, useCallback } from 'react';
import { useAsyncResource } from './useAsyncResource.ts';
import { getBackedCampaignUpdates } from '../api/investor.api';

export function useBackedCampaignUpdates() {
  const [query, setQuery] = useState({ page: 1, campaignId: 'all' });
  const load = useCallback(() => getBackedCampaignUpdates({page: query.page, campaignId: query.campaignId === 'all' ? undefined : query.campaignId}), [query.page, query.campaignId]);
  const resource = useAsyncResource(load);
  const visible = {
    updates: resource.data?.data ?? [],
    campaigns: resource.data?.campaigns ?? [],
    meta: resource.data?.meta ?? null,
    loading: resource.loading,
    error: resource.error
      ? 'No se pudieron cargar las novedades de tus proyectos. Intenta nuevamente.'
      : null,
  };
  return {
    updates: visible.updates,
    campaigns: visible.campaigns,
    meta: visible.meta,
    loading: visible.loading,
    error: visible.error,
    page: query.page,
    selectedCampaignId: query.campaignId,
    onCampaignChange: (campaignId: string) => setQuery({ page: 1, campaignId }),
    onPageChange: (page: number) => setQuery(previous => ({ ...previous, page: Math.max(1, page) })),
    onRetry: resource.retry,
  };
}
