<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignReview;
use App\Models\CampaignStatusHistory;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CampaignPublicationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
    }

    private function account(string $role = 'entrepreneur'): User
    {
        $user = User::create(['email_verified' => true, 'email' => Str::uuid().'@example.test']);
        $user->assignRole($role);
        if ($role === 'entrepreneur') {
            EntrepreneurProfile::create(['user_id' => $user->id, 'first_name' => 'Owner', 'last_name' => 'Test', 'identity_verified' => true, 'kyc_status' => 'approved']);
        }

        return $user;
    }

    private function asUser(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function campaign(User $owner, array $attrs = []): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Publication requirements', 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => 'draft', 'end_date' => now()->addDays(30), ...$attrs])->fresh();
    }

    private function publishPath(Campaign $c): string
    {
        return '/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/publish';
    }

    private function adminPath(Campaign $c): string
    {
        return '/api/v1/admin/campaigns/'.$c->id.'/status';
    }

    private function assertNoEffects(Campaign $c, array $before): void
    {
        $this->assertSame($before, $c->fresh()->getAttributes());
        $this->assertDatabaseCount('campaign_status_history', 0);
        $this->assertDatabaseCount('campaign_reviews', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_review_approval_and_owner_publication_are_separate_audited_steps(): void
    {
        $owner = $this->account();
        $admin = $this->account('admin');
        $c = $this->campaign($owner);
        $this->asUser($owner)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/submit-for-review')->assertOk();
        $this->asUser($admin)->patchJson($this->adminPath($c), ['status' => 'in_review'])->assertOk();
        $this->patchJson($this->adminPath($c), ['status' => 'approved', 'feedback' => 'Revisión completa'])->assertOk();
        $this->assertNull($c->fresh()->published_at);
        $this->getJson('/api/v1/campaigns/public/'.$c->id)->assertNotFound();
        $this->asUser($owner)->postJson($this->publishPath($c))->assertOk()->assertJsonPath('data.status', 'published');
        $publishedAt = $c->fresh()->published_at;
        $this->assertNotNull($publishedAt);
        $this->getJson('/api/v1/campaigns/public/'.$c->id)->assertOk();
        $this->assertDatabaseHas('campaign_status_history', ['campaign_id' => $c->id, 'from_status' => 'in_review', 'to_status' => 'approved', 'changed_by' => $admin->id, 'reason' => 'Revisión completa']);
        $this->assertDatabaseHas('campaign_status_history', ['campaign_id' => $c->id, 'from_status' => 'approved', 'to_status' => 'published', 'changed_by' => $owner->id]);
        $this->assertDatabaseHas('campaign_reviews', ['campaign_id' => $c->id, 'decision' => 'approved', 'reviewer_id' => $admin->id]);
        $counts = [CampaignStatusHistory::count(), CampaignReview::count(), Notification::count()];
        $this->postJson($this->publishPath($c))->assertUnprocessable();
        $this->assertTrue($publishedAt->equalTo($c->fresh()->published_at));
        $this->assertSame($counts, [CampaignStatusHistory::count(), CampaignReview::count(), Notification::count()]);
    }

    public function test_owner_cannot_publish_any_unapproved_state(): void
    {
        $owner = $this->account();
        foreach (['draft', 'pending_review', 'in_review', 'rejected', 'published', 'partially_funded', 'funded', 'suspended', 'cancelled', 'completed', 'failed'] as $status) {
            $c = $this->campaign($owner, ['status' => $status]);
            $before = $c->getAttributes();
            $this->asUser($owner)->postJson($this->publishPath($c))->assertUnprocessable();
            $this->assertNoEffects($c, $before);
        }
    }

    public function test_publication_rechecks_kyc_including_inconsistent_or_missing_profiles(): void
    {
        foreach ([[false, 'approved'], [true, 'pending'], [true, 'rejected'], [false, 'not_submitted'], null] as $kyc) {
            $owner = $this->account();
            $c = $this->campaign($owner, ['status' => 'approved']);
            if ($kyc === null) {
                $owner->entrepreneur()->delete();
            } else {
                $owner->entrepreneur()->update(['identity_verified' => $kyc[0], 'kyc_status' => $kyc[1]]);
            }
            $before = $c->getAttributes();
            $this->asUser($owner)->postJson($this->publishPath($c))->assertUnprocessable();
            $this->assertNoEffects($c, $before);
        }
    }

    public function test_publication_requires_a_future_closing_date(): void
    {
        $this->freezeTime();
        $owner = $this->account();
        foreach ([null, now()->subSecond(), now()] as $end) {
            $c = $this->campaign($owner, ['status' => 'approved', 'end_date' => $end]);
            $before = $c->getAttributes();
            $this->asUser($owner)->postJson($this->publishPath($c))->assertUnprocessable();
            $this->assertNoEffects($c, $before);
        }
    }

    public function test_other_users_and_guests_cannot_publish_or_review(): void
    {
        $owner = $this->account();
        $c = $this->campaign($owner, ['status' => 'approved']);
        $before = $c->getAttributes();
        foreach ([$this->account(), $this->account('investor'), $this->account('admin'), null] as $user) {
            $this->asUser($user)->postJson($this->publishPath($c))->assertStatus($user ? 403 : 401);
        }
        foreach ([$owner, $this->account('investor'), null] as $user) {
            $this->asUser($user)->patchJson($this->adminPath($c), ['status' => 'approved'])->assertStatus($user ? 403 : 401);
        }
        $this->assertNoEffects($c, $before);
    }

    public function test_administrative_transition_matrix_blocks_skipping_review_or_owner_publication(): void
    {
        $owner = $this->account();
        $admin = $this->account('admin');
        $allowed = [
            'draft' => ['cancelled'],
            'pending_review' => ['in_review', 'approved', 'rejected', 'cancelled'],
            'in_review' => ['approved', 'rejected', 'cancelled'],
            'approved' => ['rejected', 'cancelled'],
            'rejected' => ['cancelled'],
            'published' => ['suspended'],
            'partially_funded' => ['suspended'],
            'funded' => ['suspended'],
            'suspended' => ['published'],
            'cancelled' => [], 'completed' => [], 'failed' => [],
        ];
        foreach ($allowed as $from => $targets) {
            foreach (['in_review', 'approved', 'rejected', 'published', 'suspended', 'cancelled'] as $to) {
                $c = $this->campaign($owner, ['status' => $from]);
                $before = $c->getAttributes();
                $counts = [CampaignStatusHistory::count(), CampaignReview::count(), Notification::count()];
                $response = $this->asUser($admin)->patchJson($this->adminPath($c), ['status' => $to, 'feedback' => 'Auditoría']);
                if (in_array($to, $targets, true)) {
                    $response->assertOk();
                    $this->assertDatabaseHas('campaign_status_history', ['campaign_id' => $c->id, 'from_status' => $from, 'to_status' => $to, 'changed_by' => $admin->id]);
                    $this->assertDatabaseHas('campaign_reviews', ['campaign_id' => $c->id, 'decision' => $to]);
                } else {
                    $response->assertUnprocessable();
                    $this->assertSame($before, $c->fresh()->getAttributes());
                    $this->assertSame($counts, [CampaignStatusHistory::count(), CampaignReview::count(), Notification::count()]);
                }
            }
        }
    }

    public function test_approval_and_reactivation_check_requirements_without_side_effects(): void
    {
        $admin = $this->account('super_admin');
        $owner = $this->account();
        foreach (['pending_review' => 'approved', 'suspended' => 'published'] as $from => $to) {
            foreach (['kyc', 'date'] as $invalid) {
                $owner->entrepreneur()->update(['identity_verified' => $invalid !== 'kyc']);
                $c = $this->campaign($owner, ['status' => $from, 'end_date' => $invalid === 'date' ? now()->subDay() : now()->addDay()]);
                $before = $c->getAttributes();
                $this->asUser($admin)->patchJson($this->adminPath($c), ['status' => $to])->assertUnprocessable();
                $this->assertNoEffects($c, $before);
            }
        }
    }

    public function test_rejected_campaign_must_be_resubmitted_before_approval(): void
    {
        $owner = $this->account();
        $admin = $this->account('admin');
        $c = $this->campaign($owner, ['status' => 'rejected']);
        $this->asUser($admin)->patchJson($this->adminPath($c), ['status' => 'approved'])->assertUnprocessable();
        $this->asUser($owner)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/submit-for-review')->assertOk();
        $this->asUser($admin)->patchJson($this->adminPath($c), ['status' => 'approved'])->assertOk();
        $this->asUser($owner)->postJson($this->publishPath($c))->assertOk();
    }

    public function test_reactivation_preserves_funding_state_and_original_publication_date(): void
    {
        $owner = $this->account();
        $admin = $this->account('admin');
        foreach ([0 => 'published', 100 => 'partially_funded', 1000 => 'funded'] as $amount => $status) {
            $c = $this->campaign($owner, ['status' => 'suspended', 'current_amount' => $amount, 'published_at' => now()->subDays(5)]);
            $publishedAt = $c->published_at;
            $this->asUser($admin)->patchJson($this->adminPath($c), ['status' => 'published'])->assertOk()->assertJsonPath('data.status', $status);
            $this->assertTrue($publishedAt->equalTo($c->fresh()->published_at));
            $this->assertDatabaseHas('campaign_status_history', ['campaign_id' => $c->id, 'from_status' => 'suspended', 'to_status' => $status]);
        }
    }
}
