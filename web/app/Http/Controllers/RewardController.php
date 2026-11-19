<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Investment;
use App\Models\RewardClaim;
use App\Models\RewardTier;
use App\Services\Notifier;
use App\Support\Api;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RewardController extends Controller
{
    public function index(Request $r, Campaign $campaign)
    {
        $query = $campaign->rewards();
        if (str_ends_with($r->path(), '/all')) {
            CampaignController::authorizeOwner($r, $campaign, true);
        } else {
            abort_unless($campaign->isPubliclyReadable(), 404);
            $query->where('is_active', true);
        }

        return Api::ok($query->get());
    }

    private function editable(Request $r, Campaign $c): void
    {
        CampaignController::authorizeOwner($r, $c);
        abort_unless(in_array($c->status, ['draft', 'rejected', 'pending_review', 'in_review']), 422, 'No se pueden modificar recompensas de una campaña activa o finalizada.');
    }

    public function save(Request $r, Campaign $campaign, ?RewardTier $reward = null)
    {
        $this->editable($r, $campaign);
        if ($reward?->exists) {
            abort_unless($reward->campaign_id === $campaign->id, 404);
        }
        $required = $reward?->exists ? 'sometimes' : 'required';
        $data = $r->validate(['title' => "$required|string|max:255", 'description' => 'nullable|string|max:5000', 'amount' => 'sometimes|numeric|min:0', 'minPercentage' => "$required|numeric|min:0|max:100", 'maxPercentage' => "$required|numeric|min:0|max:100", 'currency' => 'sometimes|in:BOB,USD', 'maxClaims' => 'nullable|integer|min:1', 'estimatedDelivery' => 'nullable|date', 'includesShipping' => 'sometimes|boolean', 'shippingDetails' => 'nullable|string|max:5000', 'imageUrl' => 'nullable|string|max:2048', 'expiresAt' => 'nullable|date', 'items' => 'sometimes|array', 'sortOrder' => 'sometimes|integer|min:0', 'isActive' => 'sometimes|boolean']);
        abort_if(($data['minPercentage'] ?? $reward?->min_percentage ?? 0) > ($data['maxPercentage'] ?? $reward?->max_percentage ?? 100), 422, 'El porcentaje mínimo debe ser menor o igual al máximo.');
        if (isset($data['maxClaims'])) {
            abort_if($data['maxClaims'] < ($reward?->current_claims ?? 0), 422, 'El cupo es menor al número de recompensas reclamadas.');
        }
        if ($reward?->exists) {
            $reward->update(Api::snake($data));

            return Api::ok($reward->fresh());
        }

        return Api::ok($campaign->rewards()->create(Api::snake($data)), 201);
    }

    public function destroy(Request $r, Campaign $campaign, RewardTier $reward)
    {
        $this->editable($r, $campaign);
        abort_unless($reward->campaign_id === $campaign->id, 404);
        abort_if($reward->current_claims > 0, 422, 'La recompensa ya ha sido reclamada.');
        $reward->delete();

        return Api::ok();
    }

    public function claims(Request $r, Campaign $campaign)
    {
        CampaignController::authorizeOwner($r, $campaign, true);

        return Api::ok(RewardClaim::with(['investment.investor.investor', 'investment.reward'])->whereHas('investment', fn ($q) => $q->where('campaign_id', $campaign->id))->get()->map(function ($claim) {
            $i = $claim->investment;
            $p = $i->investor?->investor;

            return ['claim_id' => $claim->id, 'claim_status' => $claim->status, 'investment_status' => $i->status, 'allowed_statuses' => $claim->allowedStatuses(), 'tracking_number' => $claim->tracking_number, 'tracking_url' => $claim->tracking_url, 'investment_id' => $i->id, 'amount' => $i->amount, 'invested_at' => $i->created_at, 'reward_title' => $i->reward?->title, 'reward_id' => $i->reward_tier_id, 'expires_at' => $i->reward?->expires_at, 'investor_email' => $i->investor?->email, 'first_name' => $p?->first_name, 'last_name' => $p?->last_name];
        }), 200, false);
    }

    public function updateClaim(Request $r, Campaign $campaign, RewardClaim $claim, Notifier $notifier)
    {
        CampaignController::authorizeOwner($r, $campaign);
        abort_unless($claim->investment->campaign_id === $campaign->id, 404);
        $data = $r->validate(['status' => 'required|in:pending,processing,shipped,delivered,cancelled', 'trackingNumber' => 'nullable|string|max:255', 'trackingUrl' => 'nullable|url:http,https|max:2048']);

        return DB::transaction(function () use ($r, $campaign, $claim, $data, $notifier) {
            // Match the refund lock order and reread state after acquiring the locks.
            $campaign = Campaign::whereKey($campaign->id)->lockForUpdate()->firstOrFail();
            CampaignController::authorizeOwner($r, $campaign);
            $investment = Investment::whereKey($claim->investment_id)->lockForUpdate()->firstOrFail();
            $claim = RewardClaim::whereKey($claim->id)->lockForUpdate()->firstOrFail();
            abort_unless($investment->campaign_id === $campaign->id, 404);
            $claim->setRelation('investment', $investment);
            abort_unless($investment->status === 'completed' && $investment->refunded_amount <= 0, 422, 'No se puede actualizar la recompensa de un aporte reembolsado o no completado.');
            abort_if($claim->status === 'cancelled', 422, 'Esta recompensa está cancelada y no puede reactivarse ni modificarse.');
            abort_if($claim->status === 'delivered', 422, 'Esta recompensa ya fue entregada y no puede modificarse.');
            $changed = $data['status'] !== $claim->status;
            abort_unless(in_array($data['status'], $claim->allowedStatuses(), true) || (! $changed && $claim->allowedStatuses()), 422, 'Cambio de estado no permitido. Sigue el orden: pendiente, en preparación, enviada y entregada.');
            $claim->update([...Api::snake($data), ...($changed && $data['status'] === 'shipped' ? ['shipped_at' => now()] : []), ...($changed && $data['status'] === 'delivered' ? ['delivered_at' => now()] : [])]);
            if ($changed && in_array($data['status'], ['shipped', 'delivered'])) {
                $notifier->send($investment->investor_id, 'reward_'.$data['status'], 'Recompensa actualizada', $campaign->title.': '.$data['status'], $campaign->id);
            }

            return Api::ok([...$claim->fresh()->toArray(), 'allowed_statuses' => $claim->allowedStatuses()]);
        }, 3);
    }
}
