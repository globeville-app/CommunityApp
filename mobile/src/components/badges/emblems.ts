/**
 * Which Lucide icon each badge uses, and which parts of it are yellow
 * (docs/BADGE_UI.md, Emblem icons). Part numbers are the drawing order in
 * lucideData.ts (Lucide 1.59.0). Where a part moved since 1.47.0, the part
 * is matched to the description in the doc instead:
 *   - door-open: the door frame is part 1 now (it was part 0)
 *   - languages: the "A" is parts 4-5 (part 3 is now the top of the 文)
 *   - smile: the eyes are parts 0 and 2 (they were 2-3)
 *   - sun-snow: the sun is parts 0, 1, 2, 7, 9 and 10 (its rays are spread out)
 */

export const STAGE_PIP_ICONS = ["bean", "sprout", "flower", "tree-pine", "trees"] as const;

export type Emblem = {
  icon: string | "lantern";
  /** Parts drawn as a yellow outline. */
  outline?: number[];
  /** Parts filled yellow. */
  fill?: number[];
  /** Helping Hand's coin, in Lucide units. */
  coin?: boolean;
};

export const EMBLEMS: Record<string, Emblem> = {
  local: { icon: "house", outline: [0] },
  best_guest: { icon: "blend" },
  host: { icon: "lantern" },
  day_one: { icon: "heart", fill: [0] },
  fiestero: { icon: "party-popper" },
  treasure_hunter: { icon: "store" },
  aficionado: { icon: "sparkles", fill: [0] },
  recreationist: { icon: "zap", fill: [0] },
  helping_hand: { icon: "hand-helping", coin: true },
  clean_sweeper: { icon: "broom-sparkles", outline: [0, 1, 4, 5, 6, 8] },
  civic_voice: { icon: "megaphone", outline: [1] },
  ambassador: { icon: "languages", outline: [4, 5] },
  open_door: { icon: "door-open", outline: [1] },
  familiar_face: { icon: "smile", outline: [0, 2] },
  year_rounder: { icon: "sun-snow", outline: [0, 1, 2, 7, 9, 10] },
};

export const GROWTH_KEYS = [
  "local",
  "best_guest",
  "host",
  "day_one",
  "fiestero",
  "treasure_hunter",
  "aficionado",
  "recreationist",
  "helping_hand",
  "clean_sweeper",
  "civic_voice",
] as const;
export const KEEPSAKE_KEYS = ["ambassador", "open_door", "familiar_face", "year_rounder"] as const;
export const STAGE_KEYS = ["seed", "sprout", "bloom", "tree", "grove"] as const;
