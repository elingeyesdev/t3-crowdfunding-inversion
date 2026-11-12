<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['entrepreneur_profiles', 'investor_profiles', 'admin_profiles'] as $table) {
            Schema::create($table, function (Blueprint $t) use ($table) {
                $t->uuid('id')->primary();
                $t->foreignUuid('user_id')->unique()->constrained()->cascadeOnDelete();
                foreach (['first_name', 'last_name', 'display_name', 'city', 'state', 'country', 'postal_code'] as $f) {
                    $t->string($f)->nullable();
                }
                foreach (['bio', 'avatar_url', 'cover_url'] as $f) {
                    $t->text($f)->nullable();
                }
                $t->boolean('identity_verified')->default(false);
                if ($table === 'entrepreneur_profiles') {
                    foreach (['company_name', 'website', 'linkedin_url', 'address_line', 'bank_account_number', 'bank_name'] as $f) {
                        $t->string($f, 512)->nullable();
                    }
                    $t->string('kyc_status')->default('unverified');
                    $t->timestamp('identity_verified_at')->nullable();
                    $t->text('kyc_rejection_reason')->nullable();
                    $t->json('verification_documents')->nullable();
                    $t->integer('total_campaigns')->default(0);
                    $t->decimal('total_raised', 15, 2)->default(0);
                    $t->decimal('rating', 3, 2)->nullable();
                } elseif ($table === 'investor_profiles') {
                    $t->string('investor_type')->default('individual');
                    $t->boolean('accredited')->default(false);
                    foreach (['tax_id', 'address_line1', 'address_line2'] as $f) {
                        $t->string($f)->nullable();
                    }
                    $t->json('preferred_categories')->nullable();
                    $t->decimal('min_investment', 15, 2)->nullable();
                    $t->decimal('max_investment', 15, 2)->default(0);
                    $t->integer('total_investments')->default(0);
                    $t->decimal('total_invested', 15, 2)->default(0);
                } else {
                    $t->string('access_level')->default('admin');
                    $t->boolean('is_active')->default(true);
                    foreach (['can_approve_campaigns', 'can_manage_users', 'can_manage_finances'] as $f) {
                        $t->boolean($f)->default(true);
                    }
                }
                $t->timestamps();
            });
        }
        Schema::create('categories', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->string('display_name')->nullable();
            $t->string('slug')->unique();
            $t->text('description')->nullable();
            $t->string('icon_url', 512)->nullable();
            $t->string('color')->nullable();
            $t->boolean('is_active')->default(true);
            $t->integer('sort_order')->default(0);
            $t->timestamps();
        });
        Schema::create('campaigns', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('creator_id')->constrained('users')->restrictOnDelete();
            $t->foreignUuid('category_id')->constrained()->restrictOnDelete();
            $t->string('title', 200);
            $t->string('slug')->unique();
            $t->string('subtitle')->nullable();
            $t->longText('description')->nullable();
            $t->text('short_description')->nullable();
            $t->string('campaign_type')->default('donation');
            $t->string('status')->default('draft')->index();
            $t->decimal('goal_amount', 15, 2);
            $t->decimal('current_amount', 15, 2)->default(0);
            $t->string('currency', 10)->default('BOB');
            $t->decimal('min_investment', 15, 2)->default(0);
            $t->decimal('max_investment', 15, 2)->nullable();
            $t->integer('investor_count')->default(0);
            $t->integer('view_count')->default(0);
            foreach (['cover_image_url', 'video_url', 'location'] as $f) {
                $t->text($f)->nullable();
            }
            foreach (['start_date', 'end_date', 'funded_at', 'published_at'] as $f) {
                $t->timestamp($f)->nullable();
            }
            $t->boolean('is_featured')->default(false);
            $t->json('metadata')->nullable();
            $t->timestamps();
        });
        Schema::create('campaign_categories', function (Blueprint $t) {
            $t->foreignUuid('campaign_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('category_id')->constrained()->cascadeOnDelete();
            $t->primary(['campaign_id', 'category_id']);
        });
        Schema::create('reward_tiers', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('campaign_id')->constrained()->cascadeOnDelete();
            $t->string('title');
            $t->text('description')->nullable();
            $t->decimal('amount', 15, 2)->default(0);
            $t->string('currency', 10)->default('BOB');
            $t->decimal('min_percentage', 8, 4)->default(0);
            $t->decimal('max_percentage', 8, 4)->default(100);
            $t->integer('max_claims')->nullable();
            $t->integer('current_claims')->default(0);
            $t->date('estimated_delivery')->nullable();
            $t->boolean('includes_shipping')->default(false);
            $t->text('shipping_details')->nullable();
            $t->text('image_url')->nullable();
            $t->timestamp('expires_at')->nullable();
            $t->json('items')->nullable();
            $t->integer('sort_order')->default(0);
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });
        Schema::create('investments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('campaign_id')->constrained()->restrictOnDelete();
            $t->foreignUuid('investor_id')->constrained('users')->restrictOnDelete();
            $t->foreignUuid('reward_tier_id')->nullable()->constrained()->nullOnDelete();
            $t->decimal('amount', 15, 2);
            $t->string('currency', 10)->default('BOB');
            $t->string('status')->default('completed');
            $t->boolean('is_anonymous')->default(false);
            $t->decimal('refunded_amount', 15, 2)->default(0);
            $t->text('refund_reason')->nullable();
            $t->timestamp('refunded_at')->nullable();
            $t->timestamps();
        });
        Schema::create('transactions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('investment_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignUuid('user_id')->nullable()->constrained()->restrictOnDelete();
            $t->string('transaction_type');
            $t->decimal('amount', 15, 2);
            $t->string('currency', 10)->default('BOB');
            $t->string('status')->default('completed');
            $t->text('notes')->nullable();
            $t->timestamps();
        });
        Schema::create('reward_claims', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('investment_id')->unique()->constrained()->cascadeOnDelete();
            $t->string('status')->default('pending');
            $t->string('tracking_number')->nullable();
            $t->text('tracking_url')->nullable();
            $t->timestamp('shipped_at')->nullable();
            $t->timestamp('delivered_at')->nullable();
            $t->timestamps();
        });
        Schema::create('campaign_status_history', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('campaign_id')->constrained()->cascadeOnDelete();
            $t->string('from_status')->nullable();
            $t->string('to_status');
            $t->foreignUuid('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->text('reason')->nullable();
            $t->timestamps();
        });
        Schema::create('campaign_reviews', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('campaign_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('decision');
            $t->text('feedback')->nullable();
            $t->timestamps();
        });
        Schema::create('campaign_documents', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('campaign_id')->constrained()->cascadeOnDelete();
            $t->text('file_url');
            $t->string('original_name');
            $t->string('mime_type');
            $t->bigInteger('file_size_bytes');
            $t->text('justification')->nullable();
            $t->string('status')->default('pending');
            $t->text('reviewer_notes')->nullable();
            $t->foreignUuid('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $t->timestamp('reviewed_at')->nullable();
            $t->timestamps();
        });
        Schema::create('campaign_updates', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('campaign_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('author_id')->constrained('users')->cascadeOnDelete();
            $t->string('title');
            $t->longText('content');
            $t->boolean('is_public')->default(true);
            $t->json('attachments')->nullable();
            $t->timestamps();
        });
        Schema::create('comments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('campaign_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('author_id')->constrained('users')->cascadeOnDelete();
            $t->text('content');
            $t->timestamps();
        });
        Schema::create('comment_likes', function (Blueprint $t) {
            $t->foreignUuid('comment_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->primary(['comment_id', 'user_id']);
        });
        Schema::create('notification_types', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('code')->unique();
            $t->string('name')->nullable();
            $t->timestamps();
        });
        Schema::create('notifications', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('type_id')->nullable()->constrained('notification_types')->nullOnDelete();
            $t->string('type_code')->nullable();
            $t->string('title');
            $t->text('body');
            $t->string('channel')->default('in_app');
            $t->boolean('is_read')->default(false);
            $t->timestamp('read_at')->nullable();
            $t->text('action_url')->nullable();
            $t->string('reference_type')->nullable();
            $t->uuid('reference_id')->nullable();
            $t->json('data')->nullable();
            $t->timestamps();
        });
        Schema::create('conversations', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('user_one_id')->constrained('users')->cascadeOnDelete();
            $t->foreignUuid('user_two_id')->constrained('users')->cascadeOnDelete();
            $t->foreignUuid('campaign_id')->nullable()->constrained()->nullOnDelete();
            $t->string('subject')->nullable();
            $t->string('status')->default('active');
            $t->timestamp('last_message_at')->nullable();
            $t->timestamp('user_one_read_at')->nullable();
            $t->timestamp('user_two_read_at')->nullable();
            $t->timestamps();
            $t->index(['user_one_id', 'user_two_id']);
        });
        Schema::create('messages', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('conversation_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('sender_id')->constrained('users')->cascadeOnDelete();
            $t->text('content');
            $t->string('message_type')->default('text');
            $t->boolean('is_edited')->default(false);
            $t->timestamps();
            $t->index(['conversation_id', 'created_at']);
        });
    }

    public function down(): void
    {
        foreach (['messages', 'conversations', 'notifications', 'notification_types', 'comment_likes', 'comments', 'campaign_updates', 'campaign_documents', 'campaign_reviews', 'campaign_status_history', 'reward_claims', 'transactions', 'investments', 'reward_tiers', 'campaign_categories', 'campaigns', 'categories', 'admin_profiles', 'investor_profiles', 'entrepreneur_profiles'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
