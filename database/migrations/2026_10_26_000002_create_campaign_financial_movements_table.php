<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('campaign_financial_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('campaign_id')->constrained('campaigns')->cascadeOnDelete();
            $table->foreignUuid('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 20); // 'income' or 'expense'
            $table->string('concept', 200);
            $table->string('category', 150);
            $table->decimal('amount', 15, 2);
            $table->string('currency', 10)->default('BOB');
            $table->date('movement_date');
            $table->string('reference_number', 100)->nullable(); // Factura, recibo, comprobante
            $table->string('receipt_url', 512)->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 50)->default('verified'); // verified, pending, audited
            $table->timestamps();

            $table->index(['campaign_id', 'type']);
            $table->index(['campaign_id', 'movement_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaign_financial_movements');
    }
};
