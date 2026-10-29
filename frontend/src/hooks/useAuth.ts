import { useState, useEffect, useCallback } from 'react';
import { getMe, logout, AuthUser } from '../api/auth.api';

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

/**
 * Hook que obtiene los datos del usuario autenticado desde /api/v1/auth/me.
 * - Solo llama al endpoint si hay un token en localStorage.
 * - Hace logout automatico si recibe un 401.
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getMe();
      setUser(data);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        // Token invalido/expirado -> limpiar sesion
        await logout().catch(() => {});
        setUser(null);
      } else {
        setError(err?.response?.data?.message ?? 'Error al cargar los datos del usuario');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, loading, error, refreshUser: fetchUser };
}
