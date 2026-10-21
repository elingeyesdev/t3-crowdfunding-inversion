export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms';

export interface Notification {
  id: string;
  userId: string;
  typeId: string;
  typeCode: string | null;
  title: string;
  body: string;
  channel: NotificationChannel;
  isRead: boolean;
  readAt: Date | null;
  actionUrl: string | null;
  referenceType: string | null;
  referenceId: string | null;
  data: Record<string, any>;
  sentAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export function mapRowToNotification(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    typeId: row.type_id,
    typeCode: row.type_code ?? null,
    title: row.title,
    body: row.body,
    channel: row.channel,
    isRead: row.is_read,
    readAt: row.read_at ?? null,
    actionUrl: row.action_url ?? null,
    referenceType: row.reference_type ?? null,
    referenceId: row.reference_id ?? null,
    data: row.data ?? {},
    sentAt: row.sent_at ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at,
  };
}
