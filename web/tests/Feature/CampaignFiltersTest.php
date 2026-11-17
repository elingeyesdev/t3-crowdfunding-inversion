<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CampaignFiltersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
    }

    public function test_filters_return_the_agreed_groups_with_matching_totals_and_no_foreign_campaigns(): void
    {
        $owner = User::create(['email' => 'owner@example.test']);
        $owner->assignRole('entrepreneur');
        $other = User::create(['email' => 'other@example.test']);
        $groups = [
            'drafts' => ['draft', 'rejected'], 'review' => ['pending_review', 'in_review'],
            'approved' => ['approved'], 'active' => ['published', 'partially_funded'],
            'funded' => ['funded'], 'completed' => ['completed', 'failed', 'cancelled'], 'suspended' => ['suspended'],
        ];
        foreach ([$owner, $other] as $user) {
            foreach (array_merge(...array_values($groups)) as $status) {
                Campaign::create(['creator_id' => $user->id, 'category_id' => Category::first()->id, 'title' => 'Filter '.$status, 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => $status]);
            }
        }
        $this->withToken($owner->createToken('test')->plainTextToken);
        $base = '/api/v1/entrepreneurs/me/campaigns';
        foreach ($groups as $group => $statuses) {
            $response = $this->getJson($base.'?filterPreset='.$group)->assertOk()->assertJsonPath('data.meta.totalItems', count($statuses));
            $this->assertEqualsCanonicalizing($statuses, array_column($response->json('data.data'), 'status'));
            $this->assertSame([$owner->id], array_unique(array_column($response->json('data.data'), 'creatorId')));
        }
        $this->getJson($base.'?filterPreset=all&limit=100')->assertOk()->assertJsonCount(12, 'data.data');
        $this->getJson($base.'?filterPreset=completed&search=failed')->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.status', 'failed');
        $this->getJson($base.'?filterPreset=completed&status=approved')->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.status', 'approved');
        // Legacy presets remain available to existing clients.
        $this->getJson($base.'?filterPreset=approval')->assertOk()->assertJsonCount(3, 'data.data');
        $this->getJson($base.'?filterPreset=archived')->assertOk()->assertJsonCount(4, 'data.data');
        $first = $this->getJson($base.'?limit=5&page=1')->assertOk()->json('data.data');
        $second = $this->getJson($base.'?limit=5&page=2')->assertOk()->json('data.data');
        $this->assertCount(10, array_unique(array_column([...$first, ...$second], 'id')));
    }
}
