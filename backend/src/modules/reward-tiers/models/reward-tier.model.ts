export interface RewardTier {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  amount?: number;
  minPercentage: number;
  maxPercentage: number;
  currency: string;
  maxClaims: number | null;
  currentClaims: number;
  estimatedDelivery: Date | null;
  includesShipping: boolean;
  shippingDetails: string | null;
  imageUrl: string | null;
  expiresAt: Date | null;
  items: any[];
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function mapRowToRewardTier(row: any): RewardTier {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    amount: row.amount ? Number(row.amount) : undefined,
    minPercentage: Number(row.min_percentage) || 0,
    maxPercentage: Number(row.max_percentage) || 100,
    currency: row.currency,
    maxClaims: row.max_claims !== null ? Number(row.max_claims) : null,
    currentClaims: Number(row.current_claims),
    estimatedDelivery: row.estimated_delivery ? new Date(row.estimated_delivery) : null,
    includesShipping: row.includes_shipping,
    shippingDetails: row.shipping_details,
    imageUrl: row.image_url,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    items: Array.isArray(row.items) ? row.items : [],
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
