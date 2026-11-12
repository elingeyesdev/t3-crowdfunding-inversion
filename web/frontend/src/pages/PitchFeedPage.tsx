import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPublicCampaigns, type PublicCampaign } from '../api/public-campaigns.api';
import { Navbar } from '../components/Navbar';
import { PitchVideoPlayer } from '../components/campaigns/PitchVideoPlayer';
import { getImageUrl } from '../utils/image.utils';
import axios from 'axios';
import {
  Rocket, TrendingUp, Users, ArrowRight,
  Loader2, AlertCircle, RefreshCw, Play,
} from 'lucide-react';

const GREEN = '#72B626';

/* ─────────────────────────────────────────────
   PROGRESS BAR MINI
───────────────────────────────────────────── */
function FundingBar({ current, goal }: { current: number; goal: number }) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: pct >= 100 ? '#f9a825' : GREEN,
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   SINGLE PITCH CARD  (one full-viewport slide)
───────────────────────────────────────────── */
interface PitchCardProps {
  campaign: PublicCampaign;
  isActive: boolean;
}

function PitchCard({ campaign, isActive }: PitchCardProps) {
  const navigate = useNavigate();
  const pct = campaign.goalAmount > 0
    ? Math.min(Math.round((campaign.currentAmount / campaign.goalAmount) * 100), 100)
    : 0;

  const formatMoney = (n: number) =>
    n >= 1_000_000 ? `Bs. ${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000   ? `Bs. ${(n / 1_000).toFixed(1)}K`
    : `Bs. ${n.toLocaleString('es-BO')}`;

  return (
    <div
      className="relative w-full flex-shrink-0"
      style={{
        // Full viewport height minus navbar (~68px)
        height: 'calc(100vh - 68px)',
        scrollSnapAlign: 'start',
      }}
    >
      {/* ── Video layer ── */}
      <div className="absolute inset-0">
        <PitchVideoPlayer videoUrl={campaign.videoUrl!} isActive={isActive} />
      </div>

      {/* ── Dark gradient overlay (bottom 60%) ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.6) 40%, transparent 70%)',
        }}
      />

      {/* ── Info overlay (bottom) ── */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 z-10">
        {/* Category chip */}
        <div className="flex gap-2 mb-3">
          <span
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full text-white"
            style={{ background: 'rgba(114,182,38,0.75)', backdropFilter: 'blur(6px)' }}
          >
            {campaign.categoryName}
          </span>
          {campaign.status === 'funded' && (
            <span
              className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full text-amber-300"
              style={{ background: 'rgba(249,168,37,0.25)', backdropFilter: 'blur(6px)' }}
            >
              ✓ Financiada
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="text-white text-[22px] font-black leading-tight tracking-tight mb-1 drop-shadow-lg">
          {campaign.title}
        </h2>

        {/* Short description */}
        {campaign.shortDescription && (
          <p className="text-white/70 text-[13px] font-medium leading-relaxed mb-4 line-clamp-2">
            {campaign.shortDescription}
          </p>
        )}

        {/* Entrepreneur row */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white text-[11px] font-black overflow-hidden shrink-0 ring-2 ring-white/20">
            {getImageUrl(campaign.entrepreneurAvatar) ? (
              <img src={getImageUrl(campaign.entrepreneurAvatar)!} alt="" className="w-full h-full object-cover" />
            ) : (
              campaign.entrepreneurName?.charAt(0)?.toUpperCase() || '?'
            )}
          </div>
          <span className="text-white/80 text-[13px] font-bold truncate">
            {campaign.entrepreneurDisplayName || campaign.entrepreneurName}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={14} className="text-[#72B626]" strokeWidth={2.5} />
            <span className="text-white font-black text-[14px]">{formatMoney(campaign.currentAmount)}</span>
            <span className="text-white/50 text-[12px] font-medium">/ {formatMoney(campaign.goalAmount)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={14} className="text-[#72B626]" strokeWidth={2.5} />
            <span className="text-white font-black text-[14px]">{campaign.investorCount}</span>
            <span className="text-white/50 text-[12px] font-medium">donadores</span>
          </div>
          <div
            className="ml-auto text-[12px] font-black text-[#72B626]"
            style={{ minWidth: '40px', textAlign: 'right' }}
          >
            {pct}%
          </div>
        </div>

        {/* Funding progress bar */}
        <div className="mb-5">
          <FundingBar current={campaign.currentAmount} goal={campaign.goalAmount} />
        </div>

        {/* CTA Button */}
        <button
          onClick={() => navigate(`/campaign/${campaign.id}`)}
          className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-[15px] uppercase tracking-wider transition-all active:scale-95 hover:brightness-110 border-none cursor-pointer"
          style={{
            background: GREEN,
            color: '#fff',
          }}
        >
          <Rocket size={18} strokeWidth={2} />
          Ver Campaña y Donar
          <ArrowRight size={18} strokeWidth={2} />
        </button>
      </div>

      {/* ── Scroll hint (only shown on first card via CSS) ── */}
      <div
        className="donatok-scroll-hint absolute top-1/2 right-4 -translate-y-1/2 flex flex-col items-center gap-1 z-10"
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}>
          <span className="text-white text-lg leading-none">↕</span>
        </div>
        <span className="text-white/40 text-[9px] font-black uppercase tracking-widest writing-mode-vertical" style={{ writingMode: 'vertical-rl', letterSpacing: '0.15em' }}>scroll</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */

export function PitchFeedPage() {
  const [campaigns, setCampaigns] = useState<PublicCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const feedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Fetch campaigns with videoUrl only ──
  useEffect(() => {
    setLoading(true);
    fetchPublicCampaigns({ limit: 50 })
      .then(result => {
        const withVideo = result.data.filter(c => c.videoUrl && c.videoUrl.trim() !== '');
        setCampaigns(withVideo);
      })
      .catch(() => setError('No se pudo cargar el feed de DonaTok.'))
      .finally(() => setLoading(false));
  }, []);

  // ── IntersectionObserver: track which card is in view ──
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setupObserver = useCallback(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = cardRefs.current.findIndex(el => el === entry.target);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { threshold: 0.6 },
    );

    cardRefs.current.forEach(el => {
      if (el) observerRef.current!.observe(el);
    });
  }, []);

  useEffect(() => {
    if (campaigns.length > 0) setupObserver();
    return () => observerRef.current?.disconnect();
  }, [campaigns, setupObserver]);

  // ── Track view when active campaign changes (debounced 2s to avoid accidental counts) ──
  useEffect(() => {
    if (campaigns.length === 0) return;
    const campaign = campaigns[activeIndex];
    if (!campaign) return;
    const t = setTimeout(() => {
      axios.post(`/api/v1/campaigns/public/${campaign.id}/view`).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [activeIndex, campaigns]);

  // ── Render states ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex flex-col font-['Plus Jakarta Sans',sans-serif]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gray-900"
          >
            <Loader2 size={36} className="text-white animate-spin" />
          </div>
          <p className="text-white/50 font-black uppercase tracking-widest text-[12px]">
            Cargando pitches…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex flex-col font-['Plus Jakarta Sans',sans-serif]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <AlertCircle size={48} className="text-red-400" strokeWidth={1.5} />
          <p className="text-white font-bold text-lg">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] uppercase tracking-widest text-white transition-all active:scale-95 border-none cursor-pointer"
            style={{ background: GREEN }}
          >
            <RefreshCw size={15} strokeWidth={2} />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex flex-col font-['Plus Jakarta Sans',sans-serif]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center mb-2 bg-gray-900"
          >
            <Play size={44} strokeWidth={1.2} className="text-white/60" />
          </div>
          <h2 className="text-white text-2xl font-black tracking-tight">Sin pitches disponibles</h2>
          <p className="text-white/40 font-medium text-[15px] max-w-sm leading-relaxed">
            Aún no hay campañas con video pitch publicado. ¡Sé el primero en subir el tuyo desde <strong className="text-[#72B626]">Mis Campañas</strong>!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0e0e0e] font-['Plus Jakarta Sans',sans-serif] overflow-hidden">
      {/* Navbar */}
      <Navbar />

      {/* ── Dot navigation (right side) ── */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
        {campaigns.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              cardRefs.current[i]?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="rounded-full transition-all duration-300 border-none cursor-pointer"
            style={{
              width: activeIndex === i ? '8px' : '6px',
              height: activeIndex === i ? '24px' : '6px',
              background: activeIndex === i ? GREEN : 'rgba(255,255,255,0.25)',
            }}
            title={`Pitch ${i + 1}`}
          />
        ))}
      </div>

      {/* ── Pitch counter (top-right) ── */}
      <div
        className="fixed top-20 right-14 z-50 px-3 py-1.5 rounded-full text-white text-[12px] font-black"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      >
        {activeIndex + 1} / {campaigns.length}
      </div>

      {/* ── Feed container with scroll-snap ── */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-scroll"
        style={{
          scrollSnapType: 'y mandatory',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {campaigns.map((campaign, i) => (
          <div
            key={campaign.id}
            ref={el => { cardRefs.current[i] = el; }}
          >
            <PitchCard campaign={campaign} isActive={activeIndex === i} />
          </div>
        ))}
      </div>

      {/* ── Inline styles for scroll-hint hide on non-first ── */}
      <style>{`
        .donatok-scroll-hint { display: none; }
        .donatok-scroll-hint:first-child { display: flex; }
        @keyframes bounce-y {
          0%, 100% { transform: translateY(-50%) translateY(0); }
          50%       { transform: translateY(-50%) translateY(6px); }
        }
        .donatok-scroll-hint { animation: bounce-y 1.8s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
