export type ProgressBarTone = 'low' | 'mid' | 'high' | 'complete';

export function progressToneFromPercent(clampedPercent: number): ProgressBarTone {
  if (clampedPercent >= 100) return 'complete';
  if (clampedPercent >= 75) return 'high';
  if (clampedPercent >= 25) return 'mid';
  return 'low';
}

export interface Milestone {
  percentage: number;
  label: string;
}

interface Props {
  /** Visual fill width 0–100 (should be pre-clamped). */
  value: number;
  tone?: ProgressBarTone | 'auto';
  className?: string;
  trackClassName?: string;
  milestones?: Milestone[];
}

export function ProgressBar({ value, tone = 'auto', className, trackClassName, milestones }: Props) {
  const safe = Number.isFinite(value) ? Math.min(Math.max(value, 0), 100) : 0;
  const resolvedTone: ProgressBarTone =
    tone === 'auto' ? progressToneFromPercent(safe) : tone;

  const toneClasses = {
    low: 'bg-gradient-to-r from-slate-300 to-slate-400',
    mid: 'bg-gradient-to-r from-[#aed581] to-[#72B626]', // Lima a Verde
    high: 'bg-gradient-to-r from-[#72B626] to-[#72B626]', // Verde a Esmeralda
    complete: 'bg-gradient-to-r from-[#72B626] to-[#72B626] shadow-[0_0_12px_rgba(46,125,50,0.3)]',
  };

  return (
    <div className="relative w-full py-1">
      {/* Progress Track */}
      <div
        className={`h-2.5 w-full bg-slate-100/80 rounded-full overflow-hidden relative ${trackClassName ?? ''}`.trim()}
        role="progressbar"
        aria-valuenow={Math.round(safe)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso ${Math.round(safe)} por ciento`}
      >
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${toneClasses[resolvedTone]} ${className ?? ''}`.trim()}
          style={{ width: `${safe}%` }}
        />
      </div>

      {/* Markers / Milestones */}
      {milestones && milestones.length > 0 && (
        <div className="absolute inset-x-0 top-1 h-2.5 pointer-events-none">
          {milestones.map((m, idx) => {
            const isReached = safe >= m.percentage;
            return (
              <div
                key={idx}
                className="absolute top-1/2 -translate-y-1/2 group pointer-events-auto"
                style={{ left: `${m.percentage}%`, transform: 'translate(-50%, -50%)' }}
              >
                {/* Tick dot */}
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 cursor-pointer shadow-[0_2px_4px_rgba(0,0,0,0.1)] ${
                    isReached
                      ? 'bg-green-500 border-white scale-110 shadow-green-500/20'
                      : 'bg-slate-300 border-white hover:bg-slate-400 hover:scale-105'
                  }`}
                />

                {/* Tooltip Popup */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#0f172a] text-white text-[10px] font-black uppercase tracking-wider py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap shadow-xl z-50">
                  <span className="text-emerald-400 mr-1">{m.percentage}%</span> {m.label}
                  {/* Triangle tooltip tail */}
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-4 border-transparent"
                    style={{ borderTopColor: '#0f172a' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
