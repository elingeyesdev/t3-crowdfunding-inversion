import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/database';
import { randomUUID } from 'crypto';
import {
  EntrepreneurProfile,
  mapRowToEntrepreneurProfile,
} from '../models';
import { CreateEntrepreneurProfileDto, UpdateEntrepreneurProfileDto } from '../dto';

/**
 * Repository: Perfil de Emprendedor
 * Capa de acceso a datos para entrepreneur_profiles.
 * Solo queries SQL — sin lógica de negocio.
 */
@Injectable()
export class EntrepreneurProfileRepository extends BaseRepository {
  /**
   * Busca un perfil por su ID.
   */
  async findById(id: string): Promise<EntrepreneurProfile | null> {
    const row = await this.queryOne(
      `SELECT * FROM entrepreneur_profiles WHERE id = ?`,
      [id],
    );
    return row ? mapRowToEntrepreneurProfile(row) : null;
  }

  /**
   * Busca un perfil por el user_id del usuario.
   */
  async findByUserId(userId: string): Promise<EntrepreneurProfile | null> {
    const row = await this.queryOne(
      `SELECT * FROM entrepreneur_profiles WHERE user_id = ?`,
      [userId],
    );
    return row ? mapRowToEntrepreneurProfile(row) : null;
  }

  /**
   * Busca un perfil por su nombre público (displayName).
   */
  async findByDisplayName(displayName: string): Promise<EntrepreneurProfile | null> {
    const row = await this.queryOne(
      `SELECT * FROM entrepreneur_profiles WHERE LOWER(display_name) = LOWER(?)`,
      [displayName],
    );
    return row ? mapRowToEntrepreneurProfile(row) : null;
  }

  /**
   * Crea un nuevo perfil de emprendedor.
   * También asigna el rol 'entrepreneur' al usuario si no lo tiene.
   */
  async create(
    userId: string,
    dto: CreateEntrepreneurProfileDto,
  ): Promise<EntrepreneurProfile> {
    return this.transaction(async (client) => {
      const profileId = randomUUID();
      await client.query(
        `INSERT INTO entrepreneur_profiles (
          id, user_id, first_name, last_name, display_name, bio,
          company_name, website, linkedin_url,
          address_line, city, state, country, postal_code,
          bank_account_number, bank_name, avatar_url, cover_url, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, NOW(), NOW()
        )`,
        [
          profileId,
          userId,
          dto.firstName,
          dto.lastName,
          dto.displayName ?? null,
          dto.bio ?? null,
          dto.companyName ?? null,
          dto.website ?? null,
          dto.linkedinUrl ?? null,
          dto.addressLine ?? null,
          dto.city ?? null,
          dto.state ?? null,
          dto.country ?? null,
          dto.postalCode ?? null,
          dto.bankAccountNumber ?? null,
          dto.bankName ?? null,
          (dto as any).avatarUrl ?? null,
          (dto as any).coverUrl ?? null,
        ],
      );

      const userRoleId = randomUUID();
      await client.query(
        `INSERT IGNORE INTO user_roles (id, user_id, role_id)
         SELECT ?, ?, r.id FROM roles r WHERE r.name = 'entrepreneur'`,
        [userRoleId, userId],
      );

      const result = await client.query(`SELECT * FROM entrepreneur_profiles WHERE id = ?`, [profileId]);
      return mapRowToEntrepreneurProfile(result.rows[0]);
    });
  }

  /**
   * Actualiza un perfil existente.
   * Solo actualiza los campos que vienen en el DTO (no undefined).
   */
  async update(
    userId: string,
    dto: UpdateEntrepreneurProfileDto,
  ): Promise<EntrepreneurProfile | null> {
    const { clause, values } = this.buildUpdateSet({
      first_name: dto.firstName,
      last_name: dto.lastName,
      display_name: dto.displayName,
      bio: dto.bio,
      company_name: dto.companyName,
      website: dto.website,
      linkedin_url: dto.linkedinUrl,
      address_line: dto.addressLine,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      postal_code: dto.postalCode,
      bank_account_number: dto.bankAccountNumber,
      bank_name: dto.bankName,
      avatar_url: (dto as any).avatarUrl,
      cover_url: (dto as any).coverUrl,
    });

    if (!clause) {
      return this.findByUserId(userId);
    }

    await this.query(
      `UPDATE entrepreneur_profiles
       SET ${clause}, updated_at = NOW()
       WHERE user_id = ?`,
      [...values, userId],
    );

    const row = await this.queryOne(
      `SELECT * FROM entrepreneur_profiles WHERE user_id = ?`,
      [userId],
    );

    return row ? mapRowToEntrepreneurProfile(row) : null;
  }

  /**
   * Verifica si un usuario ya tiene perfil de emprendedor.
   */
  async existsByUserId(userId: string): Promise<boolean> {
    const result = await this.queryOne(
      `SELECT 1 FROM entrepreneur_profiles WHERE user_id = ?`,
      [userId],
    );
    return result !== null;
  }

  /**
   * Actualiza el estado y los documentos de KYC.
   */
  async updateKycDocuments(userId: string, documents: any[], kycStatus: string): Promise<EntrepreneurProfile | null> {
    await this.query(
      `UPDATE entrepreneur_profiles
       SET verification_documents = ?, kyc_status = ?, kyc_rejection_reason = NULL, updated_at = NOW()
       WHERE user_id = ?`,
      [JSON.stringify(documents), kycStatus, userId],
    );
    const row = await this.queryOne(
      `SELECT * FROM entrepreneur_profiles WHERE user_id = ?`,
      [userId],
    );
    return row ? mapRowToEntrepreneurProfile(row) : null;
  }

  /** Campañas donde el usuario es creador (bloquea borrar perfil si > 0). */
  async countCampaignsAsCreator(userId: string): Promise<number> {
    const row = await this.queryOne<{ c: string }>(
      `SELECT COUNT(*) AS c FROM campaigns WHERE creator_id = ?`,
      [userId],
    );
    return row ? parseInt(row.c, 10) : 0;
  }

  /**
   * Elimina la fila de perfil de emprendedor. No elimina el usuario ni campañas.
   */
  async deleteByUserId(userId: string): Promise<boolean> {
    const result = await this.query(
      `DELETE FROM entrepreneur_profiles WHERE user_id = ?`,
      [userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Incrementa el contador de campañas del emprendedor.
   */
  async incrementCampaignCount(userId: string): Promise<void> {
    await this.query(
      `UPDATE entrepreneur_profiles
       SET total_campaigns = total_campaigns + 1
       WHERE user_id = ?`,
      [userId],
    );
  }

  /**
   * Actualiza el total recaudado del emprendedor (recalculando desde campaigns).
   */
  async refreshTotalRaised(userId: string): Promise<void> {
    await this.query(
      `UPDATE entrepreneur_profiles ep
       SET total_raised = COALESCE((
         SELECT SUM(c.current_amount)
         FROM campaigns c
         WHERE c.creator_id = ep.user_id
           AND c.status IN ('published', 'funded', 'completed')
       ), 0)
       WHERE ep.user_id = ?`,
      [userId],
    );
  }
}
