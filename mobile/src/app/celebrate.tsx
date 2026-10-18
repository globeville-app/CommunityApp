/**
 * The unlock moment (docs/MILESTONE_3.md, step 7): every unseen celebration
 * in one full-screen moment, swipeable when there are several. The ring
 * fills to its new stage, or is shown still when reduce-motion is on.
 * Share / Not now. Leaving marks them all as seen.
 */
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Animated, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Celebration, getCelebrations, getMyBadges, markCelebrationsSeen } from "../api";
import { useAuth } from "../auth";
import { badgeName, countLine, stageName } from "../badges";
import { Badge } from "../components/badges/Badge";
import { KEEPSAKE_KEYS } from "../components/badges/emblems";
import { colors, SCREEN_PADDING, space, type } from "../theme";
import { Body, Button, Loading, TextLink } from "../ui";

const isKeepsake = (key: string) => (KEEPSAKE_KEYS as readonly string[]).includes(key);

export function useReduceMotion() {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduce)
      .catch(() => setReduce(false));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** The badge: fills from the stage before to the new one, unless reduce-motion is on. */
function GrowingBadge({ celebration, still }: { celebration: Celebration; still: boolean }) {
  const kind = isKeepsake(celebration.badge_key) ? "keepsake" : "growth";
  const from = celebration.kind === "stage_up" ? celebration.stage - 1 : celebration.stage;
  const [stage, setStage] = useState(still ? celebration.stage : from);
  const glow = useRef(new Animated.Value(still ? 1 : 0)).current;

  useEffect(() => {
    if (still) return;
    Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    const timer = setTimeout(() => setStage(celebration.stage), 600);
    return () => clearTimeout(timer);
  }, [still, glow, celebration.stage]);

  return (
    <Animated.View
      testID={still ? "badge-still" : "badge-animated"}
      style={{ opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}
    >
      <Badge badgeKey={celebration.badge_key} kind={kind} stage={stage} count={celebration.count} size={200} />
    </Animated.View>
  );
}

export default function Celebrate() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const [celebrations, setCelebrations] = useState<Celebration[] | null>(null);
  const [earned, setEarned] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    Promise.all([getCelebrations(token), getMyBadges(token)])
      .then(([unseen, mine]) => {
        if (unseen.celebrations.length === 0) router.back();
        setCelebrations(unseen.celebrations);
        setEarned(new Set(mine.badges.filter((b) => b.stage > 0).map((b) => b.key)));
      })
      .catch(() => router.back());
  }, [token]);

  if (!celebrations || reduceMotion === null) return <Loading />;

  async function done(then?: () => void) {
    if (token && celebrations) await markCelebrationsSeen(token, celebrations.map((c) => c.id)).catch(() => undefined);
    router.back();
    then?.();
  }

  const headline = (c: Celebration) => {
    const badge = badgeName(t, c.badge_key);
    if (c.kind === "earned") return t("celebrate.earned", { badge });
    if (c.kind === "stage_up") return t("celebrate.stage_up", { badge, stage: stageName(t, c.stage) });
    return t("celebrate.milestone", { badge, amount: countLine(t, c.badge_key, c.count) });
  };

  const several = celebrations.length > 1;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      {several ? (
        <Text style={[type.section, styles.heading]} accessibilityRole="header">
          {t("celebrate.several", { count: celebrations.length })}
        </Text>
      ) : null}
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={several} testID="celebrations">
        {celebrations.map((c) => (
          <View key={c.id} style={[styles.page, { width }]}>
            <GrowingBadge celebration={c} still={reduceMotion} />
            <Text style={[type.title, styles.headline]} accessibilityRole={several ? undefined : "header"}>
              {headline(c)}
            </Text>
            <Body>{t(`badges.${c.badge_key}.description`)}</Body>
            {earned.has(c.badge_key) ? (
              <Button
                title={t("badges.share")}
                onPress={() =>
                  done(() => router.push({ pathname: "/share/[key]", params: { key: c.badge_key } }))
                }
              />
            ) : null}
            <TextLink label={t("share.not_now")} onPress={() => done()} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.glowYellow, textAlign: "center", paddingTop: space.m },
  page: { padding: SCREEN_PADDING, gap: space.m, alignItems: "center", justifyContent: "center" },
  headline: { color: colors.textPrimary, textAlign: "center", fontSize: 32, lineHeight: 38 },
});
