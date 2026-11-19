<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\CampaignUpdate;
use App\Models\Investment;
use App\Services\CampaignFinance;
use App\Services\InvestmentEngine;
use App\Support\Api;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class InvestmentController extends Controller
{
    public function store(Request $r, InvestmentEngine $engine)
    {
        $data = $r->validate(['campaignId' => 'required|uuid|exists:campaigns,id', 'amount' => 'required|numeric|min:0.01|max:9999999999999.99|decimal:0,2', 'rewardTierId' => 'nullable|uuid']);

        return Api::ok($engine->invest($r->user()->id, $data), 201);
    }

    public function index(Request $r)
    {
        $history = Investment::with(['campaign', 'reward', 'rewardClaim'])->where('investor_id', $r->user()->id)->latest()->get()->map(fn ($i) => [
            'id' => $i->id, 'amount' => $i->amount, 'currency' => $i->currency,
            'investmentStatus' => $i->status, 'createdAt' => $i->created_at,
            'campaignId' => $i->campaign_id, 'campaignTitle' => $i->campaign->title,
            'campaignType' => $i->campaign->campaign_type, 'campaignGoal' => $i->campaign->goal_amount,
            'campaignCoverImage' => $i->campaign->cover_image_url, 'campaignStatus' => $i->campaign->status,
            'rewardTierId' => $i->reward_tier_id, 'rewardTitle' => $i->reward?->title,
            'rewardDescription' => $i->reward?->description, 'rewardEstimatedDelivery' => $i->reward?->estimated_delivery,
            'rewardImageUrl' => $i->reward?->image_url, 'rewardClaimId' => $i->rewardClaim?->id,
            'rewardClaimStatus' => $i->rewardClaim?->status,
            'trackingNumber' => $i->rewardClaim?->tracking_number, 'trackingUrl' => $i->rewardClaim?->tracking_url,
            'shippedAt' => $i->rewardClaim?->shipped_at, 'deliveredAt' => $i->rewardClaim?->delivered_at,
        ]);

        // Reward descriptions and tracking metadata must not mint private-file URLs.
        return response()->json(['data' => Api::camel($history), 'message' => 'Operación exitosa', 'statusCode' => 200]);
    }

    public function backedUpdates(Request $r)
    {
        $data = $r->validate(['page' => 'sometimes|integer|min:1', 'limit' => 'sometimes|integer|min:1|max:100', 'campaignId' => 'nullable|uuid']);
        $campaigns = Campaign::query()->publiclyReadable()->whereHas('investments', function ($investments) use ($r) {
            $investments->where('investor_id', $r->user()->id)->whereIn('status', ['completed', 'refunded']);
        });
        $options = (clone $campaigns)->orderBy('title')->orderBy('id')->get(['id', 'title']);
        // EXISTS in the campaign query prevents duplicate updates for repeat donors.
        $updates = CampaignUpdate::query()->where('is_public', true)
            ->whereIn('campaign_id', (clone $campaigns)->select('campaigns.id'))
            ->with(['campaign', 'author.entrepreneur', 'author.investor'])
            ->when($data['campaignId'] ?? null, fn ($query, $id) => $query->where('campaign_id', $id))
            ->orderByDesc('created_at')->orderByDesc('id');
        $page = Api::page($updates, $r, function ($update) {
            $profile = $update->author?->entrepreneur ?? $update->author?->investor;

            return [
                'id' => $update->id, 'campaignId' => $update->campaign_id,
                'title' => $update->title, 'content' => $update->content,
                'attachments' => $update->attachments ?? [],
                'createdAt' => $update->created_at, 'updatedAt' => $update->updated_at,
                'campaignTitle' => $update->campaign->title,
                'campaignCoverImage' => $update->campaign->cover_image_url,
                'campaignCurrentAmount' => $update->campaign->current_amount,
                'campaignGoalAmount' => $update->campaign->goal_amount,
                'entrepreneurName' => trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? '')) ?: 'Usuario',
                'entrepreneurDisplayName' => $profile?->display_name,
                'entrepreneurAvatar' => $profile?->avatar_url,
            ];
        });

        // Neither public content nor metadata may mint signed private-file links.
        return response()->json(['data' => Api::camel([...$page, 'campaigns' => $options]), 'message' => 'Operación exitosa', 'statusCode' => 200]);
    }

    public function receipt(Request $r, Investment $investment)
    {
        abort_unless($investment->investor_id === $r->user()->id, 404);

        return Pdf::loadView('pdf.receipt', ['investment' => $investment->load(['campaign', 'reward', 'investor.investor'])])->download('recibo_inversion_'.$investment->id.'.pdf');
    }

    public function report(Request $r, Campaign $campaign, CampaignFinance $finance)
    {
        CampaignController::authorizeOwner($r, $campaign, true);
        $r->validate(['format' => 'sometimes|in:csv,pdf']);
        $investments = $campaign->investments()->with(['investor.investor', 'reward'])->oldest()->get();
        if ($r->input('format') === 'csv') {
            return response()->streamDownload(function () use ($investments) {
                $out = fopen('php://output', 'w');
                fwrite($out, "\xEF\xBB\xBF");
                fputcsv($out, ['ID', 'Inversor', 'Email', 'Monto', 'Divisa', 'Recompensa', 'Fecha', 'Estado'], ',', '"', '');
                foreach ($investments as $i) {
                    $row = [$i->id, $i->investor?->investor?->display_name ?? $i->investor?->investor?->first_name ?? 'Usuario', $i->investor?->email, $i->amount, $i->currency, $i->reward?->title, $i->created_at->toIso8601String(), $i->status];
                    // Escape formula prefixes when the CSV is opened in a spreadsheet.
                    $row = array_map(fn ($v) => is_string($v) && preg_match('/^[=+@\-\t\r]/', $v) ? "'".$v : $v, $row);
                    fputcsv($out, $row, ',', '"', '');
                }
                fclose($out);
            }, 'reporte_'.$campaign->slug.'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        return Pdf::loadView('pdf.report', ['campaign' => $campaign, 'finance' => $finance->analytics($campaign), 'investments' => $investments])->download('reporte_'.$campaign->slug.'.pdf');
    }
}
