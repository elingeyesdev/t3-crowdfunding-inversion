import { useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { requestPasswordReset, resetPassword } from '../api/auth.api';
import { RequestErrorNotice } from '../components/RequestErrorNotice';

export function PasswordRecoveryPage({ reset = false }: { reset?: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';
  const resetEmail = params.get('email') ?? '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [validation, setValidation] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const validLink = /^[a-f0-9]{64}$/i.test(token) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    setError(null); setValidation(null); setMessage(null);
    if (reset) {
      if (!validLink) return;
      if (password.length < 8 || password.length > 128 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        setValidation('La contraseña debe tener entre 8 y 128 caracteres, una mayúscula y un número.');
        return;
      }
      if (password !== confirmation) { setValidation('Las contraseñas no coinciden.'); return; }
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setValidation('Ingresa un correo electrónico válido.'); return;
    }
    pending.current = true; setBusy(true);
    try {
      if (reset) {
        await resetPassword({ email: resetEmail, token, password, passwordConfirmation: confirmation });
        // Remove the credential-bearing URL from browser history after success.
        navigate('/login?passwordReset=success', { replace: true });
      } else setMessage(await requestPasswordReset(email.trim().toLowerCase()));
    } catch (failure) { setError(failure); }
    finally { pending.current = false; setBusy(false); }
  }

  const inputClass = 'w-full rounded-xl border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#72B626] disabled:opacity-60';
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-8 shadow-sm space-y-5">
        <Link to="/" className="inline-block"><img src="/logocrowd.jpg" alt="UniFundMe" className="h-12" /></Link>
        <h1 className="text-2xl font-bold text-gray-900">{reset ? 'Restablecer contraseña' : 'Recuperar acceso'}</h1>
        <p className="text-sm text-gray-600">{reset ? 'Elige una contraseña nueva. Al guardar, se cerrarán las sesiones anteriores de tu cuenta.' : 'Ingresa tu correo para solicitar un enlace temporal de recuperación.'}</p>
        {!reset && <p className="text-sm text-gray-600">Si tu cuenta utiliza únicamente Google, continúa con Google desde el inicio de sesión.</p>}
        {reset && !validLink ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">El enlace está incompleto o no es válido. Solicita uno nuevo.</div> : (
          <form onSubmit={submit} noValidate className="space-y-4">
            {error !== null && <RequestErrorNotice error={error} fallback="No se pudo completar la solicitud. Intenta nuevamente." />}
            {validation && <p role="alert" className="text-sm text-red-700">{validation}</p>}
            {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
            {reset ? <>
              <div><label htmlFor="new-password" className="block text-sm font-semibold mb-2">Nueva contraseña</label><input id="new-password" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} className={inputClass} /></div>
              <p className="text-xs text-gray-500">Entre 8 y 128 caracteres, con al menos una mayúscula y un número.</p>
              <div><label htmlFor="confirm-password" className="block text-sm font-semibold mb-2">Confirmar contraseña</label><input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} className={inputClass} /></div>
            </> : <div><label htmlFor="recovery-email" className="block text-sm font-semibold mb-2">Correo electrónico</label><input id="recovery-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={busy} className={inputClass} /></div>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#72B626] py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Procesando...' : reset ? 'Guardar nueva contraseña' : 'Enviar enlace de recuperación'}</button>
          </form>
        )}
        {reset && <Link to="/forgot-password" className="block text-sm font-semibold text-[#4a7f1a] underline">Solicitar un nuevo enlace</Link>}
        <Link to="/login" className="block text-sm text-gray-600 underline">Volver al inicio de sesión</Link>
      </div>
    </main>
  );
}
