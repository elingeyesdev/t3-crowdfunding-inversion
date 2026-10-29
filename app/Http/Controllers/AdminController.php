<?php

namespace App\Http\Controllers;

use App\Models\AdminProfile;
use App\Models\Campaign;
use App\Models\CampaignDocument;
use App\Models\CampaignFinancialMovement;
use App\Models\CampaignFundingPlan;
use App\Models\CampaignReview;
use App\Models\CampaignStatusHistory;
use App\Models\EntrepreneurProfile;
use App\Models\Role;
use App\Models\User;
use App\Services\CampaignFinance;
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

        return Api::ok($document->fresh(), 200, false);
    }

    private function movementData(CampaignFinancialMovement $m): array
    {
        $creatorProfile = $m->creator?->entrepreneur;
        $creatorName = $creatorProfile
            ? trim(($creatorProfile->first_name ?? '').' '.($creatorProfile->last_name ?? ''))
            : null;

        $reviewerProfile = $m->reviewer?->admin;
        $reviewerName = $reviewerProfile
            ? trim(($reviewerProfile->first_name ?? '').' '.($reviewerProfile->last_name ?? ''))
            : null;

        return [
            'id' => $m->id,
            'campaignId' => $m->campaign_id,
            'campaignTitle' => $m->campaign?->title,
            'campaignStatus' => $m->campaign?->status,
            'campaignCurrency' => $m->campaign?->currency ?? $m->currency,
            'campaignGoal' => (float) ($m->campaign?->goal_amount ?? 0),
            'campaignCurrentAmount' => (float) ($m->campaign?->current_amount ?? 0),
            'createdBy' => $m->created_by,
            'creatorEmail' => $m->creator?->email,
            'creatorName' => $creatorName ?: $m->creator?->email,
            'type' => $m->type,
            'concept' => $m->concept,
            'category' => $m->category,
            'amount' => (float) $m->amount,
            'currency' => $m->currency,
            'movementDate' => $m->movement_date?->format('Y-m-d'),
            'referenceNumber' => $m->reference_number,
            'receiptUrl' => $m->receipt_url,
            'hasReceipt' => ! empty($m->receipt_url),
            'notes' => $m->notes,
            'status' => $m->status,
            'reviewedBy' => $m->reviewed_by,
            'reviewerEmail' => $m->reviewer?->email,
            'reviewerName' => $reviewerName ?: $m->reviewer?->email,
            'reviewedAt' => $m->reviewed_at?->toIso8601String(),
            'reviewNotes' => $m->review_notes,
            'createdAt' => $m->created_at?->toIso8601String(),
            'updatedAt' => $m->updated_at?->toIso8601String(),
        ];
    }

    public function financialMovements(Request $r)
    {
        $q = CampaignFinancialMovement::with([
            'campaign.creator.entrepreneur',
            'creator.entrepreneur',
            'reviewer.admin',
        ]);

        if ($r->filled('campaignId')) {
            $q->where('campaign_id', $r->input('campaignId'));
        }

        if ($r->filled('type')) {
            $q->where('type', $r->input('type'));
        }

        if ($r->filled('status')) {
            $q->where('status', $r->input('status'));
        }

        if ($r->filled('category')) {
            $q->where('category', $r->input('category'));
        }

        if ($r->filled('hasReceipt')) {
            $hasReceipt = filter_var($r->input('hasReceipt'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($hasReceipt === true) {
                $q->whereNotNull('receipt_url')->where('receipt_url', '!=', '');
            } elseif ($hasReceipt === false) {
                $q->where(function ($sub) {
                    $sub->whereNull('receipt_url')->orWhere('receipt_url', '');
                });
            }
        }

        if ($r->filled('flagged')) {
            $isFlagged = filter_var($r->input('flagged'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($isFlagged) {
                $q->where('status', 'flagged');
            }
        }

        if ($r->filled('dateFrom')) {
            $q->whereDate('movement_date', '>=', $r->input('dateFrom'));
        }

        if ($r->filled('dateTo')) {
            $q->whereDate('movement_date', '<=', $r->input('dateTo'));
        }

        if ($r->filled('minAmount')) {
            $q->where('amount', '>=', (float) $r->input('minAmount'));
        }

        if ($r->filled('maxAmount')) {
            $q->where('amount', '<=', (float) $r->input('maxAmount'));
        }

        if ($r->filled('q')) {
            $term = '%'.$r->input('q').'%';
            $q->where(function ($sub) use ($term) {
                $sub->where('concept', 'like', $term)
                    ->orWhere('reference_number', 'like', $term)
                    ->orWhere('notes', 'like', $term)
                    ->orWhere('review_notes', 'like', $term)
                    ->orWhereHas('campaign', fn ($c) => $c->where('title', 'like', $term));
            });
        }

        $sortField = in_array($r->input('sortBy'), ['movement_date', 'created_at', 'amount', 'status'])
            ? $r->input('sortBy')
            : 'movement_date';
        $sortOrder = strtoupper($r->input('sortOrder', 'DESC')) === 'ASC' ? 'asc' : 'desc';
        $q->orderBy($sortField, $sortOrder);

        return Api::ok(Api::page($q, $r, fn ($m) => $this->movementData($m)), 200, false);
    }

    public function showFinancialMovement(CampaignFinancialMovement $movement)
    {
        $movement->load(['campaign.creator.entrepreneur', 'creator.entrepreneur', 'reviewer.admin']);
        $data = $this->movementData($movement);

        // Detect potential inconsistencies or flags
        $campaign = $movement->campaign;
        $consistencyFlags = [];

        if ($movement->type === 'expense') {
            if (empty($movement->receipt_url)) {
                $consistencyFlags[] = [
                    'code' => 'MISSING_RECEIPT',
                    'severity' => 'warning',
                    'message' => 'El gasto no cuenta con comprobante o evidencia documental adjunta.',
                ];
            }

            $planItems = $campaign ? CampaignFundingPlan::where('campaign_id', $campaign->id)->get() : collect();
            if ($planItems->isNotEmpty()) {
                $matchedPlan = $planItems->first(fn ($p) => strtolower($p->category) === strtolower($movement->category));
                if (! $matchedPlan) {
                    $consistencyFlags[] = [
                        'code' => 'UNBUDGETED_CATEGORY',
                        'severity' => 'warning',
                        'message' => 'La categoría "'.$movement->category.'" no figura en el plan de uso de fondos aprobado.',
                    ];
                } else {
                    $categorySpent = (float) $campaign->financialMovements()
                        ->where('type', 'expense')
                        ->where('category', $movement->category)
                        ->sum('amount');

                    if ($categorySpent > (float) $matchedPlan->amount) {
                        $consistencyFlags[] = [
                            'code' => 'OVERBUDGET_CATEGORY',
                            'severity' => 'danger',
                            'message' => 'El gasto acumulado en "'.$movement->category.'" supera el presupuesto asignado de '.$matchedPlan->amount.' '.$movement->currency.'.',
                        ];
                    }
                }
            }

            if ($campaign && $campaign->current_amount > 0 && ($movement->amount / $campaign->current_amount) > 0.3) {
                $consistencyFlags[] = [
                    'code' => 'HIGH_SINGLE_EXPENSE',
                    'severity' => 'info',
                    'message' => 'Este gasto individual representa más del 30% del total recaudado en la campaña.',
                ];
            }
        }

        $data['consistencyFlags'] = $consistencyFlags;

        return Api::ok($data, 200, false);
    }

    public function reviewFinancialMovement(Request $r, CampaignFinancialMovement $movement, Notifier $notifier)
    {
        $data = $r->validate([
            'action' => 'required|in:approve,flag,reject,reset',
            'notes' => 'nullable|string|max:5000',
        ]);

        if (in_array($data['action'], ['flag', 'reject']) && empty($data['notes'])) {
            abort(422, 'Debes incluir notas de auditoría explicando la observación o motivo de rechazo.');
        }

        $statusMap = [
            'approve' => 'verified',
            'flag' => 'flagged',
            'reject' => 'rejected',
            'reset' => 'pending',
        ];

        $newStatus = $statusMap[$data['action']];

        $movement->update([
            'status' => $newStatus,
            'reviewed_by' => $r->user()->id,
            'reviewed_at' => now(),
            'review_notes' => $data['notes'] ?? null,
        ]);

        $movement->load(['campaign.creator.entrepreneur', 'creator.entrepreneur', 'reviewer.admin']);

        if ($movement->campaign && $movement->campaign->creator_id) {
            $actionLabel = match ($data['action']) {
                'approve' => 'aprobado y verificado',
                'flag' => 'marcado con observaciones / inconsistencias',
                'reject' => 'rechazado',
                'reset' => 'puesto en revisión pendiente',
            };

            $notesText = ! empty($data['notes']) ? "\nObservaciones: ".$data['notes'] : '';

            $notifier->send(
                $movement->campaign->creator_id,
                'financial_movement_'.$newStatus,
                'Auditoría de gasto: '.$movement->campaign->title,
                "El movimiento '{$movement->concept}' ({$movement->currency} {$movement->amount}) ha sido {$actionLabel} por la administración.{$notesText}",
                $movement->campaign_id
            );
        }

        return Api::ok($this->movementData($movement), 200, false);
    }

    public function financialAuditSummary()
    {
        $movements = CampaignFinancialMovement::all();
        $expenses = $movements->where('type', 'expense');
        $incomes = $movements->where('type', 'income');

        $totalMovements = $movements->count();
        $totalExpenses = (float) $expenses->sum('amount');
        $totalIncomes = (float) $incomes->sum('amount');

        $pendingCount = $movements->where('status', 'pending')->count();
        $flaggedCount = $movements->where('status', 'flagged')->count();
        $verifiedCount = $movements->where('status', 'verified')->count();
        $rejectedCount = $movements->where('status', 'rejected')->count();

        $expensesWithoutReceiptCount = $expenses->filter(fn ($m) => empty($m->receipt_url))->count();
        $campaignsWithIrregularitiesCount = CampaignFinancialMovement::where('status', 'flagged')
            ->distinct('campaign_id')
            ->count('campaign_id');

        $topFlaggedCategories = CampaignFinancialMovement::where('status', 'flagged')
            ->select('category', DB::raw('count(*) as count'), DB::raw('sum(amount) as total_amount'))
            ->groupBy('category')
            ->orderByDesc('count')
            ->limit(5)
            ->get();

        $recentPending = CampaignFinancialMovement::with(['campaign', 'creator.entrepreneur'])
            ->where('status', 'pending')
            ->latest('created_at')
            ->limit(5)
            ->get()
            ->map(fn ($m) => $this->movementData($m));

        $recentFlagged = CampaignFinancialMovement::with(['campaign', 'creator.entrepreneur', 'reviewer.admin'])
            ->where('status', 'flagged')
            ->latest('reviewed_at')
            ->limit(5)
            ->get()
            ->map(fn ($m) => $this->movementData($m));

        return Api::ok([
            'totalMovements' => $totalMovements,
            'totalExpenses' => $totalExpenses,
            'totalIncomes' => $totalIncomes,
            'pendingCount' => $pendingCount,
            'flaggedCount' => $flaggedCount,
            'verifiedCount' => $verifiedCount,
            'rejectedCount' => $rejectedCount,
            'expensesWithoutReceiptCount' => $expensesWithoutReceiptCount,
            'campaignsWithIrregularitiesCount' => $campaignsWithIrregularitiesCount,
            'topFlaggedCategories' => $topFlaggedCategories,
            'recentPending' => $recentPending,
            'recentFlagged' => $recentFlagged,
        ], 200, false);
    }

    public function campaignFinancialAudit(Campaign $campaign, CampaignFinance $finance)
    {
        $ledger = $finance->ledger($campaign);
        $fundingPlans = CampaignFundingPlan::where('campaign_id', $campaign->id)->get();
        $movements = $campaign->financialMovements()->with(['creator', 'reviewer'])->get();
        $expenses = $movements->where('type', 'expense');

        $comparison = $fundingPlans->map(function ($plan) use ($expenses) {
            $categoryExpenses = $expenses->where('category', $plan->category);
            $spent = (float) $categoryExpenses->sum('amount');
            $budget = (float) $plan->amount;
            $variance = round($budget - $spent, 2);
            $isOverbudget = $spent > $budget;

            return [
                'id' => $plan->id,
                'category' => $plan->category,
                'description' => $plan->description,
                'budgetedAmount' => $budget,
                'budgetedPercentage' => (float) $plan->percentage,
                'spentAmount' => $spent,
                'variance' => $variance,
                'isOverbudget' => $isOverbudget,
                'expensesCount' => $categoryExpenses->count(),
                'missingReceiptCount' => $categoryExpenses->filter(fn ($m) => empty($m->receipt_url))->count(),
                'flaggedCount' => $categoryExpenses->where('status', 'flagged')->count(),
            ];
        });

        $planCategories = $fundingPlans->pluck('category')->map(fn ($c) => strtolower($c))->all();
        $unbudgetedExpenses = $expenses->filter(function ($m) use ($planCategories) {
            return ! in_array(strtolower($m->category), $planCategories);
        })->map(fn ($m) => $this->movementData($m))->values()->all();

        $missingReceipts = $expenses->filter(fn ($m) => empty($m->receipt_url))->map(fn ($m) => $this->movementData($m))->values()->all();
        $flaggedMovements = $movements->where('status', 'flagged')->map(fn ($m) => $this->movementData($m))->values()->all();

        $milestones = $campaign->milestones()->with('updates')->get();
        $totalMilestoneEvidences = $milestones->sum(fn ($m) => count($m->evidence_urls ?? []));

        return Api::ok([
            'campaign' => [
                'id' => $campaign->id,
                'title' => $campaign->title,
                'status' => $campaign->status,
                'goalAmount' => (float) $campaign->goal_amount,
                'currentAmount' => (float) $campaign->current_amount,
                'currency' => $campaign->currency,
            ],
            'ledger' => $ledger,
            'fundingPlanComparison' => $comparison,
            'unbudgetedExpenses' => $unbudgetedExpenses,
            'inconsistencies' => [
                'missingReceiptsCount' => count($missingReceipts),
                'missingReceipts' => $missingReceipts,
                'flaggedCount' => count($flaggedMovements),
                'flaggedMovements' => $flaggedMovements,
                'overbudgetCount' => $comparison->where('isOverbudget', true)->count(),
                'unbudgetedExpensesCount' => count($unbudgetedExpenses),
            ],
            'milestonesAudit' => [
                'totalMilestones' => $milestones->count(),
                'completedMilestones' => $milestones->where('status', 'completed')->count(),
                'totalEvidences' => $totalMilestoneEvidences,
            ],
        ], 200, false);
    }
}

