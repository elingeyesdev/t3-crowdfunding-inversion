import { useAsyncResource } from './useAsyncResource.ts';
import { getApiErrorMessage, getApiErrorStatus } from '../utils/apiError.ts';
import { useState, useCallback } from 'react';
import {
  getMyInvestorProfile,
  createInvestorProfile,
  updateInvestorProfile,
  deleteInvestorProfile,
  uploadInvestorAvatar,
  uploadInvestorCover,
} from '../api/investor.api';
import type { InvestorProfile, CreateInvestorProfileDto } from '../types/investor.types';

interface UseInvestorProfileReturn {
  profile: InvestorProfile | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  successMessage: string | null;
  isNewProfile: boolean;
  fetchProfile: () => Promise<void>;
  submitProfile: (dto: CreateInvestorProfileDto) => Promise<void>;
  uploadAvatarPhoto: (file: File) => Promise<void>;
  uploadCoverPhoto: (file: File) => Promise<void>;
  deleteProfile: () => Promise<void>;
}

export function useInvestorProfile(): UseInvestorProfileReturn {
  const resource = useAsyncResource(loadProfile);
  const {setData} = resource;
  const profile = resource.data?.profile ?? null;
  const setProfile = useCallback((profile: InvestorProfile | null) => setData({profile}), [setData]);
  const loading = resource.loading;
  const isNewProfile = !loading && !resource.error && !profile;
  const fetchProfile = resource.refetch;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);




  const submitProfile = useCallback(
    async (dto: CreateInvestorProfileDto) => {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      try {
        let saved: InvestorProfile;
        const shouldCreate = !profile;

        if (shouldCreate) {
          saved = await createInvestorProfile(dto);
          setSuccessMessage('¡Perfil creado exitosamente!');
        } else {
          saved = await updateInvestorProfile(dto);
          setSuccessMessage('¡Perfil actualizado exitosamente!');
        }
        setProfile(saved);

      } catch (err: unknown) {
        if (getApiErrorStatus(err) === 409) {
          setError('El nombre público ya está en uso por otro donador. Prueba con uno diferente.');
          return;
        }
        const msg =
          getApiErrorMessage(err, '') ||
          'Error al guardar el perfil. Intenta de nuevo.';
        setError(Array.isArray(msg) ? msg.join(', ') : msg);
      } finally {
        setSaving(false);
        // Auto-limpiar mensaje de éxito
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    },
    [profile, setProfile],
  );

  const uploadAvatarPhoto = useCallback(async (file: File) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await uploadInvestorAvatar(file);
      setProfile(updated);
      setSuccessMessage('Foto de perfil actualizada exitosamente.');
    } catch {
      setError('Error al subir la foto de perfil.');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  }, [setProfile]);

  const uploadCoverPhoto = useCallback(async (file: File) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await uploadInvestorCover(file);
      setProfile(updated);
      setSuccessMessage('Foto de portada actualizada exitosamente.');
    } catch {
      setError('Error al subir la foto de portada.');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  }, [setProfile]);

  const deleteProfile = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await deleteInvestorProfile();
      setProfile(null);

      setSuccessMessage(
        'Perfil de donador eliminado. Tu cuenta sigue activa; puedes registrar un perfil nuevo cuando quieras.',
      );
    } catch (err: unknown) {
      const msg =
        getApiErrorMessage(err, '') ||
        'No se pudo eliminar el perfil. ¿Tienes donaciones registradas?';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMessage(null), 6000);
    }
  }, [setProfile]);



  return {
    profile,
    loading,
    saving,
    error: error ?? (resource.error ? 'Error al cargar el perfil. Verifica que el servidor esté activo.' : null),
    successMessage,
    isNewProfile,
    fetchProfile,
    submitProfile,
    uploadAvatarPhoto,
    uploadCoverPhoto,
    deleteProfile,
  };
}

async function loadProfile(): Promise<{profile: InvestorProfile | null}> {
  try { return {profile: await getMyInvestorProfile()}; }
  catch(error) { if (getApiErrorStatus(error) === 404) return {profile: null}; throw error; }
}
