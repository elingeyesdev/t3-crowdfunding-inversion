import {
  Controller, Get, Patch, Param, Req,
  UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { JwtAuthGuard } from '../../auth/guards';
import { NotificationsService } from '../services/notifications.service';
import { ApiSuccessResponse } from '../../../common/dto';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications/me
   * Devuelve las notificaciones del usuario actual (máx. 30)
   */
  @Get('me')
  @ApiOperation({ summary: 'Obtener notificaciones del usuario actual' })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones.' })
  async getMyNotifications(@Req() req: Request) {
    const userId = (req as any).user.id;
    const notifications = await this.notificationsService.getMyNotifications(userId);
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    return new ApiSuccessResponse({ notifications, unreadCount }, 'Notificaciones obtenidas.');
  }

  /**
   * PATCH /notifications/read-all
   * Marca todas las notificaciones del usuario como leídas
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  async markAllAsRead(@Req() req: Request) {
    const userId = (req as any).user.id;
    const result = await this.notificationsService.markAllAsRead(userId);
    return new ApiSuccessResponse(result, `${result.updated} notificaciones marcadas como leídas.`);
  }

  /**
   * PATCH /notifications/:id/read
   * Marca una notificación específica como leída
   */
  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiResponse({ status: 200, description: 'Notificación marcada como leída.' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const result = await this.notificationsService.markAsRead(id, userId);
    return new ApiSuccessResponse(result, 'Notificación actualizada.');
  }
}
