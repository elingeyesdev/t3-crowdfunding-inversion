<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignDocument;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class CampaignUploadRecoveryTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Campaign $campaign;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        Storage::fake('local');
        Storage::fake('public');
        $this->owner = User::create(['email' => Str::uuid().'@example.test'])->fresh();
        $this->owner->assignRole('entrepreneur');
        $this->campaign = Campaign::create(['creator_id' => $this->owner->id,
            'category_id' => Category::first()->id, 'title' => 'Upload recovery',
            'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => 'draft']);
        $this->actingAs($this->owner, 'sanctum');
    }

    private function document(string $key, string $justification = 'Respaldo')
    {
        return $this->post('/api/v1/entrepreneurs/me/campaigns/'.$this->campaign->id.'/documents', [
            'file' => UploadedFile::fake()->createWithContent('evidence.pdf', '%PDF-1.4 synthetic evidence'),
            'justification' => $justification, 'uploadId' => $key,
        ], ['Accept' => 'application/json']);
    }

    public function test_lost_document_response_can_be_retried_without_another_record_or_file(): void
    {
        $key = (string) Str::uuid();
        $first = $this->document($key)->assertCreated();
        $second = $this->document($key)->assertCreated();
        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertArrayNotHasKey('upload_key', $second->json('data'));
        $this->assertArrayNotHasKey('upload_fingerprint', $second->json('data'));
        $this->assertDatabaseCount('campaign_documents', 1);
        $this->assertCount(1, Storage::disk('local')->allFiles('documents'));
        $this->assertStringContainsString('signature=', $second->json('data.file_url'));
        $this->get($second->json('data.file_url'))->assertOk();
    }

    public function test_an_identity_cannot_replace_its_original_payload(): void
    {
        $key = (string) Str::uuid();
        $this->document($key)->assertCreated();
        $this->document($key, 'Respaldo distinto')->assertConflict();
        $this->assertSame('Respaldo', CampaignDocument::first()->justification);
        $this->assertDatabaseCount('campaign_documents', 1);
        $this->assertCount(1, Storage::disk('local')->allFiles('documents'));
    }

    public function test_different_identities_and_legacy_clients_can_upload_the_same_named_file(): void
    {
        $this->document((string) Str::uuid())->assertCreated();
        $this->document((string) Str::uuid())->assertCreated();
        $this->document('')->assertCreated();
        $this->assertDatabaseCount('campaign_documents', 3);
        $this->assertCount(3, Storage::disk('local')->allFiles('documents'));
        $this->document('invalid')->assertUnprocessable()->assertJsonValidationErrors('uploadId');
    }

    public function test_upload_retry_still_requires_the_campaign_owner(): void
    {
        $key = (string) Str::uuid();
        $this->document($key)->assertCreated();
        $other = User::create(['email' => Str::uuid().'@example.test'])->fresh();
        $other->assignRole('entrepreneur');
        $this->actingAs($other, 'sanctum');
        $this->document($key)->assertForbidden();
        $this->assertDatabaseCount('campaign_documents', 1);
    }

    public function test_failed_document_insert_removes_its_file_and_allows_a_retry(): void
    {
        $key = (string) Str::uuid();
        DB::unprepared("CREATE TRIGGER fail_document BEFORE INSERT ON campaign_documents BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
        $this->document($key)->assertServerError();
        $this->assertDatabaseCount('campaign_documents', 0);
        $this->assertCount(0, Storage::disk('local')->allFiles('documents'));
        DB::unprepared('DROP TRIGGER fail_document');
        $this->document($key)->assertCreated();
        $this->assertDatabaseCount('campaign_documents', 1);
    }

    public function test_lost_cover_response_reuses_the_current_file_but_a_changed_cover_is_saved(): void
    {
        $url = '/api/v1/entrepreneurs/me/campaigns/'.$this->campaign->id.'/cover';
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=');
        $first = $this->post($url, ['file' => UploadedFile::fake()->createWithContent('cover.png', $png)], ['Accept' => 'application/json'])->assertOk();
        $second = $this->post($url, ['file' => UploadedFile::fake()->createWithContent('cover.png', $png)], ['Accept' => 'application/json'])->assertOk();
        $this->assertSame($first->json('data.coverImageUrl'), $second->json('data.coverImageUrl'));
        $this->assertCount(1, Storage::disk('public')->allFiles('campaigns'));
        $third = $this->post($url, ['file' => UploadedFile::fake()->createWithContent('cover.png', $png.'changed')], ['Accept' => 'application/json'])->assertOk();
        $this->assertNotSame($first->json('data.coverImageUrl'), $third->json('data.coverImageUrl'));
        $this->assertCount(2, Storage::disk('public')->allFiles('campaigns'));
    }
}
