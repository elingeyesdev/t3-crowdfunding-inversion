<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignStatusHistory;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\Investment;
use App\Models\InvestorProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class BackedCampaignUpdatesTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/v1/investments/backed-campaigns/updates';

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
    }

    private function user(string $role = 'investor'): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test', 'phone' => 'PRIVATE PHONE']);
        $user->assignRole($role);
        if ($role === 'entrepreneur') {
            EntrepreneurProfile::create(['user_id' => $user->id, 'first_name' => 'Public', 'last_name' => 'Author', 'display_name' => 'project-owner', 'avatar_url' => '/storage/profiles/avatar.jpg']);
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
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Backed project '.Str::uuid(), 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => $status]);
    }

    private function back(User $user, Campaign $campaign, string $status = 'completed'): void
    {
        Investment::create(['investor_id' => $user->id, 'campaign_id' => $campaign->id, 'amount' => 100, 'status' => $status]);
    }

    private function update(Campaign $campaign, array $attrs = [])
    {
        return $campaign->updates()->create(['author_id' => $campaign->creator_id, 'title' => 'Progress report', 'content' => 'Public progress', 'is_public' => true, ...$attrs]);
    }

    public function test_only_own_supported_campaigns_are_returned_once_and_private_updates_are_excluded(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        $other = $this->user();
        $own = $this->campaign($owner);
        $foreign = $this->campaign($owner);
        $this->back($donor, $own);
        $this->back($donor, $own);
        $this->back($other, $foreign);
        $public = $this->update($own);
        $this->update($own, ['is_public' => false, 'title' => 'PRIVATE UPDATE', 'content' => 'PRIVATE CONTENT']);
        $this->update($foreign, ['title' => 'FOREIGN PROJECT UPDATE']);

        $response = $this->login($donor)->getJson(self::PATH.'?userId='.$other->id.'&isPublic=false')->assertOk()->assertJsonPath('data.meta.totalItems', 1)->assertJsonCount(1, 'data.data');
        $response->assertJsonPath('data.data.0.id', $public->id)->assertJsonPath('data.data.0.campaignTitle', $own->title);
        $response->assertJsonPath('data.data.0.entrepreneurName', 'Public Author')->assertJsonPath('data.data.0.entrepreneurDisplayName', 'project-owner')->assertJsonPath('data.data.0.entrepreneurAvatar', '/storage/profiles/avatar.jpg');
        $response->assertDontSee('PRIVATE UPDATE')->assertDontSee('PRIVATE CONTENT')->assertDontSee('FOREIGN PROJECT UPDATE')->assertDontSee('PRIVATE PHONE')->assertDontSee($owner->email)->assertDontSee($foreign->title);
        $this->assertSame([$own->id], array_column($response->json('data.campaigns'), 'id'));
        $this->login($other)->getJson(self::PATH)->assertOk()->assertJsonPath('data.meta.totalItems', 1)->assertJsonPath('data.data.0.campaignId', $foreign->id);
    }

    public function test_only_completed_or_refunded_contributions_grant_access_and_empty_feeds_are_successful(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        $this->login($donor)->getJson(self::PATH)->assertOk()->assertJsonPath('data.data', [])->assertJsonPath('data.meta.totalItems', 0);
        foreach (['pending', 'failed', 'cancelled', 'completed', 'refunded'] as $status) {
            $campaign = $this->campaign($owner);
            $this->back($donor, $campaign, $status);
            $this->update($campaign);
        }
        $this->getJson(self::PATH)->assertOk()->assertJsonPath('data.meta.totalItems', 2)->assertJsonCount(2, 'data.campaigns');
    }

    public function test_visibility_includes_authorized_history_but_excludes_private_states_and_false_history(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        $allowed = [];
        foreach (['published', 'partially_funded', 'funded', 'completed', 'failed', 'draft', 'pending_review', 'in_review', 'approved', 'rejected', 'suspended', 'cancelled'] as $status) {
            $campaign = $this->campaign($owner, $status);
            if ($status === 'completed') {
                $campaign->update(['published_at' => now()->subDay()]);
            } elseif ($status === 'failed') {
                CampaignStatusHistory::create(['campaign_id' => $campaign->id, 'from_status' => 'published', 'to_status' => 'failed']);
            } else {
                // A previous publication date cannot reopen suspended/private states.
                $campaign->update(['published_at' => now()->subDay()]);
            }
            $this->back($donor, $campaign);
            $this->update($campaign);
            if (in_array($status, ['published', 'partially_funded', 'funded', 'completed', 'failed'], true)) {
                $allowed[] = $campaign->id;
            }
        }
        $closed = $this->campaign($owner, 'failed');
        $this->back($donor, $closed, 'refunded');
        $this->update($closed);
        CampaignStatusHistory::create(['campaign_id' => $closed->id, 'from_status' => 'draft', 'to_status' => 'failed']);
        $response = $this->login($donor)->getJson(self::PATH)->assertOk()->assertJsonPath('data.meta.totalItems', 5);
        $this->assertEqualsCanonicalizing($allowed, array_column($response->json('data.data'), 'campaignId'));
        $this->assertEqualsCanonicalizing($allowed, array_column($response->json('data.campaigns'), 'id'));
    }

    public function test_pagination_is_stable_and_campaign_filter_applies_before_pagination(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        $newer = $this->campaign($owner);
        $older = $this->campaign($owner);
        foreach ([$newer, $older] as $campaign) {
            $this->back($donor, $campaign);
        }
        for ($i = 0; $i < 8; $i++) {
            $this->update($newer, ['created_at' => now()]);
            $this->update($older, ['created_at' => now()->subDay()]);
        }
        $this->login($donor);
        $all = [];
        for ($page = 1; $page <= 4; $page++) {
            $response = $this->getJson(self::PATH.'?limit=4&page='.$page)->assertOk()->assertJsonPath('data.meta.totalItems', 16)->assertJsonPath('data.meta.totalPages', 4)->assertJsonPath('data.meta.currentPage', $page);
            $all = [...$all, ...array_column($response->json('data.data'), 'id')];
            $this->assertEqualsCanonicalizing([$newer->id, $older->id], array_column($response->json('data.campaigns'), 'id'));
        }
        $this->assertCount(16, array_unique($all));
        $first = $this->getJson(self::PATH.'?limit=4')->assertOk();
        $this->assertSame([$newer->id], array_values(array_unique(array_column($first->json('data.data'), 'campaignId'))));
        $filtered = $this->getJson(self::PATH.'?limit=4&campaignId='.$older->id)->assertOk()->assertJsonPath('data.meta.totalItems', 8)->assertJsonPath('data.meta.totalPages', 2);
        $this->assertSame([$older->id], array_values(array_unique(array_column($filtered->json('data.data'), 'campaignId'))));
        $this->getJson(self::PATH.'?page=99')->assertOk()->assertJsonPath('data.data', []);
        $foreign = $this->campaign($owner);
        $this->getJson(self::PATH.'?campaignId='.$foreign->id)->assertOk()->assertJsonPath('data.meta.totalItems', 0)->assertJsonPath('data.data', []);
        foreach (['page=0', 'limit=101', 'limit=0', 'campaignId=invalid'] as $query) {
            $this->getJson(self::PATH.'?'.$query)->assertUnprocessable();
        }
    }

    public function test_refund_after_actual_finalization_preserves_public_updates_and_the_campaign_link(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        InvestorProfile::create(['user_id' => $donor->id, 'max_investment' => 1000]);
        $campaign = $this->campaign($owner);
        $update = $this->update($campaign);
        $this->login($donor)->postJson('/api/v1/investments', ['campaignId' => $campaign->id, 'amount' => 100])->assertCreated();
        $this->login($owner)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/finalize')->assertOk()->assertJsonPath('data.status', 'failed');
        $this->assertDatabaseHas('investments', ['investor_id' => $donor->id, 'campaign_id' => $campaign->id, 'status' => 'refunded']);
        $this->login($donor)->getJson(self::PATH)->assertOk()->assertJsonPath('data.data.0.id', $update->id);
        $this->getJson('/api/v1/campaigns/public/'.$campaign->id)->assertOk();
    }

    public function test_authentication_active_account_and_investor_role_are_required(): void
    {
        $this->login(null)->getJson(self::PATH)->assertUnauthorized();
        foreach (['entrepreneur', 'admin'] as $role) {
            $this->login($this->user($role))->getJson(self::PATH)->assertForbidden();
        }
        $inactive = $this->user();
        $inactive->update(['is_active' => false]);
        $this->login($inactive)->getJson(self::PATH)->assertUnauthorized();
    }

    public function test_public_content_does_not_mint_private_file_credentials_or_expose_user_records(): void
    {
        $owner = $this->user('entrepreneur');
        $donor = $this->user();
        $campaign = $this->campaign($owner);
        $this->back($donor, $campaign);
        $privatePath = '/api/v1/private-files/documents/secret.pdf';
        $this->update($campaign, ['content' => $privatePath, 'attachments' => [['url' => $privatePath, 'type' => 'document']]]);
        $this->login($donor)->getJson(self::PATH)->assertOk()->assertJsonPath('data.data.0.content', $privatePath)->assertJsonPath('data.data.0.attachments.0.url', $privatePath)->assertDontSee('signature=')->assertDontSee($owner->email)->assertDontSee($donor->email)->assertDontSee('PRIVATE PHONE')->assertJsonMissingPath('data.data.0.author')->assertJsonMissingPath('data.data.0.investments');
    }
}
