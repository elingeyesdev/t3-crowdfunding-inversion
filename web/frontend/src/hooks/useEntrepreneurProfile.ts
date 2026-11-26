import { useAsyncResource } from './useAsyncResource.ts';
import { getApiErrorMessage, getApiErrorStatus } from '../utils/apiError.ts';
import { useState, useCallback } from 'react';
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
    const resource = useAsyncResource(loadProfile);
    const { setData } = resource;
    const profile = resource.data?.profile ?? null;
    const setProfile = useCallback(
        (profile: EntrepreneurProfile | null) => setData({ profile }),
        [setData],
    );
    const loading = resource.loading;
    const isNewProfile = !loading && !resource.error && !profile;
    const fetchProfile = resource.refetch;

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
            } catch (err: unknown) {
                if (getApiErrorStatus(err) === 409) {
                    setError(
                        'El nombre público ya está en uso por otro emprendedor. Prueba con uno diferente.',
                    );
                    return;
                }

                const msg =
                    getApiErrorMessage(err, '') || 'Error al guardar el perfil. Intenta de nuevo.';

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
        [profile, setProfile],
    );

    const uploadAvatarPhoto = useCallback(
        async (file: File) => {
            setSaving(true);
            setError(null);
            try {
                const updated = await uploadAvatar(file);
                setProfile(updated);
                setSuccessMessage('Foto de perfil actualizada exitosamente.');
            } catch {
                setError('Error al subir la foto de perfil.');
            } finally {
                setSaving(false);
                setTimeout(() => setSuccessMessage(null), 4000);
            }
        },
        [setProfile],
    );

    const uploadCoverPhoto = useCallback(
        async (file: File) => {
            setSaving(true);
            setError(null);
            try {
                const updated = await uploadCover(file);
                setProfile(updated);
                setSuccessMessage('Foto de portada actualizada exitosamente.');
            } catch {
                setError('Error al subir la foto de portada.');
            } finally {
                setSaving(false);
                setTimeout(() => setSuccessMessage(null), 4000);
            }
        },
        [setProfile],
    );

    const deleteProfile = useCallback(async () => {
        setSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            await deleteEntrepreneurProfile();
            setProfile(null);

            setSuccessMessage(
                'Perfil de emprendedor eliminado. Tu cuenta sigue activa; puedes crear un perfil nuevo cuando quieras.',
            );
        } catch (err: unknown) {
            const msg =
                getApiErrorMessage(err, '') ||
                'No se pudo eliminar el perfil. ¿Tienes campañas registradas?';
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
        error:
            error ??
            (resource.error
                ? 'Error al cargar el perfil. Verifica que el servidor esté activo.'
                : null),
        successMessage,
        isNewProfile,
        fetchProfile,
        submitProfile,
        uploadAvatarPhoto,
        uploadCoverPhoto,
        deleteProfile,
    };
}

async function loadProfile(): Promise<{ profile: EntrepreneurProfile | null }> {
    try {
        return { profile: await getMyEntrepreneurProfile() };
    } catch (error) {
        if (getApiErrorStatus(error) === 404) return { profile: null };
        throw error;
    }
}
