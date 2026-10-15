<?php

namespace App\Http\Controllers;

use App\Models\AdminProfile;
use App\Models\Campaign;
use App\Models\CampaignDocument;
use App\Models\CampaignReview;
use App\Models\CampaignStatusHistory;
use App\Models\EntrepreneurProfile;
use App\Models\Role;
use App\Models\User;
use App\Services\Notifier;
use App\Support\Api;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AdminController extends Controller
{
    public function stats()
    {
        return Api::ok(['totalUsers' => User::count(), 'totalCampaigns' => Campaign::count(), 'totalFunded' => (float) Campaign::sum('current_amount')]);
    }

    public function users()
    {
        return Api::ok(User::select(['id', 'email', 'created_at', 'is_active'])->latest()->get(), 200, false);
    }

    private function campaignData(Campaign $c): array
    {
        $p = $c->creator?->entrepreneur;

        return [...$c->attributesToArray(), 'creator_email' => $c->creator?->email, 'creator_name' => trim(($p?->first_name ?? '').' '.($p?->last_name ?? '')), 'entrepreneur_name' => trim(($p?->first_name ?? '').' '.($p?->last_name ?? '')), 'entrepreneur_email' => $c->creator?->email, 'entrepreneur_first_name' => $p?->first_name, 'entrepreneur_last_name' => $p?->last_name, 'entrepreneur_avatar' => $p?->avatar_url, 'entrepreneur_bio' => $p?->bio, 'entrepreneur_linkedin' => $p?->linkedin_url, 'entrepreneur_website' => $p?->website, 'category_name' => $c->category?->display_name, 'reward_tiers' => $c->rewards->toArray(), 'media' => [], 'audit_score' => 20 + (mb_strlen($c->title) > 20 ? 15 : 0) + (mb_strlen($c->description ?? '') > 200 ? 25 : 0) + ($c->goal_amount > 1000 ? 15 : 0) + ($c->location ? 10 : 0) + ($c->cover_image_url ? 15 : 0)];
    }

    public function campaigns()
    {
        return Api::ok(Campaign::with(['creator.entrepreneur', 'category', 'rewards'])->latest()->get()->map(fn ($c) => $this->campaignData($c)), 200, false);
    }

    public function pending(Request $r)
    {
        $q = Campaign::with(['creator.entrepreneur', 'category', 'rewards'])->where('status', $r->input('status', 'pending_review'));
        if ($r->filled('q')) {
            $q->where('title', 'like', '%'.$r->input('q').'%');
        }
        $sort = in_array($r->input('sortBy'), ['created_at', 'goal_amount', 'title', 'status']) ? $r->input('sortBy') : 'created_at';
        $q->orderBy($sort, strtoupper($r->input('sortOrder', 'DESC')) === 'ASC' ? 'asc' : 'desc');

        return Api::ok(Api::page($q, $r, fn ($c) => $this->campaignData($c)), 200, false);
    }

    public function campaign(Campaign $campaign)
    {
        return Api::ok($this->campaignData($campaign), 200, false);
    }

    public function status(Request $r, Campaign $campaign, Notifier $notifier)
    {
        $data = $r->validate(['status' => 'required|in:in_review,approved,rejected,published,suspended,cancelled', 'feedback' => 'nullable|string|max:10000']);

        return DB::transaction(function () use ($r, $campaign, $data, $notifier) {
            $c = Campaign::whereKey($campaign->id)->lockForUpdate()->firstOrFail();
            $old = $c->status;
            $next = $data['status'];
            $transitions = ['draft' => ['in_review', 'approved', 'rejected', 'published', 'cancelled'], 'pending_review' => ['in_review', 'approved', 'rejected', 'published', 'cancelled'], 'in_review' => ['approved', 'rejected', 'published', 'cancelled'], 'approved' => ['published', 'rejected', 'cancelled'], 'rejected' => ['in_review', 'approved', 'published', 'cancelled'], 'published' => ['suspended'], 'partially_funded' => ['suspended'], 'suspended' => ['published']];
            abort_unless(in_array($next, $transitions[$old] ?? []), 422, 'Transición administrativa inválida.');
            $metadata = $c->metadata ?? [];
            if (! empty($data['feedback'])) {
                $metadata['review_feedback'] = $data['feedback'];
            }
            $c->update(['status' => $next, 'metadata' => $metadata, ...($next === 'published' ? ['published_at' => $c->published_at ?? now()] : [])]);
            CampaignStatusHistory::create(['campaign_id' => $c->id, 'from_status' => $old, 'to_status' => $next, 'changed_by' => $r->user()->id, 'reason' => $data['feedback'] ?? 'Cambio administrativo']);
            CampaignReview::create(['campaign_id' => $c->id, 'reviewer_id' => $r->user()->id, 'decision' => $next, 'feedback' => $data['feedback'] ?? null]);
            $notifier->send($c->creator_id, 'campaign_'.$next, 'Campaña revisada', $c->title.': '.$next.(! empty($data['feedback']) ? '. '.$data['feedback'] : ''), $c->id);

            return Api::ok($this->campaignData($c->fresh()), 200, false);
        });
    }

    public function deleteUser(Request $r, User $user)
    {
        abort_if($user->id === $r->user()->id, 422, 'No puedes desactivar tu propia cuenta.');
        abort_if($user->roles()->where('name', 'super_admin')->exists(), 403, 'No puedes desactivar un superadministrador.');
        $user->update(['is_active' => false]);
        $user->tokens()->delete();

        return Api::ok();
    }

    public function admins()
    {
        return Api::ok(AdminProfile::with('user')->get()->map(fn ($a) => [...$a->attributesToArray(), 'email' => $a->user?->email]), 200, false);
    }

    public function createAdmin(Request $r)
    {
        $data = $r->validate(['email' => 'required|email|unique:users,email', 'password' => ['required', 'string', 'min:8', 'max:128', 'regex:/^(?=.*[A-Z])(?=.*\d).+$/'], 'firstName' => 'nullable|string|max:100', 'lastName' => 'nullable|string|max:100', 'accessLevel' => 'sometimes|in:admin,super_admin']);

        return DB::transaction(function () use ($data) {
            $user = User::create(['email' => strtolower($data['email']), 'password_hash' => Hash::make($data['password'])]);
            $level = $data['accessLevel'] ?? 'admin';
            $user->assignRole($level);

            return Api::ok(AdminProfile::create(['user_id' => $user->id, 'first_name' => $data['firstName'] ?? 'Admin', 'last_name' => $data['lastName'] ?? '', 'access_level' => $level]), 201, false);
        });
    }

    public function deleteAdmin(Request $r, AdminProfile $admin)
    {
        abort_if($admin->user_id === $r->user()->id || $admin->access_level === 'super_admin', 422, 'No se puede eliminar este administrador.');

        return DB::transaction(function () use ($admin) {
            $user = $admin->user;
            $user->roles()->detach(Role::whereIn('name', ['admin', 'super_admin'])->pluck('id'));
            $admin->delete();
            $user->tokens()->delete();

            return Api::ok();
        });
    }

    public function kyc()
    {
        return Api::ok(EntrepreneurProfile::with('user')->where('kyc_status', 'pending')->oldest('updated_at')->get()->map(fn ($p) => [...$p->attributesToArray(), 'email' => $p->user?->email]), 200, false);
    }

    public function reviewKyc(Request $r, EntrepreneurProfile $profile, Notifier $notifier)
    {
        $data = $r->validate(['action' => 'required|in:approve,reject', 'reason' => 'nullable|string|max:2000']);
        abort_unless($profile->kyc_status === 'pending', 422, 'El perfil no tiene un KYC pendiente.');
        $approved = $data['action'] === 'approve';
        $profile->update(['kyc_status' => $approved ? 'approved' : 'rejected', 'identity_verified' => $approved, 'identity_verified_at' => $approved ? now() : null, 'kyc_rejection_reason' => $approved ? null : ($data['reason'] ?? null)]);
        $notifier->send($profile->user_id, 'kyc_reviewed', 'Verificación de identidad revisada', $approved ? 'Tu identidad fue verificada.' : ('Verificación rechazada. '.($data['reason'] ?? '')));

        return Api::ok($profile->fresh(), 200, false);
    }

    public function reviewDocument(Request $r, Campaign $campaign, CampaignDocument $document)
    {
        abort_unless($document->campaign_id === $campaign->id, 404);
        $data = $r->validate(['status' => 'required|in:approved,rejected', 'reviewerNotes' => 'nullable|string|max:5000']);
        $document->update([...Api::snake($data), 'reviewed_by' => $r->user()->id, 'reviewed_at' => now()]);

        return Api::ok($document->fresh(),200,false);
    }
}
