<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\CampaignDocument;
use App\Models\CampaignFinancialMovement;
use App\Models\CampaignMilestone;
use App\Models\CampaignUpdate;
use App\Models\Comment;
use App\Models\Investment;
use App\Models\Notification;
use App\Models\NotificationType;
use App\Models\User;

class Notifier
{
    /**
     * Send a notification to a specific user.
     */
    public function send(
        string $userId,
        string $code,
        string $title,
        string $body,
        ?string $campaignId = null,
        ?string $referenceType = 'campaign',
        ?string $actionUrl = null,
        array $data = [],
        string $channel = 'in_app'
    ): ?Notification {
        $user = User::find($userId);
        if (! $user) {
            return null;
        }

        // Check user notification preferences if configured
        $prefs = $user->notification_preferences ?? [];
        if (! empty($prefs)) {
            if (isset($prefs['inAppEnabled']) && ! $prefs['inAppEnabled'] && $channel === 'in_app') {
                return null;
            }
            if (isset($prefs['categories'][$code]) && ! $prefs['categories'][$code]) {
                return null;
            }
        }

        $typeId = null;
        try {
            $notifType = NotificationType::firstOrCreate(
                ['code' => $code],
                ['name' => ucwords(str_replace('_', ' ', $code))]
            );
            $typeId = $notifType->id;
        } catch (\Throwable $e) {
            // Keep going if notification_types table write fails
        }

        $url = $actionUrl ?: ($campaignId ? '/campaign/'.$campaignId : null);
        $refType = $referenceType ?: ($campaignId ? 'campaign' : null);
        $refId = $campaignId;

        return Notification::create([
            'user_id' => $userId,
            'type_id' => $typeId,
            'type_code' => $code,
            'title' => $title,
            'body' => $body,
            'channel' => $channel,
            'is_read' => false,
            'action_url' => $url,
            'reference_type' => $refType,
            'reference_id' => $refId,
            'data' => $data,
        ]);
    }

    /**
     * Send a notification to multiple users simultaneously.
     */
    public function sendToMany(
        iterable $userIds,
        string $code,
        string $title,
        string $body,
        ?string $campaignId = null,
        ?string $referenceType = 'campaign',
        ?string $actionUrl = null,
        array $data = []
    ): int {
        $count = 0;
        foreach ($userIds as $userId) {
            if ($this->send($userId, $code, $title, $body, $campaignId, $referenceType, $actionUrl, $data)) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Notify campaign creator about campaign status change.
     */
    public function campaignStatusChanged(Campaign $campaign, string $newStatus, ?string $feedback = null): ?Notification
    {
        if (! $campaign->creator_id) {
            return null;
        }

        $statusLabels = [
            'in_review' => 'en revisión',
            'approved' => 'aprobada',
            'rejected' => 'rechazada',
            'published' => 'publicada',
            'suspended' => 'suspendida',
            'cancelled' => 'cancelada',
            'funded' => 'financiada con éxito',
            'completed' => 'completada',
        ];

        $label = $statusLabels[$newStatus] ?? $newStatus;
        $feedbackText = ! empty($feedback) ? ". Motivo: {$feedback}" : '';

        return $this->send(
            $campaign->creator_id,
            'campaign_'.$newStatus,
            "Campaña {$label}",
            "Tu campaña '{$campaign->title}' ha cambiado de estado a {$label}{$feedbackText}.",
            $campaign->id
        );
    }

    /**
     * Notify an investor that their investment was successfully registered.
     */
    public function investmentConfirmed(Investment $investment): ?Notification
    {
        $campaign = $investment->campaign;

        return $this->send(
            $investment->investor_id,
            'investment_confirmed',
            'Inversión confirmada',
            "Tu aporte de {$investment->amount} {$investment->currency} a '{$campaign?->title}' fue procesado con éxito.",
            $campaign?->id
        );
    }

    /**
     * Notify campaign creator of a new contribution.
     */
    public function investmentReceived(Campaign $campaign, float $amount, ?string $investorName = null): ?Notification
    {
        if (! $campaign->creator_id) {
            return null;
        }

        $from = $investorName ? " de {$investorName}" : '';

        return $this->send(
            $campaign->creator_id,
            'investment_received',
            'Nuevo aporte recibido',
            "Tu proyecto '{$campaign->title}' recibió una nueva contribución{$from} de {$campaign->currency} {$amount}.",
            $campaign->id
        );
    }

    /**
     * Notify all completed campaign investors about a published update.
     */
    public function campaignUpdatePublished(Campaign $campaign, CampaignUpdate $update): int
    {
        $investorIds = $campaign->investments()
            ->where('status', 'completed')
            ->pluck('investor_id')
            ->unique();

        return $this->sendToMany(
            $investorIds,
            'campaign_update',
            'Nuevo avance de campaña',
            "{$campaign->title}: {$update->title}",
            $campaign->id
        );
    }

    /**
     * Notify all completed campaign investors about a completed milestone.
     */
    public function milestoneCompleted(Campaign $campaign, CampaignMilestone $milestone): int
    {
        $investorIds = $campaign->investments()
            ->where('status', 'completed')
            ->pluck('investor_id')
            ->unique();

        return $this->sendToMany(
            $investorIds,
            'milestone_completed',
            'Hito de campaña completado',
            "{$campaign->title} ha completado el hito: {$milestone->title}",
            $campaign->id
        );
    }

    /**
     * Notify campaign creator about a new comment.
     */
    public function commentPosted(Campaign $campaign, Comment $comment, User $author): ?Notification
    {
        if (! $campaign->creator_id || $campaign->creator_id === $author->id) {
            return null;
        }

        $authorProfile = $author->entrepreneur ?? $author->investor;
        $name = $authorProfile ? trim(($authorProfile->first_name ?? '').' '.($authorProfile->last_name ?? '')) : $author->email;
        $preview = mb_substr($comment->content, 0, 100);

        return $this->send(
            $campaign->creator_id,
            'new_comment',
            'Nuevo comentario en tu campaña',
            "{$name} comentó en '{$campaign->title}': {$preview}",
            $campaign->id
        );
    }
}
