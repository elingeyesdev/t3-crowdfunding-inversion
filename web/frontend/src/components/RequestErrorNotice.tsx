import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { getApiErrorMessage } from '../utils/apiError';

export function RequestErrorNotice({ error, fallback, onRetry, stale = false, retrying = false }: {
  error: unknown;
  fallback: string;
  onRetry?: () => void;
  stale?: boolean;
  retrying?: boolean;
}) {
  const location = useLocation();
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const needsVerification = axios.isAxiosError(error) && error.response?.data?.code === 'EMAIL_VERIFICATION_REQUIRED';
  const wrongVerificationAccount = axios.isAxiosError(error) && error.response?.data?.code === 'EMAIL_VERIFICATION_MISMATCH';
  const message = status === 401 ? 'Tu sesión venció o ya no está disponible. Inicia sesión nuevamente.'
    : status === 403 && !needsVerification && !wrongVerificationAccount ? 'No tienes permisos para realizar esta operación.'
    : status && status >= 500 && status !== 502 && status !== 503 ? fallback
    : getApiErrorMessage(error, fallback);

  return (
    <div role="alert" className="my-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 space-y-2">
      <p>{message}</p>
      {stale && <p>Se muestran datos anteriores que no se pudieron actualizar. Pueden estar desactualizados.</p>}
      {needsVerification && <Link to="/account-settings" className="block font-semibold underline">Verificar mi correo</Link>}
      {wrongVerificationAccount && <Link to="/login" state={{ from: location.pathname + location.search }} className="block font-semibold underline">Iniciar sesión con otra cuenta</Link>}
      {status === 401 ? <Link to="/login" state={{ from: location.pathname + location.search }} className="font-semibold underline">Iniciar sesión</Link>
        : onRetry && <button type="button" disabled={retrying} onClick={onRetry} className="font-semibold underline disabled:opacity-50">Reintentar</button>}
    </div>
  );
}
