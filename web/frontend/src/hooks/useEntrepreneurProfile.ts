import { useState, useEffect, useCallback } from 'react';
import {
  getMyEntrepreneurProfile,
  createEntrepreneurProfile,
  updateEntrepreneurProfile,
  deleteEntrepreneurProfile,
  uploadAvatar,
  uploadCover,
} from '../api/entrepreneur.api';
import type {
  EntrepreneurProfile,
  CreateEntrepreneurProfileDto,
} from '../types/entrepreneur.types';

interface UseEntrepreneurProfileReturn {
  profile: EntrepreneurProfile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  successMessage: string | null;
  isNewProfile: boolean;
  fetchProfile: () => Promise<void>;
  submitProfile: (dto: CreateEntrepreneurProfileDto) => Promise<void>;
  uploadAvatarPhoto: (file: File) => Promise<void>;
  uploadCoverPhoto: (file: File) => Promise<void>;
  deleteProfile: () => Promise<void>;
}

export function useEntrepreneurProfile(): UseEntrepreneurProfileReturn {
  const [profile, setProfile] = useState<EntrepreneurProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isNewProfile, setIsNewProfile] = useState(false);
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyEntrepreneurProfile();
      setProfile(data);
      setIsNewProfile(false);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setProfile(null);
        setIsNewProfile(true);
      } else {
        setError('Error al cargar el perfil. Verifica que el servidor esté activo.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Crear o actualizar perfil
  const submitProfile = useCallback(
    async (dto: CreateEntrepreneurProfileDto) => {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      try {
        let saved: EntrepreneurProfile;
        // Determinamos si es creación o edición basado en la existencia real del perfil
        const shouldCreate = !profile;

        if (shouldCreate) {
          saved = await createEntrepreneurProfile(dto);
          setSuccessMessage('¡Perfil creado exitosamente! Bienvenido a la plataforma.');
        } else {
          saved = await updateEntrepreneurProfile(dto);
          setSuccessMessage('¡Perfil actualizado exitosamente!');
        }
        setProfile(saved);
        setIsNewProfile(false);
      } catch (err: any) {
        if (err?.response?.status === 409) {
          setError('El nombre público ya está en uso por otro emprendedor. Prueba con uno diferente.');
          return;
        }

        const msg =
          err?.response?.data?.message ||
          'Error al guardar el perfil. Intenta de nuevo.';
        
        if (Array.isArray(msg)) {
          setError(`Errores de validación: ${msg.join(', ')}`);
        } else {
          setError(msg);
        }
      } finally {
        setSaving(false);
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    },
    [profile],
  );

  const uploadAvatarPhoto = useCallback(async (file: File) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await uploadAvatar(file);
      setProfile(updated);
      setSuccessMessage('Foto de perfil actualizada exitosamente.');
    } catch (err: any) {
      setError('Error al subir la foto de perfil.');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  }, []);

  const uploadCoverPhoto = useCallback(async (file: File) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await uploadCover(file);
      setProfile(updated);
      setSuccessMessage('Foto de portada actualizada exitosamente.');
    } catch (err: any) {
      setError('Error al subir la foto de portada.');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  }, []);

  const deleteProfile = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await deleteEntrepreneurProfile();
      setProfile(null);
      setIsNewProfile(true);
      setSuccessMessage(
        'Perfil de emprendedor eliminado. Tu cuenta sigue activa; puedes crear un perfil nuevo cuando quieras.',
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        'No se pudo eliminar el perfil. ¿Tienes campañas registradas?';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMessage(null), 6000);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    saving,
    error,
    successMessage,
    isNewProfile,
    fetchProfile,
    submitProfile,
    uploadAvatarPhoto,
    uploadCoverPhoto,
    deleteProfile,
  };
}
