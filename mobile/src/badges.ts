/**
 * Badge words and progress, shared by the badge screens. The rules
 * (thresholds) come from the server (GET /api/badges/catalog, from
 * backend/badges/config.py); the app never hard-codes them. Words come from
 * the language files: badges.<key>.name / .description / .unit.
 */
import type { TFunction } from "i18next";

import type { BadgeCatalog, BadgeData } from "./apiTypes";
import { STAGE_KEYS } from "./components/badges/emblems";

export function badgeName(t: TFunction, key: string) {
  return t(`badges.${key}.name`);
}

/** "Bloom". stage 1–5. */
export function stageName(t: TFunction, stage: number) {
  return t(`badges.stage.${STAGE_KEYS[Math.min(Math.max(stage, 1), 5) - 1]}`);
}

/** "5 cleanups". */
export function countLine(t: TFunction, key: string, count: number) {
  return t("badges.count", { count, units: t(`badges.${key}.unit`, { count }) });
}

/** The threshold the current stage started at (0 before Seed). */
export function stageStart(catalog: BadgeCatalog | null, badge: BadgeData) {
  const thresholds = catalog?.badges.find((b) => b.key === badge.key)?.thresholds ?? [];
  return badge.stage > 0 ? thresholds[badge.stage - 1] ?? 0 : 0;
}

/** 0–1 of the way from this stage to the next. */
export function progress(catalog: BadgeCatalog | null, badge: BadgeData) {
  if (!badge.next_threshold) return 1;
  const start = stageStart(catalog, badge);
  const span = badge.next_threshold - start;
  return span > 0 ? Math.min(Math.max((badge.count - start) / span, 0), 1) : 0;
}

/**
 * My Impact's progress list: growth badges with some progress that still
 * have a next stage, closest to it first (fewest to go, then furthest along).
 */
export function inProgress(catalog: BadgeCatalog | null, badges: BadgeData[]) {
  return badges
    .filter((b) => b.kind === "growth" && b.count > 0 && b.next_threshold !== null)
    .sort((a, b) => {
      const left = a.next_threshold! - a.count;
      const right = b.next_threshold! - b.count;
      return left - right || progress(catalog, b) - progress(catalog, a);
    });
}
