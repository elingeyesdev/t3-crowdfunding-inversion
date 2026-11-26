<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\InvestorProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CampaignClosingTimeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $this->seed();
        $this->travelTo(Carbon::parse('2026-11-20T16:00:00Z'));
    }

    private function owner(): User
    {
        $user = User::create(['email_verified' => true, 'email' => Str::uuid().'@example.test']);
        $user->assignRole('entrepreneur');
        EntrepreneurProfile::create(['user_id' => $user->id, 'bio' => str_repeat('Biografía completa. ', 4), 'company_name' => 'Proyecto', 'website' => 'https://example.com', 'linkedin_url' => 'https://linkedin.com/in/example', 'country' => 'Bolivia', 'identity_verified' => true, 'kyc_status' => 'approved']);

        return $user;
    }

    private function login(User $user): static
    {
        Auth::forgetGuards();

        return $this->withToken($user->createToken('test')->plainTextToken);
    }

    private function campaign(User $owner, string $status = 'approved'): Campaign
    {
        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Closing time campaign', 'slug' => (string) Str::uuid(), 'goal_amount' => 1000, 'status' => $status, 'end_date' => '2026-11-20T22:00:00Z'])->fresh();
    }

    public function test_api_creation_and_repeated_edits_preserve_the_instant_from_utc_and_explicit_offsets(): void
    {
        $owner = $this->owner();
        $this->login($owner);
        foreach (['2026-11-20T22:00:00.000Z' => '2026-11-20T22:00:00Z', '2026-11-20T18:00:00-04:00' => '2026-11-20T22:00:00Z', '2026-11-20T18:00:00+01:00' => '2026-11-20T17:00:00Z'] as $input => $expected) {
            $response = $this->postJson('/api/v1/entrepreneurs/me/campaigns', ['title' => 'Correct closing time', 'description' => str_repeat('Descripción completa. ', 4), 'goalAmount' => 1000, 'endDate' => $input])->assertCreated();
            $id = $response->json('data.id');
            $this->assertTrue(Carbon::parse($expected)->equalTo(Carbon::parse($response->json('data.endDate'))));
            $local = Carbon::parse($expected)->setTimezone('America/La_Paz')->format('Y-m-d H:i:s');
            $this->assertSame($local, Campaign::findOrFail($id)->getRawOriginal('end_date'));
            for ($i = 0; $i < 2; $i++) {
                $result = $this->patchJson('/api/v1/entrepreneurs/me/campaigns/'.$id, ['endDate' => $response->json('data.endDate')])->assertOk();
                $this->assertTrue(Carbon::parse($expected)->equalTo(Carbon::parse($result->json('data.endDate'))));
            }
            $this->patchJson('/api/v1/entrepreneurs/me/campaigns/'.$id, ['title' => 'Edit without changing date'])->assertOk();
            $this->assertSame($local, Campaign::findOrFail($id)->getRawOriginal('end_date'));
        }
    }

    public function test_publication_uses_the_actual_closing_instant_including_the_exact_boundary(): void
    {
        $owner = $this->owner();
        foreach (['2026-11-20T21:59:59Z' => 200, '2026-11-20T22:00:00Z' => 422, '2026-11-20T22:00:01Z' => 422] as $now => $status) {
            $c = $this->campaign($owner);
            $this->travelTo(Carbon::parse($now));
            $this->login($owner)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/publish')->assertStatus($status);
            $this->assertSame($status === 200 ? 'published' : 'approved', $c->fresh()->status);
        }
    }

    public function test_investments_stop_at_the_exact_closing_instant_without_financial_side_effects(): void
    {
        $owner = $this->owner();
        $investor = User::create(['email_verified' => true, 'email' => Str::uuid().'@example.test']);
        $investor->assignRole('investor');
        InvestorProfile::create(['user_id' => $investor->id, 'max_investment' => 5000]);
        foreach (['2026-11-20T21:59:59Z' => 201, '2026-11-20T22:00:00Z' => 422, '2026-11-20T22:00:01Z' => 422] as $now => $status) {
            $c = $this->campaign($owner, 'published');
            $this->travelTo(Carbon::parse($now));
            $before = $investor->investor->fresh()->getAttributes();
            $counts = [DB::table('transactions')->count(), DB::table('campaign_financial_movements')->count(), DB::table('notifications')->count()];
            $this->login($investor)->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 100])->assertStatus($status);
            if ($status === 422) {
                $this->assertSame($before, $investor->investor->fresh()->getAttributes());
                $this->assertSame($counts, [DB::table('transactions')->count(), DB::table('campaign_financial_movements')->count(), DB::table('notifications')->count()]);
                $this->assertSame(0.0, $c->fresh()->current_amount);
                $this->assertSame(0, $c->investments()->count());
            }
        }
    }

    public function test_expired_offset_is_rejected_when_editing_without_changing_the_stored_date(): void
    {
        $owner = $this->owner();
        $c = $this->campaign($owner, 'draft');
        $before = $c->getAttributes();
        $this->travelTo(Carbon::parse('2026-11-20T22:00:00Z'));
        $this->login($owner)->patchJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id, ['endDate' => '2026-11-20T18:00:00-04:00'])->assertUnprocessable();
        $this->assertSame($before, $c->fresh()->getAttributes());
    }

    public function test_existing_local_storage_is_read_without_reinterpreting_or_rewriting_dates(): void
    {
        $c = $this->campaign($this->owner());
        DB::table('campaigns')->where('id', $c->id)->update(['end_date' => '2026-11-20 18:00:00']);
        $c->refresh();
        $this->assertTrue($c->end_date->equalTo(Carbon::parse('2026-11-20T22:00:00Z')));
        $c->update(['title' => 'Preserve original date']);
        $this->assertSame('2026-11-20 18:00:00', $c->fresh()->getRawOriginal('end_date'));
    }
}
