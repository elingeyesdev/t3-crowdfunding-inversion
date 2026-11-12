import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatRepository } from '../repositories/chat.repository';

@Injectable()
export class ChatService {
  constructor(private readonly chatRepo: ChatRepository) {}

  // ─────────────────────────────────────────────────────────
  // Helpers para formatear filas de BD
  // ─────────────────────────────────────────────────────────

  private formatConversation(row: any) {
    const firstName = row.other_first_name ?? row.other_first_name_inv ?? null;
    const lastName  = row.other_last_name  ?? row.other_last_name_inv  ?? null;
    const avatar    = row.other_avatar     ?? row.other_avatar_inv     ?? null;

    return {
      id:                     row.id,
      subject:                row.subject,
      campaignId:             row.campaign_id,
      campaignTitle:          row.campaign_title,
      campaignCover:          row.campaign_cover,
      status:                 row.status,
      lastMessageAt:          row.last_message_at,
      messageCount:           row.message_count,
      unreadCount:            Number(row.unread_count ?? 0),
      otherUser: {
        id:        row.other_user_id,
        email:     row.other_email,
        firstName,
        lastName,
        avatar,
        fullName: [firstName, lastName].filter(Boolean).join(' ') || row.other_email,
      },
      lastMessage: row.last_message_content
        ? {
            content:   row.last_message_content,
            createdAt: row.last_message_created_at,
            senderId:  row.last_message_sender_id,
          }
        : null,
    };
  }

  private formatMessage(row: any) {
    const firstName = row.sender_first_name ?? row.sender_first_name_inv ?? null;
    const lastName  = row.sender_last_name  ?? row.sender_last_name_inv  ?? null;
    const avatar    = row.sender_avatar     ?? row.sender_avatar_inv     ?? null;

    return {
      id:             row.id,
      conversationId: row.conversation_id,
      senderId:       row.sender_id,
      content:        row.content,
      messageType:    row.message_type,
      isEdited:       row.is_edited,
      createdAt:      row.created_at,
      sender: {
        id:        row.sender_id,
        email:     row.sender_email,
        firstName,
        lastName,
        avatar,
        fullName: [firstName, lastName].filter(Boolean).join(' ') || row.sender_email,
      },
    };
  }

  // ─────────────────────────────────────────────────────────
  // Conversaciones
  // ─────────────────────────────────────────────────────────

  async getOrCreateConversation(
    myUserId: string,
    otherUserId: string,
    campaignId?: string,
    subject?: string,
  ) {
    const conv = await this.chatRepo.getOrCreateConversation(
      myUserId,
      otherUserId,
      campaignId,
      subject,
    );
    return conv;
  }

  async getMyConversations(userId: string) {
    const rows = await this.chatRepo.findConversationsByUser(userId);
    return rows.map((r) => this.formatConversation(r));
  }

  // ─────────────────────────────────────────────────────────
  // Mensajes
  // ─────────────────────────────────────────────────────────

  async getMessages(conversationId: string, userId: string, limit = 50, beforeId?: string) {
    const isParticipant = await this.chatRepo.isParticipant(conversationId, userId);
    if (!isParticipant) throw new ForbiddenException('No tienes acceso a esta conversación');

    const rows = await this.chatRepo.findMessages(conversationId, limit, beforeId);
    // Devolvemos en orden cronológico (más antiguo primero)
    return rows.map((r) => this.formatMessage(r)).reverse();
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    messageType: string = 'text',
  ) {
    const isParticipant = await this.chatRepo.isParticipant(conversationId, senderId);
    if (!isParticipant) throw new ForbiddenException('No tienes acceso a esta conversación');

    if (!content?.trim()) throw new NotFoundException('El mensaje no puede estar vacío');

    const msg = await this.chatRepo.saveMessage(conversationId, senderId, content.trim(), messageType);
    return this.formatMessage(msg);
  }

  async markConversationAsRead(conversationId: string, userId: string) {
    const isParticipant = await this.chatRepo.isParticipant(conversationId, userId);
    if (!isParticipant) throw new ForbiddenException('No tienes acceso a esta conversación');
    await this.chatRepo.markAsRead(conversationId, userId);
  }

  async validateParticipant(conversationId: string, userId: string): Promise<boolean> {
    return this.chatRepo.isParticipant(conversationId, userId);
  }

  async getConversationById(id: string) {
    return this.chatRepo.findConversationById(id);
  }

  async getOtherParticipant(conversationId: string, myUserId: string) {
    return this.chatRepo.getOtherParticipant(conversationId, myUserId);
  }
}
