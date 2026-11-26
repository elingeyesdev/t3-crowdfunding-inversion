<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RequireVerifiedEmail
{
    public function handle(Request $request, Closure $next)
    {
        if (! $request->user()?->email_verified) {
            return response()->json([
                'message' => 'Verifica tu correo desde Configuración de Cuenta para realizar aportes y enviar o publicar campañas.',
                'code' => 'EMAIL_VERIFICATION_REQUIRED',
            ], 403);
        }

        return $next($request);
    }
}
