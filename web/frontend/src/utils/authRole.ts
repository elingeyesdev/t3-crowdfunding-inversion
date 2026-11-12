export type AppUserRole = 'entrepreneur' | 'investor';

/** Prioriza emprendedor si tiene ambos roles (misma lógica que la barra de navegación). */
export function primaryRoleFromServerRoles(roles: string[] | undefined | null): AppUserRole {
  if (!roles?.length) return 'investor';
  if (roles.includes('entrepreneur')) return 'entrepreneur';
  return 'investor';
}

export function persistUserRoleFromServer(
  roles: string[] | undefined | null,
  fallback?: AppUserRole,
): AppUserRole {
  const resolved =
    roles && roles.length > 0 ? primaryRoleFromServerRoles(roles) : fallback ?? 'investor';
  localStorage.setItem('userRole', resolved);
  return resolved;
}
