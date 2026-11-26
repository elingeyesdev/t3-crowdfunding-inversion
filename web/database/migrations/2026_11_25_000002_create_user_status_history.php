<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->unsignedInteger('status_version')->default(0));
        Schema::create('user_status_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained('users')->restrictOnDelete();
            $table->uuid('actor_id')->index();
            $table->boolean('from_active');
            $table->boolean('to_active');
            $table->unsignedInteger('version');
            $table->text('reason');
            $table->timestamp('created_at');
            $table->unique(['user_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_status_history');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('status_version'));
    }
};
