import axios from 'axios';
import type {
  ApiSuccessResponse,
  CapitalOverview,
  CreateInvestorProfileDto,
  InvestorProfile,
  LoginDto,
  LoginResponse,
  UpdateInvestorProfileDto,
} from '../types/investor.types';

// Base URL usa el proxy de Vite en dev, sin CORS
const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Inyectar token JWT en cada petición si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================================
// AUTH
// ============================================================

export async function login(dto: LoginDto): Promise<LoginResponse> {
  const { data } = await api.post<ApiSuccessResponse<LoginResponse>>('/auth/login', dto);
  return data.data;
}

// ============================================================
// INVESTOR PROFILE
// ============================================================

export async function getMyInvestorProfile(): Promise<InvestorProfile> {
  const { data } = await api.get<ApiSuccessResponse<InvestorProfile>>(
    '/investors/me/profile',
  );
  return data.data;
}

export async function createInvestorProfile(
  dto: CreateInvestorProfileDto,
): Promise<InvestorProfile> {
  const { data } = await api.post<ApiSuccessResponse<InvestorProfile>>(
    '/investors/me/profile',
    dto,
  );
  return data.data;
}

export async function updateInvestorProfile(
  dto: UpdateInvestorProfileDto,
): Promise<InvestorProfile> {
  const { data } = await api.put<ApiSuccessResponse<InvestorProfile>>(
    '/investors/me/profile',
    dto,
  );
  return data.data;
}

export async function deleteInvestorProfile(): Promise<void> {
  await api.delete<ApiSuccessResponse<null>>('/investors/me/profile');
}

export async function getCapitalOverview(): Promise<CapitalOverview> {
  const { data } = await api.get<ApiSuccessResponse<CapitalOverview>>(
    '/investors/me/capital',
  );
  return data.data;
}

export async function uploadInvestorAvatar(file: File): Promise<InvestorProfile> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ApiSuccessResponse<InvestorProfile>>(
    '/investors/me/profile/avatar',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export async function uploadInvestorCover(file: File): Promise<InvestorProfile> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ApiSuccessResponse<InvestorProfile>>(
    '/investors/me/profile/cover',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

// ============================================================
// INVESTMENTS
// ============================================================

export interface CreateInvestmentDto {
  campaignId: string;
  amount: number;
  rewardTierId?: string;
}

export async function createInvestment(dto: CreateInvestmentDto): Promise<any> {
  const { data } = await api.post<ApiSuccessResponse<any>>(
    '/investments',
    dto,
  );
  return data.data;
}

export interface InvestmentHistoryItem {
  id: string;
  amount: number;
  investmentStatus: string;
  createdAt: string;
  campaignId: string;
  campaignTitle: string;
  campaignType: string;
  campaignGoal: number;
  campaignCoverImage: string | null;
  campaignStatus: string;
  rewardTitle: string | null;
}

export async function getMyInvestments(): Promise<InvestmentHistoryItem[]> {
  const { data } = await api.get<ApiSuccessResponse<InvestmentHistoryItem[]>>(
    '/investments/me',
  );
  return data.data;
}

export async function downloadInvestmentReceipt(id: string): Promise<void> {
  const response = await api.get(`/investments/${id}/receipt`, {
    responseType: 'blob',
  });
  
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `recibo_inversion_${id}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ============================================================
// CAPITAL — Aumentar
// ============================================================

export interface AddCapitalResponse {
  newMax: number;
  availableCapital: number;
}

export async function addCapital(amount: number, notes?: string): Promise<AddCapitalResponse> {
  const { data } = await api.post<ApiSuccessResponse<AddCapitalResponse>>(
    '/investors/me/capital/add',
    { amount, notes },
  );
  return data.data;
}


