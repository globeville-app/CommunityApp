import type { Profile } from "./api";

/** "LoHi (Highland)" when an alias was chosen, otherwise just "Highland". */
export function neighborhoodLabel(profile: Profile) {
  const official = profile.neighborhood.name;
  return profile.alias ? `${profile.alias} (${official})` : official;
}
