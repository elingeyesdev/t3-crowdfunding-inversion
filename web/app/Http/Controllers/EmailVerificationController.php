<?php

namespace App\Http\Controllers;

use App\Jobs\SendEmailVerification;
use App\Models\User;
use App\Support\Api;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;

class EmailVerificationController extends Controller
{
    public function send(Request $request)
    {
        $user = $request->user();
        if ($user->email_verified) {
            return Api::ok(['emailVerified' => true, 'message' => 'Tu correo ya está verificado.']);
        }
        $connection = config('email_verification.connection');
        abort_if(config('queue.connections.'.$connection.'.driver') === 'sync', 503, 'La verificación no está disponible temporalmente.');
        try {
            Bus::dispatch((new SendEmailVerification($user->id, $user->email))
                ->onConnection($connection)->onQueue(config('email_verification.queue')));
        } catch (\Throwable $error) {
            report($error);
            abort(503, 'La verificación no está disponible temporalmente.');
        }

        return Api::ok(['emailVerified' => false, 'message' => 'Solicitud recibida. Revisa tu correo para encontrar el enlace de verificación.'], 202);
    }

    public function confirm(Request $request, string $id, string $hash)
    {
        abort_unless($request->hasValidRelativeSignature(), 422, 'El enlace no es válido o ha caducado. Solicita uno nuevo.');

        return DB::transaction(function () use ($request, $id, $hash) {
            $user = User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            abort_unless($user->is_active, 401, 'Usuario inactivo.');
            if (! hash_equals($user->id, $id) || ! hash_equals(sha1($user->email), $hash)) {
                return response()->json(['code' => 'EMAIL_VERIFICATION_MISMATCH', 'message' => 'Este enlace no corresponde al correo de tu cuenta. Inicia sesión con la cuenta correcta o solicita un enlace nuevo.'], 403);
            }
            if (! $user->email_verified) {
                $user->update(['email_verified' => true]);
                DB::afterCommit(fn () => event(new Verified($user)));
            }

            return Api::ok(['emailVerified' => true, 'message' => 'Tu correo fue verificado correctamente.']);
        });
    }
}
