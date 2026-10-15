<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\CampaignStatusHistory;
use App\Models\Investment;
use App\Models\InvestorProfile;
use App\Models\RewardClaim;
use App\Models\RewardTier;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class InvestmentEngine
{
    public function __construct(private Notifier $notifier) {}

    private function money(mixed $amount): string
    {
        return number_format((float) $amount, 2, '.', '');
    }

    public function invest(string $userId, array $data): array
    {
        return DB::transaction(function () use ($userId, $data) {
            // All money operations lock the campaign before investor profiles.
            $c = Campaign::whereKey($data['campaignId'])->lockForUpdate()->firstOrFail();
            $p = InvestorProfile::where('user_id', $userId)->lockForUpdate()->firstOrFail();
            $amount = $this->money($data['amount']);
            $balance = bcsub($this->money($p->max_investment), $this->money($p->total_invested), 2);
            abort_unless(in_array($c->status, ['published', 'partially_funded']), 422, 'La campaña no acepta inversiones actualmente.');
            abort_if($c->end_date && $c->end_date->isPast(), 422, 'La campaña ha expirado.');
            abort_if($c->creator_id === $userId, 422, 'No puedes invertir en tu propia campaña.');
            abort_if(bccomp($balance, $amount, 2) < 0, 422, 'Saldo simulado insuficiente.');
            abort_if(bccomp($amount, $this->money($c->min_investment), 2) < 0, 422, 'El monto es menor al mínimo de la campaña.');
            if ($c->max_investment !== null) {
                abort_if(bccomp($amount, $this->money($c->max_investment), 2) > 0, 422, 'El monto supera el máximo de la campaña.');
            }
            $remaining = bcsub($this->money($c->goal_amount), $this->money($c->current_amount), 2);
            abort_if(bccomp($amount, $remaining, 2) > 0, 422, 'El monto supera el saldo restante de la campaña.');
            $percentage = (float) bcdiv(bcmul($amount, '100', 6), $this->money($c->goal_amount), 6);
            $tier = RewardTier::where('campaign_id', $c->id)->where('is_active', true)->where('min_percentage', '<=', $percentage)->where('max_percentage', '>=', $percentage)->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))->orderByDesc('min_percentage')->lockForUpdate()->first();
            if ($tier && $tier->max_claims !== null && $tier->current_claims >= $tier->max_claims) {
                $tier = null;
            }
            $newTotal = bcadd($this->money($c->current_amount), $amount, 2);
            $funded = bccomp($newTotal, $this->money($c->goal_amount), 2) >= 0;
            $ticket = Investment::create(['campaign_id' => $c->id, 'investor_id' => $userId, 'reward_tier_id' => $tier?->id, 'amount' => $amount, 'currency' => $c->currency]);
            Transaction::create(['investment_id' => $ticket->id, 'user_id' => $userId, 'transaction_type' => 'payment', 'amount' => $amount, 'currency' => $c->currency]);
            if ($tier) {
                $tier->increment('current_claims');
                RewardClaim::create(['investment_id' => $ticket->id]);
            }
            $p->update(['total_invested' => bcadd($this->money($p->total_invested), $amount, 2), 'total_investments' => $p->total_investments + 1]);
            $c->update(['current_amount' => $newTotal, 'investor_count' => $c->investments()->where('status', 'completed')->distinct()->count('investor_id'), ...($funded ? ['status' => 'funded', 'funded_at' => now()] : [])]);
            $c->creator->entrepreneur()->increment('total_raised', (float) $amount);
            $this->notifier->send($userId, 'investment_confirmed', 'Inversión confirmada', 'Tu aporte de '.$amount.' '.$c->currency.' a '.$c->title.' fue registrado.', $c->id);
            $this->notifier->send($c->creator_id, 'investment_received', 'Nuevo aporte recibido', $c->title.' recibió '.$amount.' '.$c->currency, $c->id);
            if ($funded) {
                CampaignStatusHistory::create(['campaign_id' => $c->id, 'from_status' => 'published', 'to_status' => 'funded', 'changed_by' => $userId, 'reason' => 'Meta alcanzada']);
                $this->notifier->send($c->creator_id, 'campaign_funded', '¡Meta alcanzada!', $c->title.' alcanzó su meta.', $c->id);
            }

            return ['ticket' => $ticket, 'remainingBalance' => (float) bcsub($balance, $amount, 2)];
        }, 3);
    }

    public function finalize(Campaign $campaign, string $actor): Campaign
    {
        return DB::transaction(function () use ($campaign, $actor) {
            $c = Campaign::whereKey($campaign->id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($c->status, ['published', 'partially_funded', 'funded']), 422, 'Solo se pueden finalizar campañas activas o financiadas.');
            $old = $c->status;
            if (bccomp($this->money($c->current_amount), $this->money($c->goal_amount), 2) < 0) {
                $investments = $c->investments()->where('status', 'completed')->orderBy('investor_id')->lockForUpdate()->get();
                $refunded = '0.00';
                foreach ($investments as $i) {
                    $p = InvestorProfile::where('user_id', $i->investor_id)->lockForUpdate()->firstOrFail();
                    $amount = $this->money($i->amount);
                    $refunded = bcadd($refunded, $amount, 2);
                    $p->update(['total_invested' => bcsub($this->money($p->total_invested), $amount, 2)]);
                    $i->update(['status' => 'refunded', 'refunded_amount' => $amount, 'refunded_at' => now(), 'refund_reason' => 'Campaña finalizada sin alcanzar meta']);
                    Transaction::create(['investment_id' => $i->id, 'user_id' => $i->investor_id, 'transaction_type' => 'refund', 'amount' => $amount, 'currency' => $c->currency]);
                    if ($i->reward_tier_id) {
                        RewardTier::whereKey($i->reward_tier_id)->where('current_claims', '>', 0)->decrement('current_claims');
                    }
                    RewardClaim::where('investment_id', $i->id)->update(['status' => 'cancelled']);
                    $this->notifier->send($i->investor_id, 'investment_refunded', 'Aporte reembolsado', $amount.' '.$c->currency.' de '.$c->title.' fueron devueltos a tu saldo.', $c->id);
                }
                $c->creator->entrepreneur()->decrement('total_raised', (float) $refunded);
                $c->update(['status' => 'failed', 'current_amount' => 0, 'investor_count' => 0]);
            } else {
                $c->update(['status' => 'completed']);
            }
            CampaignStatusHistory::create(['campaign_id' => $c->id, 'from_status' => $old, 'to_status' => $c->status, 'changed_by' => $actor, 'reason' => 'Finalización de campaña']);
            $this->notifier->send($c->creator_id,'campaign_'.$c->status,'Campaña finalizada',$c->title.': '.$c->status,$c->id);

            return $c->fresh();
        }, 3);
    }
}
