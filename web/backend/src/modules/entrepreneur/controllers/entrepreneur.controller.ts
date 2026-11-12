import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { EntrepreneurService } from '../services';
import {
  CreateEntrepreneurProfileDto,
  UpdateEntrepreneurProfileDto,
  QueryCampaignsDto,
  CreateCampaignDto,
} from '../dto';
import { ApiSuccessResponse, PaginatedResponse } from '../../../common/dto';
import {
  EntrepreneurProfile,
  EntrepreneurCampaign,
  CampaignFinancialProgress,
  EntrepreneurFinancialSummary,
  CampaignCreationReadiness,
  CampaignInvestor,
} from '../models';

@ApiTags('entrepreneur-profile')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('entrepreneurs')
export class EntrepreneurController {
  constructor(private readonly entrepreneurService: EntrepreneurService) { }

  @Post('me/profile')
  @ApiOperation({ summary: 'Crear perfil de emprendedor (EDT 1.1)' })
  @ApiResponse({ status: 201, description: 'Perfil creado exitosamente.' })
  @ApiResponse({ status: 409, description: 'El usuario ya tiene un perfil.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  async createProfile(
    @Req() req: Request,
    @Body() dto: CreateEntrepreneurProfileDto,
  ): Promise<ApiSuccessResponse<EntrepreneurProfile>> {
    const userId = (req as any).user.id;
    const profile = await this.entrepreneurService.createProfile(userId, dto);
    return new ApiSuccessResponse(profile, 'Perfil creado exitosamente');
  }

  @Get('me/profile')
  @ApiOperation({ summary: 'Obtener mi perfil de emprendedor' })
  @ApiResponse({ status: 200, description: 'Perfil retornado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Perfil no encontrado.' })
  async getMyProfile(
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<EntrepreneurProfile>> {
    const userId = (req as any).user.id;
    const profile = await this.entrepreneurService.getMyProfile(userId);
    return new ApiSuccessResponse(profile);
  }

  @Get('me/profile/campaign-readiness')
  @ApiOperation({
    summary: 'Comprobar si el perfil permite crear campañas',
  })
  @ApiResponse({ status: 200, description: 'Estado de requisitos para nuevas campañas.' })
  async getCampaignReadiness(
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<CampaignCreationReadiness>> {
    const userId = (req as any).user.id;
    const readiness =
      await this.entrepreneurService.getCampaignCreationReadiness(userId);
    return new ApiSuccessResponse(readiness);
  }

  @Put('me/profile')
  @ApiOperation({ summary: 'Actualizar mi perfil (EDT 1.2)' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado exitosamente.' })
  async updateMyProfile(
    @Req() req: Request,
    @Body() dto: UpdateEntrepreneurProfileDto,
  ): Promise<ApiSuccessResponse<EntrepreneurProfile>> {
    const userId = (req as any).user.id;
    const profile = await this.entrepreneurService.updateMyProfile(userId, dto);
    return new ApiSuccessResponse(profile, 'Perfil actualizado exitosamente');
  }

  @Delete('me/profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar mi perfil de emprendedor' })
  @ApiResponse({ status: 200, description: 'Perfil eliminado.' })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar si hay campañas asociadas.',
  })
  @ApiResponse({ status: 404, description: 'Sin perfil de emprendedor.' })
  async deleteMyProfile(
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<null>> {
    const userId = (req as any).user.id;
    await this.entrepreneurService.deleteMyProfile(userId);
    return new ApiSuccessResponse(null, 'Perfil de emprendedor eliminado');
  }

  @Get(':id/profile')
  @ApiOperation({ summary: 'Obtener perfil público de un emprendedor' })
  async getProfileById(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<EntrepreneurProfile>> {
    const profile = await this.entrepreneurService.getProfileById(id);
    return new ApiSuccessResponse(profile);
  }
  @Post('me/profile/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/profiles',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @ApiOperation({ summary: 'Subir avatar del emprendedor' })
  async uploadAvatar(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiSuccessResponse<EntrepreneurProfile>> {
    const userId = (req as any).user.id;
    const url = `/uploads/profiles/${file.filename}`;
    const profile = await this.entrepreneurService.updateMyProfile(userId, {
      avatarUrl: url,
    } as any);
    return new ApiSuccessResponse(profile, 'Avatar actualizado');
  }

  @Post('me/profile/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/profiles',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @ApiOperation({ summary: 'Subir portada del emprendedor' })
  async uploadCover(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiSuccessResponse<EntrepreneurProfile>> {
    const userId = (req as any).user.id;
    const url = `/uploads/profiles/${file.filename}`;
    const profile = await this.entrepreneurService.updateMyProfile(userId, {
      coverUrl: url,
    } as any);
    return new ApiSuccessResponse(profile, 'Portada actualizada');
  }
  @Post('me/kyc')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'idDocument', maxCount: 1 },
      { name: 'faceVideo', maxCount: 1 },
    ], {
      storage: diskStorage({
        destination: './uploads/kyc',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @ApiOperation({ summary: 'Subir documentos para verificación KYC' })
  async uploadKycDocuments(
    @Req() req: Request,
    @UploadedFiles() files: { idDocument?: Express.Multer.File[], faceVideo?: Express.Multer.File[] },
  ): Promise<ApiSuccessResponse<EntrepreneurProfile>> {
    const userId = (req as any).user.id;
    if (!files.idDocument || !files.idDocument[0]) {
      throw new Error('El documento de identidad es requerido');
    }
    if (!files.faceVideo || !files.faceVideo[0]) {
      throw new Error('La validación facial es requerida');
    }
    
    const idDocumentUrl = `/uploads/kyc/${files.idDocument[0].filename}`;
    const faceVideoUrl = `/uploads/kyc/${files.faceVideo[0].filename}`;
    
    const profile = await this.entrepreneurService.submitKyc(userId, idDocumentUrl, faceVideoUrl);
    return new ApiSuccessResponse(profile, 'Documentos KYC enviados para revisión');
  }

  @ApiTags('entrepreneur-campaigns')
  @Post('me/campaigns')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear nueva campaña (EDT 1.3)' })
  @ApiResponse({ status: 201, description: 'Campaña creada exitosamente.' })
  @ApiResponse({
    status: 400,
    description: 'Perfil incompleto u otros datos inválidos.',
  })
  @ApiResponse({ status: 404, description: 'Sin perfil de emprendedor.' })
  async createCampaign(
    @Req() req: Request,
    @Body() dto: CreateCampaignDto,
  ): Promise<ApiSuccessResponse<EntrepreneurCampaign>> {
    const userId = (req as any).user.id;
    const campaign = await this.entrepreneurService.createCampaign(userId, dto);
    return new ApiSuccessResponse(campaign, 'Campaña creada exitosamente');
  }

  @ApiTags('entrepreneur-campaigns')
  @Post('me/campaigns/:campaignId/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/campaign-documents',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @ApiOperation({ summary: 'Subir documento de respaldo para una campaña' })
  async uploadCampaignDocument(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('justification') justification: string,
  ): Promise<ApiSuccessResponse<any>> {
    const userId = (req as any).user.id;
    if (!file) throw new Error('El archivo es obligatorio');
    if (!justification) throw new Error('La justificación es obligatoria');
    
    const documentUrl = `/uploads/campaign-documents/${file.filename}`;
    const result = await this.entrepreneurService.uploadCampaignDocument(
      userId,
      campaignId,
      file,
      documentUrl,
      justification
    );
    return new ApiSuccessResponse(result, 'Documento subido correctamente');
  }

  @ApiTags('entrepreneur-campaigns')
  @Get('me/campaigns/:campaignId/documents')
  @ApiOperation({ summary: 'Obtener los documentos de respaldo de la campaña' })
  async getCampaignDocuments(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
  ): Promise<ApiSuccessResponse<any[]>> {
    const userId = (req as any).user.id;
    const documents = await this.entrepreneurService.getCampaignDocuments(userId, campaignId);
    return new ApiSuccessResponse(documents);
  }

  @ApiTags('entrepreneur-campaigns')
  @Delete('me/campaigns/:campaignId/documents/:docId')
  @ApiOperation({ summary: 'Eliminar un documento de respaldo' })
  async deleteCampaignDocument(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
    @Param('docId') docId: string,
  ): Promise<ApiSuccessResponse<null>> {
    const userId = (req as any).user.id;
    await this.entrepreneurService.deleteCampaignDocument(userId, campaignId, docId);
    return new ApiSuccessResponse(null, 'Documento eliminado');
  }

  @ApiTags('entrepreneur-campaigns')
  @Patch('me/campaigns/:campaignId')
  @ApiOperation({ summary: 'Actualizar datos de una campaña (Borrador o Rechazada)' })
  @ApiResponse({ status: 200, description: 'Campaña actualizada.' })
  async updateCampaign(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
    @Body() dto: Partial<CreateCampaignDto>,
  ): Promise<ApiSuccessResponse<EntrepreneurCampaign>> {
    const userId = (req as any).user.id;
    const campaign = await this.entrepreneurService.updateCampaign(
      userId,
      campaignId,
      dto,
    );
    return new ApiSuccessResponse(campaign, 'Campaña actualizada con éxito');
  }

  @ApiTags('entrepreneur-campaigns')
  @Get('me/campaigns')
  @ApiOperation({ summary: 'Listar mis campañas (EDT 1.3)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de campañas.' })
  async getMyCampaigns(
    @Req() req: Request,
    @Query() query: QueryCampaignsDto,
  ): Promise<ApiSuccessResponse<PaginatedResponse<EntrepreneurCampaign>>> {
    const userId = (req as any).user.id;
    const result = await this.entrepreneurService.getMyCampaigns(userId, query);
    return new ApiSuccessResponse(result);
  }

  @ApiTags('entrepreneur-campaigns')
  @Post('me/campaigns/:campaignId/submit-for-review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar campaña en borrador a revisión' })
  @ApiResponse({ status: 200, description: 'Estado actualizado.' })
  @ApiResponse({ status: 400, description: 'Transición no permitida.' })
  async submitCampaignForReview(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
  ): Promise<ApiSuccessResponse<EntrepreneurCampaign>> {
    const userId = (req as any).user.id;
    const campaign = await this.entrepreneurService.submitCampaignForReview(
      userId,
      campaignId,
    );
    return new ApiSuccessResponse(campaign, 'Campaña enviada a revisión');
  }

  @ApiTags('entrepreneur-campaigns')
  @Get('me/campaigns/:campaignId/history')
  @ApiOperation({ summary: 'Obtener historial de auditoría de una campaña propia' })
  @ApiResponse({ status: 200, description: 'Historial de estados y feedback.' })
  async getCampaignHistory(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
  ): Promise<ApiSuccessResponse<any[]>> {
    const userId = (req as any).user.id;
    const history = await this.entrepreneurService.getCampaignHistory(
      userId,
      campaignId,
    );
    return new ApiSuccessResponse(history, 'Historial de campaña obtenido');
  }

  @ApiTags('entrepreneur-campaigns')
  @Post('me/campaigns/:campaignId/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publicar campaña (borrador o aprobada)' })
  @ApiResponse({ status: 200, description: 'Campaña publicada.' })
  @ApiResponse({ status: 400, description: 'Transición no permitida.' })
  async publishCampaign(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
  ): Promise<ApiSuccessResponse<EntrepreneurCampaign>> {
    const userId = (req as any).user.id;
    const campaign = await this.entrepreneurService.publishCampaign(
      userId,
      campaignId,
    );
    return new ApiSuccessResponse(campaign, 'Campaña publicada');
  }

  @ApiTags('entrepreneur-campaigns')
  @Post('me/campaigns/:campaignId/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/campaigns',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @ApiOperation({ summary: 'Subir portada de una campaña' })
  async uploadCampaignCover(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiSuccessResponse<EntrepreneurCampaign>> {
    const userId = (req as any).user.id;
    const url = `/uploads/campaigns/${file.filename}`;
    const campaign = await this.entrepreneurService.updateCampaignCover(
      userId,
      campaignId,
      url,
    );
    return new ApiSuccessResponse(campaign, 'Portada de campaña actualizada');
  }

  @ApiTags('entrepreneur-campaigns')
  @Get('me/campaigns/:campaignId')
  @ApiOperation({ summary: 'Obtener detalle de una campaña propia' })
  async getMyCampaignById(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
  ): Promise<ApiSuccessResponse<EntrepreneurCampaign>> {
    const userId = (req as any).user.id;
    const campaign = await this.entrepreneurService.getMyCampaignById(
      userId,
      campaignId,
    );
    return new ApiSuccessResponse(campaign);
  }

  @ApiTags('entrepreneur-finances')
  @Get('me/finances/summary')
  @ApiOperation({ summary: 'Obtener resumen financiero global' })
  async getMyFinancialSummary(
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<EntrepreneurFinancialSummary>> {
    const userId = (req as any).user.id;
    const summary = await this.entrepreneurService.getMyFinancialSummary(
      userId,
    );
    return new ApiSuccessResponse(summary);
  }

  @ApiTags('entrepreneur-finances')
  @Get('me/campaigns/:campaignId/financial-progress')
  @ApiOperation({ summary: 'Progreso financiero de una campaña (EDT 1.4)' })
  @ApiResponse({ status: 200, description: 'Progreso financiero retornado.' })
  async getCampaignFinancialProgress(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
  ): Promise<ApiSuccessResponse<CampaignFinancialProgress>> {
    const userId = (req as any).user.id;
    const progress = await this.entrepreneurService.getCampaignFinancialProgress(
      userId,
      campaignId,
    );
    return new ApiSuccessResponse(progress);
  }

  @ApiTags('entrepreneur-campaigns')
  @Get('me/campaigns/:campaignId/investors')
  @ApiOperation({ summary: 'Obtener lista de inversores de una campaña propia' })
  @ApiResponse({ status: 200, description: 'Lista de inversores retornada.' })
  async getCampaignInvestors(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<ApiSuccessResponse<PaginatedResponse<CampaignInvestor>>> {
    const userId = (req as any).user.id;
    const result = await this.entrepreneurService.getCampaignInvestors(
      userId,
      campaignId,
      { page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20 },
    );
    return new ApiSuccessResponse(result);
  }
  @ApiTags('entrepreneur-campaigns')
  @Delete('me/campaigns/:campaignId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar una campaña (Solo Borrador o Rechazada)' })
  @ApiResponse({ status: 200, description: 'Campaña eliminada exitosamente.' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar una campaña activa.' })
  async deleteCampaign(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
  ): Promise<ApiSuccessResponse<null>> {
    const userId = (req as any).user.id;
    await this.entrepreneurService.deleteCampaign(userId, campaignId);
    return new ApiSuccessResponse(null, 'Campaña eliminada exitosamente');
  }

  @ApiTags('entrepreneur-campaigns')
  @Post('me/campaigns/:campaignId/finalize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalizar una campaña activa' })
  @ApiResponse({ status: 200, description: 'Campaña finalizada exitosamente.' })
  async finalizeCampaign(
    @Req() req: Request,
    @Param('campaignId') campaignId: string,
  ): Promise<ApiSuccessResponse<EntrepreneurCampaign>> {
    const userId = (req as any).user.id;
    const campaign = await this.entrepreneurService.finalizeCampaign(
      userId,
      campaignId,
    );
    return new ApiSuccessResponse(campaign, 'Campaña finalizada exitosamente');
  }
}
