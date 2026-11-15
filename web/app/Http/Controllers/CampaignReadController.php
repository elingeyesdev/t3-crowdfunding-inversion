<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\CampaignMilestone;
use App\Models\CampaignUpdate;
use App\Services\CampaignFinance;
use App\Support\Api;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class CampaignReadController extends Controller
{
    private function authorizePublic(Campaign $campaign): void
    {
        abort_unless(in_array($campaign->status, Campaign::PUBLIC_STATUSES, true), 404);
    }

    public function publicFundingPlan(Campaign $campaign)
    {
        $this->authorizePublic($campaign);

        return Api::ok($campaign->fundingPlan()->get(['id', 'campaign_id', 'category', 'description', 'amount', 'percentage', 'sort_order', 'created_at', 'updated_at']));
    }

    public function fundingPlan(Request $request, Campaign $campaign)
    {
        CampaignController::authorizeOwner($request, $campaign, true);

        return Api::ok($campaign->fundingPlan);
    }

    public function publicFinancialLedger(Campaign $campaign, CampaignFinance $finance)
    {
        $this->authorizePublic($campaign);

        return Api::ok($finance->ledger($campaign, public: true));
    }

    public function financialLedger(Request $request, Campaign $campaign, CampaignFinance $finance)
    {
        CampaignController::authorizeOwner($request, $campaign, true);

        return Api::ok($finance->ledger($campaign));
    }

    public function publicMilestones(Campaign $campaign)
    {
        $this->authorizePublic($campaign);

        return Api::ok($this->milestonesQuery($campaign, true)->get()->map(fn ($milestone) => $this->publicMilestoneData($milestone, true)));
    }

    public function milestones(Request $request, Campaign $campaign)
    {
        CampaignController::authorizeOwner($request, $campaign, true);

        return Api::ok($this->milestonesQuery($campaign, false)->get());
    }

    public function publicMilestone(Campaign $campaign, string $milestone)
    {
        $this->authorizePublic($campaign);

        return Api::ok($this->publicMilestoneData($this->milestonesQuery($campaign, true)->findOrFail($milestone), true));
    }

    public function milestone(Request $request, Campaign $campaign, string $milestone)
    {
        CampaignController::authorizeOwner($request, $campaign, true);

        return Api::ok($this->milestonesQuery($campaign, false)->findOrFail($milestone));
    }

    public function publicUpdates(Campaign $campaign)
    {
        $this->authorizePublic($campaign);

        return Api::ok($this->updatesQuery($campaign, true)->get()->map(fn ($update) => $this->publicUpdateData($update, true)));
    }

    public function updates(Request $request, Campaign $campaign)
    {
        CampaignController::authorizeOwner($request, $campaign, true);

        return Api::ok($this->updatesQuery($campaign, false)->get());
    }

    private function milestonesQuery(Campaign $campaign, bool $public): HasMany
    {
        return $campaign->milestones()->with(['updates' => function ($query) use ($campaign, $public): void {
            // Ignore malformed historical links to another campaign's updates.
            $query->where('campaign_id', $campaign->id);
            if ($public) {
                $query->where('is_public', true)->with(['author.entrepreneur', 'author.investor']);
            }
        }]);
    }

    private function updatesQuery(Campaign $campaign, bool $public): HasMany
    {
        $query = $campaign->updates()->with([
            'author.entrepreneur',
            'author.investor',
            'milestone' => fn ($query) => $query->where('campaign_id', $campaign->id),
        ])->latest();
        if ($public) {
            $query->where('is_public', true);
        }

        return $query;
    }

    private function publicMilestoneData(CampaignMilestone $milestone, bool $includeUpdates = false): array
    {
        $data = Arr::only($milestone->attributesToArray(), ['id', 'campaign_id', 'title', 'description', 'target_date', 'completed_date', 'status', 'progress_percentage', 'sort_order', 'evidence_urls', 'created_at', 'updated_at']);
        if ($includeUpdates) {
            $data['updates'] = $milestone->updates->map(fn ($update) => $this->publicUpdateData($update))->all();
        }

        return $data;
    }

    private function publicUpdateData(CampaignUpdate $update, bool $includeMilestone = false): array
    {
        $profile = $update->author?->entrepreneur ?? $update->author?->investor;
        $data = Arr::only($update->attributesToArray(), ['id', 'campaign_id', 'milestone_id', 'title', 'content', 'attachments', 'is_public', 'created_at', 'updated_at']);
        $data['author_name'] = trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? '')) ?: 'Usuario';
        $data['author_display_name'] = $profile?->display_name;
        $data['author_avatar'] = $profile?->avatar_url;
        if ($includeMilestone) {
            $data['milestone'] = $update->milestone ? $this->publicMilestoneData($update->milestone) : null;
        }

        return $data;
    }
}
