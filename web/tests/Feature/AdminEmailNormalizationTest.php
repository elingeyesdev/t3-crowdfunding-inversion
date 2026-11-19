<?php

namespace Tests\Feature;

use App\Models\AdminProfile;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminEmailNormalizationTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/v1/superadmin/admins';

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
    }

    private function user(string $role = 'super_admin'): User
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

    private function counts(): array
    {
        return [User::count(), AdminProfile::count(), Role::count(), DB::table('user_roles')->count()];
    }

    public function test_duplicate_case_variants_return_an_email_validation_error_without_partial_records(): void
    {
        $existing = User::create(['email' => 'duplicate@example.test', 'password_hash' => Hash::make('Original123')]);
        $before = $existing->fresh()->getAttributes();
        $this->login($this->user());
        $counts = $this->counts();
        foreach (['duplicate@example.test', 'DUPLICATE@EXAMPLE.TEST', 'DuPlIcAtE@Example.Test', '  DUPLICATE@example.test  '] as $email) {
            $this->postJson(self::PATH, ['email' => $email, 'password' => 'Password123'])->assertUnprocessable()->assertJsonValidationErrors('email')->assertJsonPath('errors.email.0', 'Ya existe una cuenta con este correo electrónico.');
            $this->assertSame($counts, $this->counts());
            $this->assertSame($before, $existing->fresh()->getAttributes());
        }
    }

    public function test_new_admins_are_created_with_the_normalized_validated_email_and_can_log_in(): void
    {
        $super = $this->user();
        foreach (['admin', 'super_admin'] as $level) {
            $email = $level.'-new@example.test';
            $this->login($super);
            $before = $this->counts();
            $response = $this->postJson(self::PATH, ['email' => '  '.strtoupper($email).'  ', 'password' => 'Password123', 'firstName' => 'New', 'lastName' => 'Administrator', 'accessLevel' => $level])->assertCreated()->assertJsonPath('data.access_level', $level);
            $created = User::findOrFail($response->json('data.user_id'));
            $this->assertSame($email, $created->email);
            $this->assertTrue(Hash::check('Password123', $created->password_hash));
            $this->assertSame([$level], $created->roles()->pluck('name')->all());
            $this->assertSame([$before[0] + 1, $before[1] + 1, $before[2], $before[3] + 1], $this->counts());
            $response->assertDontSee('Password123')->assertDontSee('password_hash');
            $this->login(null)->postJson('/api/v1/auth/login', ['email' => strtoupper($email), 'password' => 'Password123'])->assertOk();
        }
    }

    public function test_invalid_email_values_are_validation_errors_without_creating_records(): void
    {
        $this->login($this->user());
        $before = $this->counts();
        foreach ([null, '', [], 123, 'not-an-email', str_repeat('a', 246).'@example.test'] as $email) {
            $this->postJson(self::PATH, ['email' => $email, 'password' => 'Password123'])->assertUnprocessable()->assertJsonValidationErrors('email');
            $this->assertSame($before, $this->counts());
        }
    }

    public function test_profile_failure_rolls_back_the_new_user_role_and_role_assignment(): void
    {
        $this->login($this->user());
        Role::where('name', 'admin')->delete();
        $before = $this->counts();
        DB::unprepared("CREATE TRIGGER fail_admin_profile BEFORE INSERT ON admin_profiles BEGIN SELECT RAISE(ABORT, 'Simulated profile failure'); END");
        $this->postJson(self::PATH, ['email' => 'NEWADMIN@example.test', 'password' => 'Password123'])->assertStatus(500);
        $this->assertSame($before, $this->counts());
        $this->assertDatabaseMissing('users', ['email' => 'newadmin@example.test']);
        $this->assertDatabaseMissing('roles', ['name' => 'admin']);
    }

    public function test_only_an_active_super_administrator_can_create_accounts(): void
    {
        $this->login(null)->postJson(self::PATH, ['email' => 'new@example.test', 'password' => 'Password123'])->assertUnauthorized();
        foreach (['investor', 'entrepreneur', 'admin'] as $role) {
            $this->login($this->user($role));
            $before = $this->counts();
            $this->postJson(self::PATH, ['email' => 'new@example.test', 'password' => 'Password123'])->assertForbidden();
            $this->assertSame($before, $this->counts());
        }
        $inactive = $this->user();
        $inactive->update(['is_active' => false]);
        $this->login($inactive)->postJson(self::PATH, ['email' => 'new@example.test', 'password' => 'Password123'])->assertUnauthorized();
    }
}
