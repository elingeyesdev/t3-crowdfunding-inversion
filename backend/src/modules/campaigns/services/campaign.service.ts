import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CampaignRepository, PaginatedCampaigns } from '../repositories';
import { EntrepreneurCampaign, CreateCampaignDto, QueryCampaignsDto, CampaignFinancialProgress, AdvancedAnalyticsDto } from '../models';
import { CreateCampaignUpdateDto } from '../dto';
import * as PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

@Injectable()
export class CampaignService {
  constructor(private readonly campaignRepo: CampaignRepository) {}

  async createCampaign(creatorId: string, dto: CreateCampaignDto): Promise<EntrepreneurCampaign> {
    if (dto.goalAmount < 100) {
      throw new BadRequestException('Goal amount must be at least 100');
    }

    return await this.campaignRepo.create(creatorId, dto);
  }

  async getMyCampaigns(creatorId: string, query: QueryCampaignsDto): Promise<PaginatedCampaigns> {
    const page = parseInt(query.page as any) || 1;
    const limit = parseInt(query.limit as any) || 12;
    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder || 'DESC';

    return await this.campaignRepo.findByCreatorId(creatorId, page, limit, sortBy, sortOrder);
  }

  async getCampaignById(campaignId: string, creatorId: string): Promise<EntrepreneurCampaign> {
    const campaign = await this.campaignRepo.findByIdAndCreator(campaignId, creatorId);
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }
    return campaign;
  }

  // =========================================================================
  // CAMPAÑAS PÚBLICAS — Sin autenticación
  // =========================================================================

  async getPublicCampaigns(query: {
    page?: any;
    limit?: any;
    sortBy?: string;
    sortOrder?: string;
    categoryId?: string;
    campaignType?: string;
    q?: string;
  }): Promise<PaginatedCampaigns> {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 12, 50); // max 50 por página
    const sortBy = query.sortBy || 'created_at';
    const sortOrder = query.sortOrder || 'DESC';

    return await this.campaignRepo.findPublicCampaigns(
      page,
      limit,
      sortBy,
      sortOrder,
      query.categoryId,
      query.campaignType,
      query.q,
    );
  }

  async getPublicCampaignById(campaignId: string): Promise<any> {
    const campaign = await this.campaignRepo.findPublicById(campaignId);
    if (!campaign) {
      throw new NotFoundException(`Campaña con ID ${campaignId} no encontrada o no está publicada`);
    }
    return campaign;
  }

  async getPublicCampaignFinancialProgress(campaignId: string): Promise<CampaignFinancialProgress> {
    const progress = await this.campaignRepo.getFinancialProgress(campaignId);
    if (!progress) {
      throw new NotFoundException(`Campaña con ID ${campaignId} no encontrada`);
    }
    return progress;
  }

  async incrementViewCount(campaignId: string): Promise<void> {
    // Fire-and-forget: silently ignore if campaign not found
    try {
      await this.campaignRepo.incrementViewCount(campaignId);
    } catch (_) {}
  }

  async createCampaignUpdate(campaignId: string, authorId: string, dto: CreateCampaignUpdateDto): Promise<any> {
    return await this.campaignRepo.createCampaignUpdate(campaignId, authorId, dto);
  }

  async getRecentPublicUpdatesGroupedByCampaign(): Promise<any[]> {
    return await this.campaignRepo.getRecentPublicUpdatesGroupedByCampaign();
  }

  async getAdvancedAnalytics(campaignId: string): Promise<AdvancedAnalyticsDto> {
    const progress = await this.campaignRepo.getFinancialProgress(campaignId);
    if (!progress) {
      throw new NotFoundException(`Campaña con ID ${campaignId} no encontrada`);
    }

    const goalAmount = progress.goalAmount;
    const currentAmount = progress.currentAmount;

    // Calcular días transcurridos
    const start = progress.startDate ? new Date(progress.startDate) : (progress.createdAt ? new Date(progress.createdAt) : new Date());
    const msElapsed = Date.now() - start.getTime();
    const daysElapsed = Math.max(1, Math.ceil(msElapsed / (1000 * 60 * 60 * 24)));

    // Calcular velocidad promedio diaria
    const dailyRate = currentAmount / daysElapsed;

    // Calcular días restantes proyectados
    let projectedRemainingDays: number | null = null;
    if (currentAmount >= goalAmount) {
      projectedRemainingDays = 0;
    } else if (dailyRate > 0) {
      projectedRemainingDays = Math.ceil((goalAmount - currentAmount) / dailyRate);
    }

    // Deducción Financiera
    const platformFeePercentage = 5; // 5%
    const platformFee = Math.round(currentAmount * 0.05 * 100) / 100; // redondear a 2 decimales
    const netAmount = Math.round((currentAmount - platformFee) * 100) / 100;

    return {
      campaignId: progress.campaignId,
      title: progress.title,
      goalAmount,
      currentAmount,
      grossAmount: currentAmount,
      platformFeePercentage,
      platformFee,
      netAmount,
      daysElapsed,
      dailyRate: Math.round(dailyRate * 100) / 100,
      projectedRemainingDays,
      dailyProgress: progress.dailyProgress || [],
      fundingBreakdown: progress.fundingBreakdown || [],
    };
  }

  async generateCampaignReport(campaignId: string, format: 'csv' | 'pdf'): Promise<{ stream: PassThrough; filename: string }> {
    const progress = await this.campaignRepo.getFinancialProgress(campaignId);
    if (!progress) {
      throw new NotFoundException(`Campaña con ID ${campaignId} no encontrada`);
    }

    const investments = await this.campaignRepo.getDetailedInvestmentsForReport(campaignId);

    const stream = new PassThrough();
    let filename = '';

    if (format === 'csv') {
      filename = `reporte_campana_${progress.slug}_${Date.now()}.csv`;
      
      const headers = ['ID Transaccion', 'Inversor', 'Email', 'Monto', 'Divisa', 'Recompensa', 'Fecha', 'Estado'];
      const rows = investments.map(inv => [
        inv.id,
        inv.investorName.replace(/"/g, '""'),
        inv.email,
        inv.amount.toString(),
        inv.currency,
        inv.rewardTitle.replace(/"/g, '""'),
        new Date(inv.createdAt).toISOString(),
        inv.status
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(val => `"${val}"`).join(','))].join('\n');
      stream.write(csvContent);
      stream.end();
    } else {
      filename = `reporte_campana_${progress.slug}_${Date.now()}.pdf`;
      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      doc.pipe(stream);

      const primaryGreen = '#064e3b';
      const lightGreen = '#ecfdf5';
      const accentEmerald = '#10b981';
      const textDark = '#1f2937';
      const textMuted = '#6b7280';

      // 1. Cabecera Premium
      doc.rect(0, 0, doc.page.width, 120).fill(primaryGreen);
      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('REPORTE OFICIAL DE AUDITORÍA', 40, 40);
      doc.fontSize(11).font('Helvetica').fillColor('#a7f3d0').text(`Campaña: ${progress.title}`, 40, 70);
      doc.text(`Generado el: ${new Date().toLocaleString()}`, 40, 85);

      doc.rect(0, 115, doc.page.width, 5).fill(accentEmerald);

      let currentY = 150;
      const marginX = 40;
      const contentWidth = doc.page.width - marginX * 2;

      // 2. Sección de Totales
      doc.fillColor(primaryGreen).fontSize(14).font('Helvetica-Bold').text('Balance Financiero General', marginX, currentY);
      currentY += 20;

      const grossAmount = progress.currentAmount;
      const platformFee = Math.round(grossAmount * 0.05 * 100) / 100;
      const netAmount = Math.round((grossAmount - platformFee) * 100) / 100;
      const currency = progress.currency || 'BOB';

      const cardWidth = (contentWidth - 20) / 3;
      const cardHeight = 65;

      const drawCard = (x: number, y: number, title: string, value: string, isNet: boolean = false) => {
        doc.rect(x, y, cardWidth, cardHeight).fill(isNet ? lightGreen : '#f3f4f6');
        if (isNet) {
          doc.rect(x, y, cardWidth, cardHeight).lineWidth(1).stroke(accentEmerald);
        }
        doc.fillColor(textDark).fontSize(9).font('Helvetica-Bold').text(title.toUpperCase(), x + 10, y + 15);
        doc.fillColor(isNet ? primaryGreen : textDark).fontSize(14).font('Helvetica-Bold').text(value, x + 10, y + 35);
      };

      drawCard(marginX, currentY, 'Monto Bruto Recaudado', `Bs. ${grossAmount.toLocaleString('es-BO')}`);
      drawCard(marginX + cardWidth + 10, currentY, 'Comisión Plataforma (5%)', `Bs. ${platformFee.toLocaleString('es-BO')}`);
      drawCard(marginX + (cardWidth + 10) * 2, currentY, 'Monto Neto Estimado', `Bs. ${netAmount.toLocaleString('es-BO')}`, true);

      currentY += cardHeight + 35;

      // 3. Tabla de Aportes
      doc.fillColor(primaryGreen).fontSize(14).font('Helvetica-Bold').text('Detalle de Aportes y Transacciones', marginX, currentY);
      currentY += 20;

      const cols = {
        fecha: { x: marginX, w: 90 },
        inversor: { x: marginX + 90, w: 120 },
        email: { x: marginX + 210, w: 130 },
        recompensa: { x: marginX + 340, w: 90 },
        monto: { x: marginX + 430, w: 60 },
        estado: { x: marginX + 490, w: doc.page.width - marginX - (marginX + 490) }
      };

      doc.rect(marginX, currentY, contentWidth, 20).fill(primaryGreen);
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('FECHA', cols.fecha.x + 5, currentY + 6);
      doc.text('INVERSOR', cols.inversor.x + 5, currentY + 6);
      doc.text('EMAIL', cols.email.x + 5, currentY + 6);
      doc.text('RECOMPENSA', cols.recompensa.x + 5, currentY + 6);
      doc.text('MONTO', cols.monto.x + 5, currentY + 6, { align: 'right', width: cols.monto.w - 10 });
      doc.text('ESTADO', cols.estado.x + 5, currentY + 6, { align: 'center', width: cols.estado.w - 10 });

      currentY += 20;

      doc.fontSize(8).font('Helvetica').fillColor(textDark);

      if (investments.length === 0) {
        doc.rect(marginX, currentY, contentWidth, 30).fill('#f9fafb');
        doc.fillColor(textMuted).text('No se registran transacciones para esta campaña.', marginX + 15, currentY + 10, { align: 'center', width: contentWidth - 30 });
        currentY += 30;
      } else {
        let alt = false;
        for (const inv of investments) {
          if (currentY > doc.page.height - 60) {
            doc.addPage();
            currentY = 40;
            
            doc.rect(marginX, currentY, contentWidth, 20).fill(primaryGreen);
            doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
            doc.text('FECHA', cols.fecha.x + 5, currentY + 6);
            doc.text('INVERSOR', cols.inversor.x + 5, currentY + 6);
            doc.text('EMAIL', cols.email.x + 5, currentY + 6);
            doc.text('RECOMPENSA', cols.recompensa.x + 5, currentY + 6);
            doc.text('MONTO', cols.monto.x + 5, currentY + 6, { align: 'right', width: cols.monto.w - 10 });
            doc.text('ESTADO', cols.estado.x + 5, currentY + 6, { align: 'center', width: cols.estado.w - 10 });
            currentY += 20;
            doc.fontSize(8).font('Helvetica').fillColor(textDark);
          }

          doc.rect(marginX, currentY, contentWidth, 20).fill(alt ? lightGreen : '#ffffff');
          alt = !alt;

          doc.moveTo(marginX, currentY + 20).lineTo(doc.page.width - marginX, currentY + 20).lineWidth(0.5).stroke('#e5e7eb');

          const dateStr = new Date(inv.createdAt).toLocaleDateString();
          doc.fillColor(textDark);
          doc.text(dateStr, cols.fecha.x + 5, currentY + 6, { lineBreak: false });
          
          const truncatedName = inv.investorName.length > 20 ? inv.investorName.substring(0, 18) + '..' : inv.investorName;
          doc.text(truncatedName, cols.inversor.x + 5, currentY + 6, { lineBreak: false });
          
          const truncatedEmail = inv.email.length > 25 ? inv.email.substring(0, 23) + '..' : inv.email;
          doc.text(truncatedEmail, cols.email.x + 5, currentY + 6, { lineBreak: false });
          
          const truncatedReward = inv.rewardTitle.length > 18 ? inv.rewardTitle.substring(0, 16) + '..' : inv.rewardTitle;
          doc.text(truncatedReward, cols.recompensa.x + 5, currentY + 6, { lineBreak: false });
          
          doc.text(`Bs. ${inv.amount.toLocaleString('es-BO')}`, cols.monto.x + 5, currentY + 6, { align: 'right', width: cols.monto.w - 10, lineBreak: false });
          
          const statusText = inv.status.toUpperCase();
          let statusColor = textDark;
          if (inv.status === 'completed') statusColor = primaryGreen;
          else if (inv.status === 'pending') statusColor = '#d97706';
          else if (inv.status === 'failed' || inv.status === 'refunded') statusColor = '#dc2626';
          
          doc.fillColor(statusColor).font('Helvetica-Bold');
          doc.text(statusText, cols.estado.x + 5, currentY + 6, { align: 'center', width: cols.estado.w - 10, lineBreak: false });
          doc.font('Helvetica');

          currentY += 20;
        }
      }

      if (currentY > doc.page.height - 80) {
        doc.addPage();
        currentY = 40;
      }
      currentY += 30;
      doc.fillColor(textMuted).fontSize(8).font('Helvetica-Oblique').text(
        'Este reporte consolida todas las transacciones procesadas por la plataforma para esta campaña. El balance financiero de aportes ha sido calculado siguiendo las reglas de negocio de la plataforma con una comisión del 5.0%.',
        marginX,
        currentY,
        { align: 'justify', width: contentWidth }
      );

      doc.end();
    }

    return { stream, filename };
  }
}
