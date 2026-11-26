export const SUPPORTED_CAMPAIGN_TYPES = ['donation', 'reward'] as const;
export type SupportedCampaignType = typeof SUPPORTED_CAMPAIGN_TYPES[number];
// Reads preserve the API's original value, including unsupported historical types.
export type CampaignType = string;

export function isSupportedCampaignType(type: unknown): type is SupportedCampaignType {
  return type === 'donation' || type === 'reward';
}

export function campaignTypeLabel(type: unknown): string {
  if (type === 'donation') return 'Donación';
  if (type === 'reward') return 'Con recompensas';
  if (type === 'equity') return 'Equity · modalidad no disponible';
  return typeof type === 'string' && type ? `Tipo no soportado: ${type}` : 'Tipo no informado';
}
