<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class RepairUpdateMilestones extends Command
{
    protected $signature = 'campaigns:repair-update-milestones {--apply : Respaldar y retirar vínculos incorrectos; ejecutar con las escrituras detenidas}';

    protected $description = 'Detecta vínculos entre actualizaciones e hitos de otra campaña; sin --apply no modifica datos';

    public function handle(): int
    {
        try {
            $this->info('Vínculos incorrectos detectados: '.$this->invalidLinks()->count());
            if (! $this->option('apply')) {
                $this->line('No se modificaron datos. Usa --apply con las escrituras detenidas para corregir los vínculos y conservar un respaldo privado.');

                return self::SUCCESS;
            }
            $result = DB::transaction(function () {
                $rows = $this->invalidLinks()->orderBy('id')->lockForUpdate()->get(['id', 'campaign_id', 'milestone_id']);
                if ($rows->isEmpty()) {
                    return ['count' => 0, 'backup' => null];
                }
                $links = $rows->map(fn ($row) => ['updateId' => $row->id, 'campaignId' => $row->campaign_id, 'milestoneId' => $row->milestone_id])->all();
                $backup = 'milestone-link-repairs/'.Str::uuid().'.json';
                $contents = json_encode(['createdAt' => now()->toIso8601String(), 'links' => $links], JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT);
                if (! Storage::disk('local')->put($backup, $contents, ['visibility' => 'private'])) {
                    throw new RuntimeException('No se pudo guardar el respaldo privado. No se corrigieron vínculos.');
                }
                foreach ($rows as $row) {
                    $changed = DB::table('campaign_updates')->where('id', $row->id)->where('campaign_id', $row->campaign_id)->where('milestone_id', $row->milestone_id)->update(['milestone_id' => null]);
                    if ($changed !== 1) {
                        throw new RuntimeException('Un vínculo cambió durante la corrección. Se revirtió la operación; detén las escrituras y vuelve a comprobar.');
                    }
                }

                return ['count' => $rows->count(), 'backup' => $backup];
            });
            $this->info('Vínculos corregidos: '.$result['count']);
            if ($result['backup']) {
                $this->line('Respaldo en almacenamiento privado: '.$result['backup']);
            }

            return self::SUCCESS;
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }

    private function invalidLinks(): Builder
    {
        return DB::table('campaign_updates')->whereNotNull('milestone_id')->whereNotExists(function ($query) {
            $query->selectRaw('1')->from('campaign_milestones')
                ->whereColumn('campaign_milestones.id', 'campaign_updates.milestone_id')
                ->whereColumn('campaign_milestones.campaign_id', 'campaign_updates.campaign_id');
        });
    }
}
