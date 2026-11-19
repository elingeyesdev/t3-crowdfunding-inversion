<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\Investment;
use App\Models\InvestorProfile;
use App\Models\RewardClaim;
use App\Models\RewardTier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class RewardHistoryTrackingTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/v1/investments/me';

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        $this->travelTo(now()->startOfSecond());
    }

    private function user(string $role = 'investor'): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test']);
        $user->assignRole($role);
        if ($role === 'entrepreneur') {
            EntrepreneurProfile::create(['user_id' => $user->id, 'first_name' => 'Owner', 'last_name' => 'Test']);
        } elseif ($role === 'investor') {
            InvestorProfile::create(['user_id' => $user->id, 'max_investment' => 5000]);
        }

        return $user;
    }

    private function login(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function campaign(User $owner): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Reward tracking campaign', 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => 'published']);
    }

    private function reward(Campaign $campaign): RewardTier
    {
        return $campaign->rewards()->create(['title' => 'Reward package', 'description' => 'Package description', 'min_percentage' => 1, 'max_percentage' => 100, 'estimated_delivery' => '2026-12-20', 'image_url' => '/storage/rewards/package.jpg']);
    }

    public function test_history_follows_the_fulfillment_state_recorded_by_the_owner_with_tracking_dates(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        $campaign = $this->campaign($owner);
        $reward = $this->reward($campaign);
        $id = $this->login($donor)->postJson('/api/v1/investments', ['campaignId' => $campaign->id, 'amount' => 100, 'rewardTierId' => $reward->id])->assertCreated()->json('data.ticket.id');
        $claim = RewardClaim::where('investment_id', $id)->firstOrFail();
        $this->getJson(self::PATH)->assertOk()->assertJsonPath('data.0.rewardClaimStatus', 'pending')->assertJsonPath('data.0.rewardClaimId', $claim->id)->assertJsonPath('data.0.rewardTierId', $reward->id)->assertJsonPath('data.0.trackingNumber', null)->assertJsonPath('data.0.shippedAt', null);
        $route = '/api/v1/campaigns/'.$campaign->id.'/rewards/claims/'.$claim->id;
        $this->login($owner)->patchJson($route, ['status' => 'processing'])->assertOk();
        $this->login($donor)->getJson(self::PATH)->assertOk()->assertJsonPath('data.0.rewardClaimStatus', 'processing');
        $shippedAt = now()->copy();
        $this->login($owner)->patchJson($route, ['status' => 'shipped', 'trackingNumber' => 'TRACK-123', 'trackingUrl' => 'https://carrier.example/track/123'])->assertOk();
        $shipped = $this->login($donor)->getJson(self::PATH)->assertOk()->assertJsonPath('data.0.rewardClaimStatus', 'shipped')->assertJsonPath('data.0.trackingNumber', 'TRACK-123')->assertJsonPath('data.0.trackingUrl', 'https://carrier.example/track/123')->assertJsonPath('data.0.deliveredAt', null);
        $this->assertTrue(Carbon::parse($shipped->json('data.0.shippedAt'))->equalTo($shippedAt));
        $this->travel(2)->hours();
        $deliveredAt = now()->copy();
        $this->login($owner)->patchJson($route, ['status' => 'delivered'])->assertOk();
        $delivered = $this->login($donor)->getJson(self::PATH)->assertOk()->assertJsonPath('data.0.rewardClaimStatus', 'delivered')->assertJsonPath('data.0.trackingNumber', 'TRACK-123')->assertJsonPath('data.0.rewardDescription', 'Package description')->assertJsonPath('data.0.rewardEstimatedDelivery', '2026-12-20');
        $this->assertTrue(Carbon::parse($delivered->json('data.0.shippedAt'))->equalTo($shippedAt));
        $this->assertTrue(Carbon::parse($delivered->json('data.0.deliveredAt'))->equalTo($deliveredAt));
    }

    public function test_refunded_investment_exposes_its_cancelled_reward_without_fabricating_shipment_dates(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        $campaign = $this->campaign($owner);
        $reward = $this->reward($campaign);
        $this->login($donor)->postJson('/api/v1/investments', ['campaignId' => $campaign->id, 'amount' => 100, 'rewardTierId' => $reward->id])->assertCreated();
        $this->login($owner)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/finalize')->assertOk();
        $this->login($donor)->getJson(self::PATH)->assertOk()->assertJsonPath('data.0.investmentStatus', 'refunded')->assertJsonPath('data.0.rewardClaimStatus', 'cancelled')->assertJsonPath('data.0.trackingNumber', null)->assertJsonPath('data.0.shippedAt', null)->assertJsonPath('data.0.deliveredAt', null);
    }

    public function test_direct_contributions_and_rewards_without_claims_have_explicit_null_tracking_fields(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        $campaign = $this->campaign($owner);
        $investment = Investment::create(['campaign_id' => $campaign->id, 'investor_id' => $donor->id, 'amount' => 100]);
        $response = $this->login($donor)->getJson(self::PATH)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.amount', 100)->assertJsonPath('data.0.rewardTitle', null)->assertJsonPath('data.0.rewardTierId', null);
        foreach (['rewardClaimId', 'rewardClaimStatus', 'trackingNumber', 'trackingUrl', 'shippedAt', 'deliveredAt'] as $field) {
            $response->assertJsonPath('data.0.'.$field, null);
        }
        $reward = $this->reward($campaign);
        $investment->update(['reward_tier_id' => $reward->id]);
        $this->getJson(self::PATH)->assertOk()->assertJsonPath('data.0.rewardTitle', $reward->title)->assertJsonPath('data.0.rewardClaimStatus', null)->assertJsonPath('data.0.rewardClaimId', null);
    }

    public function test_donors_cannot_read_other_donors_tracking_and_history_never_signs_private_paths(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        $other = $this->user();
        $campaign = $this->campaign($owner);
        $reward = $this->reward($campaign);
        $privatePath = '/api/v1/private-files/documents/secret.pdf';
        $reward->update(['description' => $privatePath]);
        foreach ([[$donor, 'OWN-TRACK'], [$other, 'OTHER-DONOR-TRACK']] as [$user, $tracking]) {
            $investment = Investment::create(['campaign_id' => $campaign->id, 'investor_id' => $user->id, 'reward_tier_id' => $reward->id, 'amount' => 100]);
            RewardClaim::create(['investment_id' => $investment->id, 'status' => 'shipped', 'tracking_number' => $tracking, 'tracking_url' => 'https://carrier.example/'.$tracking]);
        }
        $before = [Investment::count(), RewardClaim::count(), DB::table('transactions')->count()];
        $this->login($donor)->getJson(self::PATH.'?userId='.$other->id)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.trackingNumber', 'OWN-TRACK')->assertJsonPath('data.0.rewardDescription', $privatePath)->assertDontSee('OTHER-DONOR-TRACK')->assertDontSee('signature=')->assertDontSee($other->email)->assertJsonMissingPath('data.0.investor')->assertJsonMissingPath('data.0.rewardClaim');
        $this->assertSame($before, [Investment::count(), RewardClaim::count(), DB::table('transactions')->count()]);
    }

    public function test_claim_history_remains_available_when_a_reward_tier_no_longer_exists(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        $campaign = $this->campaign($owner);
        $reward = $this->reward($campaign);
        $investment = Investment::create(['campaign_id' => $campaign->id, 'investor_id' => $donor->id, 'reward_tier_id' => $reward->id, 'amount' => 100]);
        $claim = RewardClaim::create(['investment_id' => $investment->id, 'status' => 'delivered', 'tracking_number' => 'DELIVERED-123', 'delivered_at' => now()]);
        $reward->delete();
        $this->login($donor)->getJson(self::PATH)->assertOk()->assertJsonPath('data.0.rewardTitle', null)->assertJsonPath('data.0.rewardClaimId', $claim->id)->assertJsonPath('data.0.rewardClaimStatus', 'delivered')->assertJsonPath('data.0.trackingNumber', 'DELIVERED-123');
    }

    public function test_history_requires_an_active_authenticated_donor(): void
    {
        $this->login(null)->getJson(self::PATH)->assertUnauthorized();
        $this->login($this->user('entrepreneur'))->getJson(self::PATH)->assertForbidden();
        $inactive = $this->user();
        $inactive->update(['is_active' => false]);
        $this->login($inactive)->getJson(self::PATH)->assertUnauthorized();
    }
}
