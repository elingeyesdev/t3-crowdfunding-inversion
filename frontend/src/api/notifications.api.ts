import axios from 'axios';

export interface AppNotification {
  id: string;
  userId: string;
  typeId: string;
  typeCode: string | null;
  title: string;
  body: string;
  channel: string;
  isRead: boolean;
  readAt: string | null;
  actionUrl: string | null;
  referenceType: string | null;
  referenceId: string | null;
  data: Record<string, any>;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
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

export async function getMyNotifications(): Promise<NotificationsResponse> {
  const { data } = await api.get<{ data: NotificationsResponse }>('/notifications/me');
  return data.data;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}
