<?php

namespace App\Services;

use App\Models\Campaign;

class CampaignFinance
{
    public function progress(Campaign $campaign): array
    {
        $all = $campaign->investments()->with(['investor.investor', 'reward'])->orderBy('created_at')->get();
        $paid = $all->where('status', 'completed');
        $accumulated = 0;
        $daily = $paid->groupBy(fn ($i) => $i->created_at->toDateString())->map(function ($items, $date) use (&$accumulated) {
            $accumulated = round($accumulated + $items->sum('amount'), 2);

            return ['date' => $date, 'accumulatedAmount' => $accumulated];
        })->values()->all();

        return [
            'campaignId' => $campaign->id, 'title' => $campaign->title, 'slug' => $campaign->slug, 'status' => $campaign->status,
            'currentAmount' => $campaign->current_amount, 'goalAmount' => $campaign->goal_amount, 'remainingAmount' => max(0, round($campaign->goal_amount - $campaign->current_amount, 2)),
            'fundingPercentage' => $campaign->goal_amount > 0 ? round($campaign->current_amount / $campaign->goal_amount * 100, 2) : 0, 'investorCount' => $campaign->investor_count, 'currency' => $campaign->currency,
            'startDate' => $campaign->start_date, 'endDate' => $campaign->end_date, 'daysRemaining' => $campaign->end_date ? max(0, (int) ceil(now()->diffInDays($campaign->end_date, false))) : null, 'fundedAt' => $campaign->funded_at,
            'investments' => ['total' => $all->count(), 'completed' => $paid->count(), 'pending' => $all->where('status', 'pending')->count(), 'failed' => $all->where('status', 'failed')->count(), 'refunded' => $all->where('status', 'refunded')->count()],
            'amounts' => ['confirmed' => (float) $paid->sum('amount'), 'pending' => (float) $all->where('status', 'pending')->sum('amount'), 'refunded' => (float) $all->sum('refunded_amount')],
            'averageInvestment' => (float) ($paid->avg('amount') ?? 0), 'largestInvestment' => (float) ($paid->max('amount') ?? 0), 'smallestInvestment' => (float) ($paid->min('amount') ?? 0),
            'recentInvestments' => $all->reverse()->take(10)->map(fn ($i) => ['id' => $i->id, 'amount' => $i->amount, 'currency' => $i->currency, 'status' => $i->status, 'isAnonymous' => $i->is_anonymous, 'investorDisplayName' => $i->is_anonymous ? 'Anónimo' : ($i->investor?->investor?->display_name ?? $i->investor?->investor?->first_name ?? 'Usuario'), 'rewardTitle' => $i->reward?->title, 'createdAt' => $i->created_at])->values()->all(),
            'dailyProgress' => $daily, 'fundingBreakdown' => $paid->groupBy(fn ($i) => $i->reward_tier_id ?? 'none')->map(fn ($items) => ['rewardTierId' => $items->first()->reward_tier_id, 'rewardTitle' => $items->first()->reward?->title ?? 'Sin recompensa', 'totalAmount' => (float) $items->sum('amount')])->values()->all(),
        ];
    }

    public function analytics(Campaign $c): array
    {
        $progress = $this->progress($c);
        $days = max(1, (int) ceil(($c->start_date ?? $c->created_at)->diffInDays(now())));
        $rate = $c->current_amount / $days;
        $fee = round($c->current_amount * 0.05, 2);

        return [...$progress, 'grossAmount' => $c->current_amount, 'platformFeePercentage' => 5, 'platformFee' => $fee, 'netAmount' => round($c->current_amount - $fee, 2), 'daysElapsed' => $days, 'dailyRate' => round($rate, 2), 'projectedRemainingDays' => $rate > 0 ? (int) ceil(max(0, $c->goal_amount - $c->current_amount) / $rate) : null];
    }
}
