import { useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { confirmEmailVerification, isVerificationPath } from '../api/auth.api';
import { useAuth } from '../hooks/useAuth';
import { EmailVerificationControls } from '../components/EmailVerificationControls';
import { RequestErrorNotice } from '../components/RequestErrorNotice';

export function EmailVerificationPage() {
  const { user, loading, error: authError, refreshUser } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const path = params.get('verification') ?? '';
  const valid = isVerificationPath(path);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);

  async function confirm() {
    if (pending.current || !valid) return;
    pending.current = true; setBusy(true); setError(null);
    try { await confirmEmailVerification(path); setSuccess(true); await refreshUser(); }
    catch (failure) { setError(failure); }
    finally { pending.current = false; setBusy(false); }
  }

  return <main className="min-h-screen bg-gray-50 flex items-center justify-center px-5 py-12">
    <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-8 shadow-sm space-y-5">
      <h1 className="text-2xl font-bold">Verificar correo electrónico</h1>
      {loading ? <p role="status">Consultando tu cuenta...</p> : authError ? <div role="alert"><p>{authError}</p><button onClick={refreshUser}>Reintentar</button></div> : !user ? <>
        <p>Inicia sesión con la cuenta correspondiente al correo recibido y vuelve aquí para confirmar el enlace.</p>
        <Link to="/login" state={{ from: location.pathname + location.search }} className="text-[#4a7f1a] underline">Iniciar sesión para verificar</Link>
      </> : <>
        <p>Cuenta actual: {user.email}</p>
        {success || user.emailVerified ? <p role="status" className="text-green-800">Tu correo está verificado. Ya puedes realizar aportes y enviar o publicar campañas.</p> : <>
          {!valid ? <p role="alert" className="text-red-700">El enlace está incompleto o no es válido. Solicita uno nuevo.</p> : <button type="button" disabled={busy} onClick={confirm} className="w-full rounded-xl bg-[#72B626] py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Verificando...' : 'Confirmar mi correo'}</button>}
          {error !== null && <RequestErrorNotice error={error} fallback="No se pudo verificar el correo. Intenta nuevamente." />}
          <EmailVerificationControls onRefresh={refreshUser} />
        </>}
      </>}
      <Link to="/account-settings" className="block text-[#4a7f1a] underline">Ir a Configuración de Cuenta</Link>
    </div>
  </main>;
}
