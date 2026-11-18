import { useEffect, useState } from 'react';
import { fetchPublicCampaignUpdates, type PublicCampaignUpdate } from '../api/public-campaigns.api';

export function usePublicCampaignUpdates(campaignId?: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    campaignId?: string; updates: PublicCampaignUpdate[]; loading: boolean; error: string | null;
  }>({ campaignId, updates: [], loading: !!campaignId, error: null });

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    setState({ campaignId, updates: [], loading: true, error: null });
    fetchPublicCampaignUpdates(campaignId).then(updates => {
      if (active) setState({ campaignId, updates, loading: false, error: null });
    }).catch(() => {
      if (active) setState({ campaignId, updates: [], loading: false, error: 'No se pudo cargar la bitácora pública. Intenta nuevamente.' });
    });
    return () => { active = false; };
  }, [campaignId, attempt]);

  return {
    ...(state.campaignId === campaignId ? state : { updates: [], loading: !!campaignId, error: null }),
    retry: () => setAttempt(value => value + 1),
  };
}
