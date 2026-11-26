import { useRef, useState } from 'react';
import { requestEmailVerification } from '../api/auth.api';
import { RequestErrorNotice } from './RequestErrorNotice';

export function EmailVerificationControls({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null); setMessage(null);
    try { setMessage(await requestEmailVerification()); setSent(true); }
    catch (failure) { setError(failure); }
    finally { pending.current = false; setBusy(false); }
  }

  return <div className="space-y-3 text-sm">
    <p>Verifica tu correo para realizar aportes y enviar o publicar campañas. El enlace vence en 60 minutos. Puedes solicitar uno por minuto.</p>
    {message && <p role="status" className="text-green-800">{message}</p>}
    {error !== null && <RequestErrorNotice error={error} fallback="No se pudo solicitar el correo de verificación." />}
    <button type="button" onClick={send} disabled={busy} className="rounded-xl bg-[#72B626] px-4 py-2 text-white font-semibold disabled:opacity-60">{busy ? 'Solicitando...' : sent ? 'Reenviar verificación' : 'Enviar verificación'}</button>
    <button type="button" onClick={onRefresh} disabled={busy} className="block text-[#4a7f1a] underline">Ya confirmé mi correo: actualizar estado</button>
  </div>;
}
