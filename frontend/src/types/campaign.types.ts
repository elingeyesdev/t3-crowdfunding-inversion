export type CampaignStatus =
  | 'draft'
  | 'pending_review'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'funded'
  | 'partially_funded'
  | 'failed'
  | 'cancelled'
  | 'completed'
  | 'suspended';

export type CampaignType = 'donation';

export interface EntrepreneurCampaign {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  location: string | null;
  categoryId?: string;
  categoryIds?: string[];
  categories?: any[];
  status: CampaignStatus;
  goalAmount: number;
  currentAmount: number;
  investorCount: number;
  currency: string;
  coverImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  fundedAt: string | null;
  isFeatured: boolean;
  viewCount: number;
  categoryName: string;
  categorySlug: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  videoUrl?: string | null;
  rewardTiers?: RewardTier[];
  fundingPlan?: FundingPlanItem[];
  campaignType: CampaignType;
}

export interface FundingPlanItem {
  id: string;
  campaignId: string;
  category: string;
  description: string | null;
  amount: number;
  percentage: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFundingPlanItemDto {
  category: string;
  description?: string;
  amount: number;
  percentage?: number;
  sortOrder?: number;
}

export interface CreateCampaignDto {
  title: string;
  description: string;
  shortDescription?: string;
  goalAmount: number;
  endDate?: string;
  categoryIds?: string[];
  rewards?: CreateRewardTierDto[];
  fundingPlan?: CreateFundingPlanItemDto[];
  videoUrl?: string;
}


export type CampaignFilterPreset =
  | 'all'
  | 'draft'
  | 'approval'
  | 'published'
  | 'archived';

export interface QueryCampaignsDto {
  page?: number;
  limit?: number;
  /** Tiene prioridad sobre filterPreset si ambos se envían */
  status?: CampaignStatus;
  filterPreset?: CampaignFilterPreset;
  search?: string;
  sortBy?: 'created_at' | 'current_amount' | 'goal_amount' | 'end_date' | 'title';
  sortOrder?: 'ASC' | 'DESC';
  createdFrom?: string;
  createdTo?: string;
  endDateFrom?: string;
  endDateTo?: string;
}

export interface RecentInvestment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  isAnonymous: boolean;
  investorDisplayName: string | null;
  rewardTitle?: string;
  createdAt: string;
}

export interface CampaignFinancialProgress {
  campaignId: string;
  title: string;
  currentAmount: number;
  goalAmount: number;
  remainingAmount: number;
  fundingPercentage: number;
  investorCount: number;
  currency: string;
  recentInvestments: RecentInvestment[];
  dailyProgress?: { date: string; accumulatedAmount: number }[];
  fundingBreakdown?: { rewardTierId: string | null; rewardTitle: string; totalAmount: number }[];
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
  lastInvestmentAt: string;
  investmentId?: string;
  rewardTitle?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface RewardTier {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  amount?: number;
  minPercentage: number;
  maxPercentage: number;
  currency: string;
  maxClaims: number | null;
  currentClaims: number;
  estimatedDelivery: string | null;
  includesShipping: boolean;
  shippingDetails: string | null;
  imageUrl: string | null;
  expiresAt: string | null;
  items: any[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRewardTierDto {
  title: string;
  description: string;
  amount?: number;
  minPercentage: number;
  maxPercentage: number;
  currency?: string;
  maxClaims?: number | null;
  estimatedDelivery?: string;
  includesShipping?: boolean;
  shippingDetails?: string;
  imageUrl?: string;
  expiresAt?: string;
  items?: any[];
  sortOrder?: number;
}

export interface UpdateRewardTierDto extends Partial<CreateRewardTierDto> {
  isActive?: boolean;
}

export interface RewardClaim {
  claim_id: string;
  claim_status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  investment_id: string;
  amount: number;
  invested_at: string;
  reward_title: string;
  reward_id: string;
  expires_at: string | null;
  investor_email: string;
  first_name: string;
  last_name: string;
}

export interface CampaignDocument {
  id: string;
  campaign_id: string;
  file_url: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  justification: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}
