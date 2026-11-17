<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\Api;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;
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
        if (! $user || ! $this->passwordMatches($user, $data['password'])) {
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

    private function passwordMatches(User $user, string $password): bool
    {
        $hash = $user->password_hash;
        // Preserve verification of bcrypt hashes created by the previous backend.
        if ($hash && (str_starts_with($hash, '$2b$') || str_starts_with($hash, '$2a$'))) {
            $hash = '$2y$'.substr($hash, 4);
        }

        return $hash && Hash::check($password, $hash);
    }

    public function changePassword(Request $r)
    {
        $data = $r->validate([
            'currentPassword' => ['required', 'string', 'max:128'],
            'newPassword' => ['required', 'string', 'min:8', 'max:128', 'regex:/^(?=.*[A-Z])(?=.*\d).+$/'],
        ], [
            'currentPassword.required' => 'Ingresa tu contraseña actual.',
            'currentPassword.string' => 'La contraseña actual debe ser un texto.',
            'currentPassword.max' => 'La contraseña actual no puede superar los 128 caracteres.',
            'newPassword.required' => 'Ingresa una nueva contraseña.',
            'newPassword.string' => 'La nueva contraseña debe ser un texto.',
            'newPassword.min' => 'La nueva contraseña debe tener al menos 8 caracteres.',
            'newPassword.max' => 'La nueva contraseña no puede superar los 128 caracteres.',
            'newPassword.regex' => 'La nueva contraseña debe tener al menos una mayúscula y un número.',
        ]);

        return DB::transaction(function () use ($r, $data) {
            $user = User::whereKey($r->user()->id)->lockForUpdate()->firstOrFail();
            abort_unless($user->is_active, 401, 'Usuario inactivo.');
            // The app authenticates with bearer tokens. Recheck under the user
            // lock so a concurrently revoked token cannot change the password.
            $token = $r->user()->currentAccessToken();
            abort_unless($token instanceof PersonalAccessToken, 401, 'Inicia sesión nuevamente para cambiar tu contraseña.');
            $current = $user->tokens()->whereKey($token->getKey())->lockForUpdate()->first();
            abort_unless($current && (! $current->expires_at || $current->expires_at->isFuture()), 401, 'La sesión ya no está disponible.');
            if (! $user->password_hash) {
                throw ValidationException::withMessages(['currentPassword' => 'Esta cuenta no tiene contraseña local. Utiliza el inicio de sesión con Google.']);
            }
            if (! $this->passwordMatches($user, $data['currentPassword'])) {
                throw ValidationException::withMessages(['currentPassword' => 'La contraseña actual no es correcta.']);
            }
            if ($this->passwordMatches($user, $data['newPassword'])) {
                throw ValidationException::withMessages(['newPassword' => 'La nueva contraseña debe ser diferente de la actual.']);
            }

            $user->update(['password_hash' => Hash::make($data['newPassword']), 'remember_token' => Str::random(60)]);
            $user->tokens()->whereKeyNot($current->getKey())->delete();
            // Other browser sessions must also authenticate again. The current
            // bearer session is retained above with its original expiration.
            DB::table('sessions')->where('user_id', $user->id)->delete();

            return Api::ok(['otherSessionsRevoked' => true]);
        });
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
