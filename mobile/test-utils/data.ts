/** Sample server replies for tests. No app code is imported here. */
import type { AppConfig, BadgeCatalog, BadgeData, EventData, Profile as ProfileData } from "../src/apiTypes";

const APP_NAME: string = require("../../shared/app_config.json").app_name;

export const HIGHLAND_PROFILE: ProfileData = {
  id: 41,
  display_name: "Ana R.",
  first_name: "Ana",
  last_initial: "R",
  photo_url: null,
  interests: ["block_party", "gardening"],
  neighborhood: { id: 3, name: "Highland", center: { latitude: 39.7615, longitude: -105.0112 } },
  alias: "LoHi",
  auto_checkin: false,
  badge_visibility: "neighborhood",
  // Already offered, so tapping "I'm going" in older tests stays on the event.
  checkin_offer_shown: true,
  reminders_enabled: false,
  cancellation_alerts_enabled: true,
  notif_offer_shown: true,
  language: "en",
  joined_at: "2026-10-07T12:00:00Z",
};

/** The category list, as GET /api/config sends it (backend/events/categories.py). */
export const CONFIG: AppConfig = {
  app_name: APP_NAME,
  languages: ["en", "es"],
  category_groups: [
    { key: "celebrate", categories: ["block_party", "potluck", "festival", "parade", "cultural_celebration", "pool_party"] },
    { key: "buy_swap", categories: ["market", "pop_up", "yard_sale", "swap"] },
    { key: "entertainment", categories: ["live_music", "comedy", "arts_crafts", "movie_night", "game_night", "watch_party"] },
    { key: "get_active", categories: ["pickup_game", "fitness", "gardening", "pet_meetup"] },
    { key: "community", categories: ["cleanup", "volunteering", "donation_drive", "fundraiser", "community_meeting", "resource_fair"] },
    { key: "learn_connect", categories: ["workshop", "networking", "expo", "meet_greet", "seniors"] },
  ],
  other_category: "other",
  other_max_length: 40,
  max_interests: 8,
};

/** An upcoming event in Highland, as the server sends it. Override any field. */
export function sampleEvent(overrides: Partial<EventData> = {}): EventData {
  return {
    id: 7,
    group: "celebrate",
    category: "potluck",
    category_other: null,
    title: "Fall potluck",
    description: "Bring a dish to share.",
    language: "en",
    title_alt: null,
    description_alt: null,
    starts_at: "2030-10-24T18:00:00-06:00",
    ends_at: null,
    location_text: "Corner of 32nd and Lowell",
    latitude: 39.7615,
    longitude: -105.0112,
    needs_pin: false,
    partiful_url: null,
    status: "active",
    is_past: false,
    organizer_name: "Ben R.",
    organizer_member_id: 52,
    organization: null,
    is_following: false,
    is_organizer: false,
    going_count: 12,
    is_going: false,
    matches_interests: false,
    ...overrides,
  };
}

/** The badge rules, as GET /api/badges/catalog sends them (backend/badges/config.py). */
const TRACKS: Record<string, number[]> = {
  everyday: [1, 3, 9, 24, 60],
  occasional: [1, 2, 5, 10, 18],
  variety: [2, 4, 8, 15, 30],
  host_reach: [2, 10, 30, 80, 200],
};
const GROWTH: [string, string][] = [
  ["local", "everyday"],
  ["best_guest", "variety"],
  ["host", "host_reach"],
  ["day_one", "occasional"],
  ["fiestero", "occasional"],
  ["treasure_hunter", "occasional"],
  ["aficionado", "occasional"],
  ["recreationist", "occasional"],
  ["helping_hand", "occasional"],
  ["clean_sweeper", "occasional"],
  ["civic_voice", "occasional"],
];
export const KEEPSAKES = ["ambassador", "open_door", "familiar_face", "year_rounder"];

export const CATALOG: BadgeCatalog = {
  badges: [
    ...GROWTH.map(([key, track]) => ({ key, kind: "growth" as const, track, emblem: key, thresholds: TRACKS[track] })),
    ...KEEPSAKES.map((key) => ({ key, kind: "keepsake" as const, track: null, emblem: key, thresholds: [] })),
  ],
  stages: ["seed", "sprout", "bloom", "tree", "grove"],
  grove_milestone_multipliers: [2, 3],
  collect_window_days: 7,
};

/** All 15 badges as GET /api/me/badges sends them; pass {key: [stage, count]} for earned ones. */
export function myBadges(earned: Record<string, [number, number]> = {}): BadgeData[] {
  return CATALOG.badges.map(({ key, kind, thresholds }) => {
    const [stage, count] = earned[key] ?? [0, 0];
    return {
      key,
      kind,
      stage,
      count,
      next_threshold: kind === "growth" ? (thresholds[stage] ?? null) : null,
      earned_at: stage > 0 ? "2026-10-12T19:00:00-06:00" : null,
    };
  });
}
