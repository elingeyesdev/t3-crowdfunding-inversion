export interface DashboardStats {
  totalUsers: number;
  totalCampaigns: number;
  totalFunded: number;
}

export interface SystemUser {
  id: string;
  email: string;
  created_at: string;
  is_active: boolean;
}

export interface SystemCampaign {
  id: string;
  title: string;
  status: string;
  goal_amount: string;
  current_amount: string;
  created_at: string;
  creator_email: string;
  creator_name: string;
}

export interface AdminUser {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  access_level: string;
  is_active: boolean;
  email: string;
}

export interface RewardTier {
  title: string;
  min_percentage: number;
  max_percentage: number;
  description: string;
  delivery_date: string;
}

export interface PendingCampaign {
  id: string;
  title: string;
  type: 'reward' | 'donation';
  entrepreneur_name: string;
  category_name: string;
  goal_amount: string;
  created_at: string;
  audit_score?: number;
}

export interface PendingCampaignDetail {
  id: string;
  title: string;
  slug: string;
  status: string;
  type: 'reward' | 'donation';
  cover_image_url?: string;
  main_image_url?: string;
  short_description: string;
  audit_score?: number;
  description: string;
  reward_tiers?: RewardTier[];
  goal_amount: string;
  current_amount: number;
  investor_count: number;
  currency: string;
  start_date: string;
  end_date: string;
  location?: string;
  category_name: string;
  entrepreneur_first_name: string;
  entrepreneur_last_name: string;
  entrepreneur_email: string;
  entrepreneur_bio?: string;
  entrepreneur_avatar?: string;
  entrepreneur_linkedin?: string;
  entrepreneur_website?: string;
  media?: any[];
  min_investment?: number;
  max_investment?: number;
  subtitle?: string;
  risks_and_challenges?: string;
  video_url?: string;
  tags?: string[];
  social_links?: Record<string, string>;
}

export interface CampaignHistoryItem {
  id: string;
  from_status: string | null;
  to_status: string;
  feedback: string | null;
  created_at: string;
  changed_by_email: string;
  changed_by_name: string;
}
