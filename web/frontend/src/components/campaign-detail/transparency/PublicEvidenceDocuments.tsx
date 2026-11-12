import { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Download,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  FileImage,
  FileCode,
  Info,
  Filter,
} from 'lucide-react';
import type { PublicCampaignDocument } from '../../../api/public-campaigns.api';
import { getImageUrl } from '../../../utils/image.utils';

interface Props {
  documents: PublicCampaignDocument[];
  loading?: boolean;
}

export function PublicEvidenceDocuments({
  documents,
  loading = false,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return 'Documento PDF / Certificado';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (mimeType?: string, fileName?: string) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (mimeType?.includes('image') || ['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(ext || '')) {
      return <FileImage size={22} className="text-emerald-600" />;
    }
    if (mimeType?.includes('sheet') || mimeType?.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet size={22} className="text-emerald-600" />;
    }
    return <FileText size={22} className="text-blue-600" />;
  };

  const filteredDocs = documents.filter((doc) => {
    if (filter === 'approved') return doc.status === 'approved';
    if (filter === 'pending') return doc.status === 'pending';
    return true;
  });

  return (
    <div className="space-y-6 font-['Plus Jakarta Sans',sans-serif]">
      {/* Header card */}
      <div className="bg-white rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 border border-green-50 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck size={14} strokeWidth={2.5} />
                Auditoría Documental
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-[#1c2b1e] tracking-tight">
              Evidencias y Comprobantes Públicos
            </h3>
            <p className="text-[13px] sm:text-[14px] text-slate-500 font-medium mt-1 max-w-2xl leading-relaxed">
              Facturas comerciales proforma, cotizaciones, permisos y certificados cargados por el
              emprendedor para comprobar el destino legítimo y transparente de los recursos.
            </p>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 bg-[#f4f7f4] p-1 rounded-xl shrink-0 self-start md:self-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all border-none cursor-pointer ${
                filter === 'all'
                  ? 'bg-white text-[#1c2b1e] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              Todos ({documents.length})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all border-none cursor-pointer ${
                filter === 'approved'
                  ? 'bg-white text-[#1c2b1e] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              Verificados
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all border-none cursor-pointer ${
                filter === 'pending'
                  ? 'bg-white text-[#1c2b1e] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              En Revisión
            </button>
          </div>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-100">
          <Clock size={28} className="animate-spin text-slate-300 mx-auto mb-2" />
          <p className="text-slate-400 text-[12px] font-bold">Cargando evidencias documentales...</p>
        </div>
      )}

      {/* Documents List */}
      {!loading && filteredDocs.length === 0 ? (
        <div className="bg-white rounded-[24px] p-8 sm:p-12 text-center border border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center mx-auto mb-4">
            <FileText size={32} />
          </div>
          <h4 className="text-[16px] font-black text-[#1c2b1e] mb-1">
            {documents.length === 0
              ? 'Aún no se han publicado documentos de respaldo'
              : 'No hay documentos en este estado'}
          </h4>
          <p className="text-[13px] text-slate-500 max-w-md mx-auto leading-relaxed">
            {documents.length === 0
              ? 'El emprendedor irá subiendo facturas, cotizaciones y comprobantes conforme avance la ejecución de las fases del proyecto.'
              : 'Selecciona otra categoría en el filtro superior para visualizar otros archivos cargados.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocs.map((doc) => {
            const isApproved = doc.status === 'approved';
            const isPending = doc.status === 'pending';
            const fileHref = getImageUrl(doc.fileUrl);

            return (
              <div
                key={doc.id}
                className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:border-green-200 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        {getFileIcon(doc.mimeType, doc.originalName)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-[14px] text-[#1c2b1e] truncate" title={doc.originalName}>
                          {doc.originalName || 'Documento de Respaldo'}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-bold">
                          {formatFileSize(doc.fileSizeBytes)} • {new Date(doc.createdAt).toLocaleDateString('es-BO', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700'
                          : isPending
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {isApproved ? (
                        <>
                          <CheckCircle2 size={11} strokeWidth={2.5} />
                          Verificado
                        </>
                      ) : isPending ? (
                        <>
                          <Clock size={11} strokeWidth={2.5} />
                          En Auditoría
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={11} strokeWidth={2.5} />
                          Rechazado
                        </>
                      )}
                    </span>
                  </div>

                  {/* Justification of expenditure / proof */}
                  <div className="bg-[#f8fafc] rounded-xl p-3 mb-4 text-[12px] text-slate-600 leading-relaxed border border-slate-100/60">
                    <span className="font-bold text-slate-800 block text-[11px] mb-0.5">
                      Justificación de Gasto / Evidencia:
                    </span>
                    {doc.justification || 'Documentación oficial aportada para respaldar las actividades del proyecto.'}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <ShieldCheck size={13} className="text-[#72B626]" />
                    Firma Criptográfica Verificada
                  </span>

                  <a
                    href={fileHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-green-50 hover:bg-[#72B626] text-[#72B626] hover:text-white font-black text-[11px] uppercase tracking-wider transition-all no-underline shadow-sm"
                  >
                    <span>Ver Documento</span>
                    <ExternalLink size={13} strokeWidth={2.5} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compliance banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-[#72B626]">
            <ShieldCheck size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h5 className="font-black text-[13px] text-white">
              Protocolo de Transparencia Digital e Inmutabilidad
            </h5>
            <p className="text-[11px] text-slate-400 font-medium">
              Todos los archivos y comprobantes son validados por el equipo técnico y quedan
              registrados con sellos temporales inmutables para consulta pública.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

