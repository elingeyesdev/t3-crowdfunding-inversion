import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { RewardTierRepository } from '../repositories/reward-tier.repository';
import { CreateRewardTierDto, UpdateRewardTierDto } from '../dto/reward-tier.dto';
import { RewardTier } from '../models/reward-tier.model';
import { Pool } from 'pg';

@Injectable()
export class RewardTierService {
  constructor(
    private readonly repository: RewardTierRepository,
    @Inject('DATABASE_POOL') private readonly pool: Pool,
  ) {}

  async createRewardTier(userId: string, campaignId: string, dto: CreateRewardTierDto): Promise<RewardTier> {
    // 1. Validar que la campaña existe y pertenece al usuario
    const campaign = await this.pool.query(
      `SELECT campaign_type, creator_id FROM campaigns WHERE id = $1`,
      [campaignId]
    );

    if (campaign.rows.length === 0) {
      throw new NotFoundException('Campaña no encontrada');
    }

    const { campaign_type, creator_id } = campaign.rows[0];

    if (creator_id !== userId) {
      throw new ForbiddenException('No tienes permiso para gestionar esta campaña');
    }

    // 2. REGLA DE NEGOCIO: Solo campañas tipo 'reward' pueden tener tiers
    if (campaign_type !== 'reward') {
      throw new BadRequestException('Solo las campañas de tipo "reward" (recompensa) pueden tener niveles de recompensa');
    }

    return this.repository.create(campaignId, dto);
  }

  async getRewardTiers(campaignId: string, onlyActive = true): Promise<RewardTier[]> {
    return this.repository.findByCampaignId(campaignId, onlyActive);
  }

  async updateRewardTier(userId: string, campaignId: string, rewardId: string, dto: UpdateRewardTierDto): Promise<RewardTier> {
    const tier = await this.repository.findById(rewardId);
    if (!tier) throw new NotFoundException('Nivel de recompensa no encontrado');
    if (tier.campaignId !== campaignId) throw new BadRequestException('El nivel de recompensa no pertenece a esta campaña');

    // Validar propiedad de la campaña
    const campaign = await this.pool.query(`SELECT creator_id FROM campaigns WHERE id = $1`, [campaignId]);
    if (campaign.rows[0].creator_id !== userId) throw new ForbiddenException('No tienes permiso');

    return this.repository.update(rewardId, dto);
  }

  async deleteRewardTier(userId: string, campaignId: string, rewardId: string): Promise<void> {
    const tier = await this.repository.findById(rewardId);
    if (!tier) throw new NotFoundException('Nivel de recompensa no encontrado');
    
    // Validar propiedad
    const campaign = await this.pool.query(`SELECT creator_id FROM campaigns WHERE id = $1`, [campaignId]);
    if (campaign.rows[0].creator_id !== userId) throw new ForbiddenException('No tienes permiso');

    // No permitir borrar si ya hay inversores asociados
    if (tier.currentClaims > 0) {
      throw new BadRequestException('No se puede eliminar una recompensa que ya ha sido reclamada por inversores. Desactívala en su lugar.');
    }

    return this.repository.delete(rewardId);
  }

  async getRewardClaims(userId: string, campaignId: string): Promise<any[]> {
    const campaign = await this.pool.query(`SELECT creator_id FROM campaigns WHERE id = $1`, [campaignId]);
    if (campaign.rows.length === 0) throw new NotFoundException('Campaña no encontrada');
    if (campaign.rows[0].creator_id !== userId) throw new ForbiddenException('No autorizado');

    return this.repository.getRewardClaims(campaignId);
  }
}
