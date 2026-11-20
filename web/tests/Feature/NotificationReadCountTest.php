<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationReadCountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        $this->travelTo(now()->startOfSecond());
    }

    private function user(): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test']);
        $user->assignRole('investor');

        return $user;
    }

    private function login(?User $user): static
    {
        Auth::forgetGuards();

        return $this->withHeader('Authorization', $user ? 'Bearer '.$user->createToken('test')->plainTextToken : '');
    }

    private function notification(User $user, string $type = 'new_comment', bool $read = false): Notification
    {
        return Notification::create(['user_id' => $user->id, 'type_code' => $type, 'title' => 'Notice', 'body' => 'Body', 'is_read' => $read, 'read_at' => $read ? now()->subDay() : null])->fresh();
    }

    public function test_filtered_mark_all_reports_global_remaining_count_and_preserves_other_notifications(): void
    {
        $user = $this->user();
        $other = $this->user();
        $comments = [$this->notification($user), $this->notification($user)];
        $investment = $this->notification($user, 'investment_confirmed');
        $alreadyRead = $this->notification($user, read: true);
        $foreign = $this->notification($other);
        $unchanged = [$investment->getAttributes(), $alreadyRead->getAttributes(), $foreign->getAttributes()];
        $this->login($user)->patchJson('/api/v1/notifications/read-all?typeCode=new_comment')->assertOk()->assertJsonPath('data.updatedCount', 2)->assertJsonPath('data.unreadCount', 1);
        foreach ($comments as $comment) {
            $this->assertTrue($comment->fresh()->is_read);
            $this->assertTrue($comment->fresh()->read_at->equalTo(now()));
        }
        $this->assertSame($unchanged, [$investment->fresh()->getAttributes(), $alreadyRead->fresh()->getAttributes(), $foreign->fresh()->getAttributes()]);
        $this->getJson('/api/v1/notifications/unread-count')->assertOk()->assertJsonPath('data.unreadCount', 1);
        $this->getJson('/api/v1/notifications/me?typeCode=new_comment')->assertOk()->assertJsonPath('data.unreadCount', 1);
        $this->assertDatabaseCount('notifications', 5);
    }

    public function test_both_supported_filter_names_work_in_query_and_request_body(): void
    {
        foreach (['type', 'typeCode'] as $name) {
            foreach (['query', 'body'] as $location) {
                $user = $this->user();
                $matching = $this->notification($user);
                $unmatched = $this->notification($user, 'investment_confirmed');
                $url = '/api/v1/notifications/read-all'.($location === 'query' ? '?'.$name.'=new_comment' : '');
                $this->login($user)->patchJson($url, $location === 'body' ? [$name => 'new_comment'] : [])->assertOk()->assertJsonPath('data.updatedCount', 1)->assertJsonPath('data.unreadCount', 1);
                $this->assertTrue($matching->fresh()->is_read);
                $this->assertFalse($unmatched->fresh()->is_read);
            }
        }
    }

    public function test_unknown_filter_and_repeated_operation_preserve_remaining_count_and_read_dates(): void
    {
        $user = $this->user();
        $comment = $this->notification($user);
        $this->notification($user, 'investment_confirmed');
        $this->login($user)->patchJson('/api/v1/notifications/read-all', ['typeCode' => 'not-a-type'])->assertOk()->assertJsonPath('data.updatedCount', 0)->assertJsonPath('data.unreadCount', 2);
        $this->patchJson('/api/v1/notifications/read-all', ['typeCode' => 'new_comment'])->assertOk()->assertJsonPath('data.updatedCount', 1)->assertJsonPath('data.unreadCount', 1);
        $before = $comment->fresh()->getAttributes();
        $this->travel(1)->hours();
        $this->patchJson('/api/v1/notifications/read-all', ['typeCode' => 'new_comment'])->assertOk()->assertJsonPath('data.updatedCount', 0)->assertJsonPath('data.unreadCount', 1);
        $this->assertSame($before, $comment->fresh()->getAttributes());
    }

    public function test_unfiltered_operation_marks_all_own_unread_notifications_and_returns_zero(): void
    {
        $user = $this->user();
        $other = $this->user();
        $this->notification($user);
        $this->notification($user, 'investment_confirmed');
        $old = $this->notification($user, read: true);
        $foreign = $this->notification($other);
        $this->login($user)->patchJson('/api/v1/notifications/read-all')->assertOk()->assertJsonPath('data.updatedCount', 2)->assertJsonPath('data.unreadCount', 0);
        $this->assertFalse($foreign->fresh()->is_read);
        $this->assertTrue($old->read_at->equalTo($old->fresh()->read_at));
        $this->patchJson('/api/v1/notifications/read-all')->assertOk()->assertJsonPath('data.updatedCount', 0)->assertJsonPath('data.unreadCount', 0);
        $this->getJson('/api/v1/notifications/me')->assertJsonPath('data.unreadCount', 0);
    }

    public function test_empty_history_and_authenticated_user_isolation(): void
    {
        $user = $this->user();
        $foreign = $this->notification($this->user());
        $this->login($user)->patchJson('/api/v1/notifications/read-all', ['userId' => $foreign->user_id])->assertOk()->assertJsonPath('data.updatedCount', 0)->assertJsonPath('data.unreadCount', 0);
        $this->assertFalse($foreign->fresh()->is_read);
        $this->login(null)->patchJson('/api/v1/notifications/read-all')->assertUnauthorized();
        $this->assertFalse($foreign->fresh()->is_read);
    }
}
