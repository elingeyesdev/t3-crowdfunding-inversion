// ============================================================
// Tipos que reflejan exactamente los modelos del backend
// ============================================================

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
  identityVerified: boolean;
  totalInvestments: number;
  totalInvested: number;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CapitalOverview {
  totalInvestments: number;
  totalInvested: number;
  maxInvestmentLimit: number | null;
  availableCapital: number | null;
  pendingAmount: number;
  completedInvestments: number;
}

export interface CreateInvestorProfileDto {
  firstName: string;
  lastName: string;
  displayName?: string;
  bio?: string;
  investorType?: 'individual' | 'institutional' | 'angel';
  taxId?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  minInvestment?: number;
  maxInvestment?: number;
}

export type UpdateInvestorProfileDto = Partial<CreateInvestorProfileDto>;

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType?: string;
  expiresIn?: string;
  user: {
    id: string;
    email: string;
    roles?: string[];
    adminAccessLevel?: string;
  };
}
