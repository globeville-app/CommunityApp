/**
 * Events tab: the neighborhood's upcoming events, soonest first, with
 * "For you", All and group filters.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ApiError, EventData, getMyProfile, listEvents, Profile } from "../../api";
import { useAuth } from "../../auth";
import { useCategories } from "../../categories";
import { EventCard } from "../../components/EventCard";
import { errorMessage } from "../../i18n/errors";
import { resetTo } from "../../navigation";
import { colors, MIN_TOUCH, space, type } from "../../theme";
import { Button, Caption, ErrorMessage, GlassCard, Hero, Intro, Loading, Screen } from "../../ui";

/** "for_you", "all", or a group key. */
type Filter = string;

export default function Events() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { groups } = useCategories();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<EventData[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(
    async (which: Filter) => {
      if (!token) return;
      setError(null);
      try {
        const [me, list] = await Promise.all([
          getMyProfile(token),
          listEvents(token, {
            forYou: which === "for_you",
            group: which !== "all" && which !== "for_you" ? which : undefined,
          }),
        ]);
        setProfile(me);
        setEvents(list.events);
      } catch (e) {
        const err = e as ApiError;
        if (err.code === "profile_not_found") resetTo("/address");
        else setError(err);
      }
    },
    [token],
  );

  // Reload whenever the tab comes into view, e.g. after posting an event.
  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter]),
  );

  function choose(next: Filter) {
    if (next === "for_you" && profile && profile.interests.length === 0) {
      router.push("/interests"); // nothing to match yet: pick interests first
      return;
    }
    setFilter(next);
  }

  if (error && !events) {
    return (
      <Screen>
        <ErrorMessage message={errorMessage(t, error)} />
        <Button title={t("common.try_again")} onPress={() => load(filter)} />
      </Screen>
    );
  }
  if (!profile || !events) return <Loading />;

  const noInterests = profile.interests.length === 0;
  const filters: { key: Filter; label: string }[] = [
    { key: "for_you", label: noInterests ? t("events.filter_pick_interests") : t("events.filter_for_you") },
    { key: "all", label: t("events.filter_all") },
    ...groups.map((g) => ({ key: g.key, label: t(`category_groups_short.${g.key}`) })),
  ];
  const empty =
    filter === "for_you" ? t("events.empty_for_you") : filter === "all" ? t("events.empty") : t("events.empty_group");

  return (
    <Screen>
      <View style={styles.header}>
        {/* Neighborhood names are never translated. */}
        <Hero fit>{profile.alias || profile.neighborhood.name}</Hero>
        <Intro>{t("events.upcoming")}</Intro>
      </View>
      <Button
        title={t("events.post_button")}
        onPress={() => router.push("/event-form")}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        accessibilityLabel={t("events.filter_label")}
      >
        {filters.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable
              key={f.key}
              accessibilityRole="button"
              accessibilityLabel={f.label}
              accessibilityState={{ selected: on }}
              onPress={() => choose(f.key)}
              style={[styles.filter, on && styles.filterOn]}
            >
              <Text style={[type.label, { color: on ? colors.base : colors.textPrimary }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ErrorMessage message={errorMessage(t, error)} />
      {events.length === 0 ? (
        <GlassCard>
          <Caption onGlass>{empty}</Caption>
        </GlassCard>
      ) : (
        events.map((event) => <EventCard key={event.id} event={event} />)
      )}
      {/* Room for the floating tab bar. */}
      <View style={{ height: 96 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.xs },
  filters: { gap: space.xs, paddingVertical: 4 },
  filter: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: 16,
    borderRadius: MIN_TOUCH / 2,
    justifyContent: "center",
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  filterOn: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
});
