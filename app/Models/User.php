<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasUuids, \Illuminate\Database\Eloquent\Factories\HasFactory;

    protected $guarded = ['id'];

    protected $hidden = ['password_hash', 'remember_token', 'oauth_provider_id'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'email_verified' => 'boolean', 'phone_verified' => 'boolean', 'last_login_at' => 'datetime'];
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    public function roles()
    {
        return $this->belongsToMany(Role::class, 'user_roles');
    }

    public function entrepreneur()
    {
        return $this->hasOne(EntrepreneurProfile::class);
    }

    public function investor()
    {
        return $this->hasOne(InvestorProfile::class);
    }

    public function admin()
    {
        return $this->hasOne(AdminProfile::class);
    }

    public function assignRole(string $name): void
    {
        $role = Role::firstOrCreate(['name' => $name], ['display_name' => $name]);
        if (! $this->roles()->whereKey($role->id)->exists()) {
            $this->roles()->attach($role->id, ['id' => (string) Str::uuid(), 'created_at' => now()]);
        }
        $this->unsetRelation('roles');
    }

    public function apiData(): array
    {
        return [...$this->toArray(), 'roles' => $this->roles()->pluck('name')->all(), 'admin_access_level' => $this->admin?->access_level];
    }
}
