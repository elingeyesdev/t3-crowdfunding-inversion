import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from '../services/chat.service';
import { NotificationsService } from '../../notifications/services/notifications.service';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // userId -> Set de socketIds (un usuario puede tener múltiples tabs)
  private onlineUsers = new Map<string, Set<string>>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────────────────
  // Conexión / Desconexión
  // ─────────────────────────────────────────────────────────

  async handleConnection(socket: AuthenticatedSocket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        socket.emit('error', { message: 'Token requerido' });
        socket.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET', 'change-me-in-production');
      const payload = this.jwtService.verify<{ sub: string; email: string }>(token, { secret });

      socket.data.userId = payload.sub;
      socket.data.email  = payload.email;

      // Registrar en mapa de usuarios online
      if (!this.onlineUsers.has(payload.sub)) {
        this.onlineUsers.set(payload.sub, new Set());
      }
      this.onlineUsers.get(payload.sub)!.add(socket.id);

      // El socket se une automáticamente a una sala personal por userId
      socket.join(`user:${payload.sub}`);

      console.log(`🟢 Chat conectado: ${payload.email} (socket: ${socket.id})`);
    } catch {
      socket.emit('error', { message: 'Token inválido o expirado' });
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthenticatedSocket) {
    const userId = socket.data?.userId;
    if (userId) {
      const sockets = this.onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) this.onlineUsers.delete(userId);
      }
    }
    console.log(`🔴 Chat desconectado: ${socket.id}`);
  }

  // ─────────────────────────────────────────────────────────
  // Unirse a una sala de conversación
  // ─────────────────────────────────────────────────────────

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = socket.data?.userId;
    if (!userId) throw new WsException('No autenticado');

    const isParticipant = await this.chatService.validateParticipant(
      data.conversationId,
      userId,
    );

    if (!isParticipant) {
      socket.emit('error', { message: 'No tienes acceso a esta conversación' });
      return;
    }

    socket.join(`conv:${data.conversationId}`);

    // Marcar como leído al unirse
    await this.chatService.markConversationAsRead(data.conversationId, userId);

    socket.emit('joined_room', { conversationId: data.conversationId });
  }

  // ─────────────────────────────────────────────────────────
  // Abandonar sala
  // ─────────────────────────────────────────────────────────

  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    socket.leave(`conv:${data.conversationId}`);
  }

  // ─────────────────────────────────────────────────────────
  // Enviar mensaje
  // ─────────────────────────────────────────────────────────

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; content: string },
  ) {
    const userId = socket.data?.userId;
    if (!userId) throw new WsException('No autenticado');

    if (!data.conversationId || !data.content?.trim()) {
      socket.emit('error', { message: 'conversationId y content son requeridos' });
      return;
    }

    try {
      const message = await this.chatService.sendMessage(
        data.conversationId,
        userId,
        data.content,
      );

      // Emitir a todos los participantes de la sala (incluyendo el remitente)
      this.server
        .to(`conv:${data.conversationId}`)
        .emit('new_message', message);

      // Obtener el otro participante
      const otherParticipant = await this.chatService.getOtherParticipant(
        data.conversationId,
        userId,
      );
      if (otherParticipant) {
        // Notificar via WebSocket para badge de no leídos
        this.server
          .to(`user:${otherParticipant.id}`)
          .emit('conversation_updated', {
            conversationId: data.conversationId,
            lastMessage: message,
          });

        // Notificar en el sistema de notificaciones (campana) si el receptor
        // no está actualmente dentro de la sala de la conversación
        const recipientSockets = this.onlineUsers.get(otherParticipant.id);
        const isInRoom = recipientSockets
          ? [...recipientSockets].some((sid) => {
              const s = this.server.sockets.sockets.get(sid) as any;
              return s?.rooms?.has(`conv:${data.conversationId}`);
            })
          : false;

        if (!isInRoom) {
          const senderName = message.sender?.fullName || message.sender?.email || 'Alguien';
          this.notificationsService.notifyNewMessage({
            recipientUserId: otherParticipant.id,
            senderName,
            senderId: userId,
            conversationId: data.conversationId,
            messagePreview: data.content,
          }).catch((err) => console.error('Error sending message notification:', err));
        }
      }
    } catch (err: any) {
      socket.emit('error', { message: err.message || 'Error al enviar mensaje' });
    }
  }

  // ─────────────────────────────────────────────────────────
  // Indicador de escritura (typing)
  // ─────────────────────────────────────────────────────────

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = socket.data?.userId;
    if (!userId) return;

    // Broadcast a todos en la sala EXCEPTO el remitente
    socket.to(`conv:${data.conversationId}`).emit('user_typing', {
      conversationId: data.conversationId,
      userId,
    });
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = socket.data?.userId;
    if (!userId) return;

    socket.to(`conv:${data.conversationId}`).emit('user_stop_typing', {
      conversationId: data.conversationId,
      userId,
    });
  }

  // ─────────────────────────────────────────────────────────
  // Marcar como leído
  // ─────────────────────────────────────────────────────────

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = socket.data?.userId;
    if (!userId) return;

    await this.chatService.markConversationAsRead(data.conversationId, userId);

    socket.emit('marked_as_read', { conversationId: data.conversationId });
  }

  // ─────────────────────────────────────────────────────────
  // Utilitarios
  // ─────────────────────────────────────────────────────────

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }
}
