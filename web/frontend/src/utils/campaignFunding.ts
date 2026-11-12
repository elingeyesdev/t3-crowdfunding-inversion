export function computeFundingPercent(currentAmount: number, goalAmount: number): number {
  if (!Number.isFinite(currentAmount) || !Number.isFinite(goalAmount) || goalAmount <= 0) {
    return 0;
  }
  return (currentAmount / goalAmount) * 100;
}

export function clampPercentForBar(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(Math.max(percent, 0), 100);
}

export function formatFundingPercent(currentAmount: number, goalAmount: number): number {
  const percent = computeFundingPercent(currentAmount, goalAmount);
  return Number(percent.toFixed(2));
}

export function formatCampaignCurrency(amount: number, _currency?: string): string {
  const formatted = new Intl.NumberFormat('es-BO', {
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `Bs. ${formatted}`;
}
