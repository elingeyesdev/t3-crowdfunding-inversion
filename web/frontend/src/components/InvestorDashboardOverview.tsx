import type { CapitalOverview } from '../types/investor.types';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  Wallet, 
  HandCoins, 
  Heart, 
  ArrowRight,
  ArrowUpCircle,
} from 'lucide-react';

interface Props {
  data: CapitalOverview;
  onAddCapital?: () => void;
}

export function InvestorDashboardOverview({ data, onAddCapital }: Props) {
  const formatCurrency = (val: number) => {
    const formatted = new Intl.NumberFormat('es-BO', {
      maximumFractionDigits: 0,
    }).format(val);
    return `Bs. ${formatted}`;
  };

  const hasMaxConfigured = data.maxInvestmentLimit !== null;
  const availableCapital = data.availableCapital || 0;
  const isCapitalLow = hasMaxConfigured && data.maxInvestmentLimit! > 0 && (availableCapital / data.maxInvestmentLimit!) < 0.2;
  const isCapitalEmpty = hasMaxConfigured && availableCapital <= 0;

  const cardClass = "relative overflow-hidden bg-white/80 backdrop-blur-xl border border-white rounded-[20px] sm:rounded-[32px] p-3 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 sm:hover:-translate-y-1.5 transition-all duration-500 flex flex-col group";
  const labelClass = "text-[9px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest sm:mt-auto mt-1 text-center sm:text-left leading-tight group-hover:text-[#72B626] transition-colors";
  const valueClass = "text-[13px] sm:text-4xl font-black tracking-tighter mt-2 sm:mt-4 mb-0 sm:mb-2 text-center sm:text-left";
  const iconContainerClass = "w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-colors duration-500 mx-auto sm:mx-0";

  return (
    <div className="flex flex-col gap-4 sm:gap-6 font-['Plus Jakarta Sans',sans-serif]">
      <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-5">
        
        {/* Capital Disponible */}
        <div className={`${cardClass} col-span-1 sm:col-span-2 lg:col-span-2 pt-6 sm:pt-8`}>
          <div className="flex flex-col sm:flex-row sm:justify-between items-center sm:items-start relative z-10 w-full">
            <div className={`${iconContainerClass} bg-slate-50 text-slate-400 group-hover:bg-[#f0f9e0] group-hover:text-[#72B626]`}>
              <Wallet className="w-4 h-4 sm:w-6 sm:h-6" strokeWidth={2.5} />
            </div>
            {hasMaxConfigured && onAddCapital && (
              <button
                onClick={onAddCapital}
                className="absolute -top-4 -right-1 sm:relative sm:top-auto sm:right-auto w-6 h-6 sm:w-auto sm:h-auto sm:px-4 sm:py-2 bg-[#72B626] hover:bg-[#4a7f1a] text-white text-[12px] font-black uppercase tracking-widest transition-all border-none cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-sm rounded-full sm:rounded-xl"
                title="Aumentar Capital"
              >
                <ArrowUpCircle className="w-3.5 h-3.5 sm:w-[15px] sm:h-[15px]" strokeWidth={3} />
                <span className="hidden sm:inline">Aumentar Capital</span>
              </button>
            )}
          </div>
          
          <div className={`${valueClass} ${hasMaxConfigured ? (isCapitalEmpty ? 'text-red-600' : isCapitalLow ? 'text-amber-600' : 'text-[#1c2b1e]') : 'text-slate-300'}`}>
            {hasMaxConfigured ? formatCurrency(availableCapital) : 'N/D'}
          </div>
          <div className={labelClass}>Capital Disponible</div>
        </div>

        {/* Total Invertido */}
        <div className={cardClass}>
          <div className={`${iconContainerClass} bg-slate-50 text-slate-400 group-hover:bg-[#f0f9e0] group-hover:text-[#72B626]`}>
            <HandCoins className="w-4 h-4 sm:w-6 sm:h-6" strokeWidth={2.5} />
          </div>
          <div className={`${valueClass} text-[#1c2b1e]`}>
            {formatCurrency(data.totalInvested || 0)}
          </div>
          <div className={labelClass}>Total Donado</div>
        </div>

        {/* Donaciones */}
        <div className={cardClass}>
          <div className={`${iconContainerClass} bg-teal-50 text-teal-400 group-hover:bg-teal-100 group-hover:text-teal-600`}>
            <Heart className="w-4 h-4 sm:w-6 sm:h-6" strokeWidth={2.5} />
          </div>
          <div className={`${valueClass} text-[#1c2b1e]`}>
            {data.completedInvestments || 0}
          </div>
          <div className={labelClass}>Donaciones</div>
        </div>
      </div>

      {/* Alerta: Capital bajo o agotado */}
      {hasMaxConfigured && (isCapitalLow || isCapitalEmpty) && onAddCapital && (
        <div className={`${isCapitalEmpty ? 'bg-red-50/80 border-red-100' : 'bg-amber-50/80 border-amber-100'} backdrop-blur-md border p-6 rounded-[24px] flex items-center gap-5 animate-in slide-in-from-top-4 duration-700 shadow-sm`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isCapitalEmpty ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-[#f9a825]'}`}>
             <AlertTriangle size={24} strokeWidth={2.5} />
          </div> 
          <div className="flex-1">
            <h4 className={`text-lg font-black mb-1 ${isCapitalEmpty ? 'text-red-900' : 'text-amber-900'}`}>
              {isCapitalEmpty ? 'Capital Agotado' : 'Capital Bajo'}
            </h4>
            <div className={`text-[14px] ${isCapitalEmpty ? 'text-red-700' : 'text-amber-700'} font-medium`}>
              {isCapitalEmpty 
                ? 'Necesitas agregar más fondos para continuar donando.'
                : 'Tienes menos del 20% de tu límite. Considera agregar más fondos.'
              }
            </div>
          </div>
        </div>
      )}

      {/* Alerta: Sin max configurado */}
      {!hasMaxConfigured && (
        <div className="bg-[#1c2b1e] border border-[#1c2b1e] p-6 rounded-[24px] flex flex-col sm:flex-row sm:items-center gap-5 animate-in slide-in-from-top-4 duration-700 shadow-xl shadow-[#1c2b1e]/20/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#72B626]/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#a8d97c] shrink-0 border border-white/5 relative z-10">
             <AlertTriangle size={24} strokeWidth={2.5} />
          </div> 
          <div className="flex-1 relative z-10">
            <h4 className="text-lg font-black text-white mb-1">Perfil Incompleto</h4>
            <div className="text-[14px] text-[#f0f9e0]/70 font-medium">
              No has configurado tu monto máximo de donación para calcular el capital disponible.
            </div>
          </div>
          <Link to="/profile" className="shrink-0 px-6 py-3 rounded-xl bg-[#72B626] hover:bg-[#72B626] text-white text-[13px] font-black uppercase tracking-widest transition-all border-none cursor-pointer flex items-center justify-center gap-2 active:scale-95 no-underline relative z-10">
            Configurar Ahora
            <ArrowRight size={16} strokeWidth={3} />
          </Link>
        </div>
      )}
    </div>
  );
}

