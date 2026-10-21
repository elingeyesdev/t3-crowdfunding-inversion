/**
 * Formatea un número con separadores de miles (puntos como 1.000)
 * @param value - Número a formatear
 * @returns Número formateado con puntos
 */
export const formatNumberSpanish = (value: number | string | undefined | null): string => {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(num)) return '';
  return Math.floor(num).toLocaleString('de-DE'); // de-DE uses dot for thousands
};

/**
 * Remueve puntos de un número formateado
 * @param value - String con puntos a parsear
 * @returns Número sin formato
 */
export const parseNumberSpanish = (value: string): number => {
  if (!value) return 0;
  return parseInt(value.replace(/\./g, ''), 10) || 0;
};

/**
 * Formatea un número con separadores de miles (comas)
 * @param value - Número a formatear
 * @returns Número formateado con comas
 */
export const formatNumberWithCommas = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';
  return Math.floor(num).toLocaleString('en-US');
};

/**
 * Remueve comas de un número formateado
 * @param value - String con comas a parsear
 * @returns Número sin formato
 */
export const parseFormattedNumber = (value: string): number => {
  return parseInt(value.replace(/,/g, ''), 10) || 0;
};

/**
 * Valida si un número es positivo y mayor que cero
 * @param value - Número a validar
 * @returns true si el número es válido
 */
export const isValidAmount = (value: number): boolean => {
  return value > 0;
};

/**
 * Valida si una fecha es en el futuro (estrictamente, no permite hoy)
 * @param dateString - String con formato ISO o datetime-local
 * @returns true si la fecha es en el futuro
 */
export const isFutureDate = (dateString: string): boolean => {
  if (!dateString) return true;
  const date = new Date(dateString);
  const now = new Date();
  return date > now;
};

