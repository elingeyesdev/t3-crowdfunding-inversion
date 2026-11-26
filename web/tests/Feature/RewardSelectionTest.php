<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\InvestorProfile;
use App\Models\RewardTier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class RewardSelectionTest extends TestCase
{
    use RefreshDatabase;

    private Campaign $campaign;

    private User $donor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        $this->travelTo(now()->startOfSecond());
        $owner = User::create(['email_verified' => true, 'email' => Str::uuid().'@example.test']);
        $owner->assignRole('entrepreneur');
        EntrepreneurProfile::create(['user_id' => $owner->id]);
        $this->campaign = Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Selected reward', 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => 'published']);
        $this->donor = User::create(['email_verified' => true, 'email' => Str::uuid().'@example.test']);
        $this->donor->assignRole('investor');
        InvestorProfile::create(['user_id' => $this->donor->id, 'max_investment' => 5000]);
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$this->donor->createToken('test')->plainTextToken);
    }

    private function reward(array $attrs = []): RewardTier
    {
        return RewardTier::create(['campaign_id' => $this->campaign->id, 'title' => 'Selected', 'amount' => 50, 'min_percentage' => 5, 'max_percentage' => 20, ...$attrs])->fresh();
    }

    private function assertNoWrites(): void
    {
        foreach (['investments', 'transactions', 'reward_claims', 'notifications', 'campaign_financial_movements', 'campaign_financial_movement_history', 'campaign_status_history'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
        $this->assertDatabaseHas('campaigns', ['id' => $this->campaign->id, 'current_amount' => 0, 'investor_count' => 0, 'status' => 'published']);
        $this->assertDatabaseHas('investor_profiles', ['user_id' => $this->donor->id, 'total_invested' => 0, 'total_investments' => 0]);
        $this->assertDatabaseHas('entrepreneur_profiles', ['user_id' => $this->campaign->creator_id, 'total_raised' => 0]);
    }

    public function test_selected_reward_is_preserved_even_when_another_tier_matches_the_amount(): void
    {
        $selected = $this->reward();
        $other = $this->reward(['title' => 'Other', 'min_percentage' => 10]);
        $id = $this->postJson('/api/v1/investments', ['campaignId' => $this->campaign->id, 'amount' => 100, 'rewardTierId' => $selected->id])->assertCreated()->assertJsonPath('data.ticket.rewardTierId', $selected->id)->json('data.ticket.id');
        $this->assertDatabaseHas('reward_claims', ['investment_id' => $id, 'status' => 'pending']);
        $this->assertSame(1, $selected->fresh()->current_claims);
        $this->assertSame(0, $other->fresh()->current_claims);
        $this->getJson('/api/v1/investments/me')->assertOk()->assertJsonPath('data.0.rewardTierId', $selected->id)->assertJsonPath('data.0.rewardTitle', 'Selected');
    }

    public function test_omitted_or_null_reward_means_direct_contribution_even_if_rewards_match(): void
    {
        $tier = $this->reward();
        foreach ([[], ['rewardTierId' => null]] as $selection) {
            $this->postJson('/api/v1/investments', ['campaignId' => $this->campaign->id, 'amount' => 100, ...$selection])->assertCreated()->assertJsonPath('data.ticket.rewardTierId', null);
        }
        $this->assertDatabaseCount('reward_claims', 0);
        $this->assertSame(0, $tier->fresh()->current_claims);
        $this->assertDatabaseHas('campaigns', ['id' => $this->campaign->id, 'current_amount' => 200]);
    }

    public function test_unavailable_rewards_are_rejected_without_any_financial_or_claim_writes(): void
    {
        $otherCampaign = $this->campaign->replicate();
        $otherCampaign->slug = (string) Str::uuid();
        $otherCampaign->save();
        foreach ([['is_active' => false], ['expires_at' => now()], ['expires_at' => now()->subSecond()], ['max_claims' => 1, 'current_claims' => 1], ['campaign_id' => $otherCampaign->id], ['currency' => 'USD']] as $attrs) {
            $tier = $this->reward($attrs);
            $before = $tier->current_claims;
            $this->postJson('/api/v1/investments', ['campaignId' => $this->campaign->id, 'amount' => 100, 'rewardTierId' => $tier->id])->assertUnprocessable();
            $this->assertNoWrites();
            $this->assertSame($before, $tier->fresh()->current_claims);
        }
        foreach ([(string) Str::uuid(), 'invalid-id'] as $id) {
            $this->postJson('/api/v1/investments', ['campaignId' => $this->campaign->id, 'amount' => 100, 'rewardTierId' => $id])->assertUnprocessable();
            $this->assertNoWrites();
        }
    }

    public function test_amount_must_satisfy_both_the_price_and_percentage_range_without_substitution(): void
    {
        $selected = $this->reward(['amount' => 75]);
        $other = $this->reward(['min_percentage' => 0, 'max_percentage' => 100]);
        foreach ([49.99, 50, 74.99, 200.01] as $amount) {
            $this->postJson('/api/v1/investments', ['campaignId' => $this->campaign->id, 'amount' => $amount, 'rewardTierId' => $selected->id])->assertUnprocessable();
            $this->assertNoWrites();
        }
        $this->assertSame(0, $other->fresh()->current_claims);
    }

    public function test_exact_percentage_boundaries_are_inclusive_and_one_cent_outside_is_rejected(): void
    {
        $tier = $this->reward(['amount' => 0, 'min_percentage' => 12.345, 'max_percentage' => 12.345]);
        $this->campaign->update(['goal_amount' => 2000]);
        foreach ([246.89, 246.91] as $amount) {
            $this->postJson('/api/v1/investments', ['campaignId' => $this->campaign->id, 'amount' => $amount, 'rewardTierId' => $tier->id])->assertUnprocessable();
            $this->assertNoWrites();
        }
        $this->postJson('/api/v1/investments', ['campaignId' => $this->campaign->id, 'amount' => 246.90, 'rewardTierId' => $tier->id])->assertCreated()->assertJsonPath('data.ticket.rewardTierId', $tier->id);
    }

    public function test_last_slot_is_claimed_once_and_second_confirmation_does_not_charge_or_substitute(): void
    {
        $tier = $this->reward(['max_claims' => 1, 'expires_at' => now()->addMinute()]);
        $this->reward(['title' => 'Alternative']);
        $this->postJson('/api/v1/investments', ['campaignId' => $this->campaign->id, 'amount' => 100, 'rewardTierId' => $tier->id])->assertCreated();
        $this->postJson('/api/v1/investments', ['campaignId' => $this->campaign->id, 'amount' => 100, 'rewardTierId' => $tier->id])->assertUnprocessable()->assertSee('agotado');
        $this->assertDatabaseCount('investments', 1);
        $this->assertDatabaseCount('transactions', 1);
        $this->assertDatabaseCount('reward_claims', 1);
        $this->assertDatabaseCount('notifications', 2);
        $this->assertDatabaseCount('campaign_financial_movements', 1);
        $this->assertSame(1, $tier->fresh()->current_claims);
        $this->assertDatabaseHas('investor_profiles', ['user_id' => $this->donor->id, 'total_invested' => 100, 'total_investments' => 1]);
        $this->assertDatabaseHas('campaigns', ['id' => $this->campaign->id, 'current_amount' => 100]);
    }
}
