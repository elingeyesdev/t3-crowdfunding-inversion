import {
  CheckCircle2,
  Clock,
  Rocket,
  ShieldCheck,
  AlertCircle,
  Flag,
  Calendar,
  Layers,
} from 'lucide-react';
import { formatCampaignCurrency } from '../../../utils/campaignFunding';

interface MilestoneItem {
  id: string;
  percentage: number;
  title: string;
  description: string;
  targetAmount: number;
  status: 'completed' | 'in_progress' | 'pending';
  estimatedDate?: string;
  deliverables?: string[];
}

interface Props {
  goalAmount: number;
  currentAmount: number;
  currency?: string;
  customMilestones?: any[];
}

export function ProjectMilestones({
  goalAmount,
  currentAmount,
  currency = 'BOB',
  customMilestones,
}: Props) {
  const currentPercentage = goalAmount > 0
    ? Math.round((currentAmount / goalAmount) * 1000) / 10
    : 0;

  const defaultMilestones: MilestoneItem[] = [
    {
      id: 'm1',
      percentage: 25,
      title: 'Hito 1: Inicio de Operaciones y Adquisición de Insumos',
      description: 'Compra de materia prima inicial, adecuación de infraestructura y configuración del taller operativo.',
      targetAmount: Math.round(goalAmount * 0.25),
      status: currentPercentage >= 25 ? 'completed' : 'in_progress',
      deliverables: ['Contratos con proveedores locales', 'Facturas de compra de insumos base', 'Reporte fotográfico de arranque'],
    },
    {
      id: 'm2',
      percentage: 50,
      title: 'Hito 2: Prototipado y Validación de Pruebas de Calidad',
      description: 'Ensamblaje del lote beta, testeos de laboratorio y certificación preliminar de rendimiento.',
      targetAmount: Math.round(goalAmount * 0.5),
      status: currentPercentage >= 50 ? 'completed' : currentPercentage >= 25 ? 'in_progress' : 'pending',
      deliverables: ['Certificado de conformidad técnica', 'Ficha técnica de laboratorio', 'Video demostrativo de validación'],
    },
    {
      id: 'm3',
      percentage: 75,
      title: 'Hito 3: Producción en Escala y Empaquetado Ecológico',
      description: 'Fabricación del lote principal, etiquetado y preparación de los kits de recompensas para donantes.',
      targetAmount: Math.round(goalAmount * 0.75),
      status: currentPercentage >= 75 ? 'completed' : currentPercentage >= 50 ? 'in_progress' : 'pending',
      deliverables: ['Inventario del lote manufacturado', 'Empaques biodegradables listos', 'Bitácora de producción firmada'],
    },
    {
      id: 'm4',
      percentage: 100,
      title: 'Hito 4: Auditoría de Cierre, Despacho y Entrega',
      description: 'Envío de recompensas físicas a los inversionistas, publicación del balance de cierre y reporte final.',
      targetAmount: goalAmount,
      status: currentPercentage >= 100 ? 'completed' : currentPercentage >= 75 ? 'in_progress' : 'pending',
      deliverables: ['Guías de despacho y números de seguimiento', 'Informe financiero final de fondos', 'Acta de conformidad de entrega'],
    },
  ];

  const milestones: MilestoneItem[] = customMilestones && customMilestones.length > 0
    ? customMilestones.map((m, idx) => {
        const pct = m.percentage || (idx + 1) * 25;
        let st: 'completed' | 'in_progress' | 'pending' = 'pending';
        if (currentPercentage >= pct) st = 'completed';
        else if (idx === 0 || currentPercentage >= (customMilestones[idx - 1]?.percentage || 0)) st = 'in_progress';

        return {
          id: m.id || `m-${idx}`,
          percentage: pct,
          title: m.title || `Hito ${idx + 1}`,
          description: m.description || '',
          targetAmount: Math.round((goalAmount * pct) / 100),
          status: st,
          deliverables: m.deliverables || [],
        };
      })
    : defaultMilestones;

  return (
    <div className="space-y-6 font-['Plus Jakarta Sans',sans-serif]">
      {/* Header card */}
      <div className="bg-white rounded-[24px] sm:rounded-[28px] p-6 sm:p-8 border border-green-50 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-green-50 text-[#72B626] text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <Rocket size={14} strokeWidth={2.5} />
                Hoja de Ruta y Entregables
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-[#1c2b1e] tracking-tight">
              Hitos de Ejecución del Proyecto
            </h3>
            <p className="text-[13px] sm:text-[14px] text-slate-500 font-medium mt-1 max-w-2xl leading-relaxed">
              Cada hito representa una fase concreta del proyecto respaldada con entregables
              verificables y metas de recaudación requeridas para su ejecución.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#f4f7f4] rounded-2xl p-4 shrink-0 border border-green-100/60">
            <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-[#72B626] shadow-sm">
              <Flag size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Avance General
              </p>
              <p className="text-xl font-black text-[#1c2b1e]">
                {currentPercentage}%
              </p>
              <p className="text-[11px] font-bold text-[#72B626]">
                {milestones.filter((m) => m.status === 'completed').length} de {milestones.length} Hitos Cumplidos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="space-y-4">
        {milestones.map((milestone, idx) => {
          const isCompleted = milestone.status === 'completed';
          const isInProgress = milestone.status === 'in_progress';

          return (
            <div
              key={milestone.id}
              className={`bg-white rounded-2xl p-5 sm:p-6 border transition-all ${
                isCompleted
                  ? 'border-emerald-200/80 shadow-sm'
                  : isInProgress
                  ? 'border-[#72B626] ring-2 ring-[#72B626]/10 shadow-md'
                  : 'border-slate-100 opacity-80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                        : isInProgress
                        ? 'bg-[#72B626] text-white shadow-sm shadow-green-500/20 animate-pulse'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={20} strokeWidth={2.5} />
                    ) : (
                      <span className="font-black text-[13px]">{idx + 1}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Umbral de Financiamiento: {milestone.percentage}%
                    </span>
                    <h4 className="font-black text-[15px] sm:text-[16px] text-[#1c2b1e] leading-snug">
                      {milestone.title}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[12px] font-black text-slate-700 bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">
                    Meta: {formatCampaignCurrency(milestone.targetAmount, currency)}
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                      isCompleted
                        ? 'bg-emerald-50 text-emerald-700'
                        : isInProgress
                        ? 'bg-green-50 text-[#72B626]'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isCompleted
                      ? 'Hito Cumplido'
                      : isInProgress
                      ? 'Fase en Marcha'
                      : 'Próxima Fase'}
                  </span>
                </div>
              </div>

              <p className="text-[13px] text-slate-600 leading-relaxed pl-0 sm:pl-12 mb-4">
                {milestone.description}
              </p>

              {/* Deliverables checklist */}
              {milestone.deliverables && milestone.deliverables.length > 0 && (
                <div className="pl-0 sm:pl-12 pt-3 border-t border-slate-100">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-[#72B626]" />
                    Entregables y Evidencias Requeridas:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {milestone.deliverables.map((deliv, dIdx) => (
                      <div
                        key={dIdx}
                        className="flex items-center gap-2 bg-[#f4f7f4] rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700"
                      >
                        <div
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isCompleted ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        />
                        <span className="truncate">{deliv}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

