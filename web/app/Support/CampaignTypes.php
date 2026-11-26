<?php

namespace App\Support;

class CampaignTypes
{
    public const SUPPORTED = ['donation', 'reward'];

    public static function supported(?string $type): bool
    {
        return in_array($type, self::SUPPORTED, true);
    }

    public static function requireSupported(?string $type): void
    {
        abort_unless(self::supported($type), 422, 'La modalidad de esta campaña no está disponible. Solo se admiten donaciones y campañas con recompensas.');
    }
}
