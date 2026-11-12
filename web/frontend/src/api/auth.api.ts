import axios from 'axios';

export interface AuthUser {
  id: string;
  email: string;
  roles?: string[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  emailVerified?: boolean;
  oauthProvider?: string | null;
}

export async function logout(): Promise<void> {
  const token = localStorage.getItem('accessToken');
  try {
    if (token) await axios.post('/api/v1/auth/logout', {}, { headers: { Authorization: `Bearer ${token}` }, timeout: 5000 });
  } finally {
    for (const key of ['accessToken', 'userRole', 'userEmail', 'userId', 'adminAccessLevel']) localStorage.removeItem(key);
  }
}

/**
 * GET /api/v1/auth/me
 * Retorna los datos del usuario autenticado con roles.
 */
export async function getMe(): Promise<AuthUser> {
  const token = localStorage.getItem('accessToken');
  const response = await axios.get('/api/v1/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Soporta tanto respuesta directa como envuelta en { data: ... }
  return response.data?.data ?? response.data;
}

/**
 * PATCH /api/v1/users/me/password
 * Cambia la contraseña del usuario autenticado.
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = localStorage.getItem('accessToken');
  await axios.patch(
    '/api/v1/users/me/password',
    { currentPassword, newPassword },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}
