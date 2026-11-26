<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\CampaignFinancialMovement;
use App\Models\CampaignFinancialMovementHistory;
use App\Models\Investment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class FinancialMovementAudit
{
    public function createManual(Campaign $campaign, string $actor, array $data, ?UploadedFile $receipt): CampaignFinancialMovement
    {
        $storedPath = null;
        try {
            return DB::transaction(function () use ($campaign, $actor, $data, $receipt, &$storedPath) {
                Campaign::whereKey($campaign->id)->lockForUpdate()->firstOrFail();
                $storedPath = $receipt?->store('receipts', 'public');
                abort_if($receipt && ! $storedPath, 500, 'No se pudo guardar el comprobante.');
                $movement = $campaign->financialMovements()->create([
                    'created_by' => $actor, 'source' => 'manual', 'investment_id' => null,
                    'type' => $data['type'], 'concept' => $data['concept'], 'category' => $data['category'],
                    'amount' => $data['amount'], 'currency' => $campaign->currency, 'movement_date' => $data['movementDate'],
                    'reference_number' => $data['referenceNumber'] ?? null, 'notes' => $data['notes'] ?? null,
                    'receipt_url' => $storedPath ? '/storage/'.$storedPath : null,
                    'status' => 'pending', 'has_been_reviewed' => false, 'version' => 1,
                ])->fresh();
                $this->record($movement, $actor, 'created', null);

                return $movement;
            });
        } catch (\Throwable $e) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw $e;
        }
    }

    public function createSystem(Investment $investment, string $source, ?string $actor): CampaignFinancialMovement
    {
        abort_unless(in_array($source, ['investment', 'refund'], true), 422);

        return DB::transaction(function () use ($investment, $source, $actor) {
            Campaign::whereKey($investment->campaign_id)->lockForUpdate()->firstOrFail();
            $refund = $source === 'refund';
            $movement = CampaignFinancialMovement::create([
                'campaign_id' => $investment->campaign_id, 'created_by' => $investment->investor_id,
                'source' => $source, 'investment_id' => $investment->id,
                'type' => $refund ? 'expense' : 'income',
                'concept' => $refund ? 'Reembolso por meta no alcanzada' : 'Aporte de financiamiento',
                'category' => $refund ? 'Reembolsos' : 'Recaudación',
                'amount' => $refund ? $investment->refunded_amount : $investment->amount,
                'currency' => $investment->currency, 'movement_date' => now()->toDateString(),
                'reference_number' => $investment->id, 'status' => 'verified', 'version' => 1,
            ])->fresh();
            $this->record($movement, $actor, 'created', null);

            return $movement;
        });
    }

    public function update(Campaign $campaign, string $id, string $actor, array $attributes): CampaignFinancialMovement
    {
        return DB::transaction(function () use ($campaign, $id, $actor, $attributes) {
            $movement = $this->lock($campaign->id, $id);
            $this->assertManual($movement);
            $before = $movement->getAttributes();
            $movement->fill(Arr::only($attributes, ['concept', 'category', 'reference_number', 'notes']));
            if (! $movement->isDirty()) {
                return $movement;
            }
            $this->baseline($movement, $before);
            $this->invalidateReview($movement, $before);
            $movement->save();
            $this->record($movement->fresh(), $actor, 'updated', $before);

            return $movement->fresh();
        });
    }

    public function replaceReceipt(Campaign $campaign, string $id, string $actor, UploadedFile $receipt): CampaignFinancialMovement
    {
        $storedPath = null;
        try {
            return DB::transaction(function () use ($campaign, $id, $actor, $receipt, &$storedPath) {
                $movement = $this->lock($campaign->id, $id);
                $this->assertManual($movement);
                $before = $movement->getAttributes();
                $this->baseline($movement, $before);
                $storedPath = $receipt->store('receipts', 'public');
                abort_unless($storedPath, 500, 'No se pudo guardar el comprobante.');
                $movement->receipt_url = '/storage/'.$storedPath;
                $this->invalidateReview($movement, $before);
                $movement->save();
                $this->record($movement->fresh(), $actor, 'receipt_replaced', $before);

                return $movement->fresh();
            });
        } catch (\Throwable $e) {
            if ($storedPath) {
                Storage::disk('public')->delete($storedPath);
            }
            throw $e;
        }
    }

    public function delete(Campaign $campaign, string $id, string $actor): void
    {
        DB::transaction(function () use ($campaign, $id, $actor) {
            $movement = $this->lock($campaign->id, $id);
            $this->assertManual($movement);
            abort_unless($movement->status === 'pending' && ! $movement->hasReview(), 422, 'Solo se pueden retirar movimientos manuales pendientes que nunca fueron revisados.');
            $before = $movement->getAttributes();
            $this->baseline($movement, $before);
            $movement->version++;
            $movement->save();
            $movement->delete();
            $this->record($movement->fresh(), $actor, 'deleted', $before);
        });
    }

    public function review(CampaignFinancialMovement $original, string $actor, array $data): CampaignFinancialMovement
    {
        return DB::transaction(function () use ($original, $actor, $data) {
            $movement = $this->lock($original->campaign_id, $original->id);
            $this->assertManual($movement);
            abort_unless($movement->version === (int) $data['version'], 409, 'El movimiento cambió desde que lo abriste. Vuelve a cargarlo y revisa su versión actual.');
            $before = $movement->getAttributes();
            $this->baseline($movement, $before);
            $status = ['approve' => 'verified', 'flag' => 'flagged', 'reject' => 'rejected', 'reset' => 'pending'][$data['action']];
            $movement->update(['status' => $status, 'reviewed_by' => $actor, 'reviewed_at' => now(), 'review_notes' => $data['notes'] ?? null, 'has_been_reviewed' => true, 'version' => $movement->version + 1]);
            $this->record($movement->fresh(), $actor, 'reviewed', $before);
            $campaign = $movement->campaign;
            $label = ['approve' => 'aprobado y verificado', 'flag' => 'marcado con observaciones', 'reject' => 'rechazado', 'reset' => 'puesto en revisión pendiente'][$data['action']];
            app(Notifier::class)->send($campaign->creator_id, 'financial_movement_'.$status, 'Auditoría de gasto: '.$campaign->title, "El movimiento '{$movement->concept}' ({$movement->currency} {$movement->amount}) ha sido {$label} por la administración.".(! empty($data['notes']) ? "\nObservaciones: ".$data['notes'] : ''), $campaign->id);

            return $movement->fresh();
        });
    }

    public function history(CampaignFinancialMovement $movement): array
    {
        return $movement->history()->with(['actor.admin', 'actor.entrepreneur'])->get()->map(function ($entry) {
            $profile = $entry->actor?->admin ?? $entry->actor?->entrepreneur;
            $name = trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? ''));

            $automaticRefund = $entry->actor_id === null && $entry->action === 'created' && ($entry->after['source'] ?? null) === 'refund';

            return ['id' => $entry->id, 'actorId' => $entry->actor_id, 'actorName' => $name ?: ($entry->actor?->email ?? ($automaticRefund ? 'Sistema (cierre automático)' : 'Sin autor registrado')), 'action' => $entry->action, 'version' => $entry->version, 'before' => $entry->before, 'after' => $entry->after, 'createdAt' => $entry->created_at->toIso8601String()];
        })->all();
    }

    private function lock(string $campaignId, string $id): CampaignFinancialMovement
    {
        Campaign::whereKey($campaignId)->lockForUpdate()->firstOrFail();

        return CampaignFinancialMovement::where('campaign_id', $campaignId)->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function assertManual(CampaignFinancialMovement $movement): void
    {
        abort_unless($movement->source === 'manual' && $movement->investment_id === null, 422, 'Los movimientos automáticos y los de origen heredado sin confirmar no se pueden modificar ni revisar manualmente.');
    }

    private function invalidateReview(CampaignFinancialMovement $movement, array $before): void
    {
        $original = new CampaignFinancialMovement;
        $original->setRawAttributes($before);
        $movement->has_been_reviewed = $original->hasReview();
        $movement->status = 'pending';
        $movement->reviewed_by = null;
        $movement->reviewed_at = null;
        $movement->review_notes = null;
        $movement->version = ((int) $before['version']) + 1;
    }

    private function baseline(CampaignFinancialMovement $movement, array $before): void
    {
        if (! $movement->history()->exists()) {
            CampaignFinancialMovementHistory::create(['movement_id' => $movement->id, 'campaign_id' => $movement->campaign_id, 'actor_id' => null, 'action' => 'legacy_snapshot', 'version' => $before['version'], 'before' => null, 'after' => $before, 'created_at' => now()]);
        }
    }

    private function record(CampaignFinancialMovement $movement, ?string $actor, string $action, ?array $before): void
    {
        CampaignFinancialMovementHistory::create(['movement_id' => $movement->id, 'campaign_id' => $movement->campaign_id, 'actor_id' => $actor, 'action' => $action, 'version' => $movement->version, 'before' => $before, 'after' => $movement->getAttributes(), 'created_at' => now()]);
    }
}
