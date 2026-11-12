<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RequireRole
{
    public function handle(Request $request, Closure $next, string ...$roles)
    {
        abort_unless($request->user()?->roles()->whereIn('name', $roles)->exists(), 403, 'No autorizado.');

        return $next($request);
    }
}
