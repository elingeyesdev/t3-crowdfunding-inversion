import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EntrepreneurCampaign, CampaignFinancialProgress } from '../types/campaign.types';
import { CircularFundingRing } from './CircularFundingRing';
import { CampaignInvestorsTab } from './CampaignInvestorsTab';
import { CampaignRewardsTab } from './CampaignRewardsTab';
import { CampaignAnalyticsDashboard } from './CampaignAnalyticsDashboard';
import { getCampaignFinancialProgress, getCampaignHistory as getEntrepreneurHistory, getCampaignDocuments as getEntrepreneurDocuments } from '../api/campaign.api';
import { getCampaignFinancialProgress as getAdminFinancialProgress, getCampaignHistory as getAdminHistory, getAdminCampaignDocuments, reviewAdminCampaignDocument } from '../api/admin.api';
import type { CampaignHistoryItem } from '../types/admin.types';
import { formatCampaignCurrency } from '../utils/campaignFunding';
import { getImageUrl } from '../utils/image.utils';
import {
  FileText,
  TrendingUp,
  Users,
  X,
  AlertTriangle,
  Rocket,
  Camera,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Globe,
  Gift,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Heart,
  Clock,
  Play,
  Share2,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';



function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Borrador',
    published: 'Publicada',
    in_review: 'En revisión',
    pending_review: 'En revisión',
    approved: 'Aprobado',
    rejected: 'Rechazado',
  };
  return map[status] ?? status;
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

interface RewardTier {
  id?: string;
  title: string;
  description: string;
  minPercentage: number;
  maxPercentage: number;
}

interface EntrepreneurInfo {
  firstName: string;
  lastName: string;
  email: string;
  bio?: string;
  avatar?: string;
  linkedin?: string;
  website?: string;
}

interface Props {
  campaign: EntrepreneurCampaign | null;
  open: boolean;
  onClose: () => void;
  // Entrepreneur actions
  onSubmitForReview?: () => void;
  onPublish?: () => void;
  onEdit?: (campaign: EntrepreneurCampaign) => void;
  onUploadImage?: (campaignId: string, file: File) => Promise<boolean>;
  // Admin actions
  isAdmin?: boolean;
  onApprove?: () => void;
  onReject?: (feedback: string) => void;
  // Shared
  actionLoading?: boolean;
  rewardTiers?: RewardTier[];
  entrepreneur?: EntrepreneurInfo;
  // Additional Attributes for Expert View
  media?: { url: string; type: string }[];
  minInvestment?: number;
  maxInvestment?: number;
  subtitle?: string;
  risksAndChallenges?: string;
  videoUrl?: string;
  tags?: string[];
  socialLinks?: Record<string, string>;
  auditScore?: number;
}

export function CampaignPreviewModal({
  campaign,
  open,
  onClose,
  onSubmitForReview,
  onPublish,
  onEdit,
  onUploadImage,
  actionLoading,
  rewardTiers,
  entrepreneur,
  isAdmin,
  onApprove,
  onReject,
  minInvestment,
  maxInvestment,
  subtitle,
  risksAndChallenges,
  videoUrl,
  tags,
  socialLinks,
  auditScore,
}: Props) {
  const [finance, setFinance] = useState<CampaignFinancialProgress | null>(null);
  const [history, setHistory] = useState<CampaignHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'investors' | 'rewards' | 'documents' | 'analytics'>('details');

  const [documents, setDocuments] = useState<any[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  // Custom modal dialog states
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    type: 'alert' | 'confirm' | 'prompt';
    title: string;
    message: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (val?: string) => void;
    onCancel?: () => void;
  } | null>(null);
  const [dialogInput, setDialogInput] = useState('');

  // Helper dialog methods returning promises
  const showAlert = (title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        type: 'alert',
        title,
        message,
        onConfirm: () => {
          setDialog(null);
          resolve();
        }
      });
    });
  };

  const showPrompt = (title: string, message: string, placeholder = '', defaultValue = ''): Promise<string | null> => {
    setDialogInput(defaultValue);
    return new Promise((resolve) => {
      setDialog({
        isOpen: true,
        type: 'prompt',
        title,
        message,
        placeholder,
        defaultValue,
        onConfirm: (val) => {
          setDialog(null);
          resolve(val || '');
        },
        onCancel: () => {
          setDialog(null);
          resolve(null);
        }
      });
    });
  };

  const effectiveRewards = rewardTiers || campaign?.rewardTiers || [];
  const canEdit = campaign?.status === 'draft' || campaign?.status === 'rejected';
  const canSubmit = campaign?.status === 'draft' || campaign?.status === 'rejected';
  const canPublish = campaign?.status === 'approved';
  const isPendingReview = campaign?.status === 'pending_review' || campaign?.status === 'in_review';

  useEffect(() => {
    if (open && campaign) {
      loadHistory();
      if (campaign.status === 'published' || campaign.status === 'funded' || isAdmin) {
        loadFinance();
      }
    } else {
      setFinance(null);
      setHistory([]);
      setAdminFeedback('');
      setActiveTab('details');
    }
  }, [open, campaign]);

  const loadFinance = async () => {
    if (!campaign) return;
    try {
      const data = isAdmin
        ? await getAdminFinancialProgress(campaign.id)
        : await getCampaignFinancialProgress(campaign.id);
      setFinance(data);
    } catch (err) {
      console.error('Error loading finance:', err);
    } finally {
    }
  };

  const loadHistory = async () => {
    if (!campaign) return;
    try {
      setHistoryLoading(true);
      const data = isAdmin
        ? await getAdminHistory(campaign.id)
        : await getEntrepreneurHistory(campaign.id);
      setHistory(data);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadDocuments = async () => {
    if (!campaign) return;
    try {
      setDocumentsLoading(true);
      const data = isAdmin
        ? await getAdminCampaignDocuments(campaign.id)
        : await getEntrepreneurDocuments(campaign.id);
      setDocuments(data);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setDocumentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'documents' && campaign) {
      loadDocuments();
    }
  }, [activeTab, campaign]);

  const handleReviewDocument = async (docId: string, status: 'approved' | 'rejected') => {
    if (status === 'rejected') {
      const feedback = await showPrompt('Rechazar Documento', 'Motivo del rechazo del documento:');
      if (feedback === null) return; // Cancelled
      if (!feedback.trim()) {
        await showAlert('Rechazo Inválido', 'El motivo del rechazo es obligatorio.');
        return;
      }
      
      try {
        await reviewAdminCampaignDocument(campaign!.id, docId, status, feedback);
        await loadDocuments();
      } catch (err) {
        console.error('Error reviewing document:', err);
        await showAlert('Error', 'Error al actualizar el estado del documento.');
      }
    } else {
      try {
        await reviewAdminCampaignDocument(campaign!.id, docId, status, '');
        await loadDocuments();
      } catch (err) {
        console.error('Error reviewing document:', err);
        await showAlert('Error', 'Error al actualizar el estado del documento.');
      }
    }
  };

  const handleImageClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && campaign && onUploadImage) {
        setUploading(true);
        try {
          await onUploadImage(campaign.id, file);
        } finally {
          setUploading(false);
        }
      }
    };
    input.click();
  };

  if (!open || !campaign) return null;

  const cur = finance?.currentAmount ?? campaign.currentAmount;
  const goal = finance?.goalAmount ?? campaign.goalAmount;
  const currency = campaign.currency || 'BOB';
  const investorsTotal = finance?.investorCount ?? campaign.investorCount;
  const recent = finance?.recentInvestments ?? [];


  const node = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 font-['Plus Jakarta Sans',sans-serif] animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <div className="absolute inset-0 bg-[#1c2b1e]/80 backdrop-blur-md" onClick={onClose} aria-hidden="true" />

      <div className="bg-[#f8fafc] rounded-[40px] w-full max-w-[1200px] max-h-[95vh] overflow-hidden relative z-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] animate-in zoom-in-95 duration-500 border border-white/20 flex flex-col">

        {/* Top Navigation Bar */}
        <header className="bg-white/80 backdrop-blur-xl px-4 md:px-10 py-4 md:py-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 z-30 relative">
          <div className="flex items-center gap-6 w-full sm:w-auto">
            <div className="flex flex-col">
              <div className="hidden sm:flex flex-wrap items-center gap-2 md:gap-3 mb-1">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                  ID: {campaign.id.split('-')[0]}
                </span>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">
                  {isAdmin ? 'Módulo de Revisión de Capital' : 'Revisión Técnica de Proyecto'}
                </span>
                {auditScore !== undefined && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                      Score: {auditScore}/100
                    </span>
                  </div>
                )}
              </div>
              <h2 id="preview-title" className="text-xl md:text-2xl font-black text-[#1c2b1e] tracking-tight leading-none mb-2 max-w-xl truncate pr-12 sm:pr-0">
                {campaign.title}
              </h2>
              {campaign.shortDescription && (
                <p className="text-[13px] md:text-[14px] font-medium text-slate-500 line-clamp-1 max-w-2xl italic pr-8 sm:pr-0">
                  {campaign.shortDescription}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 absolute top-4 right-4 sm:relative sm:top-auto sm:right-auto">
            <div className="hidden md:flex flex-col items-end mr-2 md:mr-4">
              <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Estado Actual</span>
              <span className={`px-3 md:px-4 py-1 md:py-1.5 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest shadow-sm border ${campaign.status === 'pending_review' || campaign.status === 'in_review'
                ? 'bg-amber-50 text-amber-600 border-amber-100'
                : campaign.status === 'approved' || campaign.status === 'published'
                  ? 'bg-[#f0f9e0] text-[#72B626] border-gray-100'
                  : campaign.status === 'rejected'
                    ? 'bg-red-50 text-red-600 border-red-100'
                    : 'bg-slate-50 text-slate-500 border-slate-100'
                }`}>
                {statusLabel(campaign.status || 'draft')}
              </span>
            </div>
            <button
              type="button"
              className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all active:scale-95 flex items-center justify-center border-none cursor-pointer group"
              onClick={onClose}
            >
              <X size={20} strokeWidth={2.5} className="md:w-6 md:h-6 group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="bg-white px-4 md:px-10 border-b border-slate-100 flex items-center gap-6 md:gap-8 z-30 overflow-x-auto scrollbar-hide whitespace-nowrap">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-4 md:py-5 text-[11px] md:text-[12px] font-black uppercase tracking-widest border-b-4 transition-all border-none cursor-pointer shrink-0 ${activeTab === 'details' ? 'border-[#72B626] text-[#1c2b1e]' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
          >
            Detalles de Proyecto
          </button>
          {(campaign.status === 'published' || campaign.status === 'funded' || isAdmin) && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-4 md:py-5 text-[11px] md:text-[12px] font-black uppercase tracking-widest border-b-4 transition-all border-none cursor-pointer flex items-center gap-2 shrink-0 ${activeTab === 'analytics' ? 'border-[#72B626] text-[#1c2b1e]' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
            >
              <TrendingUp size={14} className={activeTab === 'analytics' ? 'text-green-500' : 'text-slate-400'} />
              Progreso Económico
            </button>
          )}
          {(campaign.status === 'published' || campaign.status === 'funded') && (
            <button
              onClick={() => setActiveTab('investors')}
              className={`py-4 md:py-5 text-[11px] md:text-[12px] font-black uppercase tracking-widest border-b-4 transition-all border-none cursor-pointer shrink-0 ${activeTab === 'investors' ? 'border-[#72B626] text-[#1c2b1e]' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
            >
              Donadores Activos ({investorsTotal})
            </button>
          )}
          {campaign.rewardTiers && campaign.rewardTiers.length > 0 && !isAdmin && (
            <button
              onClick={() => setActiveTab('rewards')}
              className={`py-4 md:py-5 text-[11px] md:text-[12px] font-black uppercase tracking-widest border-b-4 transition-all border-none cursor-pointer flex items-center gap-2 shrink-0 ${activeTab === 'rewards' ? 'border-[#72B626] text-[#1c2b1e]' : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
            >
              <Gift size={14} className={activeTab === 'rewards' ? 'text-amber-500' : 'text-slate-400'} />
              Recompensas
            </button>
          )}
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-4 md:py-5 text-[11px] md:text-[12px] font-black uppercase tracking-widest border-b-4 transition-all border-none cursor-pointer flex items-center gap-2 shrink-0 ${activeTab === 'documents' ? 'border-[#72B626] text-[#1c2b1e]' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
          >
            <FileText size={14} className={activeTab === 'documents' ? 'text-blue-500' : 'text-slate-400'} />
            Documentación
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row bg-[#f8fafc]">
          {activeTab === 'details' ? (
            <>
              {/* Left Column: Detailed Content */}
              <main className="flex-1 p-5 md:p-10 lg:p-12 space-y-8 md:space-y-12">
                {/* Rejection Feedback Alert */}
                {campaign.status === 'rejected' && (
                  <div className="bg-red-50 border-2 border-red-100 p-8 rounded-[40px] shadow-sm animate-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-4 text-red-700 mb-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                        <AlertTriangle size={24} strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-[12px] font-black uppercase tracking-[0.2em] leading-none mb-1">Propuesta Rechazada</h3>
                        <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Requiere ajustes técnicos para aprobación</span>
                      </div>
                    </div>
                    <div className="bg-white/80 p-6 rounded-[24px] border border-red-100 italic text-[15px] text-red-900/80 font-medium leading-relaxed relative">
                      <div className="absolute -top-3 -left-3 bg-red-100 text-red-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-white shadow-sm">
                        Retroalimentación Oficial
                      </div>
                      "{history.find(h => h.to_status === 'rejected')?.feedback || 'No se ha proporcionado un motivo detallado aún. Por favor, revisa las especificaciones generales.'}"
                    </div>
                  </div>
                )}

                {/* Visual Assets Section */}
                <section className="space-y-6">
                  <div className="relative group h-[400px] rounded-[32px] overflow-hidden bg-slate-900 border border-slate-200 shadow-2xl">
                    {getImageUrl(campaign.coverImageUrl) ? (
                      <img
                        src={getImageUrl(campaign.coverImageUrl)}
                        alt="Cover"
                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=2574&auto=format&fit=crop';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center text-slate-600">
                        <ImageIcon size={80} strokeWidth={1} className="mb-4 opacity-20" />
                        <span className="text-[12px] font-black uppercase tracking-[0.2em] opacity-40">Digital Asset Missing</span>
                      </div>
                    )}

                    {/* Type & Category Overlays */}
                    <div className="absolute top-6 left-6 flex flex-wrap gap-3">
                      <span className="px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl text-[11px] font-black text-white uppercase tracking-widest shadow-xl flex items-center gap-2">
                        {campaign.categoryName || 'General'}
                      </span>
                    </div>

                    {videoUrl && (
                      <div className="absolute top-6 right-6">
                        <a href={videoUrl} target="_blank" rel="noreferrer" className="w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-2xl flex items-center justify-center shadow-xl transition-all active:scale-95">
                          <Play size={20} fill="currentColor" />
                        </a>
                      </div>
                    )}

                    {onUploadImage && !isAdmin && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                        <button
                          onClick={handleImageClick}
                          disabled={uploading}
                          className="bg-white text-[#1c2b1e] px-8 py-4 rounded-[20px] font-black text-[13px] uppercase tracking-widest shadow-2xl flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50 border-none cursor-pointer"
                        >
                          {uploading ? <Loader2 className="animate-spin" /> : <Camera size={18} />}
                          Actualizar Portada
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                {/* Project Specifications */}
                <section className="space-y-8">
                  <div className="flex items-center gap-3 text-slate-900 border-b border-slate-200 pb-4">
                    <FileText size={20} strokeWidth={2.5} />
                    <h3 className="text-[12px] font-black uppercase tracking-[0.2em]">Especificaciones Técnicas</h3>
                  </div>

                  <div className="space-y-8">
                    {subtitle && (
                      <p className="text-xl font-black text-slate-400 tracking-tight leading-relaxed italic border-l-4 border-indigo-100 pl-6">
                        {subtitle}
                      </p>
                    )}

                    <div className="prose prose-slate max-w-none">
                      <p className="text-[16px] text-slate-600 leading-[1.8] font-medium whitespace-pre-wrap">
                        {campaign.description || 'La documentación descriptiva aún no ha sido finalizada por el emprendedor.'}
                      </p>
                    </div>

                    {tags && tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-4">
                        {tags.map((tag, idx) => (
                          <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {risksAndChallenges && (
                    <div className="bg-amber-50/50 border border-amber-100 p-8 rounded-[32px] space-y-4 shadow-sm">
                      <div className="flex items-center gap-3 text-amber-700">
                        <AlertTriangle size={20} strokeWidth={2.5} />
                        <h4 className="text-[11px] font-black uppercase tracking-widest">Riesgos y Mitigación de Pérdida</h4>
                      </div>
                      <p className="text-[14px] text-amber-900/70 font-medium italic leading-relaxed">
                        "{risksAndChallenges}"
                      </p>
                    </div>
                  )}
                </section>

                {/* Financial Product Structure (Tiers) */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-3 text-[#72B626]">
                      <TrendingUp size={20} strokeWidth={2.5} />
                      <h3 className="text-[12px] font-black uppercase tracking-[0.2em]">Estructura de Captación</h3>
                    </div>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      {effectiveRewards.length} Niveles Disponibles
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {effectiveRewards.map((tier, idx) => (
                      <div key={idx} className="p-6 bg-white border border-slate-100 rounded-3xl flex flex-col gap-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                        <div className="flex justify-between items-start">
                          <div className="w-12 h-12 rounded-2xl bg-[#f0f9e0] text-[#72B626] flex items-center justify-center group-hover:bg-[#72B626] group-hover:text-white transition-colors">
                            <Rocket size={20} />
                          </div>
                          <span className="text-lg font-black text-[#1c2b1e]">
                            {tier.minPercentage}% - {tier.maxPercentage}%
                          </span>
                        </div>
                        <div>
                          <h4 className="font-black text-[15px] text-slate-900 mb-1">{tier.title}</h4>
                          <p className="text-[12px] text-slate-500 font-medium leading-relaxed">{tier.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Social & Web Presence */}
                {socialLinks && Object.keys(socialLinks).length > 0 && (
                  <section className="space-y-6">
                    <div className="flex items-center gap-3 text-slate-900 border-b border-slate-200 pb-4">
                      <Globe size={20} strokeWidth={2.5} />
                      <h3 className="text-[12px] font-black uppercase tracking-[0.2em]">Presencia Digital</h3>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(socialLinks).map(([platform, url]) => (
                        <a
                          key={platform}
                          href={url as string}
                          target="_blank"
                          rel="noreferrer"
                          className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-[12px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm flex items-center gap-3 no-underline"
                        >
                          <span className="opacity-50">{platform}</span>
                          <ExternalLink size={14} />
                        </a>
                      ))}
                    </div>
                  </section>
                )}
              </main>

              {/* Right Column: Expert Analysis & Actions */}
              <aside className="w-full lg:w-[420px] bg-white border-l border-slate-200 flex flex-col z-20 overflow-y-auto">

                {/* Funding Radar Section */}
                <section className="p-10 border-b border-slate-100 space-y-8 bg-slate-50/50">
                  <div className="flex justify-between items-center bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Estado de Campaña</span>
                    <span className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border ${campaign.status === 'pending_review' || campaign.status === 'in_review'
                      ? 'bg-amber-50 text-amber-600 border-amber-100'
                      : campaign.status === 'approved' || campaign.status === 'published'
                        ? 'bg-[#f0f9e0] text-[#72B626] border-gray-100'
                        : campaign.status === 'rejected'
                          ? 'bg-red-50 text-red-600 border-red-100'
                          : 'bg-slate-50 text-slate-500 border-slate-100'
                      }`}>
                      {statusLabel(campaign.status)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <CircularFundingRing currentAmount={cur} goalAmount={goal} />
                    <div className="mt-6 text-center">
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-1">Recaudado</span>
                      <span className="text-4xl font-black text-[#1c2b1e] tracking-tight">
                        {formatCampaignCurrency(cur, currency)}
                      </span>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <div className="w-2 h-2 rounded-full bg-[#72B626] animate-pulse"></div>
                        <span className="text-[13px] font-black text-[#72B626]">
                          {Math.round((cur / goal) * 100)}% Completado
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-200/60">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Donación Mínima</span>
                      <p className="text-[16px] font-black text-slate-800">{formatCampaignCurrency(minInvestment || 1, currency)}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Donación Máxima</span>
                      <p className="text-[16px] font-black text-slate-800">{maxInvestment ? formatCampaignCurrency(maxInvestment, currency) : 'Sin límite'}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="font-bold text-slate-500 flex items-center gap-2"><MapPin size={14} /> Ubicación</span>
                      <span className="font-black text-slate-900">{campaign.location || 'Global'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="font-bold text-slate-500 flex items-center gap-2"><Calendar size={14} /> Fecha Inicio</span>
                      <span className="font-black text-slate-900">{campaign.startDate ? formatShortDate(campaign.startDate) : 'No definida'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="font-bold text-slate-500 flex items-center gap-2"><Clock size={14} /> Fecha Límite</span>
                      <span className="font-black text-slate-900">{campaign.endDate ? formatShortDate(campaign.endDate) : 'Indefinida'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="font-bold text-slate-500 flex items-center gap-2"><Users size={14} /> Donadores Activos</span>
                      <span className="font-black text-slate-900">{investorsTotal} Participantes</span>
                    </div>
                  </div>
                </section>

                {/* Entrepreneur Intelligence Section */}
                <section className="p-10 border-b border-slate-100 space-y-6">
                  <div className="flex items-center gap-3 text-slate-900">
                    <User size={18} strokeWidth={2.5} />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[#1c2b1e]">Revisión del Emprendedor</h3>
                  </div>

                  {entrepreneur ? (
                    <>
                      <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-[24px] border border-slate-100">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-200 flex-shrink-0 shadow-inner">
                          {getImageUrl(entrepreneur.avatar) ? (
                            <img
                              src={getImageUrl(entrepreneur.avatar)}
                              className="w-full h-full object-cover"
                              alt="Proponent"
                              onError={(e) => {
                                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(entrepreneur.firstName || 'E')}+${encodeURIComponent(entrepreneur.lastName || '')}&background=random`;
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400"><User size={24} /></div>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[15px] font-black text-slate-900 truncate leading-none mb-1">{entrepreneur.firstName} {entrepreneur.lastName}</p>
                          <p className="text-[11px] font-bold text-indigo-600 truncate flex items-center gap-1">
                            <Mail size={10} /> {entrepreneur.email}
                          </p>
                        </div>
                      </div>
                      {entrepreneur.bio && (
                        <p className="text-[12px] text-slate-500 font-medium leading-relaxed italic border-l-2 border-slate-100 pl-4 py-1">
                          "{entrepreneur.bio}"
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-[24px] flex flex-col items-center text-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-300">
                        <User size={24} />
                      </div>
                      <div>
                        <p className="text-[13px] font-black text-slate-900 uppercase tracking-tight mb-1">Información del Emprendedor</p>
                        <p className="text-[11px] font-medium text-slate-400 leading-tight max-w-[200px]">
                          {isAdmin ? 'No se pudo recuperar el perfil del emprendedor vinculado a esta campaña.' : 'Aún no has completado tu perfil de emprendedor. Ve a la sección de perfil para actualizarlo.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {entrepreneur?.website && (
                      <a href={entrepreneur.website} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-500 transition-all group">
                        <span className="text-[12px] font-black text-slate-400 group-hover:text-indigo-600">Portal Corporativo</span>
                        <Globe size={16} className="text-slate-300 group-hover:text-indigo-500" />
                      </a>
                    )}
                    {socialLinks && Object.entries(socialLinks).map(([platform, url]) => (
                      <a key={platform} href={url as string} target="_blank" rel="noreferrer" className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-500 transition-all group capitalize">
                        <span className="text-[12px] font-black text-slate-400 group-hover:text-indigo-600">{platform}</span>
                        <Share2 size={16} className="text-slate-300 group-hover:text-indigo-500" />
                      </a>
                    ))}
                  </div>
                </section>

                {/* Audit Logs Section (Visible para ambos) */}
                {(history.length > 0 || historyLoading) && (
                  <section className="p-10 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[#72B626]">
                        <Clock size={18} strokeWidth={2.5} />
                        <h3 className="text-[11px] font-black uppercase tracking-widest">Historial de Revisión</h3>
                      </div>
                    </div>

                    <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                      {historyLoading ? (
                        <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-200" /></div>
                      ) : history.length > 0 ? (
                        history.map((item, idx) => (
                          <div key={idx} className="relative pl-8">
                            <div className="absolute left-[3px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-indigo-400 shadow-sm"></div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-black text-slate-900">
                                  {statusLabel(item.to_status)}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400">{formatShortDate(item.created_at)}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic line-clamp-2">
                                "{item.feedback || 'Sin notas.'}"
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center pl-4">Nueva Propuesta Técnica</p>
                      )}
                    </div>
                  </section>
                )}
                {/* Recent Capital Inflow (Inversores) */}
                {recent && recent.length > 0 && (
                  <section className="p-10 border-b border-slate-100 space-y-6">
                    <div className="flex items-center gap-3 text-[#1c2b1e]">
                      <TrendingUp size={18} strokeWidth={2.5} />
                      <h3 className="text-[11px] font-black uppercase tracking-widest">Donaciones Recientes</h3>
                    </div>
                    <div className="space-y-4">
                      {recent.map((inv, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[10px]">
                              {(inv.investorDisplayName || 'Anónimo').substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[12px] font-bold text-slate-700">{inv.isAnonymous ? 'Donador Anónimo' : (inv.investorDisplayName || 'Usuario')}</span>
                              {inv.rewardTitle && (
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1">
                                  <Heart size={8} fill="currentColor" /> {inv.rewardTitle}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[12px] font-black text-[#72B626]">+{formatCampaignCurrency(inv.amount, currency)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </aside>
            </>
          ) : activeTab === 'investors' ? (
            <div className="flex-1 p-10 lg:p-12 overflow-y-auto bg-slate-50/30">
              <CampaignInvestorsTab campaignId={campaign.id} currency={currency} isAdmin={isAdmin} />
            </div>
          ) : activeTab === 'rewards' ? (
            <div className="flex-1 p-10 lg:p-12 overflow-y-auto bg-slate-50/30">
              <CampaignRewardsTab campaignId={campaign.id} currency={currency} readOnly={true} isAdmin={isAdmin} />
            </div>
          ) : activeTab === 'analytics' ? (
            <div className="flex-1 p-10 lg:p-12 overflow-y-auto bg-slate-50/30">
              <CampaignAnalyticsDashboard
                finance={finance}
                campaignType={campaign.campaignType}
                startDate={campaign.startDate}
                createdAt={campaign.createdAt}
              />
            </div>
          ) : activeTab === 'documents' ? (
            <div className="flex-1 p-10 lg:p-12 overflow-y-auto bg-slate-50/30">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black text-[#1c2b1e] mb-6 flex items-center gap-2">
                  <FileText size={24} className="text-blue-500" />
                  Documentos de Respaldo
                </h3>
                {documentsLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" size={32} /></div>
                ) : documents.length === 0 ? (
                  <p className="text-slate-400 text-center py-10">No hay documentos subidos para esta campaña.</p>
                ) : (
                  <div className="space-y-4">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border border-slate-100 rounded-2xl gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-[14px] mb-1">{doc.original_filename}</p>
                          <p className="text-[12px] text-slate-500">{doc.justification}</p>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">
                            Estado: <span className={`font-bold ${doc.verification_status === 'approved' ? 'text-[#72B626]' : doc.verification_status === 'rejected' ? 'text-red-500' : 'text-amber-500'}`}>{statusLabel(doc.verification_status)}</span>
                          </p>
                          {doc.reviewer_notes && <p className="text-[11px] text-red-500 mt-1 italic">"{doc.reviewer_notes}"</p>}
                        </div>
                        <div className="flex gap-2">
                          <a href={getImageUrl(doc.file_url)} target="_blank" rel="noreferrer" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[12px] font-bold no-underline">Ver Documento</a>
                          {isAdmin && doc.verification_status === 'pending' && (
                            <>
                              <button onClick={() => handleReviewDocument(doc.id, 'approved')} className="px-4 py-2 bg-[#f0f9e0] hover:bg-[#f0f9e0] text-[#4a7f1a] rounded-lg text-[12px] font-bold border-none cursor-pointer">Aprobar</button>
                              <button onClick={() => handleReviewDocument(doc.id, 'rejected')} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-[12px] font-bold border-none cursor-pointer">Rechazar</button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Action Panel: Compact Sticky Footer */}
        {((isAdmin && isPendingReview) || (!isAdmin && (canSubmit || canPublish))) && (
          <footer className="sticky bottom-0 bg-white/80 backdrop-blur-md border-t border-slate-200 px-8 py-5 z-30 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)]">
            {isAdmin && isPendingReview ? (
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 w-full relative">
                  <textarea
                    value={adminFeedback}
                    onChange={(e) => setAdminFeedback(e.target.value)}
                    placeholder="La retroalimentación es obligatoria para rechazar..."
                    className={`w-full pl-5 pr-12 py-3 bg-slate-50 border ${!adminFeedback.trim() ? 'border-amber-200 focus:border-amber-400' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl text-[13px] font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none transition-all h-14 resize-none shadow-inner`}
                  />
                  <div className={`absolute right-4 top-1/2 -translate-y-1/2 ${!adminFeedback.trim() ? 'text-amber-400' : 'text-slate-300'}`}>
                    <FileText size={18} />
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={() => onReject?.(adminFeedback)}
                    disabled={actionLoading || !adminFeedback.trim()}
                    className="flex-1 md:px-6 h-14 bg-red-50 hover:bg-red-500 text-red-600 hover:text-white rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed border-none cursor-pointer flex items-center justify-center gap-2 min-w-[140px]"
                    title={!adminFeedback.trim() ? "Debe escribir un motivo para rechazar" : ""}
                  >
                    <XCircle size={18} /> Rechazar
                  </button>
                  <button
                    onClick={() => onApprove?.()}
                    disabled={actionLoading}
                    className="flex-1 md:px-10 h-14 bg-[#1c2b1e] hover:bg-[#72B626] text-white rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-[#1c2b1e]/20/10 border-none cursor-pointer flex items-center justify-center gap-2 min-w-[160px]"
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle size={18} /> Aprobar</>}
                  </button>
                </div>
              </div>
            ) : (canSubmit || canPublish) ? (
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="hidden lg:flex items-center gap-3 text-slate-400">
                  <ShieldCheck size={18} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Certificación de Integridad Auditable</span>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  {canEdit && (
                    <button
                      onClick={() => onEdit?.(campaign!)}
                      disabled={actionLoading}
                      className="flex-1 md:w-48 h-14 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all active:scale-95 border-none cursor-pointer flex items-center justify-center gap-2"
                    >
                      <FileText size={16} strokeWidth={2.5} /> Editar
                    </button>
                  )}
                  {canSubmit && (
                    <button
                      onClick={onSubmitForReview}
                      disabled={actionLoading}
                      className="flex-1 md:w-56 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-amber-500/20 border-none cursor-pointer flex items-center justify-center gap-2"
                    >
                      <AlertTriangle size={16} strokeWidth={2.5} /> Enviar Revisión
                    </button>
                  )}
                  {canPublish && (
                    <button
                      onClick={onPublish}
                      disabled={actionLoading}
                      className="flex-1 md:w-56 h-14 bg-[#72B626] hover:bg-[#1c2b1e] text-white rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-[#72B626]/20/20 border-none cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Rocket size={16} strokeWidth={2.5} /> Lanzar
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </footer>
        )}

        {/* Custom modal dialog */}
        {dialog && dialog.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 font-['Plus Jakarta Sans',sans-serif] animate-in fade-in duration-200">
            <div 
              className="absolute inset-0 bg-[#1c2b1e]/60 backdrop-blur-sm" 
              onClick={() => dialog.onCancel ? dialog.onCancel() : dialog.onConfirm()} 
            />
            <div className="bg-white rounded-3xl w-full max-w-md p-6 relative z-10 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
              <h3 className="text-lg font-black text-[#1c2b1e] mb-2">{dialog.title}</h3>
              <p className="text-slate-500 font-medium text-sm mb-4 leading-relaxed">{dialog.message}</p>
              
              {dialog.type === 'prompt' && (
                <input
                  type="text"
                  placeholder={dialog.placeholder || "Escribe aquí..."}
                  value={dialogInput}
                  onChange={(e) => setDialogInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium mb-5"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      dialog.onConfirm(dialogInput);
                    }
                  }}
                />
              )}
              
              <div className="flex justify-end gap-3">
                {dialog.type !== 'alert' && (
                  <button
                    onClick={() => dialog.onCancel?.()}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 border-none cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={() => dialog.onConfirm(dialogInput)}
                  className={`px-5 py-2.5 font-bold rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 border-none cursor-pointer text-white ${
                    dialog.type === 'prompt' && dialog.title.toLowerCase().includes('rechaz')
                      ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20'
                      : 'bg-[#1c2b1e] hover:bg-[#72B626] shadow-lg shadow-[#1c2b1e]/20'
                  }`}
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
