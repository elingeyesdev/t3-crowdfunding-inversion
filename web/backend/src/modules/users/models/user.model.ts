/**
 * Domain model: Usuario
 * Representa la tabla `users` — nunca expone password_hash.
 */
export interface User {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  isActive: boolean;
  preferredLanguage: string;
  timezone: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  avatarUrl?: string;
  oauthProvider?: string;
  /** Roles asignados (join con user_roles + roles) */
  roles?: string[];
  adminAccessLevel?: string;
}

/**
 * Convierte una fila de la DB al modelo User.
 * Excluye password_hash explícitamente.
 */
export function mapRowToUser(row: Record<string, any>): User {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone ?? null,
    emailVerified: row.email_verified,
    phoneVerified: row.phone_verified,
    isActive: row.is_active,
    preferredLanguage: row.preferred_language,
    timezone: row.timezone,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    avatarUrl: row.avatar_url ?? undefined,
    oauthProvider: row.oauth_provider ?? undefined,
    roles: row.roles ?? undefined,
    adminAccessLevel: row.admin_access_level ?? undefined,
  };
}
