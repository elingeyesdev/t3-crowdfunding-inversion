<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\Investment;
use App\Models\InvestorProfile;
use App\Models\User;
use App\Support\CampaignTypes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CampaignTypesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
    }

    private function user(string $role): User
    {
        $user = User::factory()->create()->fresh();
        $user->assignRole($role);
        if ($role === 'entrepreneur') {
            EntrepreneurProfile::create(['user_id' => $user->id, 'first_name' => 'Owner', 'last_name' => 'Test', 'bio' => str_repeat('Biografía completa. ', 4), 'company_name' => 'Proyecto', 'website' => 'https://example.test', 'linkedin_url' => 'https://linkedin.com/in/example', 'country' => 'Bolivia', 'identity_verified' => true, 'kyc_status' => 'approved']);
        } elseif ($role === 'investor') {
            InvestorProfile::create(['user_id' => $user->id, 'max_investment' => 1000]);
        }

        return $user;
    }

    private function login(User $user): static
    {
        Auth::forgetGuards();

        return $this->withToken($user->createToken('test')->plainTextToken);
    }

    private function payload(): array
    {
        return ['title' => 'Campaña con modalidad explícita', 'description' => str_repeat('Descripción completa del proyecto. ', 3), 'goalAmount' => 100, 'categoryIds' => [Category::first()->id], 'endDate' => now()->addDays(30)->toIso8601String()];
    }

    private function campaign(User $owner, string $type, string $status = 'published'): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Historical type', 'slug' => (string) Str::uuid(), 'campaign_type' => $type, 'status' => $status, 'goal_amount' => 100, 'end_date' => now()->addDays(30)])->fresh();
    }

    public function test_supported_types_round_trip_through_create_edit_review_publish_and_catalog(): void
    {
        $owner = $this->user('entrepreneur');
        $admin = $this->user('admin');
        foreach (CampaignTypes::SUPPORTED as $type) {
            $id = $this->login($owner)->postJson('/api/v1/entrepreneurs/me/campaigns', [...$this->payload(), 'campaignType' => $type])->assertCreated()->assertJsonPath('data.campaignType', $type)->json('data.id');
            $base = '/api/v1/entrepreneurs/me/campaigns/'.$id;
            $this->patchJson($base, ['title' => 'Título actualizado sin conversión'])->assertOk()->assertJsonPath('data.campaignType', $type);
            $this->postJson($base.'/submit-for-review')->assertOk();
            $this->login($admin)->patchJson('/api/v1/admin/campaigns/'.$id.'/status', ['status' => 'approved'])->assertOk();
            $this->login($owner)->postJson($base.'/publish')->assertOk()->assertJsonPath('data.campaignType', $type);
            $this->getJson('/api/v1/campaigns/public?campaignType='.$type)->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.campaignType', $type);
        }
        $this->login($owner)->postJson('/api/v1/entrepreneurs/me/campaigns', $this->payload())->assertCreated()->assertJsonPath('data.campaignType', 'donation');
    }

    public function test_creation_rejects_equity_unknown_types_and_incorrect_field_aliases_without_writes(): void
    {
        $owner = $this->user('entrepreneur');
        $this->login($owner);
        foreach (['equity', 'loan', 'DONATION', '', null, []] as $type) {
            $this->postJson('/api/v1/entrepreneurs/me/campaigns', [...$this->payload(), 'campaignType' => $type])->assertUnprocessable();
        }
        foreach (['campaign_type', 'type'] as $alias) {
            $this->postJson('/api/v1/entrepreneurs/me/campaigns', [...$this->payload(), $alias => 'equity'])->assertUnprocessable();
        }
        $this->assertDatabaseCount('campaigns', 0);
        $this->assertSame(0, $owner->entrepreneur->fresh()->total_campaigns);
    }

    public function test_unsupported_historical_types_remain_exact_in_public_private_admin_and_contribution_history(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user('investor');
        $admin = $this->user('admin');
        foreach (['equity', 'legacy_custom'] as $type) {
            $campaign = $this->campaign($owner, $type);
            $investment = Investment::create(['campaign_id' => $campaign->id, 'investor_id' => $donor->id, 'amount' => 10])->fresh();
            $before = $campaign->getAttributes();
            $ticketBefore = $investment->getAttributes();
            $this->getJson('/api/v1/campaigns/public/'.$campaign->id)->assertOk()->assertJsonPath('data.campaignType', $type);
            $this->getJson('/api/v1/campaigns/public?campaignType='.$type)->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.campaignType', $type);
            $this->login($owner)->getJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id)->assertOk()->assertJsonPath('data.campaignType', $type);
            $this->login($admin)->getJson('/api/v1/admin/campaigns/'.$campaign->id)->assertOk()->assertJsonPath('data.campaign_type', $type);
            $items = $this->login($donor)->getJson('/api/v1/investments/me')->assertOk()->json('data');
            $this->assertSame($type, collect($items)->firstWhere('id', $investment->id)['campaignType']);
            $this->assertSame($before, $campaign->fresh()->getAttributes());
            $this->assertSame($ticketBefore, $investment->fresh()->getAttributes());
        }
    }

    public function test_unsupported_campaigns_cannot_be_edited_converted_submitted_approved_or_published(): void
    {
        $owner = $this->user('entrepreneur');
        $admin = $this->user('admin');
        foreach (['equity', 'legacy_custom'] as $type) {
            $draft = $this->campaign($owner, $type, 'draft');
            $before = $draft->getAttributes();
            $base = '/api/v1/entrepreneurs/me/campaigns/'.$draft->id;
            $this->login($owner)->patchJson($base, ['campaignType' => 'donation'])->assertUnprocessable();
            $this->patchJson($base, ['title' => 'Intento de modificar'])->assertUnprocessable();
            $this->postJson($base.'/submit-for-review')->assertUnprocessable();
            $this->assertSame($before, $draft->fresh()->getAttributes());
            $pending = $this->campaign($owner, $type, 'pending_review');
            $this->login($admin)->patchJson('/api/v1/admin/campaigns/'.$pending->id.'/status', ['status' => 'approved'])->assertUnprocessable();
            $approved = $this->campaign($owner, $type, 'approved');
            $this->login($owner)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$approved->id.'/publish')->assertUnprocessable();
            $suspended = $this->campaign($owner, $type, 'suspended');
            $this->login($admin)->patchJson('/api/v1/admin/campaigns/'.$suspended->id.'/status', ['status' => 'published'])->assertUnprocessable();
        }
        $this->assertDatabaseCount('campaign_status_history', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_unsupported_campaigns_reject_direct_and_reward_contributions_without_financial_writes(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user('investor');
        foreach (['equity', 'legacy_custom'] as $type) {
            $campaign = $this->campaign($owner, $type);
            $reward = $campaign->rewards()->create(['title' => 'Historical reward', 'min_percentage' => 0, 'max_percentage' => 100]);
            $this->login($donor);
            foreach ([null, $reward->id] as $tier) {
                $this->postJson('/api/v1/investments', ['campaignId' => $campaign->id, 'amount' => 10, 'rewardTierId' => $tier])->assertUnprocessable();
            }
            $this->assertSame(0, $reward->fresh()->current_claims);
            $this->assertSame(0.0, $campaign->fresh()->current_amount);
        }
        foreach (['investments', 'transactions', 'campaign_financial_movements', 'reward_claims', 'notifications'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
        $this->assertEquals(0, $donor->investor->fresh()->total_invested);
    }

    public function test_both_supported_types_keep_existing_direct_and_optional_reward_contribution_rules(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user('investor');
        foreach (CampaignTypes::SUPPORTED as $type) {
            $campaign = $this->campaign($owner, $type);
            $reward = $campaign->rewards()->create(['title' => 'Optional reward', 'min_percentage' => 0, 'max_percentage' => 100]);
            $this->login($donor)->postJson('/api/v1/investments', ['campaignId' => $campaign->id, 'amount' => 10])->assertCreated()->assertJsonPath('data.ticket.rewardTierId', null);
            $this->postJson('/api/v1/investments', ['campaignId' => $campaign->id, 'amount' => 10, 'rewardTierId' => $reward->id])->assertCreated()->assertJsonPath('data.ticket.rewardTierId', $reward->id);
            $this->assertSame($type, $campaign->fresh()->campaign_type);
        }
        $this->assertDatabaseCount('reward_claims', 2);
    }

    public function test_type_filters_validate_input_without_treating_unknown_values_as_donations(): void
    {
        $this->getJson('/api/v1/campaigns/public?campaignType[]=equity')->assertUnprocessable();
        $this->getJson('/api/v1/campaigns/public?campaignType=unknown')->assertOk()->assertJsonCount(0, 'data.data');
    }
}
