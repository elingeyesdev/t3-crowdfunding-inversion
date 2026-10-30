import { useState, useEffect, useMemo, useRef } from 'react';
import { PitchVideoPlayer } from '../components/campaigns/PitchVideoPlayer';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getImageUrl } from '../utils/image.utils';
import { useCampaignDetail } from '../hooks/useCampaignDetail';
import {
  fetchPublicCampaigns,
  fetchPublicCampaignUpdates,
  type PublicCampaign,
  type PublicCampaignUpdate,
} from '../api/public-campaigns.api';
import { Navbar } from '../components/Navbar';
import { RewardTierCards } from '../components/campaign-detail/RewardTierCards';
import { ContributionConfirmModal } from '../components/campaign-detail/ContributionConfirmModal';
import { CampaignComments } from '../components/campaign-detail/CampaignComments';
import { ProgressBar } from '../components/ProgressBar';
import { CampaignTransparencySection } from '../components/campaign-detail/CampaignTransparencySection';
import { ProjectMilestones } from '../components/campaign-detail/transparency/ProjectMilestones';
import { CampaignUpdatesTimeline } from '../components/campaign-detail/transparency/CampaignUpdatesTimeline';

import { createInvestment, downloadInvestmentReceipt } from '../api/investor.api';
import { getOrCreateConversation } from '../api/chat.api';

import {
  ArrowLeft,
  Users,
  Calendar,
  Target,
  Gift,
  Rocket,
  AlertCircle,
  RefreshCw,
  Clock,
  DollarSign,
  ArrowUpRight,
  User,
  Loader2,
  CheckCircle2,
  LogIn,
  Sparkles,
  Flame,
  MessageCircle,
  Share2,
  FileText,
  ShieldCheck,
  PieChart as PieIcon,
  Layers,
} from 'lucide-react';
import { ShareModal } from '../components/ShareModal';



/* ───────────────────────────────────────────────── */
/*  SKELETON LOADING                                 */
/* ───────────────────────────────────────────────── */

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#f4f7f4] font-['Plus Jakarta Sans',sans-serif]">
      <Navbar />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-pulse">
        {/* Back button skeleton */}
        <div className="h-5 w-44 bg-slate-200 rounded-full mb-8" />

        {/* Hero image skeleton */}
        <div className="h-[380px] md:h-[440px] bg-slate-200 rounded-[28px] mb-10" />

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
          {/* Main content skeleton */}
          <div className="flex-1 space-y-6">
            <div className="flex gap-3 mb-4">
              <div className="w-24 h-7 bg-slate-200 rounded-xl" />
              <div className="w-20 h-7 bg-slate-200 rounded-xl" />
            </div>
            <div className="h-9 bg-slate-200 rounded-full w-[80%]" />
            <div className="h-5 bg-slate-100 rounded-full w-[50%]" />
            <div className="space-y-3 pt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-100 rounded-full" style={{ width: `${90 - i * 8}%` }} />
              ))}
            </div>
            {/* Entrepreneur section skeleton */}
            <div className="mt-10 pt-8 border-t border-slate-100 space-y-4">
              <div className="h-6 w-48 bg-slate-200 rounded-full" />
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-200" />
                <div className="space-y-2">
                  <div className="h-5 w-36 bg-slate-200 rounded-full" />
                  <div className="h-3 w-24 bg-slate-100 rounded-full" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-100 rounded-full w-full" />
                <div className="h-4 bg-slate-100 rounded-full w-[70%]" />
              </div>
            </div>
          </div>

          {/* Sidebar skeleton */}
          <div className="w-full lg:w-[380px] shrink-0">
            <div className="bg-white rounded-[28px] p-8 space-y-6 shadow-sm border border-green-50">
              <div className="h-8 bg-slate-200 rounded-full w-[60%]" />
              <div className="h-3 bg-slate-100 rounded-full w-full" />
              <div className="h-4 bg-slate-200 rounded-full w-[40%]" />
              <div className="space-y-4 pt-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-4 w-28 bg-slate-100 rounded-full" />
                    <div className="h-4 w-20 bg-slate-200 rounded-full" />
                  </div>
                ))}
              </div>
              <div className="h-14 bg-slate-200 rounded-2xl mt-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────── */
/*  MAIN PAGE                                        */
/* ───────────────────────────────────────────────── */

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { campaign, loading, error, retry, refetch } = useCampaignDetail(id);

  // ── Tab Navigation state ──
  const initialTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'historia' | 'transparencia' | 'actualizaciones' | 'comentarios'>(
    initialTab === 'transparencia' || initialTab === 'actualizaciones' || initialTab === 'comentarios'
      ? initialTab
      : 'historia'
  );
  const [publicUpdates, setPublicUpdates] = useState<PublicCampaignUpdate[]>([]);
  const [updatesLoading, setUpdatesLoading] = useState(false);

  // Sync tab with URL query parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['historia', 'transparencia', 'actualizaciones', 'comentarios'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  // Fetch campaign updates for badge counters & timeline
  useEffect(() => {
    if (!id) return;
    setUpdatesLoading(true);
    fetchPublicCampaignUpdates(id)
      .then((data) => setPublicUpdates(data || []))
      .catch((err) => console.error('Error cargando actualizaciones públicas:', err))
      .finally(() => setUpdatesLoading(false));
  }, [id]);

  // ── Pitch video state ──
  const [showPitch, setShowPitch] = useState(false);

  // ── Scroll Ref ──
  const donationCardRef = useRef<HTMLDivElement>(null);

  // ── Investment state ──
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [investmentLoading, setInvestmentLoading] = useState(false);
  const [investmentError, setInvestmentError] = useState<string | null>(null);
  const [investmentSuccess, setInvestmentSuccess] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [lastInvestmentId, setLastInvestmentId] = useState<string | null>(null);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  // ── Related campaigns state ──
  const [relatedCampaigns, setRelatedCampaigns] = useState<PublicCampaign[]>([]);



  const milestones = useMemo(() => {
    if (campaign && campaign.rewardTiers && campaign.rewardTiers.length > 0) {
      return campaign.rewardTiers.map(tier => ({
        percentage: tier.minPercentage || 0,
        label: tier.title
      })).filter(m => m.percentage > 0 && m.percentage <= 100);
    }
    return [
      { percentage: 25, label: 'Hito Inicial' },
      { percentage: 50, label: 'Mitad del Camino' },
      { percentage: 75, label: 'Meta Cercana' },
      { percentage: 100, label: 'Objetivo Principal' }
    ];
  }, [campaign]);

  useEffect(() => {
    if (!campaign?.categoryId || !campaign?.id) return;
    fetchPublicCampaigns({ categoryId: campaign.categoryId, limit: 4 })
      .then(result => {
        setRelatedCampaigns(result.data.filter(c => c.id !== campaign.id).slice(0, 3));
      })
      .catch(() => {});
  }, [campaign?.categoryId, campaign?.id]);

  // Determine where to go back — preserve filter state
  const backUrl = (location.state as any)?.from || '/explore';

  const handleGoBack = () => {
    navigate(backUrl);
  };

  /* ── Loading ── */
  if (loading) return <DetailSkeleton />;

  /* ── Error ── */
  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-[#f4f7f4] font-['Plus Jakarta Sans',sans-serif]">
        <Navbar />
        <div className="max-w-[600px] mx-auto px-6 py-32 text-center">
          <div className="bg-white rounded-[28px] p-10 shadow-sm border border-red-100">
            <AlertCircle size={48} className="text-red-400 mx-auto mb-6" strokeWidth={1.5} />
            <h2 className="text-2xl font-black text-[#1c2b1e] mb-3 tracking-tight">
              {error === 'Campaña no encontrada o no está publicada'
                ? 'Campaña No Encontrada'
                : 'Error al Cargar'}
            </h2>
            <p className="text-slate-500 font-medium text-[15px] mb-8 leading-relaxed">
              {error || 'No se pudo obtener la información de esta campaña.'}
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleGoBack}
                className="px-6 py-3 rounded-xl bg-slate-100 text-slate-600 font-black text-[13px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 cursor-pointer border-none"
              >
                ← Volver al Portal
              </button>
              <button
                onClick={retry}
                className="px-6 py-3 rounded-xl bg-[#72B626] text-white font-black text-[13px] uppercase tracking-widest hover:bg-[#256b29] transition-all active:scale-95 cursor-pointer border-none flex items-center gap-2"
              >
                <RefreshCw size={14} strokeWidth={3} />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Computed values ── */
  const exactProgress = campaign.goalAmount > 0
    ? Number(((campaign.currentAmount / campaign.goalAmount) * 100).toFixed(2))
    : 0;
  const visualProgress = Math.min(exactProgress, 100);

  let daysRemaining: number | null = null;
  if (campaign.endDate) {
    const ms = new Date(campaign.endDate).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }


  const isExpired = daysRemaining !== null && daysRemaining <= 0;
  const isFundedOrCompleted =
    campaign.status === 'funded' ||
    campaign.status === 'completed' ||
    (campaign.goalAmount > 0 && campaign.currentAmount >= campaign.goalAmount);
  const acceptsDonations = (campaign.status === 'published' || campaign.status === 'partially_funded') && !isExpired && !isFundedOrCompleted;
  const token = localStorage.getItem('accessToken');
  const parsedAmount = parseFloat(customAmount);
  const hasValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;
  const amountTooLow = !!(hasValidAmount && campaign.minInvestment && parsedAmount < campaign.minInvestment);
  const amountTooHigh = !!(hasValidAmount && campaign.maxInvestment && parsedAmount > campaign.maxInvestment);
  const selectedTier = selectedTierId ? campaign.rewardTiers?.find(t => t.id === selectedTierId) : null;
  const amountBelowTier = !!(selectedTier && hasValidAmount && parsedAmount < selectedTier.amount);
  const canInvest = acceptsDonations && !investmentLoading && !investmentSuccess && hasValidAmount && !amountTooLow && !amountTooHigh && !amountBelowTier;
  const closedDonationLabel = isFundedOrCompleted ? 'Campaña completada' : isExpired ? 'Campaña finalizada' : 'No disponible';

  const scrollToDonationCard = () => {
    donationCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleDonateClick = () => {
    if (!acceptsDonations || investmentSuccess) return;
    if (!token) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    if (!hasValidAmount) {
      setInvestmentError('Ingresa un monto válido para donar.');
      scrollToDonationCard();
      return;
    }
    if (amountTooLow) {
      setInvestmentError(`El monto mínimo de donación es Bs. ${campaign.minInvestment?.toLocaleString('es-BO')}.`);
      scrollToDonationCard();
      return;
    }
    if (amountTooHigh) {
      setInvestmentError(`El monto máximo de donación es Bs. ${campaign.maxInvestment?.toLocaleString('es-BO')}.`);
      scrollToDonationCard();
      return;
    }
    if (amountBelowTier && selectedTier) {
      setInvestmentError(`El monto mínimo para la recompensa "${selectedTier.title}" es Bs. ${selectedTier.amount.toLocaleString('es-BO')}.`);
      scrollToDonationCard();
      return;
    }
    setInvestmentError(null);
    setShowConfirmModal(true);
  };

  const coverUrl = getImageUrl(campaign.coverImageUrl);

  return (
    <div className="min-h-screen bg-[#f4f7f4] font-['Plus Jakarta Sans',sans-serif]">
      <Navbar />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ── Back & Share bar ── */}
        <div className="flex justify-between items-center mb-6 sm:mb-8">
          <button
            onClick={handleGoBack}
            className="flex items-center gap-1.5 sm:gap-2 text-slate-500 hover:text-[#72B626] font-bold text-[11px] sm:text-[13px] uppercase tracking-widest transition-colors cursor-pointer bg-transparent border-none group"
          >
            <ArrowLeft size={16} strokeWidth={2.5} className="group-hover:-translate-x-1 transition-transform sm:w-[18px] sm:h-[18px]" />
            <span className="hidden sm:inline">Regresar al Portal</span>
            <span className="inline sm:hidden">Regresar</span>
          </button>

          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 bg-white border border-slate-200 hover:border-green-500 hover:text-[#72B626] text-slate-500 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-[10px] sm:text-[13px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm shadow-slate-100"
          >
            <Share2 size={14} strokeWidth={2.5} className="sm:w-[15px] sm:h-[15px]" />
            <span className="hidden sm:inline">Compartir Campaña</span>
            <span className="inline sm:hidden">Compartir</span>
          </button>
        </div>

        {/* ── Hero Image ── */}
        <div className="relative h-[260px] sm:h-[320px] md:h-[440px] rounded-2xl sm:rounded-[28px] overflow-hidden shadow-xl shadow-black/5 mb-8 sm:mb-10">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={campaign.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#1c2b1e] via-[#72B626] to-[#1c2b1e] flex items-center justify-center">
              <Rocket size={80} strokeWidth={0.8} className="text-white/10" />
            </div>
          )}

          {/* Gradient overlay at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Badges */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex gap-2 sm:gap-3 flex-wrap">
            <span className="bg-white/90 backdrop-blur-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[9px] sm:text-[11px] font-black text-[#1c2b1e] uppercase tracking-widest shadow-sm">
              {campaign.categoryName}
            </span>
          </div>

          {/* DonaTok pitch button */}
          {(campaign as any).videoUrl && (campaign as any).videoUrl.trim() !== '' && (
            <button
              onClick={() => setShowPitch(p => !p)}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-black text-[9px] sm:text-[12px] uppercase tracking-widest transition-all active:scale-95 hover:brightness-110"
              style={{
                background: showPitch
                  ? 'rgba(255,255,255,0.95)'
                  : 'linear-gradient(135deg, #72B626, #72B626)',
                color: showPitch ? '#72B626' : '#fff',
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {showPitch ? 'Ocultar Pitch' : 'Ver Pitch'}
            </button>
          )}

          {/* Progress bar at bottom of hero */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/30">
            <div
              className="h-full transition-all duration-1000 ease-out"
              style={{
                width: `${visualProgress}%`,
                background: exactProgress >= 100
                  ? 'linear-gradient(90deg, #f9a825, #ff6f00)'
                  : 'linear-gradient(90deg, #a8d97c, #72B626)',
              }}
            />
          </div>
        </div>

        {/* ── Inline Video Pitch Player ── */}
        {showPitch && (campaign as any).videoUrl && (
          <div
            className="mb-10 rounded-[28px] overflow-hidden shadow-2xl"
            style={{
              background: '#0a140c',
              maxWidth: '360px',
              margin: '0 auto 2.5rem',
              aspectRatio: '9/16',
              position: 'relative',
            }}
          >
            <PitchVideoPlayer
              videoUrl={(campaign as any).videoUrl}
              isActive={showPitch}
            />
          </div>
        )}

        {/* ── Content + Sidebar ── */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">

          {/* ── Main Content ── */}
          <div className="flex-1 min-w-0">
            {/* Title block */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#1c2b1e] tracking-tight leading-tight mb-3">
              {campaign.title}
            </h1>
            {campaign.subtitle && (
              <p className="text-[15px] sm:text-[17px] text-slate-500 font-medium leading-relaxed mb-6">
                {campaign.subtitle}
              </p>
            )}

            {/* Entrepreneur mini banner */}
            <div className="flex items-center gap-2.5 sm:gap-3 mb-6 sm:mb-8">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#1c2b1e] to-[#72B626] flex items-center justify-center text-white text-[10px] sm:text-[12px] font-black overflow-hidden shrink-0">
                {getImageUrl(campaign.entrepreneurAvatar) ? (
                  <img src={getImageUrl(campaign.entrepreneurAvatar)} alt="" className="w-full h-full object-cover" />
                ) : (
                  campaign.entrepreneurName?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
              <div>
                <p className="text-[12px] sm:text-[13px] font-bold text-slate-600">
                  por{' '}
                  <span className="text-[#72B626]">
                    {campaign.entrepreneurDisplayName
                      ? `@${campaign.entrepreneurDisplayName}`
                      : campaign.entrepreneurName}
                  </span>
                </p>
              </div>
            </div>

            {/* ── Main Navigation Tabs ── */}
            <div id="campaign-tabs-navigation" className="flex items-center gap-2 border-b border-slate-200/80 mb-6 overflow-x-auto scrollbar-none pb-1">
              <button
                onClick={() => {
                  setActiveTab('historia');
                  setSearchParams({ tab: 'historia' });
                }}
                className={`flex items-center gap-2 py-3 px-4 rounded-xl text-[12px] sm:text-[13px] font-black uppercase tracking-wider transition-all border-none cursor-pointer shrink-0 ${
                  activeTab === 'historia'
                    ? 'bg-[#1c2b1e] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 bg-transparent'
                }`}
              >
                <Target size={16} className={activeTab === 'historia' ? 'text-[#72B626]' : 'text-slate-400'} />
                <span>Historia y Proyecto</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('transparencia');
                  setSearchParams({ tab: 'transparencia' });
                }}
                className={`flex items-center gap-2 py-3 px-4 rounded-xl text-[12px] sm:text-[13px] font-black uppercase tracking-wider transition-all border-none cursor-pointer shrink-0 ${
                  activeTab === 'transparencia'
                    ? 'bg-[#1c2b1e] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 bg-transparent'
                }`}
              >
                <ShieldCheck size={16} className={activeTab === 'transparencia' ? 'text-[#72B626]' : 'text-slate-400'} />
                <span>Transparencia y Fondos</span>
                <span className="px-1.5 py-0.5 rounded-full bg-[#72B626] text-white text-[9px] font-black">
                  Auditoría
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('actualizaciones');
                  setSearchParams({ tab: 'actualizaciones' });
                }}
                className={`flex items-center gap-2 py-3 px-4 rounded-xl text-[12px] sm:text-[13px] font-black uppercase tracking-wider transition-all border-none cursor-pointer shrink-0 ${
                  activeTab === 'actualizaciones'
                    ? 'bg-[#1c2b1e] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 bg-transparent'
                }`}
              >
                <Rocket size={16} className={activeTab === 'actualizaciones' ? 'text-[#72B626]' : 'text-slate-400'} />
                <span>Hitos y Avances</span>
                {publicUpdates.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-black">
                    {publicUpdates.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('comentarios');
                  setSearchParams({ tab: 'comentarios' });
                }}
                className={`flex items-center gap-2 py-3 px-4 rounded-xl text-[12px] sm:text-[13px] font-black uppercase tracking-wider transition-all border-none cursor-pointer shrink-0 ${
                  activeTab === 'comentarios'
                    ? 'bg-[#1c2b1e] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 bg-transparent'
                }`}
              >
                <MessageCircle size={16} className={activeTab === 'comentarios' ? 'text-[#72B626]' : 'text-slate-400'} />
                <span>Comentarios</span>
              </button>
            </div>

            {/* ── Tab 1: Historia y Proyecto ── */}
            {activeTab === 'historia' && (
              <>
                {/* Description — Campaign Story */}
                <div className="bg-white rounded-[24px] sm:rounded-[28px] shadow-sm border border-green-50 p-5 sm:p-8 md:p-10 mb-6 sm:mb-8">
                  <h2 className="text-lg sm:text-xl font-black text-[#1c2b1e] tracking-tight mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-green-50 flex items-center justify-center">
                      <Target size={18} strokeWidth={2.5} className="text-[#72B626] sm:w-[20px] sm:h-[20px]" />
                    </div>
                    Historia del Proyecto
                  </h2>
                  <div className="text-[14px] sm:text-[15px] text-slate-600 leading-[1.8] sm:leading-[1.9] whitespace-pre-wrap break-words">
                    {campaign.description || 'Este emprendedor aún no ha agregado una descripción detallada de su campaña.'}
                  </div>
                </div>

                {/* Transparency Guarantee Highlight Banner */}
                <div className="bg-gradient-to-r from-[#f0f9e0] to-white rounded-[24px] p-6 border border-[#72B626]/30 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#72B626] text-white flex items-center justify-center shrink-0 shadow-md shadow-green-500/20">
                      <ShieldCheck size={26} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h4 className="text-[15px] font-black text-[#1c2b1e]">
                          Campaña con Transparencia y Trazabilidad Verificada
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                          Auditable
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-600 font-medium leading-snug">
                        Consulta el plan de uso de fondos, movimientos financieros, evidencias de gastos y cronograma de hitos.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('transparencia');
                      setSearchParams({ tab: 'transparencia' });
                      const el = document.getElementById('campaign-tabs-navigation');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#1c2b1e] hover:bg-black text-white text-[12px] font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    <span>Ver Transparencia</span>
                    <ArrowUpRight size={14} strokeWidth={2.5} />
                  </button>
                </div>

                {/* ── Reward Tiers ── */}
                {campaign.rewardTiers && campaign.rewardTiers.length > 0 && (
                  <RewardTierCards
                    tiers={campaign.rewardTiers}
                    selectedTierId={selectedTierId}
                    onSelect={(tierId) => {
                      setInvestmentError(null);
                      setInvestmentSuccess(false);
                      if (selectedTierId === tierId) {
                        setSelectedTierId(null);
                        setCustomAmount('');
                      } else {
                        setSelectedTierId(tierId);
                        const tier = campaign.rewardTiers.find((t) => t.id === tierId);
                        if (tier) setCustomAmount(String(tier.amount));
                      }
                    }}
                    disabled={investmentLoading || investmentSuccess || (daysRemaining !== null && daysRemaining <= 0)}
                  />
                )}

                {/* Entrepreneur Bio Section */}
                <div className="bg-white rounded-[24px] sm:rounded-[28px] shadow-sm border border-green-50 p-5 sm:p-8 md:p-10 mb-8">
                  <h2 className="text-lg sm:text-xl font-black text-[#1c2b1e] tracking-tight mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-green-50 flex items-center justify-center">
                      <User size={18} strokeWidth={2.5} className="text-[#72B626] sm:w-[20px] sm:h-[20px]" />
                    </div>
                    Sobre el Emprendedor
                  </h2>

                  <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                    {/* Avatar */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-[#1c2b1e] to-[#72B626] flex items-center justify-center text-white text-xl sm:text-2xl font-black overflow-hidden shrink-0 shadow-lg shadow-green-500/10">
                      {getImageUrl(campaign.entrepreneurAvatar) ? (
                        <img src={getImageUrl(campaign.entrepreneurAvatar)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        campaign.entrepreneurName?.charAt(0)?.toUpperCase() || '?'
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-[16px] sm:text-[17px] font-black text-[#1c2b1e] mb-0.5 sm:mb-1 tracking-tight">
                        {campaign.entrepreneurName}
                      </h3>
                      {campaign.entrepreneurDisplayName && (
                        <p className="text-[12px] sm:text-[13px] text-[#72B626] font-bold mb-3 sm:mb-4">
                          @{campaign.entrepreneurDisplayName}
                        </p>
                      )}
                      <p className="text-[14px] sm:text-[15px] text-slate-500 leading-[1.7] sm:leading-[1.8] whitespace-pre-wrap">
                        {campaign.entrepreneurBio || 'Este emprendedor aún no ha agregado su biografía.'}
                      </p>

                      {/* Botón para iniciar chat */}
                      {localStorage.getItem('userId') !== campaign.entrepreneurUserId && (
                        <button
                          onClick={async () => {
                            const token = localStorage.getItem('accessToken');
                            if (!token) {
                              navigate('/login', { state: { from: location.pathname } });
                              return;
                            }
                            try {
                              const result = await getOrCreateConversation(
                                campaign.entrepreneurUserId,
                                campaign.id,
                                `Consulta sobre: ${campaign.title}`
                              );
                              navigate(`/chat/${result.id}`);
                            } catch (err) {
                              console.error('Error al iniciar conversación:', err);
                            }
                          }}
                          className="mt-5 flex items-center gap-2 px-5 py-3 rounded-xl bg-green-50 hover:bg-green-100 text-[#72B626] font-black text-[13px] uppercase tracking-wider border-none transition-all active:scale-95 cursor-pointer shadow-sm"
                        >
                          <MessageCircle size={16} strokeWidth={2.5} />
                          Contactar Emprendedor
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Tab 2: Transparencia y Fondos ── */}
            {activeTab === 'transparencia' && (
              <div className="mb-8">
                <CampaignTransparencySection
                  campaignId={campaign.id}
                  goalAmount={campaign.goalAmount}
                  currentAmount={campaign.currentAmount}
                  currency={campaign.currency}
                  startDate={campaign.startDate}
                  createdAt={campaign.createdAt}
                  entrepreneurName={campaign.entrepreneurName}
                  entrepreneurAvatar={campaign.entrepreneurAvatar}
                  customBudgetPlan={(campaign as any).metadata?.budget_plan || (campaign as any).metadata?.use_of_funds}
                  customMilestones={(campaign as any).metadata?.milestones}
                />
              </div>
            )}

            {/* ── Tab 3: Hitos y Avances ── */}
            {activeTab === 'actualizaciones' && (
              <div className="space-y-8 mb-8">
                <ProjectMilestones
                  goalAmount={campaign.goalAmount}
                  currentAmount={campaign.currentAmount}
                  currency={campaign.currency}
                  customMilestones={(campaign as any).metadata?.milestones}
                />
                <CampaignUpdatesTimeline
                  updates={publicUpdates}
                  loading={updatesLoading}
                  entrepreneurName={campaign.entrepreneurName}
                  entrepreneurAvatar={campaign.entrepreneurAvatar}
                />
              </div>
            )}

            {/* ── Tab 4: Comentarios ── */}
            {activeTab === 'comentarios' && (
              <div className="mb-8">
                <CampaignComments campaignId={campaign.id} />
              </div>
            )}
          </div>
          {/* end flex-1 main column */}


          {/* ── Sidebar ── */}
          <div className="w-full lg:w-[380px] shrink-0">
            <div className="lg:sticky lg:top-8 space-y-6">

              {/* Investment Card */}
              <div ref={donationCardRef} className="bg-white rounded-[24px] sm:rounded-[28px] shadow-lg shadow-green-500/5 border border-green-50 p-5 sm:p-8">
                {/* Raised Amount */}
                <div className="mb-5 sm:mb-6">
                  <p className="text-[11px] sm:text-[12px] font-black text-slate-400 uppercase tracking-widest mb-1.5 sm:mb-2">
                    Recaudado
                  </p>
                  <p className="text-3xl sm:text-4xl font-black text-[#1c2b1e] tracking-tighter">
                    Bs. {campaign.currentAmount.toLocaleString('es-BO')}
                    <span className="text-[14px] font-bold text-slate-400 ml-2">
                      BOB
                    </span>
                  </p>
                </div>

                {/* Progress bar */}
                <div className="mb-6">
                  <ProgressBar
                    value={visualProgress}
                    milestones={milestones}
                    trackClassName="shadow-inner"
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-[13px] font-black text-[#72B626]">
                      {exactProgress}%
                    </span>
                    <span className="text-[13px] font-bold text-slate-400">
                      Meta: Bs. {campaign.goalAmount.toLocaleString('es-BO')}
                    </span>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-[#f4f7f4] rounded-2xl p-4 text-center">
                    <Users size={20} strokeWidth={2} className="text-[#72B626] mx-auto mb-2" />
                    <p className="text-xl font-black text-[#1c2b1e]">{campaign.investorCount}</p>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      Donantes
                    </p>
                  </div>
                  <div className="bg-[#f4f7f4] rounded-2xl p-4 text-center">
                    <Calendar size={20} strokeWidth={2} className="text-[#72B626] mx-auto mb-2" />
                    <p className="text-xl font-black text-[#1c2b1e]">
                      {daysRemaining !== null
                        ? daysRemaining > 0 ? daysRemaining : 0
                        : '∞'}
                    </p>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {daysRemaining !== null && daysRemaining <= 0 ? 'Finalizada' : 'Días restantes'}
                    </p>
                  </div>
                </div>

                {/* ── Transparency Shortcut Button ── */}
                <button
                  onClick={() => {
                    setActiveTab('transparencia');
                    setSearchParams({ tab: 'transparencia' });
                    const el = document.getElementById('campaign-tabs-navigation');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full flex items-center justify-between p-3.5 mb-6 rounded-2xl bg-[#f0f9e0]/80 hover:bg-[#f0f9e0] border border-[#72B626]/30 text-[#4a7f1a] transition-all cursor-pointer group shadow-sm text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#72B626] text-white flex items-center justify-center shadow-sm shrink-0">
                      <ShieldCheck size={16} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-[#1c2b1e]">
                        Transparencia Verificada
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Plan de fondos, auditoría y evidencias
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight
                    size={15}
                    strokeWidth={2.5}
                    className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-[#72B626]"
                  />
                </button>

                {/* Investment details */}
                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between py-3 border-b border-slate-50">
                    <span className="flex items-center gap-2 text-[13px] font-bold text-slate-500">
                      <DollarSign size={15} strokeWidth={2.5} className="text-slate-400" />
                      Donación mínima
                    </span>
                    <span className="text-[14px] font-black text-[#1c2b1e]">
                      Bs. {campaign.minInvestment?.toLocaleString('es-BO') || '0'}
                    </span>
                  </div>

                  {campaign.maxInvestment && (
                    <div className="flex items-center justify-between py-3 border-b border-slate-50">
                      <span className="flex items-center gap-2 text-[13px] font-bold text-slate-500">
                        <ArrowUpRight size={15} strokeWidth={2.5} className="text-slate-400" />
                        Donación máxima
                      </span>
                      <span className="text-[14px] font-black text-[#1c2b1e]">
                        Bs. {campaign.maxInvestment.toLocaleString('es-BO')}
                      </span>
                    </div>
                  )}

                  {campaign.startDate && (
                    <div className="flex items-center justify-between py-3 border-b border-slate-50">
                      <span className="flex items-center gap-2 text-[13px] font-bold text-slate-500">
                        <Clock size={15} strokeWidth={2.5} className="text-slate-400" />
                        Fecha inicio
                      </span>
                      <span className="text-[14px] font-black text-[#1c2b1e]">
                        {new Date(campaign.startDate).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}

                  {campaign.endDate && (
                    <div className="flex items-center justify-between py-3">
                      <span className="flex items-center gap-2 text-[13px] font-bold text-slate-500">
                        <Calendar size={15} strokeWidth={2.5} className="text-slate-400" />
                        Fecha cierre
                      </span>
                      <span className="text-[14px] font-black text-[#1c2b1e]">
                        {new Date(campaign.endDate).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* ── Investment Amount Input (in sidebar) ── */}
                {!(daysRemaining !== null && daysRemaining <= 0) && !investmentSuccess && (
                  <div className="mb-4">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 block">
                      Monto a donar
                    </label>
                    <div className="relative">
                      <DollarSign size={16} strokeWidth={2.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="number"
                        min={campaign.minInvestment || 1}
                        max={campaign.maxInvestment || undefined}
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => {
                          setCustomAmount(e.target.value);
                          setInvestmentError(null);
                        }}
                        placeholder={`Mínimo Bs. ${campaign.minInvestment?.toLocaleString('es-BO') || '1'}`}
                        disabled={investmentLoading}
                        className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100 text-[16px] font-black text-[#1c2b1e] outline-none focus:border-[#72B626] focus:ring-4 focus:ring-green-500/10 transition-all placeholder:text-slate-300 placeholder:font-medium placeholder:text-[13px] disabled:opacity-50 disabled:bg-slate-100"
                      />
                    </div>
                    {selectedTierId && (
                      <p className="text-[11px] text-[#72B626] font-bold mt-2 flex items-center gap-1">
                        <Gift size={11} strokeWidth={2.5} />
                        Recompensa: {campaign.rewardTiers?.find(t => t.id === selectedTierId)?.title}
                      </p>
                    )}
                  </div>
                )}

                {/* ── Validation / Error Messages ── */}
                {investmentError && (
                  <div className="bg-red-50 text-[#c62828] p-3 rounded-xl text-[12px] font-bold border border-red-100 mb-4 flex items-start gap-2">
                    <AlertCircle size={14} strokeWidth={2.5} className="shrink-0 mt-0.5" />
                    {investmentError}
                  </div>
                )}

                {/* ── Success Message & Comprobante ── */}
                {investmentSuccess && (
                  <div className="bg-[#f0f9e0] border border-[#a8d97c]/60 p-4 sm:p-5 rounded-2xl mb-4 text-[#1c2b1e]">
                    <div className="flex items-center gap-2 mb-1.5 font-black text-[#4a7f1a] text-[14px]">
                      <CheckCircle2 size={18} strokeWidth={2.5} className="text-[#72B626]" />
                      <span>¡Aporte confirmado con éxito!</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-3.5 leading-relaxed">
                      Muchas gracias por tu contribución a este proyecto.
                    </p>
                    {lastInvestmentId && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setDownloadingReceipt(true);
                            await downloadInvestmentReceipt(lastInvestmentId);
                          } catch (err) {
                            console.error('Error al descargar comprobante:', err);
                            alert('No se pudo generar el comprobante. Puedes descargarlo desde tu panel de donaciones.');
                          } finally {
                            setDownloadingReceipt(false);
                          }
                        }}
                        disabled={downloadingReceipt}
                        className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-[#1c2b1e] border border-gray-200 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {downloadingReceipt ? (
                          <Loader2 size={14} className="animate-spin text-[#72B626]" />
                        ) : (
                          <FileText size={14} className="text-[#72B626]" strokeWidth={2.5} />
                        )}
                        <span>Descargar Comprobante PDF</span>
                      </button>
                    )}
                  </div>
                )}

                {/* CTA Button */}
                {(() => {
                  const isExpired = daysRemaining !== null && daysRemaining <= 0;
                  const token = localStorage.getItem('accessToken');
                  const parsedAmount = parseFloat(customAmount);
                  const hasValidAmount = !isNaN(parsedAmount) && parsedAmount > 0;

                  // Validate amount limits
                  const amountTooLow = hasValidAmount && campaign.minInvestment && parsedAmount < campaign.minInvestment;
                  const amountTooHigh = hasValidAmount && campaign.maxInvestment && parsedAmount > campaign.maxInvestment;

                  // Validate tier minimum
                  const selectedTier = selectedTierId ? campaign.rewardTiers?.find(t => t.id === selectedTierId) : null;
                  const amountBelowTier = selectedTier && hasValidAmount && parsedAmount < selectedTier.amount;

                  const canInvest = !isExpired && !investmentLoading && !investmentSuccess && hasValidAmount && !amountTooLow && !amountTooHigh && !amountBelowTier;

                  const handleInvest = () => {
                    if (!token) {
                      navigate('/login', { state: { from: location.pathname } });
                      return;
                    }
                    if (!hasValidAmount) {
                      setInvestmentError('Ingresa un monto válido para donar.');
                      return;
                    }
                    if (amountTooLow) {
                      setInvestmentError(`El monto mínimo de donación es Bs. ${campaign.minInvestment?.toLocaleString('es-BO')}.`);
                      return;
                    }
                    if (amountTooHigh) {
                      setInvestmentError(`El monto máximo de donación es Bs. ${campaign.maxInvestment?.toLocaleString('es-BO')}.`);
                      return;
                    }
                    if (amountBelowTier && selectedTier) {
                      setInvestmentError(`El monto mínimo para la recompensa "${selectedTier.title}" es Bs. ${selectedTier.amount.toLocaleString('es-BO')}.`);
                      return;
                    }
                    // All validations passed → show confirmation modal
                    setInvestmentError(null);
                    setShowConfirmModal(true);
                  };


                  if (isExpired) {
                    return (
                      <button
                        className="w-full py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest border-none cursor-not-allowed"
                        style={{ background: '#94a3b8', color: '#fff' }}
                        disabled
                      >
                        Campaña Finalizada
                      </button>
                    );
                  }

                  if (investmentSuccess) {
                    return (
                      <button
                        onClick={() => navigate('/dashboard')}
                        className="w-full py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest border-none cursor-pointer transition-all active:scale-[0.97]"
                        style={{
                          background: 'linear-gradient(135deg, #72B626, #1c2b1e)',
                          color: '#fff',
                          boxShadow: '0 8px 24px rgba(46,125,50,0.3)',
                        }}
                      >
                        Ver Mi Dashboard
                      </button>
                    );
                  }

                  if (!token) {
                    return (
                      <>
                        <button
                          onClick={() => navigate('/login', { state: { from: location.pathname } })}
                          className="w-full py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest border-none cursor-pointer transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                          style={{
                            background: 'linear-gradient(135deg, #72B626, #1c2b1e)',
                            color: '#fff',
                            boxShadow: '0 8px 24px rgba(46,125,50,0.3)',
                          }}
                        >
                          <LogIn size={16} strokeWidth={2.5} />
                          Iniciar Sesión para Donar
                        </button>
                        <p className="text-[11px] text-slate-400 font-medium text-center mt-3 leading-relaxed">
                          Necesitas una cuenta para realizar donaciones
                        </p>
                      </>
                    );
                  }

                  return (
                    <>
                      <button
                        onClick={handleInvest}
                        disabled={!canInvest}
                        className="w-full py-4 rounded-2xl font-black text-[14px] uppercase tracking-widest border-none cursor-pointer transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{
                          background: canInvest
                            ? 'linear-gradient(135deg, #72B626, #1c2b1e)'
                            : '#94a3b8',
                          color: '#fff',
                          boxShadow: canInvest
                            ? '0 8px 24px rgba(46,125,50,0.3)'
                            : 'none',
                        }}
                      >
                        {investmentLoading ? (
                          <>
                            <Loader2 size={16} strokeWidth={2.5} className="animate-spin" />
                            Procesando...
                          </>
                        ) : (
                          `Donar Bs. ${hasValidAmount ? parsedAmount.toLocaleString('es-BO') : '0'}`
                        )}
                      </button>
                      {!hasValidAmount && (
                        <p className="text-[11px] text-slate-400 font-medium text-center mt-3 leading-relaxed">
                          Ingresa el monto que deseas donar
                        </p>
                      )}
                      {amountBelowTier && selectedTier && (
                        <p className="text-[11px] text-amber-600 font-bold text-center mt-2">
                          Mínimo Bs. {selectedTier.amount.toLocaleString('es-BO')} para esta recompensa
                        </p>
                      )}
                      {amountTooLow && (
                        <p className="text-[11px] text-amber-600 font-bold text-center mt-2">
                          Donación mínima: Bs. {campaign.minInvestment?.toLocaleString('es-BO')}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Campaign status card */}
              <div className="bg-white rounded-[28px] shadow-sm border border-green-50 p-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full animate-pulse"
                    style={{
                      backgroundColor:
                        campaign.status === 'published' ? '#72B626'
                          : campaign.status === 'funded' ? '#f9a825'
                          : '#64748b',
                    }}
                  />
                  <span className="text-[12px] font-black text-slate-500 uppercase tracking-widest">
                    {campaign.status === 'published' ? 'Campaña Activa'
                      : campaign.status === 'funded' ? 'Completamente Financiada'
                      : campaign.status === 'partially_funded' ? 'Parcialmente Financiada'
                      : campaign.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* end flex row */}
      </div>
      {/* end max-width container */}

      {/* ── Related Campaigns ── */}
      {relatedCampaigns.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Sparkles size={20} strokeWidth={2.5} className="text-[#72B626]" />
            </div>
            <h2 className="text-xl font-black text-[#1c2b1e] tracking-tight">
              También te puede interesar
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedCampaigns.map(rc => {
              const rcProgress = rc.goalAmount > 0
                ? Math.min(Math.round((rc.currentAmount / rc.goalAmount) * 100), 100)
                : 0;
              const rcCover = getImageUrl(rc.coverImageUrl);
              let rcDays: number | null = null;
              if (rc.endDate) {
                const ms = new Date(rc.endDate).getTime() - Date.now();
                rcDays = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
              }

              return (
                <div
                  key={rc.id}
                  onClick={() => navigate(`/campaign/${rc.id}`)}
                  className="bg-white rounded-[22px] shadow-sm border border-green-50 overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col"
                >
                  {/* Cover */}
                  <div className="relative h-40 bg-gradient-to-br from-[#1c2b1e] to-[#72B626] overflow-hidden">
                    {rcCover ? (
                      <img src={rcCover} alt={rc.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Rocket size={36} strokeWidth={1} className="text-white/20" />
                      </div>
                    )}

                    {/* Category badge */}
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[9px] font-black text-[#1c2b1e] uppercase tracking-widest shadow-sm">
                      {rc.categoryName}
                    </div>

                    {/* Ending soon */}
                    {rcDays !== null && rcDays > 0 && rcDays <= 7 && (
                      <div className="absolute bottom-2.5 left-3 bg-red-500/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-[9px] font-black text-white uppercase tracking-wider shadow-lg shadow-red-500/30 flex items-center gap-1 animate-pulse">
                        <Flame size={10} strokeWidth={3} />
                        {rcDays === 1 ? '¡Último día!' : `${rcDays} días`}
                      </div>
                    )}

                    {/* Mini progress */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                      <div className="h-full bg-white/90" style={{ width: `${rcProgress}%` }} />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5 flex-1 flex flex-col gap-2">
                    <h4 className="text-[14px] font-black text-[#1c2b1e] leading-tight line-clamp-2 group-hover:text-[#72B626] transition-colors">
                      {rc.title}
                    </h4>
                    <p className="text-[12px] text-slate-400 font-bold">
                      por {rc.entrepreneurDisplayName ? `@${rc.entrepreneurDisplayName}` : rc.entrepreneurName}
                    </p>

                    <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-50">
                      <div className="flex items-center gap-1.5">
                        <Target size={12} strokeWidth={2.5} className="text-[#72B626]" />
                        <span className="text-[12px] font-black text-[#72B626]">{rcProgress}%</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-400">
                        Bs. {rc.currentAmount.toLocaleString('es-BO')} / Bs. {rc.goalAmount.toLocaleString('es-BO')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Contribution Confirmation Modal ── */}
      {/* ── Floating Donate Button (Mobile) ── */}
      {acceptsDonations && !investmentSuccess && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={scrollToDonationCard}
            className="bg-[#72B626] hover:bg-[#5a911e] text-white px-6 py-3.5 rounded-full font-black text-[14px] uppercase tracking-widest shadow-xl shadow-[#72B626]/30 transition-all active:scale-95 flex items-center justify-center gap-2 border-none cursor-pointer"
          >
            Donar Ahora
          </button>
        </div>
      )}

      {showConfirmModal && (
        <ContributionConfirmModal
          campaign={{
            title: campaign.title,
            campaignType: campaign.campaignType,
            entrepreneurName: campaign.entrepreneurName,
            coverImageUrl: campaign.coverImageUrl ?? undefined,
            currency: campaign.currency,
            status: campaign.status,
            location: undefined,
            endDate: campaign.endDate ?? undefined,
            shortDescription: campaign.shortDescription ?? undefined,
          }}
          amount={parseFloat(customAmount)}
          selectedTier={
            selectedTierId
              ? campaign.rewardTiers?.find((t) => t.id === selectedTierId) || null
              : null
          }
          loading={investmentLoading}
          onConfirm={async () => {
            // handleConfirmInvest is defined inside the IIFE above,
            // so we replicate the logic here for the modal callback
            setInvestmentLoading(true);
            setInvestmentError(null);
            try {
              const res = await createInvestment({
                campaignId: campaign.id,
                amount: parseFloat(customAmount),
                rewardTierId: selectedTierId || undefined,
              });
              const invId = (res as any)?.ticket?.id || (res as any)?.id || null;
              if (invId) setLastInvestmentId(invId);
              setShowConfirmModal(false);
              setInvestmentSuccess(true);
              // Recargar datos de la campaña en tiempo real
              refetch();
            } catch (err: any) {
              const msg = err?.response?.data?.message || 'Error al procesar la inversión. Intenta nuevamente.';
              setInvestmentError(typeof msg === 'string' ? msg : msg[0] || 'Error desconocido.');
              setShowConfirmModal(false);
            } finally {
              setInvestmentLoading(false);
            }
          }}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}

      {showShareModal && campaign && (
        <ShareModal
          campaignId={campaign.id}
          campaignTitle={campaign.title}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
