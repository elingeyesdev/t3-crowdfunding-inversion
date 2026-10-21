<?php

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('users.{id}', fn (User $user, string $id) => $user->is_active && $user->id === $id, ['guards' => ['sanctum']]);
Broadcast::channel('conversations.{id}', fn (User $user, string $id) => $user->is_active && (Conversation::find($id)?->contains($user->id) ?? false), ['guards' => ['sanctum']]);
