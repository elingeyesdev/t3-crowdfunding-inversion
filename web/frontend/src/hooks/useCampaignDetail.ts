import { useCallback } from 'react';
import { fetchPublicCampaignById } from '../api/public-campaigns.api';
import { getApiErrorMessage, getApiErrorStatus } from '../utils/apiError.ts';
import { useAsyncResource } from './useAsyncResource.ts';
export function useCampaignDetail(id: string | undefined) {
 const load = useCallback(() => fetchPublicCampaignById(id ?? ''), [id]);
 const resource = useAsyncResource(load, !!id);
 const error = !id
   ? 'ID de campaña no proporcionado'
   : resource.error
     ? getApiErrorStatus(resource.error) === 404
       ? 'Campaña no encontrada o no está publicada'
       : getApiErrorMessage(resource.error, 'Error al cargar la campaña')
     : null;
 return {campaign: resource.data, loading: resource.loading, error, retry: resource.retry, refetch: resource.refetch};
}
