import axios from 'axios';
import type {
  ApiSuccessResponse,
  CampaignCreationReadiness,
  CreateEntrepreneurProfileDto,
  EntrepreneurProfile,
  UpdateEntrepreneurProfileDto,
} from '../types/entrepreneur.types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function getMyEntrepreneurProfile(): Promise<EntrepreneurProfile> {
  const { data } = await api.get<ApiSuccessResponse<EntrepreneurProfile>>(
    '/entrepreneurs/me/profile',
  );
  return data.data;
}

export async function getCampaignCreationReadiness(): Promise<CampaignCreationReadiness> {
  const { data } = await api.get<ApiSuccessResponse<CampaignCreationReadiness>>(
    '/entrepreneurs/me/profile/campaign-readiness',
  );
  return data.data;
}

export async function createEntrepreneurProfile(
  dto: CreateEntrepreneurProfileDto,
): Promise<EntrepreneurProfile> {
  const { data } = await api.post<ApiSuccessResponse<EntrepreneurProfile>>(
    '/entrepreneurs/me/profile',
    dto,
  );
  return data.data;
}
export async function updateEntrepreneurProfile(
  dto: UpdateEntrepreneurProfileDto,
): Promise<EntrepreneurProfile> {
  const { data } = await api.put<ApiSuccessResponse<EntrepreneurProfile>>(
    '/entrepreneurs/me/profile',
    dto,
  );
  return data.data;
}

export async function deleteEntrepreneurProfile(): Promise<void> {
  await api.delete<ApiSuccessResponse<null>>('/entrepreneurs/me/profile');
}

export async function uploadAvatar(file: File): Promise<EntrepreneurProfile> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ApiSuccessResponse<EntrepreneurProfile>>(
    '/entrepreneurs/me/profile/avatar',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export async function uploadCover(file: File): Promise<EntrepreneurProfile> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ApiSuccessResponse<EntrepreneurProfile>>(
    '/entrepreneurs/me/profile/cover',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export async function submitKycDocuments(idDocument: File, faceVideo: File): Promise<EntrepreneurProfile> {
  const formData = new FormData();
  formData.append('idDocument', idDocument);
  formData.append('faceVideo', faceVideo);
  
  const { data } = await api.post<ApiSuccessResponse<EntrepreneurProfile>>(
    '/entrepreneurs/me/kyc',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data.data;
}
