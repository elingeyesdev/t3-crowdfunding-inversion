import type { PaginatedResponse } from '../types/campaign.types';

// These feeds filter and count locally, so they need the complete result set.
export async function collectCampaignPages<T>(
  fetchPage: (page: number) => Promise<PaginatedResponse<T>>,
): Promise<PaginatedResponse<T>> {
  const first = await fetchPage(1);
  const data = [...first.data];
  for (let page = 2; page <= first.meta.totalPages; page++) {
    const next = await fetchPage(page);
    data.push(...next.data);
  }
  return {
    data,
    meta: { ...first.meta, itemCount: data.length, itemsPerPage: data.length, currentPage: 1, totalPages: data.length ? 1 : 0 },
  };
}
