import { useEffect, useState } from 'react';
import { fetchPublicCampaignDocuments, type PublicCampaignDocument } from '../api/public-campaigns.api';

export function usePublicCampaignDocuments(campaignId: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    campaignId: string; documents: PublicCampaignDocument[]; loading: boolean; error: string | null;
  }>({ campaignId, documents: [], loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState({ campaignId, documents: [], loading: true, error: null });
    fetchPublicCampaignDocuments(campaignId).then(documents => {
      if (active) setState({ campaignId, documents, loading: false, error: null });
    }).catch(() => {
      if (active) setState({ campaignId, documents: [], loading: false, error: 'No se pudieron cargar las evidencias públicas. Intenta nuevamente.' });
    });
    return () => { active = false; };
  }, [campaignId, attempt]);

  // Never briefly show the previous campaign's documents during navigation.
  return {
    ...(state.campaignId === campaignId ? state : { documents: [], loading: true, error: null }),
    retry: () => setAttempt(value => value + 1),
  };
}
