export interface CampaignAttachment {
    type: 'image' | 'video' | 'text';
    url?: string;
    text?: string;
}

export interface CampaignUpdate {
    id: string;
    campaignId: string;
    title: string;
    content: string;
    attachments?: CampaignAttachment[];
    createdAt: string;
    updatedAt?: string;
}

export interface BudgetCategory {
    category: string;
    percentage: number;
    description: string;
}

export interface FundingMilestone {
    id?: string;
    title?: string;
    description?: string;
    percentage?: number;
    deliverables?: string[];
}

export interface CampaignMetadata {
    budget_plan?: BudgetCategory[];
    use_of_funds?: BudgetCategory[];
    milestones?: FundingMilestone[];
}
