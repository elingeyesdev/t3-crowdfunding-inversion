<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PublicCampaignUpdatesTest extends TestCase
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
        $user = User::create(['email' => Str::uuid().'@example.test', 'phone' => 'PRIVATE PHONE']);
        $user->assignRole($role);
        if ($role === 'entrepreneur') {
            EntrepreneurProfile::create(['user_id' => $user->id, 'first_name' => 'Public', 'last_name' => 'Author', 'display_name' => 'project-author', 'avatar_url' => '/storage/profiles/avatar.jpg']);
        }

        return $user;
    }

    private function login(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function campaign(User $owner, string $status = 'published'): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Public log campaign', 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => $status]);
    }

    private function path(Campaign $campaign): string
    {
        return '/api/v1/campaigns/'.$campaign->id.'/updates';
    }

    public function test_the_frontend_route_returns_public_updates_in_order_with_author_data_for_all_visitors(): void
    {
        $owner = $this->user();
        $campaign = $this->campaign($owner);
        $first = $campaign->updates()->create(['author_id' => $owner->id, 'title' => 'Earlier public update', 'content' => 'First progress', 'is_public' => true, 'created_at' => now()->subDay()]);
        $latest = $campaign->updates()->create(['author_id' => $owner->id, 'title' => 'Latest public update', 'content' => 'Recent progress', 'is_public' => true]);
        $campaign->updates()->create(['author_id' => $owner->id, 'title' => 'PRIVATE UPDATE', 'content' => 'PRIVATE CONTENT', 'is_public' => false]);
        foreach ([null, $owner, $this->user('investor'), $this->user('admin')] as $viewer) {
            $response = $this->login($viewer)->getJson($this->path($campaign).'?isPublic=false')->assertOk()->assertJsonCount(2, 'data');
            $response->assertJsonPath('data.0.id', $latest->id)->assertJsonPath('data.1.id', $first->id);
            $response->assertJsonPath('data.0.authorName', 'Public Author')->assertJsonPath('data.0.authorDisplayName', 'project-author')->assertJsonPath('data.0.authorAvatar', '/storage/profiles/avatar.jpg');
            $response->assertJsonPath('data.0.title', 'Latest public update')->assertJsonPath('data.0.content', 'Recent progress');
            $response->assertDontSee('PRIVATE UPDATE')->assertDontSee('PRIVATE CONTENT')->assertDontSee('PRIVATE PHONE')->assertDontSee($owner->email)->assertJsonMissingPath('data.0.author');
        }
    }

    public function test_active_and_authorized_historical_campaigns_have_public_logs(): void
    {
        foreach (['published', 'partially_funded', 'funded', 'completed', 'failed'] as $status) {
            $owner = $this->user();
            $campaign = $this->campaign($owner, $status);
            $campaign->update(['published_at' => now()->subDay()]);
            $update = $campaign->updates()->create(['author_id' => $owner->id, 'title' => 'Public progress', 'content' => 'Public content', 'is_public' => true]);
            $this->login(null)->getJson($this->path($campaign))->assertOk()->assertJsonPath('data.0.id', $update->id);
            $campaign->update(['status' => 'suspended']);
            $this->getJson($this->path($campaign))->assertNotFound();
        }
    }

    public function test_private_states_and_unpublished_closed_campaigns_do_not_expose_publicly_flagged_updates(): void
    {
        foreach (['draft', 'pending_review', 'in_review', 'approved', 'rejected', 'suspended', 'cancelled', 'completed', 'failed'] as $status) {
            $owner = $this->user();
            $campaign = $this->campaign($owner, $status);
            $campaign->updates()->create(['author_id' => $owner->id, 'title' => 'HIDDEN CAMPAIGN UPDATE', 'content' => 'Hidden content', 'is_public' => true]);
            foreach ([null, $owner, $this->user('admin')] as $viewer) {
                $this->login($viewer)->getJson($this->path($campaign))->assertNotFound()->assertDontSee('HIDDEN CAMPAIGN UPDATE');
            }
        }
    }

    public function test_public_log_metadata_cannot_create_private_file_credentials(): void
    {
        $owner = $this->user();
        $path = '/api/v1/private-files/documents/secret.pdf';
        $owner->entrepreneur()->update(['display_name' => $path]);
        $campaign = $this->campaign($owner);
        $campaign->updates()->create(['author_id' => $owner->id, 'title' => $path, 'content' => $path, 'is_public' => true, 'attachments' => [['type' => 'document', 'url' => $path]]]);
        $this->login(null)->getJson($this->path($campaign))->assertOk()->assertJsonPath('data.0.title', $path)->assertJsonPath('data.0.content', $path)->assertJsonPath('data.0.authorDisplayName', $path)->assertJsonPath('data.0.attachments.0.url', $path)->assertDontSee('signature=');
        $this->getJson($path)->assertForbidden();
    }

    public function test_an_empty_or_private_only_log_is_a_successful_empty_list(): void
    {
        $owner = $this->user();
        $campaign = $this->campaign($owner);
        $this->getJson($this->path($campaign))->assertOk()->assertJsonPath('data', []);
        $campaign->updates()->create(['author_id' => $owner->id, 'title' => 'PRIVATE', 'content' => 'PRIVATE', 'is_public' => false]);
        $this->getJson($this->path($campaign))->assertOk()->assertJsonPath('data', []);
    }
}
