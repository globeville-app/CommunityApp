/**
 * Share preview (docs/BADGE_UI.md §3): the card, "Show my neighborhood"
 * (on by default), Share, Not now and the privacy note. Share opens the
 * phone's share sheet, then counts the share (badge and date only).
 */
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Switch, Text, useWindowDimensions, View } from "react-native";

import { BadgeData, getMyBadges, getMyProfile, logShare, Profile } from "../../api";
import { useAuth } from "../../auth";
import { badgeName } from "../../badges";
import { BADGE_COLORS } from "../../components/badges/Badge";
import { ShareCard } from "../../components/badges/ShareCard";
import { APP_NAME, INVITE_URL } from "../../config";
import { neighborhoodLabel } from "../../format";
import { shareCardImage } from "../../share/shareImage";
import { colors, fonts, type } from "../../theme";
import { Loading, Screen, TextLink } from "../../ui";

export default function SharePreview() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badge, setBadge] = useState<BadgeData | null>(null);
  const [showNeighborhood, setShowNeighborhood] = useState(true);
  const [busy, setBusy] = useState(false);
  const exportCard = useRef<View>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([getMyProfile(token), getMyBadges(token)])
      .then(([me, mine]) => {
        setProfile(me);
        setBadge(mine.badges.find((b) => b.key === key && b.stage > 0) ?? null);
      })
      .catch(() => router.back());
  }, [token, key]);

  if (!profile || !badge) return <Loading />;

  const neighborhood = showNeighborhood ? neighborhoodLabel(profile) : null;
  const message = t(showNeighborhood ? "share.message_neighborhood" : "share.message_neighbors", {
    badge: badgeName(t, badge.key),
    url: INVITE_URL,
    // The brand is written in lowercase (design/BRAND.md).
    app: APP_NAME.toLowerCase(),
  });
  const card = { badge, firstName: profile.first_name, neighborhood };

  async function onShare() {
    if (!token) return;
    setBusy(true);
    try {
      await shareCardImage(exportCard, message);
      await logShare(token, badge!.key).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text style={[styles.title]} accessibilityRole="header">
        {t("share.title")}
      </Text>
      <View style={{ alignItems: "center" }}>
        <ShareCard {...card} size={Math.min(width - 40, 480)} rounded />
      </View>

      <View style={styles.toggle}>
        <Text style={[type.body, { flex: 1, color: colors.textPrimary }]}>{t("share.show_neighborhood")}</Text>
        <Switch
          accessibilityLabel={t("share.show_neighborhood")}
          value={showNeighborhood}
          onValueChange={setShowNeighborhood}
          trackColor={{ true: BADGE_COLORS.teal, false: "rgba(255,255,255,0.2)" }}
          thumbColor="#FFFFFF"
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("badges.share")}
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={onShare}
        style={({ pressed }) => [pressed && { opacity: 0.8 }]}
      >
        <LinearGradient
          colors={[BADGE_COLORS.teal, BADGE_COLORS.purple, BADGE_COLORS.pink, BADGE_COLORS.yellow]}
          locations={[0, 0.35, 0.7, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shareButton}
        >
          <Text style={styles.shareText}>{t("badges.share")}</Text>
        </LinearGradient>
      </Pressable>
      <TextLink label={t("share.not_now")} onPress={() => router.back()} />
      <Text style={styles.privacy}>{t("share.privacy_note")}</Text>

      {/* The full-size card the image is made from: square corners, off screen. */}
      <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ShareCard {...card} size={360} ref={exportCard} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.semibold, fontSize: 20, color: colors.textPrimary, textAlign: "center" },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  shareButton: { height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  shareText: { fontFamily: fonts.semibold, fontSize: 16, color: "#FFFFFF" },
  privacy: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15, color: "#8C82B5", textAlign: "center" },
  offscreen: { position: "absolute", left: -10000, top: 0 },
});
