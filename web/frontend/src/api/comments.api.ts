import axios from 'axios';

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

export interface CampaignComment {
  id: string;
  campaignId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  likesCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export async function getComments(campaignId: string): Promise<CampaignComment[]> {
  const userId = localStorage.getItem('userId') || undefined;
  const params = userId ? { userId } : {};
  const { data } = await api.get(`/campaigns/${campaignId}/comments`, { params });
  return data.data;
}

export async function postComment(campaignId: string, content: string): Promise<CampaignComment> {
  const { data } = await api.post(`/campaigns/${campaignId}/comments`, { content });
  return data.data;
}

export async function toggleCommentLike(
  campaignId: string,
  commentId: string,
): Promise<{ liked: boolean; likesCount: number }> {
  const { data } = await api.post(`/campaigns/${campaignId}/comments/${commentId}/like`);
  return data.data;
}
