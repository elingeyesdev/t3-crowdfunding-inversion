import { Injectable, BadRequestException } from '@nestjs/common';
import { BaseRepository } from '../../../common/database';
import { InvestmentResult, mapRowToInvestment } from '../models/investment.model';
import { InvestmentDto } from '../dto/investment.dto';

interface NotifyParams {
  entrepreneurUserId: string;
  isFunded: boolean;
  goalAmount: number;
  campaignTitle: string;
  campaignId: string;
  campaignCurrency: string;
  investmentId: string;
  investorUserId: string;
  amount: number;
}

@Injectable()
export class InvestmentsRepository extends BaseRepository {

  /**
   * Motor transaccional SQL: Descuenta saldo simulado y registra la inversión.
   * Los triggers del DB (sync_campaign_totals, sync_reward_tier_claims) se encargan
   * de actualizar current_amount, investor_count y current_claims automáticamente.
   *
   * @param onNotify Callback opcional que recibe los datos para enviar notificaciones
   *                 fuera de la transacción (así no bloquea el commit).
   */
  async createInvestmentTransaction(
    userId: string,
    dto: InvestmentDto,
    onNotify?: (params: NotifyParams) => Promise<void>,
  ): Promise<InvestmentResult> {

    // Variables que capturamos dentro de la TX y usamos fuera
    let campaignTitle = '';
    let campaignCurrency = 'BOB';
    let goalAmount = 0;
    let entrepreneurUserId = '';
    let isFunded = false;
    let availableCapital = 0;

    const investmentRow = await this.transaction(async (client) => {
      // 1. Read & Lock Investor Profile (Pessimistic Write Lock)
      const investorResult = await client.query(
        `SELECT max_investment, total_invested FROM investor_profiles WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      if (investorResult.rows.length === 0) {
        throw new BadRequestException('El perfil de inversor no existe o no tiene saldo configurado.');
      }

      const investor = investorResult.rows[0];
      const maxInvestment = Number(investor.max_investment) || 0;
      const totalInvested = Number(investor.total_invested) || 0;
      availableCapital = maxInvestment - totalInvested;

      // 2. Validar saldo disponible
      if (availableCapital < dto.amount) {
        throw new BadRequestException('Saldo simulado insuficiente para realizar esta inversión.');
      }

      // 3. Validar y bloquear la campaña
      // campaigns.creator_id referencia directamente users(id) — no hay entrepreneur_id
      const campaignResult = await client.query(
        `SELECT id, status, end_date, min_investment, goal_amount, current_amount,
                campaign_type, title, currency, creator_id AS entrepreneur_user_id
         FROM campaigns
         WHERE id = $1 FOR UPDATE`,
        [dto.campaignId]
      );

      if (campaignResult.rows.length === 0) {
        throw new BadRequestException('La campaña especificada no existe.');
      }

      const campaign = campaignResult.rows[0];

      if (campaign.status !== 'published' && campaign.status !== 'partially_funded') {
        throw new BadRequestException('La campaña no está activa o no acepta inversiones actualmente.');
      }

      if (campaign.end_date && new Date(campaign.end_date) < new Date()) {
        throw new BadRequestException('La fecha límite de la campaña ya ha expirado.');
      }

      const minInvestment = Number(campaign.min_investment) || 0;
      if (dto.amount < minInvestment) {
        throw new BadRequestException(
          `El monto de inversión (Bs. ${dto.amount.toLocaleString('es-BO')}) es menor al mínimo requerido por la campaña (Bs. ${minInvestment.toLocaleString('es-BO')}).`
        );
      }

      goalAmount = Number(campaign.goal_amount) || 0;
      const currentAmount = Number(campaign.current_amount) || 0;
      const remainingAmount = goalAmount - currentAmount;

      if (goalAmount > 0 && remainingAmount <= 0) {
        throw new BadRequestException('La campaña ya alcanzó su meta y no acepta más donaciones.');
      }

      if (dto.amount > remainingAmount) {
        throw new BadRequestException(
          `El monto de inversión (Bs. ${dto.amount.toLocaleString('es-BO')}) supera el saldo restante de la campaña (Bs. ${remainingAmount.toLocaleString('es-BO')}).`
        );
      }

      // Capturar datos para notificaciones (se usan fuera de la TX)
      campaignTitle = campaign.title;
      campaignCurrency = campaign.currency ?? 'BOB';
      entrepreneurUserId = campaign.entrepreneur_user_id;
      isFunded = (currentAmount + dto.amount) >= goalAmount;

      // 4. Asignación automática de reward tier por porcentaje
      let rewardTierId: string | null = null;
      
      if (goalAmount > 0) {
        const percentage = (dto.amount / goalAmount) * 100;
        
        const tierResult = await client.query(
          `SELECT id, title, max_claims, current_claims, is_active
           FROM reward_tiers
           WHERE campaign_id = $1 
             AND is_active = true
             AND min_percentage <= $2 
             AND max_percentage >= $2
           ORDER BY min_percentage DESC
           LIMIT 1
           FOR UPDATE`,
          [dto.campaignId, percentage]
        );

        if (tierResult.rows.length > 0) {
          const tier = tierResult.rows[0];
          const tierMaxClaims = tier.max_claims !== null ? Number(tier.max_claims) : null;
          const tierCurrentClaims = Number(tier.current_claims);

          if (tierMaxClaims === null || tierCurrentClaims < tierMaxClaims) {
            rewardTierId = tier.id;
          } else {
            console.log(`[RewardAssignment] Tier "${tier.title}" ha alcanzado su límite (${tierCurrentClaims}/${tierMaxClaims}). Inversión sin recompensa.`);
          }
        } else {
          console.log(`[RewardAssignment] Sin tier activo para ${((dto.amount / goalAmount) * 100).toFixed(2)}% en campaña ${dto.campaignId}.`);
        }
      }

      // 5. Descontar el saldo del inversor
      await client.query(
        `UPDATE investor_profiles
         SET total_investments = total_investments + 1,
             total_invested = total_invested + $2
         WHERE user_id = $1`,
        [userId, dto.amount]
      );

      // 5.1. Actualizar estado de campaña a 'funded' si corresponde.
      //      NOTA: current_amount e investor_count los actualiza el trigger
      //      trg_sync_campaign_totals automáticamente al insertar la inversión.
      //      Aquí solo cambiamos el status si se alcanzó la meta.
      if (isFunded && campaign.status !== 'funded') {
        await client.query(
          `UPDATE campaigns SET status = 'funded' WHERE id = $1`,
          [dto.campaignId]
        );
      }

      // 5.2. reward_tiers.current_claims lo actualiza el trigger trg_sync_reward_tier_claims.

      // 5.3. Actualizar total recaudado del emprendedor
      await client.query(
        `UPDATE entrepreneur_profiles 
         SET total_raised = total_raised + $2 
         WHERE user_id = $1`,
        [entrepreneurUserId, dto.amount]
      );

      // 6. Insertar la inversión
      const insertResult = await client.query(
        `INSERT INTO investments (
          campaign_id, investor_id, amount, reward_tier_id, status
        ) VALUES (
          $1, $2, $3, $4, 'completed'
        ) RETURNING *`,
        [dto.campaignId, userId, dto.amount, rewardTierId]
      );

      const inv = insertResult.rows[0];

      // 7. Insertar registro en el Ledger Financiero (transactions)
      await client.query(
        `INSERT INTO transactions (
          investment_id, transaction_type, amount, status
        ) VALUES (
          $1, 'payment', $2, 'completed'
        )`,
        [inv.id, dto.amount]
      );

      // 8. Crear el registro en reward_claims si corresponde
      if (rewardTierId) {
        await client.query(
          `INSERT INTO reward_claims (investment_id, status) VALUES ($1, 'pending')`,
          [inv.id]
        );
      }

      return inv;
    });

    const investmentObj = mapRowToInvestment(investmentRow);

    // 9. Enviar notificaciones fuera de la transacción para no bloquear el commit
    if (onNotify) {
      try {
        await onNotify({
          entrepreneurUserId,
          isFunded,
          goalAmount,
          campaignTitle,
          campaignId: dto.campaignId,
          campaignCurrency,
          investmentId: investmentObj.id,
          investorUserId: userId,
          amount: dto.amount,
        });
      } catch (err) {
        console.error('[Notifications] Error al enviar notificaciones:', err);
      }
    }

    return {
      ticket: investmentObj,
      remainingBalance: availableCapital - dto.amount,
    };
  }

  /**
   * Obtiene el historial de inversiones de un inversor con información de campaña y recompensa
   */
  async getInvestmentsByUserId(userId: string, limit: number, offset: number): Promise<any[]> {
    const result = await this.query(
      `SELECT
         i.id,
         i.campaign_id,
         i.amount,
         i.currency,
         i.status,
         i.reward_tier_id,
         i.created_at,
         c.title AS campaign_title,
         c.campaign_type,
         c.goal_amount AS campaign_goal,
         c.cover_image_url AS campaign_cover,
         c.status AS campaign_status,
         rt.title AS reward_title,
         rt.description AS reward_description
       FROM investments i
       JOIN campaigns c ON c.id = i.campaign_id
       LEFT JOIN reward_tiers rt ON rt.id = i.reward_tier_id
       WHERE i.investor_id = $1
       ORDER BY i.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      amount: Number(row.amount),
      investmentStatus: row.status,
      createdAt: row.created_at,
      campaignId: row.campaign_id,
      campaignTitle: row.campaign_title,
      campaignType: row.campaign_type,
      campaignGoal: Number(row.campaign_goal),
      campaignCoverImage: row.campaign_cover,
      campaignStatus: row.campaign_status,
      rewardTitle: row.reward_title,
    }));
  }
  /**
   * Obtiene los detalles completos de una inversión para generar el recibo
   */
  async getInvestmentDetails(userId: string, investmentId: string): Promise<any> {
    const query = `
      SELECT
        i.id AS investment_id,
        i.amount,
        i.currency,
        i.status AS investment_status,
        i.created_at AS investment_date,
        c.title AS campaign_title,
        c.campaign_type,
        c.currency AS campaign_currency,
        u.email AS investor_email,
        ip.first_name AS investor_first_name,
        ip.last_name AS investor_last_name,
        rt.title AS reward_title
      FROM investments i
      JOIN campaigns c ON c.id = i.campaign_id
      JOIN users u ON u.id = i.investor_id
      LEFT JOIN investor_profiles ip ON ip.user_id = u.id
      LEFT JOIN reward_tiers rt ON rt.id = i.reward_tier_id
      WHERE i.id = $1 AND i.investor_id = $2
    `;
    const result = await this.query(query, [investmentId, userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  }
}
