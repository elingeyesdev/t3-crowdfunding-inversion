<?php
declare(strict_types=1);
use App\Models\{User, InvestorProfile, EntrepreneurProfile, AdminProfile, Campaign, Category, RewardTier};
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\{Artisan, DB, Hash};

$app = require __DIR__.'/bootstrap.php';
$app->make(Kernel::class)->bootstrap();
$runtime = realpath(getenv('UFM_E2E_RUNTIME'));
if (DB::connection()->getDatabaseName() !== $runtime.'/runtime.sqlite') {
    throw new RuntimeException('Unexpected test database.');
}
Artisan::call('migrate:fresh', ['--force' => true]);
Artisan::call('db:seed', ['--force' => true]);
$accounts = [];
foreach (['donor' => 'investor', 'otherDonor' => 'investor', 'owner' => 'entrepreneur', 'otherOwner' => 'entrepreneur', 'admin' => 'admin', 'superadmin' => 'super_admin', 'unverifiedDonor' => 'investor', 'unverifiedOwner' => 'entrepreneur'] as $name => $role) {
    $verified = ! in_array($name, ['unverifiedDonor', 'unverifiedOwner'], true);
    $u = User::create(['email' => $name.'@example.test', 'password_hash' => Hash::make('Password123'), 'email_verified' => $verified]);
    $u->assignRole($role);
    if ($role === 'investor') {
        InvestorProfile::create(['user_id' => $u->id, 'first_name' => 'Ana', 'last_name' => 'Prueba', 'max_investment' => 500]);
    } elseif ($role === 'entrepreneur') {
        EntrepreneurProfile::create(['user_id' => $u->id, 'first_name' => 'Juan', 'last_name' => 'Prueba', 'bio' => str_repeat('Proyecto universitario de prueba. ', 3), 'company_name' => 'Uni QA', 'website' => 'https://example.test', 'linkedin_url' => 'https://example.test/profile', 'country' => 'Bolivia', 'identity_verified' => true, 'kyc_status' => 'approved']);
    } else {
        AdminProfile::create(['user_id' => $u->id, 'first_name' => 'Admin', 'last_name' => 'Prueba', 'access_level' => $role]);
    }
    $accounts[$name] = ['id' => $u->id, 'email' => $u->email, 'emailVerified' => $verified, 'token' => $u->createToken('e2e')->plainTextToken];
}
$campaigns = [];
foreach (['published', 'draft', 'approved', 'pending_review', 'rejected', 'funded', 'completed', 'failed', 'expired', 'kycPending', 'unverifiedDraft', 'unverifiedApproved'] as $name) {
    $status = match ($name) {
        'expired' => 'published',
        'kycPending', 'unverifiedApproved' => 'approved',
        'unverifiedDraft' => 'draft',
        default => $name,
    };
    $owner = str_starts_with($name, 'unverified') ? 'unverifiedOwner' : ($name === 'kycPending' ? 'otherOwner' : 'owner');
    $campaign = Campaign::create(['creator_id' => $accounts[$owner]['id'], 'category_id' => Category::first()->id, 'title' => 'QA '.$name, 'slug' => 'qa-'.$name, 'short_description' => 'Campaña sintética de aceptación', 'description' => str_repeat('Descripción de prueba de UniFundMe. ', 5), 'goal_amount' => 1000, 'current_amount' => 0, 'min_investment' => 10, 'max_investment' => 300, 'currency' => 'BOB', 'status' => $status, 'end_date' => $name === 'expired' ? now()->subDay() : now()->addDays(30), 'published_at' => in_array($status, ['published', 'funded', 'completed', 'failed']) ? now() : null]);
    $campaigns[$name] = $campaign->id;
}
EntrepreneurProfile::where('user_id', $accounts['otherOwner']['id'])->update(['identity_verified' => false, 'kyc_status' => 'pending']);
$reward = RewardTier::create(['campaign_id' => $campaigns['published'], 'title' => 'Recompensa QA', 'amount' => 50, 'currency' => 'BOB', 'min_percentage' => 5, 'max_percentage' => 20, 'is_active' => true, 'max_claims' => 10]);
$rewardExpired = RewardTier::create(['campaign_id' => $campaigns['published'], 'title' => 'Vencida QA', 'amount' => 50, 'currency' => 'BOB', 'min_percentage' => 5, 'max_percentage' => 20, 'is_active' => true, 'expires_at' => now()->subDay()]);
$rewardFull = RewardTier::create(['campaign_id' => $campaigns['published'], 'title' => 'Agotada QA', 'amount' => 50, 'currency' => 'BOB', 'min_percentage' => 5, 'max_percentage' => 20, 'is_active' => true, 'max_claims' => 1, 'current_claims' => 1]);
file_put_contents($runtime.'/fixtures.json', json_encode(['accounts' => $accounts, 'campaigns' => $campaigns, 'reward' => $reward->id, 'rewardExpired' => $rewardExpired->id, 'rewardFull' => $rewardFull->id], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
DB::disconnect();
copy($runtime.'/runtime.sqlite', $runtime.'/baseline.sqlite');
echo "E2E fixtures ready\n";
