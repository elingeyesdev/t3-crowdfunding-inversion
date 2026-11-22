<?php

namespace Tests\Feature;

use App\Events\ChatMessageSent;
use App\Models\Campaign;
use App\Models\Category;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\TestCase;

class ChatCampaignPrivacyTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        Event::fake([ChatMessageSent::class]);
    }

    private function user(string $role = 'investor'): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test'])->fresh();
        $user->assignRole($role);

        return $user;
    }

    private function login(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function campaign(User $owner, string $status = 'draft', array $attributes = []): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id,
            'title' => 'PRIVATE CAMPAIGN TITLE', 'slug' => (string) Str::uuid(),
            'cover_image_url' => '/storage/private-cover.jpg', 'goal_amount' => 1000,
            'status' => $status, ...$attributes]);
    }

    private function existingConversation(User $one, User $two, Campaign $campaign): Conversation
    {
        $ids = [$one->id, $two->id];
        sort($ids);

        return Conversation::create(['user_one_id' => $ids[0], 'user_two_id' => $ids[1],
            'campaign_id' => $campaign->id, 'subject' => 'Consulta sobre: '.$campaign->title]);
    }

    private function assertHiddenCampaign(string $conversationId): void
    {
        $row = collect($this->getJson('/api/v1/chat/conversations')->assertOk()->json('data'))->firstWhere('id', $conversationId);
        $this->assertNotNull($row);
        foreach (['campaignId', 'campaignTitle', 'campaignCover', 'subject'] as $field) {
            $this->assertNull($row[$field], $field.' must not reveal the private campaign.');
        }
    }

    public function test_unrelated_users_cannot_associate_any_private_state_or_an_unknown_campaign(): void
    {
        $owner = $this->user('entrepreneur');
        $one = $this->user();
        $two = $this->user();
        foreach (['draft', 'pending_review', 'in_review', 'approved', 'rejected', 'suspended', 'cancelled', 'completed', 'failed'] as $status) {
            $campaign = $this->campaign($owner, $status);
            $this->login($one)->postJson('/api/v1/chat/conversations', ['otherUserId' => $two->id, 'campaignId' => $campaign->id])
                ->assertNotFound()->assertDontSee($campaign->title)->assertDontSee($campaign->cover_image_url);
        }
        $this->postJson('/api/v1/chat/conversations', ['otherUserId' => $two->id, 'campaignId' => (string) Str::uuid()])->assertNotFound();
        $this->assertDatabaseCount('conversations', 0);
    }

    public function test_private_association_requires_permission_for_both_participants(): void
    {
        $owner = $this->user('entrepreneur');
        $admin = $this->user('admin');
        $superAdmin = $this->user('super_admin');
        $outsider = $this->user();
        $campaign = $this->campaign($owner);
        foreach ([[$owner, $outsider], [$outsider, $owner], [$admin, $outsider], [$outsider, $superAdmin]] as [$sender, $receiver]) {
            $this->login($sender)->postJson('/api/v1/chat/conversations', ['otherUserId' => $receiver->id, 'campaignId' => $campaign->id])->assertNotFound();
        }
        $this->assertDatabaseCount('conversations', 0);
        foreach ([[$owner, $admin], [$superAdmin, $owner], [$admin, $superAdmin]] as [$sender, $receiver]) {
            $id = $this->login($sender)->postJson('/api/v1/chat/conversations', ['otherUserId' => $receiver->id, 'campaignId' => $campaign->id])->assertCreated()->json('data.id');
            foreach ([$sender, $receiver] as $viewer) {
                $row = collect($this->login($viewer)->getJson('/api/v1/chat/conversations')->assertOk()->json('data'))->firstWhere('id', $id);
                $this->assertSame($campaign->id, $row['campaignId']);
                $this->assertSame($campaign->title, $row['campaignTitle']);
                $this->assertSame($campaign->cover_image_url, $row['campaignCover']);
            }
        }
    }

    public function test_public_and_authorized_historical_campaigns_keep_legitimate_chats_and_deduplication(): void
    {
        $owner = $this->user('entrepreneur');
        $one = $this->user();
        $two = $this->user();
        foreach (['published', 'partially_funded', 'funded', 'completed', 'failed'] as $status) {
            $campaign = $this->campaign($owner, $status, ['published_at' => now()->subDay()]);
            $id = $this->login($one)->postJson('/api/v1/chat/conversations', ['otherUserId' => $two->id, 'campaignId' => $campaign->id])->assertCreated()->json('data.id');
            $this->login($two)->postJson('/api/v1/chat/conversations', ['otherUserId' => $one->id, 'campaignId' => $campaign->id])->assertCreated()->assertJsonPath('data.id', $id);
            $row = collect($this->getJson('/api/v1/chat/conversations')->assertOk()->json('data'))->firstWhere('id', $id);
            $this->assertSame($campaign->title, $row['campaignTitle']);
        }
        $this->assertDatabaseCount('conversations', 5);
    }

    public function test_existing_private_chats_hide_metadata_without_deleting_messages_or_read_state(): void
    {
        $owner = $this->user('entrepreneur');
        $one = $this->user();
        $two = $this->user();
        $campaign = $this->campaign($owner);
        $conversation = $this->existingConversation($one, $two, $campaign);
        $message = $conversation->messages()->create(['sender_id' => $one->id, 'content' => 'Existing message']);
        $before = $conversation->fresh()->getAttributes();
        foreach ([$one, $two] as $viewer) {
            $this->login($viewer);
            $this->assertHiddenCampaign($conversation->id);
        }
        $this->assertSame($before, $conversation->fresh()->getAttributes());
        $this->getJson('/api/v1/chat/conversations/'.$conversation->id.'/messages')->assertOk()->assertJsonPath('data.0.id', $message->id);
        $this->postJson('/api/v1/chat/conversations/'.$conversation->id.'/read')->assertOk();
        $this->postJson('/api/v1/chat/conversations/'.$conversation->id.'/messages', ['content' => 'Reply'])->assertCreated();
        $this->login($one);
        $this->assertHiddenCampaign($conversation->id);
        $this->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.unreadCount', 1);
        $this->login($owner)->getJson('/api/v1/chat/conversations')->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/chat/conversations/'.$conversation->id.'/messages')->assertForbidden();
    }

    public function test_visibility_changes_are_applied_per_viewer_on_every_list_request(): void
    {
        $owner = $this->user('entrepreneur');
        $visitor = $this->user();
        $campaign = $this->campaign($owner, 'published');
        $id = $this->login($visitor)->postJson('/api/v1/chat/conversations', ['otherUserId' => $owner->id, 'campaignId' => $campaign->id, 'subject' => 'Consulta sobre: '.$campaign->title])->assertCreated()->json('data.id');
        $this->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.campaignTitle', $campaign->title);
        foreach (['suspended', 'draft', 'cancelled'] as $status) {
            $campaign->update(['status' => $status, 'title' => 'PRIVATE EDIT '.$status]);
            $this->login($visitor);
            $this->assertHiddenCampaign($id);
            $this->postJson('/api/v1/chat/conversations', ['otherUserId' => $owner->id, 'campaignId' => $campaign->id])->assertNotFound();
            $this->login($owner)->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.campaignTitle', $campaign->title);
        }
        $campaign->update(['status' => 'published']);
        $this->login($visitor)->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.campaignId', $campaign->id)->assertJsonPath('data.0.campaignTitle', $campaign->title);
        $this->assertDatabaseCount('conversations', 1);
    }

    public function test_revoking_admin_role_hides_private_metadata_and_does_not_grant_nonmember_access(): void
    {
        $owner = $this->user('entrepreneur');
        $admin = $this->user('admin');
        $campaign = $this->campaign($owner);
        $conversation = $this->existingConversation($owner, $admin, $campaign);
        $this->login($admin)->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.campaignId', $campaign->id);
        $admin->roles()->detach();
        $this->login($admin);
        $this->assertHiddenCampaign($conversation->id);
        $this->login($this->user('super_admin'))->getJson('/api/v1/chat/conversations')->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/chat/conversations/'.$conversation->id.'/messages')->assertForbidden();
    }

    public function test_chat_without_campaign_and_authentication_requirements_are_preserved(): void
    {
        $one = $this->user();
        $two = $this->user();
        $campaign = $this->campaign($this->user('entrepreneur'), 'published');
        $payload = ['otherUserId' => $two->id, 'campaignId' => $campaign->id];
        $this->login(null)->postJson('/api/v1/chat/conversations', $payload)->assertUnauthorized();
        $inactive = $this->user();
        $inactive->update(['is_active' => false]);
        $this->login($inactive)->postJson('/api/v1/chat/conversations', $payload)->assertUnauthorized();
        $this->login($one)->postJson('/api/v1/chat/conversations', ['otherUserId' => $inactive->id, 'campaignId' => $campaign->id])->assertUnprocessable();
        $this->postJson('/api/v1/chat/conversations', ['otherUserId' => $two->id, 'subject' => 'General inquiry'])->assertCreated();
        $this->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.subject', 'General inquiry')->assertJsonPath('data.0.campaignId', null);
    }
}
