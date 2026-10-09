/** Sample server replies for tests. No app code is imported here. */
import type { AppConfig, EventData, Profile as ProfileData } from "../src/apiTypes";

const APP_NAME: string = require("../../shared/app_config.json").app_name;

export const HIGHLAND_PROFILE: ProfileData = {
  display_name: "Ana R.",
  first_name: "Ana",
  last_initial: "R",
  photo_url: null,
  interests: ["block_party", "gardening"],
  neighborhood: { id: 3, name: "Highland" },
  alias: "LoHi",
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
    partiful_url: null,
    status: "active",
    is_past: false,
    organizer_name: "Ben R.",
    is_organizer: false,
    going_count: 12,
    is_going: false,
    matches_interests: false,
    ...overrides,
  };
}
