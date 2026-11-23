<?php

namespace App\Http\Controllers;

use App\Jobs\SendPasswordResetLink;
use App\Models\User;
use App\Support\Api;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Support\Timebox;
use Illuminate\Validation\ValidationException;

class PasswordRecoveryController extends Controller
{
    public function requestLink(Request $request)
    {
        $this->normalizeEmail($request);
        $data = $request->validate(['email' => 'required|string|email|max:255']);
        $connection = config('password_recovery.connection');
        // All valid addresses take the same asynchronous path, including unknown,
        // inactive and Google-only accounts. Sync delivery would reveal failures.
        abort_if(config('queue.connections.'.$connection.'.driver') === 'sync', 503, 'La recuperación no está disponible temporalmente. Intenta nuevamente.');
        try {
            Bus::dispatch((new SendPasswordResetLink($data['email']))
                ->onConnection($connection)->onQueue(config('password_recovery.queue')));
        } catch (\Throwable $error) {
            report($error);
            abort(503, 'La recuperación no está disponible temporalmente. Intenta nuevamente.');
        }

        return Api::ok(['message' => 'Si existe una cuenta que puede recuperar su acceso, recibirás las instrucciones por correo.'], 202);
    }

    public function reset(Request $request)
    {
        $this->normalizeEmail($request);
        $data = $request->validate([
            'email' => 'required|string|email|max:255',
            'token' => 'required|string|max:256',
            'password' => ['required', 'string', 'min:8', 'max:128', 'regex:/^(?=.*[A-Z])(?=.*\d).+$/', 'confirmed'],
            'password_confirmation' => 'required|string|max:128',
        ], [
            'password.min' => 'La contraseña debe tener al menos 8 caracteres.',
            'password.max' => 'La contraseña no puede superar los 128 caracteres.',
            'password.regex' => 'La contraseña debe tener al menos una mayúscula y un número.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
        ]);

        return (new Timebox)->call(function () use ($data) {
            DB::transaction(function () use ($data) {
                $user = User::where('email', $data['email'])->lockForUpdate()->first();
                if (! $user || ! $user->is_active || ! $user->password_hash) {
                    $this->invalidToken();
                }
                $result = Password::broker()->reset($data, function (User $user, string $password) {
                    $user->forceFill(['password_hash' => Hash::make($password), 'remember_token' => Str::random(60)])->save();
                    $user->tokens()->delete();
                    DB::table('sessions')->where('user_id', $user->id)->delete();
                    DB::afterCommit(fn () => event(new PasswordReset($user)));
                });
                if ($result !== Password::PASSWORD_RESET) {
                    $this->invalidToken();
                }
            }, 3);

            return Api::ok(['message' => 'Tu contraseña fue actualizada. Inicia sesión con la nueva contraseña.', 'sessionsRevoked' => true]);
        }, 200000);
    }

    private function normalizeEmail(Request $request): void
    {
        if (is_string($request->input('email'))) {
            $request->merge(['email' => strtolower(trim($request->input('email')))]);
        }
    }

    private function invalidToken(): never
    {
        throw ValidationException::withMessages(['token' => 'El enlace no es válido o ha caducado. Solicita uno nuevo.']);
    }
}
