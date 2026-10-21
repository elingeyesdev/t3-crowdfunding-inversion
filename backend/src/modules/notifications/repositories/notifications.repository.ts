import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/database';
import { Notification, mapRowToNotification } from '../models/notification.model';
import { randomUUID } from 'crypto';

@Injectable()
export class NotificationsRepository extends BaseRepository {

  /**
   * Inserta una notificación. Busca el type_id automáticamente por código.
   */
  async createNotification(params: {
    userId: string;
    typeCode: string;
    title: string;
    body: string;
    referenceType?: string;
    referenceId?: string;
    actionUrl?: string;
    data?: Record<string, any>;
  }): Promise<void> {
    const notifId = randomUUID();
    await this.query(
      `INSERT INTO notifications (id, user_id, type_id, title, body, channel, reference_type, reference_id, action_url, data, created_at, updated_at)
       SELECT
         ?,
         ?,
         nt.id,
         ?,
         ?,
         'in_app',
         ?,
         ?,
         ?,
         ?,
         NOW(),
         NOW()
       FROM notification_types nt
       WHERE nt.code = ?
       LIMIT 1`,
      [
        notifId,
        params.userId,
        params.title,
        params.body,
        params.referenceType ?? null,
        params.referenceId ?? null,
        params.actionUrl ?? null,
        JSON.stringify(params.data ?? {}),
        params.typeCode,
      ]
    );
  }

  /**
   * Obtiene las notificaciones de un usuario (más recientes primero)
   */
  async getNotificationsByUserId(userId: string, limit = 30): Promise<Notification[]> {
    const result = await this.query(
      `SELECT n.*, nt.code AS type_code
       FROM notifications n
       LEFT JOIN notification_types nt ON nt.id = n.type_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
    return result.rows.map(mapRowToNotification);
  }

  /**
   * Cuenta notificaciones no leídas del usuario
   */
  async countUnread(userId: string): Promise<number> {
    const result = await this.query(
      `SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = false`,
      [userId]
    );
    return parseInt(result.rows[0]?.total ?? '0', 10);
  }

  /**
   * Marca una notificación como leída
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.query(
      `UPDATE notifications
       SET is_read = true, read_at = NOW()
       WHERE id = ? AND user_id = ? AND is_read = false`,
      [notificationId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Marca todas las notificaciones del usuario como leídas
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.query(
      `UPDATE notifications
       SET is_read = true, read_at = NOW()
       WHERE user_id = ? AND is_read = false`,
      [userId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Obtiene los user_ids de todos los inversores que han invertido en una campaña
   */
  async getInvestorsByCampaignId(campaignId: string): Promise<string[]> {
    const result = await this.query(
      `SELECT DISTINCT investor_id FROM investments
       WHERE campaign_id = ? AND status = 'completed'`,
      [campaignId]
    );
    return result.rows.map((r: any) => r.investor_id as string);
  }
}
