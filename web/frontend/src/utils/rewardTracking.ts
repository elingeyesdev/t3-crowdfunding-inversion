import type { InvestmentHistoryItem } from '../api/investor.api';

const LABELS: Record<string, string> = {
  pending: 'Pendiente', processing: 'En preparación', shipped: 'Enviada', delivered: 'Entregada',
  cancelled: 'Cancelada', issue_reported: 'Incidencia reportada', unknown: 'Sin seguimiento disponible',
};

export function rewardTrackingStatus(status?: string | null): string {
  return status && Object.hasOwn(LABELS, status) ? status : 'unknown';
}

export function rewardTrackingLabel(status?: string | null): string {
  return LABELS[rewardTrackingStatus(status)];
}

export function hasInvestmentReward(investment: InvestmentHistoryItem): boolean {
  if (investment.rewardTierId !== undefined || investment.rewardClaimId !== undefined) {
    return !!(investment.rewardTierId || investment.rewardClaimId);
  }
  // Compatibility for older responses that supplied only the reward title.
  return !!investment.rewardTitle?.trim() && investment.rewardTitle !== 'Aporte Directo';
}

export function rewardTrackingUrl(value?: string | null): string | null {
  try {
    if (!value) return null;
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function rewardTrackingDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}
