import { Controller, Get, Post, Query, Param, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CampaignService } from '../services';

@ApiTags('Public Campaigns')
@Controller('campaigns/public')
export class PublicCampaignController {
  constructor(private readonly campaignService: CampaignService) { }

  @Get()
  @ApiOperation({ summary: 'List public campaigns (approved/published). No auth required.' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 12, max: 50)' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['created_at', 'current_amount', 'goal_amount', 'end_date'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiQuery({ name: 'categoryId', required: false, description: 'Filter by category UUID' })
  @ApiQuery({ name: 'campaignType', required: false, enum: ['donation', 'reward', 'equity'] })
  @ApiQuery({ name: 'q', required: false, description: 'Search by title or description' })
  async getPublicCampaigns(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('categoryId') categoryId?: string,
    @Query('campaignType') campaignType?: string,
    @Query('q') q?: string,
  ) {
    const result = await this.campaignService.getPublicCampaigns({
      page,
      limit,
      sortBy,
      sortOrder,
      categoryId,
      campaignType,
      q,
    });

    return {
      statusCode: 200,
      message: 'Public campaigns retrieved successfully',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('updates/recent')
  @ApiOperation({ summary: 'Get recent public campaign updates (stories) from last 24h grouped by campaign' })
  async getRecentUpdates() {
    const data = await this.campaignService.getRecentPublicUpdatesGroupedByCampaign();
    return {
      statusCode: 200,
      message: 'Recent public updates retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('updates/seed-test')
  @HttpCode(200)
  @ApiOperation({ summary: 'Seed test updates/stories for public campaigns for verification purposes' })
  async seedTestUpdates() {
    const campaignsResult = await this.campaignService.getPublicCampaigns({ page: '1', limit: '10' });
    const campaigns = campaignsResult.data;
    if (campaigns.length === 0) {
      return {
        statusCode: 400,
        message: 'No active public campaigns found to seed stories for. Please publish a campaign first.',
      };
    }

    const seeded = [];
    const sampleStories = [
      {
        title: 'Lanzamiento Oficial',
        content: '¡Acabamos de lanzar nuestra campaña de fondeo! Únete hoy y sé parte de este cambio.',
        attachments: [{ type: 'text', text: 'Bienvenidos a nuestra campaña.' }]
      },
      {
        title: 'Prototipo Finalizado',
        content: 'Les mostramos el primer lote impreso en 3D de nuestro envase 100% biodegradable.',
        attachments: [{ type: 'image', url: 'https://images.unsplash.com/photo-1536939459926-301728717817?q=80&w=2570&auto=format&fit=crop' }]
      },
      {
        title: 'Video de Pitch en Camino',
        content: 'Estamos editando el video pitch con nuestro equipo de desarrollo. Estará disponible muy pronto.',
        attachments: [{ type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4' }]
      }
    ];

    for (let i = 0; i < Math.min(campaigns.length, 3); i++) {
      const campaign = campaigns[i];
      const story = sampleStories[i % sampleStories.length];
      const authorId = (campaign as any).entrepreneurUserId || (campaign as any).creatorId;

      const created = await this.campaignService.createCampaignUpdate(campaign.id, authorId, {
        title: story.title,
        content: story.content,
        isPublic: true,
        attachments: story.attachments
      });
      seeded.push({ campaignId: campaign.id, updateId: created.id });
    }

    return {
      statusCode: 200,
      message: `Successfully seeded ${seeded.length} test stories!`,
      data: seeded,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public campaign details by ID. No auth required.' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  async getPublicCampaignById(@Param('id') id: string) {
    const campaign = await this.campaignService.getPublicCampaignById(id);
    return {
      statusCode: 200,
      message: 'Campaign details retrieved successfully',
      data: campaign,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/financial-progress')
  @ApiOperation({ summary: 'Get public campaign financial progress. No auth required.' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  async getPublicCampaignFinancialProgress(@Param('id') id: string) {
    const progress = await this.campaignService.getPublicCampaignFinancialProgress(id);
    return {
      statusCode: 200,
      message: 'Campaign financial progress retrieved successfully',
      data: progress,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/view')
  @HttpCode(200)
  @ApiOperation({ summary: 'Increment video view count for a campaign. No auth required.' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  async recordView(@Param('id') id: string) {
    await this.campaignService.incrementViewCount(id);
    return {
      statusCode: 200,
      message: 'View recorded',
      timestamp: new Date().toISOString(),
    };
  }
}
