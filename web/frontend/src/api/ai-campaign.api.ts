import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

export interface CampaignContext {
  title?: string;
  description?: string;
  goalAmount?: number;
  currentAmount?: number;
  campaignType?: string;
  categoryName?: string;
  investorCount?: number;
  daysRemaining?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function aiCampaignChat(
  messages: ChatMessage[],
  campaignContext?: CampaignContext,
): Promise<string> {
  const token = localStorage.getItem('accessToken');
  const { data } = await api.post<{ reply: string }>(
    '/ai-campaign/chat',
    { messages, campaignContext },
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data.reply;
}
