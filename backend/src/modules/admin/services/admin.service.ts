import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PaginatedResponse } from '../../../common/dto';
import { AdminRepository } from '../repositories/admin.repository';
import { UserRepository } from '../../users/repositories';
import { EntrepreneurCampaignRepository } from '../../entrepreneur/repositories';
import { RewardTierRepository } from '../../reward-tiers/repositories/reward-tier.repository';
import { QueryAdminCampaignsDto } from '../dto/admin-campaigns.dto';
import { NotificationsService } from '../../notifications/services/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepo: AdminRepository,
    private readonly userRepo: UserRepository,
    private readonly campaignRepo: EntrepreneurCampaignRepository,
    private readonly rewardRepo: RewardTierRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getDashboardStats() {
    return this.adminRepo.getDashboardStats();
  }

  async getAllUsers() {
    return this.adminRepo.getAllUsers();
  }

  async getAllCampaigns() {
    return this.adminRepo.getAllCampaigns();
  }

  async getPendingCampaigns(queryDto: QueryAdminCampaignsDto) {
    return this.adminRepo.findPendingCampaigns(queryDto);
  }

  async getCampaignDetail(id: string) {
    const campaign = await this.adminRepo.getCampaignDetailAdmin(id);
    if (!campaign) {
      throw new NotFoundException('Campaña no encontrada');
    }
    return campaign;
  }

  async updateCampaignStatus(campaignId: string, status: string, reviewerId: string, feedback?: string) {
    if (status === 'rejected' && (!feedback || feedback.trim().length < 3)) {
      throw new BadRequestException('Debe proporcionar un feedback válido (mínimo 3 caracteres) para rechazar la campaña.');
    }
    const updated = await this.adminRepo.updateCampaignStatus(campaignId, status, reviewerId, feedback);
    if (!updated) {
      throw new NotFoundException('Campaña no encontrada');
    }

    // Disparar notificación al emprendedor si la campaña fue aprobada o rechazada
    if (status === 'approved' || status === 'rejected') {
      try {
        const entrepreneurUserId: string = updated.creator_id;
        const campaignTitle: string = updated.title;
        if (status === 'approved') {
          await this.notificationsService.notifyCampaignApproved({
            entrepreneurUserId,
            campaignTitle,
            campaignId,
          });
        } else {
          await this.notificationsService.notifyCampaignRejected({
            entrepreneurUserId,
            campaignTitle,
            campaignId,
            feedback,
          });
        }
      } catch (notifErr) {
        // No bloquear la respuesta si la notificación falla
        console.error('Error sending campaign status notification:', notifErr);
      }
    }

    return updated;
  }

  async getCampaignHistory(campaignId: string) {
    return this.adminRepo.getCampaignHistory(campaignId);
  }

  async getCampaignFinancialProgress(campaignId: string) {
    return this.campaignRepo.getFinancialProgressAdmin(campaignId);
  }
  
  async getCampaignInvestors(campaignId: string, query: { page?: number; limit?: number }) {
    // Pass undefined as creatorId to bypass ownership check for admins
    const { investors, total } = await this.campaignRepo.getCampaignInvestors(campaignId, undefined as any, query);
    return new PaginatedResponse(
      investors,
      total,
      query.page || 1,
      query.limit || 20
    );
  }

  async getRewardClaims(campaignId: string) {
    // Return all claims for this campaign
    return this.rewardRepo.getRewardClaims(campaignId);
  }

  async createAdmin(email: string, passwordString: string) {
    const userExists = await this.userRepo.findByEmail(email);
    if (userExists) {
      throw new BadRequestException('El usuario ya existe');
    }

    const newUser = await this.userRepo.create({
      email,
      password: passwordString,
    });

    if (!newUser) {
       throw new BadRequestException('Error al crear usuario');
    }
       
    return this.adminRepo.createAdminProfile(newUser.id, 'admin');
  }

  async getAllAdmins() {
    return this.adminRepo.getAllAdmins();
  }

  async deleteAdminProfile(adminId: string) {
    const deleted = await this.adminRepo.deleteAdminProfile(adminId);
    if (!deleted) throw new NotFoundException('Perfil de administrador no encontrado');
    return deleted;
  }

  async softDeleteUser(userId: string) {
    const isTargetAdmin = await this.adminRepo.isUserAdmin(userId);
    if (isTargetAdmin) {
      throw new BadRequestException('Privilegios insuficientes: No puedes bloquear a otro administrador o super administrador desde este panel.');
    }
    const deleted = await this.adminRepo.softDeleteUser(userId);
    if (!deleted) throw new NotFoundException('Usuario no encontrado');
    return deleted;
  }

  async hardDeleteCampaign(campaignId: string, reviewerId: string) {
    try {
      const deleted = await this.adminRepo.hardDeleteCampaign(campaignId);
      if (!deleted) throw new NotFoundException('Campaña no encontrada');
      return deleted;
    } catch(err: any) {
      if (err.code === '23503') { // Foreign key constraint violation
        // Fallback: Si no se puede borrar porque tiene inversores/fondos, se cambia el status a "cancelled"
        return this.adminRepo.updateCampaignStatus(campaignId, 'cancelled', reviewerId);
      }
      throw err;
    }
  }

  async getCampaignDocuments(campaignId: string) {
    return this.adminRepo.getCampaignDocuments(campaignId);
  }

  async reviewCampaignDocument(campaignId: string, docId: string, status: string, reviewerNotes: string, reviewerId: string) {
    const updated = await this.adminRepo.reviewCampaignDocument(campaignId, docId, status, reviewerNotes, reviewerId);
    if (!updated) {
      throw new NotFoundException('Documento no encontrado o no pertenece a la campaña');
    }
    return updated;
  }

  async getPendingKyc() {
    return this.adminRepo.getPendingKyc();
  }

  async reviewKyc(entrepreneurId: string, action: 'approve' | 'reject', reviewerId: string, reason?: string) {
    const updated = await this.adminRepo.reviewKyc(entrepreneurId, action, reviewerId, reason);
    if (!updated) {
      throw new NotFoundException('Emprendedor no encontrado');
    }
    try {
      await this.notificationsService.notifyKycReviewed({
        entrepreneurUserId: updated.user_id,
        approved: action === 'approve',
        reason,
      });
    } catch (err) {
      console.error('Error sending KYC review notification:', err);
    }
    return updated;
  }
}
