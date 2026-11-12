export interface EntrepreneurCampaign {
  id: string;
  creatorId: string;
  categoryId: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string;
  shortDescription: string | null;
  campaignType: 'donation';
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'successful' | 'failed' | 'cancelled';
  goalAmount: number;
  currentAmount: number;
  minInvestment: number;
  maxInvestment: number | null;
  equityPercentage: number | null;
  startDate: Date | null;
  endDate: Date | null;
  fundsRaised: number;
  investorsCount: number;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  videoUrl: string | null;
}

export interface CreateCampaignDto {
  title: string;
  description: string;
  shortDescription?: string;
  categoryId?: string;
  categoryIds?: string[];
  goalAmount: number;
  campaignType: 'donation';
  endDate?: Date | string;
  videoUrl?: string | null;
  rewards?: any[];
}

export interface QueryCampaignsDto {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  status?: string;
  q?: string;
  categoryId?: string;
}

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
  createdAt?: Date | null;
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
  recentInvestments: any[];
  dailyProgress?: { date: string; accumulatedAmount: number }[];
  fundingBreakdown?: { rewardTierId: string | null; rewardTitle: string; totalAmount: number }[];
}

// =========================================================================
// CAMPAÑAS PÚBLICAS — Vista optimizada para exploración
// =========================================================================

export interface PublicCampaign {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  campaignType: 'donation';
  status: string;
  goalAmount: number;
  currentAmount: number;
  investorCount: number;
  coverImageUrl: string | null;
  endDate: Date | null;
  createdAt: Date;
  // Datos del emprendedor (JOIN)
  entrepreneurName: string;
  entrepreneurDisplayName: string | null;
  entrepreneurAvatar: string | null;
  // Categoría (JOIN)
  categoryName: string;
  categorySlug: string;
  videoUrl: string | null;
}

export interface PublicCampaignDetail extends PublicCampaign {
  description: string;
  subtitle: string | null;
  currency: string;
  startDate: Date | null;
  minInvestment: number;
  maxInvestment: number | null;
  entrepreneurBio: string | null;
}

export interface QueryPublicCampaignsDto {
  page?: number;
  limit?: number;
  categoryId?: string;
  campaignType?: string;
  q?: string;
  sortBy?: 'created_at' | 'current_amount' | 'goal_amount' | 'end_date';
  sortOrder?: 'ASC' | 'DESC';
}

export interface AdvancedAnalyticsDto {
  campaignId: string;
  title: string;
  goalAmount: number;
  currentAmount: number;
  grossAmount: number;
  platformFeePercentage: number;
  platformFee: number;
  netAmount: number;
  daysElapsed: number;
  dailyRate: number;
  projectedRemainingDays: number | null;
  dailyProgress: { date: string; accumulatedAmount: number }[];
  fundingBreakdown: { rewardTierId: string | null; rewardTitle: string; totalAmount: number }[];
}

