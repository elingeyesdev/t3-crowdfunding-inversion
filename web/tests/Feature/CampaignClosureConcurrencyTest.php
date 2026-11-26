<?php

namespace Tests\Feature;

use App\Models\Campaign;
use App\Models\CampaignStatusHistory;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\InvestorProfile;
use App\Models\User;
use App\Services\InvestmentEngine;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class CampaignClosureConcurrencyTest extends TestCase
{
    private string $database;

    private string $originalConnection;

    private array $processes = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = sys_get_temp_dir().DIRECTORY_SEPARATOR.'campaign-close-'.Str::uuid().'.sqlite';
        fclose(fopen($this->database, 'x'));
        $this->originalConnection = DB::getDefaultConnection();
        config(['database.connections.closure_test' => [...config('database.connections.sqlite'), 'url' => null, 'database' => $this->database, 'busy_timeout' => 5000],
            'mail.default' => 'array', 'activity_mail.enabled' => false]);
        DB::setDefaultConnection('closure_test');
        $this->assertSame($this->database, DB::connection()->getDatabaseName());
        $this->artisan('migrate', ['--database' => 'closure_test', '--force' => true])->assertSuccessful();
        $this->seed();
        $this->travelTo(Carbon::parse('2026-11-25T16:00:00Z'));
    }

    protected function tearDown(): void
    {
        foreach ($this->processes as $process) {
            $process->stop();
        }
        DB::purge('closure_test');
        DB::setDefaultConnection($this->originalConnection);
        foreach (['', '.start', '-journal', '-wal', '-shm'] as $suffix) {
            if (is_file($this->database.$suffix)) {
                unlink($this->database.$suffix);
            }
        }
        parent::tearDown();
    }

    public static function closers(): array
    {
        return ['two automatic tasks' => ['auto', 'auto'], 'automatic and manual' => ['auto', 'manual']];
    }

    #[DataProvider('closers')]
    public function test_independent_processes_close_and_refund_exactly_once(string $first, string $second): void
    {
        $owner = User::factory()->create();
        EntrepreneurProfile::create(['user_id' => $owner->id]);
        $donor = User::factory()->create();
        InvestorProfile::create(['user_id' => $donor->id, 'max_investment' => 1000]);
        $campaign = Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Concurrent closure', 'slug' => (string) Str::uuid(), 'goal_amount' => 100, 'status' => 'published', 'end_date' => now()->addHour()]);
        $reward = $campaign->rewards()->create(['title' => 'One reward', 'min_percentage' => 0, 'max_percentage' => 100]);
        $ticket = app(InvestmentEngine::class)->invest($donor->id, ['campaignId' => $campaign->id, 'amount' => 10.10, 'rewardTierId' => $reward->id])['ticket'];
        $campaign->update(['end_date' => now()]);
        $barrier = realpath($this->database).'.start';
        foreach ([$first, $second] as $mode) {
            $process = new Process([PHP_BINARY, base_path('tests/Support/campaign-closure-worker.php'), realpath($this->database), $barrier, $campaign->id, $mode, $owner->id], base_path());
            $process->setTimeout(30);
            $process->start();
            $this->processes[] = $process;
        }
        foreach ($this->processes as $process) {
            $this->assertTrue($process->waitUntil(fn () => str_contains($process->getOutput(), 'ready')), $process->getErrorOutput());
        }
        file_put_contents($barrier, 'start');
        foreach ($this->processes as $process) {
            $process->wait();
            $this->assertContains($process->getExitCode(), [0, 75], $process->getErrorOutput().$process->getOutput());
            if ($process->getExitCode() === 75) {
                $this->assertStringContainsString('retryable_sqlite_lock', $process->getOutput());
            }
        }
        // SQLite's deferred writers may exhaust their bounded lock retries.
        // A subsequent task must finish or skip cleanly without duplicating money.
        $this->artisan('campaigns:close-expired')->assertSuccessful();
        $this->assertSame('failed', $campaign->fresh()->status);
        $this->assertSame('refunded', $ticket->fresh()->status);
        $this->assertSame(10.10, $ticket->fresh()->refunded_amount);
        $this->assertEquals(0, $donor->investor->fresh()->total_invested);
        $this->assertEquals(0, $owner->entrepreneur->fresh()->total_raised);
        $this->assertSame(0, $reward->fresh()->current_claims);
        $this->assertSame('cancelled', $ticket->rewardClaim->fresh()->status);
        $this->assertDatabaseCount('campaign_status_history', 1, 'closure_test');
        $this->assertSame(1, DB::table('transactions')->where('transaction_type', 'refund')->count());
        $this->assertSame(1, DB::table('campaign_financial_movements')->where('source', 'refund')->count());
        $this->assertSame(1, DB::table('notifications')->where('type_code', 'investment_refunded')->count());
        $this->assertSame(1, DB::table('notifications')->where('type_code', 'campaign_failed')->count());
        $history = CampaignStatusHistory::sole();
        $this->assertContains($history->changed_by, [null, $owner->id]);
    }
}
