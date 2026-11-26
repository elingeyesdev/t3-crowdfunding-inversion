<?php

namespace Tests\Feature;

use App\Http\Controllers\AuthController;
use App\Models\AdminProfile;
use App\Models\Campaign;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\Investment;
use App\Models\InvestorProfile;
use App\Models\User;
use App\Models\UserStatusHistory;
use App\Services\UserStatusManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Tests\TestCase;

class UserStatusTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
    }

    private function account(string $role = 'investor', bool $active = true): User
    {
        $user = User::factory()->create(['is_active' => $active])->fresh();
        $user->assignRole($role);
        if (in_array($role, ['admin', 'super_admin'])) {
            AdminProfile::create(['user_id' => $user->id, 'access_level' => $role]);
        }

        return $user;
    }

    private function login(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function path(User $user): string
    {
        return '/api/v1/admin/users/'.$user->id.'/status';
    }

    private function payload(User $user, bool $active): array
    {
        return ['isActive' => $active, 'reason' => 'Motivo administrativo documentado', 'expectedVersion' => $user->fresh()->status_version];
    }

    public function test_suspend_and_reactivate_require_a_new_login_and_record_both_transitions(): void
    {
        $admin = $this->account('admin');
        $user = $this->account();
        $other = $this->account();
        $roles = $user->roles()->pluck('name')->all();
        $hash = $user->password_hash;
        $old = $user->createToken('old')->plainTextToken;
        $foreign = $other->createToken('foreign')->plainTextToken;
        foreach ([$user, $other] as $owner) {
            DB::table('sessions')->insert(['id' => $owner->id, 'user_id' => $owner->id, 'payload' => '', 'last_activity' => time()]);
        }
        $this->login($admin)->patchJson($this->path($user), $this->payload($user, false))->assertOk()->assertJsonPath('data.is_active', false)->assertJsonPath('data.status_version', 1);
        $this->assertSame(0, $user->tokens()->count());
        $this->assertDatabaseMissing('sessions', ['user_id' => $user->id]);
        $this->assertDatabaseHas('sessions', ['user_id' => $other->id]);
        Auth::forgetGuards();
        $this->withToken($old)->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123'])->assertUnauthorized();
        $legacy = $user->createToken('legacy-while-inactive')->plainTextToken;
        $this->login($admin)->patchJson($this->path($user), $this->payload($user, true))->assertOk()->assertJsonPath('data.is_active', true);
        foreach ([$old, $legacy] as $token) {
            Auth::forgetGuards();
            $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
        }
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123'])->assertOk()->json('data.accessToken');
        Auth::forgetGuards();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();
        $this->assertNotNull(PersonalAccessToken::findToken($foreign));
        $this->assertSame($hash, $user->fresh()->password_hash);
        $this->assertSame($roles, $user->fresh()->roles()->pluck('name')->all());
        $history = UserStatusHistory::where('user_id', $user->id)->orderBy('version')->get();
        $this->assertCount(2, $history);
        $this->assertSame([false, true], $history->pluck('to_active')->all());
        foreach ($history as $entry) {
            $this->assertSame($admin->id, $entry->actor_id);
            $this->assertNotNull($entry->created_at);
            $this->assertSame('Motivo administrativo documentado', $entry->reason);
        }
    }

    public function test_permissions_protect_administrative_accounts_self_and_inactive_actors(): void
    {
        foreach ([['admin', 'investor', true], ['admin', 'entrepreneur', true], ['admin', 'admin', false], ['admin', 'super_admin', false], ['super_admin', 'admin', true], ['super_admin', 'super_admin', false], ['investor', 'investor', false]] as [$role, $targetRole, $allowed]) {
            $actor = $this->account($role);
            $target = $this->account($targetRole);
            foreach ([false, true] as $active) {
                if (! $allowed) {
                    $target->update(['is_active' => ! $active]);
                }
                $response = $this->login($actor)->patchJson($this->path($target), $this->payload($target, $active));
                $allowed ? $response->assertOk() : $response->assertForbidden();
            }
            $this->assertSame($allowed ? 2 : 0, UserStatusHistory::where('user_id', $target->id)->count());
        }
        $admin = $this->account('admin');
        $this->login($admin)->patchJson($this->path($admin), $this->payload($admin, false))->assertForbidden();
        $target = $this->account();
        $admin->update(['is_active' => false]);
        $this->login($admin)->patchJson($this->path($target), $this->payload($target, false))->assertUnauthorized();
        $this->login(null)->patchJson($this->path($target), $this->payload($target, false))->assertUnauthorized();
        $legacy = $this->account('investor');
        AdminProfile::create(['user_id' => $legacy->id, 'access_level' => 'super_admin']);
        $this->login($this->account('super_admin'))->patchJson($this->path($legacy), $this->payload($legacy, false))->assertForbidden();
    }

    public function test_admin_profile_flags_and_server_action_flags_are_enforced(): void
    {
        $admin = $this->account('admin');
        $target = $this->account();
        foreach (['can_manage_users', 'is_active'] as $field) {
            $admin->admin()->update(['can_manage_users' => true, 'is_active' => true, $field => false]);
            $this->login($admin)->patchJson($this->path($target), $this->payload($target, false))->assertForbidden();
            $this->getJson('/api/v1/admin/users/'.$target->id.'/status-history')->assertForbidden();
        }
        $admin->admin()->update(['can_manage_users' => true, 'is_active' => true]);
        $rows = $this->login($admin)->getJson('/api/v1/admin/users')->assertOk()->json('data');
        $rows = collect($rows)->keyBy('id');
        $this->assertTrue($rows[$target->id]['can_suspend']);
        $this->assertFalse($rows[$admin->id]['can_suspend']);
        $this->assertFalse($rows[$admin->id]['can_reactivate']);
        $target->update(['is_active' => false]);
        $this->assertTrue(app(UserStatusManager::class)->canManage($admin->fresh(), $target->fresh()));
    }

    public function test_reason_and_version_validation_and_legacy_delete_use_the_same_policy(): void
    {
        $admin = $this->account('admin');
        $target = $this->account();
        $this->login($admin);
        foreach ([[], ['reason' => '  '], ['reason' => 'ab'], ['reason' => str_repeat('x', 2001)], ['reason' => []], ['expectedVersion' => -1], ['isActive' => 'invalid']] as $override) {
            $body = $override === [] ? [] : [...$this->payload($target, false), ...$override];
            $this->patchJson($this->path($target), $body)->assertUnprocessable();
        }
        $this->assertTrue($target->fresh()->is_active);
        $this->assertDatabaseCount('user_status_history', 0);
        $this->deleteJson('/api/v1/admin/users/'.$target->id)->assertUnprocessable();
        $this->deleteJson('/api/v1/admin/users/'.$target->id, ['reason' => '  Suspensión justificada  ', 'actor_id' => $target->id])->assertOk()->assertJsonPath('data.is_active', false);
        $entry = UserStatusHistory::sole();
        $this->assertSame('Suspensión justificada', $entry->reason);
        $this->assertSame($admin->id, $entry->actor_id);
    }

    public function test_repeated_requests_are_idempotent_and_old_versions_cannot_override_later_changes(): void
    {
        $admin = $this->account('admin');
        $target = $this->account();
        $suspend = $this->payload($target, false);
        $this->login($admin)->patchJson($this->path($target), $suspend)->assertOk();
        $this->patchJson($this->path($target), $suspend)->assertOk();
        $this->assertDatabaseCount('user_status_history', 1);
        $reactivate = $this->payload($target, true);
        $this->patchJson($this->path($target), $reactivate)->assertOk();
        $newToken = $target->createToken('new-login')->plainTextToken;
        $this->patchJson($this->path($target), $reactivate)->assertOk();
        $this->assertNotNull(PersonalAccessToken::findToken($newToken));
        $this->patchJson($this->path($target), $suspend)->assertConflict();
        $this->assertTrue($target->fresh()->is_active);
        $this->assertDatabaseCount('user_status_history', 2);
    }

    public function test_an_audit_write_failure_rolls_back_status_sessions_and_token_revocation(): void
    {
        $admin = $this->account('admin');
        $target = $this->account();
        $token = $target->createToken('kept')->plainTextToken;
        DB::table('sessions')->insert(['id' => 'kept-session', 'user_id' => $target->id, 'payload' => '', 'last_activity' => time()]);
        $before = $target->fresh()->getAttributes();
        Event::listen('eloquent.creating: '.UserStatusHistory::class, fn () => throw new RuntimeException('Audit unavailable'));
        $this->withoutExceptionHandling();
        try {
            $this->login($admin)->patchJson($this->path($target), $this->payload($target, false));
            $this->fail('Expected audit failure');
        } catch (RuntimeException $error) {
            $this->assertSame('Audit unavailable', $error->getMessage());
        } finally {
            Event::forget('eloquent.creating: '.UserStatusHistory::class);
        }
        $this->assertSame($before, $target->fresh()->getAttributes());
        $this->assertNotNull(PersonalAccessToken::findToken($token));
        $this->assertDatabaseHas('sessions', ['id' => 'kept-session']);
        $this->assertDatabaseCount('user_status_history', 0);
    }

    public function test_legacy_suspension_reactivation_preserves_profiles_campaigns_investments_roles_and_verification(): void
    {
        $admin = $this->account('admin');
        $target = $this->account('entrepreneur', false);
        $target->assignRole('investor');
        $target->update(['oauth_provider' => 'google', 'oauth_provider_id' => 'fixture', 'email_verified' => true]);
        $profile = EntrepreneurProfile::create(['user_id' => $target->id, 'kyc_status' => 'approved', 'identity_verified' => true]);
        $investor = InvestorProfile::create(['user_id' => $target->id, 'max_investment' => 1000, 'total_invested' => 10]);
        $campaign = Campaign::create(['creator_id' => $target->id, 'category_id' => Category::first()->id, 'title' => 'Kept campaign', 'slug' => (string) Str::uuid(), 'goal_amount' => 100, 'status' => 'suspended']);
        $investment = Investment::create(['campaign_id' => $campaign->id, 'investor_id' => $target->id, 'amount' => 10]);
        $records = [$profile, $investor, $campaign, $investment];
        $before = array_map(fn ($row) => $row->fresh()->getAttributes(), $records);
        $roles = $target->roles()->pluck('name')->all();
        $this->assertDatabaseCount('user_status_history', 0);
        $this->login($admin)->patchJson($this->path($target), $this->payload($target, true))->assertOk();
        foreach ($records as $i => $row) {
            $this->assertSame($before[$i], $row->fresh()->getAttributes());
        }
        $this->assertSame($roles, $target->fresh()->roles()->pluck('name')->all());
        $this->assertTrue($target->fresh()->email_verified);
        $this->assertSame('google', $target->fresh()->oauth_provider);
        $this->assertFalse(UserStatusHistory::sole()->from_active);
        $this->assertDatabaseCount('user_status_history', 1);
    }

    public function test_history_is_paginated_private_and_cannot_be_edited(): void
    {
        $admin = $this->account('admin');
        $target = $this->account();
        $this->login($admin);
        for ($i = 0; $i < 21; $i++) {
            $this->patchJson($this->path($target), $this->payload($target, $i % 2 !== 0))->assertOk();
        }
        $path = '/api/v1/admin/users/'.$target->id.'/status-history';
        $this->getJson($path)->assertOk()->assertJsonCount(20, 'data.entries')->assertJsonPath('data.totalPages', 2)->assertJsonPath('data.entries.0.version', 21)->assertJsonPath('data.entries.0.actorEmail', $admin->email);
        $this->getJson($path.'?page=2')->assertOk()->assertJsonCount(1, 'data.entries')->assertJsonPath('data.entries.0.version', 1);
        $this->login($this->account())->getJson($path)->assertForbidden();
        $this->login(null)->getJson($path)->assertUnauthorized();
        $entry = UserStatusHistory::first();
        try {
            $entry->update(['reason' => 'Tampered']);
            $this->fail('Expected immutable history');
        } catch (\LogicException $error) {
            $this->assertStringContainsString('no se puede modificar', $error->getMessage());
        }
    }

    public function test_revoked_actor_tokens_and_stale_login_snapshots_cannot_gain_access_after_reactivation(): void
    {
        $actor = $this->account('admin');
        $target = $this->account();
        $token = PersonalAccessToken::findToken($actor->createToken('actor')->plainTextToken);
        $request = Request::create($this->path($target), 'PATCH');
        $actor->withAccessToken($token);
        $request->setUserResolver(fn () => $actor);
        $actor->tokens()->delete();
        try {
            app(UserStatusManager::class)->change($request, $target, false, 'Stale request', 0);
            $this->fail('Expected revoked actor rejection');
        } catch (HttpExceptionInterface $error) {
            $this->assertSame(401, $error->getStatusCode());
        }
        $stale = $target->fresh();
        $admin = $this->account('admin');
        $this->login($admin)->patchJson($this->path($target), $this->payload($target, false))->assertOk();
        $this->patchJson($this->path($target), $this->payload($target, true))->assertOk();
        try {
            app(AuthController::class)->sessionData($stale);
            $this->fail('Expected stale login rejection');
        } catch (HttpExceptionInterface $error) {
            $this->assertSame(401, $error->getStatusCode());
        }
        $this->assertSame(0, $target->tokens()->count());
        $this->assertArrayHasKey('accessToken', app(AuthController::class)->sessionData($target->fresh()));
    }
}
