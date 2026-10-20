/**
 * Event categories on the phone. The list comes from the server
 * (GET /api/config, built from backend/events/categories.py); the app keeps
 * no copy of its own. Words come from the language files: categories.<key>,
 * category_groups.<key> and category_hints.<key>.
 */
import type Ionicons from "@expo/vector-icons/Ionicons";
import type { TFunction } from "i18next";
import { ComponentProps, createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { AppConfig, CategoryGroup, getConfig } from "./api";
import i18n from "./i18n";
import { groupAccent, OTHER_ACCENT } from "./theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

export const GROUP_ICONS: Record<string, IconName> = {
  celebrate: "sparkles-outline",
  buy_swap: "pricetags-outline",
  entertainment: "musical-notes-outline",
  get_active: "basketball-outline",
  community: "heart-outline",
  learn_connect: "school-outline",
};

type CategoriesState = {
  groups: CategoryGroup[];
  other: string;
  otherMaxLength: number;
  maxInterests: number;
  /** The oldest app version the server works with ("" = any). */
  minAppVersion: string;
  ready: boolean;
  failed: boolean;
  reload: () => void;
};

const CategoriesContext = createContext<CategoriesState | null>(null);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    setFailed(false);
    getConfig()
      .then(setConfig)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value: CategoriesState = {
    groups: config?.category_groups ?? [],
    other: config?.other_category ?? "other",
    otherMaxLength: config?.other_max_length ?? 40,
    maxInterests: config?.max_interests ?? 8,
    minAppVersion: config?.min_app_version ?? "",
    ready: !!config,
    failed,
    reload,
  };
  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): CategoriesState {
  const value = useContext(CategoriesContext);
  if (!value) throw new Error("useCategories must be used inside <CategoriesProvider>");
  return value;
}

export function groupOf(groups: CategoryGroup[], category: string): string | null {
  return groups.find((group) => group.categories.includes(category))?.key ?? null;
}

export function accentFor(group: string | null | undefined) {
  return (group && groupAccent[group]) || OTHER_ACCENT;
}

/** "Potluck / Cookout", or the organizer's own words for "Other". */
export function categoryLabel(t: TFunction, category: string, otherText?: string | null) {
  if (category === "other" && otherText) return otherText;
  return t(`categories.${category}`, { defaultValue: category });
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Categories whose name or search hints match the query, in English OR
 * Spanish (so "limpieza" finds Cleanup even in English). Accents don't
 * matter: "loteria" finds "lotería".
 */
export function searchCategories(groups: CategoryGroup[], query: string, includeOther = false): string[] {
  const needle = normalize(query.trim());
  if (!needle) return [];
  const keys = groups.flatMap((group) => group.categories);
  if (includeOther) keys.push("other");
  return keys.filter((key) =>
    (["en", "es"] as const).some((language) => {
      const t = i18n.getFixedT(language);
      const words = `${t(`categories.${key}`)},${t(`category_hints.${key}`, { defaultValue: "" })}`;
      return normalize(words).includes(needle);
    }),
  );
}
