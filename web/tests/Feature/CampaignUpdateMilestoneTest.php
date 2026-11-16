<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignUpdate;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\Investment;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class CampaignUpdateMilestoneTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        Storage::fake('public');
        Storage::fake('local');
    }

    private function account(string $role = 'entrepreneur'): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test']);
        $user->assignRole($role);
        if ($role === 'entrepreneur') {
            EntrepreneurProfile::create(['user_id' => $user->id, 'first_name' => 'Owner', 'last_name' => 'Test']);
        }

        return $user;
    }

    private function asUser(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function campaign(User $owner): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Milestone validation', 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => 'published']);
    }

    private function path(Campaign $campaign): string
    {
        return '/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/updates';
    }

    private function backer(Campaign $campaign): User
    {
        $backer = $this->account('investor');
        Investment::create(['campaign_id' => $campaign->id, 'investor_id' => $backer->id, 'amount' => 25]);

        return $backer;
    }

    public function test_update_accepts_its_own_campaigns_milestone_and_notifies_once(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $milestone = $campaign->milestones()->create(['title' => 'Own milestone']);
        $backer = $this->backer($campaign);
        $this->asUser($owner)->post($this->path($campaign), ['title' => 'Valid update', 'content' => 'Progress for this milestone', 'milestoneId' => $milestone->id, 'file' => UploadedFile::fake()->create('evidence.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.campaignId', $campaign->id)->assertJsonPath('data.milestoneId', $milestone->id)->assertJsonPath('data.milestone.campaignId', $campaign->id);
        $this->assertDatabaseCount('campaign_updates', 1);
        $this->assertCount(1, Storage::disk('public')->allFiles('updates'));
        $this->assertSame(1, Notification::where('user_id', $backer->id)->where('type_code', 'campaign_update')->count());
    }

    public function test_other_campaigns_milestones_are_rejected_even_with_the_same_owner(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $this->backer($campaign);
        foreach ([$owner, $this->account()] as $foreignOwner) {
            $foreign = $this->campaign($foreignOwner);
            $foreign->update(['status' => 'draft']);
            $milestone = $foreign->milestones()->create(['title' => 'FOREIGN SECRET MILESTONE']);
            $this->asUser($owner)->post($this->path($campaign), ['title' => 'Invalid update', 'content' => 'Should never be saved', 'milestoneId' => $milestone->id, 'file' => UploadedFile::fake()->create('evidence.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('milestoneId')->assertDontSee('FOREIGN SECRET MILESTONE');
        }
        $this->assertDatabaseCount('campaign_updates', 0);
        $this->assertDatabaseCount('notifications', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_nonexistent_and_malformed_milestone_ids_are_validation_errors(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        foreach ([(string) Str::uuid(), 'not-a-uuid'] as $id) {
            $this->asUser($owner)->postJson($this->path($campaign), ['title' => 'Invalid update', 'content' => 'No milestone exists', 'milestoneId' => $id])->assertUnprocessable()->assertJsonValidationErrors('milestoneId');
        }
        $this->assertDatabaseCount('campaign_updates', 0);
    }

    public function test_updates_can_omit_the_milestone_or_use_null(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        foreach ([[], ['milestoneId' => null]] as $extra) {
            $this->asUser($owner)->postJson($this->path($campaign), ['title' => 'General update', 'content' => 'No milestone is required', ...$extra])->assertCreated()->assertJsonPath('data.milestoneId', null)->assertJsonPath('data.milestone', null);
        }
    }

    public function test_milestone_removed_after_validation_is_rejected_before_file_storage(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $milestone = $campaign->milestones()->create(['title' => 'May disappear']);
        $armed = true;
        Campaign::retrieved(function ($current) use (&$armed, $campaign, $milestone): void {
            // Simulate deletion between the initial validator and the locked recheck.
            if ($armed && $current->id === $campaign->id && DB::transactionLevel() > 1) {
                $armed = false;
                DB::table('campaign_milestones')->where('id', $milestone->id)->delete();
            }
        });
        $this->asUser($owner)->post($this->path($campaign), ['title' => 'Race update', 'content' => 'Must not save invalid association', 'milestoneId' => $milestone->id, 'file' => UploadedFile::fake()->create('file.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('milestoneId');
        $this->assertFalse($armed);
        $this->assertDatabaseCount('campaign_updates', 0);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_other_users_cannot_publish_to_the_campaign(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $milestone = $campaign->milestones()->create(['title' => 'Own milestone']);
        $body = ['title' => 'Unauthorized update', 'content' => 'Must not be created', 'milestoneId' => $milestone->id];
        $this->asUser(null)->postJson($this->path($campaign), $body)->assertUnauthorized();
        $this->asUser($this->account())->postJson($this->path($campaign), $body)->assertForbidden();
        $this->asUser($this->account('investor'))->postJson($this->path($campaign), $body)->assertForbidden();
        $this->assertDatabaseCount('campaign_updates', 0);
    }

    public function test_failed_update_insert_removes_only_the_new_upload_and_rolls_back(): void
    {
        $owner = $this->account();
        $campaign = $this->campaign($owner);
        $this->backer($campaign);
        $milestone = $campaign->milestones()->create(['title' => 'Own milestone']);
        Storage::disk('public')->put('updates/existing.pdf', 'Keep previous evidence');
        $fail = true;
        CampaignUpdate::creating(function () use (&$fail): void {
            if ($fail) {
                throw new \RuntimeException('Simulated insert failure');
            }
        });
        try {
            $this->asUser($owner)->post($this->path($campaign), ['title' => 'Failed update', 'content' => 'Must roll back', 'milestoneId' => $milestone->id, 'file' => UploadedFile::fake()->create('new.pdf', 10, 'application/pdf')], ['Accept' => 'application/json'])->assertStatus(500);
        } finally {
            $fail = false;
        }
        $this->assertDatabaseCount('campaign_updates', 0);
        $this->assertDatabaseCount('notifications', 0);
        $this->assertSame(['updates/existing.pdf'], Storage::disk('public')->allFiles());
    }

    public function test_repair_inventory_does_not_modify_records(): void
    {
        [$update] = $this->invalidLink();
        $before = $update->fresh()->getAttributes();
        $this->artisan('campaigns:repair-update-milestones')->expectsOutput('Vínculos incorrectos detectados: 1')->assertSuccessful();
        $this->assertSame($before, $update->fresh()->getAttributes());
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_repair_preserves_updates_and_files_and_backs_up_only_invalid_links(): void
    {
        [$invalid, $milestone] = $this->invalidLink();
        $valid = CampaignUpdate::create(['campaign_id' => $milestone->campaign_id, 'author_id' => $invalid->author_id, 'milestone_id' => $milestone->id, 'title' => 'Valid original update', 'content' => 'Keep valid relationship']);
        $validBefore = $valid->fresh()->getAttributes();
        $invalidBefore = $invalid->fresh()->getAttributes();
        Storage::disk('public')->put('updates/original.pdf', 'Keep all attachments');
        $this->artisan('campaigns:repair-update-milestones', ['--apply' => true])->expectsOutput('Vínculos corregidos: 1')->assertSuccessful();
        $this->assertSame($validBefore, $valid->fresh()->getAttributes());
        $invalidBefore['milestone_id'] = null;
        $this->assertSame($invalidBefore, $invalid->fresh()->getAttributes());
        $backups = Storage::disk('local')->allFiles('milestone-link-repairs');
        $this->assertCount(1, $backups);
        $backup = json_decode(Storage::disk('local')->get($backups[0]), true);
        $this->assertSame($invalid->id, $backup['links'][0]['updateId']);
        $this->assertSame($milestone->id, $backup['links'][0]['milestoneId']);
        $this->assertSame('Keep all attachments', Storage::disk('public')->get('updates/original.pdf'));
        $this->artisan('campaigns:repair-update-milestones', ['--apply' => true])->expectsOutput('Vínculos corregidos: 0')->assertSuccessful();
        $this->assertCount(1, Storage::disk('local')->allFiles('milestone-link-repairs'));
    }

    public function test_repair_failure_rolls_back_all_links(): void
    {
        [$invalid] = $this->invalidLink();
        $before = $invalid->fresh()->getAttributes();
        $fail = true;
        DB::listen(function ($query) use (&$fail): void {
            if ($fail && str_starts_with(strtolower(ltrim($query->sql)), 'update')) {
                throw new \RuntimeException('Simulated database failure');
            }
        });
        try {
            $this->artisan('campaigns:repair-update-milestones', ['--apply' => true])->assertFailed();
        } finally {
            $fail = false;
        }
        $this->assertSame($before, $invalid->fresh()->getAttributes());
    }

    public function test_repair_requires_a_successful_private_backup(): void
    {
        [$invalid] = $this->invalidLink();
        $before = $invalid->fresh()->getAttributes();
        $disk = \Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('put')->once()->andReturn(false);
        Storage::set('local', $disk);
        $this->artisan('campaigns:repair-update-milestones', ['--apply' => true])->assertFailed();
        $this->assertSame($before, $invalid->fresh()->getAttributes());
    }

    private function invalidLink(): array
    {
        $owner = $this->account();
        $one = $this->campaign($owner);
        $two = $this->campaign($owner);
        $milestone = $two->milestones()->create(['title' => 'Wrong campaign milestone']);
        $update = CampaignUpdate::create(['campaign_id' => $one->id, 'author_id' => $owner->id, 'milestone_id' => $milestone->id, 'title' => 'Original update', 'content' => 'Keep original content', 'attachments' => [['url' => '/storage/updates/original.pdf']], 'is_public' => false]);

        return [$update, $milestone];
    }
}
