<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignStatusHistory;
use App\Models\Category;
use App\Models\Comment;
use App\Models\EntrepreneurProfile;
use App\Models\Investment;
use App\Models\InvestorProfile;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CampaignReadVisibilityTest extends TestCase
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
        $user = User::create(['email' => Str::uuid().'@example.test', 'phone' => 'PRIVATE PHONE', 'last_login_ip' => '192.0.2.10']);
        $user->assignRole($role);
        if ($role === 'entrepreneur') {
            EntrepreneurProfile::create(['user_id' => $user->id, 'first_name' => 'Public', 'last_name' => 'Author', 'display_name' => 'author-'.Str::uuid(), 'avatar_url' => '/storage/profiles/avatar.jpg']);
        }

        return $user;
    }

    private function asUser(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function resources(User $owner, string $status = 'published'): array
    {
        $campaign = Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Visibility campaign', 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => $status]);
        $campaign->fundingPlan()->create(['category' => 'Equipment', 'description' => 'Public budget', 'amount' => 1000, 'percentage' => 100]);
        $milestone = $campaign->milestones()->create(['title' => 'Public milestone', 'description' => 'Public milestone description']);
        $public = $campaign->updates()->create(['author_id' => $owner->id, 'milestone_id' => $milestone->id, 'title' => 'Public update', 'content' => 'Public content', 'is_public' => true]);
        $private = $campaign->updates()->create(['author_id' => $owner->id, 'milestone_id' => $milestone->id, 'title' => 'PRIVATE UPDATE', 'content' => 'PRIVATE UPDATE CONTENT', 'is_public' => false]);
        $reviewer = $this->account('admin');
        $movement = $campaign->financialMovements()->create(['created_by' => $owner->id, 'reviewed_by' => $reviewer->id, 'reviewed_at' => now(), 'type' => 'expense', 'concept' => 'Equipment purchase', 'category' => 'Equipment', 'amount' => 100, 'movement_date' => now()->toDateString(), 'status' => 'verified', 'notes' => 'PRIVATE FINANCIAL NOTE', 'reference_number' => 'PRIVATE SYSTEM REFERENCE', 'review_notes' => 'PRIVATE REVIEW NOTE', 'receipt_url' => '/storage/receipts/private.pdf']);

        return compact('campaign', 'milestone', 'public', 'private', 'movement');
    }

    private function paths(array $resources, string $prefix = 'campaigns'): array
    {
        $base = '/api/v1/'.$prefix.'/'.$resources['campaign']->id;

        return [$base.'/funding-plan', $base.'/financial-ledger', $base.'/milestones', $base.'/milestones/'.$resources['milestone']->id, $base.'/updates'];
    }

    public function test_nonpublic_campaigns_cannot_be_read_through_public_routes_even_by_the_owner_or_admin(): void
    {
        $owner = $this->account();
        $outsider = $this->account();
        $admin = $this->account('admin');
        foreach (['draft', 'pending_review', 'in_review', 'approved', 'rejected', 'suspended', 'cancelled', 'completed', 'failed'] as $status) {
            $resources = $this->resources($owner, $status);
            foreach ([null, $outsider, $owner, $admin] as $actor) {
                $this->asUser($actor);
                foreach ($this->paths($resources) as $path) {
                    $this->getJson($path)->assertNotFound();
                }
            }
        }
    }

    public function test_all_existing_public_statuses_remain_readable(): void
    {
        foreach (Campaign::PUBLIC_STATUSES as $status) {
            $resources = $this->resources($this->account(), $status);
            $this->asUser(null);
            foreach ($this->paths($resources) as $path) {
                $this->getJson($path)->assertOk();
            }
        }
    }

    public function test_public_data_is_filtered_for_visitors_unrelated_users_owners_and_admins(): void
    {
        $owner = $this->account();
        foreach (['published', 'completed', 'failed'] as $status) {
            $resources = $this->resources($owner);
            $resources['campaign']->update(['status' => $status, 'published_at' => now()->subDay()]);
            $base = '/api/v1/campaigns/'.$resources['campaign']->id;
            foreach ([null, $this->account('investor'), $owner, $this->account('admin')] as $actor) {
                $this->asUser($actor);
                $this->getJson($base.'/funding-plan')->assertOk()->assertJsonPath('data.0.description', 'Public budget');
                $ledger = $this->getJson($base.'/financial-ledger?includePrivate=true')->assertOk();
                $ledger->assertJsonPath('data.summary.totalExpense', 100)->assertJsonPath('data.movements.0.concept', 'Equipment purchase');
                foreach (['notes', 'referenceNumber', 'reviewedBy', 'reviewNotes', 'reviewedAt', 'receiptUrl', 'createdBy', 'creator', 'reviewer'] as $field) {
                    $ledger->assertJsonMissingPath('data.movements.0.'.$field);
                }
                $this->getJson($base.'/milestones')->assertOk()->assertJsonCount(1, 'data.0.updates')->assertJsonPath('data.0.updates.0.id', $resources['public']->id)->assertDontSee('PRIVATE UPDATE');
                $this->getJson($base.'/milestones/'.$resources['milestone']->id)->assertOk()->assertJsonCount(1, 'data.updates')->assertJsonPath('data.updates.0.id', $resources['public']->id)->assertDontSee('PRIVATE UPDATE');
                $updates = $this->getJson($base.'/updates?isPublic=false')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $resources['public']->id);
                $updates->assertJsonPath('data.0.authorName', 'Public Author')->assertJsonPath('data.0.authorAvatar', '/storage/profiles/avatar.jpg')->assertJsonPath('data.0.milestone.title', 'Public milestone');
                $updates->assertJsonMissingPath('data.0.author')->assertDontSee($owner->email)->assertDontSee('PRIVATE PHONE')->assertDontSee('192.0.2.10')->assertDontSee('PRIVATE UPDATE');
            }
        }
    }

    public function test_finalized_campaigns_keep_their_links_and_investment_history_without_accepting_new_contributions(): void
    {
        foreach ([1000 => 'completed', 100 => 'failed'] as $amount => $status) {
            $owner = $this->account();
            $resources = $this->resources($owner);
            $campaign = $resources['campaign'];
            // Legacy public campaigns without published_at remain readable via closure history.
            $this->assertNull($campaign->published_at);
            $backer = $this->account('investor');
            InvestorProfile::create(['user_id' => $backer->id, 'max_investment' => 5000]);
            $investmentId = $this->asUser($backer)->postJson('/api/v1/investments', ['campaignId' => $campaign->id, 'amount' => $amount])->assertCreated()->json('data.ticket.id');
            $this->asUser($owner)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/finalize')->assertOk()->assertJsonPath('data.status', $status);
            $this->assertDatabaseHas('campaign_status_history', ['campaign_id' => $campaign->id, 'to_status' => $status]);
            foreach ([null, $backer, $owner, $this->account('admin')] as $actor) {
                $this->asUser($actor);
                $this->getJson('/api/v1/campaigns/public/'.$campaign->id)->assertOk()->assertJsonPath('data.status', $status);
                foreach ([...$this->paths($resources), '/api/v1/campaigns/public/'.$campaign->id.'/financial-progress', '/api/v1/campaigns/'.$campaign->id.'/comments', '/api/v1/campaigns/'.$campaign->id.'/rewards'] as $path) {
                    $this->getJson($path)->assertOk();
                }
            }
            $this->asUser($backer)->getJson('/api/v1/investments/me')->assertOk()->assertSee($campaign->id)->assertSee($investmentId);
            $counts = [DB::table('investments')->count(), DB::table('transactions')->count(), DB::table('campaign_financial_movements')->count(), Notification::count()];
            $balance = $backer->investor->fresh()->getAttributes();
            $before = $campaign->fresh()->getAttributes();
            $this->postJson('/api/v1/investments', ['campaignId' => $campaign->id, 'amount' => 10])->assertUnprocessable();
            $this->assertSame($counts, [DB::table('investments')->count(), DB::table('transactions')->count(), DB::table('campaign_financial_movements')->count(), Notification::count()]);
            $this->assertSame($balance, $backer->investor->fresh()->getAttributes());
            $this->assertSame($before, $campaign->fresh()->getAttributes());
            $this->getJson('/api/v1/campaigns/public?q=Visibility')->assertOk()->assertDontSee($campaign->id);
            $this->getJson('/api/v1/campaigns/public/updates/recent')->assertOk()->assertDontSee($resources['public']->id);
        }
    }

    public function test_published_closed_campaigns_remain_readable_but_do_not_enter_the_active_catalog(): void
    {
        foreach (['completed', 'failed'] as $status) {
            $resources = $this->resources($this->account(), $status);
            $campaign = $resources['campaign'];
            $campaign->update(['published_at' => now()->subDays(10)]);
            $this->asUser(null)->getJson('/api/v1/campaigns/public/'.$campaign->id)->assertOk();
            foreach ($this->paths($resources) as $path) {
                $this->getJson($path)->assertOk();
            }
            $this->getJson('/api/v1/campaigns/public?status='.$status)->assertOk()->assertDontSee($campaign->id);
            $this->postJson('/api/v1/campaigns/public/'.$campaign->id.'/view')->assertOk();
        }
        $active = $this->resources($this->account());
        $this->getJson('/api/v1/campaigns/public')->assertOk()->assertSee($active['campaign']->id);
    }

    public function test_private_states_stay_private_even_with_a_publication_date_and_unpublished_closures_stay_private(): void
    {
        foreach (['draft', 'pending_review', 'in_review', 'approved', 'rejected', 'suspended', 'cancelled', 'completed', 'failed'] as $status) {
            $resources = $this->resources($this->account(), $status);
            $campaign = $resources['campaign'];
            if (! in_array($status, ['completed', 'failed'], true)) {
                $campaign->update(['published_at' => now()->subDay()]);
            }
            // A transition from a private state does not prove prior publication.
            CampaignStatusHistory::create(['campaign_id' => $campaign->id, 'from_status' => 'draft', 'to_status' => $status]);
            $this->asUser(null);
            foreach ([...$this->paths($resources), '/api/v1/campaigns/public/'.$campaign->id, '/api/v1/campaigns/public/'.$campaign->id.'/financial-progress', '/api/v1/campaigns/'.$campaign->id.'/comments', '/api/v1/campaigns/'.$campaign->id.'/rewards'] as $path) {
                $this->getJson($path)->assertNotFound();
            }
            $this->postJson('/api/v1/campaigns/public/'.$campaign->id.'/view')->assertNotFound();
        }
    }

    public function test_historical_comments_remain_readable_without_allowing_new_comments_or_likes(): void
    {
        $owner = $this->account();
        foreach (['completed', 'failed'] as $status) {
            $resources = $this->resources($owner, $status);
            $campaign = $resources['campaign'];
            $campaign->update(['published_at' => now()->subDay()]);
            $comment = Comment::create(['campaign_id' => $campaign->id, 'author_id' => $owner->id, 'content' => 'Historical comment']);
            $base = '/api/v1/campaigns/'.$campaign->id.'/comments';
            $this->asUser(null)->getJson($base)->assertOk()->assertJsonPath('data.0.content', 'Historical comment');
            $this->asUser($owner)->postJson($base, ['content' => 'New comment'])->assertNotFound();
            $this->postJson($base.'/'.$comment->id.'/like')->assertNotFound();
            $this->assertSame(1, Comment::where('campaign_id', $campaign->id)->count());
            $this->assertSame(0, $comment->likes()->count());
        }
    }

    public function test_closure_evidence_must_belong_to_the_same_campaign_and_match_its_closed_state(): void
    {
        $owner = $this->account();
        $completed = $this->resources($owner, 'completed');
        CampaignStatusHistory::create(['campaign_id' => $completed['campaign']->id, 'from_status' => 'funded', 'to_status' => 'completed']);
        $failed = $this->resources($owner, 'failed');
        $this->asUser(null)->getJson('/api/v1/campaigns/public/'.$failed['campaign']->id)->assertNotFound();
        CampaignStatusHistory::create(['campaign_id' => $failed['campaign']->id, 'from_status' => 'funded', 'to_status' => 'completed']);
        $this->getJson('/api/v1/campaigns/public/'.$failed['campaign']->id)->assertNotFound();
        $this->getJson('/api/v1/campaigns/public/'.$completed['campaign']->id)->assertOk();
    }

    public function test_owner_management_routes_keep_private_campaign_data(): void
    {
        $owner = $this->account();
        foreach (['draft', 'published'] as $status) {
            $resources = $this->resources($owner, $status);
            $this->asUser($owner);
            $this->assertPrivateReads($resources, 'entrepreneurs/me/campaigns');
        }
    }

    public function test_admin_and_superadmin_can_review_private_campaign_data(): void
    {
        $resources = $this->resources($this->account(), 'draft');
        foreach (['admin', 'super_admin'] as $role) {
            $this->asUser($this->account($role));
            $this->assertPrivateReads($resources, 'admin/campaigns');
        }
    }

    private function assertPrivateReads(array $resources, string $prefix): void
    {
        [$plan, $ledger, $milestones, $milestone, $updates] = $this->paths($resources, $prefix);
        $this->getJson($plan)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson($ledger)->assertOk()->assertJsonPath('data.movements.0.notes', 'PRIVATE FINANCIAL NOTE')->assertJsonPath('data.movements.0.referenceNumber', 'PRIVATE SYSTEM REFERENCE')->assertJsonPath('data.movements.0.reviewNotes', 'PRIVATE REVIEW NOTE')->assertJsonPath('data.movements.0.receiptUrl', '/storage/receipts/private.pdf');
        $this->getJson($milestones)->assertOk()->assertJsonCount(2, 'data.0.updates');
        $this->getJson($milestone)->assertOk()->assertJsonCount(2, 'data.updates');
        $this->getJson($updates)->assertOk()->assertJsonCount(2, 'data')->assertSee('PRIVATE UPDATE CONTENT');
    }

    public function test_private_routes_require_an_active_authorized_user(): void
    {
        $owner = $this->account();
        $resources = $this->resources($owner, 'draft');
        $ownerPaths = $this->paths($resources, 'entrepreneurs/me/campaigns');
        $adminPaths = $this->paths($resources, 'admin/campaigns');
        $this->asUser(null);
        foreach ([...$ownerPaths, ...$adminPaths] as $path) {
            $this->getJson($path)->assertUnauthorized();
        }
        foreach ([$this->account(), $this->account('investor')] as $outsider) {
            $this->asUser($outsider);
            foreach ([...$ownerPaths, ...$adminPaths] as $path) {
                $this->getJson($path)->assertForbidden();
            }
        }
        $this->asUser($owner);
        foreach ($adminPaths as $path) {
            $this->getJson($path)->assertForbidden();
        }
        $owner->update(['is_active' => false]);
        $this->asUser($owner);
        foreach ($ownerPaths as $path) {
            $this->getJson($path)->assertUnauthorized();
        }
        $admin = $this->account('admin');
        $admin->update(['is_active' => false]);
        $this->asUser($admin);
        foreach ($adminPaths as $path) {
            $this->getJson($path)->assertUnauthorized();
        }
    }

    public function test_milestone_reads_exclude_updates_from_another_campaign(): void
    {
        $owner = $this->account();
        $resources = $this->resources($owner);
        $foreign = $this->resources($this->account(), 'draft');
        // Existing malformed links must not disclose data, independently of write validation.
        $foreign['public']->update(['milestone_id' => $resources['milestone']->id, 'content' => 'FOREIGN PRIVATE CAMPAIGN CONTENT']);
        $resources['public']->update(['milestone_id' => $foreign['milestone']->id]);

        $this->asUser(null)->getJson($this->paths($resources)[3])->assertOk()->assertJsonCount(0, 'data.updates')->assertDontSee('FOREIGN PRIVATE CAMPAIGN CONTENT');
        $base = '/api/v1/campaigns/'.$resources['campaign']->id;
        $this->getJson($base.'/updates')->assertOk()->assertJsonPath('data.0.milestone', null)->assertDontSee('Public milestone description');
        $this->getJson($base.'/milestones/'.$foreign['milestone']->id)->assertNotFound();
        $this->asUser($owner)->getJson($this->paths($resources, 'entrepreneurs/me/campaigns')[3])->assertOk()->assertJsonCount(1, 'data.updates')->assertDontSee('FOREIGN PRIVATE CAMPAIGN CONTENT');
    }

    public function test_private_updates_do_not_notify_unrelated_backers(): void
    {
        $owner = $this->account();
        $resources = $this->resources($owner);
        $backer = $this->account('investor');
        Investment::create(['campaign_id' => $resources['campaign']->id, 'investor_id' => $backer->id, 'amount' => 100]);
        $path = '/api/v1/entrepreneurs/me/campaigns/'.$resources['campaign']->id.'/updates';

        $this->asUser($owner)->postJson($path, ['title' => 'PRIVATE ANNOUNCEMENT', 'content' => 'Private announcement content', 'isPublic' => false])->assertCreated();
        $this->assertSame(0, Notification::where('user_id', $backer->id)->count());
        $this->postJson($path, ['title' => 'Public announcement', 'content' => 'Public announcement content', 'isPublic' => true])->assertCreated();
        $this->assertSame(1, Notification::where('user_id', $backer->id)->where('type_code', 'campaign_update')->count());
        $resources['campaign']->update(['status' => 'suspended']);
        $this->postJson($path, ['title' => 'Hidden campaign announcement', 'content' => 'No public access to this campaign', 'isPublic' => true])->assertCreated();
        $this->assertSame(1, Notification::where('user_id', $backer->id)->count());
    }
}
