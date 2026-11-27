import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getMe } from '../api/auth.api.ts';
import { clearStoredSession, establishSession } from '../utils/authSession.ts';
import { getApiErrorMessage, getApiErrorStatus } from '../utils/apiError.ts';

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Retain the credential only in this mounted page while its URL is cleaned.
  const [callback] = useState(() => ({
    token: searchParams.get('token')?.trim() ?? '',
    rejected: Boolean(searchParams.get('error')),
  }));
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<{
    attempt: number;
    message: string;
    retryable: boolean;
  } | null>(null);
  const invalid = callback.rejected || !callback.token;
  const currentFailure = invalid
    ? {
        message: 'El enlace de acceso está incompleto o fue rechazado. Vuelve a iniciar sesión.',
        retryable: false,
      }
    : failure?.attempt === attempt
      ? failure
      : null;

  useEffect(() => {
    clearStoredSession();
    window.history.replaceState(window.history.state, '', '/auth/callback');
    if (invalid) return;

    const controller = new AbortController();
    let active = true;
    async function complete() {
      try {
        const user = await getMe(callback.token, controller.signal);
        if (!active) return;
        const destination = establishSession(callback.token, user);
        navigate(destination, { replace: true });
      } catch (error) {
        if (!active) return;
        clearStoredSession();
        const status = getApiErrorStatus(error);
        setFailure({
          attempt,
          retryable: status === undefined || status === 429 || status >= 500,
          message:
            status === 401 || status === 403
              ? 'El acceso de Google ya no es válido o no está autorizado. Vuelve a iniciar sesión.'
              : getApiErrorMessage(
                  error,
                  'No pudimos completar el acceso con Google. Intenta nuevamente.',
                ),
        });
      }
    }
    void complete();
    return () => {
      active = false;
      controller.abort();
    };
  }, [callback, invalid, attempt, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-5 py-12 font-['Plus_Jakarta_Sans',sans-serif]">
      {currentFailure ? (
        <section
          role="alert"
          className="w-full max-w-md rounded-2xl border border-gray-200 p-8 text-center space-y-5"
        >
          <h1 className="text-2xl font-bold text-gray-900">
            No pudimos completar el acceso con Google
          </h1>
          <p className="text-gray-600">{currentFailure.message}</p>
          {currentFailure.retryable && (
            <button
              type="button"
              onClick={() => setAttempt((previous) => previous + 1)}
              className="rounded-xl bg-[#72B626] px-5 py-3 font-bold text-white"
            >
              Reintentar
            </button>
          )}
          <Link to="/login" replace className="block text-[#4a7f1a] underline">
            Volver a iniciar sesión
          </Link>
        </section>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-5 text-gray-600"
        >
          <span
            aria-hidden="true"
            className="h-11 w-11 animate-spin rounded-full border-3 border-green-100 border-t-[#72B626]"
          />
          <p>Iniciando sesión con Google...</p>
        </div>
      )}
    </main>
  );
}
