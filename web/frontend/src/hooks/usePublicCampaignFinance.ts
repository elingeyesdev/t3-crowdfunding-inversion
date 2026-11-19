import { useEffect, useState } from 'react';
import { fetchPublicCampaignFinancialProgress } from '../api/public-campaigns.api';
import type { CampaignFinancialProgress } from '../types/campaign.types';

export function usePublicCampaignFinance(campaignId: string) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([campaignId, attempt]);
  const [result, setResult] = useState<{
    key: string; finance: CampaignFinancialProgress | null; error: string | null;
  }>({ key: '', finance: null, error: null });

  useEffect(() => {
    let active = true;
    fetchPublicCampaignFinancialProgress(campaignId).then(finance => {
      if (active) setResult({ key, finance, error: null });
    }).catch(() => {
      if (active) setResult({ key, finance: null, error: 'No se pudo cargar la auditoría financiera pública. Intenta nuevamente.' });
    });
    return () => { active = false; };
  }, [campaignId, key]);

  // Derive loading immediately, before effects run, when the campaign changes
  // or a retry starts. Old results and late responses cannot replace this request.
  const loading = result.key !== key;
  return {
    finance: loading ? null : result.finance,
    error: loading ? null : result.error,
    loading,
    retry: () => setAttempt(value => value + 1),
  };
}
