import { CampaignCard } from './CampaignCard';
import type { EntrepreneurCampaign } from '../types/campaign.types';
import { 
  FolderOpen, 
  Search, 
  PlusCircle, 
  UserCheck, 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';

interface Meta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

interface Props {
  campaigns: EntrepreneurCampaign[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenForm: () => void;
  /** Si false, el CTA vacío enlaza a completar perfil en lugar de abrir el formulario. */
  canCreateCampaign?: boolean;
  onGoToProfile?: () => void;
  meta: Meta | null;
  onPageChange: (page: number) => void;
  hasFilterApplied: boolean;
  onPreview?: (campaign: EntrepreneurCampaign) => void;
  onSubmitForReview?: (campaignId: string) => void;
  onPublish?: (campaignId: string) => void;
  onDelete?: (campaignId: string) => void;
  onFinalize?: (campaignId: string) => void;
  actionCampaignId?: string | null;
}

export function CampaignList({
  campaigns,
  loading,
  error,
  onRetry,
  onOpenForm,
  canCreateCampaign = true,
  onGoToProfile,
  meta,
  onPageChange,
  hasFilterApplied,
  onPreview,
  onSubmitForReview,
  onPublish,
  onDelete,
  onFinalize,
  actionCampaignId,
}: Props) {
  if (loading && campaigns.length === 0) {
    return (
      <div className="py-40 flex flex-col items-center justify-center gap-6">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-[#72B626] rounded-full animate-spin" />
        <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Sincronizando Campañas...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 text-[#c62828] p-8 rounded-[32px] text-center flex flex-col items-center gap-4 animate-in fade-in duration-500">
        <AlertTriangle size={48} strokeWidth={2.5} />
        <p className="text-[15px] font-bold">Error: {error}</p>
        <button className="mt-2 bg-[#c62828] hover:bg-red-800 text-white font-black px-8 py-3 rounded-xl transition-all active:scale-95 border-none cursor-pointer" onClick={onRetry}>
          Reintentar Carga
        </button>
      </div>
    );
  }

  if (!loading && campaigns.length === 0) {
    return (
      <div className="bg-white rounded-[32px] border border-dashed border-gray-100 p-16 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="text-[#d4f0a0] mb-6 flex justify-center" aria-hidden>
           {hasFilterApplied ? <Search size={64} strokeWidth={1.5} /> : <FolderOpen size={64} strokeWidth={1.5} />}
        </div>
        <h2 className="text-xl font-black text-[#1c2b1e] tracking-tight mb-3">
           {hasFilterApplied ? 'Sin coincidencias' : 'Tu catálogo está vacío'}
        </h2>
        <p className="text-[14px] text-slate-400 font-medium max-w-xs mx-auto mb-10 leading-relaxed">
          {hasFilterApplied
            ? 'Prueba ajustar los criterios de búsqueda o limpiar los filtros activos.'
            : 'Comienza hoy mismo creando tu primera campaña y atrae capital para tu visión.'}
        </p>
        {!hasFilterApplied && (
          <button
            className="bg-[#72B626] hover:bg-[#1c2b1e] text-white font-black px-10 py-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-[#72B626]/20/20 border-none cursor-pointer flex items-center justify-center gap-3 mx-auto"
            type="button"
            onClick={canCreateCampaign ? onOpenForm : onGoToProfile}
          >
            {canCreateCampaign ? (
              <>
                <PlusCircle size={20} strokeWidth={2.5} />
                Lanzar mi Primera Campaña
              </>
            ) : (
              <>
                <UserCheck size={20} strokeWidth={2.5} />
                Completar mi Perfil
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-12 font-['Plus Jakarta Sans',sans-serif]">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {campaigns.map((c) => (
          <CampaignCard
            key={c.id}
            campaign={c}
            onPreview={onPreview}
            onSubmitForReview={onSubmitForReview}
            onPublish={onPublish}
            onDelete={onDelete}
            onFinalize={onFinalize}
            actionCampaignId={actionCampaignId}
          />
        ))}
      </div>

      {meta && meta.totalPages > 1 && (
        <nav className="flex items-center justify-between bg-white border border-gray-100 px-6 py-4 rounded-2xl shadow-sm" aria-label="Paginación">
          <button
            type="button"
            className="bg-[#f0f9e0] hover:bg-[#f0f9e0] text-[#72B626] font-bold px-5 py-2.5 rounded-xl border-none disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 text-[13px] flex items-center gap-2 cursor-pointer"
            disabled={meta.currentPage <= 1 || loading}
            onClick={() => onPageChange(meta.currentPage - 1)}
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
            Anterior
          </button>
          <div className="flex flex-col items-center">
             <span className="text-[13px] font-black text-[#1c2b1e] leading-none">Página {meta.currentPage} de {meta.totalPages}</span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">({meta.totalItems} campañas totales)</span>
          </div>
          <button
            type="button"
            className="bg-[#f0f9e0] hover:bg-[#f0f9e0] text-[#72B626] font-bold px-5 py-2.5 rounded-xl border-none disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 text-[13px] flex items-center gap-2 cursor-pointer"
            disabled={meta.currentPage >= meta.totalPages || loading}
            onClick={() => onPageChange(meta.currentPage + 1)}
          >
            Siguiente
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </nav>
      )}
    </div>
  );
}
