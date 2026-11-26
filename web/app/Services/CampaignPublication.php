<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\EntrepreneurProfile;
use App\Support\CampaignTypes;

class CampaignPublication
{
    public function validate(Campaign $campaign): void
    {
        CampaignTypes::requireSupported($campaign->campaign_type);
        // Read current KYC under the same transaction as the status change.
        $profile = EntrepreneurProfile::where('user_id', $campaign->creator_id)->lockForUpdate()->first();
        abort_unless($profile?->identity_verified && $profile->kyc_status === 'approved', 422, 'La identidad del propietario debe tener una verificación KYC aprobada.');
        abort_unless($campaign->end_date && $campaign->end_date->isFuture(), 422, 'La campaña debe tener una fecha de cierre futura.');
    }
}
