<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_financial_movements', function (Blueprint $table) {
            // Unknown historical origin is deliberately read-only until reconciled.
            $table->string('source', 20)->default('legacy');
            $table->foreignUuid('investment_id')->nullable()->constrained()->restrictOnDelete();
            $table->unsignedInteger('version')->default(1);
            $table->boolean('has_been_reviewed')->default(false);
            $table->softDeletes();
            $table->unique(['investment_id', 'source'], 'financial_movement_investment_source_unique');
        });
        Schema::create('campaign_financial_movement_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('movement_id')->constrained('campaign_financial_movements')->restrictOnDelete();
            $table->foreignUuid('campaign_id')->constrained()->restrictOnDelete();
            // Preserve the identifier even if an account is removed in the future.
            $table->uuid('actor_id')->nullable()->index();
            $table->string('action', 30);
            $table->unsignedInteger('version');
            $table->json('before')->nullable();
            $table->json('after');
            $table->timestamp('created_at');
            $table->unique(['movement_id', 'version'], 'financial_movement_history_version_unique');
        });

        DB::transaction(function () {
            $rows = DB::table('campaign_financial_movements')->get();
            $origins = [];
            $counts = [];
            foreach ($rows as $row) {
                $matches = $this->matchingInvestments($row);
                $origin = ['source' => 'legacy', 'investment_id' => null];
                if (count($matches) === 1) {
                    $origin = ['source' => $row->type === 'income' ? 'investment' : 'refund', 'investment_id' => $matches[0]];
                    $key = $origin['source'].':'.$matches[0];
                    $counts[$key] = ($counts[$key] ?? 0) + 1;
                } elseif ($matches === [] && $row->created_by && DB::table('campaigns')->where('id', $row->campaign_id)->where('creator_id', $row->created_by)->exists()
                    && ! DB::table('investments')->where('campaign_id', $row->campaign_id)->where('investor_id', $row->created_by)->exists()) {
                    $origin['source'] = 'manual';
                }
                $origins[$row->id] = $origin;
            }
            foreach ($rows as $row) {
                $origin = $origins[$row->id];
                if ($origin['investment_id'] && $counts[$origin['source'].':'.$origin['investment_id']] !== 1) {
                    $origin = ['source' => 'legacy', 'investment_id' => null];
                }
                $reviewed = $row->reviewed_at !== null || $row->reviewed_by !== null || $row->review_notes !== null || in_array($row->status, ['verified', 'audited', 'flagged', 'rejected'], true);
                DB::table('campaign_financial_movements')->where('id', $row->id)->update([...$origin, 'has_been_reviewed' => $reviewed]);
                $snapshot = (array) DB::table('campaign_financial_movements')->where('id', $row->id)->first();
                DB::table('campaign_financial_movement_history')->insert([
                    'id' => (string) Str::uuid(), 'movement_id' => $row->id, 'campaign_id' => $row->campaign_id,
                    'actor_id' => null, 'action' => 'legacy_snapshot', 'version' => 1, 'before' => null,
                    'after' => json_encode($snapshot, JSON_THROW_ON_ERROR), 'created_at' => now(),
                ]);
            }
        });
    }

    private function matchingInvestments(object $movement): array
    {
        if (! $movement->created_by || ! in_array($movement->type, ['income', 'expense'], true)) {
            return [];
        }
        $matches = [];
        $transactionType = $movement->type === 'income' ? 'payment' : 'refund';
        foreach (DB::table('investments')->where('campaign_id', $movement->campaign_id)->where('investor_id', $movement->created_by)->get() as $investment) {
            $expected = $movement->type === 'income' ? $investment->amount : $investment->refunded_amount;
            if ($investment->currency !== $movement->currency || bccomp((string) $expected, (string) $movement->amount, 2) !== 0) {
                continue;
            }
            $transactions = DB::table('transactions')->where('investment_id', $investment->id)->where('transaction_type', $transactionType)->where('status', 'completed')->where('currency', $movement->currency)->get();
            foreach ($transactions as $transaction) {
                if (bccomp((string) $transaction->amount, (string) $movement->amount, 2) !== 0) {
                    continue;
                }
                $referenceMatches = $movement->reference_number === $investment->id;
                $dateMatches = substr((string) $movement->movement_date, 0, 10) === substr((string) $transaction->created_at, 0, 10);
                if ($referenceMatches) {
                    return [$investment->id];
                }
                if ($dateMatches) {
                    $matches[] = $investment->id;
                    break;
                }
            }
        }

        return $matches;
    }

    public function down(): void
    {
        Schema::dropIfExists('campaign_financial_movement_history');
        Schema::table('campaign_financial_movements', function (Blueprint $table) {
            $table->dropUnique('financial_movement_investment_source_unique');
            $table->dropForeign(['investment_id']);
            $table->dropColumn(['source', 'investment_id', 'version', 'has_been_reviewed', 'deleted_at']);
        });
    }
};
