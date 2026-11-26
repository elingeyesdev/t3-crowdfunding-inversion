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
  hasPassword?: boolean;
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

export async function requestPasswordReset(email: string): Promise<string> {
  const { data } = await axios.post('/api/v1/auth/forgot-password', { email }, { timeout: 15000 });
  return data.data.message;
}

export async function resetPassword(input: { email: string; token: string; password: string; passwordConfirmation: string }): Promise<void> {
  await axios.post('/api/v1/auth/reset-password', {
    email: input.email, token: input.token, password: input.password,
    password_confirmation: input.passwordConfirmation,
  }, { timeout: 15000 });
}

export async function requestEmailVerification(): Promise<string> {
  const { data } = await axios.post('/api/v1/auth/email/verification', {}, {
    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }, timeout: 15000,
  });
  return data.data.message;
}

export function isVerificationPath(path: string): boolean {
  if (!path.startsWith('/api/v1/auth/email/verify/')) return false;
  const url = new URL(path, 'https://verification.invalid');
  return url.origin === 'https://verification.invalid'
    && /^\/api\/v1\/auth\/email\/verify\/[a-f\d-]{36}\/[a-f\d]{40}$/.test(url.pathname)
    && /^\d+$/.test(url.searchParams.get('expires') ?? '')
    && /^[a-f\d]{64}$/.test(url.searchParams.get('signature') ?? '')
    && [...url.searchParams.keys()].length === 2 && !url.hash;
}

export async function confirmEmailVerification(path: string): Promise<void> {
  if (!isVerificationPath(path)) throw new Error('El enlace está incompleto o no es válido. Solicita uno nuevo.');
  await axios.post(path, {}, {
    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }, timeout: 15000,
  });
}
