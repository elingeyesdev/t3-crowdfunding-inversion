import { Info } from 'lucide-react';

interface Props {
  text: string;
}

export function InfoHint({ text }: Props) {
  return (
    <span className="group relative inline-flex items-center">
      <Info size={14} className="text-slate-400 hover:text-[#72B626] cursor-help transition-colors" />
      <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}
