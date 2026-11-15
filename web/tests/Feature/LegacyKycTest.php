<?php

namespace Tests\Feature;

use App\Models\EntrepreneurProfile;
use App\Models\InvestorProfile;
use App\Models\User;
use App\Services\LegacyKycFiles;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class LegacyKycTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        Storage::fake('local');
        Storage::fake('public');
        Storage::fake('legacy-kyc');
        config(['legacy.kyc_directories' => [Storage::disk('legacy-kyc')->path(''), Storage::disk('public')->path('uploads/kyc')]]);
    }

    private function profile(array $documents, string $kind = 'entrepreneur')
    {
        $user = User::create(['email' => Str::uuid().'@example.test']);
        $user->assignRole($kind);
        $model = $kind === 'entrepreneur' ? EntrepreneurProfile::class : InvestorProfile::class;

        return $model::create(['user_id' => $user->id, 'first_name' => 'Audit', 'verification_documents' => $documents, 'identity_verified' => true]);
    }

    private function authenticate(User $user): static
    {
        Auth::forgetGuards();

        return $this->withToken($user->createToken('test')->plainTextToken);
    }

    public function test_dry_run_does_not_write_files_or_references(): void
    {
        $documents = [['type' => 'idDocument', 'url' => '/uploads/kyc/id.pdf']];
        $profile = $this->profile($documents);
        Storage::disk('legacy-kyc')->put('id.pdf', 'private fixture');

        $this->artisan('legacy:secure-kyc', ['--dry-run' => true])->assertSuccessful();

        $this->assertSame($documents, $profile->fresh()->verification_documents);
        Storage::disk('legacy-kyc')->assertExists('id.pdf');
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_migration_preserves_bytes_metadata_and_orphans_then_removes_verified_sources(): void
    {
        $documents = [['type' => 'idDocument', 'url' => '/uploads/kyc/id.pdf', 'uploadedAt' => '2026-10-01T12:00:00Z', 'custom' => ['keep' => true]]];
        $profile = $this->profile($documents);
        $investor = $this->profile([['url' => 'https://legacy.example.test/storage/uploads/kyc/id.pdf?old=1']], 'investor');
        $updatedAt = $profile->updated_at;
        Storage::disk('legacy-kyc')->put('id.pdf', 'private fixture');
        Storage::disk('legacy-kyc')->put('orphan.jpg', 'unreferenced fixture');
        Storage::disk('public')->put('uploads/kyc/id.pdf', 'private fixture');

        $result = app(LegacyKycFiles::class)->migrate(false);

        $this->assertSame(2, $result['files']);
        $this->assertSame(2, $result['profiles']);
        $this->assertSame(3, $result['removedCopies']);
        $this->assertSame('private fixture', Storage::disk('local')->get('kyc/id.pdf'));
        $this->assertSame('unreferenced fixture', Storage::disk('local')->get('kyc/orphan.jpg'));
        // Windows does not expose Unix mode bits used by Flysystem visibility.
        // HTTP privacy is covered separately on both platforms.
        if (PHP_OS_FAMILY !== 'Windows') {
            $this->assertSame('private', Storage::disk('local')->getVisibility('kyc/id.pdf'));
        }
        Storage::disk('legacy-kyc')->assertMissing(['id.pdf', 'orphan.jpg']);
        Storage::disk('public')->assertMissing('uploads/kyc/id.pdf');
        $documents[0]['url'] = '/api/v1/private-files/kyc/id.pdf';
        $this->assertSame($documents, $profile->fresh()->verification_documents);
        $this->assertSame($documents[0]['url'], $investor->fresh()->verification_documents[0]['url']);
        $this->assertTrue($profile->fresh()->identity_verified);
        $this->assertTrue($updatedAt->equalTo($profile->fresh()->updated_at));
        $backup = json_decode(Storage::disk('local')->get($result['backup']), true);
        $this->assertCount(2, $backup['profiles']);
        $this->assertSame(hash('sha256', 'private fixture'), $backup['files']['id.pdf']['hash']);
        $this->getJson('/api/v1/private-files/'.$result['backup'])->assertForbidden();

        $repeat = app(LegacyKycFiles::class)->migrate(false);
        $this->assertSame(['files' => 0, 'profiles' => 0, 'removedCopies' => 0, 'backup' => null], $repeat);
    }

    public function test_missing_reference_aborts_without_deleting_available_files(): void
    {
        $documents = [['url' => '/uploads/kyc/missing.pdf']];
        $profile = $this->profile($documents);
        Storage::disk('legacy-kyc')->put('other.pdf', 'keep');

        $this->artisan('legacy:secure-kyc')->assertFailed();

        $this->assertSame($documents, $profile->fresh()->verification_documents);
        Storage::disk('legacy-kyc')->assertExists('other.pdf');
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_different_sources_with_same_name_are_not_overwritten_or_deleted(): void
    {
        $profile = $this->profile([['url' => '/uploads/kyc/id.pdf']]);
        Storage::disk('legacy-kyc')->put('id.pdf', 'first');
        Storage::disk('public')->put('uploads/kyc/id.pdf', 'second');

        $this->artisan('legacy:secure-kyc', ['--dry-run' => true])->assertFailed();
        $this->artisan('legacy:secure-kyc')->assertFailed();

        $this->assertSame('/uploads/kyc/id.pdf', $profile->fresh()->verification_documents[0]['url']);
        $this->assertSame('first', Storage::disk('legacy-kyc')->get('id.pdf'));
        $this->assertSame('second', Storage::disk('public')->get('uploads/kyc/id.pdf'));
        Storage::disk('local')->assertMissing('kyc/id.pdf');
    }

    public function test_conflicting_private_destination_aborts_including_dry_run(): void
    {
        Storage::disk('legacy-kyc')->put('id.pdf', 'source');
        Storage::disk('local')->put('kyc/id.pdf', 'different private document');

        $this->artisan('legacy:secure-kyc', ['--dry-run' => true])->assertFailed();
        $this->artisan('legacy:secure-kyc')->assertFailed();

        $this->assertSame('source', Storage::disk('legacy-kyc')->get('id.pdf'));
        $this->assertSame('different private document', Storage::disk('local')->get('kyc/id.pdf'));
    }

    public function test_failed_database_update_keeps_originals_and_rolls_back_references(): void
    {
        $documents = [['url' => '/uploads/kyc/id.pdf']];
        $profile = $this->profile($documents);
        Storage::disk('legacy-kyc')->put('id.pdf', 'keep');
        $fail = true;
        DB::listen(function (QueryExecuted $query) use (&$fail): void {
            if ($fail && str_starts_with(strtolower(ltrim($query->sql)), 'update')) {
                throw new \RuntimeException('Simulated database failure');
            }
        });

        $this->artisan('legacy:secure-kyc')->assertFailed();
        $fail = false;

        $this->assertSame($documents, $profile->fresh()->verification_documents);
        Storage::disk('legacy-kyc')->assertExists('id.pdf');
        $this->assertSame('keep', Storage::disk('local')->get('kyc/id.pdf'));
    }

    public function test_invalid_legacy_path_prevents_cleanup(): void
    {
        $this->profile([['url' => '/uploads/kyc/../id.pdf']]);
        Storage::disk('legacy-kyc')->put('id.pdf', 'keep');

        $this->artisan('legacy:secure-kyc')->assertFailed();

        Storage::disk('legacy-kyc')->assertExists('id.pdf');
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_nested_directories_are_not_recursively_removed(): void
    {
        Storage::disk('legacy-kyc')->put('nested/id.pdf', 'keep');

        $this->artisan('legacy:secure-kyc')->assertFailed();

        Storage::disk('legacy-kyc')->assertExists('nested/id.pdf');
    }

    public function test_legacy_references_are_signed_for_owner_and_admin_and_expire(): void
    {
        $profile = $this->profile([['url' => '/uploads/kyc/id.pdf']]);
        $profile->update(['kyc_status' => 'pending']);
        Storage::disk('local')->put('kyc/id.pdf', 'private fixture');

        $url = $this->authenticate($profile->user)->getJson('/api/v1/entrepreneurs/me/profile')->assertOk()->json('data.verificationDocuments.0.url');
        $this->assertStringContainsString('/api/v1/private-files/kyc/id.pdf?', $url);
        $this->assertStringContainsString('signature=', $url);
        $this->get($url)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->getJson(strtok($url, '?'))->assertForbidden();
        $this->getJson($url.'x')->assertForbidden();

        $admin = User::create(['email' => 'admin@example.test']);
        $admin->assignRole('admin');
        $adminUrl = $this->authenticate($admin)->getJson('/api/v1/admin/kyc/pending')->assertOk()->json('data.0.verification_documents.0.url');
        $this->get($adminUrl)->assertOk();
        $other = User::create(['email' => 'other@example.test']);
        $other->assignRole('entrepreneur');
        $this->authenticate($other)->getJson('/api/v1/admin/kyc/pending')->assertForbidden();
        $public = $this->getJson('/api/v1/entrepreneurs/'.$profile->id.'/profile')->assertOk();
        $public->assertJsonMissingPath('data.verificationDocuments');

        $this->travel(16)->minutes();
        $this->getJson($url)->assertForbidden();
    }

    public function test_old_static_paths_are_denied(): void
    {
        foreach (['/uploads/kyc/id.pdf', '/storage/kyc/id.pdf', '/storage/uploads/kyc/id.pdf'] as $path) {
            $this->get($path)->assertForbidden();
        }
    }

    public function test_user_controlled_profile_text_cannot_mint_links_to_another_profiles_kyc(): void
    {
        $owner = $this->profile([['url' => '/uploads/kyc/id.pdf']]);
        $other = $this->profile([]);
        Storage::disk('local')->put('kyc/id.pdf', 'private fixture');

        foreach ([
            '/uploads/kyc/id.pdf',
            '/api/v1/private-files/kyc/id.pdf',
            'https://legacy.example.test/storage/kyc/id.pdf',
            '/api/v1/private-files/kyc%2Fid.pdf',
            '/api/v1/private-files/documents/../kyc/id.pdf',
            '/api/v1/private-files/documents/%2E%2E/kyc/id.pdf',
        ] as $url) {
            $this->authenticate($other->user)->putJson('/api/v1/entrepreneurs/me/profile', ['bio' => $url])
                ->assertOk()->assertJsonPath('data.bio', $url);
            $this->getJson('/api/v1/entrepreneurs/'.$owner->id.'/profile')->assertJsonMissingPath('data.verificationDocuments');
        }
    }

    public function test_non_kyc_urls_are_preserved(): void
    {
        $documents = [['url' => '/uploads/profiles/avatar.jpg', 'type' => 'image']];
        $this->assertSame($documents, LegacyKycFiles::normalizeDocuments($documents));
        $this->assertNull(LegacyKycFiles::privateUrl('/uploads/kyc/../id.pdf'));
        $this->assertNull(LegacyKycFiles::privateUrl('/uploads/kyc/id%2Fother.pdf'));
    }

    public function test_legacy_verification_accepts_private_references_but_preserves_original_archive(): void
    {
        // Import must start on an empty business database.
        foreach (['roles', 'categories', 'notification_types'] as $table) {
            DB::table($table)->delete();
        }
        $userId = (string) Str::uuid();
        $profileId = (string) Str::uuid();
        $documents = [['url' => '/uploads/kyc/id.pdf', 'type' => 'idDocument']];
        $export = ['version' => 1, 'tables' => [
            'users' => [['id' => $userId, 'email' => 'imported@example.test']],
            'campaigns' => [],
            'entrepreneur_profiles' => [['id' => $profileId, 'user_id' => $userId, 'verification_documents' => $documents]],
        ]];
        Storage::disk('local')->put('fixture.json', json_encode($export));
        Storage::disk('legacy-kyc')->put('id.pdf', 'keep');
        $file = Storage::disk('local')->path('fixture.json');

        $this->artisan('legacy:import', ['file' => $file])->assertSuccessful();
        $this->artisan('legacy:secure-kyc')->assertSuccessful();
        $this->artisan('legacy:verify', ['file' => $file])->assertSuccessful();

        $archive = json_decode(DB::table('legacy_records')->where('source_table', 'entrepreneur_profiles')->value('payload'), true);
        $this->assertSame($documents, $archive['verification_documents']);
        $this->assertDatabaseHas('entrepreneur_profiles', ['id' => $profileId]);
        // Changing an unrelated field must still be detected.
        DB::table('users')->where('id', $userId)->update(['email' => 'changed@example.test']);
        $this->artisan('legacy:verify', ['file' => $file])->assertFailed();
    }
}
