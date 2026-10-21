import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { CampaignService } from '../services';

@ApiTags('Campaign Analytics')
@Controller(['campaigns', 'campanas'])
export class CampaignAnalyticsController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get([':id/analytics', ':id/analiticas'])
  @ApiOperation({ summary: 'Get advanced analytics and platform commission breakdown' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  async getAdvancedAnalytics(@Param('id') id: string) {
    const data = await this.campaignService.getAdvancedAnalytics(id);
    return {
      statusCode: 200,
      message: 'Advanced analytics retrieved successfully',
      data,
      timestamp: new Date().toISOString(),
    };
  }

  @Get([':id/report', ':id/reporte'])
  @ApiOperation({ summary: 'Export campaign contributions as CSV or PDF' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  @ApiQuery({ name: 'format', enum: ['csv', 'pdf'], required: true })
  async exportReport(
    @Param('id') id: string,
    @Query('format') format: 'csv' | 'pdf',
    @Res() res: Response,
  ) {
    if (format !== 'csv' && format !== 'pdf') {
      res.status(400).json({
        statusCode: 400,
        message: "El formato debe ser 'csv' o 'pdf'",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const { stream, filename } = await this.campaignService.generateCampaignReport(id, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    stream.pipe(res);
  }
}
