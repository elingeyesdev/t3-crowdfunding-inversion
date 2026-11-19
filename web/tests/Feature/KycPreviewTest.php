<?php

namespace Tests\Feature;

use App\Models\EntrepreneurProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class KycPreviewTest extends TestCase
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

    private function profile(User $user, string $status = 'pending'): EntrepreneurProfile
    {
        return EntrepreneurProfile::create(['user_id' => $user->id, 'first_name' => 'KYC', 'last_name' => 'Owner', 'kyc_status' => $status, 'verification_documents' => [['type' => 'idDocument', 'url' => '/api/v1/private-files/kyc/id.pdf']]])->fresh();
    }

    private function login(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test', ['*'], now()->addDay())->plainTextToken : '');
    }

    public function test_authorized_refresh_renews_expired_links_without_changing_the_profile_or_making_files_public(): void
    {
        $profile = $this->profile($this->user());
        $before = $profile->getAttributes();
        Storage::disk('local')->put('kyc/id.pdf', "%PDF-1.4\nPrivate identity fixture");
        $this->login($this->user('admin'));
        $route = '/api/v1/admin/kyc/'.$profile->id;
        $old = $this->getJson($route)->assertOk()->json('data.verification_documents.0.url');
        $this->assertStringContainsString('expires=', $old);
        $this->assertStringContainsString('signature=', $old);
        $this->head($old)->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->travel(16)->minutes();
        $this->head($old)->assertForbidden();
        $fresh = $this->getJson($route)->assertOk()->json('data.verification_documents.0.url');
        $this->assertNotSame($old, $fresh);
        $this->head($fresh)->assertOk();
        $this->get('/api/v1/private-files/kyc/id.pdf')->assertForbidden();
        $this->assertSame($before, $profile->fresh()->getAttributes());
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_only_active_administrators_can_refresh_pending_kyc_links(): void
    {
        $owner = $this->user();
        $profile = $this->profile($owner);
        $route = '/api/v1/admin/kyc/'.$profile->id;
        $this->login(null)->getJson($route)->assertUnauthorized();
        foreach ([$owner, $this->user('investor'), $this->user()] as $user) {
            $this->login($user)->getJson($route)->assertForbidden();
        }
        $inactive = $this->user('admin');
        $inactive->update(['is_active' => false]);
        $this->login($inactive)->getJson($route)->assertUnauthorized();
        $this->login($this->user('super_admin'))->getJson($route)->assertOk();
        $this->getJson('/api/v1/admin/kyc/pending')->assertOk();
        foreach (['approved', 'rejected'] as $status) {
            $profile->update(['kyc_status' => $status]);
            $this->getJson($route)->assertNotFound();
        }
    }

    public function test_supported_uploads_preserve_actual_mime_and_original_names_for_the_viewer(): void
    {
        foreach (['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp', 'mp4' => 'video/mp4', 'webm' => 'video/webm', 'mov' => 'video/quicktime'] as $ext => $mime) {
            $owner = $this->user();
            $this->profile($owner, 'unverified');
            $face = UploadedFile::fake()->create('face.'.$ext, 1, $mime);
            $response = $this->login($owner)->post('/api/v1/entrepreneurs/me/kyc', ['idDocument' => UploadedFile::fake()->create('identity.pdf', 1, 'application/pdf'), 'faceVideo' => $face])->assertOk();
            $response->assertJsonPath('data.verificationDocuments.0.mimeType', 'application/pdf')->assertJsonPath('data.verificationDocuments.0.originalName', 'identity.pdf');
            $response->assertJsonPath('data.verificationDocuments.1.mimeType', $mime)->assertJsonPath('data.verificationDocuments.1.originalName', 'face.'.$ext);
            $stored = $owner->entrepreneur->fresh()->verification_documents;
            $this->assertStringStartsWith('/api/v1/private-files/kyc/', $stored[1]['url']);
            $this->assertStringNotContainsString('signature=', $stored[1]['url']);
        }
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_unsupported_formats_and_oversized_files_are_rejected_before_storage(): void
    {
        foreach ([['identity.gif', 'image/gif', 1, 'idDocument'], ['identity.avif', 'image/avif', 1, 'idDocument'], ['face.ogg', 'video/ogg', 1, 'faceVideo'], ['identity.pdf', 'application/pdf', 10241, 'idDocument'], ['face.mp4', 'video/mp4', 51201, 'faceVideo']] as [$name, $mime, $size, $field]) {
            $owner = $this->user();
            $profile = $this->profile($owner, 'unverified');
            $before = $profile->getAttributes();
            $files = ['idDocument' => UploadedFile::fake()->create('id.pdf', 1, 'application/pdf'), 'faceVideo' => UploadedFile::fake()->create('face.jpg', 1, 'image/jpeg')];
            $files[$field] = UploadedFile::fake()->create($name, $size, $mime);
            $this->login($owner)->postJson('/api/v1/entrepreneurs/me/kyc', $files)->assertUnprocessable()->assertJsonValidationErrors($field);
            $this->assertSame($before, $profile->fresh()->getAttributes());
            $this->assertSame([], Storage::disk('local')->allFiles());
        }
    }
}
