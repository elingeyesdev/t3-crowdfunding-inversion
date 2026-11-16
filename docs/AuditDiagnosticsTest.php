<?php

namespace Tests\Audit;

use App\Models\{Campaign, CampaignMilestone, Category, EntrepreneurProfile, InvestorProfile, Notification, RewardClaim, RewardTier, User};
use App\Services\Notifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Auth, DB, Hash};
use Tests\TestCase;

// Diagnostic assertions document CURRENT defects, not acceptance criteria.
// Intentionally outside the normal regression suite. Uses only an in-memory DB.
class AuditDiagnosticsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
    }

    private function user(string $role = 'entrepreneur'): User
    {
        $u = User::create(['email' => uniqid().'@example.test', 'password_hash' => Hash::make('Password123')]);
        $u->assignRole($role);
        if ($role === 'entrepreneur') {
            EntrepreneurProfile::create(['user_id' => $u->id, 'first_name' => 'Audit', 'last_name' => 'Owner', 'identity_verified' => false]);
        } elseif ($role === 'investor') {
            InvestorProfile::create(['user_id' => $u->id, 'max_investment' => 1000]);
        }
        return $u;
    }

    private function login(User $u): static
    {
        Auth::forgetGuards();
        return $this->withToken($u->createToken('audit')->plainTextToken);
    }

    private function campaign(User $owner, array $attrs = []): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Audit campaign', 'slug' => uniqid('audit-'), 'goal_amount' => 1000, 'status' => 'draft', ...$attrs]);
    }

    public function test_observed_unverified_owner_can_publish_draft_without_review(): void
    {
        $u = $this->user();
        $c = $this->campaign($u);
        $this->login($u)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/publish')->assertOk()->assertJsonPath('data.status', 'published');
        $this->assertDatabaseCount('campaign_reviews', 0);
    }

    public function test_observed_finalization_removes_public_detail(): void
    {
        $u = $this->user();
        $c = $this->campaign($u, ['status' => 'funded', 'current_amount' => 1000]);
        $this->getJson('/api/v1/campaigns/public/'.$c->id)->assertOk();
        $this->login($u)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/finalize')->assertOk();
        $this->getJson('/api/v1/campaigns/public/'.$c->id)->assertNotFound();
    }

    public function test_observed_frontend_endpoints_are_missing(): void
    {
        $u = $this->user('investor');
        $c = $this->campaign($this->user(), ['status' => 'published']);
        $this->login($u)->patchJson('/api/v1/users/me/password', ['currentPassword' => 'Password123', 'newPassword' => 'Changed123'])->assertNotFound();
        foreach (['/campaigns/public/'.$c->id.'/documents', '/campaigns/public/'.$c->id.'/updates', '/investments/backed-campaigns/updates'] as $path) {
            $this->getJson('/api/v1'.$path)->assertNotFound();
        }
    }

    public function test_observed_update_can_attach_to_another_campaigns_milestone(): void
    {
        $u = $this->user();
        $own = $this->campaign($u);
        $foreign = $this->campaign($this->user());
        $m = CampaignMilestone::create(['campaign_id' => $foreign->id, 'title' => 'Foreign milestone']);
        $this->login($u)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$own->id.'/updates', ['title' => 'Incorrectly linked', 'content' => 'This belongs to a different campaign.', 'milestoneId' => $m->id])->assertCreated();
        $this->assertDatabaseHas('campaign_updates', ['campaign_id' => $own->id, 'milestone_id' => $m->id]);
    }

    public function test_observed_category_preference_does_not_suppress_notification(): void
    {
        $u = $this->user('investor');
        $this->login($u)->putJson('/api/v1/notifications/preferences', ['investmentAlerts' => false])->assertOk();
        $this->assertNotNull(app(Notifier::class)->send($u->id, 'investment_received', 'Audit', 'Should be suppressed by category preference'));
    }

    public function test_observed_filtered_mark_all_returns_wrong_unread_count(): void
    {
        $u = $this->user('investor');
        Notification::create(['user_id' => $u->id, 'type_code' => 'new_comment', 'title' => 'Comment', 'body' => 'Audit']);
        Notification::create(['user_id' => $u->id, 'type_code' => 'investment_confirmed', 'title' => 'Investment', 'body' => 'Audit']);
        $this->login($u)->patchJson('/api/v1/notifications/read-all?typeCode=new_comment')->assertOk()->assertJsonPath('data.unreadCount', 0);
        $this->getJson('/api/v1/notifications/unread-count')->assertJsonPath('data.unreadCount', 1);
    }

    public function test_observed_selected_reward_is_replaced_and_tracking_missing_in_history(): void
    {
        $c = $this->campaign($this->user(), ['status' => 'published']);
        $selected = RewardTier::create(['campaign_id' => $c->id, 'title' => 'Selected', 'min_percentage' => 1, 'max_percentage' => 9]);
        $assigned = RewardTier::create(['campaign_id' => $c->id, 'title' => 'Assigned', 'min_percentage' => 10, 'max_percentage' => 100]);
        $u = $this->user('investor');
        $id = $this->login($u)->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 100, 'rewardTierId' => $selected->id])->assertCreated()->assertJsonPath('data.ticket.rewardTierId', $assigned->id)->json('data.ticket.id');
        RewardClaim::where('investment_id', $id)->update(['status' => 'shipped', 'tracking_number' => 'AUDIT123']);
        $this->getJson('/api/v1/investments/me')->assertOk()->assertJsonMissingPath('data.0.rewardClaimStatus')->assertJsonMissingPath('data.0.trackingNumber');
    }

    public function test_observed_admin_duplicate_email_with_uppercase_returns_server_error(): void
    {
        $u = $this->user('super_admin');
        User::create(['email' => 'duplicate@example.test', 'password_hash' => Hash::make('Password123')]);
        $this->login($u)->postJson('/api/v1/superadmin/admins', ['email' => 'DUPLICATE@EXAMPLE.TEST', 'password' => 'Password123'])->assertStatus(500);
    }

    public function test_observed_refunded_claim_can_be_marked_delivered_again(): void
    {
        $owner = $this->user();
        $c = $this->campaign($owner, ['status' => 'published']);
        RewardTier::create(['campaign_id' => $c->id, 'title' => 'Reward', 'min_percentage' => 1, 'max_percentage' => 100]);
        $u = $this->user('investor');
        $id = $this->login($u)->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 100])->assertCreated()->json('data.ticket.id');
        $this->login($owner)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/finalize')->assertOk();
        $claim = RewardClaim::where('investment_id', $id)->firstOrFail();
        $this->assertSame('cancelled', $claim->status);
        $this->patchJson('/api/v1/campaigns/'.$c->id.'/rewards/claims/'.$claim->id, ['status' => 'delivered'])->assertOk()->assertJsonPath('data.status', 'delivered');
    }
}
