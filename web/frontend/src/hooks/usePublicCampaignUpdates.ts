import { useCallback } from 'react';
import { fetchPublicCampaignUpdates } from '../api/public-campaigns.api';
import type { PublicCampaignUpdate } from '../api/public-campaigns.api';
import { useAsyncResource } from './useAsyncResource.ts';

export function usePublicCampaignUpdates(campaignId?: string) {
 const load = useCallback(() => fetchPublicCampaignUpdates(campaignId ?? ''), [campaignId]);
 const resource = useAsyncResource<PublicCampaignUpdate[]>(load, !!campaignId);
 return {updates: resource.data ?? [], loading: resource.loading, error: resource.error ? 'No se pudo cargar la bitácora pública. Intenta nuevamente.' : null, retry: resource.retry};
}
