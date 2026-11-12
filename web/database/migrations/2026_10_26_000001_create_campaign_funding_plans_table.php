<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaign_funding_plans', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('campaign_id')->constrained('campaigns')->cascadeOnDelete();
            $table->string('category', 150);
            $table->text('description')->nullable();
            $table->decimal('amount', 15, 2);
            $table->decimal('percentage', 5, 2)->nullable();
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index('campaign_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaign_funding_plans');
    }
};
