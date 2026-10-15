<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
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
        return Api::ok(Investment::with(['campaign', 'reward'])->where('investor_id', $r->user()->id)->latest()->get()->map(fn ($i) => ['id' => $i->id, 'amount' => $i->amount, 'investmentStatus' => $i->status, 'createdAt' => $i->created_at, 'campaignId' => $i->campaign_id, 'campaignTitle' => $i->campaign->title, 'campaignType' => $i->campaign->campaign_type, 'campaignGoal' => $i->campaign->goal_amount, 'campaignCoverImage' => $i->campaign->cover_image_url, 'campaignStatus' => $i->campaign->status, 'rewardTitle' => $i->reward?->title]));
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
