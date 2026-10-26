import { useState } from 'react';
import type { EntrepreneurCampaign } from '../types/campaign.types';
import { formatCampaignCurrency, computeFundingPercent, clampPercentForBar } from '../utils/campaignFunding';
import {
  Eye, Send, Rocket, Trash2, CheckCircle2, Users, Calendar, TrendingUp,
  AlertTriangle, X, ChevronRight, MoreHorizontal, Flag, Share2
} from 'lucide-react';
import { ShareModal } from './ShareModal';

interface Props {
  campaign: EntrepreneurCampaign;
  onPreview?: (campaign: EntrepreneurCampaign) => void;
  onSubmitForReview?: (campaignId: string) => void;
  onPublish?: (campaignId: string) => void;
  onDelete?: (campaignId: string) => void;
  onFinalize?: (campaignId: string) => void;
  onPublishUpdate?: (campaignId: string, campaignTitle: string) => void;
  actionCampaignId?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  published:     { label: 'Publicada',  dot: '#22c55e', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  funded:        { label: 'Activa',     dot: '#22c55e', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  partially_funded:{ label: 'Activa',   dot: '#22c55e', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  approved:      { label: 'Aprobada',   dot: '#22c55e', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  draft:         { label: 'Borrador',   dot: '#94a3b8', bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
  pending_review:{ label: 'En Revisión',dot: '#f59e0b', bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  in_review:     { label: 'En Revisión',dot: '#f59e0b', bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  rejected:      { label: 'Rechazada', dot: '#ef4444', bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  completed:     { label: 'Finalizada', dot: '#6366f1', bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
  failed:        { label: 'Fallida',    dot: '#ef4444', bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
};

export function CampaignCard({
  campaign,
  onPreview,
  onSubmitForReview,
  onPublish,
  onDelete,
  onFinalize,
  onPublishUpdate,
  actionCampaignId,
}: Props) {
  const busy = actionCampaignId === campaign.id;
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  const statusCfg = STATUS_CONFIG[campaign.status] ?? STATUS_CONFIG['draft'];
  const rawPercent = computeFundingPercent(campaign.currentAmount, campaign.goalAmount);
  const barWidth = clampPercentForBar(rawPercent);
  const pct = Math.round(rawPercent);

  const canSubmit  = campaign.status === 'draft';
  const canPublish = campaign.status === 'approved';
  const canDelete  = campaign.status === 'draft' || campaign.status === 'rejected';
  const canFinalize= campaign.status === 'published';

  let daysLeft: number | null = null;
  if (campaign.endDate) {
    const ms = new Date(campaign.endDate).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(ms / 86_400_000));
  }

  /* --- Banner color gradient by status --- */
  const bannerGradient =
    campaign.status === 'published'  ? 'linear-gradient(135deg, #1c2b1e 0%, #72B626 60%, #72B626 100%)' :
    campaign.status === 'funded' || campaign.status === 'partially_funded'
                                     ? 'linear-gradient(135deg, #14532d 0%, #16a34a 60%, #10b981 100%)' :
    campaign.status === 'draft'      ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' :
    campaign.status === 'pending_review' || campaign.status === 'in_review'
                                     ? 'linear-gradient(135deg, #78350f 0%, #d97706 100%)' :
    campaign.status === 'rejected'   ? 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)' :
    campaign.status === 'completed'  ? 'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)' :
                                       'linear-gradient(135deg, #1e293b 0%, #72B626 100%)';

  return (
    <article
      className="group relative bg-white rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md"
      style={{ border: '1px solid #E5E7EB', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Banner superior estilo "cover photo" ── */}
      <div
        className="relative h-[88px] flex-shrink-0 overflow-hidden"
        style={{ background: bannerGradient }}
      >
        {/* Patrón decorativo */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Indicador de porcentaje grande */}
        <div className="absolute right-4 bottom-3 text-white/20 font-black text-[52px] leading-none select-none">
          {pct}%
        </div>

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <span
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-sm"
            style={{ background: statusCfg.bg + 'dd', color: statusCfg.text, borderColor: statusCfg.border }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: statusCfg.dot }} />
            {statusCfg.label}
          </span>
        </div>

        {/* Menú 3 puntos */}
        <div className="absolute top-3 right-3">
          <button
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-white transition-all"
            onClick={() => setShowMenu(v => !v)}
          >
            <MoreHorizontal size={14} />
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-9 bg-white rounded-2xl shadow-2xl border border-slate-100 py-1 w-40 z-30"
              onMouseLeave={() => setShowMenu(false)}
            >
              {onPreview && (
                <button
                  className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  onClick={() => { setShowMenu(false); onPreview(campaign); }}
                >
                  <Eye size={14} className="text-slate-400" /> Vista previa
                </button>
              )}
              {campaign.status === 'published' && (
                <button
                  className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                  onClick={() => { setShowMenu(false); setShowShareModal(true); }}
                >
                  <Share2 size={14} className="text-slate-400" /> Compartir
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  disabled={busy}
                  className="w-full text-left px-4 py-2.5 text-[13px] font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Contenido principal ── */}
      <div className="flex-1 flex flex-col p-5 gap-4">

        {/* Título + descripción */}
        <div>
          <h3 className="text-[15px] font-bold text-gray-900 leading-snug mb-1 group-hover:text-[#72B626] transition-colors line-clamp-2">
            {campaign.title}
          </h3>
          <p className="text-[13px] text-gray-400 leading-relaxed line-clamp-2">
            {campaign.shortDescription || 'Sin descripción breve disponible para esta campaña.'}
          </p>
        </div>

        {/* ── Stats row estilo "métricas de post" ── */}
        <div className="flex items-center gap-3 py-3 border-y border-slate-100">
          <div className="flex-1 text-center">
            <p className="text-[11px] text-slate-400 font-black uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
              <TrendingUp size={11} /> Recaudado
            </p>
            <p className="text-[15px] font-black text-[#72B626]">
              {formatCampaignCurrency(campaign.currentAmount, campaign.currency || 'BOB')}
            </p>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex-1 text-center">
            <p className="text-[11px] text-slate-400 font-black uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
              <Users size={11} /> Donantes
            </p>
            <p className="text-[15px] font-black text-[#1c2b1e]">
              {campaign.investorCount ?? 0}
            </p>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex-1 text-center">
            <p className="text-[11px] text-slate-400 font-black uppercase tracking-wider mb-0.5 flex items-center justify-center gap-1">
              <Calendar size={11} /> Días
            </p>
            <p className="text-[15px] font-black text-[#1c2b1e]">
              {daysLeft !== null ? (daysLeft > 0 ? daysLeft : <span className="text-slate-400">—</span>) : '∞'}
            </p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[12px] text-gray-400">Progreso</span>
            <span className="text-[12px] font-semibold" style={{ color: '#72B626' }}>{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${barWidth}%`,
                background: pct >= 100 ? '#F59E0B' : '#72B626',
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-400 font-medium">
              {formatCampaignCurrency(campaign.currentAmount, campaign.currency || 'BOB')}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Meta: {formatCampaignCurrency(campaign.goalAmount, campaign.currency || 'BOB')}
            </span>
          </div>
        </div>

        {/* ── Acciones principales ── */}
        {!showFinalizeConfirm && (
          <div className="flex flex-col gap-2 mt-auto">
            {/* Ver preview */}
            {onPreview && (
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[13px] transition-all active:scale-95"
                onClick={() => onPreview(campaign)}
                disabled={busy}
              >
                <Eye size={15} /> Vista Previa
              </button>
            )}

            {/* Enviar a revisión */}
            {canSubmit && onSubmitForReview && (
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[13px] transition-all active:scale-95 shadow-sm shadow-amber-200"
                disabled={busy}
                onClick={() => onSubmitForReview(campaign.id)}
              >
                <Send size={15} /> {busy ? 'Enviando…' : 'Enviar a Revisión'}
              </button>
            )}

            {/* Publicar */}
            {canPublish && onPublish && (
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-bold text-[13px] transition-all active:scale-95 shadow-md shadow-emerald-200"
                disabled={busy}
                onClick={() => onPublish(campaign.id)}
                style={{ background: 'linear-gradient(135deg, #72B626, #72B626)' }}
              >
                <Rocket size={15} /> {busy ? 'Publicando…' : 'Publicar Campaña'}
                <ChevronRight size={15} />
              </button>
            )}

            {/* Eliminar (borrador/rechazado) */}
            {canDelete && onDelete && (
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[13px] border border-red-100 transition-all active:scale-95"
                disabled={busy}
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={15} /> {busy ? 'Eliminando…' : 'Eliminar Campaña'}
              </button>
            )}

            {/* Publicar Novedad */}
            {campaign.status === 'published' && onPublishUpdate && (
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#72B626]/10 text-[#72B626] border border-[#72B626]/25 font-bold text-[13px] transition-all active:scale-95 shadow-sm hover:bg-[#72B626]/20 cursor-pointer"
                onClick={() => onPublishUpdate(campaign.id, campaign.title)}
              >
                <Send size={14} /> Publicar Novedad
              </button>
            )}

            {/* Compartir campaña activa */}
            {campaign.status === 'published' && (
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#72B626]/10 text-[#72B626] border border-[#72B626]/25 font-bold text-[13px] transition-all active:scale-95 shadow-sm hover:bg-[#72B626]/20 cursor-pointer"
                onClick={() => setShowShareModal(true)}
              >
                <Share2 size={14} /> Compartir Campaña
              </button>
            )}

            {/* Finalizar campaña — abre confirmación inline */}
            {canFinalize && onFinalize && (
              <button
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[13px] transition-all active:scale-95 shadow-md shadow-red-200/50 cursor-pointer border-none"
                disabled={busy}
                onClick={() => setShowFinalizeConfirm(true)}
              >
                <Flag size={15} /> {busy ? 'Finalizando…' : 'Finalizar Campaña'}
              </button>
            )}
          </div>
        )}

        {/* ── Confirmación inline para Eliminar Campaña ── */}
        {showDeleteConfirm && (
          <div className="mt-auto rounded-2xl overflow-hidden border border-red-200 bg-red-50 animate-[fadeSlideIn_0.25s_ease]">
            <div className="flex items-start gap-3 p-4 border-b border-red-200">
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle size={16} className="text-red-600" />
              </div>
              <div>
                <p className="font-black text-[13px] text-red-900 mb-0.5">¿Eliminar esta campaña?</p>
                <p className="text-[12px] text-red-700 font-medium leading-relaxed">
                  Esta acción es <span className="font-black">permanente e irreversible</span>. Se borrará toda la información de la campaña.
                </p>
              </div>
            </div>
            <div className="flex gap-2 p-3">
              <button
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-200 bg-white text-slate-700 font-bold text-[12px] transition-all hover:bg-slate-50 active:scale-95"
                onClick={() => setShowDeleteConfirm(false)}
              >
                <X size={13} /> Cancelar
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[12px] transition-all active:scale-95 shadow-sm"
                disabled={busy}
                onClick={() => { setShowDeleteConfirm(false); onDelete!(campaign.id); }}
              >
                <Trash2 size={13} /> {busy ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        )}

        {/* ── Confirmación inline para Finalizar Campaña ── */}
        {showFinalizeConfirm && (
          <div className="mt-auto rounded-2xl overflow-hidden border border-amber-200 bg-amber-50 animate-[fadeSlideIn_0.25s_ease]">
            <div className="flex items-start gap-3 p-4 border-b border-amber-200">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="font-black text-[13px] text-amber-900 mb-0.5">¿Finalizar esta campaña?</p>
                <p className="text-[12px] text-amber-700 font-medium leading-relaxed">
                  Esta acción <span className="font-black">no se puede deshacer</span>. La campaña quedará cerrada.
                  {campaign.currentAmount < campaign.goalAmount && (
                    <span className="block mt-1.5 text-red-700 font-black">
                      La meta no fue alcanzada. Todos los donantes recibirán un reembolso automático inmediato.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 p-3">
              <button
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-amber-300 bg-white text-slate-700 font-bold text-[12px] transition-all hover:bg-slate-50 active:scale-95"
                onClick={() => setShowFinalizeConfirm(false)}
              >
                <X size={13} /> Cancelar
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[12px] transition-all active:scale-95 shadow-sm"
                disabled={busy}
                onClick={() => { setShowFinalizeConfirm(false); onFinalize!(campaign.id); }}
              >
                <CheckCircle2 size={13} /> {busy ? 'Finalizando…' : 'Sí, finalizar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Línea inferior de color por estado */}
      <div
        className="h-[3px] w-full mt-auto"
        style={{
          background: campaign.status === 'published'
            ? 'linear-gradient(90deg, #72B626, #72B626)'
            : campaign.status === 'draft'
            ? '#e2e8f0'
            : campaign.status === 'pending_review' || campaign.status === 'in_review'
            ? '#f59e0b'
            : campaign.status === 'rejected'
            ? '#ef4444'
            : '#e2e8f0',
        }}
      />
      {showShareModal && (
        <ShareModal
          campaignId={campaign.id}
          campaignTitle={campaign.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </article>
  );
}
