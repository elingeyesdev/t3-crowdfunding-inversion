import { useState, useEffect, useCallback } from 'react';
import {
  fetchPublicCampaignById,
  type PublicCampaignDetail,
} from '../api/public-campaigns.api';

export function useCampaignDetail(id: string | undefined) {
  const [campaign, setCampaign] = useState<PublicCampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCampaign = useCallback(async (campaignId: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchPublicCampaignById(campaignId);
      setCampaign(result);
    } catch (err: any) {
      const msg =
        err?.response?.status === 404
          ? 'Campaña no encontrada o no está publicada'
          : err?.response?.data?.message || 'Error al cargar la campaña';
      setError(msg);
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /** Recarga silenciosa sin mostrar el loading spinner (para actualizar datos en tiempo real) */
  const refetch = useCallback(async () => {
    if (!id) return;
    try {
      const result = await fetchPublicCampaignById(id);
      setCampaign(result);
    } catch {
      // Error silencioso: los datos actuales se mantienen
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadCampaign(id);
    } else {
      setLoading(false);
      setError('ID de campaña no proporcionado');
    }
  }, [id, loadCampaign]);

  const retry = useCallback(() => {
    if (id) loadCampaign(id);
  }, [id, loadCampaign]);

  return { campaign, loading, error, retry, refetch };
}

