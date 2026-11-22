<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationReadFilterTest extends TestCase
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

    private function notification(User $user, bool $read, string $title = 'Notice', string $type = 'new_comment'): Notification
    {
        return Notification::create(['user_id' => $user->id, 'type_code' => $type, 'title' => $title,
            'body' => 'Notification fixture', 'is_read' => $read, 'read_at' => $read ? now()->subDay() : null])->fresh();
    }

    public function test_both_routes_distinguish_all_unread_and_read_without_exposing_other_users_or_mutating_rows(): void
    {
        $user = $this->user();
        $other = $this->user();
        $read = $this->notification($user, true);
        $unread = $this->notification($user, false);
        $this->notification($other, true);
        $this->notification($other, false);
        $before = Notification::orderBy('id')->get()->map->getAttributes()->all();
        foreach (['/api/v1/notifications', '/api/v1/notifications/me'] as $route) {
            foreach (['' => [$read->id, $unread->id], '?unread=true' => [$unread->id], '?unread=false' => [$read->id],
                '?unread=1' => [$unread->id], '?unread=0' => [$read->id]] as $query => $ids) {
                $response = $this->login($user)->getJson($route.$query)->assertOk()
                    ->assertJsonPath('data.total', count($ids))->assertJsonPath('data.unreadCount', 1);
                $this->assertEqualsCanonicalizing($ids, array_column($response->json('data.notifications'), 'id'));
            }
        }
        $this->assertSame($before, Notification::orderBy('id')->get()->map->getAttributes()->all());
    }

    public function test_unread_only_keeps_its_legacy_toggle_behavior_and_explicit_unread_takes_precedence(): void
    {
        $user = $this->user();
        $read = $this->notification($user, true);
        $unread = $this->notification($user, false);
        foreach (['unreadOnly=true' => [$unread->id], 'unreadOnly=false' => [$read->id, $unread->id],
            'unreadOnly=1' => [$unread->id], 'unreadOnly=0' => [$read->id, $unread->id],
            'unread=false&unreadOnly=true' => [$read->id], 'unread=true&unreadOnly=false' => [$unread->id]] as $query => $ids) {
            $response = $this->login($user)->getJson('/api/v1/notifications/me?'.$query)->assertOk()->assertJsonPath('data.total', count($ids));
            $this->assertEqualsCanonicalizing($ids, array_column($response->json('data.notifications'), 'id'));
        }
    }

    public function test_filters_apply_before_counting_and_paginating_and_keep_the_global_unread_count(): void
    {
        $user = $this->user();
        $expected = [];
        foreach (range(1, 5) as $index) {
            $notice = $this->notification($user, true, 'Selected '.$index);
            $notice->update(['created_at' => now()->subMinutes($index)]);
            $expected[] = $notice->id;
        }
        $this->notification($user, false, 'Selected pending');
        $this->notification($user, true, 'Other title');
        $this->notification($user, true, 'Selected investment', 'investment_confirmed');
        $this->notification($this->user(), true, 'Selected foreign');
        $this->login($user);
        $seen = [];
        foreach ([1 => 2, 2 => 2, 3 => 1, 4 => 0] as $page => $count) {
            $response = $this->getJson('/api/v1/notifications/me?unread=false&typeCode=new_comment&q=Selected&limit=2&page='.$page)
                ->assertOk()->assertJsonPath('data.total', 5)->assertJsonPath('data.totalPages', 3)
                ->assertJsonPath('data.page', $page)->assertJsonPath('data.perPage', 2)
                ->assertJsonPath('data.unreadCount', 1)->assertJsonCount($count, 'data.notifications');
            array_push($seen, ...array_column($response->json('data.notifications'), 'id'));
        }
        $this->assertSame($expected, $seen);
        $this->getJson('/api/v1/notifications/me?unread=true&type=new_comment&q=Selected&perPage=2')
            ->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.totalPages', 1)
            ->assertJsonPath('data.notifications.0.isRead', false);
    }

    public function test_empty_filtered_results_preserve_the_global_unread_count(): void
    {
        $user = $this->user();
        $this->notification($user, false);
        $this->login($user)->getJson('/api/v1/notifications/me?unread=false')->assertOk()
            ->assertJsonCount(0, 'data.notifications')->assertJsonPath('data.total', 0)
            ->assertJsonPath('data.totalPages', 1)->assertJsonPath('data.unreadCount', 1);
        $this->login($this->user())->getJson('/api/v1/notifications/me?unread=true')->assertOk()
            ->assertJsonCount(0, 'data.notifications')->assertJsonPath('data.total', 0)->assertJsonPath('data.unreadCount', 0);
    }

    public function test_notification_queries_require_an_active_authenticated_account(): void
    {
        $this->login(null)->getJson('/api/v1/notifications/me?unread=false')->assertUnauthorized();
        $inactive = $this->user();
        $inactive->update(['is_active' => false]);
        $this->login($inactive)->getJson('/api/v1/notifications?unread=false')->assertUnauthorized();
    }
}
