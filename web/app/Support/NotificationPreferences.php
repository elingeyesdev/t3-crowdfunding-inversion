<?php

namespace App\Support;

use App\Models\User;

class NotificationPreferences
{
    public const CATEGORY_EVENTS = [
        'investmentAlerts' => ['investment_confirmed', 'investment_received', 'investment_refunded'],
        'commentAlerts' => ['new_comment', 'new_message'],
        'campaignStatusUpdates' => [
            'campaign_draft', 'campaign_pending_review', 'campaign_in_review', 'campaign_approved',
            'campaign_rejected', 'campaign_published', 'campaign_partially_funded', 'campaign_funded',
            'campaign_completed', 'campaign_failed', 'campaign_cancelled', 'campaign_suspended',
        ],
        'milestoneUpdates' => ['milestone_completed', 'campaign_update'],
    ];

    public static function allows(User $user, string $code, string $channel): bool
    {
        $prefs = $user->notification_preferences ?? [];
        if (! ($prefs[$channel === 'email' ? 'emailEnabled' : 'inAppEnabled'] ?? true)) {
            return false;
        }
        foreach (self::CATEGORY_EVENTS as $key => $events) {
            if (in_array($code, $events, true) && ! ($prefs[$key] ?? true)) {
                return false;
            }
        }

        return $prefs['categories'][$code] ?? true;
    }

    public static function supportsEmail(string $code): bool
    {
        return in_array($code, [
            ...array_merge(...array_values(self::CATEGORY_EVENTS)),
            'kyc_reviewed', 'reward_shipped', 'reward_delivered',
            'financial_movement_verified', 'financial_movement_rejected', 'financial_movement_flagged', 'financial_movement_pending',
            'document_approved', 'document_rejected',
        ], true);
    }
}
