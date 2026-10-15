<?php

namespace App\Services;

use App\Models\EntrepreneurProfile;

class ProfileReadiness
{
    public function missing(?EntrepreneurProfile $profile): array
    {
        if (! $profile) {
            return ['crear tu perfil de emprendedor y completar los datos obligatorios'];
        }
        $missing = [];
        if (mb_strlen(trim($profile->bio ?? '')) < 30) {
            $missing[] = 'biografía (mínimo 30 caracteres)';
        }
        if (mb_strlen(trim($profile->company_name ?? '')) < 2) {
            $missing[] = 'nombre de empresa o proyecto';
        }
        foreach (['website' => 'sitio web válido (https://…)', 'linkedin_url' => 'URL de LinkedIn válida (https://…)'] as $field => $label) {
            if (! filter_var($profile->$field, FILTER_VALIDATE_URL) || ! in_array(parse_url($profile->$field, PHP_URL_SCHEME), ['http', 'https'])) {
                $missing[] = $label;
            }
        }
        if (! trim($profile->country ?? '')) {
            $missing[] = 'país';
        }
        if (! $profile->identity_verified) {
            $missing[] = 'verificación de identidad (KYC) aprobada';
        }

        return $missing;
    }
}
