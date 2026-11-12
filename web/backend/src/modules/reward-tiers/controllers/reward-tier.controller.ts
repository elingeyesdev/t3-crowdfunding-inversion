import { Controller, Post, Get, Patch, Delete, Body, Param, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RewardTierService } from '../services/reward-tier.service';
import { CreateRewardTierDto, UpdateRewardTierDto, UpdateRewardClaimDto } from '../dto/reward-tier.dto';
import { ApiSuccessResponse } from '../../../common/dto';

@ApiTags('Reward Tiers')
@Controller('campaigns/:campaignId/rewards')
export class RewardTierController {
  constructor(private readonly service: RewardTierService) {}

  @Get()
  @ApiOperation({ summary: 'Listar niveles de recompensa de una campaña (Activos)' })
  async getRewards(@Param('campaignId') campaignId: string) {
    const rewards = await this.service.getRewardTiers(campaignId, true);
    return new ApiSuccessResponse(rewards);
  }

  @Get('all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Listar todos los niveles de recompensa (Emprendedor)' })
  async getAllRewards(@Req() req: any, @Param('campaignId') campaignId: string) {
    // Para el dashboard del emprendedor, enviamos todas (activas e inactivas)
    const rewards = await this.service.getRewardTiers(campaignId, false);
    return new ApiSuccessResponse(rewards);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Crear un nuevo nivel de recompensa (Solo emprendedor)' })
  async createReward(
    @Req() req: any,
    @Param('campaignId') campaignId: string,
    @Body() dto: CreateRewardTierDto
  ) {
    const userId = req.user.id;
    const reward = await this.service.createRewardTier(userId, campaignId, dto);
    return new ApiSuccessResponse(reward, 'Nivel de recompensa creado exitosamente');
  }

  @Patch(':rewardId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Actualizar un nivel de recompensa' })
  async updateReward(
    @Req() req: any,
    @Param('campaignId') campaignId: string,
    @Param('rewardId') rewardId: string,
    @Body() dto: UpdateRewardTierDto
  ) {
    const userId = req.user.id;
    const reward = await this.service.updateRewardTier(userId, campaignId, rewardId, dto);
    return new ApiSuccessResponse(reward, 'Nivel de recompensa actualizado');
  }

  @Delete(':rewardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Eliminar un nivel de recompensa (si no tiene reclamos)' })
  async deleteReward(
    @Req() req: any,
    @Param('campaignId') campaignId: string,
    @Param('rewardId') rewardId: string
  ) {
    const userId = req.user.id;
    await this.service.deleteRewardTier(userId, campaignId, rewardId);
    return new ApiSuccessResponse(null, 'Recompensa eliminada');
  }

  @Get('claims')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener lista de inversores que reclamaron recompensas' })
  async getClaims(@Req() req: any, @Param('campaignId') campaignId: string) {
    const userId = req.user.id;
    const claims = await this.service.getRewardClaims(userId, campaignId);
    return new ApiSuccessResponse(claims);
  }

  @Patch('claims/:claimId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Actualizar el estado de envío de un reclamo de recompensa' })
  async updateClaim(
    @Req() req: any,
    @Param('campaignId') campaignId: string,
    @Param('claimId') claimId: string,
    @Body() dto: UpdateRewardClaimDto
  ) {
    const userId = req.user.id;
    const updated = await this.service.updateRewardClaim(userId, campaignId, claimId, dto);
    return new ApiSuccessResponse(updated, 'Estado de recompensa actualizado');
  }
}
