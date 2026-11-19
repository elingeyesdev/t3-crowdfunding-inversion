import type { KycDocument } from '../types/kyc.types';

export const KYC_ID_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';
export const KYC_FACE_ACCEPT = '.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov,image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';
export type KycFileKind = 'pdf' | 'image' | 'video' | 'unsupported';

const MIME_KINDS: Record<string, KycFileKind> = {
  'application/pdf': 'pdf', 'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image',
  'video/mp4': 'video', 'video/webm': 'video', 'video/quicktime': 'video',
};
const EXTENSION_KINDS: Record<string, KycFileKind> = {
  pdf: 'pdf', jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', mp4: 'video', webm: 'video', mov: 'video',
};

export function kycFileKind(url: string, mimeType?: string): KycFileKind {
  const mime = mimeType?.split(';')[0].trim().toLowerCase();
  if (mime && mime !== 'application/octet-stream') return MIME_KINDS[mime] ?? 'unsupported';
  try {
    const pathname = new URL(url, 'http://localhost').pathname.toLowerCase();
    return EXTENSION_KINDS[pathname.split('.').pop() ?? ''] ?? 'unsupported';
  } catch { return 'unsupported'; }
}

export function kycUploadError(file: File, type: KycDocument['type']): string | null {
  const kind = kycFileKind(file.name, file.type);
  const allowed = type === 'idDocument' ? ['pdf', 'image'] : ['image', 'video'];
  const maxMb = type === 'idDocument' ? 10 : 50;
  if (!allowed.includes(kind) || file.size > maxMb * 1024 * 1024) {
    return type === 'idDocument'
      ? 'El documento debe ser PDF, JPG, PNG o WEBP y no superar los 10 MB.'
      : 'La validación facial debe ser JPG, PNG, WEBP, MP4, WEBM o MOV y no superar los 50 MB.';
  }
  return null;
}

export function parseKycDocuments(value: unknown): KycDocument[] {
  try {
    const documents = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(documents)) return [];
    return documents.flatMap((doc): KycDocument[] => {
      if (!doc || typeof doc !== 'object' || !['idDocument', 'faceValidation'].includes(doc.type) || typeof doc.url !== 'string') return [];
      return [{ type: doc.type, url: doc.url,
        ...(typeof doc.mimeType === 'string' ? { mimeType: doc.mimeType } : {}),
        ...(typeof doc.originalName === 'string' ? { originalName: doc.originalName } : {}),
      }];
    });
  } catch { return []; }
}

export function privateKycUrl(value: string, base: string): URL | null {
  try {
    const url = new URL(value, base);
    if (url.origin !== new URL(base).origin || !['http:', 'https:'].includes(url.protocol)
      || !/^\/api\/v1\/private-files\/kyc\/[a-zA-Z0-9._-]+$/.test(url.pathname) || url.pathname.includes('..')
      || !/^\d+$/.test(url.searchParams.get('expires') ?? '') || !url.searchParams.get('signature')) return null;
    return url;
  } catch { return null; }
}
