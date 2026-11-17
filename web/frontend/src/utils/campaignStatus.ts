import type { CampaignStatus } from '../types/campaign.types';

export const CAMPAIGN_GROUPS = [
  { value: 'drafts', label: 'Borradores y correcciones', statuses: ['draft', 'rejected'] },
  { value: 'review', label: 'En revisión', statuses: ['pending_review', 'in_review'] },
  { value: 'approved', label: 'Aprobadas', statuses: ['approved'] },
  { value: 'active', label: 'Activas', statuses: ['published', 'partially_funded'] },
  { value: 'funded', label: 'Financiadas', statuses: ['funded'] },
  { value: 'completed', label: 'Finalizadas', statuses: ['completed', 'failed', 'cancelled'] },
  { value: 'suspended', label: 'Suspendidas', statuses: ['suspended'] },
] as const;

export const CAMPAIGN_FILTERS = [{ value: 'all', label: 'Todas' }, ...CAMPAIGN_GROUPS] as const;
export type CampaignGroupFilter = typeof CAMPAIGN_FILTERS[number]['value'];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Borrador',
  rejected: 'Rechazada',
  pending_review: 'Pendiente de revisión',
  in_review: 'En revisión',
  approved: 'Aprobada',
  published: 'Publicada',
  partially_funded: 'Parcialmente financiada',
  funded: 'Financiada',
  completed: 'Completada',
  failed: 'Meta no alcanzada',
  cancelled: 'Cancelada',
  suspended: 'Suspendida',
};

export function campaignStatusLabel(status: string): string {
  return Object.hasOwn(CAMPAIGN_STATUS_LABELS, status)
    ? CAMPAIGN_STATUS_LABELS[status as CampaignStatus]
    : 'Estado desconocido';
}

export function matchesCampaignGroup(status: string, filter: string): boolean {
  if (filter === 'all') return true;
  const group = CAMPAIGN_GROUPS.find(group => group.value === filter);
  return group ? (group.statuses as readonly string[]).includes(status) : false;
}
