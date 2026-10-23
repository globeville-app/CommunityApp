/**
 * BROWSER DEMO ONLY: the neighborhood calendar, pretend version. Follows the
 * real backend's rules (backend/events/) and error codes. A few sample
 * events from made-up neighbors are added to each neighborhood so the demo
 * isn't empty. Nothing leaves the browser.
 */
import { ApiError, EventData, EventInput, GuestList, InviteInfo, Translation } from "../apiTypes";
import type { Language } from "../i18n";
import {
  CATEGORY_GROUPS,
  CATEGORY_KEYS,
  DemoEvent,
  Db,
  languageOf,
  load,
  neighborhoodCenter,
  pause,
  save,
  userFor,
} from "./fakeBackend";
import { seedOrgs } from "./fakeOrgs";

const DENVER = "America/Denver";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// ---- Denver time -----------------------------------------------------------------

/** Minutes Denver is behind UTC at a moment (360 in summer, 420 in winter). */
function denverOffsetMinutes(at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: DENVER,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((at.getTime() - asUtc) / 60000);
}

/** "2026-10-24T18:00" in Denver → the moment it happens. */
function fromDenver(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(text);
  if (!match) return null;
  const wall = Date.UTC(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
  const guess = new Date(wall + denverOffsetMinutes(new Date(wall)) * 60000);
  return new Date(wall + denverOffsetMinutes(guess) * 60000);
}

/** A moment → "2026-10-24T18:00:00-06:00", like the server sends. */
function toDenver(at: Date) {
  const offset = denverOffsetMinutes(at);
  const local = new Date(at.getTime() - offset * 60000).toISOString().slice(0, 19);
  const sign = offset > 0 ? "-" : "+";
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${local}${sign}${hours}:${minutes}`;
}

/** Denver wall time `days` from now at `hour`:00. */
function daysFromNow(days: number, hour: number) {
  const date = new Date(Date.now() + days * DAY);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: DENVER }).format(date);
  return toDenver(fromDenver(`${ymd}T${String(hour).padStart(2, "0")}:00`)!);
}

// ---- Sample events ----------------------------------------------------------------

/** The sample organizers' member pages (see fakeBadges.ts), by name. */
export const SAMPLE_MEMBER_IDS: Record<string, number> = { "Rosa M.": 9001, "Kim T.": 9002, "Luis G.": 9003, "Ann P.": 9004 };

function seed(db: Db, neighborhoodId: number) {
  if (db.seededNeighborhoods.includes(neighborhoodId)) return;
  db.seededNeighborhoods.push(neighborhoodId);
  const orgs = seedOrgs(db, neighborhoodId);
  const center = neighborhoodCenter(neighborhoodId);
  // Pins a short walk from the neighborhood's middle.
  const near = (north: number, east: number) => ({
    latitude: Number((center.latitude + north * 0.001).toFixed(6)),
    longitude: Number((center.longitude + east * 0.001).toFixed(6)),
  });
  const base = {
    neighborhoodId,
    organizerEmail: "sample@neighbors.demo",
    goingEmails: [],
    category_other: null,
    partiful_url: null,
    status: "active" as const,
    createdAt: new Date().toISOString(),
  };
  const samples: Partial<DemoEvent>[] = [
    {
      category: "game_night",
      language: "es",
      title: "Noche de lotería",
      description: "Traigan botanas. Tenemos tablas para todos.",
      title_alt: "Lotería night",
      description_alt: "Bring snacks. We have boards for everyone.",
      starts_at: daysFromNow(2, 19),
      ends_at: daysFromNow(2, 21),
      location_text: "Rec center, back room",
      organizerName: "Rosa M.",
      orgId: orgs.recClub,
      extraGoing: 11,
      ...near(1, -2),
    },
    {
      category: "cleanup",
      language: "en",
      title: "Alley cleanup",
      description: "Gloves and bags provided. Meet at the dumpster.",
      title_alt: null,
      description_alt: null,
      starts_at: daysFromNow(4, 9),
      ends_at: null,
      location_text: "Alley behind the 4400 block",
      organizerName: "Kim T.",
      extraGoing: 4,
      ...near(-2, 1),
    },
    {
      category: "potluck",
      language: "en",
      title: "Fall Potluck & Cookout",
      description: "",
      title_alt: null,
      description_alt: null,
      partiful_url: "https://partiful.com/e/demo-potluck",
      starts_at: daysFromNow(6, 17),
      ends_at: daysFromNow(6, 20),
      location_text: "Corner of the park by the playground",
      organizerName: "Luis G.",
      extraGoing: 23,
      ...near(0, 0),
    },
    {
      category: "yard_sale",
      language: "en",
      title: "Block yard sale",
      description: "",
      title_alt: null,
      description_alt: null,
      starts_at: daysFromNow(8, 8),
      ends_at: null,
      location_text: "The whole block",
      organizerName: "Ann P.",
      extraGoing: 2,
      status: "cancelled",
      latitude: null,
      longitude: null,
    },
    // Already over, and "you" were going: they wait in My Impact to collect.
    {
      category: "cleanup",
      language: "en",
      title: "River trail cleanup",
      description: "Bags, gloves and coffee provided.",
      title_alt: "Limpieza del sendero del río",
      description_alt: "Damos bolsas, guantes y café.",
      starts_at: daysFromNow(-1, 9),
      ends_at: daysFromNow(-1, 11),
      location_text: "Trailhead by the bridge",
      organizerName: "Kim T.",
      orgId: orgs.riverFriends,
      extraGoing: 9,
      viewerGoing: true,
      ...near(2, 2),
    },
    {
      category: "potluck",
      language: "es",
      title: "Comida compartida de la cuadra",
      description: "Trae un platillo para compartir.",
      title_alt: "Block potluck",
      description_alt: "Bring a dish to share.",
      starts_at: daysFromNow(-3, 17),
      ends_at: daysFromNow(-3, 20),
      location_text: "Luis's front yard",
      organizerName: "Luis G.",
      extraGoing: 14,
      viewerGoing: true,
      ...near(-1, -1),
    },
  ];
  for (const sample of samples) {
    const id = db.nextEventId++;
    db.events[id] = { ...base, ...sample, id } as DemoEvent;
  }
}

// The demo has no translation service; the one sample written only in
// English comes with a ready-made Spanish version so the button can be tried.
const DEMO_TRANSLATIONS: Record<string, { title: string; description: string }> = {
  "Alley cleanup": {
    title: "Limpieza del callejón",
    description: "Damos guantes y bolsas. Nos vemos junto al contenedor.",
  },
};

// ---- Helpers ----------------------------------------------------------------------

function member(token: string) {
  const email = userFor(token);
  const db = load();
  const profile = db.profiles[email];
  if (!profile) throw new ApiError("profile_not_found", 404);
  seed(db, profile.neighborhoodId);
  return { email, db, profile };
}

function groupOf(category: string) {
  return CATEGORY_GROUPS.find((g) => g.categories.includes(category))?.key ?? null;
}

/** When it ends: its end time, or midnight Denver time after the start. */
export function eventEnd(event: DemoEvent) {
  if (event.ends_at) return new Date(event.ends_at);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: DENVER }).format(new Date(event.starts_at));
  return new Date(fromDenver(`${day}T00:00`)!.getTime() + DAY);
}

export function ended(event: DemoEvent) {
  return eventEnd(event).getTime() <= Date.now();
}

/** Going: tapped "I'm going", or a sample that pretends you did (until declined). */
export function isGoing(db: Db, event: DemoEvent, email: string) {
  return event.goingEmails.includes(email) || (!!event.viewerGoing && !db.badges[email]?.declined.includes(event.id));
}

export function toJson(db: Db, event: DemoEvent, email: string): EventData {
  const profile = db.profiles[email];
  const organizer = event.organizerEmail ? db.profiles[event.organizerEmail] : null;
  const org = event.orgId ? db.orgs?.[event.orgId] : null;
  const manages = org ? org.adminEmails.includes(email) : event.organizerEmail === email;
  return {
    id: event.id,
    group: groupOf(event.category),
    category: event.category,
    category_other: event.category_other,
    title: event.title,
    description: event.description,
    language: event.language,
    title_alt: event.title_alt,
    description_alt: event.description_alt,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    location_text: event.location_text,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    needs_pin: manages && event.latitude == null && !ended(event) && event.status === "active",
    partiful_url: event.partiful_url,
    status: event.status,
    is_past: ended(event),
    // Organization events never show who posted them.
    organizer_name: org || event.organizerEmail === null ? null : (organizer?.display_name ?? event.organizerName),
    organizer_member_id:
      org || event.organizerEmail === null
        ? null
        : organizer
          ? (organizer.id ?? 1)
          : (SAMPLE_MEMBER_IDS[event.organizerName] ?? null),
    organization: org ? { id: org.id, name: org.name, type: org.type, has_page: org.status === "approved" } : null,
    is_following: !!org && org.followerEmails.includes(email),
    is_organizer: manages,
    going_count: event.goingEmails.length + event.extraGoing + (isGoing(db, event, email) && !event.goingEmails.includes(email) ? 1 : 0),
    is_going: isGoing(db, event, email),
    matches_interests: (profile?.interests ?? []).includes(event.category),
    visibility: event.visibility ?? "neighborhood",
  };
}

function findEvent(db: Db, id: number, neighborhoodId: number, email?: string) {
  const event = db.events[id];
  // Admins also see their organizations' events in other neighborhoods.
  const admin = !!email && !!event?.orgId && !!db.orgs?.[event.orgId]?.adminEmails.includes(email);
  // Milestone 5: so do members who opened its invite link.
  const invited = !!email && !!event?.accessEmails?.includes(email);
  if (!event || (event.neighborhoodId !== neighborhoodId && !admin && !invited)) {
    throw new ApiError("event_not_found", 404);
  }
  return event;
}

function canManage(db: Db, event: DemoEvent, email: string) {
  return event.orgId ? !!db.orgs?.[event.orgId]?.adminEmails.includes(email) : event.organizerEmail === email;
}

function check(input: Partial<EventInput>, existing?: DemoEvent) {
  const merged = { ...existing, ...input } as EventInput & { category_other?: string | null };
  const category = merged.category;
  if (!CATEGORY_KEYS.includes(category) && category !== "other") throw new ApiError("invalid_category", 400);
  const otherText = (merged.category_other ?? "").trim();
  if (category === "other" && !otherText) throw new ApiError("other_needs_text", 400);
  if (otherText.length > 40) throw new ApiError("other_too_long", 400);
  const title = (merged.title ?? "").trim();
  if (!title) throw new ApiError("title_required", 400);
  if (title.length > 80) throw new ApiError("title_too_long", 400);
  const location = (merged.location_text ?? "").trim();
  if (!location) throw new ApiError("location_required", 400);
  if (location.length > 120) throw new ApiError("location_too_long", 400);
  const start = input.starts_at ? fromDenver(input.starts_at) : existing ? new Date(existing.starts_at) : null;
  if (!start) throw new ApiError("start_required", 400);
  const end = input.ends_at ? fromDenver(input.ends_at) : input.ends_at === null ? null : existing?.ends_at ? new Date(existing.ends_at) : null;
  const started = existing && new Date(existing.starts_at).getTime() <= Date.now();
  if (started) {
    if (start.getTime() !== new Date(existing.starts_at).getTime()) throw new ApiError("event_started", 409);
  } else if (start.getTime() <= Date.now()) {
    throw new ApiError("start_in_past", 400);
  }
  if (end && end <= start) throw new ApiError("end_before_start", 400);
  // The map pin (Milestone 3): required, inside Denver, fixed once started.
  const latitude = input.latitude !== undefined ? (input.latitude ?? null) : (existing?.latitude ?? null);
  const longitude = input.longitude !== undefined ? (input.longitude ?? null) : (existing?.longitude ?? null);
  if (latitude === null || longitude === null) throw new ApiError("pin_required", 400);
  if (latitude < 39.55 || latitude > 40.05 || longitude < -105.25 || longitude > -104.55) {
    throw new ApiError("pin_outside_denver", 400);
  }
  if (started && existing.latitude != null && (latitude !== existing.latitude || longitude !== existing.longitude)) {
    throw new ApiError("event_started", 409);
  }
  if (existing && ended(existing) && category !== existing.category) throw new ApiError("category_locked", 409);
  const url = (merged.partiful_url ?? "").trim();
  if (url && !/^https:\/\/(www\.)?partiful\.com(\/|$)/i.test(url)) throw new ApiError("invalid_partiful_url", 400);
  return {
    category,
    category_other: category === "other" ? otherText : null,
    title,
    description: (merged.description ?? "").trim(),
    language: (merged.language ?? "en") as Language,
    title_alt: (merged.title_alt ?? "").trim() || null,
    description_alt: (merged.description_alt ?? "").trim() || null,
    starts_at: toDenver(start),
    ends_at: end ? toDenver(end) : null,
    location_text: location,
    latitude,
    longitude,
    partiful_url: url || null,
    visibility: merged.visibility === "link_only" ? ("link_only" as const) : ("neighborhood" as const),
  };
}

// ---- The endpoints ----------------------------------------------------------------

export async function listEvents(token: string, filter: { group?: string; forYou?: boolean; following?: boolean } = {}) {
  await pause(300);
  const { email, db, profile } = member(token);
  save(db);
  const groupKeys = filter.group ? (CATEGORY_GROUPS.find((g) => g.key === filter.group)?.categories ?? []) : null;
  const events = Object.values(db.events)
    .filter((e) => e.neighborhoodId === profile.neighborhoodId && !ended(e))
    // Link-only events are on no calendar, except their host's own.
    .filter((e) => e.visibility !== "link_only" || canManage(db, e, email))
    .filter((e) => !groupKeys || groupKeys.includes(e.category))
    .filter((e) => !filter.forYou || profile.interests.includes(e.category))
    .filter((e) => !filter.following || (!!e.orgId && !!db.orgs?.[e.orgId]?.followerEmails.includes(email)))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return { events: events.map((e) => toJson(db, e, email)) };
}

export { member as demoMember, findEvent, toDenver };

export async function getEvent(token: string, id: number) {
  await pause(200);
  const { email, db, profile } = member(token);
  save(db);
  return toJson(db, findEvent(db, id, profile.neighborhoodId, email), email);
}

export async function createEvent(token: string, input: EventInput) {
  await pause();
  const { email, db, profile } = member(token);
  const today = Object.values(db.events).filter(
    (e) => e.organizerEmail === email && Date.now() - new Date(e.createdAt).getTime() < DAY,
  );
  if (today.length >= 10) throw new ApiError("daily_limit", 429);
  // Posting as an organization: its admins, one of its neighborhoods.
  let orgId: number | null = null;
  let neighborhoodId = profile.neighborhoodId;
  if (input.organization) {
    const org = db.orgs?.[input.organization];
    if (!org || !org.adminEmails.includes(email)) throw new ApiError("not_org_admin", 403);
    if (org.status !== "approved") throw new ApiError("org_not_approved", 409);
    if (!input.neighborhood || !org.neighborhoodIds.includes(input.neighborhood)) {
      throw new ApiError("neighborhood_not_served", 400);
    }
    orgId = org.id;
    neighborhoodId = input.neighborhood;
  }
  const id = db.nextEventId++;
  db.events[id] = {
    ...check(input),
    id,
    orgId,
    neighborhoodId,
    organizerEmail: email,
    organizerName: profile.display_name,
    goingEmails: [],
    extraGoing: 0,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  if (!orgId) db.profiles[email].role = "organizer";
  save(db);
  return toJson(db, db.events[id], email);
}

export async function updateEvent(token: string, id: number, changes: Partial<EventInput>) {
  await pause();
  const { email, db, profile } = member(token);
  const event = findEvent(db, id, profile.neighborhoodId, email);
  if (!canManage(db, event, email)) throw new ApiError("not_organizer", 403);
  if (event.status === "cancelled") throw new ApiError("event_cancelled", 409);
  db.events[id] = { ...event, ...check(changes, event) };
  save(db);
  return toJson(db, db.events[id], email);
}

export async function cancelEvent(token: string, id: number) {
  await pause();
  const { email, db, profile } = member(token);
  const event = findEvent(db, id, profile.neighborhoodId, email);
  if (!canManage(db, event, email)) throw new ApiError("not_organizer", 403);
  event.status = "cancelled";
  save(db);
  return toJson(db, event, email);
}

export async function setGoing(token: string, id: number, going: boolean, _source?: string) {
  await pause(250);
  const { email, db, profile } = member(token);
  const event = findEvent(db, id, profile.neighborhoodId, email);
  if (event.status === "cancelled") throw new ApiError("event_cancelled", 409);
  if (ended(event)) throw new ApiError("event_past", 409);
  event.goingEmails = event.goingEmails.filter((e) => e !== email);
  if (going) event.goingEmails.push(email);
  save(db);
  return { going_count: event.goingEmails.length + event.extraGoing, is_going: going };
}

export async function reportEvent(token: string, id: number, reason: string) {
  await pause();
  const { db, profile } = member(token);
  findEvent(db, id, profile.neighborhoodId);
  if (!reason.trim()) throw new ApiError("reason_required", 400);
  return { ok: true };
}

/** The demo can't reach Partiful; it knows one sample link. */
export async function partifulPreview(_token: string, url: string) {
  await pause(600);
  if (/^https:\/\/(www\.)?partiful\.com\/e\/demo-potluck/i.test(url.trim())) {
    return { title: "Fall Potluck & Cookout", suggested_category: "potluck" };
  }
  if (/^https:\/\/(www\.)?partiful\.com\/e\/demo-limpieza/i.test(url.trim())) {
    return { title: "Gran limpieza del río", suggested_category: "cleanup" };
  }
  return { title: null, suggested_category: null };
}

export async function translateEvent(token: string, id: number, target: Language): Promise<Translation> {
  await pause(500);
  const { db, profile } = member(token);
  const event = findEvent(db, id, profile.neighborhoodId);
  if (event.language === target) return { title: event.title, description: event.description, target, machine: false };
  if (event.title_alt) {
    return { title: event.title_alt, description: event.description_alt ?? "", target, machine: false };
  }
  const canned = target === "es" ? DEMO_TRANSLATIONS[event.title] : undefined;
  if (!canned) throw new ApiError("translation_unavailable", 503);
  return { ...canned, target, machine: true };
}

// ---- Invite links (Milestone 5) -------------------------------------------------

function inviteCode(event: DemoEvent) {
  return `demo${event.id}x${event.inviteResets ?? 0}`;
}

function inviteFor(event: DemoEvent, language: Language): InviteInfo {
  const code = inviteCode(event);
  const url = `https://globeville.app/e/${code}`;
  const date = new Date(event.starts_at).toLocaleDateString(language === "es" ? "es-US" : "en-US", {
    timeZone: DENVER,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const message =
    language === "es"
      ? `¡Ven a ${event.title} el ${date}! Confirma aquí: ${url}`
      : `Come to ${event.title} on ${date}! RSVP here: ${url}`;
  return { code, url, message };
}

function managed(token: string, id: number) {
  const { email, db, profile } = member(token);
  const event = findEvent(db, id, profile.neighborhoodId, email);
  if (!canManage(db, event, email)) throw new ApiError("not_organizer", 403);
  return { db, event, language: languageOf(db, email) };
}

export async function getInvite(token: string, id: number) {
  await pause(150);
  const { db, event, language } = managed(token, id);
  return inviteFor(event, language);
}

export async function resetInvite(token: string, id: number) {
  await pause();
  const { db, event, language } = managed(token, id);
  event.inviteResets = (event.inviteResets ?? 0) + 1;
  save(db);
  return inviteFor(event, language);
}

export async function logInviteShare(_token: string, _id: number) {
  await pause(50);
}

export async function openInvite(token: string, code: string) {
  await pause(200);
  const { email, db } = member(token);
  const event = Object.values(db.events).find((e) => code.startsWith(`demo${e.id}x`));
  if (!event) throw new ApiError("invite_not_found", 404);
  if (inviteCode(event) !== code) throw new ApiError("invite_revoked", 410);
  event.accessEmails = Array.from(new Set([...(event.accessEmails ?? []), email]));
  save(db);
  return toJson(db, event, email);
}

export async function getGuests(token: string, id: number): Promise<GuestList> {
  await pause(200);
  const { db, event } = managed(token, id);
  const sensitive = event.category === "resource_fair" || event.category === "donation_drive";
  return {
    going_count: event.goingEmails.length + event.extraGoing,
    names_hidden: sensitive,
    members: sensitive ? [] : event.goingEmails.map((e) => ({ display_name: db.profiles[e]?.display_name ?? "" })),
    // The demo has no web guests (they RSVP by text on the real server).
    guests: [],
    came: null,
  };
}

export async function removeGuest(_token: string, _id: number, _guestId: number) {
  await pause();
  throw new ApiError("guest_not_found", 404);
}

/** The demo has no guest RSVPs, so there's never a badge to claim. */
export async function claimBadge(_token: string, _claim: { token: string } | { code: string }): Promise<{ celebrations: never[] }> {
  await pause();
  throw new ApiError("claim_not_found", 404);
}
