export const CONSENT_COOKIE_NAME = "farm_consent_preferences";
export const CONSENT_COOKIE_VERSION = 1;
export const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export type ServerConsentPreferences = {
  analytics: boolean;
  marketing: boolean;
  version: number;
};

export function parseConsentCookie(value: string | null | undefined): ServerConsentPreferences {
  if (!value) return { analytics: false, marketing: false, version: CONSENT_COOKIE_VERSION };
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ServerConsentPreferences>;
    return {
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      version: Number.isInteger(parsed.version) ? Number(parsed.version) : CONSENT_COOKIE_VERSION,
    };
  } catch {
    return { analytics: false, marketing: false, version: CONSENT_COOKIE_VERSION };
  }
}

export function serializeConsentCookie(input: { analytics: boolean; marketing: boolean }) {
  return encodeURIComponent(JSON.stringify({
    analytics: input.analytics === true,
    marketing: input.marketing === true,
    version: CONSENT_COOKIE_VERSION,
  }));
}
