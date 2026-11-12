<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('name', 50)->unique();
            $t->string('display_name')->nullable();
            $t->text('description')->nullable();
            $t->boolean('is_active')->default(true);
            $t->timestamps();
        });
        Schema::create('users', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('email')->unique();
            $t->string('password_hash')->nullable();
            $t->string('phone', 20)->nullable();
            $t->string('timezone')->default('America/La_Paz');
            $t->string('preferred_language', 10)->default('es');
            foreach (['email_verified', 'phone_verified'] as $f) {
                $t->boolean($f)->default(false);
            }
            $t->boolean('is_active')->default(true);
            $t->string('oauth_provider')->nullable();
            $t->string('oauth_provider_id')->nullable();
            $t->text('avatar_url')->nullable();
            $t->timestamp('last_login_at')->nullable();
            $t->string('last_login_ip', 45)->nullable();
            $t->integer('failed_login_attempts')->default(0);
            $t->timestamp('locked_until')->nullable();
            $t->rememberToken();
            $t->timestamps();
            $t->unique(['oauth_provider', 'oauth_provider_id']);
        });
        Schema::create('user_roles', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $t->foreignUuid('role_id')->constrained()->cascadeOnDelete();
            $t->timestamp('created_at')->nullable();
            $t->unique(['user_id', 'role_id']);
        });
        Schema::create('personal_access_tokens', function (Blueprint $t) {
            $t->id();
            $t->uuidMorphs('tokenable');
            $t->string('name');
            $t->string('token', 64)->unique();
            $t->text('abilities')->nullable();
            $t->timestamp('last_used_at')->nullable();
            $t->timestamp('expires_at')->nullable()->index();
            $t->timestamps();
        });
        Schema::create('sessions', function (Blueprint $t) {
            $t->string('id')->primary();
            $t->uuid('user_id')->nullable()->index();
            $t->string('ip_address', 45)->nullable();
            $t->text('user_agent')->nullable();
            $t->longText('payload');
            $t->integer('last_activity')->index();
        });
        Schema::create('password_reset_tokens', function (Blueprint $t) {
            $t->string('email')->primary();
            $t->string('token');
            $t->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        foreach (['password_reset_tokens', 'sessions', 'personal_access_tokens', 'user_roles', 'users', 'roles'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
