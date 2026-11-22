export function campaignDonorsLabel(count: number | null | undefined): string {
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return 'Donadores: sin datos';
  return `${count.toLocaleString('es-BO')} ${count === 1 ? 'donador' : 'donadores'}`;
}
