import { useMemo } from 'react';
import {
  PieChart as PieIcon,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Layers,
  Info,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { formatCampaignCurrency } from '../../../utils/campaignFunding';

interface Props {
  goalAmount: number;
  currentAmount: number;
  currency?: string;
  customPlan?: Array<{
    category: string;
    percentage: number;
    description: string;
  }>;
}

interface BudgetItem {
  category: string;
  percentage: number;
  description: string;
  plannedAmount: number;
  executedAmount: number;
  status: 'completado' | 'en_progreso' | 'programado';
  color: string;
  bgLight: string;
}

const DEFAULT_BUDGET_CATEGORIES = [
  {
    category: 'Producción y Desarrollo Técnico',
    percentage: 40,
    description: 'Fabricación del producto, mano de obra especializada e implementación del prototipo industrial.',
    color: '#72B626',
    bgLight: 'bg-[#f0f9e0]',
  },
  {
    category: 'Materia Prima e Insumos',
    percentage: 25,
    description: 'Adquisición de materiales certificados, suministros y componentes esenciales de proveedores locales.',
    color: '#3b82f6',
    bgLight: 'bg-blue-50',
  },
  {
    category: 'Empaque, Logística y Distribución',
    percentage: 15,
    description: 'Costes de embalaje ecológico, transporte y envíos de recompensas a los donantes.',
    color: '#f59e0b',
    bgLight: 'bg-amber-50',
  },
  {
    category: 'Auditoría, Licencias y Calidad',
    percentage: 10,
    description: 'Ensayos de laboratorio, registro legal, certificaciones de seguridad y fiscalización.',
    color: '#8b5cf6',
    bgLight: 'bg-purple-50',
  },
  {
    category: 'Comisión de Plataforma y Pasarela',
    percentage: 5,
    description: 'Tarifas operativas del sistema, mantenimiento tecnológico y procesamiento bancario seguro.',
    color: '#64748b',
    bgLight: 'bg-slate-100',
  },
  {
    category: 'Fondo de Reserva y Contingencias',
    percentage: 5,
    description: 'Margen de seguridad para absorber imprevistos de mercado o variaciones de precios.',
    color: '#06b6d4',
    bgLight: 'bg-cyan-50',
  },
];

export function FundAllocationPlan({
  goalAmount,
  currentAmount,
  currency = 'BOB',
  customPlan,
}: Props) {
  const fundingRate = goalAmount > 0 ? Math.min(1, currentAmount / goalAmount) : 0;

  const budgetItems: BudgetItem[] = useMemo(() => {
    const baseList = customPlan && customPlan.length > 0
      ? customPlan.map((item, idx) => ({
          ...item,
          color: DEFAULT_BUDGET_CATEGORIES[idx % DEFAULT_BUDGET_CATEGORIES.length].color,
          bgLight: DEFAULT_BUDGET_CATEGORIES[idx % DEFAULT_BUDGET_CATEGORIES.length].bgLight,
        }))
      : DEFAULT_BUDGET_CATEGORIES;

    // Distribute executed amount progressively across categories
    let remainingCollected = currentAmount;

    return baseList.map((item) => {
      const plannedAmount = Math.round((goalAmount * item.percentage) / 100);
      let executedAmount = 0;

      if (remainingCollected >= plannedAmount) {
        executedAmount = plannedAmount;
        remainingCollected -= plannedAmount;
      } else if (remainingCollected > 0) {
        executedAmount = remainingCollected;
        remainingCollected = 0;
      }

      let status: 'completado' | 'en_progreso' | 'programado' = 'programado';
      if (executedAmount >= plannedAmount && plannedAmount > 0) {
        status = 'completado';
      } else if (executedAmount > 0) {
        status = 'en_progreso';
      }

      return {
        ...item,
        plannedAmount,
        executedAmount,
        status,
      };
    });
  }, [goalAmount, currentAmount, customPlan]);

  const totalPlanned = budgetItems.reduce((acc, curr) => acc + curr.plannedAmount, 0);

  return (
    <div className="space-y-6 font-['Plus Jakarta Sans',sans-serif]">
      {/* Header card with summary */}
      <div className="bg-white rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 border border-green-50 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-green-50 text-[#72B626] text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck size={14} strokeWidth={2.5} />
                Presupuesto y Destino de Recursos
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-[#1c2b1e] tracking-tight">
              Plan de Utilización de Fondos
            </h3>
            <p className="text-[13px] sm:text-[14px] text-slate-500 font-medium mt-1 max-w-2xl leading-relaxed">
              El emprendedor ha estructurado el uso de cada boliviano recaudado en partidas
              presupuestarias fiscalizables. Los fondos se van asignando conforme avanza la recaudación.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#f4f7f4] rounded-2xl p-4 shrink-0 border border-green-100/60">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-[#72B626] shadow-sm">
              <DollarSign size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Presupuesto Total
              </p>
              <p className="text-xl font-black text-[#1c2b1e]">
                {formatCampaignCurrency(totalPlanned, currency)}
              </p>
              <p className="text-[11px] font-bold text-[#72B626]">
                {Math.round(fundingRate * 100)}% Fondeficado
              </p>
            </div>
          </div>
        </div>

        {/* Multi-colored composite progress bar */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <div className="flex justify-between text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
            <span>Distribución Porcentual del Presupuesto</span>
            <span>100% de la Meta</span>
          </div>
          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            {budgetItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  width: `${item.percentage}%`,
                  backgroundColor: item.color,
                }}
                className="h-full transition-all relative group cursor-pointer"
                title={`${item.category}: ${item.percentage}% (${formatCampaignCurrency(item.plannedAmount, currency)})`}
              />
            ))}
          </div>

          {/* Quick legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
            {budgetItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span>{item.percentage}%</span>
                <span className="text-slate-400 hidden sm:inline">{item.category}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Category Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgetItems.map((item, idx) => {
          const itemProgress = item.plannedAmount > 0
            ? Math.min(100, Math.round((item.executedAmount / item.plannedAmount) * 100))
            : 0;

          return (
            <div
              key={idx}
              className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:border-green-200 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <h4 className="font-black text-[14px] text-[#1c2b1e] leading-snug">
                      {item.category}
                    </h4>
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 ${
                      item.status === 'completado'
                        ? 'bg-emerald-50 text-emerald-700'
                        : item.status === 'en_progreso'
                        ? 'bg-blue-50 text-blue-700 animate-pulse'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.status === 'completado'
                      ? 'Fondos Asegurados'
                      : item.status === 'en_progreso'
                      ? 'En Fondeo'
                      : 'Programado'}
                  </span>
                </div>

                <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
                  {item.description}
                </p>
              </div>

              <div>
                {/* Financial bar */}
                <div className="flex items-center justify-between text-[11px] font-black mb-1.5">
                  <span className="text-slate-400 uppercase tracking-wider">
                    {item.percentage}% del total
                  </span>
                  <span className="text-[#1c2b1e]">
                    {formatCampaignCurrency(item.executedAmount, currency)} /{' '}
                    <span className="text-slate-400">
                      {formatCampaignCurrency(item.plannedAmount, currency)}
                    </span>
                  </span>
                </div>

                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${itemProgress}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Transparency Guarantee Note */}
      <div className="bg-[#f0f9e0]/60 border border-[#72B626]/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
        <div className="w-8 h-8 rounded-xl bg-[#72B626] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
          <Info size={16} strokeWidth={2.5} />
        </div>
        <div className="text-[12px] sm:text-[13px] text-slate-700 leading-relaxed">
          <p className="font-black text-[#1c2b1e] mb-0.5">
            Garantía de Auditoría y Trazabilidad de UniFundMe
          </p>
          Los fondos recaudados no se transfieren en su totalidad de forma inmediata. Se liberan
          por tramos vinculados al cumplimiento de hitos y presentación de evidencias aprobadas por
          auditoría para proteger la inversión colectiva.
        </div>
      </div>
    </div>
  );
}

