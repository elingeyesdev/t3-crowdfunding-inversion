import { useMemo } from 'react';
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
  Cell
} from 'recharts';
import {
  TrendingUp,
  Clock,
  Sparkles,
  PieChart as PieIcon,
  ShieldCheck,
  Zap,
  CheckCircle2
} from 'lucide-react';
import type { CampaignFinancialProgress } from '../types/campaign.types';
import { formatCampaignCurrency } from '../utils/campaignFunding';

interface Props {
  finance: CampaignFinancialProgress | null;
  campaignType?: string;
  startDate?: string | Date | null;
  createdAt?: string | Date | null;
}

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

export function CampaignAnalyticsDashboard({ finance, startDate, createdAt }: Props) {
  if (!finance) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-[32px] border border-slate-100 shadow-sm text-center min-h-[300px]">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 animate-pulse mb-4">
          <TrendingUp size={24} />
        </div>
        <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Cargando Estadísticas Económicas...</p>
      </div>
    );
  }

  const {
    currentAmount,
    goalAmount,
    currency = 'BOB',
    dailyProgress = [],
    fundingBreakdown = [],
    investorCount
  } = finance;

  // 1. Calculador de Proyección Inteligente
  const projection = useMemo(() => {
    if (currentAmount >= goalAmount) {
      return { status: 'success', text: '¡Meta 100% alcanzada exitosamente!', days: 0 };
    }

    const startVal = startDate || createdAt || new Date();
    const startMs = new Date(startVal).getTime();
    const elapsedMs = Date.now() - startMs;
    const daysElapsed = Math.max(1, Math.ceil(elapsedMs / (1000 * 60 * 60 * 24)));

    // Tasa de recaudación diaria promedio
    const dailyRate = currentAmount / daysElapsed;

    if (dailyRate <= 0) {
      return {
        status: 'insufficient_data',
        text: 'Aportes iniciales requeridos para proyectar fecha de éxito.',
        days: null
      };
    }

    const remainingAmount = goalAmount - currentAmount;
    const projectedDays = Math.ceil(remainingAmount / dailyRate);

    return {
      status: 'active',
      text: `A este ritmo alcanzarás el 100% en aproximadamente ${projectedDays} días`,
      days: projectedDays,
      dailyRate
    };
  }, [currentAmount, goalAmount, startDate, createdAt]);

  // 2. Gráfico de Evolución Temporal (acumulado diario)
  const chartData = useMemo(() => {
    if (dailyProgress.length === 0) {
      // Si no hay aportes, mostrar un punto inicial en 0
      const initialDate = startDate ? new Date(startDate) : new Date();
      const formattedDate = initialDate.toLocaleDateString('es', { day: 'numeric', month: 'short' });
      return [{ date: formattedDate, accumulated: 0 }];
    }

    return dailyProgress.map((p) => {
      const formattedDate = new Date(p.date).toLocaleDateString('es', {
        day: 'numeric',
        month: 'short'
      });
      return {
        date: formattedDate,
        accumulated: p.accumulatedAmount
      };
    });
  }, [dailyProgress, startDate]);

  // 3. Desglose de Fuentes de Financiamiento (Donut Chart)
  const pieData = useMemo(() => {
    if (fundingBreakdown.length === 0) {
      return [{ name: 'Sin Aportes', value: 100, color: '#e2e8f0' }];
    }

    // Filtrar los que tengan aportes para no saturar el gráfico
    return fundingBreakdown
      .filter((b) => b.totalAmount > 0)
      .map((b, idx) => ({
        name: b.rewardTitle,
        value: b.totalAmount,
        color: PIE_COLORS[idx % PIE_COLORS.length]
      }));
  }, [fundingBreakdown]);

  return (
    <div className="space-y-8 font-['Plus Jakarta Sans',sans-serif]">
      {/* ── TOP SECTION: PROJECTION WIDGET ── */}
      <div className="bg-white rounded-[32px] border border-slate-100 p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Decorative background aura */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-50 rounded-full blur-[100px] -mr-32 -mt-32 opacity-60 pointer-events-none" />
        
        <div className="flex items-center gap-5 relative z-10">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ring-4 ${
            projection.status === 'success'
              ? 'bg-green-50 text-emerald-600 ring-green-500/10'
              : projection.status === 'active'
                ? 'bg-indigo-50 text-indigo-600 ring-indigo-500/10 animate-pulse'
                : 'bg-amber-50 text-amber-600 ring-amber-500/10'
          }`}>
            {projection.status === 'success' ? (
              <CheckCircle2 size={26} strokeWidth={2.5} />
            ) : projection.status === 'active' ? (
              <Zap size={26} strokeWidth={2.5} />
            ) : (
              <Clock size={26} strokeWidth={2.5} />
            )}
          </div>
          <div>
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
              Proyección de Éxito Inteligente
            </h4>
            <p className="text-[#1c2b1e] text-[16px] md:text-[18px] font-black tracking-tight leading-snug">
              {projection.text}
            </p>
            {projection.status === 'active' && projection.dailyRate && (
              <p className="text-[12px] text-slate-400 font-bold mt-1">
                Tasa de recaudación diaria: <span className="text-indigo-600">{formatCampaignCurrency(projection.dailyRate, currency)}</span> / día
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 w-full md:w-auto flex items-center justify-end relative z-10">
          {projection.status === 'active' && projection.days !== null && (
            <div className="bg-indigo-600/5 border border-indigo-100 rounded-2xl px-6 py-3.5 text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Estimación</span>
              <span className="text-2xl font-black text-indigo-600 tracking-tight">~ {projection.days} días</span>
            </div>
          )}
          {projection.status === 'success' && (
            <div className="bg-emerald-600/5 border border-green-100 rounded-2xl px-6 py-3.5 text-center">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-1">Meta</span>
              <span className="text-2xl font-black text-emerald-600 tracking-tight">100% Alcanzado</span>
            </div>
          )}
        </div>
      </div>

      {/* ── CHARTS CONTAINER: GRID LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution temporal chart (takes 2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-slate-100 p-6 md:p-8 shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 text-[#72B626] flex items-center justify-center">
                <TrendingUp size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[14px] font-black text-[#1c2b1e] uppercase tracking-wider">Evolución de Recaudación</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Crecimiento acumulado día a día</p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAccumulated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
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
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '16px',
                    color: '#fff',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}
                  formatter={(value: any) => [`Bs. ${value.toLocaleString('es-BO')}`, 'Total Acumulado']}
                  labelStyle={{ fontWeight: 900, color: '#10b981', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.1em' }}
                />
                <Area
                  type="monotone"
                  dataKey="accumulated"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorAccumulated)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funding sources breakdown donut chart */}
        <div className="bg-white rounded-[32px] border border-slate-100 p-6 md:p-8 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <PieIcon size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-[14px] font-black text-[#1c2b1e] uppercase tracking-wider">Desglose de Ingresos</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  Distribución por Recompensas
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center min-h-[220px]">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#fff',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}
                  formatter={(value: any) => [
                    `Bs. ${value.toLocaleString('es-BO')}`,
                    'Valor'
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Custom Legend */}
            <div className="w-full mt-4 space-y-2.5 max-h-[140px] overflow-y-auto pr-1">
              {pieData.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <div className="flex items-center gap-2 max-w-[70%]">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="truncate leading-none">{entry.name}</span>
                  </div>
                  <span className="text-slate-900 font-black">
                    {formatCampaignCurrency(entry.value, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM STATS ROW: AUDIT INFO ── */}
      <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 border border-slate-100 rounded-[24px] p-5 gap-4">
        <div className="flex items-center gap-3 text-slate-500">
          <ShieldCheck size={18} className="text-green-500" />
          <span className="text-[11px] font-black uppercase tracking-wider">Metas Económicas Reguladas en Tiempo Real</span>
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-4 py-2 shadow-sm text-[11px] font-bold text-slate-600">
          <Sparkles size={13} className="text-amber-500" />
          <span>Sincronizado con {investorCount || 0} donaciones confirmadas</span>
        </div>
      </div>
    </div>
  );
}
