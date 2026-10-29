import axios from 'axios';

export interface AppNotification {
  id: string;
  userId: string;
  typeId?: string | null;
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
  updatedAt?: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
  total?: number;
  page?: number;
  perPage?: number;
  totalPages?: number;
}

export interface NotificationPreferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  campaignStatusUpdates: boolean;
  investmentAlerts: boolean;
  commentAlerts: boolean;
  milestoneUpdates: boolean;
  categories?: Record<string, boolean>;
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

export async function getMyNotifications(params?: {
  page?: number;
  limit?: number;
  unread?: boolean;
  typeCode?: string;
  q?: string;
}): Promise<NotificationsResponse> {
  const { data } = await api.get<{ data: NotificationsResponse }>('/notifications/me', {
    params,
  });
  return data.data;
}

export async function getNotifications(params?: {
  page?: number;
  limit?: number;
  unread?: boolean;
  typeCode?: string;
  q?: string;
}): Promise<NotificationsResponse> {
  const { data } = await api.get<{ data: NotificationsResponse }>('/notifications', {
    params,
  });
  return data.data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<{ data: { unreadCount: number } }>('/notifications/unread-count');
  return data.data.unreadCount;
}

export async function markNotificationAsRead(id: string): Promise<AppNotification> {
  const { data } = await api.patch<{ data: AppNotification }>(`/notifications/${id}/read`);
  return data.data;
}

export async function markAllNotificationsAsRead(typeCode?: string): Promise<{ updatedCount: number; unreadCount: number }> {
  const { data } = await api.patch<{ data: { updatedCount: number; unreadCount: number } }>('/notifications/read-all', {
    typeCode,
  });
  return data.data;
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}

export async function clearReadNotifications(): Promise<{ deletedCount: number }> {
  const { data } = await api.delete<{ data: { deletedCount: number } }>('/notifications/clear-read');
  return data.data;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await api.get<{ data: NotificationPreferences }>('/notifications/preferences');
  return data.data;
}

export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const { data } = await api.put<{ data: NotificationPreferences }>('/notifications/preferences', preferences);
  return data.data;
}
