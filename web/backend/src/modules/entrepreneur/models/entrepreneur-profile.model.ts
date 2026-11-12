/**
 * Modelo de dominio: Perfil de Emprendedor
 * Representa la entidad tal como se almacena en BD.
 */
export interface EntrepreneurProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  bio: string | null;
  companyName: string | null;
  website: string | null;
  linkedinUrl: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  identityVerified: boolean;
  identityVerifiedAt: Date | null;
  kycStatus: string;
  kycRejectionReason: string | null;
  verificationDocuments: any[];
  totalCampaigns: number;
  totalRaised: number;
  rating: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mapea un row de PostgreSQL al modelo de dominio.
 * Centraliza la transformación snake_case → camelCase.
 */
export function mapRowToEntrepreneurProfile(row: any): EntrepreneurProfile {
  return {
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    bio: row.bio,
    companyName: row.company_name,
    website: row.website,
    linkedinUrl: row.linkedin_url,
    addressLine: row.address_line,
    city: row.city,
    state: row.state,
    country: row.country,
    postalCode: row.postal_code,
    bankAccountNumber: row.bank_account_number,
    bankName: row.bank_name,
    avatarUrl: row.avatar_url,
    coverUrl: row.cover_url,
    identityVerified: row.identity_verified,
    identityVerifiedAt: row.identity_verified_at,
    kycStatus: row.kyc_status,
    kycRejectionReason: row.kyc_rejection_reason || null,
    verificationDocuments: row.verification_documents ?? [],
    totalCampaigns: Number(row.total_campaigns),
    totalRaised: Number(row.total_raised),
    rating: row.rating ? Number(row.rating) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
