import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Clock,
  Gift,
  FileText,
  ArrowRight,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FolderOpen,
  Loader2,
  Heart,
  Calendar,
  Layers,
} from 'lucide-react';
import type { InvestmentHistoryItem } from '../../api/investor.api';
import { downloadInvestmentReceipt } from '../../api/investor.api';
import { getImageUrl } from '../../utils/image.utils';
import { ProgressBar } from '../ProgressBar';

interface Props {
  investments: InvestmentHistoryItem[];
  loading: boolean;
  onSelectTab?: (tab: string) => void;
}

export function DonorContributionsFeed({ investments, loading, onSelectTab }: Props) {
  const [sortType, setSortType] = useState<string>('newest');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadReceipt = async (id: string) => {
    try {
      setDownloadingId(id);
      await downloadInvestmentReceipt(id);
    } catch (err) {
      console.error('Error al descargar comprobante:', err);
      alert('Hubo un error al generar el recibo. Por favor intenta de nuevo.');
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredInvestments = investments
    .filter((inv) => {
      const matchesStatus = statusFilter === 'all' || inv.investmentStatus === statusFilter;
      const matchesSearch = inv.campaignTitle.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      if (sortType === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortType === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortType === 'highest_amount') return b.amount - a.amount;
      if (sortType === 'lowest_amount') return a.amount - b.amount;
      if (sortType === 'alphabetical') return a.campaignTitle.localeCompare(b.campaignTitle);
      if (sortType === 'highest_goal') return (b.campaignGoal || 0) - (a.campaignGoal || 0);
      return 0;
    });

  return (
    <div className="space-y-6 font-['Plus Jakarta Sans',sans-serif]">
      {/* ── Filter & Search Toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-gray-100 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre de campaña..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-medium outline-none focus:border-[#72B626] transition-colors"
          />
        </div>

        {/* Filters and sorting */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-[#f8fafc] p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-[#1c2b1e] shadow-sm' : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              Todos ({investments.length})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                statusFilter === 'completed' ? 'bg-white text-[#1c2b1e] shadow-sm' : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              Completados
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                statusFilter === 'pending' ? 'bg-white text-[#1c2b1e] shadow-sm' : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              Pendientes
            </button>
          </div>

          {/* Sort Select */}
          <select
            value={sortType}
            onChange={(e) => setSortType(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-[12px] font-bold shadow-sm outline-none cursor-pointer hover:border-[#72B626] transition-colors"
          >
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguas</option>
            <option value="highest_amount">Mayor monto aportado</option>
            <option value="lowest_amount">Menor monto aportado</option>
            <option value="alphabetical">Alfabético</option>
          </select>
        </div>
      </div>

      {/* ── Investments Grid ── */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 font-bold text-[13px] uppercase tracking-widest flex flex-col items-center gap-4 bg-white rounded-2xl border border-gray-100">
          <div className="w-8 h-8 border-4 border-slate-100 border-t-[#72B626] rounded-full animate-spin" />
          Cargando aportes realizados...
        </div>
      ) : filteredInvestments.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-dashed border-gray-200 p-16 sm:p-20 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-[#f5fce8] text-[#72B626] flex items-center justify-center mx-auto mb-4">
            <Heart size={32} strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-black text-[#1c2b1e] tracking-tight mb-2">
            Sin Aportes que Coincidan
          </h3>
          <p className="text-[14px] text-slate-400 font-medium max-w-xs mx-auto leading-relaxed">
            {investments.length === 0
              ? 'Aún no has realizado aportes a ningún proyecto. Descubre iniciativas innovadoras y dales impulso.'
              : 'No encontramos donaciones con los filtros aplicados. Intenta restablecer el buscador.'}
          </p>
          <Link
            to="/explore"
            className="inline-flex items-center gap-2 mt-6 bg-[#72B626] hover:bg-[#5fa01d] text-white font-black px-7 py-3 rounded-xl transition-all border-none active:scale-95 cursor-pointer no-underline shadow-sm text-[12px] uppercase tracking-wider"
          >
            <span>Explorar Campañas</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <div className="grid gap-5">
          {filteredInvestments.map((inv) => {
            const campaignProgress =
              inv.campaignGoal > 0
                ? Math.min(100, Math.round(((inv.campaignCurrentAmount || 0) / inv.campaignGoal) * 100))
                : 0;

            const isCompleted = inv.investmentStatus === 'completed';

            return (
              <div
                key={inv.id}
                className="group bg-white rounded-2xl sm:rounded-[24px] p-5 sm:p-6 border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row gap-5 md:items-center justify-between"
              >
                {/* Left section: Cover and details */}
                <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
                  {/* Campaign Cover */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 overflow-hidden shrink-0 relative shadow-sm">
                    {getImageUrl(inv.campaignCoverImage) ? (
                      <img
                        src={getImageUrl(inv.campaignCoverImage)}
                        alt={inv.campaignTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-[#1c2b1e] to-[#72B626]" />
                    )}
                    <div className="absolute top-1.5 left-1.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[8px] font-black uppercase tracking-widest">
                        {inv.campaignType === 'donation' ? 'Donación' : 'Recompensa'}
                      </span>
                    </div>
                  </div>

                  {/* Title & Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          inv.investmentStatus === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : inv.investmentStatus === 'refunded'
                            ? 'bg-red-50 text-red-600 border border-red-100'
                            : inv.investmentStatus === 'partially_refunded'
                            ? 'bg-orange-50 text-orange-600 border border-orange-100'
                            : 'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {inv.investmentStatus === 'completed'
                          ? 'Completado'
                          : inv.investmentStatus === 'refunded'
                          ? 'Reembolsado'
                          : inv.investmentStatus === 'partially_refunded'
                          ? 'Reemb. Parcial'
                          : inv.investmentStatus}
                      </span>

                      <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(inv.createdAt).toLocaleDateString('es-BO', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <Link
                      to={`/campaign/${inv.campaignId}`}
                      className="text-[16px] sm:text-[18px] font-black text-[#1c2b1e] tracking-tight hover:text-[#72B626] transition-colors leading-snug line-clamp-2 no-underline block"
                    >
                      {inv.campaignTitle}
                    </Link>

                    {/* Reward Badge */}
                    {inv.rewardTitle && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg text-[11px] font-bold mt-2">
                        <Gift size={12} strokeWidth={2.5} className="text-amber-600 shrink-0" />
                        <span className="truncate max-w-xs">{inv.rewardTitle}</span>
                        {inv.rewardClaimStatus && (
                          <span className="text-[9px] uppercase tracking-wider font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 ml-1">
                            {inv.rewardClaimStatus === 'delivered' ? 'Entregada' : inv.rewardClaimStatus === 'shipped' ? 'Enviada' : 'En preparación'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Campaign Fundraising Progress Mini-bar */}
                    {inv.campaignGoal > 0 && (
                      <div className="mt-3 max-w-sm">
                        <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                          <span>Progreso de la Campaña</span>
                          <span className="text-[#72B626]">{campaignProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#72B626] rounded-full transition-all duration-500"
                            style={{ width: `${campaignProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right section: Financials & Action Buttons */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                  <div className="text-left sm:text-right">
                    <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                      Monto Aportado
                    </p>
                    <p className="text-[20px] sm:text-[24px] font-black text-[#1c2b1e] tracking-tight leading-none">
                      Bs. {inv.amount.toLocaleString('es-BO')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCompleted && (
                      <button
                        onClick={() => handleDownloadReceipt(inv.id)}
                        disabled={downloadingId === inv.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f5fce8] hover:bg-[#72B626] text-[#4a7f1a] hover:text-white font-black text-[11px] uppercase tracking-wider transition-all border-none cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                        title="Descargar Comprobante PDF"
                      >
                        {downloadingId === inv.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <FileText size={13} strokeWidth={2.5} />
                        )}
                        <span>Recibo</span>
                      </button>
                    )}

                    <Link
                      to={`/campaign/${inv.campaignId}`}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-black text-[11px] uppercase tracking-wider transition-all no-underline"
                    >
                      <span>Ver Proyecto</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

