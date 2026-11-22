<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignDocument;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\InvestorProfile;
use App\Models\User;
use App\Services\PrivateFileLinks;
use App\Support\Api;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class PrivateDocumentLinksTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        Storage::fake('local');
    }

    private function user(string $role = 'entrepreneur'): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test'])->fresh();
        $user->assignRole($role);
        InvestorProfile::create(['user_id' => $user->id]);

        return $user;
    }

    private function login(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function campaign(User $owner): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id,
            'title' => 'Private documents fixture', 'slug' => (string) Str::uuid(),
            'goal_amount' => 1000, 'status' => 'published']);
    }

    private function document(Campaign $campaign, array $attributes = []): CampaignDocument
    {
        $path = 'documents/'.Str::uuid().'.pdf';
        Storage::disk('local')->put($path, '%PDF-1.4 synthetic private fixture');

        return $campaign->documents()->create(['file_url' => '/api/v1/private-files/'.$path,
            'original_name' => 'Evidence.pdf', 'mime_type' => 'application/pdf',
            'file_size_bytes' => 38, ...$attributes])->fresh();
    }

    public function test_profile_text_never_mints_document_credentials_even_for_owners_and_admins(): void
    {
        $owner = $this->user();
        $document = $this->document($this->campaign($owner));
        foreach ([$this->user('investor'), $owner, $this->user('admin'), $this->user('super_admin')] as $user) {
            foreach ([$document->file_url, '/api/v1/private-files/documents/unregistered.pdf',
                '/api/v1/private-files/documents/../kyc/id.pdf',
                '/api/v1/private-files/documents%2Fsecret.pdf'] as $text) {
                $this->login($user)->putJson('/api/v1/investors/me/profile', ['bio' => $text])
                    ->assertOk()->assertJsonPath('data.bio', $text)->assertDontSee('signature=');
            }
        }
        $this->login(null)->get($document->file_url)->assertForbidden();
    }

    public function test_generic_responses_never_sign_strings_or_file_shaped_arrays(): void
    {
        $document = $this->document($this->campaign($this->user()));
        $this->actingAs($this->user('admin'), 'sanctum');
        $data = ['bio' => $document->file_url, 'file_url' => $document->file_url,
            'nested' => ['url' => $document->file_url],
            'verification_documents' => [['url' => '/api/v1/private-files/kyc/id.pdf']]];
        $this->assertSame($data, Api::ok($data, camel: false)->getData(true)['data']);
    }

    public function test_owner_and_administrators_get_only_the_document_file_field_signed(): void
    {
        $owner = $this->user();
        $campaign = $this->campaign($owner);
        $other = $this->document($this->campaign($this->user()));
        $document = $this->document($campaign, ['original_name' => $other->file_url, 'justification' => $other->file_url]);
        $stored = $document->getAttributes();
        foreach ([$owner, $this->user('admin'), $this->user('super_admin')] as $user) {
            $route = $user->id === $owner->id ? '/api/v1/entrepreneurs/me/campaigns/' : '/api/v1/admin/campaigns/';
            $response = $this->login($user)->getJson($route.$campaign->id.'/documents')->assertOk();
            $row = collect($response->json('data'))->firstWhere('id', $document->id);
            $this->assertStringContainsString('signature=', $row['file_url']);
            $this->assertSame($other->file_url, $row['original_name']);
            $this->assertSame($other->file_url, $row['justification']);
            $this->login(null)->get($row['file_url'])->assertOk();
            $this->get($row['file_url'].'x')->assertForbidden();
            $this->travel(16)->minutes();
            $this->get($row['file_url'])->assertForbidden();
            $this->travelBack();
        }
        $this->assertSame($stored, $document->fresh()->getAttributes());
        $this->login($this->user())->getJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/documents')->assertForbidden();
        $this->login(null)->getJson('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/documents')->assertUnauthorized();
    }

    public function test_upload_and_admin_review_preserve_the_authorized_download_contract(): void
    {
        $owner = $this->user();
        $campaign = $this->campaign($owner);
        $response = $this->login($owner)->post('/api/v1/entrepreneurs/me/campaigns/'.$campaign->id.'/documents', [
            'file' => UploadedFile::fake()->create('evidence.pdf', 1, 'application/pdf'),
            'justification' => '/api/v1/private-files/documents/foreign.pdf',
        ], ['Accept' => 'application/json'])->assertCreated();
        $this->assertStringContainsString('signature=', $response->json('data.file_url'));
        $response->assertJsonPath('data.justification', '/api/v1/private-files/documents/foreign.pdf');
        $id = $response->json('data.id');
        $review = $this->login($this->user('admin'))->patchJson('/api/v1/admin/campaigns/'.$campaign->id.'/documents/'.$id.'/review', [
            'status' => 'approved', 'reviewerNotes' => '/api/v1/private-files/documents/foreign.pdf',
        ])->assertOk();
        $this->assertStringContainsString('signature=', $review->json('data.file_url'));
        $review->assertJsonPath('data.reviewer_notes', '/api/v1/private-files/documents/foreign.pdf');
        $this->login(null)->get($review->json('data.file_url'))->assertOk();
    }

    public function test_kyc_signing_is_limited_to_document_urls_and_not_profile_text(): void
    {
        $owner = $this->user();
        $path = '/api/v1/private-files/kyc/id.pdf';
        Storage::disk('local')->put('kyc/id.pdf', '%PDF-1.4 synthetic identity');
        $profile = EntrepreneurProfile::create(['user_id' => $owner->id, 'bio' => $path, 'kyc_status' => 'pending',
            'verification_documents' => [['url' => '/uploads/kyc/id.pdf', 'originalName' => $path, 'metadata' => ['url' => $path]]]]);
        foreach ([$owner, $this->user('admin')] as $user) {
            $route = $user->id === $owner->id ? '/api/v1/entrepreneurs/me/profile' : '/api/v1/admin/kyc/'.$profile->id;
            $response = $this->login($user)->getJson($route)->assertOk()->assertJsonPath('data.bio', $path);
            $key = $user->id === $owner->id ? 'verificationDocuments' : 'verification_documents';
            $doc = $response->json('data.'.$key.'.0');
            $this->assertStringContainsString('signature=', $doc['url']);
            $this->assertSame($path, $doc['originalName']);
            $this->assertSame($path, $doc['metadata']['url']);
        }
    }

    public function test_signing_service_rejects_guests_unrelated_and_inactive_users(): void
    {
        $owner = $this->user();
        $document = $this->document($this->campaign($owner));
        $profile = EntrepreneurProfile::create(['user_id' => $owner->id]);
        $inactiveAdmin = $this->user('admin');
        $inactiveAdmin->update(['is_active' => false]);
        $owner->update(['is_active' => false]);
        foreach ([null, $this->user('investor'), $owner, $inactiveAdmin] as $user) {
            Auth::forgetGuards();
            if ($user) {
                $this->actingAs($user, 'sanctum');
            }
            foreach ([fn () => PrivateFileLinks::documentData($document), fn () => PrivateFileLinks::profileData($profile)] as $serialize) {
                try {
                    $serialize();
                    $this->fail('Private resource serialization must require an active owner or administrator.');
                } catch (HttpException $e) {
                    $this->assertSame(403, $e->getStatusCode());
                }
            }
        }
    }

    public function test_campaign_file_fields_cannot_sign_kyc_traversal_or_unregistered_paths(): void
    {
        $owner = $this->user();
        $campaign = $this->campaign($owner);
        Storage::disk('local')->put('kyc/id.pdf', 'synthetic identity');
        $this->actingAs($owner, 'sanctum');
        foreach (['/api/v1/private-files/kyc/id.pdf', '/api/v1/private-files/documents/../kyc/id.pdf',
            '/api/v1/private-files/documents/%2e%2e%2fkyc.pdf',
            '/api/v1/private-files/documents/missing.pdf', 'https://example.test/private.pdf'] as $path) {
            $document = $this->document($campaign, ['file_url' => $path]);
            $this->assertSame($path, PrivateFileLinks::documentData($document)['file_url']);
        }
        $orphan = new CampaignDocument(['campaign_id' => (string) Str::uuid(), 'file_url' => '/api/v1/private-files/documents/missing.pdf']);
        $this->expectException(HttpException::class);
        PrivateFileLinks::documentData($orphan);
    }
}
