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
  milestones?: CampaignMilestone[];
  campaignType: CampaignType;
}

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';

export interface MilestoneEvidence {
  id: string;
  title: string;
  description?: string | null;
  url: string;
  type: 'image' | 'video' | 'document';
  fileName?: string;
  uploadedAt: string;
}

export interface CampaignMilestone {
  id: string;
  campaignId: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  completedDate: string | null;
  status: MilestoneStatus;
  progressPercentage: number;
  sortOrder: number;
  evidenceUrls?: MilestoneEvidence[];
  updates?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignMilestoneDto {
  title: string;
  description?: string;
  targetDate?: string;
  status?: MilestoneStatus;
  progressPercentage?: number;
  sortOrder?: number;
}

export interface UpdateCampaignMilestoneDto {
  title?: string;
  description?: string;
  targetDate?: string;
  completedDate?: string;
  status?: MilestoneStatus;
  progressPercentage?: number;
  sortOrder?: number;
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

export type MovementType = 'income' | 'expense';

export interface CampaignFinancialMovement {
  id: string;
  campaignId: string;
  createdBy?: string;
  type: MovementType;
  concept: string;
  category: string;
  amount: number;
  currency: string;
  movementDate: string;
  referenceNumber?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFinancialMovementDto {
  type: MovementType;
  concept: string;
  category: string;
  amount: number;
  movementDate: string;
  referenceNumber?: string;
  notes?: string;
}

export interface FinancialLedgerSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  executionPercentage: number;
  movementCount: number;
  incomeCount: number;
  expenseCount: number;
}

export interface FinancialLedgerResponse {
  campaignId: string;
  campaignTitle: string;
  currency: string;
  summary: FinancialLedgerSummary;
  expensesByCategory: Array<{
    category: string;
    totalAmount: number;
    count: number;
    percentage: number;
  }>;
  movements: CampaignFinancialMovement[];
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
  averageInvestment?: number;
  largestInvestment?: number;
  smallestInvestment?: number;
  investments?: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    refunded: number;
  };
  amounts?: {
    confirmed: number;
    pending: number;
    refunded: number;
  };
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  daysRemaining?: number | null;
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
