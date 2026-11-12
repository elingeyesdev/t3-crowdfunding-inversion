import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/database';

@Injectable()
export class ChatRepository extends BaseRepository {
  // ─────────────────────────────────────────────────────────
  // CONVERSATIONS
  // ─────────────────────────────────────────────────────────

  /**
   * Busca una conversación directa existente entre dos usuarios,
   * opcionalmente vinculada a una campaña.
   */
  async findDirectConversation(
    userA: string,
    userB: string,
    campaignId?: string,
  ) {
    const rows = await this.queryMany(
      `SELECT c.* FROM conversations c
       INNER JOIN conversation_participants pa ON pa.conversation_id = c.id AND pa.user_id = ?
       INNER JOIN conversation_participants pb ON pb.conversation_id = c.id AND pb.user_id = ?
       WHERE c.conversation_type = 'direct'
         AND (? IS NULL OR c.campaign_id = ?)
       LIMIT 1`,
      [userA, userB, campaignId ?? null, campaignId ?? null],
    );
    return rows[0] ?? null;
  }

  /**
   * Crea una nueva conversación directa entre dos usuarios.
   */
  async createConversation(
    userA: string,
    userB: string,
    campaignId?: string,
    subject?: string,
  ) {
    const { randomUUID } = await import('crypto');
    const convId = randomUUID();

    await this.query(
      `INSERT INTO conversations (id, campaign_id, subject, conversation_type, status, created_at, updated_at)
       VALUES (?, ?, ?, 'direct', 'active', NOW(), NOW())`,
      [convId, campaignId ?? null, subject ?? null],
    );

    const part1Id = randomUUID();
    const part2Id = randomUUID();
    await this.query(
      `INSERT INTO conversation_participants (id, conversation_id, user_id, role, created_at)
       VALUES (?, ?, ?, 'owner', NOW()), (?, ?, ?, 'member', NOW())`,
      [part1Id, convId, userA, part2Id, convId, userB],
    );

    return this.queryOne(`SELECT * FROM conversations WHERE id = ?`, [convId]);
  }

  /**
   * Obtiene o crea una conversación entre dos usuarios.
   */
  async getOrCreateConversation(
    userA: string,
    userB: string,
    campaignId?: string,
    subject?: string,
  ) {
    const existing = await this.findDirectConversation(userA, userB, campaignId);
    if (existing) return existing;
    return this.createConversation(userA, userB, campaignId, subject);
  }

  /**
   * Lista todas las conversaciones de un usuario, con el último mensaje y
   * la información del otro participante.
   */
  async findConversationsByUser(userId: string) {
    return this.queryMany(
      `SELECT
         c.id,
         c.subject,
         c.campaign_id,
         c.conversation_type,
         c.status,
         c.last_message_at,
         c.message_count,
         other_u.id          AS other_user_id,
         ep.first_name       AS other_first_name,
         ep.last_name        AS other_last_name,
         ep.avatar_url       AS other_avatar,
         ip.first_name       AS other_first_name_inv,
         ip.last_name        AS other_last_name_inv,
         ip.avatar_url       AS other_avatar_inv,
         other_u.email       AS other_email,
         lm.content          AS last_message_content,
         lm.created_at       AS last_message_created_at,
         lm.sender_id        AS last_message_sender_id,
         my_part.last_read_at,
         (SELECT COUNT(*) FROM messages m2
          WHERE m2.conversation_id = c.id
            AND m2.sender_id != ?
            AND (my_part.last_read_at IS NULL OR m2.created_at > my_part.last_read_at)
            AND m2.is_deleted = false
         ) AS unread_count,
         camp.title          AS campaign_title,
         camp.cover_image_url AS campaign_cover
       FROM conversations c
       INNER JOIN conversation_participants my_part
         ON my_part.conversation_id = c.id AND my_part.user_id = ?
       INNER JOIN conversation_participants other_part
         ON other_part.conversation_id = c.id AND other_part.user_id != ?
       INNER JOIN users other_u ON other_u.id = other_part.user_id
       LEFT JOIN entrepreneur_profiles ep ON ep.user_id = other_u.id
       LEFT JOIN investor_profiles ip ON ip.user_id = other_u.id
       LEFT JOIN campaigns camp ON camp.id = c.campaign_id
       LEFT JOIN messages lm ON lm.conversation_id = c.id AND lm.is_deleted = false
         AND lm.created_at = (
           SELECT MAX(m_inner.created_at) FROM messages m_inner
           WHERE m_inner.conversation_id = c.id AND m_inner.is_deleted = false
         )
       WHERE c.status != 'archived'
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
      [userId, userId, userId],
    );
  }

  /**
   * Verifica que el usuario sea participante de la conversación.
   */
  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const row = await this.queryOne(
      `SELECT 1 FROM conversation_participants
       WHERE conversation_id = ? AND user_id = ?`,
      [conversationId, userId],
    );
    return row !== null;
  }

  /**
   * Obtiene info básica de una conversación.
   */
  async findConversationById(id: string) {
    return this.queryOne(`SELECT * FROM conversations WHERE id = ?`, [id]);
  }

  // ─────────────────────────────────────────────────────────
  // MESSAGES
  // ─────────────────────────────────────────────────────────

  /**
   * Guarda un nuevo mensaje y actualiza metadata de la conversación.
   */
  async saveMessage(
    conversationId: string,
    senderId: string,
    content: string,
    messageType: string = 'text',
  ) {
    const { randomUUID } = await import('crypto');
    const msgId = randomUUID();

    await this.query(
      `INSERT INTO messages (id, conversation_id, sender_id, content, message_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [msgId, conversationId, senderId, content, messageType],
    );

    await this.query(
      `UPDATE conversations
       SET last_message_at = NOW(),
           message_count = message_count + 1
       WHERE id = ?`,
      [conversationId],
    );

    const row = await this.queryOne(
      `SELECT m.*,
              ep.first_name  AS sender_first_name,
              ep.last_name   AS sender_last_name,
              ep.avatar_url  AS sender_avatar,
              ip.first_name  AS sender_first_name_inv,
              ip.last_name   AS sender_last_name_inv,
              ip.avatar_url  AS sender_avatar_inv,
              u.email        AS sender_email
       FROM messages m
       INNER JOIN users u ON u.id = m.sender_id
       LEFT JOIN entrepreneur_profiles ep ON ep.user_id = m.sender_id
       LEFT JOIN investor_profiles ip ON ip.user_id = m.sender_id
       WHERE m.id = ?`,
      [msgId],
    );

    return row;
  }

  /**
   * Obtiene el historial de mensajes paginado (cursor-based, del más nuevo al más antiguo).
   */
  async findMessages(
    conversationId: string,
    limit: number = 50,
    beforeId?: string,
  ) {
    if (beforeId) {
      return this.queryMany(
        `SELECT m.*,
                ep.first_name  AS sender_first_name,
                ep.last_name   AS sender_last_name,
                ep.avatar_url  AS sender_avatar,
                ip.first_name  AS sender_first_name_inv,
                ip.last_name   AS sender_last_name_inv,
                ip.avatar_url  AS sender_avatar_inv,
                u.email        AS sender_email
         FROM messages m
         INNER JOIN users u ON u.id = m.sender_id
         LEFT JOIN entrepreneur_profiles ep ON ep.user_id = m.sender_id
         LEFT JOIN investor_profiles ip ON ip.user_id = m.sender_id
         WHERE m.conversation_id = ?
           AND m.is_deleted = false
           AND m.created_at < (SELECT created_at FROM messages WHERE id = ?)
         ORDER BY m.created_at DESC
         LIMIT ?`,
        [conversationId, beforeId, limit],
      );
    }

    return this.queryMany(
      `SELECT m.*,
              ep.first_name  AS sender_first_name,
              ep.last_name   AS sender_last_name,
              ep.avatar_url  AS sender_avatar,
              ip.first_name  AS sender_first_name_inv,
              ip.last_name   AS sender_last_name_inv,
              ip.avatar_url  AS sender_avatar_inv,
              u.email        AS sender_email
       FROM messages m
       INNER JOIN users u ON u.id = m.sender_id
       LEFT JOIN entrepreneur_profiles ep ON ep.user_id = m.sender_id
       LEFT JOIN investor_profiles ip ON ip.user_id = m.sender_id
       WHERE m.conversation_id = ?
         AND m.is_deleted = false
       ORDER BY m.created_at DESC
       LIMIT ?`,
      [conversationId, limit],
    );
  }

  /**
   * Marca la conversación como leída para el usuario dado.
   */
  async markAsRead(conversationId: string, userId: string) {
    await this.query(
      `UPDATE conversation_participants
       SET last_read_at = NOW()
       WHERE conversation_id = ? AND user_id = ?`,
      [conversationId, userId],
    );
  }

  /**
   * Obtiene la información del otro participante de una conversación.
   */
  async getOtherParticipant(conversationId: string, myUserId: string) {
    return this.queryOne(
      `SELECT
         u.id,
         u.email,
         COALESCE(ep.first_name, ip.first_name) AS first_name,
         COALESCE(ep.last_name,  ip.last_name)  AS last_name,
         COALESCE(ep.avatar_url, ip.avatar_url) AS avatar_url
       FROM conversation_participants cp
       INNER JOIN users u ON u.id = cp.user_id
       LEFT JOIN entrepreneur_profiles ep ON ep.user_id = u.id
       LEFT JOIN investor_profiles ip ON ip.user_id = u.id
       WHERE cp.conversation_id = ? AND cp.user_id != ?
       LIMIT 1`,
      [conversationId, myUserId],
    );
  }
}
