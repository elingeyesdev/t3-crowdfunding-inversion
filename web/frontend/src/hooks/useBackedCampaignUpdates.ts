import { useEffect, useState } from 'react';
import { getBackedCampaignUpdates, type BackedCampaignUpdate, type BackedCampaignUpdatesPage } from '../api/investor.api';

export function useBackedCampaignUpdates() {
  const [query, setQuery] = useState({ page: 1, campaignId: 'all' });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(query);
  const [state, setState] = useState<{
    key: string; updates: BackedCampaignUpdate[]; campaigns: BackedCampaignUpdatesPage['campaigns'];
    meta: BackedCampaignUpdatesPage['meta'] | null; loading: boolean; error: string | null;
  }>({ key, updates: [], campaigns: [], meta: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState(previous => ({ ...previous, key, updates: [], meta: null, loading: true, error: null }));
    getBackedCampaignUpdates({ page: query.page, campaignId: query.campaignId === 'all' ? undefined : query.campaignId }).then(result => {
      if (active) setState({ key, updates: result.data, campaigns: result.campaigns, meta: result.meta, loading: false, error: null });
    }).catch(() => {
      if (active) setState(previous => ({ ...previous, key, updates: [], meta: null, loading: false, error: 'No se pudieron cargar las novedades de tus proyectos. Intenta nuevamente.' }));
    });
    return () => { active = false; };
  }, [key, attempt]);

  const visible = state.key === key ? state : { ...state, updates: [], meta: null, loading: true, error: null };
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
    onRetry: () => setAttempt(value => value + 1),
  };
}
