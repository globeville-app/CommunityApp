/**
 * An event in the list: date block, category chip, title, time and place,
 * how many neighbors are going, and "For you" / "Cancelled" tags.
 */
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { EventData } from "../api";
import { dateBlock, timeRange } from "../i18n/dates";
import { useLanguage } from "../language";
import { colors, radius, space, type } from "../theme";
import { CategoryChip } from "./CategoryChip";

/** The organizer's text, or their version in the reader's language when there is one. */
export function titleFor(event: EventData, language: string) {
  return event.language !== language && event.title_alt ? event.title_alt : event.title;
}

export function DateBlock({ startsAt }: { startsAt: string }) {
  const { language } = useLanguage();
  const [top, bottom] = dateBlock(new Date(startsAt), language);
  return (
    <View style={styles.dateBlock}>
      <Text style={styles.dateTop}>{top}</Text>
      <Text style={styles.dateBottom}>{bottom}</Text>
    </View>
  );
}

export function EventCard({ event }: { event: EventData }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const cancelled = event.status === "cancelled";
  const title = titleFor(event, language);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => router.push({ pathname: "/event/[id]", params: { id: String(event.id) } })}
      style={({ pressed }) => [styles.card, cancelled && styles.cancelledCard, pressed && { opacity: 0.8 }]}
    >
      <DateBlock startsAt={event.starts_at} />
      <View style={styles.body}>
        <View style={styles.tags}>
          <CategoryChip category={event.category} group={event.group} otherText={event.category_other} small />
          {event.matches_interests && !cancelled ? (
            <View style={styles.forYou}>
              <Text style={styles.forYouText}>{t("events.for_you_tag")}</Text>
            </View>
          ) : null}
          {cancelled ? (
            <View style={styles.cancelled}>
              <Text style={styles.cancelledText}>{t("events.cancelled")}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[type.section, styles.title, cancelled && styles.struck]}>{title}</Text>
        <Text style={[type.caption, styles.muted]}>
          {timeRange(event.starts_at, event.ends_at, language)} · {event.location_text}
        </Text>
        <Text style={[type.caption, styles.going]}>{t("events.going_count", { count: event.going_count })}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: space.m,
    padding: space.m,
    borderRadius: radius.card,
    backgroundColor: colors.glassDark,
    borderWidth: 1,
    borderColor: colors.glassDarkBorder,
  },
  cancelledCard: { opacity: 0.7 },
  dateBlock: {
    width: 60,
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: colors.glowYellow,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  dateTop: { color: colors.base, fontFamily: "Outfit_600SemiBold", fontSize: 14 },
  dateBottom: { color: colors.base, fontFamily: "Outfit_600SemiBold", fontSize: 20 },
  body: { flex: 1, gap: 6 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  title: { color: colors.textPrimary },
  struck: { textDecorationLine: "line-through" },
  muted: { color: colors.textSecondary },
  going: { color: colors.glowTurquoise },
  forYou: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.glowYellow },
  forYouText: { color: colors.base, fontFamily: "Outfit_600SemiBold", fontSize: 12 },
  cancelled: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: colors.danger },
  cancelledText: { color: colors.danger, fontFamily: "Outfit_600SemiBold", fontSize: 12 },
});
