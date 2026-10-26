import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CapitalOverview } from '../../types/investor.types';
import { getMyInvestments } from '../../api/investor.api';
import { getImageUrl } from '../../utils/image.utils';
import type { InvestmentHistoryItem } from '../../api/investor.api';
import { 
  TrendingUp, 
  Wallet, 
  BarChart3, 
  Clock,
  FolderOpen,
  Heart,
  CheckCircle2,
  XCircle,
  DollarSign,
  Gift,
  Loader2,
} from 'lucide-react';

interface Props {
  capitalData: CapitalOverview | null;
  capitalLoading: boolean;
}

const CAMPAIGN_TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  donation: { icon: Heart, label: 'Donación', color: '#e91e63' },
};

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  completed: { icon: CheckCircle2, color: '#72B626', bg: '#e8f5e9', label: 'Completada' },
  pending: { icon: Clock, color: '#f9a825', bg: '#fff8e1', label: 'Pendiente' },
  processing: { icon: Clock, color: '#1976d2', bg: '#e3f2fd', label: 'Procesando' },
  failed: { icon: XCircle, color: '#c62828', bg: '#ffebee', label: 'Fallida' },
  cancelled: { icon: XCircle, color: '#64748b', bg: '#f1f5f9', label: 'Cancelada' },
  refunded: { icon: DollarSign, color: '#7b1fa2', bg: '#f3e5f5', label: 'Reembolsada' },
};

export function InvestmentsFeed({ capitalData, capitalLoading }: Props) {
  const navigate = useNavigate();
  const [investments, setInvestments] = useState<InvestmentHistoryItem[]>([]);
  const [investmentsLoading, setInvestmentsLoading] = useState(true);

  useEffect(() => {
    const fetchInvestments = async () => {
      try {
        setInvestmentsLoading(true);
        const data = await getMyInvestments();
        const mappedData = data.map(inv => ({ ...inv, campaignType: 'donation' as const }));
        setInvestments(mappedData);
      } catch {
        // silently fail — will show empty state
      } finally {
        setInvestmentsLoading(false);
      }
    };
    fetchInvestments();
  }, []);

  return (
    <div className="flex-1 min-w-[280px] flex flex-col gap-8 font-['Plus Jakarta Sans',sans-serif]">

      {/* Capital Stats Grid */}
      {capitalData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-xl sm:rounded-[28px] border border-gray-100 p-4 sm:p-6 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-[#f0f9e0] rounded-full blur-2xl sm:blur-3xl -mr-8 -mt-8 opacity-50"></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-10 h-10 bg-[#f0f9e0] text-[#72B626] rounded-xl flex items-center justify-center border border-gray-100 group-hover:scale-110 transition-transform">
                <TrendingUp size={18} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Donado</span>
            </div>
            <div className="text-[22px] sm:text-[28px] font-black text-[#1c2b1e] tracking-tighter leading-none relative z-10">
              Bs. {capitalData.totalInvested.toLocaleString('es-BO')}
            </div>
          </div>

          <div className="bg-white rounded-xl sm:rounded-[28px] border border-gray-100 p-4 sm:p-6 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-[#f0f9e0] rounded-full blur-2xl sm:blur-3xl -mr-8 -mt-8 opacity-50"></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-10 h-10 bg-[#f0f9e0] text-[#72B626] rounded-xl flex items-center justify-center border border-gray-100 group-hover:scale-110 transition-transform">
                <BarChart3 size={18} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Donaciones</span>
            </div>
            <div className="text-[22px] sm:text-[28px] font-black text-[#1c2b1e] tracking-tighter leading-none relative z-10">
              {capitalData.totalInvestments}
            </div>
            <div className="text-[11px] font-bold text-slate-400 mt-1 relative z-10">
              {capitalData.completedInvestments} completadas
            </div>
          </div>

          <div className="bg-white rounded-xl sm:rounded-[28px] border border-gray-100 p-4 sm:p-6 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-amber-50 rounded-full blur-2xl sm:blur-3xl -mr-8 -mt-8 opacity-50"></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="w-10 h-10 bg-amber-50 text-[#f9a825] rounded-xl flex items-center justify-center border border-amber-100 group-hover:scale-110 transition-transform">
                <Wallet size={18} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Capital Disponible</span>
            </div>
            <div className="text-[22px] sm:text-[28px] font-black text-[#1c2b1e] tracking-tighter leading-none relative z-10">
              {capitalData.availableCapital !== null ? `Bs. ${capitalData.availableCapital.toLocaleString('es-BO')}` : '—'}
            </div>
            {capitalData.pendingAmount > 0 && (
              <div className="text-[11px] font-bold text-amber-600 mt-1 relative z-10 flex items-center gap-1">
                <Clock size={10} strokeWidth={3} /> Bs. {capitalData.pendingAmount.toLocaleString('es-BO')} pendiente
              </div>
            )}
          </div>
        </div>
      )}

      {capitalLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-[28px] border border-gray-100 p-6 shadow-sm animate-pulse">
              <div className="w-10 h-10 bg-slate-100 rounded-xl mb-4"></div>
              <div className="w-24 h-3 bg-slate-100 rounded-full mb-3"></div>
              <div className="w-32 h-7 bg-slate-100 rounded-full"></div>
            </div>
          ))}
        </div>
      )}

      {/* Investments List Area */}
      <div className="bg-white rounded-2xl sm:rounded-[40px] shadow-sm p-4 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 border border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 sm:mb-10">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#1c2b1e] text-white rounded-lg sm:rounded-xl flex items-center justify-center">
                <Heart size={16} strokeWidth={2.5} className="sm:w-[18px] sm:h-[18px]" />
             </div>
             <span className="text-[16px] sm:text-[20px] font-black text-[#1c2b1e] tracking-tight uppercase tracking-widest leading-none">
               Historial de Donaciones
             </span>
          </div>
        </div>

        {investmentsLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-4">
            <Loader2 size={32} strokeWidth={2} className="text-[#72B626] animate-spin" />
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Cargando historial...</span>
          </div>
        ) : investments.length > 0 ? (
          <div className="flex flex-col gap-3">
            {investments.map((inv) => {
              const typeConfig = CAMPAIGN_TYPE_CONFIG[inv.campaignType] || CAMPAIGN_TYPE_CONFIG.donation;
              const TypeIcon = typeConfig.icon;
              const statusConfig = STATUS_CONFIG[inv.investmentStatus] || STATUS_CONFIG.completed;
              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/campaign/${inv.campaignId}`)}
                  className="rounded-xl sm:rounded-2xl border border-slate-100 p-3 sm:p-4 hover:shadow-lg hover:border-gray-100 hover:-translate-y-0.5 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Campaign thumbnail */}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl overflow-hidden shrink-0 bg-slate-100 shadow-sm">
                      {getImageUrl(inv.campaignCoverImage) ? (
                        <img src={getImageUrl(inv.campaignCoverImage)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, #1c2b1e, ${typeConfig.color})` }}
                        >
                          <TypeIcon size={18} strokeWidth={1.5} className="text-white/40" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] sm:text-[13px] font-black text-[#1c2b1e] tracking-tight leading-snug mb-1 truncate group-hover:text-[#72B626] transition-colors">
                        {inv.campaignTitle}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest"
                          style={{ backgroundColor: typeConfig.color + '15', color: typeConfig.color }}
                        >
                          <TypeIcon size={8} strokeWidth={3} />
                          {typeConfig.label}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest"
                          style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
                        >
                          <StatusIcon size={8} strokeWidth={3} />
                          {statusConfig.label}
                        </span>
                        {inv.rewardTitle && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-amber-50 text-amber-700">
                            <Gift size={8} strokeWidth={3} />
                            {inv.rewardTitle}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount & Date */}
                    <div className="text-right shrink-0">
                      <p className="text-[13px] sm:text-[15px] font-black text-[#1c2b1e] tracking-tighter">
                        Bs. {inv.amount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {new Date(inv.createdAt).toLocaleDateString('es-BO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="py-24 text-center bg-slate-50/20 border-[2px] border-dashed border-gray-100 rounded-[40px] flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-white rounded-[28px] shadow-sm flex items-center justify-center text-[#d4f0a0] mb-6 group hover:scale-110 transition-transform">
               <FolderOpen size={40} strokeWidth={1} />
            </div>
            <p className="text-[#1c2b1e] font-black text-[20px] mb-2 uppercase tracking-tight">Sin Donaciones Aún</p>
            <p className="text-slate-400 font-medium text-[15px] max-w-[360px] leading-relaxed">Explora campañas activas y comienza a apoyar proyectos con impacto real.</p>
          </div>
        )}
      </div>
    </div>
  );
}
