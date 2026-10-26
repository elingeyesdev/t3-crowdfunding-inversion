import { Controller, Post, Get, Body, Query, UseGuards, Request, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CampaignService } from '../services';
import { CreateCampaignDto, QueryCampaignsDto, CreateCampaignUpdateDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Entrepreneur Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('entrepreneurs/me/campaigns')
export class EntrepreneurCampaignsController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new campaign as draft' })
  async createCampaign(@Request() req: any, @Body() dto: CreateCampaignDto) {
    const userId = req.user.sub || req.user.id;
    // The service takes the models dto which allows endDate as string or Date
    const campaign = await this.campaignService.createCampaign(userId, dto as any);
    return {
      statusCode: 201,
      message: 'Campaign created successfully',
      data: campaign,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get my campaigns with pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false })
  async getMyCampaigns(@Request() req: any, @Query() query: QueryCampaignsDto) {
    const userId = req.user.sub || req.user.id;
    const result = await this.campaignService.getMyCampaigns(userId, query as any);
    return {
      statusCode: 200,
      message: 'Campaigns retrieved successfully',
      data: result,
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign details by ID' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async getCampaignById(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.sub || req.user.id;
    const campaign = await this.campaignService.getCampaignById(id, userId);
    return {
      statusCode: 200,
      message: 'Campaign details retrieved successfully',
      data: campaign,
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/updates')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/campaigns',
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
  @ApiOperation({ summary: 'Create a new campaign update/story' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  async createUpdate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateCampaignUpdateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user.sub || req.user.id;
    
    // Si se subió un archivo, parsear el tipo e insertarlo en attachments
    if (file) {
      const mimeType = file.mimetype;
      let type: 'image' | 'video' = 'image';
      if (mimeType.startsWith('video/')) {
        type = 'video';
      }
      
      dto.attachments = [
        {
          type,
          url: `/uploads/campaigns/${file.filename}`,
        },
      ];
    } else if (typeof dto.attachments === 'string') {
      try {
        dto.attachments = JSON.parse(dto.attachments);
      } catch {
        dto.attachments = [];
      }
    }

    const update = await this.campaignService.createCampaignUpdate(id, userId, dto);
    return {
      statusCode: 201,
      message: 'Campaign update created successfully',
      data: update,
      timestamp: new Date().toISOString(),
    };
  }
}
