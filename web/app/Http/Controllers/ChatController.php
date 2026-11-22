<?php

namespace App\Http\Controllers;

use App\Events\ChatMessageSent;
use App\Models\Campaign;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Support\Api;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChatController extends Controller
{
    public static function userData(User $user): array
    {
        $p = $user->entrepreneur ?? $user->investor;

        return ['id' => $user->id, 'email' => $user->email, 'firstName' => $p?->first_name, 'lastName' => $p?->last_name, 'avatar' => $p?->avatar_url ?? $user->avatar_url, 'fullName' => trim(($p?->first_name ?? '').' '.($p?->last_name ?? '')) ?: $user->email];
    }

    public static function messageData(Message $message): array
    {
        return [...Api::camel($message->attributesToArray()), 'sender' => self::userData($message->sender)];
    }

    private function member(Request $r, Conversation $c): void
    {
        abort_unless($c->contains($r->user()->id), 403, 'No perteneces a esta conversación.');
    }

    private function canReadCampaign(User $user, Campaign $campaign): bool
    {
        return $campaign->creator_id === $user->id
            || $campaign->isPubliclyReadable()
            || $user->roles()->whereIn('name', ['admin', 'super_admin'])->exists();
    }

    public function index(Request $r)
    {
        $id = $r->user()->id;

        return Api::ok(Conversation::with('campaign')->where(fn ($q) => $q->where('user_one_id', $id)->orWhere('user_two_id', $id))->orderByDesc('last_message_at')->get()->map(function ($c) use ($id, $r) {
            $other = User::findOrFail($c->user_one_id === $id ? $c->user_two_id : $c->user_one_id);
            $readAt = $c->user_one_id === $id ? $c->user_one_read_at : $c->user_two_read_at;
            $readMessageId = $c->user_one_id === $id ? $c->user_one_read_message_id : $c->user_two_read_message_id;
            $readMessage = $readMessageId ? $c->messages()->find($readMessageId) : null;
            $last = $c->messages()->latest('created_at')->latest('id')->first();
            $unread = $c->messages()->where('sender_id', '!=', $id);
            if ($readMessage) {
                $unread->where(fn ($q) => $q->where('created_at', '>', $readMessage->created_at)
                    ->orWhere(fn ($sameSecond) => $sameSecond->where('created_at', $readMessage->created_at)->where('id', '>', $readMessage->id)));
            } elseif ($readAt) {
                $unread->where('created_at', '>', $readAt);
            }

            // Existing chats survive visibility changes. Do not expose their
            // campaign or subject (which may contain its title) to this viewer.
            $campaign = $c->campaign && $this->canReadCampaign($r->user(), $c->campaign) ? $c->campaign : null;
            $subject = $c->campaign_id && ! $campaign ? null : $c->subject;

            return ['id' => $c->id, 'subject' => $subject, 'campaignId' => $campaign?->id, 'campaignTitle' => $campaign?->title, 'campaignCover' => $campaign?->cover_image_url, 'status' => $c->status, 'lastMessageAt' => $c->last_message_at, 'messageCount' => $c->messages()->count(), 'unreadCount' => $unread->count(), 'otherUser' => self::userData($other), 'lastMessage' => $last ? ['content' => $last->content, 'createdAt' => $last->created_at, 'senderId' => $last->sender_id] : null];
        }));
    }

    public function store(Request $r)
    {
        $data = $r->validate(['otherUserId' => 'required|uuid|exists:users,id', 'campaignId' => 'nullable|uuid', 'subject' => 'nullable|string|max:255']);
        abort_if($data['otherUserId'] === $r->user()->id, 422, 'Elige otro usuario.');
        $other = User::whereKey($data['otherUserId'])->where('is_active', true)->first();
        abort_unless($other, 422, 'El usuario no está activo.');
        $ids = [$r->user()->id, $data['otherUserId']];
        sort($ids);
        // Lock a stable user row to serialize creation of an identical conversation.
        $c = DB::transaction(function () use ($ids, $data, $r, $other) {
            User::whereKey($ids[0])->lockForUpdate()->firstOrFail();

            if (! empty($data['campaignId'])) {
                $campaign = Campaign::whereKey($data['campaignId'])->lockForUpdate()->firstOrFail();
                // Permission of the sender alone must not disclose a private
                // campaign to a recipient who cannot read it. Recheck even if
                // the conversation already exists, under the campaign lock.
                abort_unless($this->canReadCampaign($r->user(), $campaign)
                    && $this->canReadCampaign($other, $campaign), 404);
            }

            return Conversation::firstOrCreate(['user_one_id' => $ids[0], 'user_two_id' => $ids[1], 'campaign_id' => $data['campaignId'] ?? null], ['subject' => $data['subject'] ?? null]);
        });

        return Api::ok(['id' => $c->id], 201);
    }

    public function messages(Request $r, Conversation $conversation)
    {
        $this->member($r, $conversation);
        $r->validate(['limit' => 'sometimes|integer|min:1|max:100', 'beforeId' => 'sometimes|uuid']);
        $q = $conversation->messages()->with('sender');
        if ($r->filled('beforeId')) {
            $before = $conversation->messages()->findOrFail($r->input('beforeId'));
            $q->where(fn ($q) => $q->where('created_at', '<', $before->created_at)->orWhere(fn ($q) => $q->where('created_at', $before->created_at)->where('id', '<', $before->id)));
        }

        return Api::ok($q->orderByDesc('created_at')->orderByDesc('id')->limit((int) $r->input('limit', 50))->get()->reverse()->values()->map(fn ($m) => self::messageData($m)));
    }

    public function send(Request $r, Conversation $conversation)
    {
        $this->member($r, $conversation);
        abort_unless($conversation->status === 'active', 422, 'Conversación cerrada.');
        $data = $r->validate(['content' => 'required|string|min:1|max:10000']);
        $message = DB::transaction(function () use ($r, $conversation, $data) {
            $c = Conversation::whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            $m = $c->messages()->create(['sender_id' => $r->user()->id, 'content' => $data['content']]);
            $c->update(['last_message_at' => now()]);

            return $m;
        });
        $payload = self::messageData($message);
        // The persisted message remains available via REST if the socket service is offline.
        try {
            event(new ChatMessageSent($payload, $conversation->user_one_id, $conversation->user_two_id));
        } catch (\Throwable $e) {
            report($e);
        }

        return Api::ok($payload, 201);
    }

    public function read(Request $r, Conversation $conversation)
    {
        $this->member($r, $conversation);
        DB::transaction(function () use ($r, $conversation) {
            // Serialize with send(), so a later message cannot be covered by this read.
            $current = Conversation::whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            $this->member($r, $current);
            $last = $current->messages()->orderByDesc('created_at')->orderByDesc('id')->first();
            $prefix = $current->user_one_id === $r->user()->id ? 'user_one' : 'user_two';
            $current->update([$prefix.'_read_at' => $last ? now() : null, $prefix.'_read_message_id' => $last?->id]);
        }, 3);

        return Api::ok();
    }
}
