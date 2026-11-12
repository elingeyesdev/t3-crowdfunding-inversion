<?php

namespace Tests\Feature;

use App\Events\ChatMessageSent;
use App\Models\AdminProfile;
use App\Models\Campaign;
use App\Models\CampaignDocument;
use App\Models\Category;
use App\Models\EntrepreneurProfile;
use App\Models\InvestorProfile;
use App\Models\Notification;
use App\Models\RewardTier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MigrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function account(string $role = 'investor'): User
    {
        $u = User::create(['email' => uniqid().'@example.test', 'password_hash' => Hash::make('Password123')]);
        $u->assignRole($role);
        if ($role === 'investor') {
            InvestorProfile::create(['user_id' => $u->id, 'first_name' => 'Ana', 'last_name' => 'Perez', 'max_investment' => 1000]);
        } elseif ($role === 'entrepreneur') {
            EntrepreneurProfile::create(['user_id' => $u->id, 'first_name' => 'Juan', 'last_name' => 'Perez', 'bio' => str_repeat('Biografía completa. ', 4), 'company_name' => 'Proyecto local', 'website' => 'https://example.com', 'linkedin_url' => 'https://linkedin.com/in/example', 'country' => 'Bolivia', 'identity_verified' => true, 'kyc_status' => 'approved']);
        } else {
            AdminProfile::create(['user_id' => $u->id, 'access_level' => $role]);
        }

        return $u;
    }

    private function asUser(User $u): static
    {
        Auth::forgetGuards();

        return $this->withToken($u->createToken('test')->plainTextToken);
    }

    private function campaign(?User $owner = null, array $attrs = []): Campaign
    {
        $owner ??= $this->account('entrepreneur');

        return Campaign::create(['creator_id' => $owner->id, 'category_id' => Category::first()->id, 'title' => 'Una campaña de prueba', 'slug' => uniqid('campana-'), 'description' => str_repeat('Descripción de prueba. ', 5), 'goal_amount' => 1000, 'status' => 'published', 'end_date' => now()->addDays(30), ...$attrs]);
    }

    public function test_registration_login_and_bearer_contract(): void
    {
        $this->postJson('/api/v1/users/register', ['email' => 'new@example.test', 'password' => 'Password123', 'signupRole' => 'entrepreneur'])->assertCreated()->assertJsonPath('data.roles.0', 'entrepreneur')->assertJsonMissingPath('data.passwordHash');
        $token = $this->postJson('/api/v1/auth/login', ['email' => 'new@example.test', 'password' => 'Password123'])->assertOk()->json('data.accessToken');
        Auth::forgetGuards();
        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.email', 'new@example.test');
        $this->postJson('/api/v1/auth/logout')->assertOk();
        Auth::forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_registration_rejects_privilege_escalation_and_weak_password(): void
    {
        $this->postJson('/api/v1/users/register', ['email' => 'bad@example.test', 'password' => 'password', 'signupRole' => 'super_admin'])->assertUnprocessable()->assertJsonValidationErrors(['password', 'signupRole']);
        $this->assertDatabaseMissing('users', ['email' => 'bad@example.test']);
    }

    public function test_registration_normalizes_email_before_checking_uniqueness(): void
    {
        $this->postJson('/api/v1/users/register', ['email' => 'New@Example.test', 'password' => 'Password123'])->assertCreated()->assertJsonPath('data.email', 'new@example.test');
        $this->postJson('/api/v1/users/register', ['email' => 'NEW@EXAMPLE.TEST', 'password' => 'Password123'])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertDatabaseCount('users', 1);
    }

    public function test_protected_api_returns_json_unauthorized_without_accept_header(): void
    {
        foreach (['/api/v1/auth/me', '/api/v1/admin/users', '/api/v1/chat/conversations'] as $path) {
            $this->get($path)->assertUnauthorized()->assertHeader('Content-Type', 'application/json');
        }
    }

    public function test_inactive_user_cannot_login_or_use_existing_token(): void
    {
        $u = $this->account();
        $this->asUser($u);
        $u->update(['is_active' => false]);
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', ['email' => $u->email, 'password' => 'Password123'])->assertUnauthorized();
    }

    public function test_legacy_bcrypt_hash_is_accepted_without_rehashing(): void
    {
        $u = $this->account();
        $hash = str_replace('$2y$', '$2b$', $u->password_hash);
        $u->update(['password_hash' => $hash]);
        $this->postJson('/api/v1/auth/login', ['email' => $u->email, 'password' => 'Password123'])->assertOk();
        $this->assertSame($hash, $u->fresh()->password_hash);
    }

    public function test_public_campaigns_exclude_drafts_and_pagination_is_bounded(): void
    {
        $public = $this->campaign();
        $draft = $this->campaign(attrs: ['status' => 'draft']);
        $this->getJson('/api/v1/campaigns/public?limit=100000&sortBy=invalid')->assertOk()->assertJsonPath('data.meta.totalItems', 1)->assertJsonPath('data.meta.itemsPerPage', 100)->assertJsonPath('data.data.0.id', $public->id)->assertJsonPath('data.data.0.goalAmount', 1000);
        $this->getJson('/api/v1/campaigns/public/'.$draft->id)->assertNotFound();
    }

    public function test_public_catalog_categories_and_filtering(): void
    {
        $categories = Category::where('is_active', true)->get();
        $response = $this->getJson('/api/v1/categories')->assertOk();
        $response->assertJsonPath('data.0.isActive', true);
        $this->assertGreaterThanOrEqual(1, count($response->json('data')));

        $catA = $categories[0];
        $catB = $categories[1];

        $campA = $this->campaign(attrs: ['category_id' => $catA->id, 'title' => 'Proyecto Tech Alpha', 'status' => 'published']);
        $campB = $this->campaign(attrs: ['category_id' => $catB->id, 'title' => 'Proyecto Arte Beta', 'status' => 'published']);

        // Filter by category A
        $this->getJson('/api/v1/campaigns/public?categoryId='.$catA->id)
            ->assertOk()
            ->assertJsonPath('data.meta.totalItems', 1)
            ->assertJsonPath('data.data.0.id', $campA->id);

        // Search by title keyword
        $this->getJson('/api/v1/campaigns/public?q=Alpha')
            ->assertOk()
            ->assertJsonPath('data.meta.totalItems', 1)
            ->assertJsonPath('data.data.0.id', $campA->id);
    }

    public function test_profile_fields_cannot_change_kyc_or_invested_total(): void
    {
        $u = $this->account();
        $this->asUser($u)->putJson('/api/v1/investors/me/profile', ['firstName' => 'María', 'totalInvested' => -5000, 'identityVerified' => true])->assertOk()->assertJsonPath('data.firstName', 'María')->assertJsonPath('data.totalInvested', 0)->assertJsonPath('data.identityVerified', false);
    }

    public function test_campaign_creation_requires_complete_verified_profile(): void
    {
        $u = $this->account('entrepreneur');
        $u->entrepreneur()->update(['identity_verified' => false]);
        $this->asUser($u)->getJson('/api/v1/entrepreneurs/me/profile/campaign-readiness')->assertOk()->assertJsonPath('data.canCreateCampaigns', false);
        $this->postJson('/api/v1/entrepreneurs/me/campaigns', ['title' => 'Campaña válida', 'description' => str_repeat('Descripción. ', 5), 'goalAmount' => 500])->assertUnprocessable();
    }

    public function test_campaign_crud_review_and_admin_publication(): void
    {
        $u = $this->account('entrepreneur');
        $id = $this->asUser($u)->postJson('/api/v1/entrepreneurs/me/campaigns', ['title' => 'Campaña de educación', 'description' => str_repeat('Descripción completa. ', 5), 'goalAmount' => 500, 'categoryIds' => [Category::first()->id], 'rewards' => [['title' => 'Gracias', 'minPercentage' => 0, 'maxPercentage' => 100]]])->assertCreated()->assertJsonPath('data.status', 'draft')->json('data.id');
        $this->patchJson('/api/v1/entrepreneurs/me/campaigns/'.$id, ['title' => 'Nuevo título de campaña'])->assertOk();
        $this->postJson('/api/v1/entrepreneurs/me/campaigns/'.$id.'/submit-for-review')->assertOk()->assertJsonPath('data.status', 'pending_review');
        $admin = $this->account('admin');
        $this->asUser($admin)->patchJson('/api/v1/admin/campaigns/'.$id.'/status', ['status' => 'published'])->assertOk()->assertJsonPath('data.status', 'published');
        $this->getJson('/api/v1/admin/campaigns/'.$id.'/history')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_ownership_blocks_other_entrepreneurs_from_campaign_and_reward_edits(): void
    {
        $c = $this->campaign(attrs: ['status' => 'draft']);
        $other = $this->account('entrepreneur');
        $this->asUser($other)->getJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id)->assertForbidden();
        $this->patchJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id, ['title' => 'Intento de edición'])->assertForbidden();
        $this->postJson('/api/v1/campaigns/'.$c->id.'/rewards', ['title' => 'Recompensa', 'minPercentage' => 0, 'maxPercentage' => 100])->assertForbidden();
    }

    public function test_campaign_funding_plan_management_and_public_visibility(): void
    {
        $u = $this->account('entrepreneur');
        $c = $this->campaign($u, ['goal_amount' => 1000, 'status' => 'draft']);

        // Entrepreneur creates a funding plan with categories and amounts
        $this->asUser($u)->putJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/funding-plan', [
            'fundingPlan' => [
                ['category' => 'Desarrollo de Software', 'description' => 'Servidores y backend', 'amount' => 600],
                ['category' => 'Marketing Digital', 'description' => 'Anuncios y difusión', 'amount' => 300],
                ['category' => 'Costos Operativos', 'description' => 'Trámites legales', 'amount' => 100],
            ],
        ])->assertOk()->assertJsonCount(3, 'data');

        $this->assertDatabaseHas('campaign_funding_plans', [
            'campaign_id' => $c->id,
            'category' => 'Desarrollo de Software',
            'amount' => 600,
            'percentage' => 60,
        ]);

        // Add an extra item
        $newItem = $this->asUser($u)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/funding-plan', [
            'category' => 'Reserva de Emergencia',
            'amount' => 50,
        ])->assertCreated()->json('data');

        // Delete the item
        $this->asUser($u)->deleteJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/funding-plan/'.$newItem['id'])
            ->assertOk();

        $this->assertDatabaseMissing('campaign_funding_plans', ['id' => $newItem['id']]);

        // Another entrepreneur cannot modify this campaign's funding plan
        $other = $this->account('entrepreneur');
        $this->asUser($other)->putJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/funding-plan', [
            'fundingPlan' => [['category' => 'Hack', 'amount' => 100]],
        ])->assertForbidden();

        // Public consultation
        $c->update(['status' => 'published']);
        $this->getJson('/api/v1/campaigns/'.$c->id.'/funding-plan')
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $this->getJson('/api/v1/campaigns/public/'.$c->id)
            ->assertOk()
            ->assertJsonPath('data.fundingPlan.0.category', 'Desarrollo de Software')
            ->assertJsonPath('data.fundingPlan.0.percentage', 60);
    }

    public function test_campaign_financial_traceability_ledger_and_movements(): void
    {
        $u = $this->account('entrepreneur');
        $c = $this->campaign($u, ['goal_amount' => 1000, 'status' => 'published']);

        // An investor makes a contribution of 500 BOB
        $investor = $this->account('investor');
        $this->asUser($investor)->postJson('/api/v1/investments', [
            'campaignId' => $c->id,
            'amount' => 500,
        ])->assertCreated();

        // The entrepreneur records an expense movement with receipt
        $response = $this->asUser($u)->post('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/financial-movements', [
            'type' => 'expense',
            'concept' => 'Compra de Servidor y Licencias Cloud',
            'category' => 'Equipamiento',
            'amount' => 150,
            'movementDate' => '2026-10-26',
            'referenceNumber' => 'FAC-9988',
            'notes' => 'Servidor de base de datos para el prototipo',
            'receipt' => UploadedFile::fake()->create('factura_servidor.pdf', 15, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $movementId = $response->json('data.id');
        $this->assertDatabaseHas('campaign_financial_movements', [
            'id' => $movementId,
            'campaign_id' => $c->id,
            'type' => 'expense',
            'amount' => 150,
            'reference_number' => 'FAC-9988',
        ]);
        $this->assertNotNull($response->json('data.receiptUrl'));

        // Public consultation of the financial traceability ledger
        $ledger = $this->getJson('/api/v1/campaigns/'.$c->id.'/financial-ledger')
            ->assertOk()
            ->json('data');

        $this->assertEquals(500, $ledger['summary']['totalIncome']);
        $this->assertEquals(150, $ledger['summary']['totalExpense']);
        $this->assertEquals(350, $ledger['summary']['balance']);
        $this->assertEquals(30, $ledger['summary']['executionPercentage']); // 150 / 500 * 100
        $this->assertCount(1, $ledger['expensesByCategory']);
        $this->assertEquals('Equipamiento', $ledger['expensesByCategory'][0]['category']);

        // Another entrepreneur cannot add movements to this campaign
        $other = $this->account('entrepreneur');
        $this->asUser($other)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/financial-movements', [
            'type' => 'expense',
            'concept' => 'Intento de gasto no autorizado',
            'category' => 'Fraude',
            'amount' => 100,
            'movementDate' => '2026-10-26',
        ])->assertForbidden();

        // Entrepreneur can update notes
        $this->asUser($u)->patchJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/financial-movements/'.$movementId, [
            'notes' => 'Notas corregidas y auditadas',
        ])->assertOk()->assertJsonPath('data.notes', 'Notas corregidas y auditadas');

        // Entrepreneur can delete manual expense
        $this->asUser($u)->deleteJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/financial-movements/'.$movementId)
            ->assertOk();

        $this->assertDatabaseMissing('campaign_financial_movements', ['id' => $movementId]);
    }

    public function test_campaign_milestones_updates_and_evidence_system(): void
    {
        $u = $this->account('entrepreneur');
        $c = $this->campaign($u, ['goal_amount' => 1000, 'status' => 'published']);

        // Entrepreneur creates a milestone
        $response = $this->asUser($u)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/milestones', [
            'title' => 'Fase 1: Prototipo y Pruebas Iniciales',
            'description' => 'Desarrollo del MVP y validación con usuarios de prueba.',
            'targetDate' => now()->addMonth()->toDateString(),
            'status' => 'in_progress',
            'progressPercentage' => 25,
        ])->assertCreated();

        $milestoneId = $response->json('data.id');
        $this->assertDatabaseHas('campaign_milestones', [
            'id' => $milestoneId,
            'campaign_id' => $c->id,
            'title' => 'Fase 1: Prototipo y Pruebas Iniciales',
            'progress_percentage' => 25,
        ]);

        // Upload evidence for this milestone
        $this->asUser($u)->post('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/milestones/'.$milestoneId.'/evidence', [
            'title' => 'Fotografía del prototipo funcional',
            'description' => 'Módulo electrónico ensamblado en laboratorio',
            'file' => UploadedFile::fake()->create('prototipo.jpg', 20, 'image/jpeg'),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.evidenceUrls.0.title', 'Fotografía del prototipo funcional');

        // An investor backs the project
        $investor = $this->account('investor');
        $this->asUser($investor)->postJson('/api/v1/investments', [
            'campaignId' => $c->id,
            'amount' => 300,
        ])->assertCreated();

        // Entrepreneur posts an update linked to the milestone
        $this->asUser($u)->post('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/updates', [
            'title' => 'Avance semanal: Pruebas concluidas con éxito',
            'content' => 'Se terminaron las pruebas de esfuerzo con excelentes resultados.',
            'milestoneId' => $milestoneId,
            'file' => UploadedFile::fake()->create('reporte_pruebas.pdf', 30, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('data.milestoneId', $milestoneId);

        // Mark the milestone as completed
        $this->asUser($u)->patchJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/milestones/'.$milestoneId, [
            'status' => 'completed',
        ])->assertOk()->assertJsonPath('data.status', 'completed')->assertJsonPath('data.progressPercentage', 100);

        // Public consultation of milestones and updates by donors
        $this->getJson('/api/v1/campaigns/'.$c->id.'/milestones')
            ->assertOk()
            ->assertJsonPath('data.0.id', $milestoneId)
            ->assertJsonPath('data.0.status', 'completed')
            ->assertJsonCount(1, 'data.0.evidenceUrls');

        $this->getJson('/api/v1/campaigns/'.$c->id.'/updates')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.milestone.title', 'Fase 1: Prototipo y Pruebas Iniciales');

        // Another entrepreneur cannot modify or delete this milestone
        $other = $this->account('entrepreneur');
        $this->asUser($other)->patchJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/milestones/'.$milestoneId, [
            'title' => 'Intento no autorizado',
        ])->assertForbidden();

        $this->asUser($other)->deleteJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/milestones/'.$milestoneId)
            ->assertForbidden();
    }

    public function test_investment_updates_balances_rewards_ledger_and_notifications_once(): void
    {
        $c = $this->campaign();
        $u = $this->account();
        $tier = RewardTier::create(['campaign_id' => $c->id, 'title' => 'Gracias', 'min_percentage' => 10, 'max_percentage' => 20, 'max_claims' => 1]);
        $id = $this->asUser($u)->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 100])->assertCreated()->assertJsonPath('data.remainingBalance', 900)->assertJsonPath('data.ticket.rewardTierId', $tier->id)->json('data.ticket.id');
        $this->assertDatabaseHas('campaigns', ['id' => $c->id, 'current_amount' => 100, 'investor_count' => 1]);
        $this->assertDatabaseHas('investor_profiles', ['user_id' => $u->id, 'total_invested' => 100, 'total_investments' => 1]);
        $this->assertDatabaseHas('reward_tiers', ['id' => $tier->id, 'current_claims' => 1]);
        $this->assertDatabaseHas('transactions', ['investment_id' => $id, 'amount' => 100, 'transaction_type' => 'payment']);
        $this->assertDatabaseHas('reward_claims', ['investment_id' => $id]);
        $this->assertDatabaseCount('notifications', 2);
        $this->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 100])->assertCreated()->assertJsonPath('data.ticket.rewardTierId', null);
        $this->assertDatabaseHas('campaigns', ['id' => $c->id, 'current_amount' => 200, 'investor_count' => 1]);
    }

    public function test_investment_rejections_do_not_partially_write_money(): void
    {
        $u = $this->account();
        $c = $this->campaign();
        $this->asUser($u)->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 1001])->assertUnprocessable();
        $this->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 0.001])->assertUnprocessable();
        $c->update(['status' => 'draft']);
        $this->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 50])->assertUnprocessable();
        $c->update(['status' => 'published', 'end_date' => now()->subDay()]);
        $this->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 50])->assertUnprocessable();
        $this->assertDatabaseCount('investments', 0);
        $this->assertDatabaseCount('transactions', 0);
        $this->assertEquals(0, $u->investor->fresh()->total_invested);
    }

    public function test_exact_goal_closes_campaign_and_prevents_overfunding(): void
    {
        $c = $this->campaign(attrs: ['goal_amount' => 0.30]);
        $u = $this->account();
        $this->asUser($u)->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 0.10])->assertCreated();
        $this->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 0.20])->assertCreated();
        $this->assertDatabaseHas('campaigns', ['id' => $c->id, 'current_amount' => 0.30, 'status' => 'funded']);
        $this->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 0.01])->assertUnprocessable();
    }

    public function test_finalization_refunds_all_contributions_and_cannot_refund_twice(): void
    {
        $owner = $this->account('entrepreneur');
        $c = $this->campaign($owner);
        $u = $this->account();
        $this->asUser($u)->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 100])->assertCreated();
        $this->asUser($owner)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/finalize')->assertOk()->assertJsonPath('data.status', 'failed');
        $this->assertDatabaseHas('investments', ['campaign_id' => $c->id, 'status' => 'refunded', 'refunded_amount' => 100]);
        $this->assertDatabaseHas('investor_profiles', ['user_id' => $u->id, 'total_invested' => 0]);
        $this->assertDatabaseHas('entrepreneur_profiles', ['user_id' => $owner->id, 'total_raised' => 0]);
        $this->assertDatabaseHas('campaigns', ['id' => $c->id, 'current_amount' => 0]);
        $this->postJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/finalize')->assertUnprocessable();
        $this->assertDatabaseCount('transactions', 2);
    }

    public function test_capital_ledger_and_profile_deletion_guard(): void
    {
        $u = $this->account();
        $c = $this->campaign();
        $this->asUser($u)->postJson('/api/v1/investors/me/capital/add', ['amount' => 25.50])->assertOk()->assertJsonPath('data.newMax', 1025.5);
        $this->getJson('/api/v1/investors/me/capital')->assertOk()->assertJsonPath('data.availableCapital', 1025.5);
        $this->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 20])->assertCreated();
        $this->putJson('/api/v1/investors/me/profile', ['maxInvestment' => 5])->assertUnprocessable();
        $this->deleteJson('/api/v1/investors/me/profile')->assertUnprocessable();
    }

    public function test_pdf_receipt_csv_report_and_financial_analytics(): void
    {
        $owner = $this->account('entrepreneur');
        $c = $this->campaign($owner);
        $u = $this->account();
        $id = $this->asUser($u)->postJson('/api/v1/investments', ['campaignId' => $c->id, 'amount' => 100])->assertCreated()->json('data.ticket.id');
        $pdf = $this->get('/api/v1/investments/'.$id.'/receipt')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $pdf->getContent());
        $this->asUser($this->account())->getJson('/api/v1/investments/'.$id.'/receipt')->assertNotFound();
        $this->asUser($owner)->getJson('/api/v1/campaigns/'.$c->id.'/analytics')->assertOk()->assertJsonPath('data.platformFee', 5)->assertJsonPath('data.netAmount', 95);
        $this->get('/api/v1/campaigns/'.$c->id.'/report?format=csv')->assertOk()->assertDownload('reporte_'.$c->slug.'.csv');
        $this->get('/api/v1/campaigns/'.$c->id.'/report?format=pdf')->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_admin_routes_and_old_seed_endpoints_are_protected(): void
    {
        $u = $this->account();
        $this->asUser($u)->getJson('/api/v1/admin/users')->assertForbidden();
        $this->postJson('/api/v1/superadmin/admins', ['email' => 'admin@example.test', 'password' => 'Password123'])->assertForbidden();
        $this->getJson('/api/v1/auth/seed')->assertNotFound();
        $this->postJson('/api/v1/campaigns/public/updates/seed-test')->assertNotFound();
        $admin = $this->account('super_admin');
        $this->asUser($admin)->postJson('/api/v1/superadmin/admins', ['email' => 'admin@example.test', 'password' => 'Password123'])->assertCreated();
        $this->getJson('/api/v1/superadmin/admins')->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_kyc_documents_are_private_and_admin_can_review(): void
    {
        Storage::fake('local');
        $u = $this->account('entrepreneur');
        $response = $this->asUser($u)->post('/api/v1/entrepreneurs/me/kyc', ['idDocument' => UploadedFile::fake()->create('id.pdf', 10, 'application/pdf'), 'faceVideo' => UploadedFile::fake()->create('selfie.jpg', 10, 'image/jpeg')], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.kycStatus', 'pending');
        $url = $response->json('data.verificationDocuments.0.url');
        $this->assertStringContainsString('signature=', $url);
        $this->get($url)->assertOk();
        $this->getJson(strtok($url, '?'))->assertForbidden();
        $admin = $this->account('admin');
        $this->asUser($admin)->postJson('/api/v1/admin/kyc/'.$u->entrepreneur->id.'/review', ['action' => 'approve'])->assertOk();
        $this->assertTrue($u->entrepreneur->fresh()->identity_verified);
    }

    public function test_nested_document_review_cannot_modify_another_campaign(): void
    {
        $one = $this->campaign();
        $two = $this->campaign();
        $doc = CampaignDocument::create(['campaign_id' => $two->id, 'file_url' => 'file.pdf', 'original_name' => 'file.pdf', 'mime_type' => 'application/pdf', 'file_size_bytes' => 10]);
        $this->asUser($this->account('admin'))->patchJson('/api/v1/admin/campaigns/'.$one->id.'/documents/'.$doc->id.'/review', ['status' => 'approved'])->assertNotFound();
        $this->assertSame('pending', $doc->fresh()->status);
    }

    public function test_comments_likes_and_notifications_respect_user_identity(): void
    {
        $u = $this->account();
        $other = $this->account();
        $c = $this->campaign();
        $id = $this->asUser($u)->postJson('/api/v1/campaigns/'.$c->id.'/comments', ['content' => 'Un gran proyecto'])->assertCreated()->json('data.id');
        $date = $this->getJson('/api/v1/campaigns/'.$c->id.'/comments')->assertOk()->json('data.0.createdAt');
        $this->assertIsString($date);
        $this->assertNotFalse(strtotime($date));
        $this->postJson('/api/v1/campaigns/'.$c->id.'/comments/'.$id.'/like')->assertOk()->assertJsonPath('data.likesCount', 1);
        $this->postJson('/api/v1/campaigns/'.$c->id.'/comments/'.$id.'/like')->assertOk()->assertJsonPath('data.likesCount', 0);
        $notification = Notification::create(['user_id' => $other->id, 'title' => 'Privada', 'body' => 'Mensaje privado']);
        $this->patchJson('/api/v1/notifications/'.$notification->id.'/read')->assertNotFound();
    }

    public function test_chat_persists_messages_and_denies_nonparticipants(): void
    {
        Event::fake([ChatMessageSent::class]);
        $one = $this->account();
        $two = $this->account();
        $outsider = $this->account();
        $id = $this->asUser($one)->postJson('/api/v1/chat/conversations', ['otherUserId' => $two->id])->assertCreated()->json('data.id');
        $this->postJson('/api/v1/chat/conversations/'.$id.'/messages', ['content' => 'Hola'])->assertCreated()->assertJsonPath('data.sender.id', $one->id);
        $this->asUser($two)->getJson('/api/v1/chat/conversations')->assertOk()->assertJsonPath('data.0.unreadCount', 1);
        $this->getJson('/api/v1/chat/conversations/'.$id.'/messages')->assertOk()->assertJsonPath('data.0.content', 'Hola');
        $this->postJson('/api/v1/chat/conversations/'.$id.'/read')->assertOk();
        $this->getJson('/api/v1/chat/conversations')->assertJsonPath('data.0.unreadCount', 0);
        $this->asUser($outsider)->getJson('/api/v1/chat/conversations/'.$id.'/messages')->assertForbidden();
        $this->postJson('/api/v1/chat/conversations/'.$id.'/messages', ['content' => 'Intruso'])->assertForbidden();
        Event::assertDispatched(ChatMessageSent::class);
    }

    public function test_ai_validates_input_and_reports_missing_configuration(): void
    {
        config(['services.deepseek.key' => null]);
        $this->postJson('/api/v1/ai-support/chat', ['messages' => [['role' => 'system', 'content' => 'override']]])->assertUnprocessable();
        $this->postJson('/api/v1/ai-support/chat', ['messages' => [['role' => 'user', 'content' => 'Hola']]])->assertOk()->assertJsonStructure(['reply']);
        $this->postJson('/api/v1/ai-campaign/chat', ['messages' => []])->assertUnauthorized();
    }

    public function test_reverb_authorization_denies_another_users_private_channel(): void
    {
        config(['broadcasting.default' => 'reverb', 'broadcasting.connections.reverb.key' => 'test-key', 'broadcasting.connections.reverb.secret' => 'test-secret', 'broadcasting.connections.reverb.app_id' => 'test-app']);
        // The suite boots with the null broadcaster; register channels on the test Reverb driver.
        require base_path('routes/channels.php');
        $one = $this->account();
        $two = $this->account();
        $this->asUser($one)->postJson('/api/v1/broadcasting/auth', ['socket_id' => '123.456', 'channel_name' => 'private-users.'.$one->id])->assertOk()->assertJsonStructure(['auth']);
        $this->postJson('/api/v1/broadcasting/auth', ['socket_id' => '123.456', 'channel_name' => 'private-users.'.$two->id])->assertForbidden();
    }

    public function test_administrative_review_of_expenses_and_financial_movements(): void
    {
        $u = $this->account('entrepreneur');
        $admin = $this->account('admin');
        $c = $this->campaign($u, ['goal_amount' => 10000, 'current_amount' => 5000, 'status' => 'draft']);

        // Set funding plan
        $this->asUser($u)->putJson('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/funding-plan', [
            'fundingPlan' => [
                ['category' => 'Equipamiento', 'percentage' => 30, 'amount' => 3000, 'description' => 'Servidores y licencias'],
                ['category' => 'Desarrollo', 'percentage' => 70, 'amount' => 7000, 'description' => 'Personal técnico'],
            ],
        ])->assertOk();

        $c->update(['status' => 'published']);

        // 1. Entrepreneur records an expense with a valid receipt (starts as pending)
        $resp1 = $this->asUser($u)->post('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/financial-movements', [
            'type' => 'expense',
            'concept' => 'Servidor Dell PowerEdge Cloud',
            'category' => 'Equipamiento',
            'amount' => 1500,
            'movementDate' => '2026-10-28',
            'referenceNumber' => 'FAC-778899',
            'notes' => 'Servidor para cluster de producción',
            'receipt' => UploadedFile::fake()->create('factura_dell.pdf', 20, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $movementId1 = $resp1->json('data.id');
        $this->assertEquals('pending', $resp1->json('data.status'));

        // 2. Entrepreneur records an unbudgeted expense without receipt
        $resp2 = $this->asUser($u)->post('/api/v1/entrepreneurs/me/campaigns/'.$c->id.'/financial-movements', [
            'type' => 'expense',
            'concept' => 'Publicidad en Redes Sociales',
            'category' => 'Marketing',
            'amount' => 800,
            'movementDate' => '2026-10-28',
            'notes' => 'Campaña en redes no contemplada',
        ], ['Accept' => 'application/json'])->assertCreated();

        $movementId2 = $resp2->json('data.id');

        // 3. Security: Non-admin users are forbidden from accessing admin financial review endpoints
        $this->asUser($u)->getJson('/api/v1/admin/financial-movements')->assertForbidden();
        $this->asUser($u)->getJson('/api/v1/admin/financial-audit/summary')->assertForbidden();
        $this->asUser($u)->postJson('/api/v1/admin/financial-movements/'.$movementId1.'/review', [
            'action' => 'approve',
        ])->assertForbidden();

        // 4. Admin audits summary metrics
        $summary = $this->asUser($admin)->getJson('/api/v1/admin/financial-audit/summary')
            ->assertOk()
            ->json('data');

        $this->assertGreaterThanOrEqual(2, $summary['totalMovements']);
        $this->assertGreaterThanOrEqual(2300, $summary['totalExpenses']);
        $this->assertGreaterThanOrEqual(2, $summary['pendingCount']);
        $this->assertGreaterThanOrEqual(1, $summary['expensesWithoutReceiptCount']);

        // 5. Admin lists financial movements with filtering
        $listAll = $this->asUser($admin)->getJson('/api/v1/admin/financial-movements')
            ->assertOk()
            ->json('data.data');
        $this->assertNotEmpty($listAll);

        // Filter by hasReceipt=false
        $noReceiptList = $this->asUser($admin)->getJson('/api/v1/admin/financial-movements?hasReceipt=false')
            ->assertOk()
            ->json('data.data');
        $this->assertTrue(collect($noReceiptList)->contains('id', $movementId2));
        $this->assertFalse(collect($noReceiptList)->contains('id', $movementId1));

        // Filter by search query
        $searchList = $this->asUser($admin)->getJson('/api/v1/admin/financial-movements?q=Dell')
            ->assertOk()
            ->json('data.data');
        $this->assertTrue(collect($searchList)->contains('id', $movementId1));

        // 6. Admin inspects movement detail and consistency checks
        $detail2 = $this->asUser($admin)->getJson('/api/v1/admin/financial-movements/'.$movementId2)
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($detail2['consistencyFlags']);
        $flagCodes = collect($detail2['consistencyFlags'])->pluck('code')->all();
        $this->assertContains('MISSING_RECEIPT', $flagCodes);
        $this->assertContains('UNBUDGETED_CATEGORY', $flagCodes);

        // 7. Admin approves legitimate expense #1
        $this->asUser($admin)->postJson('/api/v1/admin/financial-movements/'.$movementId1.'/review', [
            'action' => 'approve',
            'notes' => 'Comprobante revisado y validado contra equipamiento.',
        ])->assertOk()
          ->assertJsonPath('data.status', 'verified')
          ->assertJsonPath('data.reviewedBy', $admin->id);

        $this->assertDatabaseHas('campaign_financial_movements', [
            'id' => $movementId1,
            'status' => 'verified',
            'reviewed_by' => $admin->id,
        ]);

        // 8. Admin flags movement #2 as irregular / observed
        // Validation: flag requires notes
        $this->asUser($admin)->postJson('/api/v1/admin/financial-movements/'.$movementId2.'/review', [
            'action' => 'flag',
        ])->assertUnprocessable();

        // Flagging with explanatory notes
        $this->asUser($admin)->postJson('/api/v1/admin/financial-movements/'.$movementId2.'/review', [
            'action' => 'flag',
            'notes' => 'Falta comprobante fiscal y la categoría Marketing no fue aprobada en el plan de uso de fondos.',
        ])->assertOk()
          ->assertJsonPath('data.status', 'flagged')
          ->assertJsonPath('data.reviewedBy', $admin->id);

        $this->assertDatabaseHas('campaign_financial_movements', [
            'id' => $movementId2,
            'status' => 'flagged',
            'review_notes' => 'Falta comprobante fiscal y la categoría Marketing no fue aprobada en el plan de uso de fondos.',
        ]);

        // Verify notification sent to entrepreneur
        $this->assertDatabaseHas('notifications', [
            'user_id' => $u->id,
            'type_code' => 'financial_movement_flagged',
        ]);

        // 9. Admin performs campaign-level financial audit deep dive
        $campAudit = $this->asUser($admin)->getJson('/api/v1/admin/campaigns/'.$c->id.'/financial-audit')
            ->assertOk()
            ->json('data');

        $this->assertEquals($c->id, $campAudit['campaign']['id']);
        $this->assertNotEmpty($campAudit['fundingPlanComparison']);
        $this->assertEquals(1, $campAudit['inconsistencies']['flaggedCount']);
        $this->assertEquals(1, $campAudit['inconsistencies']['missingReceiptsCount']);
        $this->assertEquals(1, $campAudit['inconsistencies']['unbudgetedExpensesCount']);
    }

    public function test_centralized_notification_system_events_and_endpoints(): void
    {
        $creator = $this->account('entrepreneur');
        $investor = $this->account('investor');
        $other = $this->account();
        $camp = $this->campaign($creator, ['goal_amount' => 5000, 'current_amount' => 0, 'status' => 'published']);

        // 1. Comment triggers notification to campaign creator
        $this->asUser($other)->postJson('/api/v1/campaigns/'.$camp->id.'/comments', [
            'content' => 'Excelente proyecto de crowdfunding!',
        ])->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $creator->id,
            'type_code' => 'new_comment',
        ]);

        // 2. Investment triggers notifications to both investor and creator
        $investor->investor->update(['max_investment' => 2000]);
        $this->asUser($investor)->postJson('/api/v1/investments', [
            'campaignId' => $camp->id,
            'amount' => 500,
        ])->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $investor->id,
            'type_code' => 'investment_confirmed',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $creator->id,
            'type_code' => 'investment_received',
        ]);

        // 3. Campaign update triggers notification to campaign backers
        $this->asUser($creator)->postJson('/api/v1/entrepreneurs/me/campaigns/'.$camp->id.'/updates', [
            'title' => 'Primer informe de avances',
            'content' => 'Completamos la fase de especificaciones técnicas con el equipo.',
        ])->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'user_id' => $investor->id,
            'type_code' => 'campaign_update',
        ]);

        // 4. Querying notifications via API
        // Unread count endpoint
        $countResp = $this->asUser($creator)->getJson('/api/v1/notifications/unread-count')
            ->assertOk()
            ->json('data.unreadCount');
        $this->assertGreaterThanOrEqual(2, $countResp);

        // Paginated list
        $listResp = $this->asUser($creator)->getJson('/api/v1/notifications')
            ->assertOk()
            ->json('data');

        $this->assertArrayHasKey('notifications', $listResp);
        $this->assertArrayHasKey('unreadCount', $listResp);
        $this->assertArrayHasKey('total', $listResp);
        $this->assertNotEmpty($listResp['notifications']);

        $firstNotif = $listResp['notifications'][0];
        $notifId = $firstNotif['id'];

        // Filter by typeCode
        $typeList = $this->asUser($creator)->getJson('/api/v1/notifications?typeCode=new_comment')
            ->assertOk()
            ->json('data.notifications');
        $this->assertTrue(collect($typeList)->every(fn ($n) => $n['typeCode'] === 'new_comment'));

        // 5. Single notification inspection
        $single = $this->asUser($creator)->getJson('/api/v1/notifications/'.$notifId)
            ->assertOk()
            ->json('data');
        $this->assertEquals($notifId, $single['id']);

        // 6. Cross-user security check: another user cannot view, mark read, or delete creator's notification
        $this->asUser($other)->getJson('/api/v1/notifications/'.$notifId)->assertNotFound();
        $this->asUser($other)->patchJson('/api/v1/notifications/'.$notifId.'/read')->assertNotFound();
        $this->asUser($other)->deleteJson('/api/v1/notifications/'.$notifId)->assertNotFound();

        // 7. Mark single notification as read
        $this->asUser($creator)->patchJson('/api/v1/notifications/'.$notifId.'/read')
            ->assertOk()
            ->assertJsonPath('data.isRead', true);

        $this->assertDatabaseHas('notifications', [
            'id' => $notifId,
            'is_read' => true,
        ]);

        // 8. Mark all notifications as read
        $this->asUser($creator)->patchJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('data.unreadCount', 0);

        $this->assertEquals(0, $this->asUser($creator)->getJson('/api/v1/notifications/unread-count')->json('data.unreadCount'));

        // 9. Clear read notifications
        $this->asUser($creator)->deleteJson('/api/v1/notifications/clear-read')
            ->assertOk();

        // 10. User notification preferences
        $prefs = $this->asUser($creator)->getJson('/api/v1/notifications/preferences')
            ->assertOk()
            ->json('data');
        $this->assertTrue($prefs['inAppEnabled']);

        // Update preferences to disable inAppEnabled
        $this->asUser($creator)->putJson('/api/v1/notifications/preferences', [
            'inAppEnabled' => false,
            'investmentAlerts' => false,
        ])->assertOk()
          ->assertJsonPath('data.inAppEnabled', false);

        // Notifier respects preferences and suppresses when disabled
        $notifier = app(\App\Services\Notifier::class);
        $result = $notifier->send($creator->id, 'investment_received', 'Silenciado', 'Este mensaje no debe guardarse');
        $this->assertNull($result);
    }
}
