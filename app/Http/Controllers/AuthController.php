<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Api;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    public function register(Request $r)
    {
        if (is_string($r->input('email'))) {
            $r->merge(['email' => strtolower($r->input('email'))]);
        }
        $data = $r->validate(['email' => 'required|email|max:255|unique:users,email', 'password' => ['required', 'string', 'min:8', 'max:128', 'regex:/^(?=.*[A-Z])(?=.*\d).+$/'], 'phone' => 'nullable|string|max:20', 'preferredLanguage' => 'sometimes|in:es,en', 'signupRole' => 'sometimes|in:investor,entrepreneur']);
        $user = DB::transaction(function () use ($data) {
            $user = User::create(['email' => strtolower($data['email']), 'password_hash' => Hash::make($data['password']), 'phone' => $data['phone'] ?? null, 'preferred_language' => $data['preferredLanguage'] ?? 'es']);
            $user->assignRole($data['signupRole'] ?? 'investor');

            return $user;
        });

        return Api::ok($user->apiData(), 201);
    }

    public function login(Request $r)
    {
        $data = $r->validate(['email' => 'required|email', 'password' => 'required|string']);
        $user = User::where('email', strtolower($data['email']))->first();
        // Node bcrypt writes $2b$; PHP's strict BcryptHasher expects $2y$.
        // The variant marker is normalized only for verification, preserving the stored hash.
        $hash = $user?->password_hash;
        if ($hash && (str_starts_with($hash, '$2b$') || str_starts_with($hash, '$2a$'))) {
            $hash = '$2y$'.substr($hash, 4);
        }
        if (! $user || ! $hash || ! Hash::check($data['password'], $hash)) {
            $user?->increment('failed_login_attempts');
            abort(401, 'Credenciales inválidas');
        }
        abort_unless($user->is_active, 401, 'Usuario inactivo');
        $user->update(['last_login_at' => now(), 'last_login_ip' => $r->ip(), 'failed_login_attempts' => 0]);
        if (! $user->roles()->exists()) {
            if ($user->entrepreneur()->exists()) {
                $user->assignRole('entrepreneur');
            } elseif ($user->investor()->exists()) {
                $user->assignRole('investor');
            }
        }

        return Api::ok($this->sessionData($user));
    }

    public function sessionData(User $user): array
    {
        return ['accessToken' => $user->createToken('web', ['*'], now()->addDay())->plainTextToken, 'tokenType' => 'Bearer', 'expiresIn' => '24h', 'user' => $user->apiData()];
    }

    public function me(Request $r)
    {
        return Api::ok($r->user()->apiData());
    }

    public function logout(Request $r)
    {
        $r->user()->currentAccessToken()?->delete();

        return Api::ok();
    }

    public function show(Request $r, string $id)
    {
        abort_unless($r->user()->id === $id || $r->user()->roles()->whereIn('name', ['admin', 'super_admin'])->exists(), 403);

        return Api::ok(User::findOrFail($id)->apiData());
    }

    public function google(Request $r)
    {
        abort_unless(config('services.google.client_id'), 503, 'Google OAuth no está configurado.');
        $r->session()->put('signup_role', $r->input('role') === 'entrepreneur' ? 'entrepreneur' : 'investor');

        return Socialite::driver('google')->redirect();
    }

    public function googleCallback(Request $r)
    {
        $google = Socialite::driver('google')->user();
        abort_unless($google->user['email_verified'] ?? false, 403, 'Google no verificó el correo.');
        $user = DB::transaction(function () use ($google, $r) {
            $user = User::where('email', $google->getEmail())->first();
            if (! $user) {
                $user = User::create(['email' => $google->getEmail(), 'email_verified' => true, 'avatar_url' => $google->getAvatar(), 'oauth_provider' => 'google', 'oauth_provider_id' => $google->getId()]);
                $user->assignRole($r->session()->pull('signup_role', 'investor'));
            } elseif (! $user->oauth_provider) {
                $user->update(['oauth_provider' => 'google', 'oauth_provider_id' => $google->getId(), 'email_verified' => true]);
            }
            abort_unless($user->is_active, 401, 'Usuario inactivo.');

            return $user;
        });
        $role = $user->roles()->where('name', 'entrepreneur')->exists() ? 'entrepreneur' : 'investor';

        return redirect('/auth/callback?'.http_build_query(['token' => $this->sessionData($user)['accessToken'], 'userId' => $user->id, 'role' => $role]));
    }
}
