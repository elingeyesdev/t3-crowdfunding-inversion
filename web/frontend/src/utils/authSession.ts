import type { AuthUser } from '../api/auth.api.ts';
import { primaryRoleFromServerRoles } from './authRole.ts';

const SESSION_KEYS = ['accessToken', 'userId', 'userEmail', 'userRole', 'adminAccessLevel'];

export function clearStoredSession(): void {
  for (const key of SESSION_KEYS) localStorage.removeItem(key);
}

/** Commit only an identity confirmed by the server; URL parameters are not identity data. */
export function establishSession(token: string, user: AuthUser): string {
  if (
    !user ||
    typeof user.id !== 'string' ||
    !user.id.trim() ||
    typeof user.email !== 'string' ||
    !user.email.trim() ||
    user.isActive !== true ||
    !Array.isArray(user.roles) ||
    !user.roles.length ||
    !user.roles.every((role) => typeof role === 'string')
  ) {
    throw new Error('No se pudieron validar los datos de tu cuenta. Vuelve a iniciar sesión.');
  }

  const adminLevel = user.adminAccessLevel;
  const adminRole = user.roles.includes('super_admin')
    ? 'super_admin'
    : user.roles.includes('admin')
      ? 'admin'
      : null;
  if (adminRole ? adminLevel !== adminRole : Boolean(adminLevel)) {
    throw new Error('No se pudieron validar los permisos de tu cuenta. Vuelve a iniciar sesión.');
  }
  if (!adminRole && !user.roles.some((role) => role === 'entrepreneur' || role === 'investor')) {
    throw new Error('Tu cuenta no tiene un rol disponible. Vuelve a iniciar sesión.');
  }

  const role = adminRole ?? primaryRoleFromServerRoles(user.roles);
  clearStoredSession();
  localStorage.setItem('accessToken', token);
  localStorage.setItem('userId', user.id);
  localStorage.setItem('userEmail', user.email);
  localStorage.setItem('userRole', role);
  if (adminRole) localStorage.setItem('adminAccessLevel', adminRole);
  return adminRole === 'super_admin'
    ? '/superadmin'
    : adminRole === 'admin'
      ? '/admin'
      : role === 'entrepreneur'
        ? '/entrepreneur-profile'
        : '/dashboard';
}
