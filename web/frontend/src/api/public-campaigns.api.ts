import axios from 'axios';
import type { CampaignFinancialProgress } from '../types/campaign.types';

const API = axios.create({ baseURL: '/api/v1' });

export interface PublicCampaign {
  id: string;
  title: string;
  slug: string;
  shortDescription: string | null;
  campaignType: 'donation' | 'reward' | 'equity';
  status: string;
  goalAmount: number;
  currentAmount: number;
  investorCount: number;
  coverImageUrl: string | null;
  endDate: string | null;
  createdAt: string;
  entrepreneurUserId: string;
  entrepreneurName: string;
  entrepreneurDisplayName: string | null;
  entrepreneurAvatar: string | null;
  categoryName: string;
  categorySlug: string;
  videoUrl: string | null;
}

export interface RewardTier {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  maxClaims: number | null;
  currentClaims: number;
  estimatedDelivery: string | null;
  imageUrl: string | null;
  minPercentage?: number;
  maxPercentage?: number;
}

export interface PublicCampaignDetail extends PublicCampaign {
  categoryId: string;
  description: string;
  subtitle: string | null;
  currency: string;
  startDate: string | null;
  minInvestment: number;
  maxInvestment: number | null;
  entrepreneurBio: string | null;
  rewardTiers: RewardTier[];
}

export interface PaginatedPublicCampaigns {
  data: PublicCampaign[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

export interface PublicCampaignFilters {
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'current_amount' | 'goal_amount' | 'end_date';
  sortOrder?: 'ASC' | 'DESC';
  categoryId?: string;
  campaignType?: string;
  q?: string;
}

export async function fetchPublicCampaigns(
  filters: PublicCampaignFilters = {},
): Promise<PaginatedPublicCampaigns> {
  const params = new URLSearchParams();
  if (filters.page) params.append('page', String(filters.page));
  if (filters.limit) params.append('limit', String(filters.limit));
  if (filters.sortBy) params.append('sortBy', filters.sortBy);
  if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
  if (filters.categoryId) params.append('categoryId', filters.categoryId);
  if (filters.campaignType) params.append('campaignType', filters.campaignType);
  if (filters.q) params.append('q', filters.q);

  const res = await API.get(`/campaigns/public?${params.toString()}`);
  return res.data.data;
}

export async function fetchPublicCampaignById(
  id: string,
): Promise<PublicCampaignDetail> {
  const res = await API.get(`/campaigns/public/${id}`);
  return res.data.data;
}

export interface StoryItem {
  id: string;
  title: string;
  content: string;
  attachments: any[];
  createdAt: string;
}

export interface CampaignStoryGroup {
  campaignId: string;
  campaignTitle: string;
  campaignCoverImageUrl: string | null;
  entrepreneurName: string;
  entrepreneurAvatar: string | null;
  stories: StoryItem[];
}

export async function getRecentStories(): Promise<CampaignStoryGroup[]> {
  const res = await API.get('/campaigns/public/updates/recent');
  return res.data.data;
}

export async function seedTestStories(): Promise<any> {
  const res = await API.post('/campaigns/public/updates/seed-test');
  return res.data;
}

export interface PublicCampaignDocument {
  id: string;
  campaignId: string;
  fileUrl: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  justification: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  reviewerNotes?: string | null;
  createdAt: string;
}

export interface PublicCampaignUpdate {
  id: string;
  campaignId: string;
  title: string;
  content: string;
  attachments?: any[];
  authorName?: string;
  authorDisplayName?: string | null;
  authorAvatar?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export async function fetchPublicCampaignFinancialProgress(
  campaignId: string,
): Promise<CampaignFinancialProgress> {
  const res = await API.get(`/campaigns/public/${campaignId}/financial-progress`);
  return res.data.data;
}

export async function fetchPublicCampaignDocuments(
  campaignId: string,
): Promise<PublicCampaignDocument[]> {
  const res = await API.get(`/campaigns/public/${campaignId}/documents`);
  return res.data.data;
}

export async function fetchPublicCampaignUpdates(
  campaignId: string,
): Promise<PublicCampaignUpdate[]> {
  const res = await API.get(`/campaigns/public/${campaignId}/updates`);
  return res.data.data;
}

