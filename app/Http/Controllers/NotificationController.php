<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Support\Api;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    private function notificationData(Notification $n): array
    {
        return [
            'id' => $n->id,
            'userId' => $n->user_id,
            'typeId' => $n->type_id,
            'typeCode' => $n->type_code,
            'title' => $n->title,
            'body' => $n->body,
            'channel' => $n->channel,
            'isRead' => (bool) $n->is_read,
            'readAt' => $n->read_at?->toIso8601String(),
            'actionUrl' => $n->action_url,
            'referenceType' => $n->reference_type,
            'referenceId' => $n->reference_id,
            'data' => $n->data ?? [],
            'createdAt' => $n->created_at?->toIso8601String(),
            'updatedAt' => $n->updated_at?->toIso8601String(),
        ];
    }

    public function index(Request $r)
    {
        $userId = $r->user()->id;
        $q = Notification::where('user_id', $userId);

        if ($r->has('unread') || $r->has('unreadOnly')) {
            $unreadFilter = $r->boolean('unread', $r->boolean('unreadOnly'));
            if ($unreadFilter) {
                $q->where('is_read', false);
            }
        }

        if ($r->filled('type') || $r->filled('typeCode')) {
            $type = $r->input('type', $r->input('typeCode'));
            $q->where('type_code', $type);
        }

        if ($r->filled('q')) {
            $term = '%'.$r->input('q').'%';
            $q->where(function ($sub) use ($term) {
                $sub->where('title', 'like', $term)
                    ->orWhere('body', 'like', $term);
            });
        }

        $unreadCount = Notification::where('user_id', $userId)->where('is_read', false)->count();

        $page = max(1, (int) $r->input('page', 1));
        $perPage = min(100, max(1, (int) $r->input('perPage', $r->input('limit', 20))));
        $total = (clone $q)->count();
        $totalPages = max(1, (int) ceil($total / $perPage));

        $notifications = $q->latest()->forPage($page, $perPage)->get()
            ->map(fn ($n) => $this->notificationData($n));

        return Api::ok([
            'notifications' => $notifications,
            'unreadCount' => $unreadCount,
            'total' => $total,
            'page' => $page,
            'perPage' => $perPage,
            'totalPages' => $totalPages,
        ]);
    }

    public function unreadCount(Request $r)
    {
        $count = Notification::where('user_id', $r->user()->id)->where('is_read', false)->count();

        return Api::ok(['unreadCount' => $count]);
    }

    public function show(Request $r, Notification $notification)
    {
        abort_unless($notification->user_id === $r->user()->id, 404);

        return Api::ok($this->notificationData($notification));
    }

    public function markAsRead(Request $r, Notification $notification)
    {
        abort_unless($notification->user_id === $r->user()->id, 404);
        $notification->update(['is_read' => true, 'read_at' => now()]);

        return Api::ok($this->notificationData($notification->fresh()));
    }

    public function markAllAsRead(Request $r)
    {
        $q = Notification::where('user_id', $r->user()->id)->where('is_read', false);

        if ($r->filled('type') || $r->filled('typeCode')) {
            $type = $r->input('type', $r->input('typeCode'));
            $q->where('type_code', $type);
        }

        $updatedCount = $q->update(['is_read' => true, 'read_at' => now()]);

        return Api::ok([
            'updatedCount' => $updatedCount,
            'unreadCount' => 0,
        ]);
    }

    public function destroy(Request $r, Notification $notification)
    {
        abort_unless($notification->user_id === $r->user()->id, 404);
        $notification->delete();

        return Api::ok();
    }

    public function clearRead(Request $r)
    {
        $deletedCount = Notification::where('user_id', $r->user()->id)
            ->where('is_read', true)
            ->delete();

        return Api::ok(['deletedCount' => $deletedCount]);
    }

    public function preferences(Request $r)
    {
        $defaultPreferences = [
            'inAppEnabled' => true,
            'emailEnabled' => true,
            'campaignStatusUpdates' => true,
            'investmentAlerts' => true,
            'commentAlerts' => true,
            'milestoneUpdates' => true,
        ];

        $current = $r->user()->notification_preferences ?? [];

        return Api::ok(array_merge($defaultPreferences, $current));
    }

    public function updatePreferences(Request $r)
    {
        $data = $r->validate([
            'inAppEnabled' => 'sometimes|boolean',
            'emailEnabled' => 'sometimes|boolean',
            'campaignStatusUpdates' => 'sometimes|boolean',
            'investmentAlerts' => 'sometimes|boolean',
            'commentAlerts' => 'sometimes|boolean',
            'milestoneUpdates' => 'sometimes|boolean',
            'categories' => 'sometimes|array',
        ]);

        $current = $r->user()->notification_preferences ?? [];
        $merged = array_merge($current, $data);

        $r->user()->update(['notification_preferences' => $merged]);

        return Api::ok($merged);
    }
}
