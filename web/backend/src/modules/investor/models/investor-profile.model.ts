/**
 * Modelo de dominio: Perfil de Inversor
 * Representa la entidad tal como se almacena en BD.
 */
export interface InvestorProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  bio: string | null;
  investorType: 'individual' | 'institutional' | 'angel';
  accredited: boolean;
  taxId: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  preferredCategories: string[];
  minInvestment: number | null;
  maxInvestment: number | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  identityVerified: boolean;
  identityVerifiedAt: Date | null;
  verificationDocuments: any[];
  totalInvestments: number;
  totalInvested: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mapea un row de PostgreSQL al modelo de dominio.
 * Centraliza la transformación snake_case → camelCase.
 */
export function mapRowToInvestorProfile(row: any): InvestorProfile {
  return {
    id: row.id,
    userId: row.user_id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    bio: row.bio,
    investorType: row.investor_type,
    accredited: row.accredited,
    taxId: row.tax_id,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    country: row.country,
    postalCode: row.postal_code,
    preferredCategories: row.preferred_categories ?? [],
    minInvestment: row.min_investment ? Number(row.min_investment) : null,
    maxInvestment: row.max_investment ? Number(row.max_investment) : null,
    avatarUrl: row.avatar_url ?? null,
    coverUrl: row.cover_url ?? null,
    identityVerified: row.identity_verified,
    identityVerifiedAt: row.identity_verified_at,
    verificationDocuments: row.verification_documents ?? [],
    totalInvestments: Number(row.total_investments),
    totalInvested: Number(row.total_invested),
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
