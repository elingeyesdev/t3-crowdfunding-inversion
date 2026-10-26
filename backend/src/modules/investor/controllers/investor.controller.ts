import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

import { InvestorService } from '../services';
import {
  CreateInvestorProfileDto,
  UpdateInvestorProfileDto,
  AddCapitalDto,
} from '../dto';
import { ApiSuccessResponse } from '../../../common/dto';
import { InvestorProfile, CapitalOverview } from '../models';

@ApiTags('investor-profile')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('investors')
export class InvestorController {
  constructor(private readonly investorService: InvestorService) {}

  // =========================================================================
  // CREAR PERFIL
  // =========================================================================

  /**
   * POST /investors/me/profile
   * Registra el perfil de inversor del usuario autenticado.
   * Solo se puede crear una vez por usuario.
   */
  @Post('me/profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear perfil de inversor' })
  @ApiResponse({ status: 201, description: 'Perfil creado exitosamente.' })
  @ApiResponse({ status: 409, description: 'El usuario ya tiene un perfil de inversor.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  async createProfile(
    @Req() req: Request,
    @Body() dto: CreateInvestorProfileDto,
  ): Promise<ApiSuccessResponse<InvestorProfile>> {
    const userId = (req as any).user.id;
    const profile = await this.investorService.createProfile(userId, dto);
    return new ApiSuccessResponse(profile, 'Perfil de inversor creado exitosamente');
  }

  // =========================================================================
  // OBTENER MI PERFIL
  // =========================================================================

  /**
   * GET /investors/me/profile
   * Devuelve el perfil completo del inversor autenticado.
   */
  @Get('me/profile')
  @ApiOperation({ summary: 'Obtener mi perfil de inversor' })
  @ApiResponse({ status: 200, description: 'Perfil retornado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Perfil no encontrado.' })
  async getMyProfile(
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<InvestorProfile>> {
    const userId = (req as any).user.id;
    const profile = await this.investorService.getMyProfile(userId);
    return new ApiSuccessResponse(profile);
  }

  // =========================================================================
  // CAPITAL Y MÉTRICAS
  // =========================================================================

  /**
   * GET /investors/me/capital
   * Devuelve el resumen de capital disponible e inversiones.
   */
  @Get('me/capital')
  @ApiOperation({ summary: 'Obtener resumen de capital del inversor' })
  @ApiResponse({ status: 200, description: 'Resumen retornado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Perfil no encontrado.' })
  async getCapitalOverview(
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<CapitalOverview>> {
    const userId = (req as any).user.id;
    const overview = await this.investorService.getCapitalOverview(userId);
    return new ApiSuccessResponse(overview);
  }

  // =========================================================================
  // AUMENTAR CAPITAL
  // =========================================================================

  /**
   * POST /investors/me/capital/add
   * Permite al inversor inyectar más capital simulado a su cuenta.
   * Registra la operación en la tabla capital_transactions para auditoría.
   */
  @Post('me/capital/add')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aumentar capital del inversor' })
  @ApiResponse({ status: 200, description: 'Capital aumentado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Perfil no encontrado.' })
  @ApiResponse({ status: 400, description: 'Monto inválido.' })
  async addCapital(
    @Req() req: Request,
    @Body() dto: AddCapitalDto,
  ): Promise<ApiSuccessResponse<{ newMax: number; availableCapital: number }>> {
    const userId = (req as any).user.id;
    const result = await this.investorService.addCapital(userId, dto);
    return new ApiSuccessResponse(result, 'Capital aumentado exitosamente');
  }

  // =========================================================================
  // EDITAR DATOS PERSONALES
  // =========================================================================

  /**
   * PUT /investors/me/profile
   * Edita los datos personales del inversor autenticado.
   * Solo se actualizan los campos enviados en el body.
   */
  @Put('me/profile')
  @ApiOperation({ summary: 'Editar datos personales del inversor' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Perfil no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  async updateMyProfile(
    @Req() req: Request,
    @Body() dto: UpdateInvestorProfileDto,
  ): Promise<ApiSuccessResponse<InvestorProfile>> {
    const userId = (req as any).user.id;
    const profile = await this.investorService.updateMyProfile(userId, dto);
    return new ApiSuccessResponse(profile, 'Perfil actualizado exitosamente');
  }

  /**
   * DELETE /investors/me/profile
   * Elimina el perfil de inversor (no la cuenta). Requiere no tener inversiones.
   */
  @Delete('me/profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar mi perfil de inversor' })
  @ApiResponse({ status: 200, description: 'Perfil eliminado.' })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar si hay inversiones registradas.',
  })
  @ApiResponse({ status: 404, description: 'Sin perfil de inversor.' })
  async deleteMyProfile(
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<null>> {
    const userId = (req as any).user.id;
    await this.investorService.deleteMyProfile(userId);
    return new ApiSuccessResponse(null, 'Perfil de inversor eliminado');
  }

  // =========================================================================
  // VER PERFIL PÚBLICO
  // =========================================================================

  /**
   * GET /investors/:id/profile
   * Vista pública del perfil de un inversor (por su profile ID).
   */
  @Get(':id/profile')
  @ApiOperation({ summary: 'Obtener perfil público de un inversor' })
  @ApiResponse({ status: 200, description: 'Perfil retornado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Perfil no encontrado.' })
  async getProfileById(
    @Param('id') id: string,
  ): Promise<ApiSuccessResponse<InvestorProfile>> {
    const profile = await this.investorService.getProfileById(id);
    return new ApiSuccessResponse(profile);
  }

  // =========================================================================
  // AVATAR & COVER
  // =========================================================================

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
  @ApiOperation({ summary: 'Subir avatar del inversor' })
  async uploadAvatar(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiSuccessResponse<InvestorProfile>> {
    const userId = (req as any).user.id;
    const url = `/uploads/profiles/${file.filename}`;
    const profile = await this.investorService.updateMyProfile(userId, {
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
  @ApiOperation({ summary: 'Subir portada del inversor' })
  async uploadCover(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ApiSuccessResponse<InvestorProfile>> {
    const userId = (req as any).user.id;
    const url = `/uploads/profiles/${file.filename}`;
    const profile = await this.investorService.updateMyProfile(userId, {
      coverUrl: url,
    } as any);
    return new ApiSuccessResponse(profile, 'Portada actualizada');
  }
}
