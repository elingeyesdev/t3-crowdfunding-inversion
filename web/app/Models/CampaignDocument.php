<?php

namespace App\Models;

class CampaignDocument extends Record
{
    protected function casts(): array
    {
        return ['is_public' => 'boolean'];
    }

    public function documentPath(): ?string
    {
        // Only the private campaign-document directory can be published.
        // Reject KYC paths, remote URLs, signed URLs and traversal variants.
        if (str_contains($this->file_url, '..') || ! preg_match('#^/api/v1/private-files/(documents/[a-zA-Z0-9._-]+)$#D', $this->file_url, $match)) {
            return null;
        }

        return $match[1];
    }
}
