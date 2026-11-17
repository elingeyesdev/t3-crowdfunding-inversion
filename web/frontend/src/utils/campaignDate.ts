// datetime-local values have no offset: interpret them in the browser's zone.
function parseLocalDateTime(value: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!parts) return null;
  const [, year, month, day, hour, minute] = parts.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  // Reject invalid calendar dates and local times skipped by a DST change.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1
    || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return null;
  return date;
}

export function localDateTimeToUtc(value: string, original?: string | null): string | undefined {
  if (!value) return undefined;
  // An unchanged input preserves seconds and the original occurrence of a
  // repeated local hour when daylight saving time ends.
  if (original && value === toLocalDateTime(original)) return new Date(original).toISOString();
  const date = parseLocalDateTime(value);
  if (!date) throw new Error('La fecha y hora de cierre no son válidas.');
  return date.toISOString();
}

export function toLocalDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isFutureLocalDateTime(value: string, now = Date.now(), original?: string | null): boolean {
  if (original && value === toLocalDateTime(original)) return new Date(original).getTime() > now;
  const date = parseLocalDateTime(value);
  return date !== null && date.getTime() > now;
}
