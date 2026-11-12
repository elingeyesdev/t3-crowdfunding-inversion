import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Gift,
  Clock,
  Truck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Package,
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search,
} from 'lucide-react';
import type { InvestmentHistoryItem } from '../../api/investor.api';
import { getImageUrl } from '../../utils/image.utils';

interface Props {
  investments: InvestmentHistoryItem[];
  loading?: boolean;
}

const CLAIM_STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: any; step: number }> = {
  pending: { label: 'En Espera de Producción', color: '#f59e0b', bg: '#fef3c7', icon: Clock, step: 1 },
  processing: { label: 'En Preparación / Empaque', color: '#3b82f6', bg: '#dbeafe', icon: Package, step: 2 },
  shipped: { label: 'En Camino / Despachada', color: '#8b5cf6', bg: '#ede9fe', icon: Truck, step: 3 },
  delivered: { label: 'Entregada con Éxito', color: '#72B626', bg: '#f0f9e0', icon: CheckCircle2, step: 4 },
  issue_reported: { label: 'Incidencia Reportada', color: '#ef4444', bg: '#fee2e2', icon: AlertCircle, step: 0 },
};

export function DonorRewardsTracker({ investments, loading }: Props) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter only investments with a reward
  const rewardInvestments = investments.filter(
    (inv) => inv.rewardTitle && inv.rewardTitle.trim() !== '' && inv.rewardTitle !== 'Aporte Directo'
  );

  const filteredRewards = rewardInvestments.filter((inv) => {
    const status = inv.rewardClaimStatus || 'pending';
    const matchesStatus = filterStatus === 'all' || status === filterStatus;
    const matchesSearch =
      inv.rewardTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.campaignTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 font-['Plus Jakarta Sans',sans-serif]">
      {/* ── Header Card ── */}
      <div className="bg-white rounded-[24px] p-6 sm:p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Gift size={14} strokeWidth={2.5} className="text-amber-600" />
              Recompensas y Beneficios
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#1c2b1e] tracking-tight">
            Seguimiento de Mis Recompensas
          </h2>
          <p className="text-[13px] sm:text-[14px] text-slate-500 font-medium mt-1 max-w-xl leading-relaxed">
            Supervisa el estado de producción, embalaje y envío de las recompensas asociadas a tus aportes.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-[#f5fce8] rounded-2xl p-4 shrink-0 border border-green-100">
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center text-[#72B626] shadow-sm">
            <Gift size={22} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Total Adquiridas
            </p>
            <p className="text-xl font-black text-[#1c2b1e]">
              {rewardInvestments.length} Recompensa{rewardInvestments.length === 1 ? '' : 's'}
            </p>
            <p className="text-[11px] font-bold text-[#72B626]">
              {rewardInvestments.filter((r) => r.rewardClaimStatus === 'delivered').length} Entregadas
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por recompensa o proyecto..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-medium outline-none focus:border-[#72B626] shadow-sm transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border-none cursor-pointer shrink-0 ${
              filterStatus === 'all'
                ? 'bg-[#1c2b1e] text-white shadow-sm'
                : 'bg-white text-slate-500 hover:text-slate-800 border border-gray-200'
            }`}
          >
            Todas ({rewardInvestments.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border-none cursor-pointer shrink-0 ${
              filterStatus === 'pending'
                ? 'bg-[#1c2b1e] text-white shadow-sm'
                : 'bg-white text-slate-500 hover:text-slate-800 border border-gray-200'
            }`}
          >
            En Espera
          </button>
          <button
            onClick={() => setFilterStatus('processing')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border-none cursor-pointer shrink-0 ${
              filterStatus === 'processing'
                ? 'bg-[#1c2b1e] text-white shadow-sm'
                : 'bg-white text-slate-500 hover:text-slate-800 border border-gray-200'
            }`}
          >
            En Preparación
          </button>
          <button
            onClick={() => setFilterStatus('shipped')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border-none cursor-pointer shrink-0 ${
              filterStatus === 'shipped'
                ? 'bg-[#1c2b1e] text-white shadow-sm'
                : 'bg-white text-slate-500 hover:text-slate-800 border border-gray-200'
            }`}
          >
            En Camino
          </button>
          <button
            onClick={() => setFilterStatus('delivered')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border-none cursor-pointer shrink-0 ${
              filterStatus === 'delivered'
                ? 'bg-[#1c2b1e] text-white shadow-sm'
                : 'bg-white text-slate-500 hover:text-slate-800 border border-gray-200'
            }`}
          >
            Entregadas
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-[#72B626] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">
            Cargando tus recompensas...
          </p>
        </div>
      ) : filteredRewards.length === 0 ? (
        <div className="bg-white rounded-[32px] border border-dashed border-gray-200 p-12 sm:p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
            <Gift size={32} />
          </div>
          <h3 className="text-xl font-black text-[#1c2b1e] tracking-tight mb-2">
            {rewardInvestments.length === 0
              ? 'No tienes recompensas reclamadas aún'
              : 'No hay recompensas que coincidan con el filtro'}
          </h3>
          <p className="text-[14px] text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
            {rewardInvestments.length === 0
              ? 'Al realizar donaciones en campañas que ofrecen recompensas físicas o digitales, podrás realizarles seguimiento desde este panel.'
              : 'Prueba cambiando los términos de búsqueda o el estado del filtro.'}
          </p>
          {rewardInvestments.length === 0 && (
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-[#72B626] text-white font-black text-[12px] uppercase tracking-wider no-underline hover:bg-[#5fa01d] transition-all shadow-sm"
            >
              <span>Explorar Campañas con Recompensas</span>
              <ArrowRight size={15} />
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredRewards.map((item) => {
            const rawStatus = item.rewardClaimStatus || 'pending';
            const statusConfig = CLAIM_STATUS_MAP[rawStatus] || CLAIM_STATUS_MAP.pending;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl sm:rounded-[24px] p-5 sm:p-7 border border-gray-100 shadow-sm hover:border-gray-200 transition-all flex flex-col md:flex-row gap-6 justify-between items-start"
              >
                {/* Left side: details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
                    >
                      <StatusIcon size={12} strokeWidth={2.5} />
                      {statusConfig.label}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      Aporte: Bs. {item.amount.toLocaleString('es-BO')}
                    </span>
                  </div>

                  <h3 className="text-[17px] sm:text-[19px] font-black text-[#1c2b1e] tracking-tight mb-2">
                    {item.rewardTitle}
                  </h3>

                  {item.rewardDescription && (
                    <p className="text-[13px] text-slate-600 leading-relaxed mb-4 max-w-2xl">
                      {item.rewardDescription}
                    </p>
                  )}

                  {/* Campaign source */}
                  <div className="flex items-center gap-2.5 bg-slate-50 rounded-xl p-2.5 max-w-fit border border-slate-100">
                    <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 bg-slate-200">
                      {getImageUrl(item.campaignCoverImage) ? (
                        <img src={getImageUrl(item.campaignCoverImage)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#1c2b1e]" />
                      )}
                    </div>
                    <span className="text-[12px] font-bold text-slate-700 truncate max-w-xs sm:max-w-md">
                      Proyecto: <span className="text-[#1c2b1e] font-black">{item.campaignTitle}</span>
                    </span>
                    <Link
                      to={`/campaign/${item.campaignId}`}
                      className="text-[#72B626] hover:text-[#5fa01d] transition-colors"
                      title="Ver campaña"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  </div>

                  {/* Delivery & tracking info if any */}
                  <div className="flex flex-wrap items-center gap-4 mt-4 text-[12px] text-slate-500 font-medium">
                    {item.rewardEstimatedDelivery && (
                      <span className="flex items-center gap-1.5 text-slate-600 font-bold">
                        <Calendar size={14} className="text-[#72B626]" />
                        Entrega estimada: {item.rewardEstimatedDelivery}
                      </span>
                    )}
                    {item.trackingNumber && (
                      <span className="flex items-center gap-1.5 font-bold text-slate-700 bg-amber-50 px-2.5 py-1 rounded-lg">
                        <Truck size={14} className="text-amber-600" />
                        Guía de envío: {item.trackingNumber}
                      </span>
                    )}
                    {item.trackingUrl && (
                      <a
                        href={item.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600 hover:underline"
                      >
                        <span>Rastrear paquete</span>
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Right side: step tracker preview */}
                <div className="w-full md:w-56 shrink-0 bg-[#f8fafc] rounded-2xl p-4 border border-slate-100 text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Fases de Entrega
                  </p>
                  <div className="space-y-2.5 text-[11px] font-bold">
                    <div className="flex items-center gap-2 text-slate-700">
                      <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] shrink-0">
                        ✓
                      </div>
                      <span className="line-through text-slate-400">Aporte Confirmado</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                          statusConfig.step >= 2 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {statusConfig.step >= 2 ? '✓' : '2'}
                      </div>
                      <span className={statusConfig.step >= 2 ? 'text-slate-700' : 'text-slate-400'}>
                        Producción y Empaque
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                          statusConfig.step >= 3 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {statusConfig.step >= 3 ? '✓' : '3'}
                      </div>
                      <span className={statusConfig.step >= 3 ? 'text-slate-700' : 'text-slate-400'}>
                        Despacho / Envío
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                          statusConfig.step >= 4 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {statusConfig.step >= 4 ? '✓' : '4'}
                      </div>
                      <span className={statusConfig.step >= 4 ? 'text-emerald-600 font-black' : 'text-slate-400'}>
                        Entregado
                      </span>
                    </div>
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

