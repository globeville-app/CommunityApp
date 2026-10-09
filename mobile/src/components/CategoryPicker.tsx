/**
 * The category picker, built once and used two ways (docs/MILESTONE_2.md):
 *
 *  - mode "single" (posting an event): six group tiles under a search box.
 *    A tile opens its categories, with "Other" at the bottom; "Other" asks
 *    for a few words.
 *  - mode "multi" (interests): every group as an open section of chips, up
 *    to `max` picks, no "Other", with a "3 of 8" counter.
 *
 * Search matches English and Spanish names and hints in both modes.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { accentFor, GROUP_ICONS, groupOf, searchCategories, useCategories } from "../categories";
import { alpha, colors, MIN_TOUCH, radius, space, type } from "../theme";
import { Button, Caption, ErrorMessage, Field, Section } from "../ui";
import { CategoryChip } from "./CategoryChip";

type SingleProps = {
  mode: "single";
  value: string | null;
  otherText: string;
  onChange: (category: string, otherText: string) => void;
};

type MultiProps = {
  mode: "multi";
  selected: string[];
  onChange: (selected: string[]) => void;
};

export function CategoryPicker(props: SingleProps | MultiProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  return (
    <View style={styles.wrap}>
      <Field
        label={t("picker.search_label")}
        icon="search-outline"
        placeholder={t("picker.search_placeholder")}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {props.mode === "single" ? <SinglePicker {...props} query={query} /> : <MultiPicker {...props} query={query} />}
    </View>
  );
}

// ---- Choose one (events) ---------------------------------------------------------

function SinglePicker({ value, otherText, onChange, query }: SingleProps & { query: string }) {
  const { t } = useTranslation();
  const { groups, other, otherMaxLength } = useCategories();
  const [openGroup, setOpenGroup] = useState<string | null>(value && value !== other ? groupOf(groups, value) : null);
  const [writingOther, setWritingOther] = useState(value === other);
  const [draft, setDraft] = useState(otherText);
  const [otherError, setOtherError] = useState(false);

  function choose(category: string) {
    if (category === other) {
      setWritingOther(true);
      return;
    }
    setWritingOther(false);
    onChange(category, "");
  }

  function useOther() {
    if (!draft.trim()) {
      setOtherError(true);
      return;
    }
    setOtherError(false);
    onChange(other, draft.trim());
  }

  const otherBox = writingOther ? (
    <View style={styles.otherBox}>
      <Field
        label={t("picker.other_label")}
        value={draft}
        onChangeText={(text) => {
          setDraft(text);
          setOtherError(false);
        }}
        maxLength={otherMaxLength}
      />
      <ErrorMessage message={otherError ? t("errors.other_needs_text") : null} />
      <Button title={t("picker.use_other")} variant="secondary" onPress={useOther} />
    </View>
  ) : null;

  if (query.trim()) {
    const results = searchCategories(groups, query, true);
    return (
      <View style={styles.wrap}>
        {results.length === 0 ? <Caption>{t("picker.no_results")}</Caption> : null}
        <View style={styles.chips}>
          {results.map((key) => (
            <CategoryChip
              key={key}
              category={key}
              group={groupOf(groups, key)}
              selected={value === key}
              onPress={() => choose(key)}
            />
          ))}
        </View>
        {otherBox}
      </View>
    );
  }

  if (openGroup) {
    const group = groups.find((g) => g.key === openGroup);
    return (
      <View style={styles.wrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("picker.all_groups")}
          onPress={() => setOpenGroup(null)}
          style={styles.backLink}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textSoft} />
          <Text style={[type.label, { color: colors.textSoft }]}>{t("picker.all_groups")}</Text>
        </Pressable>
        <Section>{t(`category_groups.${openGroup}`)}</Section>
        <View style={styles.chips}>
          {(group?.categories ?? []).map((key) => (
            <CategoryChip key={key} category={key} group={openGroup} selected={value === key} onPress={() => choose(key)} />
          ))}
          <CategoryChip category={other} group={null} selected={value === other} onPress={() => choose(other)} />
        </View>
        {otherBox}
      </View>
    );
  }

  return (
    <View style={styles.tiles}>
      {groups.map((group) => (
        <GroupTile key={group.key} group={group.key} onPress={() => setOpenGroup(group.key)} />
      ))}
    </View>
  );
}

function GroupTile({ group, onPress }: { group: string; onPress: () => void }) {
  const { t } = useTranslation();
  const accent = accentFor(group);
  const label = t(`category_groups.${group}`);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: alpha(accent, 0.16), borderColor: alpha(accent, 0.6) },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Ionicons name={GROUP_ICONS[group] ?? "ellipse-outline"} size={28} color={accent} />
      <Text style={[type.label, styles.tileLabel]}>{label}</Text>
    </Pressable>
  );
}

// ---- Choose several (interests) ---------------------------------------------------

function MultiPicker({ selected, onChange, query }: MultiProps & { query: string }) {
  const { t } = useTranslation();
  const { groups, maxInterests } = useCategories();
  const [closed, setClosed] = useState<string[]>([]);
  const [atLimit, setAtLimit] = useState(false);

  function toggle(key: string) {
    if (selected.includes(key)) {
      setAtLimit(false);
      onChange(selected.filter((k) => k !== key));
    } else if (selected.length >= maxInterests) {
      setAtLimit(true); // a 9th pick is blocked, with a message
    } else {
      onChange([...selected, key]);
    }
  }

  const chip = (key: string) => (
    <CategoryChip key={key} category={key} group={groupOf(groups, key)} selected={selected.includes(key)} onPress={() => toggle(key)} />
  );

  return (
    <View style={styles.wrap}>
      <Text style={[type.label, { color: colors.glowYellow }]}>
        {t("picker.counter", { count: selected.length, max: maxInterests })}
      </Text>
      <ErrorMessage message={atLimit ? t("picker.limit_reached", { max: maxInterests }) : null} />

      {query.trim() ? (
        <>
          {/* "Other" is never an interest. */}
          {searchCategories(groups, query).length === 0 ? <Caption>{t("picker.no_results")}</Caption> : null}
          <View style={styles.chips}>{searchCategories(groups, query).map(chip)}</View>
        </>
      ) : (
        groups.map((group) => {
          const open = !closed.includes(group.key);
          const label = t(`category_groups.${group.key}`);
          return (
            <View key={group.key} style={styles.section}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={open ? t("picker.hide_group", { group: label }) : t("picker.show_group", { group: label })}
                accessibilityState={{ expanded: open }}
                onPress={() =>
                  setClosed((current) => (open ? [...current, group.key] : current.filter((k) => k !== group.key)))
                }
                style={styles.sectionHeader}
              >
                <Ionicons name={GROUP_ICONS[group.key] ?? "ellipse-outline"} size={20} color={accentFor(group.key)} />
                <Text style={[type.section, styles.sectionTitle]}>{label}</Text>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
              </Pressable>
              {open ? <View style={styles.chips}>{group.categories.map(chip)}</View> : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
  tile: {
    // Two per row; Spanish names wrap inside the tile.
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 104,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.m,
    gap: space.xs,
    justifyContent: "space-between",
  },
  tileLabel: { color: colors.textPrimary, fontSize: 15 },
  backLink: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: MIN_TOUCH, alignSelf: "flex-start" },
  otherBox: { gap: space.s, marginTop: space.xs },
  section: { gap: space.xs },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: MIN_TOUCH },
  sectionTitle: { flex: 1, color: colors.textPrimary },
});
