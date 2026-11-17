<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignDocument;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class PublicCampaignDocumentsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        Storage::fake('local');
        Storage::fake('public');
    }

    private function user(string $role = 'entrepreneur'): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test']);
        $user->assignRole($role);

        return $user;
    }

    private function login(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function campaign(User $owner, string $status = 'published'): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Public evidence campaign', 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => $status]);
    }

    private function document(Campaign $campaign, array $attrs = []): CampaignDocument
    {
        $path = 'documents/'.Str::uuid().'.pdf';
        Storage::disk('local')->put($path, '%PDF-1.4 public evidence');

        return $campaign->documents()->create(['file_url' => '/api/v1/private-files/'.$path, 'original_name' => 'Evidencia.pdf', 'mime_type' => 'application/pdf', 'file_size_bytes' => 24, 'justification' => 'Public expense evidence', 'status' => 'approved', 'reviewer_notes' => 'PRIVATE REVIEW NOTE', 'reviewed_by' => $campaign->creator_id, 'reviewed_at' => now(), ...$attrs])->fresh();
    }

    private function base(Campaign $campaign): string
    {
        return '/api/v1/campaigns/public/'.$campaign->id.'/documents';
    }

    private function review(Campaign $campaign, CampaignDocument $document): string
    {
        return '/api/v1/admin/campaigns/'.$campaign->id.'/documents/'.$document->id.'/review';
    }

    public function test_only_approved_explicitly_public_documents_are_listed_and_downloadable_for_every_visitor(): void
    {
        $owner = $this->user();
        $campaign = $this->campaign($owner);
        $public = $this->document($campaign, ['is_public' => true]);
        $this->document($campaign); // Approval alone grants no public access.
        $this->document($campaign, ['status' => 'pending', 'is_public' => true]);
        $this->document($campaign, ['status' => 'rejected', 'is_public' => true]);
        foreach ([null, $owner, $this->user('investor'), $this->user('admin')] as $viewer) {
            $response = $this->login($viewer)->getJson($this->base($campaign))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $public->id);
            $response->assertDontSee('PRIVATE REVIEW NOTE')->assertDontSee('private-files')->assertDontSee('signature=');
            foreach (['reviewerNotes', 'reviewedBy', 'reviewedAt', 'isPublic'] as $field) {
                $response->assertJsonMissingPath('data.0.'.$field);
            }
            $link = $response->json('data.0.fileUrl');
            $this->get($link)->assertOk()->assertDownload('Evidencia.pdf')->assertHeader('X-Content-Type-Options', 'nosniff')->assertHeader('Cache-Control', 'no-store, private');
        }
    }

    public function test_nonpublic_and_unpublished_closed_campaigns_hide_lists_and_known_file_links(): void
    {
        $owner = $this->user();
        foreach (['draft', 'pending_review', 'in_review', 'approved', 'rejected', 'suspended', 'cancelled', 'completed', 'failed'] as $status) {
            $campaign = $this->campaign($owner, $status);
            $doc = $this->document($campaign, ['is_public' => true]);
            foreach ([null, $owner, $this->user('admin')] as $viewer) {
                $this->login($viewer)->getJson($this->base($campaign))->assertNotFound();
                $this->get($this->base($campaign).'/'.$doc->id.'/file')->assertNotFound();
            }
        }
    }

    public function test_public_and_authorized_historical_states_keep_access(): void
    {
        foreach (['published', 'partially_funded', 'funded', 'completed', 'failed'] as $status) {
            $campaign = $this->campaign($this->user(), $status);
            $campaign->update(['published_at' => now()->subDay()]);
            $doc = $this->document($campaign, ['is_public' => true]);
            $this->login(null)->getJson($this->base($campaign))->assertOk()->assertJsonPath('data.0.id', $doc->id);
            $this->get($this->base($campaign).'/'.$doc->id.'/file')->assertOk();
        }
    }

    public function test_private_pending_rejected_foreign_missing_and_deleted_documents_cannot_be_downloaded(): void
    {
        $campaign = $this->campaign($this->user());
        $foreign = $this->campaign($this->user());
        $foreignDoc = $this->document($foreign, ['is_public' => true]);
        $this->get($this->base($campaign).'/'.$foreignDoc->id.'/file')->assertNotFound();
        foreach ([['is_public' => false], ['is_public' => true, 'status' => 'pending'], ['is_public' => true, 'status' => 'rejected']] as $attrs) {
            $doc = $this->document($campaign, $attrs);
            $this->get($this->base($campaign).'/'.$doc->id.'/file')->assertNotFound();
        }
        $missing = $this->document($campaign, ['is_public' => true]);
        Storage::disk('local')->delete($missing->documentPath());
        $this->get($this->base($campaign).'/'.$missing->id.'/file')->assertNotFound();
        $deleted = $this->document($campaign, ['is_public' => true]);
        $deleted->delete();
        $this->get($this->base($campaign).'/'.$deleted->id.'/file')->assertNotFound();
        $this->getJson($this->base($campaign))->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_administrator_can_approve_privately_publish_withdraw_and_reject_without_automatic_republication(): void
    {
        $campaign = $this->campaign($this->user());
        $doc = $this->document($campaign, ['status' => 'pending']);
        $admin = $this->user('admin');
        $this->login($admin)->patchJson($this->review($campaign, $doc), ['status' => 'approved', 'reviewerNotes' => 'PRIVATE AUDIT'])->assertOk()->assertJsonPath('data.is_public', false);
        $this->getJson($this->base($campaign))->assertJsonCount(0, 'data');
        $this->patchJson($this->review($campaign, $doc), ['status' => 'approved', 'isPublic' => true])->assertOk()->assertJsonPath('data.is_public', true);
        $this->assertDatabaseHas('campaign_documents', ['id' => $doc->id, 'reviewed_by' => $admin->id, 'reviewer_notes' => 'PRIVATE AUDIT']);
        $link = $this->getJson($this->base($campaign))->assertJsonCount(1, 'data')->json('data.0.fileUrl');
        $this->get($link)->assertOk();
        $this->patchJson($this->review($campaign, $doc), ['status' => 'approved', 'isPublic' => false])->assertOk();
        $this->get($link)->assertNotFound();
        $this->patchJson($this->review($campaign, $doc), ['status' => 'approved', 'isPublic' => true])->assertOk();
        $this->patchJson($this->review($campaign, $doc), ['status' => 'rejected'])->assertOk()->assertJsonPath('data.is_public', false);
        $this->get($link)->assertNotFound();
        $this->patchJson($this->review($campaign, $doc), ['status' => 'approved'])->assertOk()->assertJsonPath('data.is_public', false);
        $this->get($link)->assertNotFound();
        $this->patchJson($this->review($campaign, $doc), ['status' => 'approved', 'isPublic' => true])->assertOk();
        $campaign->update(['status' => 'suspended']);
        $this->getJson($this->base($campaign))->assertNotFound();
        $this->get($link)->assertNotFound();
    }

    public function test_guests_owners_and_investors_cannot_publish_and_uploads_ignore_visibility_fields(): void
    {
        $owner = $this->user();
        $campaign = $this->campaign($owner);
        $doc = $this->document($campaign);
        foreach ([null, $owner, $this->user('investor')] as $user) {
            $this->login($user)->patchJson($this->review($campaign, $doc), ['status' => 'approved', 'isPublic' => true])->assertStatus($user ? 403 : 401);
            $this->assertFalse($doc->fresh()->is_public);
        }
        $this->login($owner)->post('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/documents', ['file' => UploadedFile::fake()->create('Evidence.pdf', 1, 'application/pdf'), 'isPublic' => true, 'is_public' => true, 'status' => 'approved'])->assertCreated()->assertJsonPath('data.is_public', false)->assertJsonPath('data.status', 'pending');
    }

    public function test_only_available_campaign_document_files_can_be_published_and_metadata_never_mints_private_credentials(): void
    {
        $campaign = $this->campaign($this->user());
        Storage::disk('local')->put('kyc/private.pdf', 'PRIVATE IDENTITY');
        $this->login($this->user('super_admin'));
        foreach (['/api/v1/private-files/kyc/private.pdf', '/api/v1/private-files/documents/../kyc/private.pdf', '/api/v1/private-files/documents/%2e%2e%2fkyc.pdf', '/api/v1/private-files/documents/id.pdf?signature=old', '/storage/documents/public.pdf', 'https://example.com/evidence.pdf'] as $path) {
            $doc = $this->document($campaign, ['file_url' => $path]);
            $this->patchJson($this->review($campaign, $doc), ['status' => 'approved', 'isPublic' => true])->assertUnprocessable()->assertJsonValidationErrors('isPublic');
            $doc->update(['is_public' => true]); // Malformed historical rows are still blocked.
            $this->get($this->base($campaign).'/'.$doc->id.'/file')->assertNotFound();
        }
        $missing = $this->document($campaign);
        Storage::disk('local')->delete($missing->documentPath());
        $this->patchJson($this->review($campaign, $missing), ['status' => 'approved', 'isPublic' => true])->assertUnprocessable();
        $safe = $this->document($campaign, ['is_public' => true, 'justification' => '/api/v1/private-files/documents/secret.pdf']);
        $this->login(null)->getJson($this->base($campaign))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $safe->id)->assertJsonPath('data.0.justification', '/api/v1/private-files/documents/secret.pdf')->assertDontSee('signature=')->assertDontSee('PRIVATE IDENTITY');
    }

    public function test_invalid_publication_and_cross_campaign_review_leave_the_document_unchanged(): void
    {
        $campaign = $this->campaign($this->user());
        $doc = $this->document($campaign);
        $before = $doc->getAttributes();
        $this->login($this->user('admin'));
        $this->patchJson($this->review($campaign, $doc), ['status' => 'rejected', 'isPublic' => true])->assertUnprocessable();
        $foreign = $this->campaign($this->user());
        $this->patchJson($this->review($foreign, $doc), ['status' => 'approved', 'isPublic' => true])->assertNotFound();
        $this->assertSame($before, $doc->fresh()->getAttributes());
    }
}
