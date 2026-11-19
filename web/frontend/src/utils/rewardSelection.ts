import type { RewardTier } from '../api/public-campaigns.api';

export function rewardUnavailableReason(tier: RewardTier, now = Date.now()): string | null {
  if (tier.isActive === false) return 'Recompensa no disponible';
  if (tier.expiresAt && new Date(tier.expiresAt).getTime() <= now) return 'Recompensa vencida';
  if (tier.maxClaims != null && tier.currentClaims >= tier.maxClaims) return 'Recompensa agotada';
  return null;
}

export function rewardAmountRange(tier: RewardTier, goal: number) {
  return {
    min: Math.ceil((Math.max(tier.amount, goal * (tier.minPercentage ?? 0) / 100) - 1e-8) * 100) / 100,
    max: Math.floor((goal * (tier.maxPercentage ?? 100) / 100 + 1e-8) * 100) / 100,
  };
}

export function rewardSelectionError(tier: RewardTier | null | undefined, amount: number, goal: number, currency: string): string | null {
  if (!tier) return 'La recompensa seleccionada ya no está disponible. Revisa tu selección.';
  const unavailable = rewardUnavailableReason(tier);
  if (unavailable) return unavailable + '. Elige otra recompensa o realiza un aporte sin recompensa.';
  if (tier.currency !== currency) return 'La moneda de la recompensa no coincide con la campaña.';
  const { min, max } = rewardAmountRange(tier, goal);
  if (amount < min || amount > max) return `El monto para esta recompensa debe estar entre ${min.toLocaleString('es-BO')} y ${max.toLocaleString('es-BO')} ${currency}.`;
  return null;
}
