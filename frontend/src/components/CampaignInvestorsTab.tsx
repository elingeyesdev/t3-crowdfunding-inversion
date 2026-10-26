import { useState, useEffect } from 'react';
import { getCampaignInvestors } from '../api/campaign.api';
import { getAdminCampaignInvestors } from '../api/admin.api';
import type { CampaignInvestor, PaginatedResponse } from '../types/campaign.types';
import { 
  Users, 
  Mail, 
  MapPin, 
  Calendar, 
  MessageSquare, 
  Heart,
  Loader2,
  ChevronRight,
  ExternalLink,
  X
} from 'lucide-react';
import { getImageUrl } from '../utils/image.utils';
import { formatCampaignCurrency } from '../utils/campaignFunding';

interface Props {
  campaignId: string;
  currency: string;
  isAdmin?: boolean;
}

export function CampaignInvestorsTab({ campaignId, currency, isAdmin = false }: Props) {
  const [data, setData] = useState<PaginatedResponse<CampaignInvestor> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedInvestor, setSelectedInvestor] = useState<CampaignInvestor | null>(null);

  useEffect(() => {
    loadInvestors();
  }, [campaignId, page]);

  const loadInvestors = async () => {
    try {
      setLoading(true);
      const result = isAdmin 
        ? await getAdminCampaignInvestors(campaignId, page)
        : await getCampaignInvestors(campaignId, page);
      setData(result);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los donadores.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-[#72B626] animate-spin" />
        <p className="text-slate-400 font-medium text-sm">Analizando registro de capital...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-3xl text-center">
        <p className="text-red-600 font-bold">{error}</p>
        <button 
          onClick={loadInvestors}
          className="mt-4 px-6 py-2 bg-red-600 text-white rounded-xl text-sm font-bold"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const investors = data?.data || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 text-[#72B626] mb-2">
            <Users size={20} strokeWidth={2.5} />
            <h3 className="text-[12px] font-black uppercase tracking-[0.2em]">Registro de Donadores</h3>
          </div>
          <p className="text-slate-500 text-[14px] font-medium max-w-md">
            Gestiona la relación con tus respaldos financieros. Pronto podrás enviar mensajes personalizados.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Donadores</span>
            <span className="text-xl font-black text-slate-900">{data?.meta?.totalItems || 0}</span>
          </div>
          <div className="bg-[#f0f9e0] border border-gray-100 rounded-2xl px-5 py-3 shadow-sm">
            <span className="text-[10px] font-black text-[#72B626] uppercase tracking-widest block mb-1">Retención de Capital</span>
            <span className="text-xl font-black text-[#4a7f1a]">100%</span>
          </div>
        </div>
      </div>

      {/* Grid of Investors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {investors.length > 0 ? (
          investors.map((inv) => (
            <div 
              key={inv.userId}
              onClick={() => setSelectedInvestor(inv)}
              className="bg-white border border-slate-100 rounded-[32px] p-6 hover:shadow-2xl hover:border-gray-100 transition-all cursor-pointer group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#f0f9e0]/30 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-[#f0f9e0]/50 transition-colors"></div>
              
              <div className="flex items-start gap-5 relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 shadow-inner border border-white">
                  {getImageUrl(inv.avatarUrl) ? (
                    <img 
                      src={getImageUrl(inv.avatarUrl)} 
                      alt={inv.firstName} 
                      className="w-full h-full object-cover" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).onerror = null;
                        (e.target as HTMLImageElement).src = '/default-avatar.png'; // Fallback to a default if 404
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-gradient-to-tr from-slate-50 to-slate-100">
                      <Users size={24} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-black text-slate-900 text-[16px] truncate">
                      {inv.displayName || `${inv.firstName} ${inv.lastName}`}
                    </h4>
                    <span className="text-[10px] font-black text-[#72B626] bg-[#f0f9e0] px-2 py-1 rounded-lg uppercase tracking-wider">
                      Activo
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium bg-slate-50 px-2 py-1 rounded-lg">
                      <Calendar size={12} /> {new Date(inv.lastInvestmentAt).toLocaleDateString()}
                    </div>
                    {inv.rewardTitle ? (
                      <div className="flex items-center gap-1.5 text-amber-600 text-[11px] font-black bg-amber-50 px-2 py-1 rounded-lg uppercase tracking-wider">
                        <Heart size={10} fill="currentColor" /> {inv.rewardTitle}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold bg-slate-100/50 px-2 py-1 rounded-lg uppercase tracking-wider">
                        Donación Directa
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <div>
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block">Monto Donado</span>
                      <span className="text-[14px] font-black text-slate-900">
                        {formatCampaignCurrency(inv.totalInvested, currency)}
                      </span>
                    </div>
                    <button className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-[#72B626] group-hover:text-white transition-all flex items-center justify-center">
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-slate-50 border border-dashed border-slate-200 rounded-[40px]">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4 shadow-sm">
              <Users size={32} />
            </div>
            <h4 className="text-slate-900 font-black text-lg">Aún no hay donadores</h4>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">
              Cuando los usuarios realicen donaciones completadas, aparecerán en este registro.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-6">
          {Array.from({ length: data?.meta?.totalPages || 0 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-10 h-10 rounded-xl font-black text-[13px] transition-all ${
                page === i + 1 
                  ? 'bg-[#1c2b1e] text-white' 
                  : 'bg-white border border-slate-200 text-slate-400 hover:border-gray-100'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Investor Profile Modal (Preview) */}
      {selectedInvestor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[#1c2b1e]/60 backdrop-blur-sm" onClick={() => setSelectedInvestor(null)}></div>
          
          <div className="bg-white rounded-[40px] w-full max-w-[500px] overflow-hidden relative z-10 shadow-2xl animate-in zoom-in-95 duration-300 border border-white">
            
            {/* Modal Header/Cover */}
            <div className="h-32 bg-gradient-to-br from-[#1c2b1e] to-[#72B626] relative">
              <button 
                onClick={() => setSelectedInvestor(null)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all flex items-center justify-center border-none cursor-pointer"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <div className="px-8 pb-10 -mt-16 text-center">
              <div className="w-32 h-32 rounded-[40px] bg-white p-2 mx-auto mb-6 shadow-xl relative overflow-hidden">
                {getImageUrl(selectedInvestor.avatarUrl) ? (
                  <img 
                    src={getImageUrl(selectedInvestor.avatarUrl)} 
                    className="w-full h-full object-cover rounded-[32px]"
                    onError={(e) => {
                      e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedInvestor.firstName || 'I')}+${encodeURIComponent(selectedInvestor.lastName || '')}&background=random`;
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-300 rounded-[32px]">
                    <Users size={40} />
                  </div>
                )}
              </div>

              <h3 className="text-2xl font-black text-slate-900 mb-1">
                {selectedInvestor.displayName || `${selectedInvestor.firstName} ${selectedInvestor.lastName}`}
              </h3>
              <p className="text-[#72B626] font-black text-[11px] uppercase tracking-widest mb-6 flex items-center justify-center gap-2">
                <Heart size={12} fill="currentColor" /> Donador de Impacto
              </p>

              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Aportado</span>
                  <span className="text-[14px] font-black text-slate-900">{formatCampaignCurrency(selectedInvestor.totalInvested, currency)}</span>
                </div>
                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 col-span-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Recompensa Seleccionada</span>
                  <span className="text-[13px] font-black text-[#72B626] truncate block">
                    {selectedInvestor.rewardTitle || 'Sin Recompensa (Donación)'}
                  </span>
                </div>
              </div>

              <div className="text-left space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-slate-400">
                    <Mail size={16} />
                    <span className="text-sm font-medium text-slate-600">{selectedInvestor.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400">
                    <MapPin size={16} />
                    <span className="text-sm font-medium text-slate-600">{selectedInvestor.location || 'Ubicación no especificada'}</span>
                  </div>
                </div>

                <div className="bg-slate-50/50 p-6 rounded-[28px] border border-slate-100">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Biografía</p>
                  <p className="text-[13px] text-slate-600 font-medium leading-relaxed italic">
                    {selectedInvestor.bio || '"Este donador prefiere mantener un perfil discreto sobre sus motivaciones."'}
                  </p>
                </div>
              </div>

              <div className="mt-10 flex gap-4">
                <button 
                  className="flex-1 h-14 bg-[#1c2b1e] hover:bg-[#72B626] text-white rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg shadow-[#1c2b1e]/20/10"
                  onClick={() => alert('Próximamente: Chat con donador')}
                >
                  <MessageSquare size={18} /> Enviar Mensaje
                </button>
                <button className="w-14 h-14 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all active:scale-95 flex items-center justify-center border-none cursor-pointer">
                  <ExternalLink size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
