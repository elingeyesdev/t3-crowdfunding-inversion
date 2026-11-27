<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_documents', function (Blueprint $table) {
            $table->uuid('upload_key')->nullable();
            $table->string('upload_fingerprint', 64)->nullable();
            $table->unique(['campaign_id', 'upload_key']);
        });
    }

    public function down(): void
    {
        Schema::table('campaign_documents', function (Blueprint $table) {
            $table->dropUnique(['campaign_id', 'upload_key']);
            $table->dropColumn(['upload_key', 'upload_fingerprint']);
        });
    }
};
