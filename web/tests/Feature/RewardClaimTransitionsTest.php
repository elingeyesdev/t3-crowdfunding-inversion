<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\Investment;
use App\Models\InvestorProfile;
use App\Models\Notification;
use App\Models\RewardClaim;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class RewardClaimTransitionsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $donor;

    private Campaign $campaign;

    private RewardClaim $claim;

    private string $path;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        $this->travelTo(now()->startOfSecond());
        $this->owner = $this->user('entrepreneur');
        $this->donor = $this->user('investor');
        $this->campaign = Campaign::create(['creator_id' => $this->owner->id, 'category_id' => Category::first()->id, 'title' => 'Claim transitions', 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => 'published']);
        $reward = $this->campaign->rewards()->create(['title' => 'Reward', 'min_percentage' => 1, 'max_percentage' => 100]);
        $id = $this->login($this->donor)->postJson('/api/v1/investments', ['campaignId' => $this->campaign->id, 'amount' => 100, 'rewardTierId' => $reward->id])->assertCreated()->json('data.ticket.id');
        $this->claim = RewardClaim::where('investment_id', $id)->firstOrFail();
        $this->path = '/api/v1/campaigns/'.$this->campaign->id.'/rewards/claims/'.$this->claim->id;
        $this->login($this->owner);
    }

    private function user(string $role): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test']);
        $user->assignRole($role);
        if ($role === 'entrepreneur') {
            EntrepreneurProfile::create(['user_id' => $user->id]);
        } else {
            InvestorProfile::create(['user_id' => $user->id, 'max_investment' => 5000]);
        }

        return $user;
    }

    private function login(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function snapshot(): array
    {
        return [$this->claim->fresh()->getAttributes(), Investment::find($this->claim->investment_id)->getAttributes(), $this->campaign->fresh()->getAttributes(), $this->donor->investor->fresh()->getAttributes(), $this->owner->entrepreneur->fresh()->getAttributes(), Notification::count(), DB::table('transactions')->count(), DB::table('campaign_financial_movements')->count(), DB::table('reward_tiers')->sum('current_claims')];
    }

    public function test_refunded_claim_cannot_be_reopened_or_modified_and_history_stays_cancelled(): void
    {
        $this->postJson('/api/v1/entrepreneurs/me/campaigns/'.$this->campaign->id.'/finalize')->assertOk();
        $before = $this->snapshot();
        foreach (['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as $status) {
            $this->patchJson($this->path, ['status' => $status, 'trackingNumber' => 'SHOULD-NOT-SAVE', 'trackingUrl' => 'https://carrier.example/test'])->assertUnprocessable()->assertSee('reembolsado');
            $this->assertSame($before, $this->snapshot());
        }
        $this->getJson('/api/v1/campaigns/'.$this->campaign->id.'/rewards/claims')->assertOk()->assertJsonPath('data.0.claim_status', 'cancelled')->assertJsonPath('data.0.investment_status', 'refunded')->assertJsonPath('data.0.allowed_statuses', []);
        $this->login($this->donor)->getJson('/api/v1/investments/me')->assertOk()->assertJsonPath('data.0.rewardClaimStatus', 'cancelled')->assertJsonPath('data.0.investmentStatus', 'refunded')->assertJsonPath('data.0.shippedAt', null)->assertJsonPath('data.0.deliveredAt', null);
    }

    public function test_non_completed_or_partially_refunded_investment_cannot_progress_even_with_stale_pending_claim(): void
    {
        foreach ([['status' => 'refunded'], ['status' => 'cancelled'], ['status' => 'completed', 'refunded_amount' => 1]] as $attrs) {
            $this->claim->investment->update($attrs);
            $before = $this->snapshot();
            $this->patchJson($this->path, ['status' => 'processing'])->assertUnprocessable();
            $this->assertSame($before, $this->snapshot());
            $this->getJson('/api/v1/campaigns/'.$this->campaign->id.'/rewards/claims')->assertJsonPath('data.0.allowed_statuses', []);
        }
    }

    public function test_valid_delivery_progresses_in_order_and_retries_do_not_repeat_dates_or_notifications(): void
    {
        $this->getJson('/api/v1/campaigns/'.$this->campaign->id.'/rewards/claims')->assertOk()->assertJsonPath('data.0.allowed_statuses', ['processing', 'cancelled']);
        $this->patchJson($this->path, ['status' => 'processing'])->assertOk()->assertJsonPath('data.allowedStatuses', ['shipped', 'cancelled']);
        $this->patchJson($this->path, ['status' => 'shipped', 'trackingNumber' => 'TRACK-1', 'trackingUrl' => 'https://carrier.example/1'])->assertOk()->assertJsonPath('data.allowedStatuses', ['delivered', 'cancelled']);
        $shipped = $this->claim->fresh()->shipped_at;
        $notifications = Notification::count();
        $this->travel(2)->hours();
        $this->patchJson($this->path, ['status' => 'shipped', 'trackingNumber' => 'TRACK-2'])->assertOk();
        $this->assertTrue($shipped->equalTo($this->claim->fresh()->shipped_at));
        $this->assertSame($notifications, Notification::count());
        $this->patchJson($this->path, ['status' => 'delivered'])->assertOk()->assertJsonPath('data.allowedStatuses', []);
        $this->assertNotNull($this->claim->fresh()->delivered_at);
        $this->assertSame($notifications + 1, Notification::count());
        $this->login($this->donor)->getJson('/api/v1/investments/me')->assertOk()->assertJsonPath('data.0.rewardClaimStatus', 'delivered')->assertJsonPath('data.0.trackingNumber', 'TRACK-2');
    }

    public function test_skips_regressions_and_terminal_state_changes_leave_everything_unchanged(): void
    {
        foreach (['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as $current) {
            $this->claim->update(['status' => $current]);
            $invalid = match ($current) {
                'pending' => ['shipped', 'delivered'],
                'processing' => ['pending', 'delivered'],
                'shipped' => ['pending', 'processing'],
                default => ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
            };
            foreach ($invalid as $next) {
                $before = $this->snapshot();
                $this->patchJson($this->path, ['status' => $next, 'trackingNumber' => 'INVALID'])->assertUnprocessable();
                $this->assertSame($before, $this->snapshot());
            }
        }
    }

    public function test_active_claim_can_be_cancelled_but_cannot_be_reactivated(): void
    {
        foreach (['pending', 'processing', 'shipped'] as $status) {
            $this->claim->update(['status' => $status]);
            $this->patchJson($this->path, ['status' => 'cancelled'])->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.allowedStatuses', []);
            $before = $this->snapshot();
            $this->patchJson($this->path, ['status' => 'processing'])->assertUnprocessable()->assertSee('cancelada');
            $this->assertSame($before, $this->snapshot());
        }
    }

    public function test_claim_update_requires_ownership_correct_campaign_and_valid_tracking(): void
    {
        $before = $this->snapshot();
        $this->login(null)->patchJson($this->path, ['status' => 'processing'])->assertUnauthorized();
        $this->login($this->donor)->patchJson($this->path, ['status' => 'processing'])->assertForbidden();
        $this->login($this->user('entrepreneur'))->patchJson($this->path, ['status' => 'processing'])->assertForbidden();
        $other = $this->campaign->replicate();
        $other->slug = (string) Str::uuid();
        $other->save();
        $this->login($this->owner)->patchJson('/api/v1/campaigns/'.$other->id.'/rewards/claims/'.$this->claim->id, ['status' => 'processing'])->assertNotFound();
        $this->patchJson($this->path, ['status' => 'issue_reported'])->assertUnprocessable();
        $this->patchJson($this->path, ['status' => 'processing', 'trackingUrl' => 'javascript:alert(1)'])->assertUnprocessable();
        $this->assertSame($before, $this->snapshot());
    }
}
