<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationCategoryFilterTest extends TestCase
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

    private function notice(User $user, ?string $type, bool $read = false, string $title = 'Notice'): Notification
    {
        return Notification::create(['user_id' => $user->id, 'type_code' => $type, 'title' => $title,
            'body' => 'Fixture', 'is_read' => $read, 'read_at' => $read ? now() : null])->fresh();
    }

    public function test_category_filters_and_returned_labels_use_the_same_classification_in_both_routes(): void
    {
        $user = $this->user();
        $groups = [
            'campaign' => ['campaign_published', 'campaign_custom', 'CAMPAIGN_PUBLISHED'],
            'investment' => ['investment_confirmed', 'investment_refunded'],
            'kyc' => ['kyc_reviewed'],
            'chat' => ['new_message', 'new_comment'],
            'financial' => ['financial_movement_verified', 'document_approved'],
            'system' => [null, '', 'unknown_event', 'milestone_completed', 'campaignXpublished', 'new_message_extra'],
        ];
        $ids = [];
        foreach ($groups as $category => $types) {
            foreach ($types as $type) {
                $ids[$category][] = $this->notice($user, $type)->id;
            }
        }
        $this->notice($this->user(), 'unknown_event');
        $this->notice($this->user(), 'investment_confirmed');
        foreach (['/api/v1/notifications', '/api/v1/notifications/me'] as $route) {
            foreach ($ids as $category => $expected) {
                $response = $this->login($user)->getJson($route.'?category='.$category)->assertOk()
                    ->assertJsonPath('data.total', count($expected));
                $rows = $response->json('data.notifications');
                $this->assertEqualsCanonicalizing($expected, array_column($rows, 'id'));
                $this->assertSame([$category], array_values(array_unique(array_column($rows, 'category'))));
            }
        }
    }

    public function test_matching_notifications_beyond_the_first_unfiltered_page_are_found_and_paginated(): void
    {
        $user = $this->user();
        $expected = [];
        foreach (range(1, 13) as $i) {
            $row = $this->notice($user, 'investment_confirmed');
            $row->update(['created_at' => now()->subMinutes($i + 20)]);
            $expected[] = $row->id;
        }
        foreach (range(1, 12) as $i) {
            $this->notice($user, 'campaign_published');
        }
        $this->login($user)->getJson('/api/v1/notifications/me?limit=12')->assertOk()
            ->assertJsonPath('data.total', 25)->assertJsonPath('data.notifications.0.category', 'campaign');
        $seen = [];
        foreach ([1 => 12, 2 => 1] as $page => $count) {
            $response = $this->getJson('/api/v1/notifications/me?category=investment&limit=12&page='.$page)->assertOk()
                ->assertJsonCount($count, 'data.notifications')->assertJsonPath('data.total', 13)
                ->assertJsonPath('data.totalPages', 2)->assertJsonPath('data.page', $page)->assertJsonPath('data.unreadCount', 25);
            array_push($seen, ...array_column($response->json('data.notifications'), 'id'));
        }
        $this->assertSame($expected, $seen);
    }

    public function test_category_combines_with_read_state_search_and_exact_event_filters(): void
    {
        $user = $this->user();
        $match = $this->notice($user, 'investment_confirmed', true, 'Selected');
        $pending = $this->notice($user, 'investment_confirmed', false, 'Selected');
        $this->notice($user, 'investment_confirmed', true, 'Other');
        $this->notice($user, 'investment_refunded', true, 'Selected');
        $this->notice($user, 'campaign_published', true, 'Selected');
        $this->notice($user, 'new_comment', true, 'Selected');
        $this->notice($this->user(), 'investment_confirmed', true, 'Selected');
        $query = '/api/v1/notifications/me?category=investment&q=Selected&typeCode=investment_confirmed';
        $this->login($user)->getJson($query.'&unread=false')->assertOk()->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.notifications.0.id', $match->id)->assertJsonPath('data.unreadCount', 1);
        $this->getJson($query.'&unread=true')->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.notifications.0.id', $pending->id);
        $this->getJson('/api/v1/notifications/me?category=investment&type=new_comment')->assertOk()
            ->assertJsonPath('data.total', 0)->assertJsonPath('data.totalPages', 1)->assertJsonCount(0, 'data.notifications');
    }

    public function test_all_and_absent_category_preserve_existing_results_and_invalid_categories_are_rejected(): void
    {
        $user = $this->user();
        $this->notice($user, 'campaign_published');
        $this->notice($user, null);
        foreach (['', '?category=all'] as $query) {
            $this->login($user)->getJson('/api/v1/notifications/me'.$query)->assertOk()->assertJsonPath('data.total', 2);
        }
        foreach (['invalid', 'campaign%25', 'category[]=campaign'] as $value) {
            $query = str_contains($value, '=') ? $value : 'category='.$value;
            $this->getJson('/api/v1/notifications/me?'.$query)->assertUnprocessable()->assertJsonValidationErrors('category');
        }
        $this->login(null)->getJson('/api/v1/notifications/me?category=system')->assertUnauthorized();
    }
}
