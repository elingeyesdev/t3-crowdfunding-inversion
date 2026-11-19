export interface KycDocument {
  type: 'idDocument' | 'faceValidation';
  url: string;
  mimeType?: string;
  originalName?: string;
}

export interface KycReviewData {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  company_name?: string | null;
  updated_at: string;
  verification_documents: unknown;
}
