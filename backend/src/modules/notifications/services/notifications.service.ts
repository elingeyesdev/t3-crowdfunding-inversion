import { Injectable } from '@nestjs/common';
import { NotificationsRepository } from '../repositories/notifications.repository';
import { Notification } from '../models/notification.model';

const NOTIFICATION_CURRENCY = 'BOB';

function formatBolivianos(amount: number): string {
  return `Bs. ${Number(amount || 0).toLocaleString('es-BO')}`;
}

function normalizeNotificationCurrencyBody(body: string): string {
  return body.replace(/\b(\d+(?:[.,]\d{3})*(?:[.,]\d+)?)\s+(?:USD|BOB)\b/g, 'Bs. $1');
}

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async getMyNotifications(userId: string): Promise<Notification[]> {
    const notifications = await this.notificationsRepository.getNotificationsByUserId(userId);
    return notifications.map((notification) => ({
      ...notification,
      body: normalizeNotificationCurrencyBody(notification.body),
      data: notification.data?.currency
        ? { ...notification.data, currency: NOTIFICATION_CURRENCY }
        : notification.data,
    }));
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationsRepository.countUnread(userId);
  }

  async markAsRead(notificationId: string, userId: string): Promise<{ updated: boolean }> {
    const updated = await this.notificationsRepository.markAsRead(notificationId, userId);
    return { updated };
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const updated = await this.notificationsRepository.markAllAsRead(userId);
    return { updated };
  }

  /**
   * Notifica al emprendedor que recibió una nueva inversión
   */
  async notifyInvestmentReceived(params: {
    entrepreneurUserId: string;
    amount: number;
    currency: string;
    campaignTitle: string;
    campaignId: string;
    investmentId: string;
  }): Promise<void> {
    const formattedAmount = formatBolivianos(params.amount);

    await this.notificationsRepository.createNotification({
      userId: params.entrepreneurUserId,
      typeCode: 'investment_received',
      title: 'Nueva inversión recibida',
      body: `Recibiste una inversión de ${formattedAmount} en "${params.campaignTitle}".`,
      referenceType: 'investment',
      referenceId: params.investmentId,
      actionUrl: `/campaign/${params.campaignId}`,
      data: {
        amount: params.amount,
        currency: NOTIFICATION_CURRENCY,
        campaign_title: params.campaignTitle,
        campaign_id: params.campaignId,
      },
    });
  }

  /**
   * Notifica al inversor que su inversión fue confirmada
   */
  async notifyInvestmentConfirmed(params: {
    investorUserId: string;
    amount: number;
    currency: string;
    campaignTitle: string;
    campaignId: string;
    investmentId: string;
  }): Promise<void> {
    const formattedAmount = formatBolivianos(params.amount);

    await this.notificationsRepository.createNotification({
      userId: params.investorUserId,
      typeCode: 'investment_confirmed',
      title: 'Inversión confirmada',
      body: `Tu inversión de ${formattedAmount} en "${params.campaignTitle}" fue procesada exitosamente.`,
      referenceType: 'investment',
      referenceId: params.investmentId,
      actionUrl: `/campaign/${params.campaignId}`,
      data: {
        amount: params.amount,
        currency: NOTIFICATION_CURRENCY,
        campaign_title: params.campaignTitle,
        campaign_id: params.campaignId,
      },
    });
  }

  /**
   * Notifica al emprendedor y a los inversores cuando la campaña alcanzó su meta
   */
  async notifyCampaignFunded(params: {
    entrepreneurUserId: string;
    campaignTitle: string;
    campaignId: string;
    goalAmount: number;
    currency: string;
  }): Promise<void> {
    const formattedGoalAmount = formatBolivianos(params.goalAmount);

    // Notificar al emprendedor
    await this.notificationsRepository.createNotification({
      userId: params.entrepreneurUserId,
      typeCode: 'campaign_funded',
      title: '¡Campaña financiada!',
      body: `¡Felicidades! Tu campaña "${params.campaignTitle}" alcanzó su meta de ${formattedGoalAmount}.`,
      referenceType: 'campaign',
      referenceId: params.campaignId,
      actionUrl: `/campaign/${params.campaignId}`,
      data: {
        campaign_title: params.campaignTitle,
        goal_amount: params.goalAmount,
        currency: NOTIFICATION_CURRENCY,
      },
    });

    // Notificar a todos los inversores de la campaña
    const investorIds = await this.notificationsRepository.getInvestorsByCampaignId(params.campaignId);
    for (const investorId of investorIds) {
      await this.notificationsRepository.createNotification({
        userId: investorId,
        typeCode: 'campaign_funded',
        title: '¡La campaña alcanzó su meta!',
        body: `La campaña "${params.campaignTitle}" en la que invertiste ha alcanzado su meta de financiamiento.`,
        referenceType: 'campaign',
        referenceId: params.campaignId,
        actionUrl: `/campaign/${params.campaignId}`,
        data: {
          campaign_title: params.campaignTitle,
          goal_amount: params.goalAmount,
          currency: NOTIFICATION_CURRENCY,
        },
      });
    }
  }

  /**
   * Notifica al emprendedor que su campaña fue aprobada
   */
  async notifyCampaignApproved(params: {
    entrepreneurUserId: string;
    campaignTitle: string;
    campaignId: string;
  }): Promise<void> {
    await this.notificationsRepository.createNotification({
      userId: params.entrepreneurUserId,
      typeCode: 'campaign_approved',
      title: '¡Campaña aprobada!',
      body: `Tu campaña "${params.campaignTitle}" fue aprobada. ¡Ya puedes publicarla!`,
      referenceType: 'campaign',
      referenceId: params.campaignId,
      actionUrl: `/entrepreneur-campaigns`,
      data: { campaign_title: params.campaignTitle, campaign_id: params.campaignId },
    });
  }

  /**
   * Notifica al emprendedor que su campaña fue rechazada
   */
  async notifyCampaignRejected(params: {
    entrepreneurUserId: string;
    campaignTitle: string;
    campaignId: string;
    feedback?: string;
  }): Promise<void> {
    await this.notificationsRepository.createNotification({
      userId: params.entrepreneurUserId,
      typeCode: 'campaign_rejected',
      title: 'Campaña requiere cambios',
      body: params.feedback
        ? `Tu campaña "${params.campaignTitle}" fue rechazada. Motivo: ${params.feedback}`
        : `Tu campaña "${params.campaignTitle}" necesita cambios. Revisa el feedback del equipo.`,
      referenceType: 'campaign',
      referenceId: params.campaignId,
      actionUrl: `/entrepreneur-campaigns`,
      data: { campaign_title: params.campaignTitle, campaign_id: params.campaignId, feedback: params.feedback },
    });
  }

  /**
   * Notifica al receptor de un nuevo mensaje de chat
   */
  async notifyNewMessage(params: {
    recipientUserId: string;
    senderName: string;
    senderId: string;
    conversationId: string;
    messagePreview: string;
  }): Promise<void> {
    const preview = params.messagePreview.length > 80
      ? params.messagePreview.substring(0, 80) + '…'
      : params.messagePreview;
    await this.notificationsRepository.createNotification({
      userId: params.recipientUserId,
      typeCode: 'new_message',
      title: `Mensaje de ${params.senderName}`,
      body: preview,
      referenceType: 'conversation',
      referenceId: params.conversationId,
      actionUrl: `/chat/${params.conversationId}`,
      data: {
        sender_name: params.senderName,
        sender_id: params.senderId,
        conversation_id: params.conversationId,
      },
    });
  }

  async notifyCampaignSubmittedForReview(params: {
    entrepreneurUserId: string;
    campaignTitle: string;
    campaignId: string;
  }): Promise<void> {
    await this.notificationsRepository.createNotification({
      userId: params.entrepreneurUserId,
      typeCode: 'campaign_submitted',
      title: 'Campaña enviada a revisión',
      body: `Tu campaña "${params.campaignTitle}" fue enviada para revisión del equipo.`,
      referenceType: 'campaign',
      referenceId: params.campaignId,
      actionUrl: '/entrepreneur-campaigns',
      data: { campaign_title: params.campaignTitle, campaign_id: params.campaignId },
    });
  }

  async notifyCampaignPublished(params: {
    entrepreneurUserId: string;
    campaignTitle: string;
    campaignId: string;
  }): Promise<void> {
    await this.notificationsRepository.createNotification({
      userId: params.entrepreneurUserId,
      typeCode: 'campaign_published',
      title: 'Campaña publicada',
      body: `Tu campaña "${params.campaignTitle}" ya está visible para inversores.`,
      referenceType: 'campaign',
      referenceId: params.campaignId,
      actionUrl: `/campaign/${params.campaignId}`,
      data: { campaign_title: params.campaignTitle, campaign_id: params.campaignId },
    });
  }

  async notifyCampaignFinalized(params: {
    entrepreneurUserId: string;
    campaignTitle: string;
    campaignId: string;
  }): Promise<void> {
    await this.notificationsRepository.createNotification({
      userId: params.entrepreneurUserId,
      typeCode: 'campaign_finalized',
      title: 'Campaña finalizada',
      body: `La campaña "${params.campaignTitle}" fue finalizada correctamente.`,
      referenceType: 'campaign',
      referenceId: params.campaignId,
      actionUrl: '/entrepreneur-campaigns',
      data: { campaign_title: params.campaignTitle, campaign_id: params.campaignId },
    });
  }

  async notifyKycReviewed(params: {
    entrepreneurUserId: string;
    approved: boolean;
    reason?: string;
  }): Promise<void> {
    await this.notificationsRepository.createNotification({
      userId: params.entrepreneurUserId,
      typeCode: params.approved ? 'kyc_approved' : 'kyc_rejected',
      title: params.approved ? 'KYC aprobado' : 'KYC rechazado',
      body: params.approved
        ? 'Tu verificación KYC fue aprobada. Ya puedes operar sin restricciones.'
        : params.reason
          ? `Tu verificación KYC fue rechazada. Motivo: ${params.reason}`
          : 'Tu verificación KYC fue rechazada. Revisa los documentos y vuelve a intentar.',
      referenceType: 'kyc',
      actionUrl: '/entrepreneur-profile',
      data: { approved: params.approved, reason: params.reason },
    });
  }

  async notifyInvestmentRefunded(params: {
    investorUserId: string;
    campaignTitle: string;
    amount: number;
    currency: string;
  }): Promise<void> {
    const formattedAmount = formatBolivianos(params.amount);

    await this.notificationsRepository.createNotification({
      userId: params.investorUserId,
      typeCode: 'investment_refunded',
      title: 'Inversión Reembolsada',
      body: `La campaña "${params.campaignTitle}" fue cancelada o no alcanzó su meta. Se han devuelto ${formattedAmount} a tu billetera.`,
      referenceType: 'investment',
      actionUrl: '/dashboard',
      data: { campaign_title: params.campaignTitle, amount: params.amount, currency: NOTIFICATION_CURRENCY },
    });
  }

  async notifyCampaignFailed(params: {
    entrepreneurUserId: string;
    campaignTitle: string;
    campaignId: string;
  }): Promise<void> {
    await this.notificationsRepository.createNotification({
      userId: params.entrepreneurUserId,
      typeCode: 'campaign_failed',
      title: 'Campaña Fallida',
      body: `Has finalizado la campaña "${params.campaignTitle}" sin alcanzar la meta. Las inversiones han sido reembolsadas automáticamente.`,
      referenceType: 'campaign',
      referenceId: params.campaignId,
      actionUrl: '/entrepreneur-campaigns',
      data: { campaign_title: params.campaignTitle, campaign_id: params.campaignId },
    });
  }
}
