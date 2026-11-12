import {
  Controller, Get, Patch, Delete, Put, Param, Query, Body, Req,
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
   * GET /notifications
   * Devuelve notificaciones con paginación, búsqueda y filtros
   */
  @Get()
  @ApiOperation({ summary: 'Obtener notificaciones con paginación y filtros' })
  @ApiResponse({ status: 200, description: 'Lista paginada de notificaciones.' })
  async getNotifications(
    @Req() req: Request,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('unread') unread?: string,
    @Query('typeCode') typeCode?: string,
    @Query('q') q?: string,
  ) {
    const userId = (req as any).user.id;
    const isUnread = unread === 'true' ? true : unread === 'false' ? false : undefined;
    const result = await this.notificationsService.getNotifications(userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      unread: isUnread,
      typeCode,
      q,
    });
    return new ApiSuccessResponse(result, 'Notificaciones obtenidas con éxito.');
  }

  /**
   * GET /notifications/me
   * Devuelve las notificaciones del usuario actual con soporte para filtros
   */
  @Get('me')
  @ApiOperation({ summary: 'Obtener notificaciones del usuario actual' })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones.' })
  async getMyNotifications(
    @Req() req: Request,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('unread') unread?: string,
    @Query('typeCode') typeCode?: string,
    @Query('q') q?: string,
  ) {
    const userId = (req as any).user.id;
    const isUnread = unread === 'true' ? true : unread === 'false' ? false : undefined;
    const result = await this.notificationsService.getNotifications(userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 30,
      unread: isUnread,
      typeCode,
      q,
    });
    return new ApiSuccessResponse(result, 'Notificaciones obtenidas.');
  }

  /**
   * GET /notifications/unread-count
   * Devuelve la cantidad de notificaciones pendientes/no leídas
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Obtener contador de notificaciones no leídas' })
  async getUnreadCount(@Req() req: Request) {
    const userId = (req as any).user.id;
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    return new ApiSuccessResponse({ unreadCount }, 'Contador de no leídas obtenido.');
  }

  /**
   * PATCH /notifications/read-all
   * Marca todas las notificaciones del usuario como leídas
   */
  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  async markAllAsRead(@Req() req: Request, @Body('typeCode') typeCode?: string) {
    const userId = (req as any).user.id;
    const result = await this.notificationsService.markAllAsRead(userId, typeCode);
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    return new ApiSuccessResponse({ updatedCount: result.updated, unreadCount }, `${result.updated} notificaciones marcadas como leídas.`);
  }

  /**
   * DELETE /notifications/clear-read
   * Limpia o elimina todas las notificaciones leídas
   */
  @Delete('clear-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar todas las notificaciones leídas' })
  async clearReadNotifications(@Req() req: Request) {
    const userId = (req as any).user.id;
    const result = await this.notificationsService.clearReadNotifications(userId);
    return new ApiSuccessResponse(result, 'Notificaciones leídas eliminadas.');
  }

  /**
   * GET /notifications/preferences
   * Consulta las preferencias de notificación del usuario
   */
  @Get('preferences')
  @ApiOperation({ summary: 'Obtener preferencias de notificación' })
  async getPreferences(@Req() req: Request) {
    const userId = (req as any).user.id;
    const preferences = await this.notificationsService.getPreferences(userId);
    return new ApiSuccessResponse(preferences, 'Preferencias de notificación obtenidas.');
  }

  /**
   * PUT /notifications/preferences
   * Actualiza las preferencias de notificación del usuario
   */
  @Put('preferences')
  @ApiOperation({ summary: 'Actualizar preferencias de notificación' })
  async updatePreferences(@Req() req: Request, @Body() preferences: any) {
    const userId = (req as any).user.id;
    const updated = await this.notificationsService.updatePreferences(userId, preferences);
    return new ApiSuccessResponse(updated, 'Preferencias de notificación actualizadas.');
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

  /**
   * DELETE /notifications/:id
   * Elimina una notificación específica
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar una notificación' })
  async deleteNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user.id;
    const result = await this.notificationsService.deleteNotification(id, userId);
    return new ApiSuccessResponse(result, 'Notificación eliminada.');
  }
}
