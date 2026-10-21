import { Injectable, NotFoundException } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { InvestmentsRepository } from '../repositories/investments.repository';
import { InvestmentDto } from '../dto/investment.dto';
import { InvestmentResult, InvestmentHistoryItem } from '../models/investment.model';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class InvestmentsService {
  constructor(
    private readonly investmentsRepository: InvestmentsRepository,
    private readonly notificationsService: NotificationsService,
  ) { }

  /**
   * Crea una nueva inversión y dispara notificaciones al terminar
   */
  async createInvestment(userId: string, dto: InvestmentDto): Promise<InvestmentResult> {
    return this.investmentsRepository.createInvestmentTransaction(
      userId,
      dto,
      async (params) => {
        // Notificar al emprendedor: nueva inversión recibida
        await this.notificationsService.notifyInvestmentReceived({
          entrepreneurUserId: params.entrepreneurUserId,
          amount: params.amount,
          currency: params.campaignCurrency,
          campaignTitle: params.campaignTitle,
          campaignId: params.campaignId,
          investmentId: params.investmentId,
        });

        // Notificar al inversor: inversión confirmada
        await this.notificationsService.notifyInvestmentConfirmed({
          investorUserId: params.investorUserId,
          amount: params.amount,
          currency: params.campaignCurrency,
          campaignTitle: params.campaignTitle,
          campaignId: params.campaignId,
          investmentId: params.investmentId,
        });

        // Si la campaña alcanzó su meta: notificar a todos los involucrados
        if (params.isFunded) {
          await this.notificationsService.notifyCampaignFunded({
            entrepreneurUserId: params.entrepreneurUserId,
            campaignTitle: params.campaignTitle,
            campaignId: params.campaignId,
            goalAmount: params.goalAmount,
            currency: params.campaignCurrency,
          });
        }
      },
    );
  }

  /**
   * Obtiene el historial de inversiones de un usuario
   */
  async getMyInvestments(userId: string): Promise<InvestmentHistoryItem[]> {
    return this.investmentsRepository.getInvestmentsByUserId(userId, 50, 0);
  }

  /**
   * Genera el PDF del comprobante de inversión
   */
  async generateReceiptPdf(userId: string, investmentId: string): Promise<PassThrough> {
    const details = await this.investmentsRepository.getInvestmentDetails(userId, investmentId);
    if (!details) {
      throw new NotFoundException('Inversión no encontrada o no pertenece a este usuario.');
    }

    // Ruta al logo (relativa al proyecto backend; ajustar si cambia el despliegue)
    const path = require('path');
    const fs = require('fs');
    const logoPath = path.join(process.cwd(), '..', 'frontend', 'public', 'logocrowd.jpg');

    // Configurar el documento sin márgenes iniciales para cabecera a todo el ancho
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const stream = new PassThrough();
    doc.pipe(stream);

    // ── Paleta de colores oficial ──
    const GREEN      = '#72B626';  // Verde corporativo
    const GREEN_DARK = '#4a7f1a';  // Verde oscuro (hover / acento)
    const DARK       = '#1c2b1e';  // Casi negro
    const LIGHT_BG   = '#f5fce8';  // Fondo suave verde claro

    // ── Cabecera ──
    doc.rect(0, 0, doc.page.width, 130).fill(DARK);

    // Logo (si existe)
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 20, { height: 90, fit: [200, 90] });
    } else {
      // Fallback: texto de marca
      doc.fillColor(GREEN).fontSize(26).font('Helvetica-Bold').text('Unifundme', 50, 50);
    }

    // Título del comprobante alineado a la derecha
    doc.fillColor('#ffffff')
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('COMPROBANTE DE DONACIÓN', 0, 52, { align: 'right', width: doc.page.width - 50 });
    doc.fillColor(GREEN)
       .fontSize(10)
       .font('Helvetica')
       .text('Documento oficial generado automáticamente', 0, 71, { align: 'right', width: doc.page.width - 50 });

    // Línea decorativa inferior de la cabecera
    doc.rect(0, 125, doc.page.width, 5).fill(GREEN);

    // ── Cuerpo del documento ──
    const marginX  = 50;
    let   currentY = 165;

    // Función: título de sección
    const drawSectionTitle = (title: string, y: number) => {
      doc.fillColor(GREEN).fontSize(12).font('Helvetica-Bold').text(title.toUpperCase(), marginX, y, { characterSpacing: 1 });
      doc.moveTo(marginX, y + 18)
         .lineTo(doc.page.width - marginX, y + 18)
         .lineWidth(1)
         .stroke(GREEN_DARK);
      return y + 36;
    };

    // Función: fila de dato
    const drawRow = (label: string, value: string, y: number, boldValue: boolean = false) => {
      doc.fillColor('#555555').fontSize(10).font('Helvetica-Bold').text(label, marginX, y);
      doc.fillColor(DARK).fontSize(10).font(boldValue ? 'Helvetica-Bold' : 'Helvetica')
         .text(value, marginX + 165, y, { width: doc.page.width - marginX * 2 - 165 });
      const h = doc.heightOfString(value, { width: doc.page.width - marginX * 2 - 165 });
      return y + Math.max(22, h + 8);
    };

    // ── Sección: Datos del Donador ──
    currentY = drawSectionTitle('Datos del Donador', currentY);
    const investorName = details.investor_first_name
      ? `${details.investor_first_name} ${details.investor_last_name || ''}`.trim()
      : 'Usuario Anónimo';
    currentY = drawRow('Nombre:', investorName, currentY);
    currentY = drawRow('Correo Electrónico:', details.investor_email, currentY);
    currentY += 18;

    // ── Sección: Detalles de la Operación ──
    currentY = drawSectionTitle('Detalles de la Operación', currentY);
    currentY = drawRow('Fecha:', new Date(details.investment_date).toLocaleString('es-BO', { timeZone: 'America/La_Paz' }), currentY);
    currentY = drawRow('Campaña:', `${details.campaign_title} (${details.campaign_type.toUpperCase()})`, currentY);
    if (details.reward_title) {
      currentY = drawRow('Recompensa:', details.reward_title, currentY);
    }
    currentY += 22;

    // ── Sección: Resumen Financiero ──
    currentY = drawSectionTitle('Resumen Financiero', currentY);

    // Caja de monto destacada
    doc.rect(marginX, currentY, doc.page.width - marginX * 2, 74).fill(LIGHT_BG);
    doc.rect(marginX, currentY, 6, 74).fill(GREEN); // barra lateral verde

    doc.fillColor('#555555').fontSize(11).font('Helvetica-Bold')
       .text('Monto Donado', marginX + 22, currentY + 18);
    doc.fillColor(GREEN).fontSize(24).font('Helvetica-Bold')
       .text(`Bs. ${Number(details.amount).toLocaleString('es-BO')}`,
             marginX + 22, currentY + 37,
             { width: doc.page.width - marginX * 2 - 44, align: 'right' });

    // ── Pie de página ──
    const footerY = doc.page.height - 55;
    doc.rect(0, footerY - 10, doc.page.width, 1).fill(GREEN);

    doc.fillColor('#aaaaaa').fontSize(8).font('Helvetica')
       .text('Unifundme · Plataforma de Crowdfunding', marginX, footerY, { align: 'left' });
    doc.fillColor('#aaaaaa').fontSize(8).font('Helvetica-Oblique')
       .text('Este documento es un comprobante digital generado automáticamente.', marginX, footerY + 14,
             { align: 'center', width: doc.page.width - marginX * 2 });
    doc.fillColor('#aaaaaa').fontSize(8).font('Helvetica')
       .text(new Date().toLocaleDateString('es-BO'), marginX, footerY, { align: 'right', width: doc.page.width - marginX * 2 });

    doc.end();
    return stream;
  }
}
