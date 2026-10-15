<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\CampaignStatusHistory;
use App\Models\CampaignUpdate;
use App\Models\Category;
use App\Services\CampaignFinance;
use App\Services\InvestmentEngine;
use App\Services\Notifier;
use App\Services\ProfileReadiness;
use App\Support\Api;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CampaignController extends Controller
{
    public static function authorizeOwner(Request $r, Campaign $campaign, bool $allowAdmin = false): void
    {
        abort_unless($campaign->creator_id === $r->user()?->id || ($allowAdmin && $r->user()?->roles()->whereIn('name', ['admin', 'super_admin'])->exists()), 403, 'No tienes permiso para gestionar esta campaña.');
    }

    private function publicCampaign(Campaign $c): void
    {
        abort_unless(in_array($c->status, Campaign::PUBLIC_STATUSES), 404);
    }

    public function categories()
    {
        return Api::ok(Category::where('is_active', true)->orderBy('sort_order')->get());
    }

    private function listing(Request $r, bool $public)
    {
        $query = Campaign::with(['creator.entrepreneur', 'category', 'categories', 'rewards']);
        if ($public) {
            $query->whereIn('status', Campaign::PUBLIC_STATUSES);
        } else {
            $query->where('creator_id', $r->user()->id);
            if ($r->filled('status')) {
                $query->where('status', $r->input('status'));
            } elseif ($preset = $r->input('filterPreset')) {
                $groups = ['draft' => ['draft', 'rejected'], 'approval' => ['pending_review', 'in_review', 'approved'], 'published' => ['published', 'partially_funded', 'funded'], 'archived' => ['failed', 'cancelled', 'completed', 'suspended']];
                if (isset($groups[$preset])) {
                    $query->whereIn('status', $groups[$preset]);
                }
            }
        }
        if ($r->filled('categoryId')) {
            $query->where(function ($q) use ($r) {
                $q->where('category_id', $r->input('categoryId'))->orWhereHas('categories', fn ($q) => $q->where('categories.id', $r->input('categoryId')));
            });
        }
        if ($r->filled('campaignType')) {
            $query->where('campaign_type', $r->input('campaignType'));
        }
        $search = $r->input('q', $r->input('search'));
        if ($search) {
            $query->where(fn ($q) => $q->where('title', 'like', '%'.$search.'%')->orWhere('short_description', 'like', '%'.$search.'%'));
        }
        foreach (['createdFrom' => ['created_at', '>='], 'createdTo' => ['created_at', '<='], 'endDateFrom' => ['end_date', '>='], 'endDateTo' => ['end_date', '<=']] as $input => [$field,$operator]) {
            if ($r->filled($input)) {
                $r->validate([$input => 'date']);
                $query->whereDate($field, $operator, $r->input($input));
            }
        }
        $sort = in_array($r->input('sortBy'), ['created_at', 'current_amount', 'goal_amount', 'end_date', 'title']) ? $r->input('sortBy') : 'created_at';
        $query->orderBy($sort, strtoupper($r->input('sortOrder', 'DESC')) === 'ASC' ? 'asc' : 'desc');

        return Api::ok(Api::page($query, $r, fn ($c) => $c->apiData()));
    }

    public function index(Request $r)
    {
        return $this->listing($r, false);
    }

    public function publicIndex(Request $r)
    {
        return $this->listing($r, true);
    }

    public function show(Request $r, Campaign $campaign)
    {
        self::authorizeOwner($r, $campaign);

        return Api::ok($campaign->apiData());
    }

    public function publicShow(Campaign $campaign)
    {
        $this->publicCampaign($campaign);

        return Api::ok($campaign->apiData());
    }

    public function view(Campaign $campaign)
    {
        $this->publicCampaign($campaign);
        $campaign->increment('view_count');

        return Api::ok(['viewCount' => $campaign->view_count]);
    }

    public function save(Request $r, ProfileReadiness $readiness, ?Campaign $campaign = null)
    {
        $creating = ! $campaign?->exists;
        if ($creating) {
            $missing = $readiness->missing($r->user()->entrepreneur);
            abort_if((bool) $missing, 422, 'Completa tu perfil para crear campañas. Falta: '.implode(', ', $missing));
        } else {
            self::authorizeOwner($r, $campaign);
            abort_unless(in_array($campaign->status, ['draft', 'rejected']), 422, 'Solo se pueden editar campañas en borrador o rechazadas.');
        }
        $required = $creating ? 'required' : 'sometimes';
        $data = $r->validate(['title' => "$required|string|min:5|max:200", 'description' => "$required|string|min:30|max:100000", 'shortDescription' => 'nullable|string|max:1000', 'goalAmount' => "$required|numeric|min:1|max:9999999999999.99|decimal:0,2", 'categoryId' => 'sometimes|uuid|exists:categories,id', 'categoryIds' => 'sometimes|array|max:10', 'categoryIds.*' => 'uuid|exists:categories,id', 'endDate' => 'nullable|date|after:now', 'videoUrl' => 'nullable|url:http,https|max:2048', 'campaignType' => 'sometimes|in:donation,reward,equity', 'location' => 'nullable|string|max:255', 'rewards' => 'sometimes|array|max:30', 'rewards.*.title' => 'required|string|max:255', 'rewards.*.description' => 'nullable|string|max:5000', 'rewards.*.minPercentage' => 'required|numeric|min:0|max:100', 'rewards.*.maxPercentage' => 'required|numeric|min:0|max:100|gte:rewards.*.minPercentage']);

        return DB::transaction(function () use ($r, $data, $campaign, $creating) {
            if (! $creating) {
                $campaign = Campaign::whereKey($campaign->id)->lockForUpdate()->firstOrFail();
                abort_unless(in_array($campaign->status, ['draft', 'rejected']), 422, 'Solo se pueden editar campañas en borrador o rechazadas.');
            }
            $attrs = Api::snake(collect($data)->except(['categoryIds', 'rewards'])->all());
            $categoryIds = $data['categoryIds'] ?? (isset($data['categoryId']) ? [$data['categoryId']] : null);
            if ($creating || $categoryIds !== null) {
                $attrs['category_id'] = $categoryIds[0] ?? Category::where('is_active', true)->value('id');
            }
            abort_if(($creating || $categoryIds !== null) && ! $attrs['category_id'], 422, 'No hay categorías disponibles. Ejecuta los seeders.');
            if ($creating) {
                $campaign = Campaign::create([...$attrs, 'creator_id' => $r->user()->id, 'slug' => Str::slug($data['title']).'-'.Str::lower(Str::random(8))]);
                $r->user()->entrepreneur()->increment('total_campaigns');
            } else {
                $campaign->update($attrs);
            }
            if ($categoryIds !== null) {
                $campaign->categories()->sync($categoryIds);
            } elseif ($creating) {
                $campaign->categories()->sync([$campaign->category_id]);
            }
            if (isset($data['rewards'])) {
                $campaign->rewards()->delete();
                foreach ($data['rewards'] as $tier) {
                    $campaign->rewards()->create(Api::snake($tier));
                }
            }

            return Api::ok($campaign->fresh()->apiData(), $creating ? 201 : 200);
        });
    }

    public function transition(Request $r, Campaign $campaign, Notifier $notifier)
    {
        self::authorizeOwner($r, $campaign);

        return DB::transaction(function () use ($r, $campaign, $notifier) {
            $campaign = Campaign::whereKey($campaign->id)->lockForUpdate()->firstOrFail();
            $publish = str_ends_with($r->path(), '/publish');
            $allowed = $publish ? ['draft', 'approved'] : ['draft', 'rejected'];
            abort_unless(in_array($campaign->status, $allowed), 422, 'La campaña no permite esta transición de estado.');
            $old = $campaign->status;
            $next = $publish ? 'published' : 'pending_review';
            $campaign->update(['status' => $next, ...($publish ? ['published_at' => $campaign->published_at ?? now()] : [])]);
            CampaignStatusHistory::create(['campaign_id' => $campaign->id, 'from_status' => $old, 'to_status' => $next, 'changed_by' => $r->user()->id, 'reason' => $publish ? 'Lanzamiento público' : 'Envío para revisión']);
            $notifier->send($campaign->creator_id, 'campaign_'.$next, 'Estado de campaña actualizado', $campaign->title.': '.$next, $campaign->id);

            return Api::ok($campaign->fresh()->apiData());
        });
    }

    public function history(Request $r, Campaign $campaign)
    {
        self::authorizeOwner($r, $campaign, true);

        return Api::ok(CampaignStatusHistory::with('actor.admin')->where('campaign_id', $campaign->id)->latest()->get()->map(fn ($h) => [...$h->attributesToArray(), 'feedback' => $h->reason, 'changed_by_email' => $h->actor?->email, 'changed_by_name' => $h->actor?->admin?->first_name ?? $h->actor?->email]), 200, false);
    }

    public function destroy(Request $r, Campaign $campaign)
    {
        self::authorizeOwner($r, $campaign, true);

        return DB::transaction(function () use ($campaign, $r) {
            $campaign = Campaign::whereKey($campaign->id)->lockForUpdate()->firstOrFail();
            abort_if($campaign->investments()->exists(), 422, 'La campaña tiene inversiones y no puede eliminarse.');
            if ($campaign->creator_id === $r->user()->id) {
                abort_unless(in_array($campaign->status, ['draft', 'rejected']), 422, 'Solo se pueden eliminar borradores o campañas rechazadas.');
            }
            $campaign->creator?->entrepreneur()->where('total_campaigns', '>', 0)->decrement('total_campaigns');
            $campaign->delete();

            return Api::ok();
        });
    }

    public function finalize(Request $r, Campaign $campaign, InvestmentEngine $engine)
    {
        self::authorizeOwner($r, $campaign);

        return Api::ok($engine->finalize($campaign, $r->user()->id)->apiData());
    }

    public function cover(Request $r, Campaign $campaign)
    {
        self::authorizeOwner($r, $campaign);
        $r->validate(['file' => 'required|file|mimes:jpg,jpeg,png,webp,avif|max:10240']);
        $campaign->update(['cover_image_url' => '/storage/'.$r->file('file')->store('campaigns', 'public')]);

        return Api::ok($campaign->fresh()->apiData());
    }

    public function progress(Request $r, Campaign $campaign, CampaignFinance $finance)
    {
        self::authorizeOwner($r, $campaign, true);

        return Api::ok($finance->progress($campaign));
    }

    public function publicProgress(Campaign $campaign, CampaignFinance $finance)
    {
        $this->publicCampaign($campaign);

        return Api::ok($finance->progress($campaign));
    }

    public function analytics(Request $r, Campaign $campaign, CampaignFinance $finance)
    {
        self::authorizeOwner($r, $campaign, true);

        return Api::ok($finance->analytics($campaign));
    }

    public function summary(Request $r)
    {
        $campaigns = Campaign::where('creator_id', $r->user()->id)->get();
        $total = (float) $campaigns->sum('current_amount');

        return Api::ok(['totalCampaigns' => $campaigns->count(), 'activeCampaigns' => $campaigns->whereIn('status', ['published', 'partially_funded'])->count(), 'fundedCampaigns' => $campaigns->where('status', 'funded')->count(), 'draftCampaigns' => $campaigns->where('status', 'draft')->count(), 'totalRaised' => $total, 'totalGoalAmount' => (float) $campaigns->sum('goal_amount'), 'totalInvestors' => (int) $campaigns->sum('investor_count'), 'averageFundingPercentage' => $campaigns->count() ? $campaigns->avg(fn ($c) => $c->goal_amount > 0 ? $c->current_amount / $c->goal_amount * 100 : 0) : 0, 'currency' => 'BOB']);
    }

    public function investors(Request $r, Campaign $campaign)
    {
        self::authorizeOwner($r, $campaign, true);
        $query = $campaign->investments()->with(['investor.investor', 'reward'])->where('status', 'completed')->latest();
        $items = $query->get()->groupBy('investor_id')->map(function ($items) {
            $i = $items->first();
            $p = $i->investor?->investor;

            return ['userId' => $i->investor_id, 'firstName' => $p?->first_name ?? 'Usuario', 'lastName' => $p?->last_name ?? '', 'displayName' => $p?->display_name, 'avatarUrl' => $p?->avatar_url, 'location' => $p?->city, 'bio' => $p?->bio, 'email' => $i->investor?->email, 'totalInvested' => (float) $items->sum('amount'), 'investmentCount' => $items->count(), 'lastInvestmentAt' => $i->created_at, 'investmentId' => $i->id, 'rewardTitle' => $i->reward?->title];
        })->values();
        $limit = max(1, min(100, (int) $r->input('limit', 20)));
        $page = max(1, (int) $r->input('page', 1));
        $slice = $items->slice(($page - 1) * $limit, $limit)->values();

        return Api::ok(['data' => $slice, 'meta' => ['totalItems' => $items->count(), 'itemCount' => $slice->count(), 'itemsPerPage' => $limit, 'totalPages' => max(1, (int) ceil($items->count() / $limit)), 'currentPage' => $page]]);
    }

    public function documents(Request $r, Campaign $campaign)
    {
        self::authorizeOwner($r, $campaign, true);

        return Api::ok($campaign->documents()->latest()->get(), 200, false);
    }

    public function uploadDocument(Request $r, Campaign $campaign)
    {
        self::authorizeOwner($r, $campaign);
        $r->validate(['file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp,doc,docx|max:20480', 'justification' => 'nullable|string|max:5000']);
        $f = $r->file('file');
        $path = $f->store('documents', 'local');

        return Api::ok($campaign->documents()->create(['file_url' => '/api/v1/private-files/'.$path, 'original_name' => $f->getClientOriginalName(), 'mime_type' => $f->getMimeType(), 'file_size_bytes' => $f->getSize(), 'justification' => $r->input('justification')]), 201, false);
    }

    public function deleteDocument(Request $r, Campaign $campaign, string $document)
    {
        self::authorizeOwner($r, $campaign);
        $doc = $campaign->documents()->findOrFail($document);
        $doc->delete();

        return Api::ok();
    }

    public function update(Request $r, Campaign $campaign)
    {
        self::authorizeOwner($r, $campaign);
        $r->merge(['isPublic' => $r->has('isPublic') ? $r->boolean('isPublic') : true]);
        $data = $r->validate(['title' => 'required|string|max:200', 'content' => 'required|string|max:20000', 'isPublic' => 'boolean', 'attachments' => 'sometimes|array|max:10', 'file' => 'nullable|file|mimes:jpg,jpeg,png,webp,avif,mp4,webm,pdf|max:51200']);
        $attachments = $data['attachments'] ?? [];
        if ($r->hasFile('file')) {
            $file = $r->file('file');
            $attachments[] = ['url' => '/storage/'.$file->store('updates', 'public'), 'type' => str_starts_with($file->getMimeType(), 'video/') ? 'video' : 'image'];
        }

        return Api::ok($campaign->updates()->create(['author_id' => $r->user()->id, 'title' => $data['title'], 'content' => $data['content'], 'is_public' => $data['isPublic'], 'attachments' => $attachments]), 201);
    }

    public function stories()
    {
        $updates = CampaignUpdate::with('campaign.creator.entrepreneur')->where('is_public', true)->where('created_at', '>=', now()->subDay())->whereHas('campaign', fn ($q) => $q->whereIn('status', Campaign::PUBLIC_STATUSES))->latest()->limit(200)->get();

        return Api::ok($updates->groupBy('campaign_id')->map(function ($items) {
            $c = $items->first()->campaign;
            $p = $c->creator?->entrepreneur;

            return ['campaignId' => $c->id, 'campaignTitle' => $c->title, 'campaignCoverImageUrl' => $c->cover_image_url, 'entrepreneurName' => $p?->display_name ?? trim(($p?->first_name ?? '').' '.($p?->last_name ?? '')), 'entrepreneurAvatar' => $p?->avatar_url, 'stories' => $items->map(fn ($u) => $u->only(['id', 'title', 'content', 'attachments', 'created_at']))->values()->all()];
        })->values());
    }
}
