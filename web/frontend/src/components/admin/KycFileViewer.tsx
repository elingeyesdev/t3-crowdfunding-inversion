import { useEffect, useState } from 'react';
import type { KycDocument } from '../../types/kyc.types';
import { kycFileKind, privateKycUrl, type KycFileKind } from '../../utils/kycFiles';

type Status = 'ready' | 'expired' | 'error' | 'unsupported' | 'media-error';

export function KycFileViewer({ document, label, onRefresh, refreshing }: {
  document: KycDocument; label: string; onRefresh: () => Promise<void>; refreshing: boolean;
}) {
  const key = JSON.stringify([document.url, document.mimeType]);
  const [result, setResult] = useState<{ key: string; status: Status; kind: KycFileKind } | null>(null);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    let active = true;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const update = (status: Status, kind: KycFileKind = 'unsupported') => {
      if (active) setResult({ key, status, kind });
    };
    async function check() {
      await Promise.resolve();
      if (!active) return;
      const url = privateKycUrl(document.url, window.location.href);
      if (!url) { clearTimeout(timeout); return update('error'); }
      const expiresAt = Number(url.searchParams.get('expires')) * 1000;
      if (expiresAt <= Date.now()) { clearTimeout(timeout); return update('expired'); }
      try {
        // HEAD checks permissions and MIME without downloading a large video.
        const response = await fetch(url.href, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
        if (!active) return;
        if (!response.ok) return update(response.status === 403 ? 'expired' : 'error');
        const kind = kycFileKind(url.href, response.headers.get('Content-Type') || document.mimeType);
        update(kind === 'unsupported' ? 'unsupported' : 'ready', kind);
        expiryTimer = setTimeout(() => update('expired'), Math.min(Math.max(0, expiresAt - Date.now()), 2147483647));
      } catch {
        update('error');
      } finally {
        clearTimeout(timeout);
      }
    }
    void check();
    return () => { active = false; controller.abort(); clearTimeout(timeout); clearTimeout(expiryTimer); };
  }, [document.url, document.mimeType, key]);

  const current = result?.key === key ? result : null;
  const mediaError = () => setResult(previous => previous ? { ...previous, status: 'media-error' } : previous);
  if (!current) return <p role="status" className="text-sm text-gray-500">Cargando {label.toLowerCase()}...</p>;
  if (current.status !== 'ready') {
    const expired = current.status === 'expired';
    const canDownload = current.status === 'unsupported' || current.status === 'media-error';
    return (
      <div role="alert" className="text-sm text-gray-600 space-y-3">
        <p>{expired ? 'El enlace ha caducado o ya no es válido. Solicita uno nuevo para continuar.'
          : canDownload ? 'Tu navegador no puede mostrar este formato. Puedes descargar el archivo para revisarlo.'
          : 'No se pudo cargar el archivo. Puede que ya no esté disponible o que haya un problema de conexión.'}</p>
        {canDownload && <a href={document.url} download={document.originalName || 'archivo-kyc'} className="block text-blue-700 underline">Descargar archivo</a>}
        <button type="button" onClick={() => void onRefresh()} disabled={refreshing} className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg disabled:opacity-50">
          {refreshing ? 'Renovando enlaces...' : 'Renovar enlaces'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
        {current.kind === 'pdf' ? <iframe title={`${label} PDF`} src={document.url} className="w-full h-full" onError={mediaError} />
          : current.kind === 'video' ? <video aria-label={label} src={document.url} controls playsInline preload="metadata" onError={mediaError} className="w-full h-full object-contain" />
          : <button type="button" onClick={() => setZoom(true)} className="w-full h-full" aria-label={`Ampliar ${label.toLowerCase()}`}>
            <img src={document.url} alt={label} onError={mediaError} className="w-full h-full object-contain" />
          </button>}
      </div>
      <a href={document.url} download={document.originalName || 'archivo-kyc'} className="text-xs text-blue-700 underline">Descargar archivo</a>
      {zoom && <div role="dialog" aria-label="Vista ampliada del documento" className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoom(false)}>
        <button type="button" aria-label="Cerrar vista ampliada" className="absolute top-4 right-4 text-white p-2" onClick={() => setZoom(false)}>Cerrar</button>
        <img src={document.url} alt={label} onError={mediaError} className="max-w-full max-h-[90vh] object-contain" onClick={event => event.stopPropagation()} />
      </div>}
    </div>
  );
}
