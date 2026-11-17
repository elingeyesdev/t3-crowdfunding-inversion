<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\CampaignDocument;
use App\Models\CampaignMilestone;
use App\Models\CampaignUpdate;
use App\Services\CampaignFinance;
use App\Support\Api;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;

class CampaignReadController extends Controller
{
    private function authorizePublic(Campaign $campaign): void
    {
        abort_unless($campaign->isPubliclyReadable(), 404);
    }

    public function publicDocuments(Campaign $campaign)
    {
        $this->authorizePublic($campaign);
        $documents = $campaign->documents()->where('status', 'approved')->where('is_public', true)->latest()->get()
            ->filter(fn ($document) => $document->documentPath() && Storage::disk('local')->exists($document->documentPath()))
            ->map(fn ($document) => [
                ...Arr::only($document->attributesToArray(), ['id', 'campaign_id', 'original_name', 'mime_type', 'file_size_bytes', 'justification', 'status', 'created_at']),
                'file_url' => route('campaign.document.public', ['campaign' => $campaign->id, 'document' => $document->id], false),
            ])->values();

        // Public metadata must never pass through automatic private-URL signing:
        // a name or justification may itself contain a private-looking path.
        return response()->json(['data' => Api::camel($documents), 'message' => 'Operación exitosa', 'statusCode' => 200]);
    }

    public function publicDocumentFile(Campaign $campaign, CampaignDocument $document)
    {
        $this->authorizePublic($campaign);
        abort_unless($document->campaign_id === $campaign->id && $document->status === 'approved' && $document->is_public, 404);
        $path = $document->documentPath();
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        $name = preg_replace('/[\x00-\x1F\x7F]/u', '', basename(str_replace('\\', '/', $document->original_name))) ?: 'documento';

        return Storage::disk('local')->download($path, $name, [
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "sandbox; default-src 'none'",
        ]);
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
