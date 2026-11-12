import { useEffect } from 'react';
import type { RewardTier } from '../../api/public-campaigns.api';
import {
  X,
  ShieldCheck,
  DollarSign,
  Gift,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Heart,
} from 'lucide-react';

/* ── Types ── */
interface CampaignSummary {
  title: string;
  campaignType: string;
  entrepreneurName?: string;
  coverImageUrl?: string;
  currency?: string;
  status?: string;
  location?: string;
  endDate?: string;
  shortDescription?: string;
}

interface ContributionConfirmModalProps {
  campaign: CampaignSummary;
  amount: number;
  selectedTier: RewardTier | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/* ── Campaign type badge ── */
const DONATION_LABEL = { label: 'Donación', icon: Heart, color: '#e91e63', bgColor: '#fce4ec' };

/* ───────────────────────────────────────────────── */
/*  MODAL COMPONENT                                  */
/* ───────────────────────────────────────────────── */

export function ContributionConfirmModal({
  campaign,
  amount,
  selectedTier,
  loading,
  onConfirm,
  onCancel,
}: ContributionConfirmModalProps) {
  const typeInfo = DONATION_LABEL;
  const TypeIcon = typeInfo.icon;
  const currency = campaign.currency || 'BOB';

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [loading, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Backdrop ── */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={!loading ? onCancel : undefined}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      />

      {/* ── Modal Card ── */}
      <div
        className="relative w-full max-w-[480px] bg-white rounded-[28px] shadow-2xl overflow-hidden flex flex-col"
        style={{ animation: 'slideUp 0.3s ease-out', maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* ── Header with gradient ── */}
        <div
          className="relative px-5 md:px-8 pt-6 md:pt-8 pb-5 md:pb-6 shrink-0"
          style={{
            background: 'linear-gradient(135deg, #1c2b1e 0%, #72B626 100%)',
          }}
        >
          {/* Close button */}
          {!loading && (
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer border-none transition-all"
            >
              <X size={18} strokeWidth={2.5} className="text-white/80" />
            </button>
          )}

          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
            >
              <ShieldCheck size={22} strokeWidth={2} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-white tracking-tight leading-tight">
                Confirmar Aporte
              </h2>
              <p className="text-[11px] md:text-[12px] font-medium text-white/60 mt-0.5">
                Revisa el resumen antes de continuar
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-5 md:px-8 py-5 md:py-6 space-y-5 overflow-y-auto">

          {/* Campaign info */}
          <div className="flex items-start gap-4">
            {/* Campaign thumbnail */}
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 bg-slate-100 shadow-sm">
              {campaign.coverImageUrl ? (
                <img
                  src={campaign.coverImageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#1c2b1e] to-[#72B626] flex items-center justify-center">
                  <TypeIcon size={20} strokeWidth={1.5} className="text-white/30" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border ${
                    campaign.status === 'published' || campaign.status === 'approved'
                      ? 'bg-[#f0f9e0] text-[#72B626] border-gray-100'
                      : 'bg-amber-50 text-amber-600 border-amber-100'
                  }`}
                >
                  {campaign.status === 'published' ? 'Activa' : 'En Proceso'}
                </span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest"
                  style={{ backgroundColor: typeInfo.bgColor, color: typeInfo.color }}
                >
                  <TypeIcon size={10} strokeWidth={3} />
                  {typeInfo.label}
                </span>
              </div>
              <p className="text-[14px] md:text-[15px] font-black text-[#1c2b1e] tracking-tight leading-snug mb-1 line-clamp-2">
                {campaign.title}
              </p>
              {campaign.entrepreneurName && (
                <span className="text-[11px] font-bold text-slate-400">
                  por {campaign.entrepreneurName}
                </span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-100" />

          {/* Campaign Metadata */}
          <div className="grid grid-cols-2 gap-4 text-[11px] font-bold">
            <div className="flex flex-col gap-1">
              <span className="text-slate-400 uppercase tracking-widest text-[9px]">Ubicación</span>
              <span className="text-slate-700">{campaign.location || 'Global'}</span>
            </div>
            <div className="flex flex-col gap-1 text-right">
              <span className="text-slate-400 uppercase tracking-widest text-[9px]">Fecha Límite</span>
              <span className="text-slate-700">
                {campaign.endDate 
                  ? new Date(campaign.endDate).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'Indefinida'}
              </span>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Amount summary */}
          <div className="bg-[#f4f7f4] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <DollarSign size={13} strokeWidth={2.5} />
                Monto del Aporte
              </span>
            </div>
            <p className="text-2xl md:text-3xl font-black text-[#1c2b1e] tracking-tighter">
              Bs. {amount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[12px] md:text-[13px] font-bold text-slate-400 ml-2 tracking-normal">
                {currency}
              </span>
            </p>
          </div>

          {/* Selected reward tier (if any) */}
          {selectedTier && (
            <div className="border-2 border-amber-100 bg-amber-50/50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gift size={14} strokeWidth={2.5} className="text-amber-600" />
                <span className="text-[11px] font-black text-amber-700 uppercase tracking-widest">
                  Recompensa Incluida
                </span>
              </div>
              <p className="text-[13px] md:text-[14px] font-black text-[#1c2b1e] mb-1">
                {selectedTier.title}
              </p>
              {selectedTier.description && (
                <p className="text-[11px] md:text-[12px] text-slate-500 leading-relaxed">
                  {selectedTier.description}
                </p>
              )}
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 bg-slate-50 rounded-xl p-3.5">
            <AlertTriangle size={14} strokeWidth={2.5} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[10px] md:text-[11px] text-slate-400 font-medium leading-relaxed">
              Al confirmar, el monto será procesado y registrado como tu aporte a esta campaña.
              Esta acción no puede revertirse una vez completada.
            </p>
          </div>
        </div>

        {/* ── Footer buttons ── */}
        <div className="px-5 md:px-8 pb-5 md:pb-8 flex flex-col sm:flex-row gap-3 shrink-0 pt-4 md:pt-0">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3.5 md:py-4 rounded-2xl font-black text-[12px] md:text-[13px] uppercase tracking-widest bg-slate-100 text-slate-500 border-none cursor-pointer hover:bg-slate-200 transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-[1.5] py-3.5 md:py-4 rounded-2xl font-black text-[12px] md:text-[13px] uppercase tracking-widest border-none cursor-pointer transition-all active:scale-[0.97] disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white"
            style={{
              background: loading
                ? '#64748b'
                : 'linear-gradient(135deg, #72B626, #1c2b1e)',
              boxShadow: loading
                ? 'none'
                : '0 8px 24px rgba(46,125,50,0.3)',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} strokeWidth={2.5} className="animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                Confirmar Aporte
                <ArrowRight size={16} strokeWidth={2.5} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Inline keyframe animations ── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
