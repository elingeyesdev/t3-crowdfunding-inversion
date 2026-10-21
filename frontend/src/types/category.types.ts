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
  createdAt: string;
}
