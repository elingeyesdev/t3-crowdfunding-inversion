import { useCallback } from 'react';
import { fetchPublicCampaignDocuments } from '../api/public-campaigns.api';
import type { PublicCampaignDocument } from '../api/public-campaigns.api';
import { useAsyncResource } from './useAsyncResource.ts';

export function usePublicCampaignDocuments(campaignId: string) {
 const load = useCallback(() => fetchPublicCampaignDocuments(campaignId ?? ''), [campaignId]);
 const resource = useAsyncResource<PublicCampaignDocument[]>(load, !!campaignId);
 return {documents: resource.data ?? [], loading: resource.loading, error: resource.error ? 'No se pudieron cargar las evidencias públicas. Intenta nuevamente.' : null, retry: resource.retry};
}
