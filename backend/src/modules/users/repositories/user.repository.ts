import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../../common/database';
import { User, mapRowToUser } from '../models';
import { CreateUserDto } from '../dto';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

/**
 * Repository: Usuarios
 * Capa de acceso a datos para la tabla `users`.
 * Solo queries SQL — sin lógica de negocio.
 */
@Injectable()
export class UserRepository extends BaseRepository {
  /**
   * Crea un nuevo usuario con password hasheado.
   */
  async create(dto: CreateUserDto): Promise<User> {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const userId = randomUUID();

    await this.query(
      `INSERT INTO users (id, email, password_hash, phone, preferred_language, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        userId,
        dto.email.toLowerCase().trim(),
        passwordHash,
        dto.phone ?? null,
        dto.preferredLanguage ?? 'es',
      ],
    );

    const row = await this.queryOne(
      `SELECT * FROM users WHERE id = ?`,
      [userId],
    );

    return mapRowToUser(row!);
  }

  /**
   * Asigna un rol por nombre (entrepreneur | investor | admin). Idempotente.
   */
  async assignRoleByName(userId: string, roleName: string): Promise<void> {
    const role = await this.queryOne<{ id: string }>(
      `SELECT id FROM roles WHERE name = ?`,
      [roleName],
    );
    if (!role) {
      throw new Error(`Rol no encontrado en catálogo: ${roleName}`);
    }
    await this.query(
      `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`,
      [userId, role.id],
    );
  }

  /**
   * Quita un rol por nombre (p. ej. al eliminar solo el perfil emprendedor/inversor).
   */
  async removeRoleByName(userId: string, roleName: string): Promise<void> {
    await this.query(
      `DELETE FROM user_roles ur
       USING roles r
       WHERE ur.user_id = ? AND ur.role_id = r.id AND r.name = ?`,
      [userId, roleName],
    );
  }

  async hasEntrepreneurProfile(userId: string): Promise<boolean> {
    const row = await this.queryOne(
      `SELECT 1 FROM entrepreneur_profiles WHERE user_id = ?`,
      [userId],
    );
    return row !== null;
  }

  async hasInvestorProfile(userId: string): Promise<boolean> {
    const row = await this.queryOne(
      `SELECT 1 FROM investor_profiles WHERE user_id = ?`,
      [userId],
    );
    return row !== null;
  }

  /**
   * Busca un usuario por ID.
   */
  async findById(id: string): Promise<User | null> {
    const row = await this.queryOne(
      `SELECT u.*, a.access_level as admin_access_level
       FROM users u
       LEFT JOIN admin_profiles a ON a.user_id = u.id
       WHERE u.id = ?`,
      [id],
    );
    return row ? mapRowToUser(row) : null;
  }

  /**
   * Busca un usuario por email (case-insensitive).
   */
  async findByEmail(email: string): Promise<User | null> {
    const row = await this.queryOne(
      `SELECT * FROM users WHERE LOWER(email) = LOWER(?)`,
      [email],
    );
    return row ? mapRowToUser(row) : null;
  }

  /**
   * Busca un usuario por email e incluye el password_hash.
   * Solo para uso interno en AuthService.
   */
  async findByEmailWithPassword(
    email: string,
  ): Promise<{ user: User; passwordHash: string } | null> {
    const row = await this.queryOne(
      `SELECT u.*, a.access_level as admin_access_level
       FROM users u
       LEFT JOIN admin_profiles a ON a.user_id = u.id
       WHERE LOWER(u.email) = LOWER(?) AND u.is_active = true`,
      [email],
    );
    if (!row) return null;
    return {
      user: mapRowToUser(row),
      passwordHash: row.password_hash as string,
    };
  }

  /**
   * Verifica si ya existe un usuario con ese email.
   */
  async existsByEmail(email: string): Promise<boolean> {
    const row = await this.queryOne(
      `SELECT 1 FROM users WHERE LOWER(email) = LOWER(?)`,
      [email],
    );
    return row !== null;
  }

  /**
   * Busca un usuario con sus roles asignados.
   */
  async findByIdWithRoles(id: string): Promise<User | null> {
    const row = await this.queryOne(
      `SELECT u.*,
              a.access_level as admin_access_level,
              STRING_AGG(DISTINCT r.name, ',') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       LEFT JOIN admin_profiles a ON a.user_id = u.id
       WHERE u.id = ?
       GROUP BY u.id, a.access_level`,
      [id],
    );

    if (!row) return null;
    const mappedRow = { ...row };
    if (typeof row.roles === 'string') {
      mappedRow.roles = row.roles ? row.roles.split(',') : [];
    }
    return mapRowToUser(mappedRow);
  }

  /**
   * Actualiza la fecha de último login.
   */
  async updateLastLogin(userId: string, ip?: string): Promise<void> {
    await this.query(
      `UPDATE users
       SET last_login_at = NOW(), last_login_ip = ?, failed_login_attempts = 0
       WHERE id = ?`,
      [ip ?? null, userId],
    );
  }

  /**
   * Incrementa el contador de intentos fallidos de login.
   */
  async incrementFailedAttempts(userId: string): Promise<void> {
    await this.query(
      `UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?`,
      [userId],
    );
  }

  /**
   * Busca o crea un usuario autenticado via Google OAuth.
   * Orden de resolución:
   *  1. Busca por (oauth_provider='google', oauth_provider_id).
   *  2. Si existe por email → vincula la cuenta de Google.
   *  3. Si no existe → crea nuevo usuario con el rol indicado.
   */
  async findOrCreateGoogleUser(params: {
    googleId: string;
    email: string;
    picture: string;
    signupRole: 'investor' | 'entrepreneur';
  }): Promise<User> {
    const { googleId, email, picture, signupRole } = params;

    // 1. Buscar por Google ID
    let row = await this.queryOne(
      `SELECT u.*
       FROM users u
       WHERE u.oauth_provider = 'google' AND u.oauth_provider_id = ?`,
      [googleId],
    );

    if (row) {
      return mapRowToUser(row);
    }

    // 2. Buscar por email (vincular cuenta existente)
    row = await this.queryOne(
      `SELECT * FROM users WHERE LOWER(email) = LOWER(?)`,
      [email],
    );

    if (row) {
      await this.query(
        `UPDATE users
         SET oauth_provider = 'google',
             oauth_provider_id = ?,
             email_verified = true,
             avatar_url = COALESCE(avatar_url, ?),
             updated_at = NOW()
         WHERE id = ?`,
        [googleId, picture || null, row.id],
      );
      return mapRowToUser(row);
    }

    // 3. Crear nuevo usuario OAuth
    const newUserId = randomUUID();
    await this.query(
      `INSERT INTO users
         (id, email, password_hash, email_verified, oauth_provider, oauth_provider_id, avatar_url, preferred_language, created_at, updated_at)
       VALUES (?, ?, NULL, true, 'google', ?, ?, 'es', NOW(), NOW())`,
      [newUserId, email.toLowerCase().trim(), googleId, picture || null],
    );

    const newRow = await this.queryOne(
      `SELECT * FROM users WHERE id = ?`,
      [newUserId],
    );

    const newUser = mapRowToUser(newRow!);
    await this.assignRoleByName(newUser.id, signupRole);
    return newUser;
  }

  /**
   * Actualiza el hash de contraseña del usuario.
   * Solo para uso interno en UserService (cambio de contraseña).
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.query(
      `UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?`,
      [passwordHash, id],
    );
  }

  /**
   * Busca un usuario por ID e incluye el password_hash.
   * Solo para uso interno en UserService (cambio de contraseña).
   */
  async findByIdWithPassword(
    id: string,
  ): Promise<{ user: User; passwordHash: string } | null> {
    const row = await this.queryOne(
      `SELECT u.*, a.access_level as admin_access_level
       FROM users u
       LEFT JOIN admin_profiles a ON a.user_id = u.id
       WHERE u.id = ? AND u.is_active = true`,
      [id],
    );
    if (!row) return null;
    return {
      user: mapRowToUser(row),
      passwordHash: row.password_hash as string,
    };
  }

  /**
   * TEMPORAL: Crea o actualiza el usuario superadmin por defecto (acceso directo a db).
   */
  async seedSuperAdmin(passwordHash: string) {
    const email = 'superadmin@equipo09.com';

    const existing = await this.queryOne(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing) {
      await this.query(`UPDATE users SET password_hash = ? WHERE email = ?`, [passwordHash, email]);
      const profile = await this.queryOne(`SELECT id FROM admin_profiles WHERE user_id = ?`, [existing.id]);
      if (!profile) {
        const adminId = randomUUID();
        await this.query(
          `INSERT INTO admin_profiles (id, user_id, first_name, last_name, access_level, can_approve_campaigns, can_manage_users, can_manage_finances, is_active, created_at, updated_at)
           VALUES (?, ?, 'Super', 'Admin', 'super_admin', true, true, true, true, NOW(), NOW())`,
          [adminId, existing.id],
        );
      }
      return;
    }

    const newUserId = randomUUID();
    await this.query(
      `INSERT INTO users (id, email, password_hash, email_verified, is_active, preferred_language, created_at, updated_at)
       VALUES (?, ?, ?, true, true, 'es', NOW(), NOW())`,
      [newUserId, email, passwordHash],
    );

    const adminId = randomUUID();
    await this.query(
      `INSERT INTO admin_profiles (id, user_id, first_name, last_name, access_level, can_approve_campaigns, can_manage_users, can_manage_finances, is_active, created_at, updated_at)
       VALUES (?, ?, 'Super', 'Admin', 'super_admin', true, true, true, true, NOW(), NOW())`,
      [adminId, newUserId],
    );
  }
}
