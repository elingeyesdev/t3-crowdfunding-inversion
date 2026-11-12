import { formatCampaignCurrency } from '../utils/campaignFunding';
import { Calendar, Users } from 'lucide-react';

interface Props {
  currentAmount: number;
  goalAmount: number;
  currency: string;
  endDate?: string | null;
  investorCount?: number;
}

export function CampaignStats({ currentAmount, goalAmount, currency, endDate, investorCount }: Props) {
  const rowClass = "flex justify-between items-center py-1 font-['Plus Jakarta Sans',sans-serif]";
  const labelClass = "text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5";
  const valueClass = "text-[13px] font-bold text-slate-900";

  let daysRemaining: number | null = null;
  if (endDate) {
    const ms = new Date(endDate).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="flex flex-col gap-1">
      <div className={rowClass}>
        <span className={labelClass}>Recaudado</span>
        <span className={`${valueClass} text-[#72B626]`}>{formatCampaignCurrency(currentAmount, currency)}</span>
      </div>
      <div className={rowClass}>
        <span className={labelClass}>Meta Objetivo</span>
        <span className={valueClass}>{formatCampaignCurrency(goalAmount, currency)}</span>
      </div>
      {investorCount !== undefined && (
        <div className={rowClass}>
          <span className={labelClass}>
            <Users size={12} strokeWidth={2.5} />
            Donadores
          </span>
          <span className={valueClass}>{investorCount}</span>
        </div>
      )}
      {endDate !== undefined && (
        <div className={rowClass}>
          <span className={labelClass}>
            <Calendar size={12} strokeWidth={2.5} />
            Días Restantes
          </span>
          <span className={valueClass}>
            {daysRemaining !== null ? (daysRemaining > 0 ? daysRemaining : 'Finalizada') : '∞'}
          </span>
        </div>
      )}
    </div>
  );
}
