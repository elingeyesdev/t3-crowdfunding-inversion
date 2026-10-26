import {
  clampPercentForBar,
  computeFundingPercent,
  formatFundingPercent,
} from '../utils/campaignFunding';

interface Props {
  currentAmount: number;
  goalAmount: number;
}

const R = 54;
const STROKE = 9;
const C = 2 * Math.PI * R;

export function CircularFundingRing({ currentAmount, goalAmount }: Props) {
  const fillPct = clampPercentForBar(computeFundingPercent(currentAmount, goalAmount));
  const labelPct = formatFundingPercent(currentAmount, goalAmount);
  const dashOffset = C * (1 - fillPct / 100);

  return (
    <div
      className="relative flex items-center justify-center w-36 h-36 font-['Plus Jakarta Sans',sans-serif]"
      role="img"
      aria-label={`Financiación al ${labelPct} por ciento de la meta`}
    >
      <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 140 140" aria-hidden>
        <defs>
          <linearGradient id="previewRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#72B626" />
            <stop offset="100%" stopColor="#aed581" />
          </linearGradient>
        </defs>
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={STROKE}
        />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="url(#previewRingGrad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-black text-slate-900 leading-none">{labelPct}%</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Meta</span>
      </div>
    </div>
  );
}
