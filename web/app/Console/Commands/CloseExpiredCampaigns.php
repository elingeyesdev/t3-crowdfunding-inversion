<?php

namespace App\Console\Commands;

use App\Models\Campaign;
use App\Services\InvestmentEngine;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CloseExpiredCampaigns extends Command
{
    protected $signature = 'campaigns:close-expired {--dry-run : List eligible campaigns without changing data} {--chunk=100 : Read batch size (1-1000)}';

    protected $description = 'Close expired public campaigns and refund unsuccessful contributions';

    public function handle(InvestmentEngine $engine): int
    {
        $chunk = filter_var($this->option('chunk'), FILTER_VALIDATE_INT);
        if ($chunk === false || $chunk < 1 || $chunk > 1000) {
            $this->error('El tamaño de lote debe ser un entero entre 1 y 1000.');

            return self::INVALID;
        }
        $dryRun = (bool) $this->option('dry-run');
        $selected = $closed = $skipped = $failed = 0;
        foreach (Campaign::awaitingClosure()->select(['id', 'status', 'end_date'])->lazyById($chunk) as $campaign) {
            $selected++;
            if ($dryRun) {
                $this->line($campaign->id.' | '.$campaign->status.' | '.$campaign->end_date->toIso8601String());

                continue;
            }
            try {
                $result = $engine->finalizeExpired($campaign);
                if ($result) {
                    $closed++;
                    Log::info('Campaign closed automatically', ['campaign_id' => $result->id, 'status' => $result->status]);
                } else {
                    $skipped++;
                }
            } catch (\Throwable $error) {
                $failed++;
                $this->error('No se pudo cerrar la campaña '.$campaign->id.'. Se reintentará en la siguiente ejecución.');
                Log::error('Automatic campaign closure failed', ['campaign_id' => $campaign->id, 'exception' => $error::class]);
                report($error);
            }
        }
        $this->info(($dryRun ? 'Simulación: ' : '')."Seleccionadas: {$selected}; cerradas: {$closed}; omitidas: {$skipped}; fallidas: {$failed}.");
        if (! $dryRun && $selected > 0) {
            Log::info('Automatic campaign closure summary', compact('selected', 'closed', 'skipped', 'failed'));
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
