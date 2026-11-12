import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { EntrepreneurCampaign, CreateCampaignDto, CampaignFinancialProgress } from '../models';
import { CreateCampaignUpdateDto } from '../dto';

export interface PaginatedCampaigns {
  data: EntrepreneurCampaign[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}

@Injectable()
export class CampaignRepository {
  constructor(@Inject('DATABASE_POOL') private readonly pool: Pool) {}

  private mapRowToCampaign(row: any): EntrepreneurCampaign {
    return {
      id: row.id,
      creatorId: row.creator_id,
      categoryId: row.category_id,
      title: row.title,
      slug: row.slug,
      subtitle: row.subtitle,
      description: row.description,
      shortDescription: row.short_description,
      campaignType: row.campaign_type,
      status: row.status,
      goalAmount: parseFloat(row.goal_amount),
      currentAmount: parseFloat(row.current_amount),
      minInvestment: parseFloat(row.min_investment || '0'),
      maxInvestment: row.max_investment ? parseFloat(row.max_investment) : null,
      equityPercentage: row.equity_percentage ? parseFloat(row.equity_percentage) : null,
      startDate: row.start_date,
      endDate: row.end_date,
      fundsRaised: parseFloat(row.funds_raised || '0'),
      investorsCount: parseInt(row.investors_count || '0', 10),
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      videoUrl: row.video_url,
    };
  }

  async create(userId: string, dto: CreateCampaignDto): Promise<EntrepreneurCampaign> {
    const slug = dto.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    let categoryId = (dto as any).categoryId || (dto.categoryIds && dto.categoryIds.length > 0 ? dto.categoryIds[0] : null);
    if (!categoryId) {
      const cat = await this.pool.query(`SELECT id FROM categories LIMIT 1`);
      if (!cat.rows[0]) {
        throw new BadRequestException(
          'No hay categorías en la base de datos. Ejecuta el seed de categorías.',
        );
      }
      categoryId = cat.rows[0].id;
    }

    const query = `
      INSERT INTO campaigns (
        creator_id, category_id, title, slug, description, short_description, 
        campaign_type, status, goal_amount, end_date, video_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_review', $8, $9, $10)
      RETURNING *;
    `;

    const endDateStr = dto.endDate ? new Date(dto.endDate).toISOString() : null;

    const values = [
      userId,
      categoryId,
      dto.title,
      slug,
      dto.description,
      dto.shortDescription || null,
      (dto as any).campaignType || 'donation',
      dto.goalAmount,
      endDateStr,
      dto.videoUrl || null,
    ];

    const { rows } = await this.pool.query(query, values);
    const campaign = rows[0];

    // If rewards were provided, save them
    if (dto.rewards && Array.isArray(dto.rewards) && dto.rewards.length > 0) {
      for (const reward of dto.rewards) {
        await this.pool.query(
          `INSERT INTO reward_tiers (
            campaign_id, title, description, min_percentage, max_percentage, is_active
          ) VALUES ($1, $2, $3, $4, $5, true)`,
          [
            campaign.id,
            reward.title,
            reward.description,
            reward.minPercentage || 0,
            reward.maxPercentage || 100
          ]
        );
      }
    }

    return this.mapRowToCampaign(campaign);
  }

  async findByCreatorId(userId: string, page: number = 1, limit: number = 10, sortBy: string = 'created_at', sortOrder: string = 'DESC'): Promise<PaginatedCampaigns> {
    const offset = (page - 1) * limit;

    const queryData = `
      SELECT * FROM campaigns
      WHERE creator_id = $1
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $2 OFFSET $3;
    `;
    const dataValues = [userId, limit, offset];
    
    const queryCount = `SELECT COUNT(*) FROM campaigns WHERE creator_id = $1;`;
    const countValues = [userId];

    const [dataResult, countResult] = await Promise.all([
      this.pool.query(queryData, dataValues),
      this.pool.query(queryCount, countValues),
    ]);

    const totalItems = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: dataResult.rows.map(row => this.mapRowToCampaign(row)),
      meta: {
        totalItems,
        itemCount: dataResult.rows.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  async findByIdAndCreator(id: string, creatorId: string): Promise<EntrepreneurCampaign | null> {
    const query = `SELECT * FROM campaigns WHERE id = $1 AND creator_id = $2;`;
    const { rows } = await this.pool.query(query, [id, creatorId]);
    return rows.length > 0 ? this.mapRowToCampaign(rows[0]) : null;
  }

  // =========================================================================
  // CAMPAÑAS PÚBLICAS — Queries optimizadas
  // =========================================================================

  private readonly PUBLIC_STATUSES = ['published', 'funded', 'partially_funded'];

  private readonly PUBLIC_SELECT = `
    SELECT
      c.id, c.title, c.slug, c.short_description,
      c.campaign_type, c.status,
      c.goal_amount, c.current_amount, c.investor_count,
      c.cover_image_url, c.end_date, c.created_at,
      c.creator_id AS entrepreneur_user_id,
      ep.first_name || ' ' || ep.last_name AS entrepreneur_name,
      ep.display_name AS entrepreneur_display_name,
      ep.avatar_url AS entrepreneur_avatar,
      cat.display_name AS category_name,
      cat.slug AS category_slug,
      c.video_url
    FROM campaigns c
    JOIN entrepreneur_profiles ep ON c.creator_id = ep.user_id
    LEFT JOIN categories cat ON c.category_id = cat.id
  `;

  private mapRowToPublicCampaign(row: any): any {
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      shortDescription: row.short_description,
      campaignType: row.campaign_type,
      status: row.status,
      goalAmount: parseFloat(row.goal_amount),
      currentAmount: parseFloat(row.current_amount),
      investorCount: parseInt(row.investor_count || '0', 10),
      coverImageUrl: row.cover_image_url,
      endDate: row.end_date,
      createdAt: row.created_at,
      entrepreneurUserId: row.entrepreneur_user_id,
      entrepreneurName: row.entrepreneur_name,
      entrepreneurDisplayName: row.entrepreneur_display_name,
      entrepreneurAvatar: row.entrepreneur_avatar,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      videoUrl: row.video_url,
    };
  }

  async findPublicCampaigns(
    page: number = 1,
    limit: number = 12,
    sortBy: string = 'created_at',
    sortOrder: string = 'DESC',
    categoryId?: string,
    campaignType?: string,
    search?: string,
  ): Promise<PaginatedCampaigns> {
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: string[] = [`c.status IN ('published', 'funded', 'partially_funded')`];
    const params: any[] = [];
    let paramIndex = 1;

    if (categoryId) {
      conditions.push(`c.category_id = $${paramIndex}`);
      params.push(categoryId);
      paramIndex++;
    }

    if (campaignType) {
      conditions.push(`c.campaign_type = $${paramIndex}`);
      params.push(campaignType);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(c.title ILIKE $${paramIndex} OR c.short_description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Whitelist sortBy to prevent SQL injection
    const allowedSorts = ['created_at', 'current_amount', 'goal_amount', 'end_date'];
    const safeSortBy = allowedSorts.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Count
    const countQuery = `SELECT COUNT(*) FROM campaigns c WHERE ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].count, 10);

    // Data
    const dataQuery = `
      ${this.PUBLIC_SELECT}
      WHERE ${whereClause}
      ORDER BY c.${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;
    const dataResult = await this.pool.query(dataQuery, [...params, limit, offset]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      data: dataResult.rows.map(row => this.mapRowToPublicCampaign(row)),
      meta: {
        totalItems,
        itemCount: dataResult.rows.length,
        itemsPerPage: limit,
        totalPages,
        currentPage: page,
      },
    };
  }

  async findPublicById(id: string): Promise<any | null> {
    const query = `
      SELECT
        c.id,
        c.category_id,
        c.title, c.slug, c.subtitle, c.short_description,
        c.description, c.campaign_type, c.status,
        c.goal_amount, c.current_amount, c.investor_count,
        c.cover_image_url, c.currency,
        c.min_investment, c.max_investment,
        c.start_date, c.end_date, c.created_at,
        c.creator_id AS entrepreneur_user_id,
        ep.first_name || ' ' || ep.last_name AS entrepreneur_name,
        ep.display_name AS entrepreneur_display_name,
        ep.avatar_url AS entrepreneur_avatar,
        ep.bio AS entrepreneur_bio,
        cat.display_name AS category_name,
        cat.slug AS category_slug,
        c.video_url
      FROM campaigns c
      JOIN entrepreneur_profiles ep ON c.creator_id = ep.user_id
      LEFT JOIN categories cat ON c.category_id = cat.id
      WHERE c.id = $1 AND c.status IN ('published', 'funded', 'partially_funded');
    `;
    const { rows } = await this.pool.query(query, [id]);
    if (rows.length === 0) return null;

    // Fetch reward tiers for this campaign
    let rewardTiers: any[] = [];
    try {
      const tiersResult = await this.pool.query(
        `SELECT id, title, description, amount, currency, max_claims,
                current_claims, estimated_delivery, image_url, sort_order,
                min_percentage, max_percentage
         FROM reward_tiers
         WHERE campaign_id = $1 AND is_active = true
         ORDER BY amount ASC`,
        [id],
      );
      rewardTiers = tiersResult.rows.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        amount: parseFloat(t.amount),
        currency: t.currency,
        maxClaims: t.max_claims,
        currentClaims: parseInt(t.current_claims || '0', 10),
        estimatedDelivery: t.estimated_delivery,
        imageUrl: t.image_url,
        minPercentage: t.min_percentage ? parseFloat(t.min_percentage) : 0,
        maxPercentage: t.max_percentage ? parseFloat(t.max_percentage) : 100,
      }));
    } catch (e) {
      console.warn('Could not fetch reward tiers:', e);
    }

    const row = rows[0];
    return {
      ...this.mapRowToPublicCampaign(row),
      categoryId: row.category_id,
      description: row.description,
      subtitle: row.subtitle,
      currency: row.currency,
      startDate: row.start_date,
      minInvestment: parseFloat(row.min_investment || '0'),
      maxInvestment: row.max_investment ? parseFloat(row.max_investment) : null,
      entrepreneurBio: row.entrepreneur_bio,
      rewardTiers,
    };
  }

  async incrementViewCount(campaignId: string): Promise<void> {
    await this.pool.query(
      `UPDATE campaigns SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
      [campaignId],
    );
  }

  async createCampaignUpdate(campaignId: string, authorId: string, dto: CreateCampaignUpdateDto): Promise<any> {
    const isPublic = dto.isPublic !== false;
    const attachments = dto.attachments ? JSON.stringify(dto.attachments) : '[]';
    
    const query = `
      INSERT INTO campaign_updates (campaign_id, author_id, title, content, is_public, attachments)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [campaignId, authorId, dto.title, dto.content, isPublic, attachments];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getRecentPublicUpdatesGroupedByCampaign(): Promise<any[]> {
    const query = `
      SELECT
        cu.id,
        cu.campaign_id AS "campaignId",
        cu.title,
        cu.content,
        cu.attachments,
        cu.created_at AS "createdAt",
        c.title AS "campaignTitle",
        c.cover_image_url AS "campaignCoverImageUrl",
        ep.first_name || ' ' || ep.last_name AS "entrepreneurName",
        ep.avatar_url AS "entrepreneurAvatar"
      FROM campaign_updates cu
      JOIN campaigns c ON cu.campaign_id = c.id
      JOIN entrepreneur_profiles ep ON c.creator_id = ep.user_id
      WHERE cu.is_public = true
        AND cu.created_at >= NOW() - INTERVAL '24 hours'
        AND c.status = 'published'
      ORDER BY cu.created_at ASC;
    `;
    const result = await this.pool.query(query);
    
    const groups: Record<string, any> = {};
    for (const row of result.rows) {
      const cid = row.campaignId;
      if (!groups[cid]) {
        groups[cid] = {
          campaignId: cid,
          campaignTitle: row.campaignTitle,
          campaignCoverImageUrl: row.campaignCoverImageUrl,
          entrepreneurName: row.entrepreneurName,
          entrepreneurAvatar: row.entrepreneurAvatar,
          stories: [],
        };
      }
      groups[cid].stories.push({
        id: row.id,
        title: row.title,
        content: row.content,
        attachments: row.attachments || [],
        createdAt: row.createdAt,
      });
    }
    
    return Object.values(groups).sort((a: any, b: any) => {
      const latestA = new Date(a.stories[a.stories.length - 1].createdAt).getTime();
      const latestB = new Date(b.stories[b.stories.length - 1].createdAt).getTime();
      return latestB - latestA;
    });
  }

  async getFinancialProgress(campaignId: string): Promise<CampaignFinancialProgress | null> {
    const campaignResult = await this.pool.query(
      `SELECT
        c.id, c.title, c.slug, c.status,
        c.goal_amount, c.current_amount, c.investor_count,
        c.currency, c.start_date, c.end_date, c.funded_at, c.created_at
       FROM campaigns c
       WHERE c.id = $1`,
      [campaignId],
    );
    if (campaignResult.rows.length === 0) return null;
    const campaign = campaignResult.rows[0];

    const investmentStatsResult = await this.pool.query(
      `SELECT
        COUNT(*)::int                                                         AS total_investments,
        COUNT(*) FILTER (WHERE status = 'completed')::int                     AS completed_investments,
        COUNT(*) FILTER (WHERE status = 'pending')::int                       AS pending_investments,
        COUNT(*) FILTER (WHERE status = 'failed')::int                        AS failed_investments,
        COUNT(*) FILTER (WHERE status IN ('refunded','partially_refunded'))::int AS refunded_investments,
        COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)          AS confirmed_amount,
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)            AS pending_amount,
        COALESCE(SUM(refunded_amount) FILTER (WHERE status IN ('refunded','partially_refunded')), 0) AS refunded_amount,
        COALESCE(AVG(amount) FILTER (WHERE status = 'completed'), 0)          AS avg_investment,
        COALESCE(MAX(amount) FILTER (WHERE status = 'completed'), 0)          AS max_investment,
        COALESCE(MIN(amount) FILTER (WHERE status = 'completed'), 0)          AS min_investment
       FROM investments
       WHERE campaign_id = $1`,
      [campaignId],
    );
    const investmentStats = investmentStatsResult.rows[0];

    const recentResult = await this.pool.query(
      `SELECT
        i.id, i.amount, i.currency, i.status,
        i.is_anonymous, i.created_at,
        rt.title as reward_title,
        CASE
          WHEN i.is_anonymous THEN NULL
          ELSE COALESCE(ip.display_name, ip.first_name || ' ' || ip.last_name)
        END AS investor_display_name
       FROM investments i
       LEFT JOIN investor_profiles ip ON i.investor_id = ip.user_id
       LEFT JOIN reward_tiers rt ON i.reward_tier_id = rt.id
       WHERE i.campaign_id = $1
       ORDER BY i.created_at DESC
       LIMIT 10`,
      [campaignId],
    );
    const recentRows = recentResult.rows;

    const dailyProgressResult = await this.pool.query(
      `WITH daily_investments AS (
        SELECT 
          created_at::date AS date,
          SUM(amount) AS daily_amount
        FROM investments
        WHERE campaign_id = $1 AND status = 'completed'
        GROUP BY created_at::date
      )
      SELECT 
        date::text,
        SUM(daily_amount) OVER (ORDER BY date)::numeric AS accumulated_amount
      FROM daily_investments
      ORDER BY date ASC`,
      [campaignId],
    );
    const dailyProgress = dailyProgressResult.rows.map(r => ({
      date: r.date,
      accumulatedAmount: Number(r.accumulated_amount)
    }));

    const breakdownResult = await this.pool.query(
      `SELECT 
        rt.id AS reward_tier_id,
        COALESCE(rt.title, 'Aportes Directos') AS reward_title,
        COALESCE(SUM(i.amount), 0)::numeric AS total_amount
       FROM investments i
       LEFT JOIN reward_tiers rt ON i.reward_tier_id = rt.id
       WHERE i.campaign_id = $1 AND i.status = 'completed'
       GROUP BY rt.id, rt.title`,
      [campaignId],
    );
    const fundingBreakdown = breakdownResult.rows.map(r => ({
      rewardTierId: r.reward_tier_id,
      rewardTitle: r.reward_title,
      totalAmount: Number(r.total_amount)
    }));

    const goalAmount = Number(campaign.goal_amount);
    const currentAmount = Number(campaign.current_amount);

    let daysRemaining: number | null = null;
    if (campaign.end_date) {
      const msRemaining = new Date(campaign.end_date).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    }

    return {
      campaignId: campaign.id,
      title: campaign.title,
      slug: campaign.slug,
      status: campaign.status,
      goalAmount,
      currentAmount,
      remainingAmount: Math.max(0, goalAmount - currentAmount),
      fundingPercentage: goalAmount > 0
        ? Math.round((currentAmount / goalAmount) * 10000) / 100
        : 0,
      investorCount: Number(campaign.investor_count),
      currency: campaign.currency,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      daysRemaining,
      fundedAt: campaign.funded_at,
      createdAt: campaign.created_at,
      investments: {
        total: investmentStats?.total_investments ?? 0,
        completed: investmentStats?.completed_investments ?? 0,
        pending: investmentStats?.pending_investments ?? 0,
        failed: investmentStats?.failed_investments ?? 0,
        refunded: investmentStats?.refunded_investments ?? 0,
      },
      amounts: {
        confirmed: Number(investmentStats?.confirmed_amount ?? 0),
        pending: Number(investmentStats?.pending_amount ?? 0),
        refunded: Number(investmentStats?.refunded_amount ?? 0),
      },
      averageInvestment: Number(investmentStats?.avg_investment ?? 0),
      largestInvestment: Number(investmentStats?.max_investment ?? 0),
      smallestInvestment: Number(investmentStats?.min_investment ?? 0),
      recentInvestments: recentRows.map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        currency: row.currency,
        status: row.status,
        isAnonymous: row.is_anonymous,
        investorDisplayName: row.investor_display_name,
        rewardTitle: row.reward_title,
        createdAt: row.created_at,
      })),
      dailyProgress,
      fundingBreakdown,
    };
  }

  async getDetailedInvestmentsForReport(campaignId: string): Promise<any[]> {
    const query = `
      SELECT
        i.id,
        i.amount,
        i.currency,
        i.status,
        i.created_at,
        rt.title as reward_title,
        u.email,
        COALESCE(ip.display_name, ip.first_name || ' ' || ip.last_name) AS investor_name
      FROM investments i
      JOIN users u ON i.investor_id = u.id
      LEFT JOIN investor_profiles ip ON i.investor_id = ip.user_id
      LEFT JOIN reward_tiers rt ON i.reward_tier_id = rt.id
      WHERE i.campaign_id = $1
      ORDER BY i.created_at DESC
    `;
    const { rows } = await this.pool.query(query, [campaignId]);
    return rows.map(row => ({
      id: row.id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      rewardTitle: row.reward_title || 'Aporte Directo',
      email: row.email,
      investorName: row.investor_name || 'Inversor Anónimo',
    }));
  }

  async getPublicCampaignDocuments(campaignId: string): Promise<any[]> {
    const query = `
      SELECT
        id,
        campaign_id AS "campaignId",
        file_url AS "fileUrl",
        original_name AS "originalName",
        mime_type AS "mimeType",
        file_size_bytes AS "fileSizeBytes",
        justification,
        status,
        reviewer_notes AS "reviewerNotes",
        created_at AS "createdAt"
      FROM campaign_documents
      WHERE campaign_id = $1
      ORDER BY created_at DESC;
    `;
    const { rows } = await this.pool.query(query, [campaignId]);
    return rows;
  }

  async getPublicCampaignUpdates(campaignId: string): Promise<any[]> {
    const query = `
      SELECT
        cu.id,
        cu.campaign_id AS "campaignId",
        cu.title,
        cu.content,
        cu.attachments,
        cu.created_at AS "createdAt",
        cu.updated_at AS "updatedAt",
        ep.first_name || ' ' || ep.last_name AS "authorName",
        ep.display_name AS "authorDisplayName",
        ep.avatar_url AS "authorAvatar"
      FROM campaign_updates cu
      LEFT JOIN entrepreneur_profiles ep ON cu.author_id = ep.user_id
      WHERE cu.campaign_id = $1 AND cu.is_public = true
      ORDER BY cu.created_at DESC;
    `;
    const { rows } = await this.pool.query(query, [campaignId]);
    return rows;
  }
}
