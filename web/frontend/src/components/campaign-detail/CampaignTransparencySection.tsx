import { lazy, useState } from 'react';
import { AsyncContent } from '../AsyncContent.tsx';
import type { BudgetCategory, FundingMilestone } from '../../types/campaign-content.types';
import { FileText, Rocket, Sparkles, PieChart as PieIcon, Receipt } from 'lucide-react';
import { FundAllocationPlan } from './transparency/FundAllocationPlan';
import { ProjectMilestones } from './transparency/ProjectMilestones';
import { PublicEvidenceDocuments } from './transparency/PublicEvidenceDocuments';
import { usePublicCampaignDocuments } from '../../hooks/usePublicCampaignDocuments';
import { usePublicCampaignUpdates } from '../../hooks/usePublicCampaignUpdates';
import { CampaignUpdatesTimeline } from './transparency/CampaignUpdatesTimeline';
import { usePublicCampaignFinance } from '../../hooks/usePublicCampaignFinance';

const PublicFinancialAuditing = lazy(() =>
  import('./transparency/PublicFinancialAuditing').then((module) => ({
    default: module.PublicFinancialAuditing,
  })),
);

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
  customBudgetPlan?: BudgetCategory[];
  customMilestones?: FundingMilestone[];
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
  const { finance, loading, error: financeError, retry: retryFinance } = usePublicCampaignFinance(campaignId);
  const { documents, loading: documentsLoading, error: documentsError, retry: retryDocuments } = usePublicCampaignDocuments(campaignId);
  const { updates, loading: updatesLoading, error: updatesError, retry: retryUpdates } = usePublicCampaignUpdates(campaignId);

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
        <AsyncContent label="Cargando estadísticas...">
          <PublicFinancialAuditing
            campaignId={campaignId}
            finance={finance}
            loading={loading}
            error={financeError}
            onRetry={retryFinance}
            startDate={startDate}
            createdAt={createdAt}
          />
        </AsyncContent>
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
          loading={documentsLoading}
          error={documentsError}
          onRetry={retryDocuments}
        />
      )}

      {subTab === 'bitacora' && (
        <CampaignUpdatesTimeline
          updates={updates}
          loading={updatesLoading}
          error={updatesError}
          onRetry={retryUpdates}
          entrepreneurName={entrepreneurName}
          entrepreneurAvatar={entrepreneurAvatar}
        />
      )}
    </div>
  );
}

