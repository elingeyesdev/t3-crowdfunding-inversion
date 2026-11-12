import { RewardTier } from '../../reward-tiers/models/reward-tier.model';

/**
 * Modelo de dominio: Campaña (vista del emprendedor)
 * Subconjunto de campos relevantes para el dashboard del emprendedor.
 */
export interface EntrepreneurCampaign {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  campaignType: string;
  status: string;
  goalAmount: number;
  currentAmount: number;
  investorCount: number;
  currency: string;
  coverImageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  fundedAt: Date | null;
  isFeatured: boolean;
  viewCount: number;
  categoryName: string;
  categorySlug: string;
  categoryId: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  videoUrl: string | null;
  categories?: any[];
  rewardTiers?: RewardTier[];
}

/**
 * Modelo: Progreso financiero de una campaña.
 * Datos calculados para el dashboard de seguimiento.
 */
export interface CampaignFinancialProgress {
  campaignId: string;
  title: string;
  slug: string;
  status: string;
  goalAmount: number;
  currentAmount: number;
  remainingAmount: number;
  fundingPercentage: number;
  investorCount: number;
  currency: string;
  startDate: Date | null;
  endDate: Date | null;
  daysRemaining: number | null;
  fundedAt: Date | null;
  // Desglose por estado de inversión
  investments: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    refunded: number;
  };
  amounts: {
    confirmed: number;
    pending: number;
    refunded: number;
  };
  averageInvestment: number;
  largestInvestment: number;
  smallestInvestment: number;
  // Timeline reciente
  recentInvestments: RecentInvestment[];
  dailyProgress?: { date: string; accumulatedAmount: number }[];
  fundingBreakdown?: { rewardTierId: string | null; rewardTitle: string; totalAmount: number }[];
}

export interface RecentInvestment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  isAnonymous: boolean;
  investorDisplayName: string | null;
  rewardTitle?: string;
  createdAt: Date;
}

/**
 * Resumen financiero de todas las campañas del emprendedor.
 */
export interface EntrepreneurFinancialSummary {
  totalCampaigns: number;
  activeCampaigns: number;
  fundedCampaigns: number;
  totalRaised: number;
  totalInvestors: number;
  averagePerCampaign: number;
  currency: string;
}

export interface CampaignInvestor {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  location: string | null;
  bio: string | null;
  email: string;
  totalInvested: number;
  investmentCount: number;
  lastInvestmentAt: Date;
  investmentId?: string;
  rewardTitle?: string;
}

import { mapRowToRewardTier } from '../../reward-tiers/models/reward-tier.model';

/**
 * Mapea un row de PostgreSQL al modelo de campaña del emprendedor.
 */
export function mapRowToEntrepreneurCampaign(row: any): EntrepreneurCampaign {
  const campaign: EntrepreneurCampaign = {
    id: row.id,
    title: row.title,
    slug: row.slug,
    shortDescription: row.short_description,
    campaignType: row.campaign_type,
    status: row.status,
    goalAmount: Number(row.goal_amount),
    currentAmount: Number(row.current_amount),
    investorCount: Number(row.investor_count),
    currency: row.currency,
    coverImageUrl: row.cover_image_url,
    startDate: row.start_date,
    endDate: row.end_date,
    fundedAt: row.funded_at,
    isFeatured: row.is_featured,
    viewCount: Number(row.view_count),
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    categoryId: row.category_id,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    videoUrl: row.video_url,
  };

  if (row.reward_tiers) {
    campaign.rewardTiers = row.reward_tiers.map(mapRowToRewardTier);
  }

  return campaign;
}
