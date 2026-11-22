<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\CampaignDocument;
use App\Models\EntrepreneurProfile;
use App\Models\InvestorProfile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class PrivateFileLinks
{
    // Call only for a private resource response, never arbitrary response text.
    public static function documentData(CampaignDocument $document): array
    {
        $ownerId = Campaign::whereKey($document->campaign_id)->value('creator_id');
        self::authorize($ownerId);
        $data = $document->attributesToArray();
        $path = $document->documentPath();
        if ($path && Storage::disk('local')->exists($path)) {
            $data['file_url'] = self::sign($path);
        }

        return $data;
    }

    public static function profileData(EntrepreneurProfile|InvestorProfile $profile): array
    {
        self::authorize($profile->user_id);
        $data = $profile->attributesToArray();
        // Only the direct URL in each stored KYC entry is a file field.
        // Names, bio, metadata and nested values must remain untouched.
        foreach ($data['verification_documents'] ?? [] as $key => $document) {
            if (! is_array($document) || ! is_string($document['url'] ?? null)) {
                continue;
            }
            $url = LegacyKycFiles::privateUrl($document['url']);
            if ($url !== null) {
                $path = substr($url, strlen('/api/v1/private-files/'));
                if (Storage::disk('local')->exists($path)) {
                    $data['verification_documents'][$key]['url'] = self::sign($path);
                }
            }
        }

        return $data;
    }

    private static function authorize(?string $ownerId): void
    {
        $user = Auth::guard('sanctum')->user();
        abort_unless($user && $user->is_active && $ownerId !== null
            && ($user->id === $ownerId || $user->roles()->whereIn('name', ['admin', 'super_admin'])->exists()), 403);
    }

    private static function sign(string $path): string
    {
        return URL::temporarySignedRoute('private.file', now()->addMinutes(15), ['path' => $path]);
    }
}
