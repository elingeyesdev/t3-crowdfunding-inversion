import { Controller, Get, Post, Patch, Param, Body, UseGuards, Delete, Query, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from '../services/admin.service';
import { JwtAuthGuard } from '../../auth/guards';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiSuccessResponse } from '../../../common/dto';
import { QueryAdminCampaignsDto } from '../dto/admin-campaigns.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard-stats')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Obtener estadísticas del dashboard' })
  async getDashboardStats() {
    const stats = await this.adminService.getDashboardStats();
    return new ApiSuccessResponse(stats, 'Estadísticas obtenidas');
  }

  @Get('users')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Listar usuarios registrados' })
  async getAllUsers() {
    const users = await this.adminService.getAllUsers();
    return new ApiSuccessResponse(users, 'Usuarios listados');
  }

  @Get('campaigns')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Listar todas las campañas para revisión (Legado)' })
  async getAllCampaigns() {
    const campaigns = await this.adminService.getAllCampaigns();
    return new ApiSuccessResponse(campaigns, 'Campañas listadas');
  }

  @Get('campaigns/pending')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Listar campañas pendientes con filtros y paginación' })
  async getPendingCampaigns(@Query() query: QueryAdminCampaignsDto) {
    const result = await this.adminService.getPendingCampaigns(query);
    return new ApiSuccessResponse(result, 'Listado de campañas obtenido con éxito');
  }

  @Get('campaigns/:id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Obtener detalle completo de una campaña para revisión' })
  async getCampaignDetail(@Param('id') id: string) {
    const campaign = await this.adminService.getCampaignDetail(id);
    return new ApiSuccessResponse(campaign, 'Detalle de campaña obtenido');
  }

  @Get('campaigns/:id/history')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Obtener historial de cambios de una campaña' })
  async getCampaignHistory(@Param('id') id: string) {
    const history = await this.adminService.getCampaignHistory(id);
    return new ApiSuccessResponse(history, 'Historial de campaña obtenido');
  }

  @Get('campaigns/:id/financial-progress')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Obtener progreso financiero detallado de una campaña (Administración)' })
  async getCampaignFinancialProgress(@Param('id') id: string) {
    const progress = await this.adminService.getCampaignFinancialProgress(id);
    return new ApiSuccessResponse(progress, 'Progreso financiero obtenido');
  }

  @Patch('campaigns/:id/status')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Aprobar o rechazar campañas con feedback' })
  async updateCampaignStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('feedback') feedback: string | undefined,
    @Req() req: any,
  ) {
    const reviewerId = req.user.id;
    const updated = await this.adminService.updateCampaignStatus(id, status, reviewerId, feedback);
    return new ApiSuccessResponse(updated, 'Estado de campaña actualizado con éxito');
  }

  @Delete('users/:id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Desactiva un usuario lógicamente' })
  async softDeleteUser(@Param('id') id: string) {
    const deleted = await this.adminService.softDeleteUser(id);
    return new ApiSuccessResponse(deleted, 'Usuario inhabilitado con éxito');
  }

  @Get('campaigns/:id/investors')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Obtener lista de inversores de una campaña (Administración)' })
  async getCampaignInvestors(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const result = await this.adminService.getCampaignInvestors(id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20
    });
    return new ApiSuccessResponse(result, 'Listado de inversores obtenido');
  }

  @Get('campaigns/:id/rewards/claims')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Obtener reclamos de recompensas (Administración)' })
  async getRewardClaims(@Param('id') id: string) {
    const claims = await this.adminService.getRewardClaims(id);
    return new ApiSuccessResponse(claims, 'Reclamos obtenidos');
  }

  @Delete('campaigns/:id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Borra físicamente una campaña, si aplica' })
  async deleteCampaign(@Param('id') id: string, @Req() req: any) {
    const reviewerId = req.user.id;
    const deleted = await this.adminService.hardDeleteCampaign(id, reviewerId);
    return new ApiSuccessResponse(deleted, 'Campaña eliminada o cancelada con éxito');
  }

  @Get('campaigns/:id/documents')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Obtener documentos de respaldo de una campaña' })
  async getCampaignDocuments(@Param('id') id: string) {
    const documents = await this.adminService.getCampaignDocuments(id);
    return new ApiSuccessResponse(documents, 'Documentos obtenidos');
  }

  @Patch('campaigns/:id/documents/:docId/review')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Revisar (aprobar/rechazar) un documento de respaldo' })
  async reviewCampaignDocument(
    @Param('id') campaignId: string,
    @Param('docId') docId: string,
    @Body('status') status: string,
    @Body('reviewerNotes') reviewerNotes: string,
    @Req() req: any,
  ) {
    const reviewerId = req.user.id;
    const updated = await this.adminService.reviewCampaignDocument(campaignId, docId, status, reviewerNotes, reviewerId);
    return new ApiSuccessResponse(updated, 'Documento revisado con éxito');
  }

  @Get('kyc/pending')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Listar solicitudes KYC pendientes' })
  async getPendingKyc() {
    const pending = await this.adminService.getPendingKyc();
    return new ApiSuccessResponse(pending, 'Solicitudes KYC pendientes obtenidas');
  }

  @Post('kyc/:id/review')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Aprobar o rechazar KYC' })
  async reviewKyc(
    @Param('id') entrepreneurId: string,
    @Body('action') action: 'approve' | 'reject',
    @Body('reason') reason: string | undefined,
    @Req() req: any,
  ) {
    const reviewerId = req.user.id;
    const updated = await this.adminService.reviewKyc(entrepreneurId, action, reviewerId, reason);
    return new ApiSuccessResponse(updated, `KYC ${action === 'approve' ? 'aprobado' : 'rechazado'}`);
  }
}
