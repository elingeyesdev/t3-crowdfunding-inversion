import { ProgressBar } from './ProgressBar';
import {
  clampPercentForBar,
  computeFundingPercent,
  formatFundingPercent,
} from '../utils/campaignFunding';

interface Props {
  currentAmount: number;
  goalAmount: number;
}

export function CampaignProgress({ currentAmount, goalAmount }: Props) {
  const rawPercent = computeFundingPercent(currentAmount, goalAmount);
  const barWidth = clampPercentForBar(rawPercent);
  const labelPercent = formatFundingPercent(currentAmount, goalAmount);

  return (
    <div className="flex flex-col gap-3 font-['Plus Jakarta Sans',sans-serif]">
      <ProgressBar value={barWidth} />
      <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest leading-none">
        <span className="text-[#72B626]">{labelPercent}% Recaudado</span>
      </div>
    </div>
  );
}
