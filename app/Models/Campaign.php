<?php

namespace App\Models;

class Campaign extends Record
{
    public const PUBLIC_STATUSES = ['published', 'funded', 'partially_funded'];

    protected function casts(): array
    {
        return ['goal_amount' => 'float', 'current_amount' => 'float', 'min_investment' => 'float', 'max_investment' => 'float', 'is_featured' => 'boolean', 'metadata' => 'array', 'tags' => 'array', 'faq' => 'array', 'social_links' => 'array', 'start_date' => 'datetime', 'end_date' => 'datetime', 'funded_at' => 'datetime', 'published_at' => 'datetime'];
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function categories()
    {
        return $this->belongsToMany(Category::class, 'campaign_categories');
    }

    public function rewards()
    {
        return $this->hasMany(RewardTier::class)->orderBy('sort_order');
    }

    public function investments()
    {
        return $this->hasMany(Investment::class);
    }

    public function updates()
    {
        return $this->hasMany(CampaignUpdate::class);
    }

    public function documents()
    {
        return $this->hasMany(CampaignDocument::class);
    }

    public function fundingPlan()
    {
        return $this->hasMany(CampaignFundingPlan::class)->orderBy('sort_order');
    }

    public function apiData(): array
    {
        $profile = $this->creator?->entrepreneur;

        return [...$this->attributesToArray(), 'category_name' => $this->category?->display_name, 'category_slug' => $this->category?->slug, 'category_ids' => $this->categories->modelKeys(), 'categories' => $this->categories->toArray(), 'reward_tiers' => $this->rewards->toArray(), 'funding_plan' => $this->fundingPlan->toArray(), 'entrepreneur_user_id' => $this->creator_id, 'entrepreneur_name' => trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? '')), 'entrepreneur_display_name' => $profile?->display_name, 'entrepreneur_avatar' => $profile?->avatar_url, 'entrepreneur_bio' => $profile?->bio];
    }
}
