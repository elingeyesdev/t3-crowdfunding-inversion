import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  FileText,
  Rocket,
  Sparkles,
  PieChart as PieIcon,
  Layers,
  Receipt,
  CheckCircle2,
} from 'lucide-react';
import { FundAllocationPlan } from './transparency/FundAllocationPlan';
import { PublicFinancialAuditing } from './transparency/PublicFinancialAuditing';
import { ProjectMilestones } from './transparency/ProjectMilestones';
import { PublicEvidenceDocuments } from './transparency/PublicEvidenceDocuments';
import { CampaignUpdatesTimeline } from './transparency/CampaignUpdatesTimeline';
import {
  fetchPublicCampaignFinancialProgress,
  fetchPublicCampaignDocuments,
  fetchPublicCampaignUpdates,
  type PublicCampaignDocument,
  type PublicCampaignUpdate,
} from '../../api/public-campaigns.api';
import type { CampaignFinancialProgress } from '../../types/campaign.types';

export type TransparencySubTab = 'presupuesto' | 'auditoria' | 'hitos' | 'evidencias' | 'bitacora';

interface Props {
  campaignId: string;
  goalAmount: number;
  currentAmount: number;
  currency?: string;
  startDate?: string | Date | null;
  createdAt?: string | Date | null;
  entrepreneurName?: string;
  entrepreneurAvatar?: string | null;
  customBudgetPlan?: any;
  customMilestones?: any;
}

export function CampaignTransparencySection({
  campaignId,
  goalAmount,
  currentAmount,
  currency = 'BOB',
  startDate,
  createdAt,
  entrepreneurName,
  entrepreneurAvatar,
  customBudgetPlan,
  customMilestones,
}: Props) {
  const [subTab, setSubTab] = useState<TransparencySubTab>('presupuesto');

  // State for data
  const [finance, setFinance] = useState<CampaignFinancialProgress | null>(null);
  const [documents, setDocuments] = useState<PublicCampaignDocument[]>([]);
  const [updates, setUpdates] = useState<PublicCampaignUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadTransparencyData() {
      try {
        setLoading(true);
        const [financeData, docsData, updatesData] = await Promise.allSettled([
          fetchPublicCampaignFinancialProgress(campaignId),
          fetchPublicCampaignDocuments(campaignId),
          fetchPublicCampaignUpdates(campaignId),
        ]);

        if (isMounted) {
          if (financeData.status === 'fulfilled') {
            setFinance(financeData.value);
          }
          if (docsData.status === 'fulfilled') {
            setDocuments(docsData.value || []);
          }
          if (updatesData.status === 'fulfilled') {
            setUpdates(updatesData.value || []);
          }
        }
      } catch (err) {
        console.error('Error cargando datos de transparencia pública:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (campaignId) {
      loadTransparencyData();
    }

    return () => {
      isMounted = false;
    };
  }, [campaignId]);

  return (
    <div className="space-y-6 font-['Plus Jakarta Sans',sans-serif]">
      {/* ── Sub-navigation bar ── */}
      <div className="bg-white rounded-2xl p-2 border border-slate-100 shadow-sm flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSubTab('presupuesto')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[12px] uppercase tracking-wider shrink-0 transition-all border-none cursor-pointer ${
            subTab === 'presupuesto'
              ? 'bg-[#1c2b1e] text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 bg-transparent'
          }`}
        >
          <PieIcon size={14} className={subTab === 'presupuesto' ? 'text-[#72B626]' : 'text-slate-400'} />
          <span>Plan de Fondos</span>
        </button>

        <button
          onClick={() => setSubTab('auditoria')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[12px] uppercase tracking-wider shrink-0 transition-all border-none cursor-pointer ${
            subTab === 'auditoria'
              ? 'bg-[#1c2b1e] text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 bg-transparent'
          }`}
        >
          <Receipt size={14} className={subTab === 'auditoria' ? 'text-[#72B626]' : 'text-slate-400'} />
          <span>Auditoría y Movimientos</span>
        </button>

        <button
          onClick={() => setSubTab('hitos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[12px] uppercase tracking-wider shrink-0 transition-all border-none cursor-pointer ${
            subTab === 'hitos'
              ? 'bg-[#1c2b1e] text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 bg-transparent'
          }`}
        >
          <Rocket size={14} className={subTab === 'hitos' ? 'text-[#72B626]' : 'text-slate-400'} />
          <span>Hitos del Proyecto</span>
        </button>

        <button
          onClick={() => setSubTab('evidencias')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[12px] uppercase tracking-wider shrink-0 transition-all border-none cursor-pointer ${
            subTab === 'evidencias'
              ? 'bg-[#1c2b1e] text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 bg-transparent'
          }`}
        >
          <FileText size={14} className={subTab === 'evidencias' ? 'text-[#72B626]' : 'text-slate-400'} />
          <span>Evidencias ({documents.length})</span>
        </button>

        <button
          onClick={() => setSubTab('bitacora')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[12px] uppercase tracking-wider shrink-0 transition-all border-none cursor-pointer ${
            subTab === 'bitacora'
              ? 'bg-[#1c2b1e] text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 bg-transparent'
          }`}
        >
          <Sparkles size={14} className={subTab === 'bitacora' ? 'text-[#72B626]' : 'text-slate-400'} />
          <span>Bitácora ({updates.length})</span>
        </button>
      </div>

      {/* ── Sub-Tab Contents ── */}
      {subTab === 'presupuesto' && (
        <FundAllocationPlan
          goalAmount={goalAmount}
          currentAmount={currentAmount}
          currency={currency}
          customPlan={customBudgetPlan}
        />
      )}

      {subTab === 'auditoria' && (
        <PublicFinancialAuditing
          finance={finance}
          startDate={startDate}
          createdAt={createdAt}
        />
      )}

      {subTab === 'hitos' && (
        <ProjectMilestones
          goalAmount={goalAmount}
          currentAmount={currentAmount}
          currency={currency}
          customMilestones={customMilestones}
        />
      )}

      {subTab === 'evidencias' && (
        <PublicEvidenceDocuments
          documents={documents}
          loading={loading}
        />
      )}

      {subTab === 'bitacora' && (
        <CampaignUpdatesTimeline
          updates={updates}
          loading={loading}
          entrepreneurName={entrepreneurName}
          entrepreneurAvatar={entrepreneurAvatar}
        />
      )}
    </div>
  );
}

