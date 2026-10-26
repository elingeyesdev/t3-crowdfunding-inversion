import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ChatUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  fullName: string;
}

export interface LastMessage {
  content: string;
  createdAt: string;
  senderId: string;
}

export interface Conversation {
  id: string;
  subject: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  campaignCover: string | null;
  status: string;
  lastMessageAt: string | null;
  messageCount: number;
  unreadCount: number;
  otherUser: ChatUser;
  lastMessage: LastMessage | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  messageType: string;
  isEdited: boolean;
  createdAt: string;
  sender: ChatUser;
}

// ─────────────────────────────────────────────────────────
// REST calls
// ─────────────────────────────────────────────────────────

export async function getMyConversations(): Promise<Conversation[]> {
  const { data } = await api.get('/chat/conversations');
  return data.data;
}

export async function getOrCreateConversation(
  otherUserId: string,
  campaignId?: string,
  subject?: string,
): Promise<{ id: string }> {
  const { data } = await api.post('/chat/conversations', {
    otherUserId,
    campaignId,
    subject,
  });
  return data.data;
}

export async function getMessages(
  conversationId: string,
  limit = 50,
  beforeId?: string,
): Promise<Message[]> {
  const params: Record<string, any> = { limit };
  if (beforeId) params.beforeId = beforeId;
  const { data } = await api.get(`/chat/conversations/${conversationId}/messages`, { params });
  return data.data;
}

export async function markAsRead(conversationId: string): Promise<void> {
  await api.post(`/chat/conversations/${conversationId}/read`);
}

export async function sendChatMessage(conversationId: string, content: string): Promise<Message> {
  const { data } = await api.post(`/chat/conversations/${conversationId}/messages`, { content });
  return data.data;
}
