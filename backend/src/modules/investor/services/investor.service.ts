import { Injectable, Logger } from '@nestjs/common';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '../../../common/exceptions';
import { InvestorProfileRepository } from '../repositories';
import { UserRepository } from '../../users/repositories';
import {
  CreateInvestorProfileDto,
  UpdateInvestorProfileDto,
  AddCapitalDto,
} from '../dto';
import { InvestorProfile, CapitalOverview } from '../models';

/**
 * Service: Inversor
 * Lógica de negocio para el perfil de inversor.
 * Orquesta repositorios y aplica reglas de negocio.
 */
@Injectable()
export class InvestorService {
  private readonly logger = new Logger(InvestorService.name);

  constructor(
    private readonly profileRepo: InvestorProfileRepository,
    private readonly userRepo: UserRepository,
  ) {}

  // =========================================================================
  // PERFIL DE INVERSOR — Crear
  // =========================================================================

  /**
   * Crea un perfil de inversor para el usuario autenticado.
   * Reglas:
   *  - Un usuario solo puede tener UN perfil de inversor.
   *  - Se asigna automáticamente el rol 'investor'.
   */
  async createProfile(
    userId: string,
    dto: CreateInvestorProfileDto,
  ): Promise<InvestorProfile> {
    this.logger.log(`Creando perfil de inversor para user ${userId}`);

    const exists = await this.profileRepo.existsByUserId(userId);
    if (exists) {
      throw new ConflictException(
        'Este usuario ya tiene un perfil de inversor',
      );
    }

    const profile = await this.profileRepo.create(userId, dto);
    this.logger.log(`Perfil de inversor creado: ${profile.id} para user ${userId}`);
    return profile;
  }

  // =========================================================================
  // PERFIL DE INVERSOR — Consultar
  // =========================================================================

  /**
   * Obtiene el perfil del inversor autenticado.
   */
  async getMyProfile(userId: string): Promise<InvestorProfile> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Perfil de inversor');
    }
    return profile;
  }

  /**
   * Obtiene un perfil de inversor por su ID (vista pública).
   */
  async getProfileById(profileId: string): Promise<InvestorProfile> {
    const profile = await this.profileRepo.findById(profileId);
    if (!profile) {
      throw new NotFoundException('Perfil de inversor', profileId);
    }
    return profile;
  }

  // =========================================================================
  // PERFIL DE INVERSOR — Capital y Métricas
  // =========================================================================
  
  /**
   * Obtiene el resumen de capital y métricas de inversión.
   */
  async getCapitalOverview(userId: string): Promise<CapitalOverview> {
    const overview = await this.profileRepo.getCapitalOverview(userId);
    if (!overview) {
      throw new NotFoundException('Perfil de inversor no encontrado');
    }
    return overview;
  }

  /**
   * Inyecta capital adicional al inversor.
   * Aumenta el max_investment y registra en historial.
   */
  async addCapital(
    userId: string,
    dto: AddCapitalDto,
  ): Promise<{ newMax: number; availableCapital: number }> {
    this.logger.log(`Inyección de capital para user ${userId}: +$${dto.amount}`);

    const exists = await this.profileRepo.existsByUserId(userId);
    if (!exists) {
      throw new NotFoundException('Perfil de inversor');
    }

    const result = await this.profileRepo.addCapital(userId, dto.amount, dto.notes);
    this.logger.log(`Capital actualizado para user ${userId}: nuevo max=$${result.newMax}, disponible=$${result.availableCapital}`);
    return result;
  }

  // =========================================================================
  // PERFIL DE INVERSOR — Editar
  // =========================================================================

  /**
   * Actualiza los datos personales del inversor autenticado.
   * Regla: Solo el dueño del perfil puede editarlo.
   * Solo actualiza los campos enviados en el body (patch parcial).
   */
  async updateMyProfile(
    userId: string,
    dto: UpdateInvestorProfileDto,
  ): Promise<InvestorProfile> {
    this.logger.log(`Actualizando perfil de inversor para user ${userId}`);

    const exists = await this.profileRepo.existsByUserId(userId);
    if (!exists) {
      throw new NotFoundException('Perfil de inversor');
    }

    const updated = await this.profileRepo.update(userId, dto);
    if (!updated) {
      throw new NotFoundException('Perfil de inversor');
    }

    this.logger.log(`Perfil de inversor actualizado: ${updated.id}`);
    return updated;
  }

  /**
   * Elimina el perfil de inversor y el rol asociado.
   * Bloqueado si el usuario tiene inversiones registradas.
   */
  async deleteMyProfile(userId: string): Promise<void> {
    const n = await this.profileRepo.countInvestmentsByInvestor(userId);
    if (n > 0) {
      throw new BadRequestException(
        `No puedes eliminar tu perfil de inversor mientras tengas ${n} inversión(es) registrada(s).`,
      );
    }
    const existed = await this.profileRepo.existsByUserId(userId);
    if (!existed) {
      throw new NotFoundException('Perfil de inversor');
    }
    await this.profileRepo.deleteByUserId(userId);
    try {
      await this.userRepo.removeRoleByName(userId, 'investor');
    } catch (err) {
      this.logger.warn(`No se pudo quitar rol investor: ${err}`);
    }
    this.logger.log(`Perfil de inversor eliminado para user ${userId}`);
  }
}

