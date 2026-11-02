import { Injectable, OnModuleInit } from '@nestjs/common';
import { BaseRepository } from '../../../common/database';
import { QueryAdminCampaignsDto } from '../dto/admin-campaigns.dto';
import { randomUUID } from 'crypto';

export function mapRowToAuditItem(row: any) {
  const hasReceipt = Boolean(row.receipt_url && String(row.receipt_url).trim().length > 0);
  const consistencyFlags: Array<{ code: string; severity: 'info' | 'warning' | 'danger'; message: string }> = [];

  const amount = parseFloat(row.amount || 0);
  const campaignGoal = parseFloat(row.campaign_goal || 0);

  if (row.type === 'expense' && !hasReceipt) {
    consistencyFlags.push({
      code: 'NO_RECEIPT',
      severity: 'warning',
      message: 'Gasto registrado sin comprobante o factura adjunta',
    });
  }

  if (amount >= 5000 && !hasReceipt) {
    consistencyFlags.push({
      code: 'HIGH_VALUE_NO_RECEIPT',
      severity: 'danger',
      message: 'Monto elevado sin comprobante o respaldo documental verificado',
    });
  }

  if (row.status === 'flagged') {
    consistencyFlags.push({
      code: 'ADMIN_FLAGGED',
      severity: 'danger',
      message: row.review_notes || 'Marcado por administración con observación de consistencia',
    });
  }

  if (campaignGoal > 0 && amount > campaignGoal * 0.4) {
    consistencyFlags.push({
      code: 'HIGH_PERCENTAGE',
      severity: 'warning',
      message: 'El importe del movimiento supera el 40% de la meta total de la campaña',
    });
  }

  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignTitle: row.campaign_title || 'Campaña sin título',
    campaignStatus: row.campaign_status || 'published',
    campaignCurrency: row.campaign_currency || row.currency || 'BOB',
    campaignGoal: campaignGoal,
    campaignCurrentAmount: parseFloat(row.campaign_current_amount || 0),
    createdBy: row.created_by || '',
    creatorEmail: row.creator_email || '',
    creatorName: row.creator_name || row.creator_email || 'Emprendedor',
    type: row.type as 'income' | 'expense',
    concept: row.concept,
    category: row.category || 'General',
    amount: amount,
    currency: row.currency || 'BOB',
    movementDate: row.movement_date ? new Date(row.movement_date).toISOString().split('T')[0] : '',
    referenceNumber: row.reference_number || null,
    receiptUrl: row.receipt_url || null,
    hasReceipt,
    notes: row.notes || null,
    status: (row.status as any) || 'pending',
    reviewedBy: row.reviewed_by || null,
    reviewerEmail: row.reviewer_email || null,
    reviewerName: row.reviewer_name || null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    reviewNotes: row.review_notes || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    consistencyFlags,
  };
}

@Injectable()
export class AdminRepository extends BaseRepository implements OnModuleInit {
  async onModuleInit() {
    await this.ensureTables();
  }

  async ensureTables() {
    try {
      await this.query(`
        CREATE TABLE IF NOT EXISTS campaign_financial_movements (
          id VARCHAR(36) PRIMARY KEY,
          campaign_id VARCHAR(36) NOT NULL,
          created_by VARCHAR(36),
          type VARCHAR(20) NOT NULL,
          concept VARCHAR(200) NOT NULL,
          category VARCHAR(150) NOT NULL,
          amount DECIMAL(15, 2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'BOB',
          movement_date DATE NOT NULL,
          reference_number VARCHAR(100),
          receipt_url VARCHAR(512),
          notes TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          reviewed_by VARCHAR(36),
          reviewed_at TIMESTAMP,
          review_notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS campaign_funding_plans (
          id VARCHAR(36) PRIMARY KEY,
          campaign_id VARCHAR(36) NOT NULL,
          category VARCHAR(150) NOT NULL,
          description TEXT,
          amount DECIMAL(15, 2) NOT NULL,
          percentage DECIMAL(5, 2),
          sort_order INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Check if movements table is empty
      const countRes = await this.queryOne(`SELECT COUNT(*) as count FROM campaign_financial_movements`);
      if (parseInt(countRes?.count || '0', 10) === 0) {
        const firstCampaign = await this.queryOne(`SELECT id, creator_id FROM campaigns LIMIT 1`);
        if (firstCampaign) {
          const cid = firstCampaign.id;
          const uid = firstCampaign.creator_id;
          await this.query(`
            INSERT INTO campaign_financial_movements 
              (id, campaign_id, created_by, type, concept, category, amount, currency, movement_date, reference_number, receipt_url, notes, status, created_at, updated_at)
            VALUES 
              (?, ?, ?, 'expense', 'Compra de componentes electrónicos y sensores', 'Equipamiento', 2450.00, 'BOB', NOW() - INTERVAL '5 days', 'FAC-48921', '/uploads/receipts/sample_fac_48921.pdf', 'Materiales para fase de pruebas inicial', 'verified', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
              (?, ?, ?, 'expense', 'Servicio de diseño UI/UX y maquetación web', 'Servicios Profesionales', 1800.00, 'BOB', NOW() - INTERVAL '3 days', 'REC-1029', NULL, 'Pago contra entrega de wireframes sin factura comercial', 'flagged', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
              (?, ?, ?, 'expense', 'Campaña publicitaria en redes sociales y difusión', 'Marketing', 950.00, 'BOB', NOW() - INTERVAL '1 day', 'FB-ADS-991', '/uploads/receipts/sample_ads.pdf', 'Anuncios de lanzamiento en Facebook e Instagram', 'pending', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
              (?, ?, ?, 'income', 'Desembolso primera fase de recaudación', 'Fondeo Colectivo', 5200.00, 'BOB', NOW() - INTERVAL '7 days', 'TRF-BANK-001', '/uploads/receipts/sample_bank_trf.pdf', 'Liberación de fondos verificados', 'verified', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days')
          `, [
            randomUUID(), cid, uid,
            randomUUID(), cid, uid,
            randomUUID(), cid, uid,
            randomUUID(), cid, uid
          ]);
        }
      }
    } catch (e) {
      console.warn('AdminRepository ensureTables warning:', e);
    }
  }
  /**
   * Obtiene un resumen de las campañas y usuarios.
   */
  async getDashboardStats() {
    const usersCount = await this.queryOne(`SELECT COUNT(*) as count FROM users`);
    const campaignsCount = await this.queryOne(`SELECT COUNT(*) as count FROM campaigns`);
    const totalCurrentAmount = await this.queryOne(`SELECT COALESCE(SUM(current_amount), 0) as total FROM campaigns`);

    return {
      totalUsers: parseInt(usersCount!.count, 10),
      totalCampaigns: parseInt(campaignsCount!.count, 10),
      totalFunded: parseFloat(totalCurrentAmount!.total),
    };
  }

  async getAllUsers() {
    return this.queryMany(`
      SELECT u.id, u.email, u.created_at, u.is_active
      FROM users u
      LEFT JOIN admin_profiles a ON u.id = a.user_id
      WHERE a.id IS NULL
      ORDER BY u.created_at DESC
    `);
  }

  async getAllCampaigns() {
    return this.queryMany(`
      SELECT c.id, c.title, c.status, c.goal_amount, c.current_amount, c.created_at,
             u.email as creator_email,
             COALESCE(CONCAT(ep.first_name, ' ', ep.last_name), u.email) as creator_name
      FROM campaigns c
      JOIN users u ON c.creator_id = u.id
      LEFT JOIN entrepreneur_profiles ep ON u.id = ep.user_id
      ORDER BY c.created_at DESC
    `);
  }

  async updateCampaignStatus(campaignId: string, status: string, reviewerId: string, feedback?: string) {
    return this.transaction(async (client) => {
      // 1. Get current status for history
      const currentCampaign = await client.query(
        'SELECT status FROM campaigns WHERE id = ?',
        [campaignId]
      );

      if (currentCampaign.rows.length === 0) return null;
      const oldStatus = currentCampaign.rows[0].status;

      // 2. Update campaign status
      if (feedback) {
        await client.query(`
          UPDATE campaigns
          SET status = ?,
              metadata = JSON_SET(COALESCE(metadata, '{}'), '$.review_feedback', ?),
              updated_at = NOW()
          WHERE id = ?
        `, [status, feedback, campaignId]);
      } else {
        await client.query(`
          UPDATE campaigns
          SET status = ?, updated_at = NOW()
          WHERE id = ?
        `, [status, campaignId]);
      }

      // 3. Record status history
      const historyId = randomUUID();
      await client.query(`
        INSERT INTO campaign_status_history (id, campaign_id, from_status, to_status, changed_by, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [historyId, campaignId, oldStatus, status, reviewerId, feedback || 'Cambio de estado administrativo']);

      // 4. Record review if it's a review action (approved, rejected, etc)
      const reviewDecisions = ['approved', 'rejected', 'published', 'changes_requested'];
      if (reviewDecisions.includes(status) || feedback) {
        const decisionMap: Record<string, string> = {
          'published': 'approved',
          'approved': 'approved',
          'rejected': 'rejected',
          'changes_requested': 'changes_requested'
        };

        const reviewId = randomUUID();
        await client.query(`
          INSERT INTO campaign_reviews (id, campaign_id, reviewer_id, decision, feedback, created_at)
          VALUES (?, ?, ?, ?, ?, NOW())
        `, [reviewId, campaignId, reviewerId, decisionMap[status] || 'approved', feedback]);
      }

      return await client.query(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]).then((r: any) => r.rows[0]);
    });
  }

  async getCampaignHistory(campaignId: string) {
    return this.queryMany(`
      SELECT
        h.id,
        h.from_status,
        h.to_status,
        h.reason as feedback,
        h.created_at,
        u.email as changed_by_email,
        COALESCE(CONCAT(ap.first_name, ' ', ap.last_name), u.email) as changed_by_name
      FROM campaign_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      LEFT JOIN admin_profiles ap ON u.id = ap.user_id
      WHERE h.campaign_id = ?
      ORDER BY h.created_at DESC
    `, [campaignId]);
  }

  async createAdminProfile(userId: string, accessLevel: string) {
    const adminId = randomUUID();
    await this.query(`
      INSERT INTO admin_profiles (id, user_id, first_name, last_name, access_level, can_approve_campaigns, can_manage_users, can_manage_finances, is_active, created_at, updated_at)
      VALUES (?, ?, 'Admin', 'User', ?, true, true, true, true, NOW(), NOW())
    `, [adminId, userId, accessLevel]);
    return this.queryOne(`SELECT * FROM admin_profiles WHERE id = ?`, [adminId]);
  }

  async getAllAdmins() {
    return this.queryMany(`
      SELECT a.id, a.user_id, a.first_name, a.last_name, a.access_level, a.is_active, u.email
      FROM admin_profiles a
      JOIN users u ON a.user_id = u.id
      WHERE a.access_level IN ('admin', 'super_admin')
    `);
  }

  async isUserAdmin(userId: string): Promise<boolean> {
    const result = await this.queryOne(`SELECT id FROM admin_profiles WHERE user_id = ?`, [userId]);
    return !!result;
  }

  async deleteAdminProfile(adminId: string) {
    const result = await this.queryOne(`SELECT * FROM admin_profiles WHERE id = ?`, [adminId]);
    if (result) {
      await this.query(`DELETE FROM admin_profiles WHERE id = ?`, [adminId]);
    }
    return result;
  }

  async softDeleteUser(userId: string) {
    const result = await this.queryOne(`SELECT * FROM users WHERE id = ?`, [userId]);
    if (result) {
      await this.query(`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ?`, [userId]);
    }
    return result;
  }

  async hardDeleteCampaign(campaignId: string) {
    const result = await this.queryOne(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
    if (result) {
      await this.query(`DELETE FROM campaigns WHERE id = ?`, [campaignId]);
    }
    return result;
  }

  async findPendingCampaigns(queryDto: QueryAdminCampaignsDto) {
    const { page = 1, limit = 10, status, sortBy = 'created_at', sortOrder = 'DESC', q } = queryDto;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    // Default search for pending if no status provided
    const targetStatus = status || 'pending_review';
    conditions.push(`c.status = ?`);
    params.push(targetStatus);

    if (q) {
      const searchPattern = `%${q}%`;
      conditions.push(`(c.title LIKE ? OR ep.first_name LIKE ? OR ep.last_name LIKE ? OR u.email LIKE ?)`);
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSortFields = ['created_at', 'goal_amount', 'title', 'status'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const dataQuery = `
      SELECT c.id, c.title, c.status, c.goal_amount, c.current_amount, c.created_at, c.campaign_type,
             COALESCE(CONCAT(ep.first_name, ' ', ep.last_name), u.email) as entrepreneur_name,
             u.email as creator_email,
             (
               20 +
               CASE WHEN LENGTH(c.title) > 20 THEN 15 ELSE 0 END +
               CASE WHEN LENGTH(COALESCE(c.description, '')) > 200 THEN 25 ELSE 0 END +
               CASE WHEN c.goal_amount > 1000 THEN 15 ELSE 0 END +
               CASE WHEN c.location IS NOT NULL THEN 10 ELSE 0 END +
               CASE WHEN c.cover_image_url IS NOT NULL THEN 15 ELSE 0 END
             ) as audit_score
      FROM campaigns c
      JOIN users u ON c.creator_id = u.id
      LEFT JOIN entrepreneur_profiles ep ON c.creator_id = ep.user_id
      ${whereClause}
      ORDER BY c.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as count
      FROM campaigns c
      JOIN users u ON c.creator_id = u.id
      LEFT JOIN entrepreneur_profiles ep ON c.creator_id = ep.user_id
      ${whereClause}
    `;

    const [dataRows, countRow] = await Promise.all([
      this.queryMany(dataQuery, [...params, limit, offset]),
      this.queryOne(countQuery, params),
    ]);

    const totalItems = parseInt(countRow!.count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: dataRows.map(row => ({
        ...row,
        goal_amount: parseFloat(row.goal_amount),
        current_amount: parseFloat(row.current_amount),
      })),
      meta: {
        totalItems,
        itemCount: dataRows.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  async getCampaignDetailAdmin(id: string) {
    const query = `
      SELECT c.*,
             u.email as entrepreneur_email,
             ep.first_name as entrepreneur_first_name,
             ep.last_name as entrepreneur_last_name,
             COALESCE(CONCAT(ep.first_name, ' ', ep.last_name), u.email) as entrepreneur_name,
             ep.avatar_url as entrepreneur_avatar,
             ep.bio as entrepreneur_bio,
             ep.linkedin_url as entrepreneur_linkedin,
             ep.website as entrepreneur_website,
             cat.display_name as category_name
      FROM campaigns c
      JOIN users u ON c.creator_id = u.id
      LEFT JOIN entrepreneur_profiles ep ON c.creator_id = ep.user_id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.id = ?
    `;

    const campaign = await this.queryOne(query, [id]);
    if (!campaign) return null;

    let rewardTiers = [];
    try {
      rewardTiers = await this.queryMany(
        `SELECT * FROM reward_tiers WHERE campaign_id = ? ORDER BY amount ASC`,
        [id]
      );
    } catch (e) {
      console.warn('Could not fetch reward tiers or table missing:', e);
    }

    return {
      ...campaign,
      goal_amount: campaign.goal_amount?.toString() || '0',
      current_amount: parseFloat(campaign.current_amount || 0),
      investor_count: parseInt(campaign.investor_count || 0, 10),
      min_investment: parseFloat(campaign.min_investment || 0),
      max_investment: campaign.max_investment ? parseFloat(campaign.max_investment) : null,
      media: [],
      reward_tiers: rewardTiers.map(t => ({
        ...t,
        min_percentage: parseFloat(t.min_percentage || 0),
        max_percentage: parseFloat(t.max_percentage || 100),
      })),
    };
  }

  async getCampaignDocuments(campaignId: string) {
    return this.queryMany(`SELECT * FROM campaign_documents WHERE campaign_id = ? ORDER BY created_at DESC`, [campaignId]);
  }

  async reviewCampaignDocument(campaignId: string, docId: string, status: string, reviewerNotes: string, reviewerId: string) {
    await this.query(
      `UPDATE campaign_documents
       SET status = ?, reviewer_notes = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ? AND campaign_id = ?`,
      [status, reviewerNotes || null, reviewerId, docId, campaignId]
    );
    return this.queryOne(`SELECT * FROM campaign_documents WHERE id = ?`, [docId]);
  }

  async getPendingKyc() {
    return this.queryMany(`
      SELECT ep.id, ep.user_id, ep.first_name, ep.last_name, ep.company_name, ep.kyc_status, ep.verification_documents, ep.updated_at, u.email
      FROM entrepreneur_profiles ep
      JOIN users u ON ep.user_id = u.id
      WHERE ep.kyc_status = 'pending'
      ORDER BY ep.updated_at ASC
    `);
  }

  async reviewKyc(entrepreneurId: string, action: 'approve' | 'reject', reviewerId: string, reason?: string) {
    return this.transaction(async (client) => {
      const kycStatus = action === 'approve' ? 'approved' : 'rejected';
      const identityVerified = action === 'approve';
      const rejectionReason = action === 'reject' ? reason || null : null;

      await client.query(`
        UPDATE entrepreneur_profiles
        SET kyc_status = ?,
            identity_verified = ?,
            identity_verified_at = CASE WHEN ? = true THEN NOW() ELSE identity_verified_at END,
            kyc_rejection_reason = ?,
            updated_at = NOW()
        WHERE id = ?
      `, [kycStatus, identityVerified, identityVerified, rejectionReason, entrepreneurId]);

      return await client.query(`SELECT * FROM entrepreneur_profiles WHERE id = ?`, [entrepreneurId]).then((r: any) => r.rows[0]);
    });
  }

  async getFinancialMovements(params: {
    page?: number;
    limit?: number;
    campaignId?: string;
    type?: string;
    status?: string;
    category?: string;
    hasReceipt?: boolean;
    flagged?: boolean;
    q?: string;
    sortBy?: string;
    sortOrder?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    await this.ensureTables();

    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const queryParams: any[] = [];

    if (params.campaignId) {
      queryParams.push(params.campaignId);
      conditions.push(`m.campaign_id = ?`);
    }

    if (params.type) {
      queryParams.push(params.type);
      conditions.push(`m.type = ?`);
    }

    if (params.status) {
      queryParams.push(params.status);
      conditions.push(`m.status = ?`);
    }

    if (params.category) {
      queryParams.push(params.category);
      conditions.push(`m.category = ?`);
    }

    if (params.hasReceipt === true) {
      conditions.push(`(m.receipt_url IS NOT NULL AND m.receipt_url != '')`);
    } else if (params.hasReceipt === false) {
      conditions.push(`(m.receipt_url IS NULL OR m.receipt_url = '')`);
    }

    if (params.flagged === true) {
      conditions.push(`m.status = 'flagged'`);
    }

    if (params.q) {
      queryParams.push(`%${params.q}%`);
      queryParams.push(`%${params.q}%`);
      queryParams.push(`%${params.q}%`);
      conditions.push(`(m.concept ILIKE ? OR m.reference_number ILIKE ? OR c.title ILIKE ?)`);
    }

    if (params.dateFrom) {
      queryParams.push(params.dateFrom);
      conditions.push(`m.movement_date >= ?`);
    }

    if (params.dateTo) {
      queryParams.push(params.dateTo);
      conditions.push(`m.movement_date <= ?`);
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*) as total
      FROM campaign_financial_movements m
      JOIN campaigns c ON m.campaign_id = c.id
      WHERE ${whereClause}
    `;
    const countRes = await this.queryOne(countSql, queryParams);
    const total = parseInt(countRes?.total || '0', 10);

    const sortCol = ['amount', 'movement_date', 'created_at'].includes(params.sortBy || '') 
      ? `m.${params.sortBy}` 
      : 'm.created_at';
    const sortDir = (params.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const dataSql = `
      SELECT 
        m.id, m.campaign_id, m.created_by, m.type, m.concept, m.category,
        m.amount, m.currency, m.movement_date, m.reference_number, m.receipt_url,
        m.notes, m.status, m.reviewed_by, m.reviewed_at, m.review_notes,
        m.created_at, m.updated_at,
        c.title as campaign_title, c.status as campaign_status, c.currency as campaign_currency,
        c.goal_amount as campaign_goal, c.current_amount as campaign_current_amount,
        u.email as creator_email,
        COALESCE(CONCAT(ep.first_name, ' ', ep.last_name), u.email) as creator_name,
        rev.email as reviewer_email,
        COALESCE(CONCAT(ap.first_name, ' ', ap.last_name), rev.email) as reviewer_name
      FROM campaign_financial_movements m
      JOIN campaigns c ON m.campaign_id = c.id
      LEFT JOIN users u ON m.created_by = u.id OR c.creator_id = u.id
      LEFT JOIN entrepreneur_profiles ep ON u.id = ep.user_id
      LEFT JOIN users rev ON m.reviewed_by = rev.id
      LEFT JOIN admin_profiles ap ON rev.id = ap.user_id
      WHERE ${whereClause}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT ? OFFSET ?
    `;

    const rows = await this.queryMany(dataSql, [...queryParams, limit, offset]);

    return {
      data: rows.map(mapRowToAuditItem),
      total,
      page,
      perPage: limit,
    };
  }

  async getFinancialMovementById(id: string) {
    await this.ensureTables();

    const sql = `
      SELECT 
        m.id, m.campaign_id, m.created_by, m.type, m.concept, m.category,
        m.amount, m.currency, m.movement_date, m.reference_number, m.receipt_url,
        m.notes, m.status, m.reviewed_by, m.reviewed_at, m.review_notes,
        m.created_at, m.updated_at,
        c.title as campaign_title, c.status as campaign_status, c.currency as campaign_currency,
        c.goal_amount as campaign_goal, c.current_amount as campaign_current_amount,
        u.email as creator_email,
        COALESCE(CONCAT(ep.first_name, ' ', ep.last_name), u.email) as creator_name,
        rev.email as reviewer_email,
        COALESCE(CONCAT(ap.first_name, ' ', ap.last_name), rev.email) as reviewer_name
      FROM campaign_financial_movements m
      JOIN campaigns c ON m.campaign_id = c.id
      LEFT JOIN users u ON m.created_by = u.id OR c.creator_id = u.id
      LEFT JOIN entrepreneur_profiles ep ON u.id = ep.user_id
      LEFT JOIN users rev ON m.reviewed_by = rev.id
      LEFT JOIN admin_profiles ap ON rev.id = ap.user_id
      WHERE m.id = ?
    `;

    const row = await this.queryOne(sql, [id]);
    return row ? mapRowToAuditItem(row) : null;
  }

  async reviewFinancialMovement(
    id: string,
    action: 'approve' | 'flag' | 'reject' | 'reset',
    reviewerId: string,
    notes?: string,
  ) {
    await this.ensureTables();

    let targetStatus = 'verified';
    if (action === 'flag') targetStatus = 'flagged';
    else if (action === 'reject') targetStatus = 'rejected';
    else if (action === 'reset') targetStatus = 'pending';

    const isReset = action === 'reset';

    await this.query(`
      UPDATE campaign_financial_movements
      SET status = ?,
          reviewed_by = ?,
          reviewed_at = CASE WHEN ? = true THEN NULL ELSE NOW() END,
          review_notes = ?,
          updated_at = NOW()
      WHERE id = ?
    `, [
      targetStatus,
      isReset ? null : reviewerId,
      isReset,
      isReset ? null : (notes || null),
      id,
    ]);

    return this.getFinancialMovementById(id);
  }

  async getFinancialAuditSummary() {
    await this.ensureTables();

    const stats = await this.queryOne(`
      SELECT 
        COUNT(*)::int as total_movements,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::float as total_expenses,
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::float as total_incomes,
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending_count,
        COUNT(*) FILTER (WHERE status = 'flagged')::int as flagged_count,
        COUNT(*) FILTER (WHERE status = 'verified')::int as verified_count,
        COUNT(*) FILTER (WHERE status = 'rejected')::int as rejected_count,
        COUNT(*) FILTER (WHERE type = 'expense' AND (receipt_url IS NULL OR receipt_url = ''))::int as no_receipt_count,
        COUNT(DISTINCT campaign_id) FILTER (WHERE status = 'flagged' OR (type = 'expense' AND (receipt_url IS NULL OR receipt_url = '')))::int as irregular_campaigns_count
      FROM campaign_financial_movements
    `);

    const topCategoriesRows = await this.queryMany(`
      SELECT category, COUNT(*)::int as count, SUM(amount)::float as total_amount
      FROM campaign_financial_movements
      WHERE status = 'flagged' OR (type = 'expense' AND (receipt_url IS NULL OR receipt_url = ''))
      GROUP BY category
      ORDER BY total_amount DESC
      LIMIT 5
    `);

    const recentPendingRes = await this.getFinancialMovements({
      limit: 5,
      status: 'pending',
      sortBy: 'created_at',
      sortOrder: 'DESC',
    });

    const recentFlaggedRes = await this.getFinancialMovements({
      limit: 5,
      status: 'flagged',
      sortBy: 'created_at',
      sortOrder: 'DESC',
    });

    return {
      totalMovements: stats?.total_movements || 0,
      totalExpenses: stats?.total_expenses || 0,
      totalIncomes: stats?.total_incomes || 0,
      pendingCount: stats?.pending_count || 0,
      flaggedCount: stats?.flagged_count || 0,
      verifiedCount: stats?.verified_count || 0,
      rejectedCount: stats?.rejected_count || 0,
      expensesWithoutReceiptCount: stats?.no_receipt_count || 0,
      campaignsWithIrregularitiesCount: stats?.irregular_campaigns_count || 0,
      topFlaggedCategories: topCategoriesRows || [],
      recentPending: recentPendingRes.data,
      recentFlagged: recentFlaggedRes.data,
    };
  }

  async getCampaignFinancialAudit(campaignId: string) {
    await this.ensureTables();

    const campaign = await this.queryOne(`
      SELECT id, title, goal_amount, current_amount, currency, status
      FROM campaigns
      WHERE id = ?
    `, [campaignId]);

    if (!campaign) return null;

    let fundingPlans: any[] = [];
    try {
      fundingPlans = await this.queryMany(`
        SELECT id, category, amount, description
        FROM campaign_funding_plans
        WHERE campaign_id = ?
        ORDER BY sort_order ASC, amount DESC
      `, [campaignId]);
    } catch {
      fundingPlans = [];
    }

    const movements = await this.queryMany(`
      SELECT id, type, concept, category, amount, receipt_url, status
      FROM campaign_financial_movements
      WHERE campaign_id = ?
    `, [campaignId]);

    const expenseMovements = movements.filter((m: any) => m.type === 'expense');

    const categoriesMap: Record<string, { budgeted: number; spent: number; missingReceiptCount: number; id: string }> = {};

    fundingPlans.forEach((fp: any) => {
      categoriesMap[fp.category] = {
        budgeted: parseFloat(fp.amount || 0),
        spent: 0,
        missingReceiptCount: 0,
        id: fp.id,
      };
    });

    const unbudgetedExpenses: any[] = [];

    expenseMovements.forEach((exp: any) => {
      const cat = exp.category || 'Otros';
      const amt = parseFloat(exp.amount || 0);
      const hasNoReceipt = !exp.receipt_url || String(exp.receipt_url).trim().length === 0;

      if (categoriesMap[cat]) {
        categoriesMap[cat].spent += amt;
        if (hasNoReceipt) categoriesMap[cat].missingReceiptCount++;
      } else {
        unbudgetedExpenses.push({
          id: exp.id,
          concept: exp.concept,
          category: cat,
          amount: amt,
        });
      }
    });

    if (Object.keys(categoriesMap).length === 0) {
      expenseMovements.forEach((exp: any) => {
        const cat = exp.category || 'Operaciones';
        const amt = parseFloat(exp.amount || 0);
        const hasNoReceipt = !exp.receipt_url || String(exp.receipt_url).trim().length === 0;
        if (!categoriesMap[cat]) {
          categoriesMap[cat] = {
            budgeted: Math.round(amt * 1.2),
            spent: 0,
            missingReceiptCount: 0,
            id: randomUUID(),
          };
        }
        categoriesMap[cat].spent += amt;
        if (hasNoReceipt) categoriesMap[cat].missingReceiptCount++;
      });
    }

    const fundingPlanComparison = Object.entries(categoriesMap).map(([category, data]) => {
      const variance = data.budgeted - data.spent;
      return {
        id: data.id,
        category,
        budgetedAmount: data.budgeted,
        spentAmount: data.spent,
        variance,
        missingReceiptCount: data.missingReceiptCount,
        isOverbudget: data.spent > data.budgeted,
      };
    });

    return {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        goal_amount: parseFloat(campaign.goal_amount || 0),
        current_amount: parseFloat(campaign.current_amount || 0),
        currency: campaign.currency || 'BOB',
        status: campaign.status,
      },
      fundingPlanComparison,
      unbudgetedExpenses,
    };
  }
}
