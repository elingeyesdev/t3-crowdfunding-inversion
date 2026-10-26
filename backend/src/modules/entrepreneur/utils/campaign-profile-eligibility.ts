import { EntrepreneurProfile } from '../models';

const MIN_BIO_LENGTH = 30;

function isValidHttpUrl(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Requisitos para crear una campaña (alineado con el formulario de perfil en frontend).
 */
export function getCampaignCreationBlockers(profile: EntrepreneurProfile): string[] {
  const missing: string[] = [];

  if (!profile.bio?.trim() || profile.bio.trim().length < MIN_BIO_LENGTH) {
    missing.push(`biografía (mínimo ${MIN_BIO_LENGTH} caracteres)`);
  }

  if (!profile.companyName?.trim() || profile.companyName.trim().length < 2) {
    missing.push('nombre de empresa o proyecto');
  }

  if (!isValidHttpUrl(profile.website)) {
    missing.push('sitio web válido (https://…)');
  }

  if (!isValidHttpUrl(profile.linkedinUrl)) {
    missing.push('URL de LinkedIn válida (https://…)');
  }

  if (!profile.country?.trim()) {
    missing.push('país');
  }

  if (!profile.identityVerified) {
    missing.push('verificación de identidad (KYC) aprobada');
  }

  return missing;
}

export function isProfileCompleteForCampaignCreation(profile: EntrepreneurProfile): boolean {
  return getCampaignCreationBlockers(profile).length === 0;
}
