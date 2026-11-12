import axios from 'axios';

/**
 * Mensaje legible para fallos de Axios (incl. 502 del proxy de Vite cuando no hay backend).
 */
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err.message : fallback;
  }

  const status = err.response?.status;
  if (status === 502 || status === 503) {
    return 'El servicio no está disponible temporalmente. Intenta nuevamente en unos momentos.';
  }

  if (!err.response) {
    return 'No se pudo conectar con el servidor. Comprueba tu conexión e intenta nuevamente.';
  }

  const data = err.response.data as { message?: string | string[] };
  if (data?.message !== undefined) {
    return Array.isArray(data.message) ? data.message.join(', ') : String(data.message);
  }

  return fallback;
}
