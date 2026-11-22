<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationDeletionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
    }

    private function user(): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test'])->fresh();
        $user->assignRole('investor');

        return $user;
    }

    private function login(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function notice(User $user, bool $read, string $type = 'new_comment'): Notification
    {
        return Notification::create(['user_id' => $user->id, 'type_code' => $type, 'title' => 'Notice',
            'body' => 'Fixture', 'is_read' => $read, 'read_at' => $read ? now()->subDay() : null])->fresh();
    }

    public function test_clear_read_reports_real_deletions_and_preserves_pending_and_foreign_rows_on_retries(): void
    {
        $user = $this->user();
        $this->notice($user, true);
        $this->notice($user, true, 'investment_confirmed');
        $pending = $this->notice($user, false);
        $foreign = $this->notice($this->user(), true);
        $before = [$pending->getAttributes(), $foreign->getAttributes()];
        $this->login($user)->deleteJson('/api/v1/notifications/clear-read', ['userId' => $foreign->user_id])
            ->assertOk()->assertJsonPath('data.deletedCount', 2);
        $this->deleteJson('/api/v1/notifications/clear-read')->assertOk()->assertJsonPath('data.deletedCount', 0);
        $this->getJson('/api/v1/notifications/me')->assertOk()->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.unreadCount', 1)->assertJsonPath('data.notifications.0.id', $pending->id);
        $this->getJson('/api/v1/notifications/me?category=investment&unread=false')->assertOk()
            ->assertJsonPath('data.total', 0)->assertJsonPath('data.totalPages', 1)->assertJsonCount(0, 'data.notifications');
        $this->assertSame($before, [$pending->fresh()->getAttributes(), $foreign->fresh()->getAttributes()]);
    }

    public function test_single_deletion_exposes_updated_page_totals_and_enforces_ownership_and_authentication(): void
    {
        $user = $this->user();
        foreach (range(1, 13) as $index) {
            $this->notice($user, false);
        }
        $id = $this->login($user)->getJson('/api/v1/notifications/me?limit=12&page=2')->assertOk()->json('data.notifications.0.id');
        $this->deleteJson('/api/v1/notifications/'.$id)->assertOk();
        $this->getJson('/api/v1/notifications/me?limit=12&page=2')->assertOk()->assertJsonPath('data.total', 12)
            ->assertJsonPath('data.totalPages', 1)->assertJsonPath('data.unreadCount', 12)->assertJsonCount(0, 'data.notifications');
        $this->getJson('/api/v1/notifications/me?limit=12&page=1')->assertOk()->assertJsonCount(12, 'data.notifications');
        $this->deleteJson('/api/v1/notifications/'.$id)->assertNotFound();
        $foreign = $this->notice($this->user(), false);
        $this->deleteJson('/api/v1/notifications/'.$foreign->id)->assertNotFound();
        $this->login(null)->deleteJson('/api/v1/notifications/'.$foreign->id)->assertUnauthorized();
        $this->deleteJson('/api/v1/notifications/clear-read')->assertUnauthorized();
        $this->assertDatabaseHas('notifications', ['id' => $foreign->id, 'is_read' => false]);
        $this->assertDatabaseCount('notifications', 13);
    }
}
