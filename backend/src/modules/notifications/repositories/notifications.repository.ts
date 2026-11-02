import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseRepository } from '../../../common/database';
import { Notification, mapRowToNotification } from '../models/notification.model';
import { randomUUID } from 'crypto';

export interface NotificationPreferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  campaignStatusUpdates: boolean;
  investmentAlerts: boolean;
  commentAlerts: boolean;
  milestoneUpdates: boolean;
  categories?: Record<string, boolean>;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  inAppEnabled: true,
  emailEnabled: true,
  campaignStatusUpdates: true,
  investmentAlerts: true,
  commentAlerts: true,
  milestoneUpdates: true,
};

@Injectable()
export class NotificationsRepository extends BaseRepository implements OnModuleInit {
  async onModuleInit() {
    await this.ensureTables();
  }

  async ensureTables() {
    try {
      await this.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB
      `);
    } catch {
      // Ignorado si la columna ya existe
    }
  }

  /**
   * Inserta una notificación. Asigna type_code y type_id si existe en notification_types.
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
      `INSERT INTO notifications (id, user_id, type_id, type_code, title, body, channel, reference_type, reference_id, action_url, data, created_at, updated_at)
       VALUES (
         ?,
         ?,
         (SELECT id FROM notification_types WHERE code = ? LIMIT 1),
         ?,
         ?,
         ?,
         'in_app',
         ?,
         ?,
         ?,
         ?,
         NOW(),
         NOW()
       )`,
      [
        notifId,
        params.userId,
        params.typeCode,
        params.typeCode,
        params.title,
        params.body,
        params.referenceType ?? null,
        params.referenceId ?? null,
        params.actionUrl ?? null,
        JSON.stringify(params.data ?? {}),
      ]
    );
  }

  /**
   * Obtiene las notificaciones de un usuario con paginación, búsqueda y filtros.
   */
  async getNotifications(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      unread?: boolean;
      typeCode?: string;
      q?: string;
    }
  ): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    unreadCount: number;
  }> {
    const page = Math.max(1, Number(options?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(options?.limit) || 20));
    const offset = (page - 1) * limit;

    // Si el usuario no tiene notificaciones aún, sembramos una de bienvenida
    const initialCheck = await this.queryOne(`SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ?`, [userId]);
    if (parseInt(initialCheck?.cnt || '0', 10) === 0) {
      await this.createNotification({
        userId,
        typeCode: 'system_welcome',
        title: '¡Te damos la bienvenida a Unifundme!',
        body: 'Explora campañas de innovación boliviana, realiza aportes y supervisa las novedades desde este centro.',
        actionUrl: '/explore',
        data: { welcome: true },
      });
    }

    const conditions: string[] = ['n.user_id = ?'];
    const params: any[] = [userId];

    if (options?.unread === true) {
      conditions.push('n.is_read = false');
    } else if (options?.unread === false) {
      conditions.push('n.is_read = true');
    }

    if (options?.typeCode) {
      conditions.push('(n.type_code = ? OR nt.code = ?)');
      params.push(options.typeCode, options.typeCode);
    }

    if (options?.q) {
      conditions.push('(n.title ILIKE ? OR n.body ILIKE ?)');
      params.push(`%${options.q}%`, `%${options.q}%`);
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*) as total
      FROM notifications n
      LEFT JOIN notification_types nt ON nt.id = n.type_id
      WHERE ${whereClause}
    `;
    const countRow = await this.queryOne(countSql, params);
    const total = parseInt(countRow?.total || '0', 10);

    const dataSql = `
      SELECT n.*, COALESCE(n.type_code, nt.code) AS type_code
      FROM notifications n
      LEFT JOIN notification_types nt ON nt.id = n.type_id
      WHERE ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const result = await this.query(dataSql, [...params, limit, offset]);

    const unreadCount = await this.countUnread(userId);

    return {
      notifications: result.rows.map(mapRowToNotification),
      total,
      page,
      perPage: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      unreadCount,
    };
  }

  /**
   * Obtiene las notificaciones de un usuario (legado)
   */
  async getNotificationsByUserId(userId: string, limit = 30): Promise<Notification[]> {
    const res = await this.getNotifications(userId, { limit });
    return res.notifications;
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
  async markAllAsRead(userId: string, typeCode?: string): Promise<number> {
    if (typeCode) {
      const result = await this.query(
        `UPDATE notifications
         SET is_read = true, read_at = NOW()
         WHERE user_id = ? AND is_read = false AND (type_code = ? OR type_id IN (SELECT id FROM notification_types WHERE code = ?))`,
        [userId, typeCode, typeCode]
      );
      return result.rowCount ?? 0;
    }

    const result = await this.query(
      `UPDATE notifications
       SET is_read = true, read_at = NOW()
       WHERE user_id = ? AND is_read = false`,
      [userId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Elimina una notificación específica
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Elimina todas las notificaciones leídas del usuario
   */
  async clearReadNotifications(userId: string): Promise<number> {
    const result = await this.query(
      `DELETE FROM notifications WHERE user_id = ? AND is_read = true`,
      [userId]
    );
    return result.rowCount ?? 0;
  }

  /**
   * Obtiene las preferencias de notificación del usuario
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const row = await this.queryOne(`SELECT notification_preferences FROM users WHERE id = ?`, [userId]);
      if (!row || !row.notification_preferences) {
        return DEFAULT_PREFERENCES;
      }
      const parsed = typeof row.notification_preferences === 'string'
        ? JSON.parse(row.notification_preferences)
        : row.notification_preferences;
      return { ...DEFAULT_PREFERENCES, ...parsed };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Actualiza las preferencias de notificación del usuario
   */
  async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const updated = { ...current, ...preferences };
    try {
      await this.query(
        `UPDATE users SET notification_preferences = ? WHERE id = ?`,
        [JSON.stringify(updated), userId]
      );
    } catch (err) {
      console.warn('Could not update notification_preferences on users table:', err);
    }
    return updated;
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
