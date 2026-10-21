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
  identityVerified: boolean;
  identityVerifiedAt: string | null;
  kycStatus?: string;
  kycRejectionReason?: string | null;
  verificationDocuments: unknown[];
  totalCampaigns: number;
  totalRaised: number;
  rating: number | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntrepreneurProfileDto {
  firstName: string;             // required, min 2, max 100
  lastName: string;              // required, min 2, max 100
  displayName?: string;          // max 150
  bio?: string;                  // max 2000
  companyName?: string;          // max 200
  website?: string;              // URL, max 512
  linkedinUrl?: string;          // URL, max 512
  addressLine?: string;          // max 255
  city?: string;                 // max 100
  state?: string;                // max 100
  country?: string;              // max 100
  postalCode?: string;           // max 20
  bankAccountNumber?: string;    // max 100
  bankName?: string;             // max 200
}

export type UpdateEntrepreneurProfileDto = Partial<CreateEntrepreneurProfileDto>;

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

/** Requisitos para crear campañas (API GET .../campaign-readiness). */
export interface CampaignCreationReadiness {
  canCreateCampaigns: boolean;
  missingRequirements: string[];
}
