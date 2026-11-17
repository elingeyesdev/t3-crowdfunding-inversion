<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class PasswordChangeTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/v1/users/me/password';

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
    }

    private function account(array $attrs = [], string $role = 'investor'): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test', 'password_hash' => Hash::make('Original123'), 'remember_token' => 'original-remember-token', ...$attrs]);
        $user->assignRole($role);

        return $user;
    }

    private function token(?string $plain): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $plain ? 'Bearer '.$plain : '');
    }

    private function browserSession(User $user): string
    {
        $id = (string) Str::uuid();
        DB::table('sessions')->insert(['id' => $id, 'user_id' => $user->id, 'payload' => '', 'last_activity' => time()]);

        return $id;
    }

    public function test_change_keeps_current_token_revokes_other_sessions_and_updates_login_credentials(): void
    {
        $user = $this->account();
        $current = $user->createToken('current', ['*'], now()->addHour());
        $other = $user->createToken('other');
        $foreign = $this->account();
        $foreignToken = $foreign->createToken('foreign');
        $ownSession = $this->browserSession($user);
        $foreignSession = $this->browserSession($foreign);
        $expiration = $current->accessToken->expires_at;

        $response = $this->token($current->plainTextToken)->patchJson(self::PATH, ['currentPassword' => 'Original123', 'newPassword' => 'Changed456', 'userId' => $foreign->id])->assertOk()->assertJsonPath('data.otherSessionsRevoked', true);
        $response->assertDontSee('Changed456')->assertDontSee('password_hash')->assertDontSee('passwordHash');
        $this->assertTrue(Hash::check('Changed456', $user->fresh()->password_hash));
        $this->assertFalse(Hash::check('Original123', $user->fresh()->password_hash));
        $this->assertNotSame('original-remember-token', $user->fresh()->remember_token);
        $this->assertTrue($expiration->equalTo($current->accessToken->fresh()->expires_at));
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $other->accessToken->id]);
        $this->assertDatabaseMissing('sessions', ['id' => $ownSession]);
        $this->assertDatabaseHas('sessions', ['id' => $foreignSession]);
        $this->assertTrue(Hash::check('Original123', $foreign->fresh()->password_hash));
        $this->token($current->plainTextToken)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.hasPassword', true)->assertJsonMissingPath('data.passwordHash');
        $this->token($other->plainTextToken)->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->token($foreignToken->plainTextToken)->getJson('/api/v1/auth/me')->assertOk();
        $this->token(null)->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Original123'])->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Changed456'])->assertOk()->assertJsonStructure(['data' => ['accessToken']]);
    }

    public function test_wrong_current_password_and_reuse_leave_password_and_sessions_unchanged(): void
    {
        foreach ([['Incorrect123', 'Changed456', 'currentPassword'], ['Original123', 'Original123', 'newPassword']] as [$old, $new, $field]) {
            $user = $this->account();
            $before = $user->fresh()->getAttributes();
            $current = $user->createToken('current');
            $user->createToken('other');
            $ids = $user->tokens()->pluck('id')->all();
            $session = $this->browserSession($user);
            $this->token($current->plainTextToken)->patchJson(self::PATH, ['currentPassword' => $old, 'newPassword' => $new])->assertUnprocessable()->assertJsonValidationErrors($field);
            $this->assertSame($before, $user->fresh()->getAttributes());
            $this->assertSame($ids, $user->tokens()->pluck('id')->all());
            $this->assertDatabaseHas('sessions', ['id' => $session]);
        }
    }

    public function test_password_policy_is_enforced_by_the_server(): void
    {
        foreach ([null, '', [], 'Short1', 'lowercase123', 'NoDigitsHere', str_repeat('A', 128).'1'] as $new) {
            $user = $this->account();
            $hash = $user->password_hash;
            $current = $user->createToken('current');
            $this->token($current->plainTextToken)->patchJson(self::PATH, ['currentPassword' => 'Original123', 'newPassword' => $new])->assertUnprocessable()->assertJsonValidationErrors('newPassword');
            $this->assertSame($hash, $user->fresh()->password_hash);
            $this->assertSame(1, $user->tokens()->count());
        }
    }

    public function test_legacy_bcrypt_variants_can_change_password_and_login_with_the_new_one(): void
    {
        foreach (['$2a$', '$2b$', '$2y$'] as $prefix) {
            $user = $this->account();
            $user->update(['password_hash' => $prefix.substr($user->password_hash, 4)]);
            $current = $user->createToken('legacy');
            $this->token($current->plainTextToken)->patchJson(self::PATH, ['currentPassword' => 'Original123', 'newPassword' => 'Changed456'])->assertOk();
            $this->token(null)->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Changed456'])->assertOk();
        }
    }

    public function test_policy_boundaries_are_accepted_and_current_password_is_required(): void
    {
        foreach (['Valid123', str_repeat('A', 127).'1'] as $password) {
            $user = $this->account(role: 'admin');
            $current = $user->createToken('current');
            $this->token($current->plainTextToken)->patchJson(self::PATH, ['newPassword' => $password])->assertUnprocessable()->assertJsonValidationErrors('currentPassword');
            $this->patchJson(self::PATH, ['currentPassword' => 'Original123', 'newPassword' => $password])->assertOk();
            $this->token(null)->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => $password])->assertOk();
        }
    }

    public function test_google_only_account_is_rejected_but_linked_password_account_can_change_password(): void
    {
        foreach ([false, true] as $hasPassword) {
            $user = $this->account(['oauth_provider' => 'google', 'oauth_provider_id' => (string) Str::uuid(), ...($hasPassword ? [] : ['password_hash' => null])]);
            $current = $user->createToken('google');
            $this->token($current->plainTextToken)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.hasPassword', $hasPassword);
            $result = $this->patchJson(self::PATH, ['currentPassword' => 'Original123', 'newPassword' => 'Changed456']);
            if ($hasPassword) {
                $result->assertOk();
            } else {
                $result->assertUnprocessable()->assertJsonValidationErrors('currentPassword')->assertSee('Google');
                $this->assertNull($user->fresh()->password_hash);
                $this->assertSame(1, $user->tokens()->count());
            }
        }
    }

    public function test_change_requires_authentication_and_an_active_unexpired_session(): void
    {
        $user = $this->account();
        $hash = $user->password_hash;
        $expired = $user->createToken('expired', ['*'], now()->subSecond());
        $valid = $user->createToken('valid');
        foreach ([null, 'invalid-token', $expired->plainTextToken] as $token) {
            $this->token($token)->patchJson(self::PATH, ['currentPassword' => 'Original123', 'newPassword' => 'Changed456'])->assertUnauthorized();
        }
        $user->update(['is_active' => false]);
        $this->token($valid->plainTextToken)->patchJson(self::PATH, ['currentPassword' => 'Original123', 'newPassword' => 'Changed456'])->assertUnauthorized();
        $this->assertSame($hash, $user->fresh()->password_hash);
        $this->assertSame(2, $user->tokens()->count());
    }

    public function test_revocation_failure_rolls_back_the_password_change(): void
    {
        $user = $this->account();
        $current = $user->createToken('current');
        $user->createToken('other');
        $before = $user->fresh()->getAttributes();
        $session = $this->browserSession($user);
        DB::unprepared("CREATE TRIGGER fail_token_delete BEFORE DELETE ON personal_access_tokens BEGIN SELECT RAISE(ABORT, 'Simulated deletion failure'); END");
        $this->token($current->plainTextToken)->patchJson(self::PATH, ['currentPassword' => 'Original123', 'newPassword' => 'Changed456'])->assertStatus(500);
        $this->assertSame($before, $user->fresh()->getAttributes());
        $this->assertSame(2, $user->tokens()->count());
        $this->assertDatabaseHas('sessions', ['id' => $session]);
    }

    public function test_repeated_guesses_are_rate_limited_without_changing_password_or_sessions(): void
    {
        $user = $this->account();
        $token = $user->createToken('current');
        $this->token($token->plainTextToken);
        for ($i = 0; $i < 5; $i++) {
            $this->patchJson(self::PATH, ['currentPassword' => 'Incorrect123', 'newPassword' => 'Changed456'])->assertUnprocessable();
        }
        $this->patchJson(self::PATH, ['currentPassword' => 'Original123', 'newPassword' => 'Changed456'])->assertStatus(429);
        $this->assertTrue(Hash::check('Original123', $user->fresh()->password_hash));
        $this->assertSame(1, $user->tokens()->count());
    }
}
