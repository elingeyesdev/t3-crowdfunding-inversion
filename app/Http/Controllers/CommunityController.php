<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Comment;
use App\Models\Notification;
use App\Support\Api;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class CommunityController extends Controller
{
    private function commentData(Comment $c, ?string $userId): array
    {
        $p = $c->author?->entrepreneur ?? $c->author?->investor;

        return ['id' => $c->id, 'campaignId' => $c->campaign_id, 'authorId' => $c->author_id, 'authorName' => $p?->display_name ?? trim(($p?->first_name ?? 'Usuario').' '.($p?->last_name ?? '')), 'authorAvatar' => $p?->avatar_url, 'content' => $c->content, 'likesCount' => $c->likes()->count(), 'likedByMe' => $userId ? $c->likes()->where('user_id', $userId)->exists() : false, 'createdAt' => $c->created_at];
    }

    public function comments(Request $r, Campaign $campaign)
    {
        abort_unless(in_array($campaign->status, Campaign::PUBLIC_STATUSES), 404);
        $userId = Auth::guard('sanctum')->user()?->id;

        return Api::ok(Comment::with(['author.entrepreneur', 'author.investor'])->where('campaign_id', $campaign->id)->latest()->limit(200)->get()->map(fn ($c) => $this->commentData($c, $userId)));
    }

    public function postComment(Request $r, Campaign $campaign)
    {
        abort_unless(in_array($campaign->status, Campaign::PUBLIC_STATUSES), 404);
        $data = $r->validate(['content' => 'required|string|min:1|max:5000']);
        $comment = Comment::create(['campaign_id' => $campaign->id, 'author_id' => $r->user()->id, 'content' => $data['content']]);

        return Api::ok($this->commentData($comment, $r->user()->id), 201);
    }

    public function like(Request $r, Campaign $campaign, Comment $comment)
    {
        abort_unless($comment->campaign_id === $campaign->id && in_array($campaign->status, Campaign::PUBLIC_STATUSES), 404);

        return DB::transaction(function () use ($r, $comment) {
            $comment = Comment::whereKey($comment->id)->lockForUpdate()->firstOrFail();
            $liked = $comment->likes()->where('user_id', $r->user()->id)->exists();
            if ($liked) {
                $comment->likes()->detach($r->user()->id);
            } else {
                $comment->likes()->attach($r->user()->id);
            }

            return Api::ok(['liked' => ! $liked, 'likesCount' => $comment->likes()->count()]);
        });
    }

    public function notifications(Request $r)
    {
        $q = Notification::where('user_id', $r->user()->id);

        return Api::ok(['notifications' => (clone $q)->latest()->limit(100)->get(), 'unreadCount' => $q->where('is_read', false)->count()]);
    }

    public function read(Request $r, Notification $notification)
    {
        abort_unless($notification->user_id === $r->user()->id, 404);
        $notification->update(['is_read' => true, 'read_at' => now()]);

        return Api::ok();
    }

    public function readAll(Request $r)
    {
        Notification::where('user_id', $r->user()->id)->where('is_read', false)->update(['is_read' => true, 'read_at' => now()]);

        return Api::ok();
    }
}
