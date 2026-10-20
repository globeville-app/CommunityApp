/**
 * BROWSER DEMO ONLY: organizations and notifications, pretend version.
 * Follows the real backend's rules (backend/organizations/) and error codes.
 * The demo has no team to review requests, so a request is approved at
 * once; the real app waits for the team.
 */
import {
  ApiError,
  BadgeData,
  Impact,
  MyOrg,
  NeighborhoodRef,
  OrgInput,
  OrgPage,
  OrgSummary,
  ORG_TYPES,
  ProfileSettings,
} from "../apiTypes";
import { BADGE_RULES, ALL_NEIGHBORHOODS, DemoOrg, Db, load, neighborhoodCenter, pause, save, userFor } from "./fakeBackend";
import { demoMember, ended, toJson } from "./fakeEvents";

// ---- Sample organizations -------------------------------------------------------

/** Two made-up groups in each neighborhood, created the first time it's visited. */
export function seedOrgs(db: Db, neighborhoodId: number) {
  db.orgs ??= {};
  db.seededOrgNeighborhoods ??= [];
  db.nextOrgId ??= 1;
  if (db.seededOrgNeighborhoods.includes(neighborhoodId)) return {} as Record<string, number>;
  db.seededOrgNeighborhoods.push(neighborhoodId);
  const make = (org: Omit<DemoOrg, "id" | "status" | "neighborhoodIds" | "adminEmails" | "followerEmails" | "photo_url">) => {
    const id = db.nextOrgId++;
    db.orgs[id] = {
      ...org,
      id,
      status: "approved",
      neighborhoodIds: [neighborhoodId],
      adminEmails: ["sample@neighbors.demo"],
      followerEmails: [],
      photo_url: null,
    };
    return id;
  };
  return {
    recClub: make({
      name: "Riverside Rec Club",
      type: "club",
      description: "Lotería, pickup games and family nights at the rec center.",
      description_alt: "Lotería, partidos y noches familiares en el centro recreativo.",
      language: "en",
      link: null,
      extraFollowers: 31,
    }),
    riverFriends: make({
      name: "Friends of the River Trail",
      type: "nonprofit",
      description: "Volunteers who keep the river trail clean, one Saturday at a time.",
      description_alt: null,
      language: "en",
      link: "https://example.org/river",
      extraFollowers: 12,
    }),
  };
}

function visibleOrg(db: Db, email: string, neighborhoodId: number, id: number) {
  const org = db.orgs?.[id];
  const isAdmin = !!org && org.adminEmails.includes(email);
  if (!org || (!isAdmin && (org.status !== "approved" || !org.neighborhoodIds.includes(neighborhoodId)))) {
    throw new ApiError("org_not_found", 404);
  }
  return org;
}

function summary(org: DemoOrg): OrgSummary {
  return { id: org.id, name: org.name, type: org.type, photo_url: org.photo_url };
}

function neighborhoods(ids: number[]): NeighborhoodRef[] {
  const all = ALL_NEIGHBORHOODS();
  return ids
    .map((id) => all.find((n) => n.id === id))
    .filter((n): n is NeighborhoodRef => !!n)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Hosting badges from the sample orgs' made-up history. */
function orgBadges(org: DemoOrg): BadgeData[] {
  const sample: Record<string, [number, number]> =
    org.type === "club" ? { host: [3, 41], fiestero: [2, 3], aficionado: [3, 6] } : org.type === "nonprofit" ? { host: [2, 14], clean_sweeper: [3, 7], helping_hand: [3, 8] } : {};
  return Object.entries(sample).map(([key, [stage, count]]) => ({
    key,
    kind: "growth" as const,
    stage,
    count,
    next_threshold: BADGE_RULES.thresholds[BADGE_RULES.growth.find((b) => b.key === key)?.track ?? "occasional"]?.[stage] ?? null,
    earned_at: null,
  }));
}

function page(db: Db, org: DemoOrg, email: string, neighborhoodId: number): OrgPage {
  const isAdmin = org.adminEmails.includes(email);
  const events = Object.values(db.events).filter(
    (e) => e.orgId === org.id && e.status === "active" && (isAdmin || e.neighborhoodId === neighborhoodId),
  );
  const upcoming = events.filter((e) => !ended(e)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const data: OrgPage = {
    ...summary(org),
    description: org.description,
    description_alt: org.description_alt,
    language: org.language,
    link: org.link,
    neighborhoods: neighborhoods(org.neighborhoodIds),
    badges: orgBadges(org),
    upcoming_events: upcoming.map((e) => toJson(db, e, email)),
    past_event_count: events.length - upcoming.length,
    is_following: org.followerEmails.includes(email),
    is_admin: isAdmin,
  };
  if (isAdmin) {
    Object.assign(data, {
      status: org.status,
      follower_count: org.followerEmails.length + org.extraFollowers,
      change_pending: false,
      pending_invites: org.pendingInvites ?? 0,
      admins: org.adminEmails.map((adminEmail) => {
        const profile = db.profiles[adminEmail];
        return { member_id: profile?.id ?? null, display_name: profile?.display_name ?? null, is_you: adminEmail === email };
      }),
    });
  }
  return data;
}

function check(input: Partial<OrgInput>) {
  const name = (input.name ?? "").trim();
  if (!name) throw new ApiError("org_name_required", 400);
  if (name.length > 60) throw new ApiError("org_name_too_long", 400);
  if (!input.type || !(ORG_TYPES as readonly string[]).includes(input.type)) throw new ApiError("invalid_org_type", 400);
  if (input.type === "business" && input.business_rule_accepted !== true) throw new ApiError("business_rule", 400);
  if (!input.neighborhoods?.length) throw new ApiError("neighborhoods_required", 400);
  const link = (input.link ?? "").trim();
  if (link && !/^https:\/\/[^\s/]+/.test(link)) throw new ApiError("invalid_link", 400);
  if ((input.description ?? "").length > 500) throw new ApiError("org_description_too_long", 400);
  return { name, type: input.type, link: link || null };
}

// ---- The endpoints ----------------------------------------------------------------

export async function listNeighborhoods(_token: string) {
  return { neighborhoods: ALL_NEIGHBORHOODS() };
}

export async function listOrganizations(token: string) {
  await pause(250);
  const { db, profile } = demoMember(token);
  save(db);
  const orgs = Object.values(db.orgs ?? {})
    .filter((o) => o.status === "approved" && o.neighborhoodIds.includes(profile.neighborhoodId))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { organizations: orgs.map(summary) };
}

export async function getMyOrganizations(token: string): Promise<{ organizations: MyOrg[] }> {
  const { email, db } = demoMember(token);
  const mine = Object.values(db.orgs ?? {}).filter((o) => o.adminEmails.includes(email));
  return {
    organizations: mine.map((o) => ({
      ...summary(o),
      status: o.status,
      neighborhoods: neighborhoods(o.neighborhoodIds).map((n) => ({ ...n, center: neighborhoodCenter(n.id) })),
    })),
  };
}

export async function requestOrganization(token: string, input: OrgInput) {
  await pause();
  const { email, db, profile } = demoMember(token);
  const { name, type, link } = check(input);
  const id = (db.nextOrgId = (db.nextOrgId ?? 1) + 1) - 1;
  db.orgs[id] = {
    id,
    name,
    type,
    description: (input.description ?? "").trim(),
    description_alt: (input.description_alt ?? "").trim() || null,
    language: input.language ?? "en",
    link,
    photo_url: null,
    status: "approved", // the demo has no team to review it
    neighborhoodIds: input.neighborhoods,
    adminEmails: [email],
    followerEmails: [],
    extraFollowers: 0,
  };
  save(db);
  return page(db, db.orgs[id], email, profile.neighborhoodId);
}

export async function getOrganization(token: string, id: number) {
  await pause(200);
  const { email, db, profile } = demoMember(token);
  return page(db, visibleOrg(db, email, profile.neighborhoodId, id), email, profile.neighborhoodId);
}

export async function updateOrganization(token: string, id: number, changes: Partial<OrgInput>) {
  await pause();
  const { email, db, profile } = demoMember(token);
  const org = visibleOrg(db, email, profile.neighborhoodId, id);
  if (!org.adminEmails.includes(email)) throw new ApiError("not_org_admin", 403);
  const { name, type, link } = check({
    name: org.name,
    type: org.type,
    link: org.link ?? "",
    neighborhoods: org.neighborhoodIds,
    business_rule_accepted: true,
    ...changes,
  });
  Object.assign(org, {
    name,
    type,
    link,
    description: (changes.description ?? org.description).trim(),
    description_alt: (changes.description_alt ?? org.description_alt ?? "").trim() || null,
    neighborhoodIds: changes.neighborhoods ?? org.neighborhoodIds,
  });
  save(db);
  return page(db, org, email, profile.neighborhoodId);
}

export async function uploadOrganizationPhoto(token: string, id: number, photo: { uri: string; mimeType: string }) {
  const { email, db, profile } = demoMember(token);
  const org = visibleOrg(db, email, profile.neighborhoodId, id);
  org.photo_url = photo.uri;
  save(db);
  return page(db, org, email, profile.neighborhoodId);
}

export async function addOrganizationAdmin(token: string, id: number, _adminEmail: string) {
  await pause();
  const { email, db, profile } = demoMember(token);
  const org = visibleOrg(db, email, profile.neighborhoodId, id);
  if (!org.adminEmails.includes(email)) throw new ApiError("not_org_admin", 403);
  // Like the real server: an invitation, the same answer for any email. The
  // demo's pretend neighbors never answer, so it only counts them.
  if (org.adminEmails.length + (org.pendingInvites ?? 0) >= 5) throw new ApiError("too_many_admins", 400);
  org.pendingInvites = (org.pendingInvites ?? 0) + 1;
  save(db);
  return page(db, org, email, profile.neighborhoodId);
}

export async function cancelOrganizationInvites(token: string, id: number) {
  await pause(200);
  const { email, db, profile } = demoMember(token);
  const org = visibleOrg(db, email, profile.neighborhoodId, id);
  org.pendingInvites = 0;
  save(db);
  return page(db, org, email, profile.neighborhoodId);
}

export async function getOrganizationInvites(_token: string) {
  await pause(200);
  return { invites: [] };
}

export async function answerOrganizationInvite(_token: string, _inviteId: number, _accept: boolean) {
  await pause(200);
}

export async function removeOrganizationAdmin(token: string, id: number, memberId: number) {
  const { email, db, profile } = demoMember(token);
  const org = visibleOrg(db, email, profile.neighborhoodId, id);
  if (org.adminEmails.length <= 1) throw new ApiError("last_admin", 409);
  const who = org.adminEmails.find((e) => db.profiles[e]?.id === memberId);
  if (!who) throw new ApiError("not_an_admin", 400);
  org.adminEmails = org.adminEmails.filter((e) => e !== who);
  save(db);
  return who === email ? undefined : page(db, org, email, profile.neighborhoodId);
}

export async function setFollowing(token: string, id: number, follow: boolean) {
  await pause(200);
  const { email, db, profile } = demoMember(token);
  const org = visibleOrg(db, email, profile.neighborhoodId, id);
  org.followerEmails = org.followerEmails.filter((e) => e !== email);
  if (follow) org.followerEmails.push(email);
  save(db);
  return { is_following: follow };
}

export async function reportOrganization(token: string, id: number, reason: string) {
  const { email, db, profile } = demoMember(token);
  visibleOrg(db, email, profile.neighborhoodId, id);
  if (!reason.trim()) throw new ApiError("reason_required", 400);
  return { ok: true };
}

export async function translateOrganization(_token: string, _id: number, _target: string): Promise<never> {
  throw new ApiError("translation_unavailable", 503);
}

export async function getOrganizationImpact(token: string, id: number): Promise<{ impact: Impact; badges: BadgeData[] }> {
  const { email, db, profile } = demoMember(token);
  const org = visibleOrg(db, email, profile.neighborhoodId, id);
  return { impact: {}, badges: orgBadges(org) };
}

// ---- Notifications (nothing is ever sent in the demo) ---------------------------

export async function registerPushToken() {}
export async function removePushToken() {}

export async function markNotifOfferSeen(token: string) {
  const email = userFor(token);
  const db = load();
  if (db.profiles[email]) db.profiles[email].notif_offer_shown = true;
  save(db);
}

export type { ProfileSettings };
