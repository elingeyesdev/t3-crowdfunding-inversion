import axios from 'axios';
import type {
  DashboardStats,
  SystemUser,
  SystemCampaign,
  AdminUser,
  PendingCampaign,
  PendingCampaignDetail,
  CampaignHistoryItem,
} from '../types/admin.types';

interface ApiSuccessResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
}

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Admin endpoints
export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<ApiSuccessResponse<DashboardStats>>('/admin/dashboard-stats');
  return data.data;
}

export async function getAllUsers(): Promise<SystemUser[]> {
  const { data } = await api.get<ApiSuccessResponse<SystemUser[]>>('/admin/users');
  return data.data;
}

export async function getAllCampaigns(): Promise<SystemCampaign[]> {
  const { data } = await api.get<ApiSuccessResponse<SystemCampaign[]>>('/admin/campaigns');
  return data.data;
}

export async function updateCampaignStatus(id: string, status: string, feedback?: string): Promise<any> {
  const { data } = await api.patch<ApiSuccessResponse<any>>(`/admin/campaigns/${id}/status`, { 
    status,
    feedback 
  });
  return data.data;
}

// SuperAdmin endpoints
export async function createAdmin(dto: any): Promise<any> {
  const { data } = await api.post<ApiSuccessResponse<any>>('/superadmin/admins', dto);
  return data.data;
}

export async function getAllAdmins(): Promise<AdminUser[]> {
  const { data } = await api.get<ApiSuccessResponse<AdminUser[]>>('/superadmin/admins');
  return data.data;
}

export async function softDeleteUser(id: string): Promise<any> {
  const { data } = await api.delete<ApiSuccessResponse<any>>(`/admin/users/${id}`);
  return data.data;
}

export async function hardDeleteCampaign(id: string): Promise<any> {
  const { data } = await api.delete<ApiSuccessResponse<any>>(`/admin/campaigns/${id}`);
  return data.data;
}

export async function deleteAdmin(id: string): Promise<any> {
  const { data } = await api.delete<ApiSuccessResponse<any>>(`/superadmin/admins/${id}`);
  return data.data;
}

export async function getPendingCampaigns(params: {
  page: number;
  limit: number;
  search?: string;
  type?: string;
  status?: string;
}): Promise<{ campaigns: PendingCampaign[]; total: number }> {
  const { data } = await api.get<ApiSuccessResponse<any>>('/admin/campaigns/pending', {
    params: {
      page: params.page,
      limit: params.limit,
      q: params.search,
      status: params.status,
    },
  });

  return {
    campaigns: data.data.data.map((c: any) => ({
      id: c.id,
      title: c.title,
      type: 'donation',
      entrepreneur_name: c.entrepreneur_name,
      category_name: c.category_name || 'Sin categoría',
      goal_amount: c.goal_amount.toString(),
      created_at: c.created_at,
      audit_score: c.audit_score,
    })),
    total: data.data.meta.totalItems,
  };
}

export async function getCampaignDetail(id: string): Promise<PendingCampaignDetail> {
  try {
    const { data } = await api.get<ApiSuccessResponse<any>>(`/admin/campaigns/${id}`);
    const c = data.data;

    if (!c) {
      throw new Error('No se recibió información de la campaña');
    }

    // Safely extract names
    const firstName = c.entrepreneur_first_name || '';
    const lastName = c.entrepreneur_last_name || '';

    // Handle Image: check cover_image_url first, then first media item
    let mainImageUrl = c.cover_image_url || c.coverImageUrl;
    if (!mainImageUrl && c.media && c.media.length > 0) {
      mainImageUrl = c.media[0].url;
    }

    return {
      id: c.id || id,
      title: c.title || 'Campaña sin título',
      slug: c.slug || c.id,
      status: c.status || 'pending_review',
      type: 'donation' as const,
      currency: c.currency || 'BOB',
      audit_score: c.audit_score,
      main_image_url: mainImageUrl,
      short_description: c.short_description || c.shortDescription || '',
      description: c.description || '',
      reward_tiers: (c.reward_tiers || c.rewardTiers || []).map((t: any) => ({
        title: t.title || 'Recompensa',
        min_percentage: parseFloat(t.min_percentage || t.minPercentage || 0),
        max_percentage: parseFloat(t.max_percentage || t.maxPercentage || 100),
        description: t.description || '',
        delivery_date: t.delivery_date || t.deliveryDate || new Date().toISOString(),
      })),
      goal_amount: (c.goal_amount || c.goalAmount || 0).toString(),
      current_amount: parseFloat(c.current_amount || c.currentAmount || 0),
      investor_count: parseInt(c.investor_count || c.investorsCount || 0, 10),
      start_date: c.start_date || c.startDate || new Date().toISOString(),
      end_date: c.end_date || c.endDate || new Date().toISOString(),
      location: c.location || 'Global',
      category_name: c.category_name || c.categoryName || 'General',
      entrepreneur_first_name: firstName,
      entrepreneur_last_name: lastName,
      entrepreneur_email: c.entrepreneur_email || c.creator_email || '',
      entrepreneur_bio: c.entrepreneur_bio || '',
      entrepreneur_avatar: c.entrepreneur_avatar || c.avatar_url,
      entrepreneur_linkedin: c.entrepreneur_linkedin || c.metadata?.social_links?.linkedin,
      entrepreneur_website: c.entrepreneur_website || c.metadata?.social_links?.website,
      media: c.media || [],
      min_investment: parseFloat(c.min_investment || 0),
      max_investment: c.max_investment ? parseFloat(c.max_investment) : undefined,
      subtitle: c.subtitle || '',
      risks_and_challenges: c.risks_and_challenges || '',
      video_url: c.video_url || '',
      tags: c.tags || [],
      social_links: c.social_links || {},
    };
  } catch (error) {
    console.error('Error in getPendingCampaignById:', error);
    throw error;
  }
}
export async function getCampaignHistory(id: string): Promise<CampaignHistoryItem[]> {
  const { data } = await api.get<ApiSuccessResponse<CampaignHistoryItem[]>>(`/admin/campaigns/${id}/history`);
  return data.data;
}

export async function getCampaignFinancialProgress(id: string): Promise<any> {
  const { data } = await api.get<ApiSuccessResponse<any>>(`/admin/campaigns/${id}/financial-progress`);
  return data.data;
}

export async function getAdminCampaignInvestors(id: string, page: number = 1, limit: number = 20): Promise<any> {
  const { data } = await api.get<ApiSuccessResponse<any>>(`/admin/campaigns/${id}/investors`, {
    params: { page, limit }
  });
  return data.data;
}

export async function getAdminRewardClaims(id: string): Promise<any[]> {
  const { data } = await api.get<ApiSuccessResponse<any[]>>(`/admin/campaigns/${id}/rewards/claims`);
  return data.data;
}

export async function getAdminCampaignDocuments(id: string): Promise<any[]> {
  const { data } = await api.get<ApiSuccessResponse<any[]>>(`/admin/campaigns/${id}/documents`);
  return data.data;
}

export async function reviewAdminCampaignDocument(
  campaignId: string,
  docId: string,
  status: 'approved' | 'rejected',
  reviewerNotes: string
): Promise<any> {
  const { data } = await api.patch<ApiSuccessResponse<any>>(
    `/admin/campaigns/${campaignId}/documents/${docId}/review`,
    { status, reviewerNotes }
  );
  return data.data;
}

export async function getPendingKyc(): Promise<any[]> {
  const { data } = await api.get<ApiSuccessResponse<any[]>>('/admin/kyc/pending');
  return data.data;
}

export async function reviewKyc(entrepreneurId: string, action: 'approve' | 'reject', reason?: string): Promise<any> {
  const { data } = await api.post<ApiSuccessResponse<any>>(`/admin/kyc/${entrepreneurId}/review`, { action, reason });
  return data.data;
}
