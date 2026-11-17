import { FileText, ShieldCheck, ExternalLink, Clock, AlertTriangle, FileImage, FileSpreadsheet, RefreshCw } from 'lucide-react';
import type { PublicCampaignDocument } from '../../../api/public-campaigns.api';

interface Props {
  documents: PublicCampaignDocument[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function PublicEvidenceDocuments({ documents, loading = false, error = null, onRetry }: Props) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} bytes`;
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 font-['Plus Jakarta Sans',sans-serif]">
      <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-green-50 shadow-sm">
        <h3 className="text-xl sm:text-2xl font-black text-[#1c2b1e] flex items-center gap-2">
          <ShieldCheck size={24} className="text-[#72B626]" /> Evidencias públicas
        </h3>
        <p className="text-sm text-slate-500 mt-2">Documentos aprobados y autorizados para consulta pública por la administración.</p>
      </div>

      {loading ? (
        <div role="status" className="bg-white rounded-2xl p-10 text-center border border-slate-100">
          <Clock size={28} className="animate-spin text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Cargando evidencias públicas...</p>
        </div>
      ) : error ? (
        <div role="alert" className="bg-white rounded-2xl p-8 text-center border border-red-100">
          <AlertTriangle size={28} className="text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-700">{error}</p>
          {onRetry && <button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 text-[#4a7f1a] font-bold border-none cursor-pointer">
            <RefreshCw size={16} /> Reintentar
          </button>}
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-[24px] p-8 sm:p-12 text-center border border-slate-100">
          <FileText size={32} className="text-slate-300 mx-auto mb-4" />
          <h4 className="font-black text-[#1c2b1e]">No hay evidencias públicas disponibles</h4>
          <p className="text-sm text-slate-500 mt-2">Los documentos aparecerán aquí cuando la administración autorice su publicación.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map(doc => (
            <div key={doc.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-start gap-3 mb-3">
                  {doc.mimeType.startsWith('image/') ? <FileImage size={22} className="shrink-0 text-emerald-600" />
                    : doc.mimeType.includes('sheet') ? <FileSpreadsheet size={22} className="shrink-0 text-emerald-600" />
                    : <FileText size={22} className="shrink-0 text-blue-600" />}
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-[#1c2b1e] break-words">{doc.originalName}</h4>
                    <p className="text-xs text-slate-400 mt-1">{formatFileSize(doc.fileSizeBytes)} · {new Date(doc.createdAt).toLocaleDateString('es-BO')}</p>
                  </div>
                </div>
                {doc.justification && <p className="bg-slate-50 rounded-xl p-3 mb-4 text-xs text-slate-600 whitespace-pre-wrap">{doc.justification}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <span className="text-xs text-emerald-700 font-bold">Aprobado para publicación</span>
                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-50 text-[#4a7f1a] font-bold text-xs no-underline">
                  Abrir documento <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
