<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignMilestone;
use App\Models\CampaignUpdate;
use App\Models\Category;
use App\Models\Comment;
use App\Models\EntrepreneurProfile;
use App\Models\Investment;
use App\Models\InvestorProfile;
use App\Models\Notification;
use App\Models\User;
use App\Services\Notifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationPreferencesTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/v1/notifications/preferences';

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
    }

    private function user(string $role = 'investor'): User
    {
        $user = User::create(['email_verified' => true, 'email' => Str::uuid().'@example.test']);
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

    private function campaign(User $owner): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Notification preferences campaign', 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => 'published']);
    }

    public function test_each_category_suppresses_its_events_but_leaves_other_categories_enabled(): void
    {
        $groups = [
            'investmentAlerts' => ['investment_confirmed', 'investment_received', 'investment_refunded'],
            'commentAlerts' => ['new_comment', 'new_message'],
            'campaignStatusUpdates' => ['campaign_pending_review', 'campaign_in_review', 'campaign_approved', 'campaign_rejected', 'campaign_published', 'campaign_partially_funded', 'campaign_funded', 'campaign_completed', 'campaign_failed', 'campaign_cancelled', 'campaign_suspended'],
            'milestoneUpdates' => ['milestone_completed', 'campaign_update'],
        ];
        $notifier = app(Notifier::class);
        foreach ($groups as $preference => $events) {
            $user = $this->user();
            $this->login($user)->putJson(self::PATH, [$preference => false])->assertOk()->assertJsonPath('data.'.$preference, false);
            foreach ($events as $event) {
                $this->assertNull($notifier->send($user->id, $event, 'Suppressed', 'Body'));
            }
            $this->assertSame(0, Notification::where('user_id', $user->id)->count());
            foreach ($groups as $other => $codes) {
                if ($other !== $preference) {
                    $this->assertNotNull($notifier->send($user->id, $codes[0], 'Enabled', 'Body'));
                }
            }
            // Unknown, identity, reward and audit events must not be misclassified.
            foreach (['system_notice', 'kyc_reviewed', 'reward_shipped', 'document_approved', 'financial_movement_verified'] as $code) {
                $this->assertNotNull($notifier->send($user->id, $code, 'Other', 'Body'));
            }
            $this->getJson('/api/v1/notifications/unread-count')->assertOk()->assertJsonPath('data.unreadCount', 8);
            $this->putJson(self::PATH, [$preference => true])->assertOk();
            $this->assertNotNull($notifier->send($user->id, $events[0], 'Reenabled', 'Body'));
        }
    }

    public function test_defaults_allow_events_and_disabled_preferences_do_not_delete_existing_notifications(): void
    {
        $user = $this->user();
        $this->login($user)->getJson(self::PATH)->assertOk()->assertJsonPath('data.inAppEnabled', true)->assertJsonPath('data.investmentAlerts', true)->assertJsonPath('data.commentAlerts', true)->assertJsonPath('data.campaignStatusUpdates', true)->assertJsonPath('data.milestoneUpdates', true);
        $notifier = app(Notifier::class);
        $old = $notifier->send($user->id, 'new_comment', 'Existing', 'Body');
        $this->assertNotNull($old);
        $this->putJson(self::PATH, ['commentAlerts' => false])->assertOk();
        $this->assertNull($notifier->send($user->id, 'new_comment', 'Blocked', 'Body'));
        $this->assertDatabaseHas('notifications', ['id' => $old->id, 'is_read' => false]);
        $this->assertDatabaseCount('notifications', 1);
    }

    public function test_channel_switches_and_categories_are_independent_and_disabling_wins(): void
    {
        $user = $this->user();
        $notifier = app(Notifier::class);
        $this->login($user)->putJson(self::PATH, ['inAppEnabled' => false, 'emailEnabled' => true, 'investmentAlerts' => true])->assertOk();
        $this->assertNull($notifier->send($user->id, 'investment_received', 'In app', 'Body'));
        $this->assertNotNull($notifier->send($user->id, 'investment_received', 'Email record', 'Body', channel: 'email'));
        $this->putJson(self::PATH, ['inAppEnabled' => true, 'emailEnabled' => false])->assertOk();
        $this->assertNotNull($notifier->send($user->id, 'investment_received', 'In app', 'Body'));
        $this->assertNull($notifier->send($user->id, 'investment_received', 'Email record', 'Body', channel: 'email'));
        $this->putJson(self::PATH, ['emailEnabled' => true, 'investmentAlerts' => false, 'categories' => ['investment_received' => true]])->assertOk();
        $this->assertNull($notifier->send($user->id, 'investment_received', 'In app', 'Body'));
        $this->assertNull($notifier->send($user->id, 'investment_received', 'Email record', 'Body', channel: 'email'));
        $this->assertDatabaseCount('notifications', 2);
    }

    public function test_partial_updates_preserve_other_switches_and_legacy_per_event_settings(): void
    {
        $user = $this->user();
        $this->login($user)->putJson(self::PATH, ['commentAlerts' => false, 'milestoneUpdates' => false, 'categories' => ['investment_received' => false, 'kyc_reviewed' => false]])->assertOk();
        $this->putJson(self::PATH, ['investmentAlerts' => false, 'categories' => ['new_comment' => true]])->assertOk()->assertJsonPath('data.commentAlerts', false)->assertJsonPath('data.milestoneUpdates', false)->assertJsonPath('data.categories.investment_received', false)->assertJsonPath('data.categories.kyc_reviewed', false);
        $this->getJson(self::PATH)->assertOk()->assertJsonPath('data.inAppEnabled', true)->assertJsonPath('data.commentAlerts', false)->assertJsonPath('data.investmentAlerts', false);
        $notifier = app(Notifier::class);
        $this->assertNull($notifier->send($user->id, 'new_comment', 'Blocked by category', 'Body'));
        $this->putJson(self::PATH, ['investmentAlerts' => true])->assertOk();
        $this->assertNull($notifier->send($user->id, 'investment_received', 'Blocked by legacy setting', 'Body'));
        $this->assertNotNull($notifier->send($user->id, 'investment_confirmed', 'Enabled', 'Body'));
        $this->assertFalse($user->fresh()->notification_preferences['categories']['kyc_reviewed']);
        $roundTrip = $this->getJson(self::PATH)->assertOk()->json('data');
        $this->putJson(self::PATH, $roundTrip)->assertOk();
        $this->assertSame($roundTrip['categories'], $user->fresh()->notification_preferences['categories']);
    }

    public function test_investments_and_refunds_complete_normally_when_their_alerts_are_disabled(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        $campaign = $this->campaign($owner);
        $this->login($owner)->putJson(self::PATH, ['investmentAlerts' => false, 'campaignStatusUpdates' => false])->assertOk();
        $this->login($donor)->putJson(self::PATH, ['investmentAlerts' => false])->assertOk();
        $id = $this->postJson('/api/v1/investments', ['campaignId' => $campaign->id, 'amount' => 100])->assertCreated()->json('data.ticket.id');
        $this->assertDatabaseHas('campaigns', ['id' => $campaign->id, 'current_amount' => 100]);
        $this->assertDatabaseCount('notifications', 0);
        $this->login($owner)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/finalize')->assertOk();
        $this->assertDatabaseHas('investments', ['id' => $id, 'status' => 'refunded', 'refunded_amount' => 100]);
        $this->assertDatabaseHas('investor_profiles', ['user_id' => $donor->id, 'total_invested' => 0]);
        $this->assertDatabaseCount('transactions', 2);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_comment_status_and_campaign_progress_helpers_respect_each_recipients_preferences(): void
    {
        $owner = $this->user('entrepreneur');
        $author = $this->user();
        $other = $this->user();
        $campaign = $this->campaign($owner);
        $this->login($owner)->putJson(self::PATH, ['commentAlerts' => false, 'campaignStatusUpdates' => false])->assertOk();
        $notifier = app(Notifier::class);
        $comment = Comment::create(['campaign_id' => $campaign->id, 'author_id' => $author->id, 'content' => 'Test comment']);
        $this->assertNull($notifier->commentPosted($campaign, $comment, $author));
        $this->assertNull($notifier->campaignStatusChanged($campaign, 'approved'));
        foreach ([$author, $other] as $donor) {
            Investment::create(['campaign_id' => $campaign->id, 'investor_id' => $donor->id, 'amount' => 100]);
        }
        $this->login($author)->putJson(self::PATH, ['milestoneUpdates' => false])->assertOk();
        $update = CampaignUpdate::create(['campaign_id' => $campaign->id, 'author_id' => $owner->id, 'title' => 'Progress', 'content' => 'Published update']);
        $milestone = CampaignMilestone::create(['campaign_id' => $campaign->id, 'title' => 'Completed milestone']);
        $this->assertSame(1, $notifier->campaignUpdatePublished($campaign, $update));
        $this->assertSame(1, $notifier->milestoneCompleted($campaign, $milestone));
        $this->assertSame(0, Notification::where('user_id', $author->id)->count());
        $this->assertSame(2, Notification::where('user_id', $other->id)->count());
    }

    public function test_preference_updates_require_authentication_validate_booleans_and_only_change_the_current_user(): void
    {
        $this->login(null)->getJson(self::PATH)->assertUnauthorized();
        $this->putJson(self::PATH, ['investmentAlerts' => false])->assertUnauthorized();
        $user = $this->user();
        $other = $this->user();
        $before = $other->notification_preferences;
        $this->login($user)->putJson(self::PATH, ['investmentAlerts' => false, 'userId' => $other->id])->assertOk();
        $this->assertSame($before, $other->fresh()->notification_preferences);
        $saved = $user->fresh()->notification_preferences;
        foreach ([['commentAlerts' => 'invalid'], ['categories' => ['new_comment' => ['invalid']]]] as $invalid) {
            $this->putJson(self::PATH, $invalid)->assertUnprocessable();
            $this->assertSame($saved, $user->fresh()->notification_preferences);
        }
    }
}
