import { getApiErrorMessage } from './apiError.ts';

export interface CampaignDocumentUpload {
  file: File;
  justification: string;
}
export interface CampaignUploadProgress {
  campaignId: string;
  complete: boolean;
  files: {
    id: string;
    name: string;
    kind: 'cover' | 'document';
    status: 'pending' | 'uploading' | 'uploaded' | 'failed';
    error: string | null;
  }[];
}
interface UploadApi {
  cover: (id: string, file: File, signal: AbortSignal) => Promise<unknown>;
  document: (
    id: string,
    file: File,
    justification: string,
    uploadId: string,
    signal: AbortSignal,
  ) => Promise<unknown>;
}
function uploadId(): string {
  // getRandomValues also works on local HTTP deployments without randomUUID.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** One mounted editor owns one saved campaign and stable upload identities. */
export class CampaignUploadSession {
  readonly campaignId: string;
  private controller = new AbortController();
  private files: (CampaignUploadProgress['files'][number] &
    CampaignDocumentUpload)[];

  constructor(
    campaignId: string,
    cover: File | undefined,
    documents: CampaignDocumentUpload[] = [],
  ) {
    this.campaignId = campaignId;
    this.files = [
      ...(cover
        ? [
            {
              id: uploadId(),
              name: cover.name,
              kind: 'cover' as const,
              file: cover,
              justification: '',
              status: 'pending' as const,
              error: null,
            },
          ]
        : []),
      ...documents.map((document) => ({
        ...document,
        id: uploadId(),
        name: document.file.name,
        kind: 'document' as const,
        status: 'pending' as const,
        error: null,
      })),
    ];
  }

  get progress(): CampaignUploadProgress {
    return {
      campaignId: this.campaignId,
      complete: this.files.every((file) => file.status === 'uploaded'),
      files: this.files.map(({ id, name, kind, status, error }) => ({
        id,
        name,
        kind,
        status,
        error,
      })),
    };
  }

  cancel(): void {
    this.controller.abort();
  }

  async upload(
    api: UploadApi,
    onProgress: (progress: CampaignUploadProgress) => void,
  ): Promise<void> {
    for (const entry of this.files) {
      if (this.controller.signal.aborted) return;
      if (entry.status === 'uploaded') continue;
      entry.status = 'uploading';
      entry.error = null;
      onProgress(this.progress);
      try {
        if (entry.kind === 'cover')
          await api.cover(this.campaignId, entry.file, this.controller.signal);
        else
          await api.document(
            this.campaignId,
            entry.file,
            entry.justification,
            entry.id,
            this.controller.signal,
          );
        entry.status = 'uploaded';
      } catch (error) {
        entry.status = 'failed';
        entry.error = getApiErrorMessage(
          error,
          'No se pudo subir este archivo. Intenta nuevamente.',
        );
      }
      if (!this.controller.signal.aborted) onProgress(this.progress);
    }
  }
}
