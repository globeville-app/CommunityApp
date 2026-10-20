/**
 * Shapes shared by the real API client (api.ts) and the browser demo
 * (api.web.ts), so both behave the same for the screens.
 */

import type { Language } from "./i18n";

/**
 * An error from the server (or from reaching it). It carries only a code,
 * such as "outside_denver"; screens show it with errorMessage() from
 * src/i18n/errors.ts, in the person's language.
 */
export class ApiError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string[]>;

  constructor(code: string, status = 0, fields?: Record<string, string[]>) {
    super(code);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

// ---- Types the backend sends back ----

/** Event categories, grouped. Also the list members pick interests from. */
export type CategoryGroup = { key: string; categories: string[] };

export type AppConfig = {
  app_name: string;
  languages: string[];
  /** Older app versions must update first ("" = no minimum). */
  min_app_version?: string;
  category_groups: CategoryGroup[];
  other_category: string;
  other_max_length: number;
  max_interests: number;
};

/** An event as the server sends it. Times are Denver time, e.g. "2026-10-24T18:00:00-06:00". */
export type EventData = {
  id: number;
  group: string | null;
  category: string;
  category_other: string | null;
  title: string;
  description: string;
  language: Language;
  title_alt: string | null;
  description_alt: string | null;
  starts_at: string;
  ends_at: string | null;
  location_text: string;
  /** The map pin. Events posted before Milestone 3 may have none. */
  latitude: number | null;
  longitude: number | null;
  /** True for the organizer of an upcoming event that has no pin yet. */
  needs_pin: boolean;
  partiful_url: string | null;
  status: "active" | "cancelled";
  is_past: boolean;
  /** null once the organizer deleted their account ("Former neighbor"). */
  organizer_name: string | null;
  /** For the organizer's member page; null once they deleted their account, and for organization events. */
  organizer_member_id: number | null;
  /** "Hosted by [Organization]". has_page is false while its page is hidden. */
  organization: { id: number; name: string; type: OrgType; has_page: boolean } | null;
  /** The member follows this event's organization. */
  is_following: boolean;
  is_organizer: boolean;
  going_count: number;
  is_going: boolean;
  matches_interests: boolean;
};

/** What the post/edit form sends. Times are Denver time without a zone, "2026-10-24T18:00". */
export type EventInput = {
  category: string;
  category_other?: string;
  title: string;
  description?: string;
  language?: Language;
  title_alt?: string;
  description_alt?: string;
  starts_at: string;
  ends_at?: string | null;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  partiful_url?: string;
  /** Post as an organization the member runs, in one of its neighborhoods. */
  organization?: number;
  neighborhood?: number;
};

export type Translation = { title: string; description: string; target: Language; machine: boolean };

/** Signup and login both return the token and the account's language. */
/** email_verified: false means "ask for the code from the welcome email first". */
export type AuthResult = { token: string; language: Language; email_verified?: boolean };

export type MatchResult = { neighborhood_id: number; name: string; aliases: string[] };

export type LatLng = { latitude: number; longitude: number };

export type BadgeVisibility = "neighborhood" | "private";

export type Profile = {
  /** The member id neighbors use for the member page. */
  id: number;
  display_name: string;
  first_name: string;
  last_initial: string;
  photo_url: string | null;
  interests: string[];
  /** center: where the event pin map opens; null if the server lacks the map file. */
  neighborhood: { id: number; name: string; center?: LatLng | null };
  alias: string | null;
  role?: "member" | "organizer";
  auto_checkin: boolean;
  badge_visibility: BadgeVisibility;
  /** The first auto check-in offer was shown (it never shows again). */
  checkin_offer_shown: boolean;
  reminders_enabled: boolean;
  cancellation_alerts_enabled: boolean;
  /** The one-time notification ask was shown. */
  notif_offer_shown: boolean;
  language: Language;
  joined_at: string;
};

/**
 * A "Report a problem" form. Only what the person typed, plus technical
 * details the app adds (see src/report.ts). Never an address or location.
 */
export type ProblemReportInput = {
  message: string;
  contact_email?: string;
  screenshot?: { uri: string; mimeType: string } | null;
  app_version: string;
  os: string;
  device_model: string;
  language: Language;
  screen: string;
};

export type ProfileInput = {
  first_name: string;
  last_name: string;
  alias: string;
  interests: string[];
  language?: Language;
};

// ---- Badges (docs/MILESTONE_3.md, API) ----

export type BadgeKind = "growth" | "keepsake";

/** A member's badge. stage: 0 = not earned, 1–5 = Seed–Grove (keepsakes: 1 once earned). */
export type BadgeData = {
  key: string;
  kind: BadgeKind;
  stage: number;
  count: number;
  next_threshold: number | null;
  earned_at: string | null;
};

/** The rules, from backend/badges/config.py. Words live in the app. */
export type BadgeCatalog = {
  badges: { key: string; kind: BadgeKind; track: string | null; emblem: string; thresholds: number[] }[];
  stages: string[];
  grove_milestone_multipliers: number[];
  collect_window_days: number;
};

/** A badge this event would grow if collected. */
export type BadgeGrowth = { badge: string; stage: number; count: number; next_threshold: number | null };

export type CollectCard = {
  event_id: number;
  title: string;
  title_alt: string | null;
  language: Language;
  category: string;
  starts_at: string;
  collect_until: string;
  grows: BadgeGrowth[];
};

export type Celebration = {
  id: number;
  badge_key: string;
  kind: "earned" | "stage_up" | "grove_milestone";
  stage: number;
  count: number;
};

/** Empty ({}) until the host's first event counts as hosted. */
export type Impact =
  | {
      brought_together: number;
      first_timers: number;
      came_back: number;
      most_popular: { title: string; starts_at: string; attendee_count: number };
    }
  | Record<string, never>;

export type MemberPage = {
  id: number;
  display_name: string;
  photo_url: string | null;
  neighborhood: { id: number; name: string };
  alias: string | null;
  member_since: string;
  badges: BadgeData[];
  /** Their own page (no Block link). */
  is_own?: boolean;
  /** This member blocked them (their events are hidden). */
  is_blocked?: boolean;
};

/** An invitation to help run an organization, waiting for this member's answer. */
export type OrgInvite = { id: number; organization: { id: number; name: string } };

export type BlockedMember = { id: number; display_name: string };

/** One event for the phone to watch (auto check-in). Only the event's pin. */
export type Geofence = {
  event_id: number;
  latitude: number;
  longitude: number;
  radius_meters: number;
  opens_at: string;
  closes_at: string;
};

export type ProfileSettings = {
  auto_checkin?: boolean;
  badge_visibility?: BadgeVisibility;
  reminders_enabled?: boolean;
  cancellation_alerts_enabled?: boolean;
};

// ---- Organizations (docs/MILESTONE_4.md) ----

export const ORG_TYPES = ["nonprofit", "club", "collective", "faith", "school", "civic", "business"] as const;
export type OrgType = (typeof ORG_TYPES)[number];
export type OrgStatus = "pending" | "approved" | "rejected" | "hidden";

export type NeighborhoodRef = { id: number; name: string; center?: LatLng | null };

export type OrgSummary = { id: number; name: string; type: OrgType; photo_url: string | null };

/** An organization's page. The admin-only fields are absent for everyone else. */
export type OrgPage = OrgSummary & {
  description: string;
  description_alt: string | null;
  language: Language;
  link: string | null;
  neighborhoods: NeighborhoodRef[];
  badges: BadgeData[];
  upcoming_events: EventData[];
  past_event_count: number;
  is_following: boolean;
  is_admin: boolean;
  status?: OrgStatus;
  follower_count?: number;
  change_pending?: boolean;
  admins?: { member_id: number | null; display_name: string | null; is_you: boolean }[];
  /** Invitations not yet accepted: a count, never who. */
  pending_invites?: number;
};

export type MyOrg = OrgSummary & { status: OrgStatus; neighborhoods: NeighborhoodRef[] };

export type OrgInput = {
  name: string;
  type: OrgType;
  neighborhoods: number[];
  description: string;
  description_alt?: string;
  language?: Language;
  link?: string;
  business_rule_accepted?: boolean;
};
