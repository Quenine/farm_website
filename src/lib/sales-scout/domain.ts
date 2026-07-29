export const scoutStatuses = Object.freeze([
  "new",
  "researching",
  "qualified",
  "disqualified",
  "engaged",
  "converted",
  "closed",
  "do_not_contact",
] as const);

export type ScoutStatus = (typeof scoutStatuses)[number];

export const outreachStatuses = Object.freeze([
  "draft",
  "approved",
  "sent",
  "replied",
  "no_response",
  "cancelled",
  "blocked",
] as const);

export type OutreachStatus = (typeof outreachStatuses)[number];

export const handoverStatuses = Object.freeze([
  "not_ready",
  "ready",
  "accepted",
  "in_progress",
  "completed",
  "declined",
] as const);

export type HandoverStatus = (typeof handoverStatuses)[number];

export const prospectPlatforms = Object.freeze([
  "instagram",
  "facebook",
  "tiktok",
  "x",
  "youtube",
  "website",
  "email",
  "phone",
  "whatsapp",
  "other",
] as const);

export type ProspectPlatform = (typeof prospectPlatforms)[number];
