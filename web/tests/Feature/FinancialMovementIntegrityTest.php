<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignFinancialMovement;
use App\Models\CampaignFinancialMovementHistory;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\Investment;
use App\Models\InvestorProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class FinancialMovementIntegrityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        Storage::fake('public');
    }

    private function account(string $role = 'entrepreneur'): User
    {
        $user = User::create(['email_verified' => true, 'email' => Str::uuid().'@example.test']);
        $user->assignRole($role);
        if ($role === 'entrepreneur') {
            EntrepreneurProfile::create(['user_id' => $user->id, 'first_name' => 'Ana', 'last_name' => 'Perez']);
        } elseif ($role === 'investor') {
            InvestorProfile::create(['user_id' => $user->id, 'max_investment' => 1000]);
        }

        return $user;
    }

    private function asUser(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function campaign(User $owner): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Financial integrity campaign', 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => 'published']);
    }

    private function base(Campaign $campaign): string
    {
        return '/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/financial-movements';
    }

    private function manual(User $owner, Campaign $campaign, array $extra = []): CampaignFinancialMovement
    {
        $id = $this->asUser($owner)->postJson($this->base($campaign), [...[
            'type' => 'expense', 'concept' => 'Equipment purchase', 'category' => 'Equipment',
            'amount' => 100, 'movementDate' => now()->toDateString(), 'notes' => 'Original note',
        ], ...$extra])->assertCreated()->json('data.id');

        return CampaignFinancialMovement::findOrFail($id);
    }

    private function review(User $admin, CampaignFinancialMovement $movement, string $action = 'approve')
    {
        return $this->asUser($admin)->postJson('/api/v1/admin/financial-movements/'.$movement->id.'/review', ['action' => $action, 'version' => $movement->fresh()->version, 'notes' => 'Reviewed supporting document']);
    }

    public function test_manual_income_and_expenses_start_pending_with_an_audit_record(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        foreach (['income', 'expense'] as $type) {
            $movement = $this->manual($owner, $campaign, ['type' => $type]);
            $this->assertSame('manual', $movement->source);
            $this->assertNull($movement->investment_id);
            $this->assertSame('pending', $movement->status);
            $this->assertSame(1, $movement->version);
            $this->assertFalse($movement->has_been_reviewed);
            $entry = $movement->history()->sole();
            $this->assertSame('created', $entry->action);
            $this->assertSame($owner->id, $entry->actor_id);
            $this->assertNull($entry->before);
            $this->assertEquals(100, $entry->after['amount']);
        }
        $this->assertEquals(0, $campaign->fresh()->current_amount);
        $this->asUser($owner)->patchJson($this->base($campaign).'/'.$movement->id, ['source' => null, 'investmentId' => null, 'notes' => 'Safe correction'])->assertOk()->assertJsonPath('data.source', 'manual');
        $this->patchJson($this->base($campaign).'/'.$movement->id, ['source' => 'investment'])->assertUnprocessable()->assertJsonValidationErrors('source');
        $this->asUser($owner)->postJson($this->base($campaign), ['source' => 'investment', 'investmentId' => (string) Str::uuid(), 'status' => 'verified', 'type' => 'income', 'concept' => 'Forged record', 'category' => 'Equipment', 'amount' => 100, 'movementDate' => now()->toDateString()])->assertUnprocessable()->assertJsonValidationErrors(['source', 'investmentId', 'status']);
    }

    public function test_correcting_a_reviewed_record_invalidates_approval_and_preserves_every_version(): void
    {
        $owner = $this->account();
        $admin = $this->account('admin');
        $campaign = $this->campaign($owner);
        $movement = $this->manual($owner, $campaign);
        $this->review($admin, $movement)->assertOk()->assertJsonPath('data.version', 2);

        $this->asUser($owner)->patchJson($this->base($campaign).'/'.$movement->id, ['concept' => 'Corrected purchase', 'referenceNumber' => 'INVOICE-2'])->assertOk()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.version', 3)->assertJsonPath('data.reviewedBy', null)->assertJsonPath('data.reviewedAt', null)->assertJsonPath('data.reviewNotes', null)->assertJsonPath('data.hasBeenReviewed', true);
        $this->deleteJson($this->base($campaign).'/'.$movement->id)->assertUnprocessable();
        $entries = $movement->history()->get();
        $this->assertSame(['created', 'reviewed', 'updated'], $entries->pluck('action')->all());
        $this->assertSame($admin->id, $entries[1]->actor_id);
        $this->assertSame('verified', $entries[1]->after['status']);
        $this->assertSame('Equipment purchase', $entries[2]->before['concept']);
        $this->assertSame('Reviewed supporting document', $entries[2]->before['review_notes']);
        $this->assertSame('Corrected purchase', $entries[2]->after['concept']);
        $this->assertEquals(100, $movement->fresh()->amount);
        $this->review($admin, $movement)->assertOk()->assertJsonPath('data.status', 'verified')->assertJsonPath('data.version', 4);
    }

    public function test_noop_patch_does_not_invalidate_a_review(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $movement = $this->manual($owner, $campaign);
        $this->review($this->account('admin'), $movement)->assertOk();
        $this->asUser($owner)->patchJson($this->base($campaign).'/'.$movement->id, ['concept' => $movement->concept])->assertOk()->assertJsonPath('data.status', 'verified')->assertJsonPath('data.version', 2);
        $this->assertSame(2, $movement->history()->count());
    }

    public function test_replacing_a_receipt_keeps_the_original_file_and_requires_new_review(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $movement = $this->manual($owner, $campaign);
        $url = $this->post($this->base($campaign).'/'.$movement->id.'/receipt', ['receipt' => UploadedFile::fake()->create('first.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])->assertOk()->json('data.receiptUrl');
        $this->review($this->account('admin'), $movement)->assertOk();
        $new = $this->asUser($owner)->post($this->base($campaign).'/'.$movement->id.'/receipt', ['receipt' => UploadedFile::fake()->create('replacement.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.reviewedBy', null)->json('data.receiptUrl');
        $this->assertNotSame($url, $new);
        Storage::disk('public')->assertExists([substr($url, 9), substr($new, 9)]);
        $entry = $movement->history()->get()->last();
        $this->assertSame('receipt_replaced', $entry->action);
        $this->assertSame($url, $entry->before['receipt_url']);
        $this->assertSame($new, $entry->after['receipt_url']);
    }

    public function test_review_and_reset_cannot_be_used_to_make_a_record_deletable(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $admin = $this->account('admin');
        foreach (['approve', 'flag', 'reject', 'reset'] as $action) {
            $movement = $this->manual($owner, $campaign);
            $this->review($admin, $movement, $action)->assertOk();
            $this->asUser($owner)->deleteJson($this->base($campaign).'/'.$movement->id)->assertUnprocessable();
            $this->patchJson($this->base($campaign).'/'.$movement->id, ['notes' => 'Correction after review'])->assertOk()->assertJsonPath('data.status', 'pending');
            $this->deleteJson($this->base($campaign).'/'.$movement->id)->assertUnprocessable();
        }
    }

    public function test_pending_deletion_is_recoverable_in_history_and_excluded_from_ledgers(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $movement = $this->manual($owner, $campaign);
        $path = $this->base($campaign).'/'.$movement->id;
        $this->deleteJson($path)->assertOk();
        $this->assertSoftDeleted('campaign_financial_movements', ['id' => $movement->id]);
        $this->getJson($path.'/history')->assertOk()->assertJsonPath('data.1.action', 'deleted')->assertJsonPath('data.1.before.concept', 'Equipment purchase');
        $this->getJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/financial-ledger')->assertOk()->assertJsonPath('data.summary.totalExpense', 0);
        $this->deleteJson($path)->assertNotFound();
        $this->patchJson($path, ['notes' => 'Cannot restore by editing'])->assertNotFound();
        $this->asUser($this->account('admin'))->getJson('/api/v1/admin/financial-movements/'.$movement->id.'/history')->assertOk()->assertJsonCount(2, 'data');
        $campaign->update(['status' => 'draft']);
        $this->asUser($owner)->deleteJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id)->assertUnprocessable();
    }

    public function test_payments_and_refunds_are_linked_immutable_and_keep_balances_consistent(): void
    {
        $owner = $this->account();
        $investor = $this->account('investor');
        $campaign = $this->campaign($owner);
        $investmentId = $this->asUser($investor)->postJson('/api/v1/investments', ['campaignId' => $campaign->id, 'amount' => 100])->assertCreated()->json('data.ticket.id');
        $this->asUser($owner)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/finalize')->assertOk();
        $rows = $campaign->financialMovements()->get();
        $this->assertCount(2, $rows);
        $this->assertEquals(0, $investor->investor->fresh()->total_invested);
        $this->assertEquals(0, $campaign->fresh()->current_amount);
        foreach ($rows as $movement) {
            $this->assertSame($investmentId, $movement->investment_id);
            $this->assertContains($movement->source, ['investment', 'refund']);
            $this->assertSame(1, $movement->history()->count());
            // Even a historical reference edit cannot disable immutable provenance.
            DB::table('campaign_financial_movements')->where('id', $movement->id)->update(['reference_number' => null]);
            $path = $this->base($campaign).'/'.$movement->id;
            $this->asUser($owner)->patchJson($path, ['notes' => 'Not allowed'])->assertUnprocessable();
            $this->deleteJson($path)->assertUnprocessable();
            $this->post($path.'/receipt', ['receipt' => UploadedFile::fake()->create('file.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])->assertUnprocessable();
            $this->review($this->account('admin'), $movement)->assertUnprocessable();
        }
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->assertEquals(100, $rows->where('type', 'income')->sum('amount'));
        $this->assertEquals(100, $rows->where('type', 'expense')->sum('amount'));
    }

    public function test_manual_invoice_reference_does_not_determine_its_origin(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $movement = $this->manual($owner, $campaign, ['type' => 'income', 'referenceNumber' => (string) Str::uuid()]);
        $this->patchJson($this->base($campaign).'/'.$movement->id, ['referenceNumber' => null])->assertOk()->assertJsonPath('data.source', 'manual');
        $this->deleteJson($this->base($campaign).'/'.$movement->id)->assertOk();
    }

    public function test_stale_admin_review_is_rejected_without_new_history(): void
    {
        $owner = $this->account();
        $admin = $this->account('admin');
        $campaign = $this->campaign($owner);
        $movement = $this->manual($owner, $campaign);
        $this->patchJson($this->base($campaign).'/'.$movement->id, ['notes' => 'New evidence'])->assertOk();
        $path = '/api/v1/admin/financial-movements/'.$movement->id.'/review';
        $this->asUser($admin)->postJson($path, ['action' => 'approve'])->assertUnprocessable()->assertJsonValidationErrors('version');
        $this->postJson($path, ['action' => 'approve', 'version' => 1])->assertConflict();
        $this->assertSame('pending', $movement->fresh()->status);
        $this->assertSame(2, $movement->history()->count());
        $this->postJson($path, ['action' => 'approve', 'version' => '2'])->assertOk();
        $this->postJson($path, ['action' => 'reject', 'version' => 2, 'notes' => 'Stale second reviewer'])->assertConflict();
        $this->assertSame('verified', $movement->fresh()->status);
    }

    public function test_history_is_private_and_scoped_to_the_campaign(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $movement = $this->manual($owner, $campaign);
        $path = $this->base($campaign).'/'.$movement->id.'/history';
        $this->asUser(null)->getJson($path)->assertUnauthorized();
        $this->asUser($this->account())->getJson($path)->assertForbidden();
        $other = $this->campaign($owner);
        $this->asUser($owner)->getJson($this->base($other).'/'.$movement->id.'/history')->assertNotFound();
        $this->getJson('/api/v1/campaigns/'.$campaign->id.'/financial-ledger')->assertOk()->assertJsonMissingPath('data.history')->assertJsonMissingPath('data.movements.0.version');
        $this->asUser($this->account('admin'))->getJson('/api/v1/admin/financial-movements/'.$movement->id)->assertOk()->assertJsonPath('data.version', 1)->assertJsonPath('data.canReview', true)->assertJsonCount(1, 'data.history');
    }

    public function test_history_failure_rolls_back_review_and_file_changes(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $movement = $this->manual($owner, $campaign);
        $fail = true;
        CampaignFinancialMovementHistory::creating(function () use (&$fail): void {
            if ($fail) {
                throw new \RuntimeException('Simulated history failure');
            }
        });
        try {
            $this->review($this->account('admin'), $movement)->assertStatus(500);
            $this->asUser($owner)->post($this->base($campaign).'/'.$movement->id.'/receipt', ['receipt' => UploadedFile::fake()->create('new.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])->assertStatus(500);
        } finally {
            $fail = false;
        }
        $this->assertSame('pending', $movement->fresh()->status);
        $this->assertSame(1, $movement->fresh()->version);
        $this->assertNull($movement->fresh()->receipt_url);
        $this->assertSame(1, $movement->history()->count());
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_audit_entries_cannot_be_rewritten_through_the_model(): void
    {
        $owner = $this->account();
        $movement = $this->manual($owner, $this->campaign($owner));
        $entry = $movement->history()->sole();
        foreach (['update', 'delete'] as $operation) {
            try {
                $operation === 'update' ? $entry->update(['action' => 'rewritten']) : $entry->delete();
                $this->fail('Audit history must be append-only.');
            } catch (\LogicException) {
                $this->assertSame('created', $entry->fresh()->action);
            }
        }
    }

    public function test_upgrade_preserves_money_and_records_a_conservative_origin_snapshot(): void
    {
        $migration = require database_path('migrations/2026_11_15_000001_preserve_financial_movement_integrity.php');
        $migration->down();
        $owner = $this->account();
        $investor = $this->account('investor');
        $campaign = $this->campaign($owner);
        $investment = Investment::create(['campaign_id' => $campaign->id, 'investor_id' => $investor->id, 'amount' => 100, 'currency' => 'BOB', 'status' => 'refunded', 'refunded_amount' => 100]);
        foreach (['payment', 'refund'] as $type) {
            DB::table('transactions')->insert(['id' => (string) Str::uuid(), 'investment_id' => $investment->id, 'user_id' => $investor->id, 'transaction_type' => $type, 'amount' => 100, 'currency' => 'BOB', 'status' => 'completed', 'created_at' => now(), 'updated_at' => now()]);
        }
        $ids = [];
        foreach (['income', 'expense', 'manual', 'unknown'] as $kind) {
            $id = (string) Str::uuid();
            $ids[$kind] = $id;
            DB::table('campaign_financial_movements')->insert([
                'id' => $id, 'campaign_id' => $campaign->id,
                'created_by' => $kind === 'manual' ? $owner->id : ($kind === 'unknown' ? null : $investor->id),
                'type' => $kind === 'income' ? 'income' : 'expense', 'concept' => 'Legacy '.$kind,
                'category' => 'Original category', 'amount' => 100, 'currency' => 'BOB',
                'movement_date' => now()->toDateString(), 'reference_number' => null,
                'status' => $kind === 'manual' ? 'flagged' : 'verified',
                'review_notes' => $kind === 'manual' ? 'Preserve old review' : null,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
        // Duplicate historical entries are preserved and locked, not guessed or merged.
        $ambiguous = Investment::create(['campaign_id' => $campaign->id, 'investor_id' => $investor->id, 'amount' => 200, 'currency' => 'BOB']);
        DB::table('transactions')->insert(['id' => (string) Str::uuid(), 'investment_id' => $ambiguous->id, 'user_id' => $investor->id, 'transaction_type' => 'payment', 'amount' => 200, 'currency' => 'BOB', 'status' => 'completed', 'created_at' => now(), 'updated_at' => now()]);
        $duplicates = [];
        foreach ([1, 2] as $copy) {
            $duplicates[] = $id = (string) Str::uuid();
            DB::table('campaign_financial_movements')->insert(['id' => $id, 'campaign_id' => $campaign->id, 'created_by' => $investor->id, 'type' => 'income', 'concept' => 'Duplicate '.$copy, 'category' => 'Recaudación', 'amount' => 200, 'currency' => 'BOB', 'movement_date' => now()->toDateString(), 'reference_number' => $ambiguous->id, 'status' => 'verified', 'created_at' => now(), 'updated_at' => now()]);
        }
        $before = DB::table('campaign_financial_movements')->get()->keyBy('id');
        $migration->up();
        $this->assertDatabaseHas('campaign_financial_movements', ['id' => $ids['income'], 'source' => 'investment', 'investment_id' => $investment->id]);
        $this->assertDatabaseHas('campaign_financial_movements', ['id' => $ids['expense'], 'source' => 'refund', 'investment_id' => $investment->id]);
        $this->assertDatabaseHas('campaign_financial_movements', ['id' => $ids['manual'], 'source' => 'manual', 'has_been_reviewed' => true]);
        $this->assertDatabaseHas('campaign_financial_movements', ['id' => $ids['unknown'], 'source' => 'legacy']);
        foreach ($before as $id => $row) {
            $after = (array) DB::table('campaign_financial_movements')->where('id', $id)->first();
            foreach ((array) $row as $field => $value) {
                $this->assertSame($value, $after[$field], 'Changed original '.$field);
            }
        }
        foreach ($duplicates as $id) {
            $this->assertDatabaseHas('campaign_financial_movements', ['id' => $id, 'source' => 'legacy', 'investment_id' => null]);
        }
        $this->assertDatabaseCount('campaign_financial_movement_history', 6);
        $this->asUser($owner)->patchJson($this->base($campaign).'/'.$ids['unknown'], ['notes' => 'Not allowed'])->assertUnprocessable();
        $this->deleteJson($this->base($campaign).'/'.$ids['manual'])->assertUnprocessable();
    }
}
