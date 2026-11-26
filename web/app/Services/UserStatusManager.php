<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserStatusHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

class UserStatusManager
{
    public function canManage(User $actor, User $target): bool
    {
        $actor->loadMissing(['roles', 'admin']);
        $target->loadMissing(['roles', 'admin']);
        $super = $actor->roles->contains('name', 'super_admin');
        $admin = $actor->roles->contains('name', 'admin');
        if (! $actor->is_active || (! $super && ! $admin) || $actor->id === $target->id) {
            return false;
        }
        if ($actor->admin && (! $actor->admin->is_active || ! $actor->admin->can_manage_users)) {
            return false;
        }
        if ($target->roles->contains('name', 'super_admin') || $target->admin?->access_level === 'super_admin') {
            return false;
        }
        $targetAdmin = $target->roles->contains('name', 'admin') || $target->admin !== null;

        return $super || ! $targetAdmin;
    }

    public function data(User $actor, User $target): array
    {
        $allowed = $this->canManage($actor, $target);

        return ['id' => $target->id, 'email' => $target->email, 'created_at' => $target->created_at,
            'is_active' => (bool) $target->is_active, 'status_version' => (int) $target->status_version,
            'can_suspend' => $allowed && $target->is_active, 'can_reactivate' => $allowed && ! $target->is_active,
            'can_view_history' => $allowed];
    }

    public function change(Request $request, User $target, bool $active, string $reason, ?int $expectedVersion): array
    {
        return DB::transaction(function () use ($request, $target, $active, $reason, $expectedVersion) {
            // Stable lock order also covers concurrent administrative requests.
            $users = User::whereIn('id', [$request->user()->id, $target->id])->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $actor = $users->get($request->user()->id);
            $target = $users->get($target->id);
            abort_unless($actor && $target, 404);
            $token = $request->user()->currentAccessToken();
            $current = $token instanceof PersonalAccessToken ? $actor->tokens()->whereKey($token->getKey())->first() : null;
            abort_unless($actor->is_active && $current && (! $current->expires_at || $current->expires_at->isFuture()), 401, 'La sesión ya no está disponible. Inicia sesión nuevamente.');
            abort_unless($this->canManage($actor, $target), 403, 'No tienes permisos para modificar el estado de esta cuenta.');
            // A response lost in transit can be retried without a second audit or token revocation.
            if ((bool) $target->is_active === $active) {
                return $this->data($actor, $target);
            }
            abort_if($expectedVersion !== null && $expectedVersion !== (int) $target->status_version, 409, 'La cuenta cambió desde que abriste el diálogo. Ciérralo y actualiza la lista antes de intentarlo nuevamente.');
            $before = (bool) $target->is_active;
            $version = (int) $target->status_version + 1;
            $target->update(['is_active' => $active, 'status_version' => $version, 'remember_token' => Str::random(60)]);
            $target->tokens()->delete();
            DB::table('sessions')->where('user_id', $target->id)->delete();
            UserStatusHistory::create(['user_id' => $target->id, 'actor_id' => $actor->id, 'from_active' => $before,
                'to_active' => $active, 'version' => $version, 'reason' => $reason, 'created_at' => now()]);

            return $this->data($actor, $target);
        }, 3);
    }
}
