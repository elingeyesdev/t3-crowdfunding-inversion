import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { BaseRepository } from '../../../common/database';
import { RewardTier, mapRowToRewardTier } from '../models/reward-tier.model';
import { CreateRewardTierDto, UpdateRewardTierDto } from '../dto/reward-tier.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class RewardTierRepository extends BaseRepository {
  async create(campaignId: string, dto: CreateRewardTierDto): Promise<RewardTier> {
    const id = randomUUID();
    const query = `
      INSERT INTO reward_tiers (
        id, campaign_id, title, description, amount, min_percentage, max_percentage, currency, max_claims,
        estimated_delivery, includes_shipping, shipping_details, image_url,
        expires_at, items, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const values = [
      id,
      campaignId,
      dto.title,
      dto.description,
      dto.amount || null,
      dto.minPercentage || 0,
      dto.maxPercentage || 100,
      dto.currency || 'BOB',
      dto.maxClaims ?? null,
      dto.estimatedDelivery || null,
      dto.includesShipping ?? false,
      dto.shippingDetails || null,
      dto.imageUrl || null,
      dto.expiresAt || null,
      JSON.stringify(dto.items || []),
      dto.sortOrder || 0,
    ];

    await this.query(query, values);
    const row = await this.queryOne(`SELECT * FROM reward_tiers WHERE id = ?`, [id]);
    return mapRowToRewardTier(row!);
  }

  async findByCampaignId(campaignId: string, onlyActive = true): Promise<RewardTier[]> {
    const query = `
      SELECT * FROM reward_tiers
      WHERE campaign_id = ? ${onlyActive ? 'AND is_active = true' : ''}
      ORDER BY sort_order ASC, min_percentage ASC
    `;
    const rows = await this.queryMany(query, [campaignId]);
    return rows.map(mapRowToRewardTier);
  }

  async findById(id: string): Promise<RewardTier | null> {
    const row = await this.queryOne(`SELECT * FROM reward_tiers WHERE id = ?`, [id]);
    return row ? mapRowToRewardTier(row) : null;
  }

  async update(id: string, dto: UpdateRewardTierDto): Promise<RewardTier> {
    const { clause, values } = this.buildUpdateSet({
      title: dto.title,
      description: dto.description,
      amount: dto.amount,
      min_percentage: dto.minPercentage,
      max_percentage: dto.maxPercentage,
      currency: dto.currency,
      max_claims: dto.maxClaims,
      estimated_delivery: dto.estimatedDelivery,
      includes_shipping: dto.includesShipping,
      shipping_details: dto.shippingDetails,
      image_url: dto.imageUrl,
      expires_at: dto.expiresAt,
      items: dto.items ? JSON.stringify(dto.items) : undefined,
      sort_order: dto.sortOrder,
      is_active: dto.isActive,
    });

    if (!clause) throw new BadRequestException('No fields to update');
    const query = `UPDATE reward_tiers SET ${clause}, updated_at = NOW() WHERE id = ?`;
    await this.query(query, [...values, id]);

    const row = await this.queryOne(`SELECT * FROM reward_tiers WHERE id = ?`, [id]);
    if (!row) throw new NotFoundException('Nivel de recompensa no encontrado');
    return mapRowToRewardTier(row);
  }

  async delete(id: string): Promise<void> {
    const result = await this.query(`DELETE FROM reward_tiers WHERE id = ?`, [id]);
    if (result.rowCount === 0) throw new NotFoundException('Nivel de recompensa no encontrado');
  }

  /**
   * Intenta reclamar una recompensa de forma atómica.
   */
  async claimRewardAtomic(id: string, client?: any): Promise<RewardTier> {
    const db = client || this;
    const before = await db.queryOne(`SELECT * FROM reward_tiers WHERE id = ?`, [id]);

    if (!before) throw new NotFoundException('La recompensa no existe.');
    if (!before.is_active) throw new BadRequestException('Esta recompensa ya no está activa.');

    const maxClaims = before.max_claims !== null ? Number(before.max_claims) : null;
    const currentClaims = Number(before.current_claims);
    if (maxClaims !== null && currentClaims >= maxClaims) {
      throw new BadRequestException('Esta recompensa ha alcanzado su límite máximo (Sold Out).');
    }

    await db.query(
      `UPDATE reward_tiers SET current_claims = current_claims + 1 WHERE id = ?`,
      [id]
    );

    const row = await db.queryOne(`SELECT * FROM reward_tiers WHERE id = ?`, [id]);
    return mapRowToRewardTier(row!);
  }

  async getRewardClaims(campaignId: string): Promise<any[]> {
    const query = `
      SELECT
        rc.id as claim_id,
        rc.status as claim_status,
        rc.tracking_number,
        rc.tracking_url,
        i.id as investment_id,
        i.amount,
        i.created_at as invested_at,
        rt.title as reward_title,
        rt.id as reward_id,
        rt.expires_at,
        u.email as investor_email,
        ip.first_name,
        ip.last_name
      FROM investments i
      JOIN reward_tiers rt ON i.reward_tier_id = rt.id
      JOIN users u ON i.investor_id = u.id
      JOIN investor_profiles ip ON i.investor_id = ip.user_id
      LEFT JOIN reward_claims rc ON rc.investment_id = i.id
      WHERE i.campaign_id = ? AND i.status = 'completed'
      ORDER BY i.created_at DESC
    `;
    return this.queryMany(query, [campaignId]);
  }

  async updateRewardClaim(claimId: string, dto: any): Promise<any> {
    const { clause, values } = this.buildUpdateSet({
      status: dto.status,
      tracking_number: dto.trackingNumber,
      tracking_url: dto.trackingUrl,
      notes: dto.notes,
      shipped_at: dto.status === 'shipped' ? new Date() : undefined,
      delivered_at: dto.status === 'delivered' ? new Date() : undefined,
    });

    if (!clause) return null;

    const query = `UPDATE reward_claims SET ${clause}, updated_at = NOW() WHERE id = ?`;
    await this.query(query, [...values, claimId]);

    const row = await this.queryOne(`SELECT * FROM reward_claims WHERE id = ?`, [claimId]);
    if (!row) throw new NotFoundException('Reclamo de recompensa no encontrado');
    return row;
  }
}
