import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/database';
import { QueryAdminCampaignsDto } from '../dto/admin-campaigns.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminRepository extends BaseRepository {
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
}
