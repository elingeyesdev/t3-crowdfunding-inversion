import { useAsyncResource } from './useAsyncResource.ts';
import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  getAllMyCampaigns,
  createCampaign,
  updateCampaign as updateCampaignApi,
  submitCampaignForReview,
  publishCampaign as publishCampaignApi,
  uploadCampaignImage as uploadCampaignImageApi,
  deleteCampaign as deleteCampaignApi,
  finalizeCampaign as finalizeCampaignApi,
  uploadCampaignDocument as uploadCampaignDocumentApi,
} from '../api/campaign.api';
import type {
  EntrepreneurCampaign,
  CreateCampaignDto,
  QueryCampaignsDto,
} from '../types/campaign.types';
import { getApiErrorMessage } from '../utils/apiError';

const DEFAULT_QUERY: QueryCampaignsDto = {
    page: 1,
    limit: 12,
    sortBy: 'created_at',
    sortOrder: 'DESC',
    filterPreset: 'all',
};

export function useCampaigns() {
    const [query, setQuery] = useState<QueryCampaignsDto>(DEFAULT_QUERY);
    const [error, setError] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const saveInFlight = useRef(false);
    const clearSaveError = useCallback(() => setAddError(null), []);
    const [actionCampaignId, setActionCampaignId] = useState<string | null>(null);

    // Token que fuerza un re-fetch incluso cuando el query no cambia

    const queryRef = useRef(query);
    useEffect(() => {
        queryRef.current = query;
    }, [query]);
    const load = useCallback(() => getAllMyCampaigns(query), [query]);
    const resource = useAsyncResource(load);
    const campaigns = resource.data?.data ?? [];
    const meta = resource.data?.meta ?? null;
    const loading = resource.loading;
    const setCampaigns = (
        update:
            | EntrepreneurCampaign[]
            | ((previous: EntrepreneurCampaign[]) => EntrepreneurCampaign[]),
    ) =>
        resource.setData((previous) => ({
            data: typeof update === 'function' ? update(previous?.data ?? []) : update,
            meta: previous?.meta ?? {
                totalItems: 0,
                itemCount: 0,
                itemsPerPage: query.limit ?? 12,
                totalPages: 1,
                currentPage: query.page ?? 1,
            },
        }));
    const setMeta = (next: NonNullable<typeof meta>) =>
        resource.setData((previous) => ({ data: previous?.data ?? [], meta: next }));
    const updateQuery = useCallback((patch: Partial<QueryCampaignsDto>) => {
        setQuery((prev) => {
            const next: QueryCampaignsDto = { ...prev, ...patch };
            if (patch.filterPreset !== undefined) {
                delete next.status;
            }
            if (patch.status !== undefined) {
                delete next.filterPreset;
            }
            return next;
        });
    }, []);

    const fetchCampaigns = resource.retry;

    const addCampaign = async (
        dto: CreateCampaignDto,
        coverFile?: File,
        documents?: { file: File; justification: string }[],
    ): Promise<string | null> => {
        if (saveInFlight.current) return null;
        saveInFlight.current = true;
        try {
            setAdding(true);
            setAddError(null);
            const campaign = await createCampaign(dto);

            if (coverFile) {
                try {
                    await uploadCampaignImageApi(campaign.id, coverFile);
                } catch (uploadErr) {
                    console.error('Error uploading campaign cover after creation:', uploadErr);
                }
            }

            if (documents && documents.length > 0) {
                for (const doc of documents) {
                    try {
                        await uploadCampaignDocumentApi(campaign.id, doc.file, doc.justification);
                    } catch (docErr) {
                        console.error('Error uploading campaign document:', docErr);
                    }
                }
            }

            setQuery({ ...DEFAULT_QUERY });
            resource.retry();
            return campaign.id;
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                console.error('Error creating campaign response:', err.response?.data);
            } else {
                console.error('Error creating campaign:', err);
            }
            setAddError(getApiErrorMessage(err, 'Error al crear la campaña'));
            return null;
        } finally {
            saveInFlight.current = false;
            setAdding(false);
        }
    };

    const updateCampaign = async (
        campaignId: string,
        dto: Partial<CreateCampaignDto>,
        coverFile?: File,
        documents?: { file: File; justification: string }[],
    ): Promise<boolean> => {
        if (saveInFlight.current) return false;
        saveInFlight.current = true;
        try {
            setAdding(true);
            setAddError(null);
            await updateCampaignApi(campaignId, dto);

            if (coverFile) {
                await uploadCampaignImageApi(campaignId, coverFile);
            }

            if (documents && documents.length > 0) {
                for (const doc of documents) {
                    try {
                        await uploadCampaignDocumentApi(campaignId, doc.file, doc.justification);
                    } catch (docErr) {
                        console.error('Error uploading campaign document:', docErr);
                    }
                }
            }

            // Actualizar lista local
            const paginated = await getAllMyCampaigns(queryRef.current);
            setCampaigns(paginated.data);
            return true;
        } catch (err: unknown) {
            console.error('Error updating campaign:', err);
            setAddError(getApiErrorMessage(err, 'Error al actualizar la campaña'));
            return false;
        } finally {
            saveInFlight.current = false;
            setAdding(false);
        }
    };

    const submitForReview = async (campaignId: string): Promise<boolean> => {
        try {
            setError(null);
            setActionCampaignId(campaignId);
            await submitCampaignForReview(campaignId);
            const paginated = await getAllMyCampaigns(queryRef.current);
            setCampaigns(paginated.data);
            setMeta(paginated.meta);
            return true;
        } catch (err: unknown) {
            console.error(err);
            setError(getApiErrorMessage(err, 'No se pudo enviar a revisión'));
            return false;
        } finally {
            setActionCampaignId(null);
        }
    };

    const publishCampaign = async (campaignId: string): Promise<boolean> => {
        try {
            setError(null);
            setActionCampaignId(campaignId);
            await publishCampaignApi(campaignId);
            const paginated = await getAllMyCampaigns(queryRef.current);
            setCampaigns(paginated.data);
            setMeta(paginated.meta);
            return true;
        } catch (err: unknown) {
            console.error(err);
            setError(getApiErrorMessage(err, 'No se pudo publicar'));
            return false;
        } finally {
            setActionCampaignId(null);
        }
    };

    const uploadCampaignImage = async (campaignId: string, file: File): Promise<boolean> => {
        try {
            setError(null);
            setActionCampaignId(campaignId);
            await uploadCampaignImageApi(campaignId, file);
            // Actualizar la lista local
            const paginated = await getAllMyCampaigns(queryRef.current);
            setCampaigns(paginated.data);
            setMeta(paginated.meta);
            return true;
        } catch (err: unknown) {
            console.error(err);
            setError(getApiErrorMessage(err, 'Error al subir la imagen'));
            return false;
        } finally {
            setActionCampaignId(null);
        }
    };

    const deleteCampaign = async (campaignId: string): Promise<boolean> => {
        try {
            setError(null);
            setActionCampaignId(campaignId);
            await deleteCampaignApi(campaignId);
            setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
            return true;
        } catch (err: unknown) {
            console.error(err);
            setError(getApiErrorMessage(err, 'No se pudo eliminar la campaña'));
            return false;
        } finally {
            setActionCampaignId(null);
        }
    };

    const finalizeCampaign = async (campaignId: string): Promise<boolean> => {
        try {
            setError(null);
            setActionCampaignId(campaignId);
            await finalizeCampaignApi(campaignId);
            const paginated = await getAllMyCampaigns(queryRef.current);
            setCampaigns(paginated.data);
            return true;
        } catch (err: unknown) {
            console.error(err);
            setError(getApiErrorMessage(err, 'No se pudo finalizar la campaña'));
            return false;
        } finally {
            setActionCampaignId(null);
        }
    };

    return {
        campaigns,
        meta,
        query,
        updateQuery,
        loading,
        error:
            error ??
            (resource.error
                ? getApiErrorMessage(resource.error, 'Error al obtener campañas')
                : null),
        setError,
        adding,
        addError,
        clearSaveError,
        fetchCampaigns,
        addCampaign,
        updateCampaign,
        submitForReview,
        publishCampaign,
        uploadCampaignImage,
        deleteCampaign,
        finalizeCampaign,
        actionCampaignId,
    };
}
