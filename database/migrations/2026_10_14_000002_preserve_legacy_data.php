<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const JSON = ['campaigns' => ['tags', 'faq', 'social_links'], 'investor_profiles' => ['verification_documents', 'metadata'], 'reward_claims' => ['shipping_address'], 'notification_types' => ['template', 'default_channels'], 'transactions' => ['gateway_response', 'metadata']];

    public function up(): void
    {
        foreach (self::JSON as $table => $columns) {
            Schema::table($table, function (Blueprint $t) use ($columns) {
                foreach ($columns as $c) {
                    $t->json($c)->nullable();
                }
            });
        }
        Schema::table('campaigns', function (Blueprint $t) {
            $t->text('risks_and_challenges')->nullable();
            $t->timestamp('featured_at')->nullable();
            $t->integer('share_count')->default(0);
        });
        Schema::table('categories', function (Blueprint $t) {
            $t->string('icon')->nullable();
            $t->integer('campaign_count')->default(0);
        });
        Schema::table('user_roles', function (Blueprint $t) {
            $t->timestamp('assigned_at')->nullable();
            $t->uuid('assigned_by')->nullable();
        });
        Schema::table('investor_profiles', function (Blueprint $t) {
            $t->timestamp('identity_verified_at')->nullable();
        });
        Schema::table('investments', function (Blueprint $t) {
            $t->string('payment_method')->nullable();
        });
        Schema::table('reward_claims', function (Blueprint $t) {
            $t->text('notes')->nullable();
        });
        Schema::table('transactions', function (Blueprint $t) {
            foreach (['base_amount', 'fee_amount', 'platform_fee', 'provider_fee', 'net_amount'] as $c) {
                $t->decimal($c, 15, 2)->nullable();
            }
            $t->decimal('exchange_rate', 20, 8)->nullable();
            $t->string('base_currency', 10)->nullable();
            $t->uuid('payout_id')->nullable();
            $t->string('payment_gateway')->nullable();
            $t->string('gateway_transaction_id')->nullable();
            $t->text('description')->nullable();
            $t->timestamp('processed_at')->nullable();
        });
        Schema::table('notification_types', function (Blueprint $t) {
            $t->text('description')->nullable();
            $t->string('category')->nullable();
            $t->boolean('is_active')->default(true);
        });
        Schema::table('notifications', function (Blueprint $t) {
            $t->timestamp('sent_at')->nullable();
            $t->timestamp('expires_at')->nullable();
        });
        // Full archival copy of every source row, including tables outside the active application.
        Schema::create('legacy_records', function (Blueprint $t) {
            $t->id();
            $t->string('source_table');
            $t->string('source_key');
            $t->json('payload');
            $t->unique(['source_table', 'source_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legacy_records');
        foreach (self::JSON as $table => $columns) {
            Schema::table($table, fn (Blueprint $t) => $t->dropColumn($columns));
        }
        foreach (['campaigns' => ['risks_and_challenges', 'featured_at', 'share_count'], 'categories' => ['icon', 'campaign_count'], 'user_roles' => ['assigned_at', 'assigned_by'], 'investor_profiles' => ['identity_verified_at'], 'investments' => ['payment_method'], 'reward_claims' => ['notes'], 'transactions' => ['base_amount', 'fee_amount', 'platform_fee', 'provider_fee', 'net_amount', 'exchange_rate', 'base_currency', 'payout_id', 'payment_gateway', 'gateway_transaction_id', 'description', 'processed_at'], 'notification_types' => ['description', 'category', 'is_active'], 'notifications' => ['sent_at', 'expires_at']] as $table => $columns) {
            Schema::table($table, fn (Blueprint $t) => $t->dropColumn($columns));
        }
    }
};
