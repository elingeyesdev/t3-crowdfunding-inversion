import { Navbar } from '../components/Navbar';
import { InvestorDashboardOverview } from '../components/InvestorDashboardOverview';
import { InvestorDashboardAnalytics } from '../components/InvestorDashboardAnalytics';
import { AddCapitalModal } from '../components/AddCapitalModal';

import { useInvestorDashboard } from '../hooks/useInvestorDashboard';
import { Link } from 'react-router-dom';
import { Heart, Gift, TrendingUp, ArrowRight, LayoutDashboard, Clock, FileText } from 'lucide-react';
import { getMyInvestments, downloadInvestmentReceipt, type InvestmentHistoryItem } from '../api/investor.api';
import { getImageUrl } from '../utils/image.utils';
import { useState, useEffect } from 'react';

export function InvestorDashboardPage() {
  const { data, loading, error, refetch } = useInvestorDashboard();
  const [investments, setInvestments] = useState<InvestmentHistoryItem[]>([]);
  const [loadingInvestments, setLoadingInvestments] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showAddCapital, setShowAddCapital] = useState(false);
  const [sortType, setSortType] = useState<string>('newest');
  const [activeTab, setActiveTab] = useState<'activity' | 'more'>('activity');

  const filteredInvestments = investments
    .sort((a, b) => {
      if (sortType === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortType === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortType === 'alphabetical') return a.campaignTitle.localeCompare(b.campaignTitle);
      if (sortType === 'highest_goal') return (b.campaignGoal || 0) - (a.campaignGoal || 0);
      if (sortType === 'lowest_goal') return (a.campaignGoal || 0) - (b.campaignGoal || 0);
      return 0;
    });

  const handleDownloadReceipt = async (id: string) => {
    try {
      setDownloadingId(id);
      await downloadInvestmentReceipt(id);
    } catch (err) {
      console.error('Error al descargar recibo:', err);
      alert('Hubo un error al generar el recibo. Por favor intenta de nuevo.');
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    if (data) {
      getMyInvestments()
        .then(list => list.map(inv => ({
          ...inv,
          campaignType: inv.campaignType === 'equity' ? 'donation' : inv.campaignType
        })))
        .then(setInvestments)
        .catch(console.error)
        .finally(() => setLoadingInvestments(false));
    }
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50 pb-24" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Navbar />

      {/* HERO SECTION */}
      <div className="bg-white border-b border-gray-200 pt-10 pb-28 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#f5fce8' }}>
              <LayoutDashboard size={22} strokeWidth={2} style={{ color: '#72B626' }} />
            </div>
            <h1 className="text-[32px] font-bold text-gray-900 tracking-tight">
              Panel de Donador
            </h1>
          </div>
          <p className="text-[15px] text-gray-500 max-w-xl leading-relaxed">
            Monitorea tu capital, gestiona tus donaciones activas y descubre nuevas oportunidades.
          </p>
        </div>
      </div>

      <main className="max-w-[1100px] mx-auto px-6 -mt-20 relative z-20" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="w-10 h-10 border-3 border-gray-200 border-t-[#72B626] rounded-full animate-spin" />
            <span className="text-[13px] text-gray-400">Cargando tu panel...</span>
          </div>
        )}

        {error && (
          <div className="bg-white/90 backdrop-blur-xl rounded-[32px] p-12 text-center shadow-[0_20px_40px_rgb(0,0,0,0.08)] border border-white animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="text-[#72B626] mb-6 flex justify-center relative z-10">
               <Heart size={64} strokeWidth={1.5} />
            </div>
            <h2 className="text-3xl font-black text-[#1c2b1e] tracking-tight mb-4 leading-none relative z-10">Bienvenido a CrowdFunding</h2>
            <p className="text-[16px] text-slate-500 font-medium leading-relaxed max-w-md mx-auto mb-10 relative z-10">
              Parece que aún no tienes configurado tu perfil de donador. Complétalo para empezar a donar y monitorear tu capital con solidez financiera.
            </p>
            <Link to="/profile" className="inline-flex items-center justify-center bg-gradient-to-r from-[#72B626] to-[#1c2b1e] hover:from-[#1c2b1e] hover:to-[#1c2b1e] text-white font-black px-10 py-4 rounded-2xl transition-all active:scale-95 shadow-[0_8px_20px_rgba(46,125,50,0.3)] no-underline cursor-pointer gap-3 relative z-10">
              Completar Perfil Corporativo 
              <ArrowRight size={20} strokeWidth={2.5} />
            </Link>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-16 animate-in fade-in duration-700">
            <InvestorDashboardOverview
              data={data}
              onAddCapital={() => setShowAddCapital(true)}
            />

            {/* Pestañas de Navegación */}
            <div className="flex border-b border-gray-200 gap-8 -mt-4 mb-4">
              <button
                onClick={() => setActiveTab('activity')}
                className={`pb-4 text-[14px] font-black uppercase tracking-wider transition-all relative border-none bg-transparent cursor-pointer ${
                  activeTab === 'activity' ? 'text-[#72B626]' : 'text-gray-400 hover:text-gray-600'
                }`}
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Actividad Reciente
                {activeTab === 'activity' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#72B626] rounded-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('more')}
                className={`pb-4 text-[14px] font-black uppercase tracking-wider transition-all relative border-none bg-transparent cursor-pointer ${
                  activeTab === 'more' ? 'text-[#72B626]' : 'text-gray-400 hover:text-gray-600'
                }`}
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Ver más
                {activeTab === 'more' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#72B626] rounded-full" />
                )}
              </button>
            </div>

            {activeTab === 'activity' && (
              <div className="flex flex-col gap-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-200 pb-5 gap-4">
                 <div className="flex items-center gap-3">
                   <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#f5fce8' }}>
                     <TrendingUp size={18} strokeWidth={2} style={{ color: '#72B626' }} />
                   </div>
                   <h2 className="text-[18px] font-bold text-gray-900">Operaciones Recientes</h2>
                 </div>
                 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                   <select 
                     value={sortType} 
                     onChange={(e) => setSortType(e.target.value)}
                     className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-[13px] font-medium shadow-sm outline-none cursor-pointer hover:border-[#72B626] transition-colors appearance-none w-full sm:w-auto"
                   >
                     <option value="newest">Más recientes</option>
                     <option value="oldest">Más antiguas</option>
                     <option value="alphabetical">Orden alfabético</option>
                     <option value="highest_goal">Mayor meta</option>
                     <option value="lowest_goal">Menor meta</option>
                   </select>
                 </div>
              </div>
              
              {loadingInvestments ? (
                <div className="py-10 text-center text-slate-400 font-bold text-[13px] uppercase tracking-widest flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-4 border-slate-100 border-t-[#72B626] rounded-full animate-spin" />
                  Cargando operaciones...
                </div>
              ) : filteredInvestments.length === 0 ? (
                <div className="bg-white rounded-[32px] border border-dashed border-emerald-200 p-20 text-center shadow-sm">
                  <div className="text-green-100 mb-6 flex justify-center">
                     <TrendingUp size={64} strokeWidth={1} />
                  </div>
                  <h3 className="text-xl font-black text-[#1c2b1e] tracking-tight mb-3">Sin Actividad Pendiente</h3>
                  <p className="text-[14px] text-slate-400 font-medium max-w-xs mx-auto">No hay operaciones que coincidan con tu búsqueda. Explora nuestras campañas activas.</p>
                  <Link to="/explore" className="inline-block mt-8 bg-green-50 hover:bg-[#72B626] hover:text-white text-[#72B626] font-black px-8 py-3 rounded-xl transition-all border-none active:scale-95 cursor-pointer no-underline shadow-sm">
                    Explorar Campañas
                  </Link>
                </div>
              ) : (
                <div className="grid gap-6">
                  {filteredInvestments.map((inv) => (
                    <div key={inv.id} className="group bg-white rounded-2xl sm:rounded-xl p-4 sm:p-5 border border-gray-100 hover:border-gray-200 flex flex-col sm:flex-row gap-4 sm:gap-6 shadow-sm hover:shadow-md transition-all duration-300">
                      
                      <div className="flex flex-row items-start gap-3 sm:gap-6 flex-1 w-full">
                        <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-xl bg-slate-100 overflow-hidden shrink-0 relative">
                          {getImageUrl(inv.campaignCoverImage) ? (
                            <img src={getImageUrl(inv.campaignCoverImage)} alt={inv.campaignTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-tr from-[#1c2b1e] to-[#72B626]" />
                          )}
                          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2">
                             <span className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-black/60 backdrop-blur-md text-white text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
                               {inv.campaignType === 'donation' ? 'Donación' : 'Recompensa'}
                             </span>
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0 py-0 sm:py-2">
                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black uppercase tracking-widest ${
                              inv.investmentStatus === 'completed' ? 'bg-green-50 text-[#72B626] border border-green-100' :
                              inv.investmentStatus === 'refunded' ? 'bg-red-50 text-red-600 border border-red-100' :
                              inv.investmentStatus === 'partially_refunded' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                              'bg-slate-50 text-slate-500 border border-slate-200'
                            }`}>
                              {inv.investmentStatus === 'completed' ? 'Completado' :
                               inv.investmentStatus === 'refunded' ? 'Reembolsado' :
                               inv.investmentStatus === 'partially_refunded' ? 'Reemb. Parcial' :
                               inv.investmentStatus}
                            </span>
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 flex items-center gap-1">
                              <Clock size={10} strokeWidth={2.5} className="hidden sm:block" />
                              {new Date(inv.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <h3 className="text-[15px] sm:text-[20px] font-black text-[#1c2b1e] tracking-tight mb-1 sm:mb-2 line-clamp-2 sm:truncate group-hover:text-[#72B626] transition-colors leading-tight">
                            {inv.campaignTitle}
                          </h3>
                          {inv.rewardTitle && (
                            <div className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-amber-50 text-amber-700 rounded-md text-[10px] sm:text-[11px] font-bold mt-0.5 sm:mt-1 max-w-full">
                              <Gift size={10} strokeWidth={2.5} className="shrink-0" />
                              <span className="truncate">{inv.rewardTitle}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="w-full sm:w-auto shrink-0 flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center mt-2 sm:mt-0 gap-3 border-t sm:border-t-0 border-dashed border-gray-200 pt-3 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Monto Donado</p>
                          <p className="text-[18px] sm:text-2xl font-black text-[#1c2b1e] tracking-tighter leading-none">Bs. {inv.amount.toLocaleString('es-BO')}</p>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-1.5">
                          {inv.investmentStatus === 'completed' && (
                            <button
                              onClick={() => handleDownloadReceipt(inv.id)}
                              disabled={downloadingId === inv.id}
                              className="text-[10px] sm:text-[11px] font-black text-[#72B626] bg-[#f0f9e0] hover:bg-[#72B626] hover:text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border-none cursor-pointer inline-flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                            >
                              {downloadingId === inv.id ? (
                                <div className="w-3 h-3 border-2 border-[#72B626]/30 border-t-[#72B626] group-hover/btn:border-white/30 group-hover/btn:border-t-white rounded-full animate-spin" />
                              ) : (
                                <FileText size={14} strokeWidth={2.5} />
                              )}
                              <span className="hidden sm:inline">Recibo</span>
                            </button>
                          )}
                          <Link to={`/campaign/${inv.campaignId}`} className="w-7 h-7 sm:w-auto sm:h-auto flex sm:inline-flex items-center justify-center sm:gap-1 sm:px-2 sm:py-1.5 text-[11px] font-black text-slate-400 hover:text-[#72B626] bg-white sm:bg-transparent rounded-lg sm:rounded-none border border-slate-200 sm:border-transparent transition-colors no-underline">
                            <span className="hidden sm:inline">Ver Campaña</span>
                            <ArrowRight size={14} strokeWidth={2.5} className="w-3.5 h-3.5 sm:w-[14px] sm:h-[14px]" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {activeTab === 'more' && (
              <InvestorDashboardAnalytics
                data={data}
                investments={investments}
              />
            )}
          </div>
        )}
      </main>

      {/* Modal de Aumentar Capital */}
      <AddCapitalModal
        isOpen={showAddCapital}
        onClose={() => setShowAddCapital(false)}
        onSuccess={refetch}
        currentAvailable={data?.availableCapital ?? null}
        currentMax={data?.maxInvestmentLimit ?? null}
      />
    </div>
  );
}

