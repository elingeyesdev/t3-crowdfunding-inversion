<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;

class Campaign extends Record
{
    protected function endDate(): Attribute
    {
        // Storage uses the application's local zone. Normalize incoming instants
        // before dropping their offset; existing stored values are read as before.
        return Attribute::make(set: fn ($value) => $value === null || $value === ''
            ? null
            : $this->fromDateTime($this->asDateTime($value)->copy()->setTimezone(config('app.timezone'))));
    }

    public const PUBLIC_STATUSES = ['published', 'funded', 'partially_funded'];

    public const HISTORICAL_STATUSES = ['completed', 'failed'];

    public const CLOSABLE_STATUSES = ['published', 'partially_funded', 'funded'];

    public function scopeAwaitingClosure(Builder $query): Builder
    {
        // end_date is stored in the application zone, without an offset.
        return $query->whereIn('status', self::CLOSABLE_STATUSES)
            ->whereNotNull('end_date')
            ->where('end_date', '<=', now()->setTimezone(config('app.timezone'))->toDateTimeString());
    }

    public const FILTER_GROUPS = [
        'drafts' => ['draft', 'rejected'],
        'review' => ['pending_review', 'in_review'],
        'approved' => ['approved'],
        'active' => ['published', 'partially_funded'],
        'funded' => ['funded'],
        'completed' => ['completed', 'failed', 'cancelled'],
        'suspended' => ['suspended'],
    ];

    public function isPubliclyReadable(): bool
    {
        if (in_array($this->status, self::PUBLIC_STATUSES, true)) {
            return true;
        }
        if (! in_array($this->status, self::HISTORICAL_STATUSES, true)) {
            return false;
        }

        // Older campaigns may have no published_at; their closure history is
        // also evidence that they were public. A closed status alone is not.
        return $this->published_at !== null || CampaignStatusHistory::where('campaign_id', $this->id)
            ->whereIn('from_status', self::PUBLIC_STATUSES)
            ->where('to_status', $this->status)
            ->exists();
    }

    public function scopePubliclyReadable(Builder $query): Builder
    {
        return $query->where(function ($visible) {
            $visible->whereIn('campaigns.status', self::PUBLIC_STATUSES)
                ->orWhere(function ($historical) {
                    $historical->whereIn('campaigns.status', self::HISTORICAL_STATUSES)
                        ->where(function ($published) {
                            $published->whereNotNull('campaigns.published_at')
                                ->orWhereExists(function ($history) {
                                    $history->selectRaw('1')->from('campaign_status_history')
                                        ->whereColumn('campaign_status_history.campaign_id', 'campaigns.id')
                                        ->whereIn('campaign_status_history.from_status', self::PUBLIC_STATUSES)
                                        ->whereColumn('campaign_status_history.to_status', 'campaigns.status');
                                });
                        });
                });
        });
    }

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

    public function financialMovements()
    {
        return $this->hasMany(CampaignFinancialMovement::class)->orderByDesc('movement_date')->orderByDesc('created_at');
    }

    public function milestones()
    {
        return $this->hasMany(CampaignMilestone::class)->orderBy('sort_order')->orderBy('target_date');
    }

    public function apiData(): array
    {
        $profile = $this->creator?->entrepreneur;

        return [...$this->attributesToArray(), 'category_name' => $this->category?->display_name, 'category_slug' => $this->category?->slug, 'category_ids' => $this->categories->modelKeys(), 'categories' => $this->categories->toArray(), 'reward_tiers' => $this->rewards->toArray(), 'funding_plan' => $this->fundingPlan->toArray(), 'milestones' => $this->milestones->toArray(), 'entrepreneur_user_id' => $this->creator_id, 'entrepreneur_name' => trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? '')), 'entrepreneur_display_name' => $profile?->display_name, 'entrepreneur_avatar' => $profile?->avatar_url, 'entrepreneur_bio' => $profile?->bio];
    }
}
