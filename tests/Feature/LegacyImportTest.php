<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class LegacyImportTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(): array
    {
        Storage::fake('local');
        $id = (string) Str::uuid();
        $role = (string) Str::uuid();
        $hash = Hash::make('Password123');
        $export = ['version' => 1, 'tables' => [
            'roles' => [['id' => $role, 'name' => 'investor']],
            'users' => [['id' => $id, 'email' => 'imported@example.test', 'password_hash' => $hash, 'is_active' => true]],
            'user_roles' => [['id' => (string) Str::uuid(), 'user_id' => $id, 'role_id' => $role, 'assigned_at' => '2026-10-01T12:00:00Z']],
            'campaigns' => [], 'audit_logs' => [['id' => 'original-log', 'event' => 'Historical record']],
        ]];
        Storage::disk('local')->put('fixture.json', json_encode($export));

        return [Storage::disk('local')->path('fixture.json'), $id, $hash];
    }

    public function test_import_keeps_ids_hashes_and_complete_archival_rows(): void
    {
        [$file,$id,$hash] = $this->fixture();
        $this->artisan('legacy:import', ['file' => $file])->assertSuccessful();
        $this->assertDatabaseHas('users', ['id' => $id, 'password_hash' => $hash]);
        $this->assertDatabaseCount('legacy_records', 4);
        $payload = json_decode(DB::table('legacy_records')->where('source_table', 'audit_logs')->value('payload'), true);
        $this->assertSame('Historical record', $payload['event']);
        $this->artisan('legacy:verify', ['file' => $file])->assertSuccessful();
    }

    public function test_dry_run_checks_inserts_and_rolls_everything_back(): void
    {
        [$file] = $this->fixture();
        $this->artisan('legacy:import', ['file' => $file, '--dry-run' => true])->assertSuccessful();
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('legacy_records', 0);
    }

    public function test_import_refuses_nonempty_destination(): void
    {
        [$file] = $this->fixture();
        $this->seed();
        $this->artisan('legacy:import', ['file' => $file])->assertFailed();
        $this->assertDatabaseCount('users', 0);
    }
}
