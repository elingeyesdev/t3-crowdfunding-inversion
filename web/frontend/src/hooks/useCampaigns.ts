import { useAsyncResource } from './useAsyncResource.ts';
import { useState, useCallback, useEffect, useRef } from 'react';
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
import { CampaignUploadSession } from '../utils/campaignUploads.ts';
import type { CampaignDocumentUpload, CampaignUploadProgress } from '../utils/campaignUploads.ts';

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
    const uploadSession = useRef<{ key: string; session: CampaignUploadSession } | null>(null);
    const saveMounted = useRef(false);
    const [saveProgress, setSaveProgress] = useState<CampaignUploadProgress | null>(null);
    const resetSaveState = useCallback(() => {
        if (saveInFlight.current) return;
        uploadSession.current = null;
        setSaveProgress(null);
        setAddError(null);
    }, []);
    useEffect(() => {
        saveMounted.current = true;
        return () => {
            saveMounted.current = false;
            uploadSession.current?.session.cancel();
        };
    }, []);
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

    const saveCampaign = async (
        campaignId: string | null,
        dto: Partial<CreateCampaignDto>,
        coverFile?: File,
        documents?: CampaignDocumentUpload[],
    ): Promise<string | null> => {
        if (saveInFlight.current) return null;
        saveInFlight.current = true;
        setAdding(true);
        setAddError(null);
        try {
            const key = campaignId ? 'edit:' + campaignId : 'create';
            let current = uploadSession.current;
            if (current && current.key !== key) {
                throw new Error('Cierra el editor anterior antes de guardar otra campaña.');
            }
            if (!current) {
                const saved = campaignId
                    ? await updateCampaignApi(campaignId, dto)
                    : await createCampaign(dto as CreateCampaignDto);
                if (!saveMounted.current) return null;
                current = { key, session: new CampaignUploadSession(saved.id, coverFile, documents) };
                uploadSession.current = current;
                setSaveProgress(current.session.progress);
            }
            await current.session.upload(
                { cover: uploadCampaignImageApi, document: uploadCampaignDocumentApi },
                progress => {
                    if (saveMounted.current) setSaveProgress(progress);
                },
            );
            if (!saveMounted.current) return null;
            // A list refresh is not another write and must not turn a saved record into a failure.
            if (!campaignId) {
                setQuery({ ...DEFAULT_QUERY });
                resource.retry();
            } else {
                await resource.refetch();
            }
            return current.session.progress.complete ? current.session.campaignId : null;
        } catch (failure) {
            if (saveMounted.current) {
                setAddError(getApiErrorMessage(failure, 'No se pudo guardar la campaña. Intenta nuevamente.'));
            }
            return null;
        } finally {
            saveInFlight.current = false;
            if (saveMounted.current) setAdding(false);
        }
    };

    const addCampaign = (dto: CreateCampaignDto, coverFile?: File, documents?: CampaignDocumentUpload[]) =>
        saveCampaign(null, dto, coverFile, documents);

    const updateCampaign = async (campaignId: string, dto: Partial<CreateCampaignDto>, coverFile?: File, documents?: CampaignDocumentUpload[]) =>
        (await saveCampaign(campaignId, dto, coverFile, documents)) !== null;

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
        resetSaveState,
        saveProgress,
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
