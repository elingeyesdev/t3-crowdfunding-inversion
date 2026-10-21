import axios from 'axios';
import type { Category } from '../types/category.types';
import type { ApiSuccessResponse } from '../types/investor.types';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

/**
 * GET /categories
 * Endpoint público — no requiere JWT.
 */
export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get<ApiSuccessResponse<Category[]>>('/categories');
  return data.data;
}
