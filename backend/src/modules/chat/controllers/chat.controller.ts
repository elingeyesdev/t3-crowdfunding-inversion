import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards';
import { ChatService } from '../services/chat.service';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * GET /api/v1/chat/conversations
   * Lista todas las conversaciones del usuario autenticado.
   */
  @Get('conversations')
  @ApiOperation({ summary: 'Listar todas las conversaciones del usuario' })
  async getConversations(@Request() req: any) {
    const userId = req.user.id;
    const conversations = await this.chatService.getMyConversations(userId);
    return { success: true, data: conversations };
  }

  /**
   * POST /api/v1/chat/conversations
   * Obtiene o crea una conversación directa con otro usuario.
   */
  @Post('conversations')
  @ApiOperation({ summary: 'Obtener o crear conversación con otro usuario' })
  async getOrCreateConversation(
    @Request() req: any,
    @Body() body: { otherUserId: string; campaignId?: string; subject?: string },
  ) {
    const userId = req.user.id;
    const conv = await this.chatService.getOrCreateConversation(
      userId,
      body.otherUserId,
      body.campaignId,
      body.subject,
    );
    return { success: true, data: conv };
  }

  /**
   * GET /api/v1/chat/conversations/:id/messages
   * Historial de mensajes paginado para una conversación.
   * Query params: limit (default 50), beforeId (cursor para paginación)
   */
  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Obtener historial de mensajes de una conversación' })
  async getMessages(
    @Request() req: any,
    @Param('id') conversationId: string,
    @Query('limit') limit: string,
    @Query('beforeId') beforeId: string,
  ) {
    const userId = req.user.id;
    const messages = await this.chatService.getMessages(
      conversationId,
      userId,
      limit ? parseInt(limit, 10) : 50,
      beforeId || undefined,
    );
    return { success: true, data: messages };
  }

  /**
   * POST /api/v1/chat/conversations/:id/read
   * Marca una conversación como leída.
   */
  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Marcar conversación como leída' })
  async markAsRead(@Request() req: any, @Param('id') conversationId: string) {
    const userId = req.user.id;
    await this.chatService.markConversationAsRead(conversationId, userId);
    return { success: true, data: null };
  }
}
