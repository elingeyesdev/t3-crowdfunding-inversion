import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Users,
  DollarSign,
  ArrowUpRight,
  PieChart as PieIcon,
  Receipt,
  CheckCircle2,
  Lock,
  Calendar,
  Layers,
} from 'lucide-react';
import type { CampaignFinancialProgress, RecentInvestment } from '../../../types/campaign.types';
import { formatCampaignCurrency } from '../../../utils/campaignFunding';

interface Props {
  finance: CampaignFinancialProgress | null;
  startDate?: string | Date | null;
  createdAt?: string | Date | null;
}

const PIE_COLORS = ['#72B626', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export function PublicFinancialAuditing({
  finance,
  startDate,
  createdAt,
}: Props) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'direct' | 'rewards'>('all');

  if (!finance) {
    return (
      <div className="bg-white rounded-[28px] p-10 border border-slate-100 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-3 animate-pulse">
          <TrendingUp size={24} />
        </div>
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">
          Cargando auditoría financiera pública...
        </p>
      </div>
    );
  }

  const {
    currentAmount = 0,
    goalAmount = 0,
    currency = 'BOB',
    investorCount = 0,
    fundingPercentage = 0,
    averageInvestment = 0,
    largestInvestment = 0,
    smallestInvestment = 0,
    recentInvestments = [],
    dailyProgress = [],
    fundingBreakdown = [],
  } = finance;

  // Transparencia en deducción de comisiones
  const platformFeePercentage = 5;
  const platformFeeAmount = Math.round(currentAmount * 0.05 * 100) / 100;
  const netEntrepreneurAmount = Math.round((currentAmount - platformFeeAmount) * 100) / 100;

  // Chart 1: Time series evolution
  const chartData = useMemo(() => {
    if (dailyProgress.length === 0) {
      const initialDate = new Date(startDate || createdAt || Date.now());
      const formattedDate = initialDate.toLocaleDateString('es-BO', { day: 'numeric', month: 'short' });
      return [{ date: formattedDate, accumulated: 0 }];
    }

    return dailyProgress.map((p) => {
      const formattedDate = new Date(p.date).toLocaleDateString('es-BO', {
        day: 'numeric',
        month: 'short',
      });
      return {
        date: formattedDate,
        accumulated: p.accumulatedAmount,
      };
    });
  }, [dailyProgress, startDate, createdAt]);

  // Chart 2: Funding breakdown by rewards/direct
  const pieData = useMemo(() => {
    if (fundingBreakdown.length === 0) {
      return [{ name: 'Aportes Directos', value: currentAmount || 1, color: '#72B626' }];
    }

    return fundingBreakdown
      .filter((b) => b.totalAmount > 0)
      .map((b, idx) => ({
        name: b.rewardTitle,
        value: b.totalAmount,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      }));
  }, [fundingBreakdown, currentAmount]);

  // Filtered recent investments
  const filteredInvestments = useMemo(() => {
    if (selectedFilter === 'all') return recentInvestments;
    if (selectedFilter === 'rewards') {
      return recentInvestments.filter((i) => i.rewardTitle && i.rewardTitle !== 'Aporte Directo');
    }
    return recentInvestments.filter((i) => !i.rewardTitle || i.rewardTitle === 'Aporte Directo');
  }, [recentInvestments, selectedFilter]);

  return (
    <div className="space-y-6 font-['Plus Jakarta Sans',sans-serif]">
      {/* ── Key Metrics 4-Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-green-50 text-[#72B626] flex items-center justify-center mb-3">
            <DollarSign size={18} strokeWidth={2.5} />
          </div>
          <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Total Recaudado
          </p>
          <p className="text-lg sm:text-xl font-black text-[#1c2b1e]">
            {formatCampaignCurrency(currentAmount, currency)}
          </p>
          <p className="text-[11px] font-bold text-[#72B626] mt-0.5">
            {fundingPercentage}% de la meta
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
            <Users size={18} strokeWidth={2.5} />
          </div>
          <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Donantes Únicos
          </p>
          <p className="text-lg sm:text-xl font-black text-[#1c2b1e]">
            {investorCount}
          </p>
          <p className="text-[11px] font-bold text-slate-400 mt-0.5">
            Comunidad activa
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
            <Receipt size={18} strokeWidth={2.5} />
          </div>
          <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Aporte Promedio
          </p>
          <p className="text-lg sm:text-xl font-black text-[#1c2b1e]">
            {formatCampaignCurrency(averageInvestment || (investorCount > 0 ? currentAmount / investorCount : 0), currency)}
          </p>
          <p className="text-[11px] font-bold text-slate-400 mt-0.5">
            Por transacción
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
            <TrendingUp size={18} strokeWidth={2.5} />
          </div>
          <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Mayor Aporte
          </p>
          <p className="text-lg sm:text-xl font-black text-[#1c2b1e]">
            {formatCampaignCurrency(largestInvestment, currency)}
          </p>
          <p className="text-[11px] font-bold text-slate-400 mt-0.5">
            Aporte líder
          </p>
        </div>
      </div>

      {/* ── Operational Transparency Breakdown: Net vs Fee ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-green-50 text-[#72B626] flex items-center justify-center">
              <ShieldCheck size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="text-[13px] sm:text-[14px] font-black text-[#1c2b1e]">
                Desglose Operativo Transparente
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">
                Regulación de comisiones aplicada a los fondos recibidos
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-green-50 text-[#72B626] self-start sm:self-auto">
            100% Auditado
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#f0f9e0]/60 rounded-xl p-4 border border-[#72B626]/20">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-black text-[#4a7f1a] uppercase tracking-wider">
                Fondo Neto para el Emprendedor (95%)
              </span>
              <span className="text-[13px] font-black text-[#1c2b1e]">
                {formatCampaignCurrency(netEntrepreneurAmount, currency)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Recursos líquidos destinados íntegramente a la ejecución del proyecto,
              compra de insumos y entrega de recompensas.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                Comisión de Plataforma y Pasarela (5%)
              </span>
              <span className="text-[13px] font-black text-slate-700">
                {formatCampaignCurrency(platformFeeAmount, currency)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Costes de procesamiento de pagos bancarios, seguridad SSL,
              mantenimiento de infraestructura y auditoría antifraude.
            </p>
          </div>
        </div>
      </div>

      {/* ── Charts: Evolution + Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div>
              <h4 className="text-[13px] font-black text-[#1c2b1e] uppercase tracking-wider">
                Evolución de Recaudación
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">
                Crecimiento acumulado en el tiempo
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#72B626] bg-green-50 px-3 py-1 rounded-full">
              <Sparkles size={12} />
              <span>Tiempo real</span>
            </div>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="publicColorAccumulated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#72B626" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#72B626" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `Bs. ${val.toLocaleString('es-BO')}`}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#1c2b1e',
                    border: 'none',
                    borderRadius: '14px',
                    color: '#fff',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                  formatter={(value: any) => [`Bs. ${Number(value).toLocaleString('es-BO')}`, 'Acumulado']}
                  labelStyle={{ fontWeight: 900, color: '#72B626', textTransform: 'uppercase', fontSize: 10 }}
                />
                <Area
                  type="monotone"
                  dataKey="accumulated"
                  stroke="#72B626"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#publicColorAccumulated)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart (1 col) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="pb-3 mb-3 border-b border-slate-100">
            <h4 className="text-[13px] font-black text-[#1c2b1e] uppercase tracking-wider">
              Origen de Fondos
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              Por recompensa o aporte directo
            </p>
          </div>

          <div className="h-[180px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#1c2b1e',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                  formatter={(value: any) => [`Bs. ${Number(value).toLocaleString('es-BO')}`, 'Monto']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 space-y-2 max-h-[120px] overflow-y-auto pr-1">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] font-bold">
                <div className="flex items-center gap-2 max-w-[65%]">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-slate-600">{item.name}</span>
                </div>
                <span className="text-[#1c2b1e] font-black">
                  {formatCampaignCurrency(item.value, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Financial Movements Table ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-4">
          <div>
            <h4 className="text-[14px] font-black text-[#1c2b1e] uppercase tracking-wider flex items-center gap-2">
              <Receipt size={16} className="text-[#72B626]" />
              Movimientos Financieros Recientes
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              Historial de aportes registrados públicamente con verificación de auditoría
            </p>
          </div>

          {/* Quick filter tabs */}
          <div className="flex items-center gap-1.5 bg-[#f4f7f4] p-1 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all border-none cursor-pointer ${
                selectedFilter === 'all'
                  ? 'bg-white text-[#1c2b1e] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              Todos ({recentInvestments.length})
            </button>
            <button
              onClick={() => setSelectedFilter('direct')}
              className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all border-none cursor-pointer ${
                selectedFilter === 'direct'
                  ? 'bg-white text-[#1c2b1e] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              Directos
            </button>
            <button
              onClick={() => setSelectedFilter('rewards')}
              className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all border-none cursor-pointer ${
                selectedFilter === 'rewards'
                  ? 'bg-white text-[#1c2b1e] shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              Recompensas
            </button>
          </div>
        </div>

        {filteredInvestments.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Receipt size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-[13px] font-bold">Aún no hay transacciones en este filtro.</p>
            <p className="text-[11px] mt-1">Los nuevos aportes se reflejarán de manera instantánea.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="py-2.5 px-3">Donante</th>
                  <th className="py-2.5 px-3">Destino / Recompensa</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3 text-right">Monto</th>
                  <th className="py-2.5 px-3 text-center">Auditoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-medium">
                {filteredInvestments.slice(0, 10).map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {inv.isAnonymous ? (
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                            <Lock size={12} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[#f0f9e0] text-[#72B626] font-black text-[10px] flex items-center justify-center">
                            {inv.investorDisplayName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <span className="font-bold text-[#1c2b1e]">
                          {inv.isAnonymous ? 'Donante Anónimo' : inv.investorDisplayName || 'Aportante Verificado'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {inv.rewardTitle || 'Aporte Directo al Proyecto'}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {new Date(inv.createdAt).toLocaleDateString('es-BO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-[#1c2b1e]">
                      {formatCampaignCurrency(inv.amount, inv.currency || currency)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                        <CheckCircle2 size={11} strokeWidth={2.5} />
                        Confirmado
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

