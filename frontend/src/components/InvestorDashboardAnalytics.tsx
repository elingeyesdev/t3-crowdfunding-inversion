import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip
} from 'recharts';
import {
  TrendingUp,
  RefreshCw,
  HeartHandshake
} from 'lucide-react';
import type { CapitalOverview } from '../types/investor.types';
import type { InvestmentHistoryItem } from '../api/investor.api';

interface Props {
  data: CapitalOverview;
  investments: InvestmentHistoryItem[];
}

export function InvestorDashboardAnalytics({ data: _data, investments }: Props) {
  // Formateador de moneda
  const formatCurrency = (val: number) => {
    const formatted = new Intl.NumberFormat('es-BO', {
      maximumFractionDigits: 0,
    }).format(val);
    return `Bs. ${formatted}`;
  };

  // 1. Cálculos de Métricas Financieras
  const metrics = useMemo(() => {
    const completed = investments.filter(inv => inv.investmentStatus === 'completed');
    
    // Ticket Promedio
    const avg = completed.length > 0 
      ? completed.reduce((sum, inv) => sum + inv.amount, 0) / completed.length
      : 0;

    // Total Reembolsado (All-or-Nothing)
    const refunded = investments.filter(inv => inv.investmentStatus === 'refunded' || inv.investmentStatus === 'partially_refunded');
    const totalRefundedAmt = refunded.reduce((sum, inv) => sum + inv.amount, 0);

    return {
      avg,
      totalRefundedAmt
    };
  }, [investments]);

  // 2. Gráfico de evolución acumulada
  const timelineData = useMemo(() => {
    const completed = [...investments]
      .filter(inv => inv.investmentStatus === 'completed')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    let cumulativeSum = 0;
    return completed.map(inv => {
      cumulativeSum += inv.amount;
      return {
        date: new Date(inv.createdAt).toLocaleDateString('es', { month: 'short', day: 'numeric' }),
        monto: inv.amount,
        acumulado: cumulativeSum,
        campaign: inv.campaignTitle
      };
    });
  }, [investments]);

  const cardClass = "relative overflow-hidden bg-white/80 backdrop-blur-xl border border-white rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_15px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col group";
  const labelClass = "text-[11px] font-black text-slate-400 uppercase tracking-widest mt-auto group-hover:text-[#72B626] transition-colors";
  const valueClass = "text-2xl font-black text-[#1c2b1e] tracking-tighter mt-4 mb-1";

  // Si no hay inversiones completadas
  const hasCompletedInvestments = investments.some(inv => inv.investmentStatus === 'completed');

  if (!hasCompletedInvestments) {
    return (
      <div className="bg-white/80 backdrop-blur-xl border border-white rounded-[32px] p-12 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-['Plus Jakarta Sans',sans-serif]">
        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mx-auto mb-6">
          <HeartHandshake size={32} />
        </div>
        <h3 className="text-xl font-black text-[#1c2b1e] tracking-tight mb-2">Comienza tu viaje de donación</h3>
        <p className="text-[14px] text-slate-400 font-medium max-w-sm mx-auto mb-6">
          Una vez que realices tu primera donación, verás gráficos interactivos y análisis de tu impacto social aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 font-['Plus Jakarta Sans',sans-serif] animate-in fade-in duration-500">
      
      {/* ── METRICS GRID ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        
        {/* Ticket Promedio */}
        <div className={cardClass}>
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#f0f9e0] group-hover:text-[#72B626] transition-colors duration-300">
            <TrendingUp size={20} strokeWidth={2.5} />
          </div>
          <div className={valueClass}>
            {formatCurrency(metrics.avg)}
          </div>
          <div className={labelClass}>Aporte Promedio</div>
        </div>

        {/* Reembolsado (All or Nothing) */}
        <div className={cardClass}>
          <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-red-50 group-hover:text-red-500 transition-colors duration-300">
            <RefreshCw size={20} strokeWidth={2.5} />
          </div>
          <div className={`${valueClass} ${metrics.totalRefundedAmt > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
            {formatCurrency(metrics.totalRefundedAmt)}
          </div>
          <div className={labelClass}>Capital Recuperado</div>
        </div>

      </div>

      {/* ── CHARTS ROW ── */}
      <div className="w-full">
        
        {/* Gráfico de Evolución Temporal (acumulado) */}
        <div className="w-full bg-white/80 backdrop-blur-xl border border-white rounded-[32px] p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <h3 className="text-[14px] font-black text-[#1c2b1e] uppercase tracking-wider">Evolución de Aportes</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Crecimiento del capital invertido acumulado</p>
            </div>
          </div>

          <div className="flex-1 min-h-[260px] w-full">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInvestorAccumulated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#72B626" stopOpacity={0.25} />
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
                    borderRadius: '16px',
                    color: '#fff',
                    fontFamily: "'Plus Jakarta Sans', sans-serif"
                  }}
                  formatter={(value: any, _name: any, props: any) => [
                    `Bs. ${value.toLocaleString('es-BO')}`, 
                    `Acumulado (${props.payload.campaign})`
                  ]}
                  labelStyle={{ fontWeight: 900, color: '#72B626', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.1em' }}
                />
                <Area
                  type="monotone"
                  dataKey="acumulado"
                  stroke="#72B626"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorInvestorAccumulated)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
