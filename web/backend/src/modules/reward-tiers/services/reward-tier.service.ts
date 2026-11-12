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
      `SELECT campaign_type, creator_id, goal_amount FROM campaigns WHERE id = $1`,
      [campaignId]
    );

    if (campaign.rows.length === 0) {
      throw new NotFoundException('Campaña no encontrada');
    }

    const { campaign_type, creator_id, goal_amount } = campaign.rows[0];

    if (creator_id !== userId) {
      throw new ForbiddenException('No tienes permiso para gestionar esta campaña');
    }

    // 3. (Removed) Goal amount sum validation since it's now percentage based

    // TODO: Add percentage overlap validation if needed

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
    const campaign = await this.pool.query(`SELECT creator_id, status, goal_amount FROM campaigns WHERE id = $1`, [campaignId]);
    if (campaign.rows[0].creator_id !== userId) throw new ForbiddenException('No tienes permiso');
    
    if (campaign.rows[0].status !== 'draft' && campaign.rows[0].status !== 'pending_review' && campaign.rows[0].status !== 'in_review') {
      throw new BadRequestException('No se pueden modificar recompensas de una campaña que ya está activa o finalizada.');
    }

    // Goal amount sum validation removed as it's now percentage based

    return this.repository.update(rewardId, dto);
  }

  async deleteRewardTier(userId: string, campaignId: string, rewardId: string): Promise<void> {
    const tier = await this.repository.findById(rewardId);
    if (!tier) throw new NotFoundException('Nivel de recompensa no encontrado');
    
    // Validar propiedad
    const campaign = await this.pool.query(`SELECT creator_id, status FROM campaigns WHERE id = $1`, [campaignId]);
    if (campaign.rows[0].creator_id !== userId) throw new ForbiddenException('No tienes permiso');

    if (campaign.rows[0].status !== 'draft' && campaign.rows[0].status !== 'pending_review' && campaign.rows[0].status !== 'in_review') {
      throw new BadRequestException('No se pueden eliminar recompensas de una campaña que ya está activa o finalizada.');
    }

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

  async updateRewardClaim(userId: string, campaignId: string, claimId: string, dto: any): Promise<any> {
    const campaign = await this.pool.query(`SELECT creator_id, title FROM campaigns WHERE id = $1`, [campaignId]);
    if (campaign.rows.length === 0) throw new NotFoundException('Campaña no encontrada');
    if (campaign.rows[0].creator_id !== userId) throw new ForbiddenException('No autorizado');

    const updatedClaim = await this.repository.updateRewardClaim(claimId, dto);

    // Si cambió el estado a 'shipped' o 'delivered', enviar notificación
    if (dto.status === 'shipped' || dto.status === 'delivered') {
      const code = dto.status === 'shipped' ? 'reward_shipped' : 'reward_delivered';
      
      // Obtener el investor_id de este claim
      const claimDetails = await this.pool.query(`
        SELECT i.investor_id
        FROM reward_claims rc
        JOIN investments i ON rc.investment_id = i.id
        WHERE rc.id = $1
      `, [claimId]);

      if (claimDetails.rows.length > 0) {
        const investorId = claimDetails.rows[0].investor_id;
        const typeResult = await this.pool.query(`SELECT id FROM notification_types WHERE code = $1`, [code]);
        if (typeResult.rows.length > 0) {
          const typeId = typeResult.rows[0].id;
          const title = dto.status === 'shipped' ? 'Recompensa Enviada' : 'Recompensa Entregada';
          const body = dto.status === 'shipped' 
            ? `📦 Tu recompensa de "${campaign.rows[0].title}" ha sido enviada. Tracking: ${dto.trackingNumber || 'N/A'}`
            : `✅ Tu recompensa de "${campaign.rows[0].title}" fue entregada exitosamente.`;

          await this.pool.query(`
            INSERT INTO notifications (user_id, type_id, title, body, channel, reference_type, reference_id)
            VALUES ($1, $2, $3, $4, 'in_app', 'reward_claim', $5)
          `, [investorId, typeId, title, body, claimId]);
        }
      }
    }

    return updatedClaim;
  }
}
