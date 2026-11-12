/**
 * Modelo de dominio: Categoría
 */
export interface Category {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  campaignCount: number;
  createdAt: Date;
}

export function mapRowToCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    icon: row.icon,
    color: row.color,
    slug: row.slug,
    sortOrder: Number(row.sort_order),
    isActive: row.is_active,
    campaignCount: Number(row.campaign_count),
    createdAt: row.created_at,
  };
}
