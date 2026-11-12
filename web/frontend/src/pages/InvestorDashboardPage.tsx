import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { InvestorDashboardOverview } from '../components/InvestorDashboardOverview';
import { InvestorDashboardAnalytics } from '../components/InvestorDashboardAnalytics';
import { AddCapitalModal } from '../components/AddCapitalModal';
import { DonorContributionsFeed } from '../components/donor-tracking/DonorContributionsFeed';
import { DonorRewardsTracker } from '../components/donor-tracking/DonorRewardsTracker';
import { DonorBackedUpdatesFeed } from '../components/donor-tracking/DonorBackedUpdatesFeed';
import { DonorReceiptsList } from '../components/donor-tracking/DonorReceiptsList';

import { useInvestorDashboard } from '../hooks/useInvestorDashboard';
import {
  Heart,
  Gift,
  TrendingUp,
  ArrowRight,
  LayoutDashboard,
  Clock,
  FileText,
  Sparkles,
  Receipt,
  FolderOpen,
} from 'lucide-react';
import { getMyInvestments, type InvestmentHistoryItem } from '../api/investor.api';

export type InvestorDashboardTab = 'contributions' | 'rewards' | 'updates' | 'receipts' | 'analytics';

export function InvestorDashboardPage() {
  const { data, loading, error, refetch } = useInvestorDashboard();
  const [investments, setInvestments] = useState<InvestmentHistoryItem[]>([]);
  const [loadingInvestments, setLoadingInvestments] = useState(true);
  const [showAddCapital, setShowAddCapital] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<InvestorDashboardTab>(() => {
    if (urlTab === 'rewards' || urlTab === 'updates' || urlTab === 'receipts' || urlTab === 'analytics') {
      return urlTab;
    }
    if (urlTab === 'activity') return 'contributions';
    if (urlTab === 'more') return 'analytics';
    return 'contributions';
  });

  // Sync tab with URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['contributions', 'rewards', 'updates', 'receipts', 'analytics'].includes(tabParam)) {
      setActiveTab(tabParam as InvestorDashboardTab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: InvestorDashboardTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (data) {
      getMyInvestments()
        .then((list) =>
          list.map((inv) => ({
            ...inv,
            campaignType: inv.campaignType === 'equity' ? 'donation' : inv.campaignType,
          }))
        )
        .then(setInvestments)
        .catch(console.error)
        .finally(() => setLoadingInvestments(false));
    }
  }, [data]);

  const rewardCount = investments.filter(
    (inv) => inv.rewardTitle && inv.rewardTitle.trim() !== '' && inv.rewardTitle !== 'Aporte Directo'
  ).length;

  const completedReceiptCount = investments.filter(
    (inv) => inv.investmentStatus === 'completed'
  ).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-['Plus Jakarta Sans',sans-serif]">
      <Navbar />

      {/* HERO SECTION */}
      <div className="bg-white border-b border-gray-200 pt-10 pb-28 px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#f5fce8' }}>
              <LayoutDashboard size={22} strokeWidth={2} style={{ color: '#72B626' }} />
            </div>
            <h1 className="text-[32px] font-bold text-gray-900 tracking-tight">
              Seguimiento Privado del Donador
            </h1>
          </div>
          <p className="text-[15px] text-gray-500 max-w-2xl leading-relaxed">
            Supervisa tus aportes realizados, consulta el estado de tus recompensas, descarga comprobantes
            oficiales y sigue las novedades de los proyectos que has respaldado.
          </p>
        </div>
      </div>

      <main className="max-w-[1100px] mx-auto px-6 -mt-20 relative z-20">
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <div className="w-10 h-10 border-3 border-gray-200 border-t-[#72B626] rounded-full animate-spin" />
            <span className="text-[13px] text-gray-400">Cargando tu panel de seguimiento...</span>
          </div>
        )}

        {error && (
          <div className="bg-white/90 backdrop-blur-xl rounded-[32px] p-12 text-center shadow-[0_20px_40px_rgb(0,0,0,0.08)] border border-white animate-in fade-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="text-[#72B626] mb-6 flex justify-center relative z-10">
              <Heart size={64} strokeWidth={1.5} />
            </div>
            <h2 className="text-3xl font-black text-[#1c2b1e] tracking-tight mb-4 leading-none relative z-10">
              Bienvenido a UniFundMe
            </h2>
            <p className="text-[16px] text-slate-500 font-medium leading-relaxed max-w-md mx-auto mb-10 relative z-10">
              Parece que aún no tienes configurado tu perfil de donador. Complétalo para empezar a donar y monitorear tu capital con solidez financiera.
            </p>
            <Link
              to="/profile"
              className="inline-flex items-center justify-center bg-gradient-to-r from-[#72B626] to-[#1c2b1e] hover:from-[#1c2b1e] hover:to-[#1c2b1e] text-white font-black px-10 py-4 rounded-2xl transition-all active:scale-95 shadow-[0_8px_20px_rgba(46,125,50,0.3)] no-underline cursor-pointer gap-3 relative z-10"
            >
              Completar Perfil de Donador
              <ArrowRight size={20} strokeWidth={2.5} />
            </Link>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-10 animate-in fade-in duration-700">
            {/* Overview Cards (Capital, Total Donado, etc.) */}
            <InvestorDashboardOverview
              data={data}
              onAddCapital={() => setShowAddCapital(true)}
            />

            {/* ── Sub-navigation Tab Bar ── */}
            <div className="flex border-b border-gray-200 gap-2 sm:gap-6 overflow-x-auto scrollbar-none pb-0.5">
              {/* Tab 1: Mis Aportes */}
              <button
                onClick={() => handleTabChange('contributions')}
                className={`pb-4 px-2 sm:px-3 text-[13px] sm:text-[14px] font-black uppercase tracking-wider transition-all relative border-none bg-transparent cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'contributions' ? 'text-[#72B626]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Heart size={16} strokeWidth={activeTab === 'contributions' ? 2.5 : 2} />
                <span>Mis Aportes</span>
                {investments.length > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      activeTab === 'contributions'
                        ? 'bg-[#f0f9e0] text-[#72B626]'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {investments.length}
                  </span>
                )}
                {activeTab === 'contributions' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#72B626] rounded-full" />
                )}
              </button>

              {/* Tab 2: Recompensas */}
              <button
                onClick={() => handleTabChange('rewards')}
                className={`pb-4 px-2 sm:px-3 text-[13px] sm:text-[14px] font-black uppercase tracking-wider transition-all relative border-none bg-transparent cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'rewards' ? 'text-[#72B626]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Gift size={16} strokeWidth={activeTab === 'rewards' ? 2.5 : 2} />
                <span>Recompensas</span>
                {rewardCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      activeTab === 'rewards'
                        ? 'bg-[#f0f9e0] text-[#72B626]'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {rewardCount}
                  </span>
                )}
                {activeTab === 'rewards' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#72B626] rounded-full" />
                )}
              </button>

              {/* Tab 3: Novedades de Proyectos */}
              <button
                onClick={() => handleTabChange('updates')}
                className={`pb-4 px-2 sm:px-3 text-[13px] sm:text-[14px] font-black uppercase tracking-wider transition-all relative border-none bg-transparent cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'updates' ? 'text-[#72B626]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Sparkles size={16} strokeWidth={activeTab === 'updates' ? 2.5 : 2} />
                <span>Novedades</span>
                <span className="px-1.5 py-0.5 rounded-full bg-green-50 text-[#72B626] text-[9px] font-black">
                  Bitácora
                </span>
                {activeTab === 'updates' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#72B626] rounded-full" />
                )}
              </button>

              {/* Tab 4: Comprobantes */}
              <button
                onClick={() => handleTabChange('receipts')}
                className={`pb-4 px-2 sm:px-3 text-[13px] sm:text-[14px] font-black uppercase tracking-wider transition-all relative border-none bg-transparent cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'receipts' ? 'text-[#72B626]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <FileText size={16} strokeWidth={activeTab === 'receipts' ? 2.5 : 2} />
                <span>Comprobantes</span>
                {completedReceiptCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      activeTab === 'receipts'
                        ? 'bg-[#f0f9e0] text-[#72B626]'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {completedReceiptCount}
                  </span>
                )}
                {activeTab === 'receipts' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#72B626] rounded-full" />
                )}
              </button>

              {/* Tab 5: Métricas & Capital */}
              <button
                onClick={() => handleTabChange('analytics')}
                className={`pb-4 px-2 sm:px-3 text-[13px] sm:text-[14px] font-black uppercase tracking-wider transition-all relative border-none bg-transparent cursor-pointer flex items-center gap-2 shrink-0 ${
                  activeTab === 'analytics' ? 'text-[#72B626]' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <TrendingUp size={16} strokeWidth={activeTab === 'analytics' ? 2.5 : 2} />
                <span>Rendimiento</span>
                {activeTab === 'analytics' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#72B626] rounded-full" />
                )}
              </button>
            </div>

            {/* ── Active Tab Contents ── */}
            {activeTab === 'contributions' && (
              <DonorContributionsFeed
                investments={investments}
                loading={loadingInvestments}
                onSelectTab={(tab) => handleTabChange(tab as InvestorDashboardTab)}
              />
            )}

            {activeTab === 'rewards' && (
              <DonorRewardsTracker
                investments={investments}
                loading={loadingInvestments}
              />
            )}

            {activeTab === 'updates' && (
              <DonorBackedUpdatesFeed />
            )}

            {activeTab === 'receipts' && (
              <DonorReceiptsList
                investments={investments}
                loading={loadingInvestments}
              />
            )}

            {activeTab === 'analytics' && (
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
