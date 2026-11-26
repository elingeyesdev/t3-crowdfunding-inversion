<?php

namespace Tests\Feature;

use App\Jobs\SendActivityEmail;
use App\Models\ActivityEmailDelivery;
use App\Models\Campaign;
use App\Models\CampaignFinancialMovement;
use App\Models\CampaignStatusHistory;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\Investment;
use App\Models\InvestorProfile;
use App\Models\Notification;
use App\Models\Transaction;
use App\Models\User;
use App\Services\FinancialMovementAudit;
use App\Services\InvestmentEngine;
use App\Services\Notifier;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class CampaignAutomaticClosureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        $this->travelTo(Carbon::parse('2026-11-25T16:00:00Z'));
    }

    private function owner(): User
    {
        $user = User::factory()->create();
        $user->assignRole('entrepreneur');
        EntrepreneurProfile::create(['user_id' => $user->id]);

        return $user;
    }

    private function donor(): User
    {
        $user = User::factory()->create();
        $user->assignRole('investor');
        InvestorProfile::create(['user_id' => $user->id, 'max_investment' => 1000]);

        return $user;
    }

    private function campaign(?User $owner = null, array $attributes = []): Campaign
    {
        return Campaign::create(['creator_id' => ($owner ?? $this->owner())->id, 'category_id' => Category::first()->id, 'title' => 'Automatic closure', 'slug' => (string) Str::uuid(), 'goal_amount' => 100, 'status' => 'published', 'end_date' => now()->addHour(), ...$attributes])->fresh();
    }

    private function invest(User $donor, Campaign $campaign, float $amount, ?string $reward = null): Investment
    {
        return app(InvestmentEngine::class)->invest($donor->id, ['campaignId' => $campaign->id, 'amount' => $amount, 'rewardTierId' => $reward])['ticket'];
    }

    public function test_only_expired_public_campaigns_with_a_closing_date_are_selected_in_batches(): void
    {
        $eligible = [];
        foreach (Campaign::CLOSABLE_STATUSES as $status) {
            $eligible[] = $this->campaign(attributes: ['status' => $status, 'end_date' => now()]);
        }
        $excluded = [];
        foreach (['draft', 'rejected', 'pending_review', 'in_review', 'approved', 'suspended', 'cancelled', 'completed', 'failed'] as $status) {
            $excluded[] = $this->campaign(attributes: ['status' => $status, 'end_date' => now()->subDay()]);
        }
        $excluded[] = $this->campaign(attributes: ['end_date' => null]);
        $excluded[] = $this->campaign(attributes: ['end_date' => now()->addSecond()]);
        $excluded[] = $this->campaign(attributes: ['status' => 'funded', 'current_amount' => 100, 'end_date' => now()->addHour()]);
        $before = array_map(fn ($c) => $c->getAttributes(), $excluded);
        $this->artisan('campaigns:close-expired', ['--chunk' => 1])->assertSuccessful();
        foreach ($eligible as $campaign) {
            $this->assertSame('failed', $campaign->fresh()->status);
        }
        foreach ($excluded as $i => $campaign) {
            $this->assertSame($before[$i], $campaign->fresh()->getAttributes());
        }
        $this->assertDatabaseCount('campaign_status_history', 3);
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_the_exact_expiry_instant_is_respected_across_offsets(): void
    {
        $this->travelTo(Carbon::parse('2026-11-25T15:59:59Z'));
        $campaign = $this->campaign(attributes: ['end_date' => '2026-11-25T18:00:00+02:00']);
        $this->assertSame('2026-11-25 12:00:00', $campaign->getRawOriginal('end_date'));
        $this->artisan('campaigns:close-expired')->assertSuccessful();
        $this->assertSame('published', $campaign->fresh()->status);
        $this->travel(1)->seconds();
        $this->artisan('campaigns:close-expired')->assertSuccessful();
        $this->assertSame('failed', $campaign->fresh()->status);
    }

    public function test_unsuccessful_closure_refunds_each_ticket_preserves_other_campaign_balances_and_cancels_rewards(): void
    {
        $owner = $this->owner();
        $donor = $this->donor();
        $campaign = $this->campaign($owner);
        $other = $this->campaign($owner);
        $tier = $campaign->rewards()->create(['title' => 'Reward', 'min_percentage' => 0, 'max_percentage' => 100, 'amount' => 0]);
        $tickets = [$this->invest($donor, $campaign, 10.10, $tier->id), $this->invest($donor, $campaign, 20.20, $tier->id)];
        $kept = $this->invest($donor, $other, 5.55);
        $campaign->update(['end_date' => now(), 'status' => 'partially_funded']);
        $this->artisan('campaigns:close-expired')->assertSuccessful();
        $this->assertSame('failed', $campaign->fresh()->status);
        $this->assertSame(0.0, $campaign->fresh()->current_amount);
        $this->assertSame(0, $campaign->fresh()->investor_count);
        $this->assertEquals(5.55, $donor->investor->fresh()->total_invested);
        $this->assertEquals(5.55, $owner->entrepreneur->fresh()->total_raised);
        $this->assertSame('completed', $kept->fresh()->status);
        $this->assertSame(0, $tier->fresh()->current_claims);
        foreach ($tickets as $ticket) {
            $this->assertSame('refunded', $ticket->fresh()->status);
            $this->assertSame($ticket->amount, $ticket->fresh()->refunded_amount);
            $this->assertSame('cancelled', $ticket->rewardClaim->fresh()->status);
            $this->assertSame(1, Transaction::where('investment_id', $ticket->id)->where('transaction_type', 'refund')->count());
            $movement = CampaignFinancialMovement::where('investment_id', $ticket->id)->where('source', 'refund')->sole();
            $this->assertSame($ticket->amount, $movement->amount);
            $this->assertNull($movement->history()->sole()->actor_id);
            $this->assertSame('Sistema (cierre automático)', app(FinancialMovementAudit::class)->history($movement)[0]['actorName']);
        }
        $history = CampaignStatusHistory::where('campaign_id', $campaign->id)->sole();
        $this->assertNull($history->changed_by);
        $this->assertSame(CampaignStatusHistory::AUTOMATIC_CLOSURE_REASON, $history->reason);
        Auth::forgetGuards();
        $this->withToken($owner->createToken('test')->plainTextToken)->getJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/history')->assertOk()->assertJsonPath('data.0.changed_by_name', 'Sistema (cierre automático)');
        $counts = [Transaction::count(), CampaignFinancialMovement::count(), Notification::count(), CampaignStatusHistory::count()];
        $this->artisan('campaigns:close-expired')->assertSuccessful();
        $this->postJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/finalize')->assertUnprocessable();
        $this->assertSame($counts, [Transaction::count(), CampaignFinancialMovement::count(), Notification::count(), CampaignStatusHistory::count()]);
    }

    public function test_funded_campaigns_complete_only_at_expiry_without_refunds_or_cancelling_rewards(): void
    {
        $donor = $this->donor();
        $campaign = $this->campaign();
        $tier = $campaign->rewards()->create(['title' => 'Kept reward', 'min_percentage' => 0, 'max_percentage' => 100]);
        $ticket = $this->invest($donor, $campaign, 100, $tier->id);
        $this->assertSame('funded', $campaign->fresh()->status);
        $this->artisan('campaigns:close-expired')->assertSuccessful();
        $this->assertSame('funded', $campaign->fresh()->status);
        $campaign->update(['end_date' => now()]);
        $this->artisan('campaigns:close-expired')->assertSuccessful();
        $this->assertSame('completed', $campaign->fresh()->status);
        $this->assertSame('completed', $ticket->fresh()->status);
        $this->assertSame('pending', $ticket->rewardClaim->fresh()->status);
        $this->assertSame(1, $tier->fresh()->current_claims);
        $this->assertEquals(100, $donor->investor->fresh()->total_invested);
        $this->assertSame(0, Transaction::where('transaction_type', 'refund')->count());
        $this->assertSame(1, CampaignStatusHistory::where('campaign_id', $campaign->id)->where('to_status', 'completed')->count());
    }

    public function test_manual_closure_stays_available_before_expiry_and_a_stale_automatic_selection_is_a_noop(): void
    {
        $owner = $this->owner();
        $campaign = $this->campaign($owner);
        $stale = $campaign->fresh();
        $this->withToken($owner->createToken('test')->plainTextToken)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/finalize')->assertOk();
        $this->assertNull(app(InvestmentEngine::class)->finalizeExpired($stale));
        $this->assertSame($owner->id, CampaignStatusHistory::where('campaign_id', $campaign->id)->sole()->changed_by);
        $this->assertDatabaseCount('campaign_status_history', 1);
    }

    public function test_a_selected_campaign_is_rechecked_for_date_and_status_changes_before_closing(): void
    {
        foreach (['end_date' => now()->addHour(), 'status' => 'suspended'] as $field => $value) {
            $campaign = $this->campaign(attributes: ['end_date' => now()->subMinute()]);
            $stale = $campaign->fresh();
            $campaign->update([$field => $value]);
            $this->assertNull(app(InvestmentEngine::class)->finalizeExpired($stale));
            $this->assertSame(0, CampaignStatusHistory::where('campaign_id', $campaign->id)->count());
        }
    }

    public function test_failure_after_a_partial_refund_rolls_everything_back_continues_other_campaigns_and_retries(): void
    {
        config(['mail.default' => 'smtp', 'mail.from.address' => 'sender@example.test', 'activity_mail.enabled' => true, 'activity_mail.connection' => 'database']);
        Queue::fake([SendActivityEmail::class]);
        $owner = $this->owner();
        $campaign = $this->campaign($owner);
        $donors = [$this->donor(), $this->donor()];
        foreach ($donors as $donor) {
            $this->invest($donor, $campaign, 10);
        }
        $campaign->update(['end_date' => now()]);
        $other = $this->campaign(attributes: ['end_date' => now()]);
        $real = app(Notifier::class);
        $calls = 0;
        $mock = Mockery::mock(Notifier::class);
        $mock->shouldReceive('send')->andReturnUsing(function (...$args) use ($real, $campaign, &$calls) {
            if ($args[1] === 'investment_refunded' && $args[4] === $campaign->id && ++$calls === 2) {
                throw new RuntimeException('Injected failure after refund writes');
            }

            return $real->send(...$args);
        });
        app()->instance(Notifier::class, $mock);
        $baseline = [Transaction::count(), CampaignFinancialMovement::count(), ActivityEmailDelivery::count()];
        $this->artisan('campaigns:close-expired', ['--chunk' => 1])->assertFailed();
        $this->assertSame('published', $campaign->fresh()->status);
        $this->assertSame('failed', $other->fresh()->status);
        foreach ($donors as $donor) {
            $this->assertEquals(10, $donor->investor->fresh()->total_invested);
        }
        $this->assertSame(0, Investment::where('campaign_id', $campaign->id)->where('status', 'refunded')->count());
        $this->assertSame(0, CampaignStatusHistory::where('campaign_id', $campaign->id)->count());
        $this->assertSame($baseline[0], Transaction::count());
        $this->assertSame($baseline[1], CampaignFinancialMovement::count());
        $this->assertSame($baseline[2] + 1, ActivityEmailDelivery::count()); // Only the other campaign's closure.
        app()->instance(Notifier::class, $real);
        $this->artisan('campaigns:close-expired')->assertSuccessful();
        $this->assertSame('failed', $campaign->fresh()->status);
        $this->assertSame(2, Transaction::where('transaction_type', 'refund')->count());
        foreach ($donors as $donor) {
            $this->assertEquals(0, $donor->investor->fresh()->total_invested);
        }
    }

    public function test_dry_run_lists_eligible_campaigns_without_writing_or_notifying_and_invalid_chunks_are_rejected(): void
    {
        $campaign = $this->campaign(attributes: ['end_date' => now()]);
        $this->artisan('campaigns:close-expired', ['--dry-run' => true])->expectsOutputToContain($campaign->id)->assertSuccessful();
        $this->assertSame('published', $campaign->fresh()->status);
        $this->assertDatabaseCount('campaign_status_history', 0);
        $this->assertDatabaseCount('notifications', 0);
        foreach (['0', '-1', '1.5', '1001', 'invalid'] as $chunk) {
            $this->artisan('campaigns:close-expired', ['--chunk' => $chunk])->assertExitCode(2);
        }
    }

    public function test_scheduler_registers_the_closure_and_respects_the_enable_switch(): void
    {
        $this->artisan('schedule:list')->assertSuccessful();
        $event = collect(app(Schedule::class)->events())
            ->first(fn ($event) => str_contains($event->command ?? '', 'campaigns:close-expired'));
        $this->assertNotNull($event);
        $this->assertSame('* * * * *', $event->expression);
        $this->assertTrue($event->withoutOverlapping);
        config(['campaign_closure.enabled' => false]);
        $this->assertFalse($event->filtersPass($this->app));
        config(['campaign_closure.enabled' => true]);
        $this->assertTrue($event->filtersPass($this->app));
    }
}
