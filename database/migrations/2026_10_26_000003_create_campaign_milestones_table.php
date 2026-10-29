<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaign_milestones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('campaign_id')->constrained('campaigns')->cascadeOnDelete();
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->date('target_date')->nullable();
            $table->date('completed_date')->nullable();
            $table->string('status', 30)->default('pending'); // pending, in_progress, completed, delayed
            $table->integer('progress_percentage')->default(0); // 0 - 100
            $table->integer('sort_order')->default(0);
            $table->json('evidence_urls')->nullable(); // [{title, url, type, uploaded_at}]
            $table->timestamps();

            $table->index(['campaign_id', 'status']);
            $table->index(['campaign_id', 'sort_order']);
        });

        Schema::table('campaign_updates', function (Blueprint $table) {
            $table->foreignUuid('milestone_id')->nullable()->after('campaign_id')->constrained('campaign_milestones')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('campaign_updates', function (Blueprint $table) {
            $table->dropForeign(['milestone_id']);
            $table->dropColumn('milestone_id');
        });

        Schema::dropIfExists('campaign_milestones');
    }
};
