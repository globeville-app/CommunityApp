/**
 * BROWSER DEMO ONLY: badges and attendance, pretend version. Follows the
 * real engine (backend/badges/engine.py) for the attendee's side, with the
 * thresholds read from backend/badges/config.py when the demo is built.
 * Hosting needs other real people, so the demo's My Impact host section
 * stays empty. Nothing about location exists here at all.
 */
import {
  ApiError,
  BadgeCatalog,
  BadgeData,
  Celebration,
  CollectCard,
  Geofence,
  Impact,
  MemberPage,
  Profile,
  ProfileSettings,
} from "../apiTypes";
import { BADGE_RULES, CATEGORY_GROUPS, DemoBadges, Db, languageOf, load, pause, save, toProfile, userFor } from "./fakeBackend";
import { demoMember, ended, eventEnd, findEvent, isGoing, SAMPLE_MEMBER_IDS, toDenver } from "./fakeEvents";

const DAY = 24 * 60 * 60 * 1000;
const COLLECT_WINDOW = 7 * DAY;
const STAGES = ["seed", "sprout", "bloom", "tree", "grove"];

function badgesOf(db: Db, email: string): DemoBadges {
  db.badges ??= {};
  return (db.badges[email] ??= { attended: [], declined: [], stages: {}, keepsakes: [], celebrations: [] });
}

function thresholdsFor(key: string) {
  const badge = BADGE_RULES.growth.find((b) => b.key === key);
  return badge ? BADGE_RULES.thresholds[badge.track] : [];
}

function stageFor(key: string, count: number) {
  return thresholdsFor(key).filter((threshold) => count >= threshold).length;
}

function groupOf(category: string) {
  return CATEGORY_GROUPS.find((g) => g.categories.includes(category))?.key ?? null;
}

/** The counts, straight from the attendance list (like engine.compute). */
function counts(db: Db, email: string) {
  const mine = badgesOf(db, email);
  const events = mine.attended
    .map((a) => db.events[a.eventId])
    .filter((e) => e && e.status !== "cancelled" && !BADGE_RULES.sensitive.includes(e.category));
  const result: Record<string, number> = {};
  for (const { key, rule } of BADGE_RULES.growth) {
    if (rule === "any") result[key] = events.length;
    else if (rule === "distinct_hosts") result[key] = new Set(events.map((e) => e.organizerEmail ?? e.organizerName)).size;
    else if (rule.startsWith("group:")) result[key] = events.filter((e) => groupOf(e.category) === rule.slice(6)).length;
    else if (rule.startsWith("category:")) result[key] = events.filter((e) => e.category === rule.slice(9)).length;
    else result[key] = 0; // hosting and Day One need other real people
  }
  return result;
}

/** Raise stages (never lower them) and add celebrations, like engine.update_badges. */
function update(db: Db, email: string) {
  const mine = badgesOf(db, email);
  const now = counts(db, email);
  const add = (badge_key: string, kind: "earned" | "stage_up", stage: number, count: number) =>
    mine.celebrations.push({ id: db.nextCelebrationId++, badge_key, kind, stage, count, seen: false });
  for (const [key, count] of Object.entries(now)) {
    const before = mine.stages[key] ?? 0;
    const stage = stageFor(key, count);
    if (stage > before) {
      mine.stages[key] = stage;
      add(key, before === 0 ? "earned" : "stage_up", stage, count);
    }
  }
  // Ambassador: an event in a language other than yours at the time.
  if (!mine.keepsakes.includes("ambassador") && mine.attended.some((a) => db.events[a.eventId]?.language !== a.language)) {
    mine.keepsakes.push("ambassador");
    add("ambassador", "earned", 1, 0);
  }
}

function badgeList(db: Db, email: string, earnedOnly = false): BadgeData[] {
  const mine = badgesOf(db, email);
  const now = counts(db, email);
  const growth: BadgeData[] = BADGE_RULES.growth.map(({ key }) => {
    const stage = mine.stages[key] ?? 0;
    return {
      key,
      kind: "growth",
      stage,
      count: now[key] ?? 0,
      next_threshold: thresholdsFor(key)[stage] ?? null,
      earned_at: stage > 0 ? new Date().toISOString() : null,
    };
  });
  const keepsakes: BadgeData[] = BADGE_RULES.keepsakes.map((key) => ({
    key,
    kind: "keepsake",
    stage: mine.keepsakes.includes(key) ? 1 : 0,
    count: 0,
    next_threshold: null,
    earned_at: mine.keepsakes.includes(key) ? new Date().toISOString() : null,
  }));
  const all = [...growth, ...keepsakes];
  return earnedOnly ? all.filter((b) => b.stage > 0) : all;
}

function newCelebrations(db: Db, email: string, since: number): Celebration[] {
  return badgesOf(db, email)
    .celebrations.filter((c) => c.id >= since)
    .map(({ seen: _seen, ...c }) => c);
}

// ---- The endpoints ----------------------------------------------------------------

export async function getBadgeCatalog(_token: string): Promise<BadgeCatalog> {
  return {
    badges: [
      ...BADGE_RULES.growth.map(({ key, track }) => ({
        key,
        kind: "growth" as const,
        track,
        emblem: key,
        thresholds: BADGE_RULES.thresholds[track],
      })),
      ...BADGE_RULES.keepsakes.map((key) => ({ key, kind: "keepsake" as const, track: null, emblem: key, thresholds: [] })),
    ],
    stages: STAGES,
    grove_milestone_multipliers: [2, 3],
    collect_window_days: 7,
  };
}

export async function getMyBadges(token: string) {
  await pause(200);
  const { email, db } = demoMember(token);
  return { badges: badgeList(db, email) };
}

export async function getCollectCards(token: string): Promise<{ cards: CollectCard[]; show_checkin_reoffer: boolean }> {
  await pause(250);
  const { email, db, profile } = demoMember(token);
  save(db);
  const mine = badgesOf(db, email);
  const now = counts(db, email);
  const cards = Object.values(db.events)
    .filter((e) => e.neighborhoodId === profile.neighborhoodId && e.status === "active" && ended(e))
    .filter((e) => isGoing(db, e, email) && e.organizerEmail !== email)
    .filter((e) => Date.now() - eventEnd(e).getTime() < COLLECT_WINDOW)
    .filter((e) => !mine.attended.some((a) => a.eventId === e.id))
    .map((e) => {
      const sensitive = BADGE_RULES.sensitive.includes(e.category);
      const grows = sensitive
        ? []
        : BADGE_RULES.growth
            .filter(({ rule }) =>
              rule === "any" ||
              rule === "distinct_hosts" ||
              (rule.startsWith("group:") && groupOf(e.category) === rule.slice(6)) ||
              (rule.startsWith("category:") && e.category === rule.slice(9)),
            )
            .map(({ key }) => {
              const stage = mine.stages[key] ?? 0;
              return { badge: key, stage, count: now[key] ?? 0, next_threshold: thresholdsFor(key)[stage] ?? null };
            });
      return {
        event_id: e.id,
        title: e.title,
        title_alt: e.title_alt,
        language: e.language,
        category: e.category,
        starts_at: e.starts_at,
        collect_until: toDenver(new Date(eventEnd(e).getTime() + COLLECT_WINDOW)),
        grows,
      };
    });
  return { cards, show_checkin_reoffer: false };
}

export async function collectEvent(token: string, id: number) {
  await pause(350);
  const { email, db, profile } = demoMember(token);
  const event = findEvent(db, id, profile.neighborhoodId);
  const mine = badgesOf(db, email);
  if (mine.attended.some((a) => a.eventId === id)) throw new ApiError("already_recorded", 409);
  if (event.status === "cancelled") throw new ApiError("event_cancelled", 409);
  if (event.organizerEmail === email) throw new ApiError("is_host", 409);
  if (!isGoing(db, event, email)) throw new ApiError("not_going", 409);
  if (!ended(event)) throw new ApiError("event_not_ended", 409);
  if (Date.now() - eventEnd(event).getTime() > COLLECT_WINDOW) throw new ApiError("collect_window_closed", 409);
  const since = db.nextCelebrationId;
  mine.attended.push({ eventId: id, method: "collect", language: languageOf(db, email), at: new Date().toISOString() });
  update(db, email);
  save(db);
  return { celebrations: newCelebrations(db, email, since) };
}

export async function declineEvent(token: string, id: number) {
  await pause(250);
  const { email, db, profile } = demoMember(token);
  const event = findEvent(db, id, profile.neighborhoodId);
  event.goingEmails = event.goingEmails.filter((e) => e !== email);
  badgesOf(db, email).declined.push(id);
  save(db);
}

/** Browsers can't watch places, so the demo has nothing to check in to. */
export async function checkIn(_token: string, _id: number): Promise<{ celebrations: Celebration[] }> {
  throw new ApiError("checkin_window_closed", 409);
}

export async function getGeofences(_token: string): Promise<{ geofences: Geofence[] }> {
  return { geofences: [] };
}

export async function getImpact(_token: string): Promise<Impact> {
  await pause(150);
  return {};
}

export async function getCelebrations(token: string) {
  const email = userFor(token);
  const db = load();
  if (!db.profiles[email]) return { celebrations: [] };
  return { celebrations: newCelebrations(db, email, 0).filter((c) => !badgesOf(db, email).celebrations.find((x) => x.id === c.id)?.seen) };
}

export async function markCelebrationsSeen(token: string, ids: number[]) {
  const email = userFor(token);
  const db = load();
  for (const c of badgesOf(db, email).celebrations) if (ids.includes(c.id)) c.seen = true;
  save(db);
}

export async function logShare(_token: string, _badgeKey: string) {
  // The real server counts the badge and the date only. The demo keeps nothing.
}

export async function markCheckinOfferSeen(token: string, which: "first" | "reoffer") {
  const email = userFor(token);
  const db = load();
  if (which === "first" && db.profiles[email]) db.profiles[email].checkin_offer_shown = true;
  save(db);
}

export async function updateProfileSettings(token: string, settings: ProfileSettings): Promise<Profile> {
  await pause(200);
  const email = userFor(token);
  const db = load();
  if (!db.profiles[email]) throw new ApiError("profile_not_found", 404);
  Object.assign(db.profiles[email], settings);
  save(db);
  return toProfile(db, email);
}

// Made-up neighbors' member pages, with a few badges each.
const SAMPLE_MEMBERS: Record<number, { name: string; badges: [string, number, number][] }> = {
  9001: { name: "Rosa M.", badges: [["local", 3, 14], ["fiestero", 2, 3], ["host", 2, 12], ["ambassador", 1, 0]] },
  9002: { name: "Kim T.", badges: [["local", 2, 5], ["clean_sweeper", 3, 6], ["helping_hand", 3, 7]] },
  9003: { name: "Luis G.", badges: [["local", 4, 30], ["host", 3, 41], ["fiestero", 4, 11], ["year_rounder", 1, 0]] },
  9004: { name: "Ann P.", badges: [["local", 1, 2], ["treasure_hunter", 1, 1]] },
};

// Blocking in the demo: remembered for this page only.
const demoBlocked = new Map<number, string>();

export async function setBlocked(_token: string, id: number, blocked: boolean) {
  await pause(200);
  if (blocked) demoBlocked.set(id, SAMPLE_MEMBERS[id]?.name ?? "");
  else demoBlocked.delete(id);
  return { is_blocked: blocked };
}

export async function getBlockedMembers(_token: string) {
  await pause(200);
  return { members: [...demoBlocked].map(([id, display_name]) => ({ id, display_name })) };
}

export async function getMember(token: string, id: number): Promise<MemberPage> {
  await pause(250);
  const { email, db, profile } = demoMember(token);
  const neighborhood = toProfile(db, email).neighborhood;
  const sample = SAMPLE_MEMBERS[id];
  if (sample && Object.values(SAMPLE_MEMBER_IDS).includes(id)) {
    return {
      id,
      display_name: sample.name,
      photo_url: null,
      neighborhood: { id: neighborhood.id, name: neighborhood.name },
      alias: null,
      member_since: "2026-03-14",
      is_blocked: demoBlocked.has(id),
      badges: sample.badges.map(([key, stage, count]) => ({
        key,
        kind: BADGE_RULES.keepsakes.includes(key) ? "keepsake" : "growth",
        stage,
        count,
        next_threshold: null,
        earned_at: null,
      })),
    };
  }
  const found = Object.entries(db.profiles).find(([, p]) => (p.id ?? 1) === id && p.neighborhoodId === profile.neighborhoodId);
  if (!found) throw new ApiError("member_not_found", 404);
  const [memberEmail, member] = found;
  const visible = memberEmail === email || (member.badge_visibility ?? "neighborhood") === "neighborhood";
  return {
    id,
    display_name: member.display_name,
    photo_url: member.photo_url,
    neighborhood: { id: neighborhood.id, name: neighborhood.name },
    alias: member.alias,
    member_since: member.joined_at.slice(0, 10),
    badges: visible ? badgeList(db, memberEmail, true) : [],
  };
}
