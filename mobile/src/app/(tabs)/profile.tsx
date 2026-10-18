import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { ApiError, BadgeData, getMyBadges, getMyProfile, Profile as ProfileData } from "../../api";
import { useAuth } from "../../auth";
import { groupOf, useCategories } from "../../categories";
import { CategoryChip } from "../../components/CategoryChip";
import { Badge, useBadgeLabel } from "../../components/badges/Badge";
import { neighborhoodLabel } from "../../format";
import { shortDate } from "../../i18n/dates";
import { errorMessage } from "../../i18n/errors";
import { useLanguage } from "../../language";
import { resetTo } from "../../navigation";
import { colors } from "../../theme";
import { Avatar, Button, Caption, ErrorMessage, GlassCard, Loading, Screen, Section, Tag, TabScene, TextLink, Title, styles } from "../../ui";

export default function ProfileTab() {
  return (
    <TabScene>
      <Profile />
    </TabScene>
  );
}

function Profile() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { token } = useAuth();
  const { groups } = useCategories();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const badgeLabel = useBadgeLabel();
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setProfile(await getMyProfile(token));
      // Badges are extra: the profile still shows if they fail to load.
      getMyBadges(token)
        .then((data) => setBadges(data.badges.filter((b) => b.stage > 0)))
        .catch(() => undefined);
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "profile_not_found") resetTo("/address");
      else setError(err);
    }
  }, [token]);

  // Reload when the tab comes into view, e.g. after editing interests.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error) {
    return (
      <Screen>
        <ErrorMessage message={errorMessage(t, error)} />
        <Button title={t("common.try_again")} onPress={load} />
      </Screen>
    );
  }
  if (!profile) return <Loading />;

  // Stats and the neighborhoods card from the design arrive with the
  // milestones that build those features. Language and Log out live in
  // Settings (the gear).
  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("profile.settings_label")}
          onPress={() => router.push("/settings")}
          style={({ pressed }) => [styles.round, pressed && styles.pressed]}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={{ alignItems: "center", gap: 14 }}>
        <Avatar uri={profile.photo_url} initial={profile.first_name.slice(0, 1).toUpperCase()} size={128} />
        <Title>{profile.display_name}</Title>
        <Tag tone="yellow" label={neighborhoodLabel(profile)} />
        <Caption>{t("profile.joined", { date: shortDate(new Date(profile.joined_at), language) })}</Caption>
      </View>

      <GlassCard>
        <Section>{t("badges.row_title")}</Section>
        {badges.length > 0 ? (
          <View style={styles.row}>
            {badges.map((badge) => (
              <Pressable
                key={badge.key}
                accessibilityRole="button"
                accessibilityLabel={badgeLabel(badge.key, badge.kind, badge.stage, badge.count)}
                onPress={() => router.push({ pathname: "/badges/[key]", params: { key: badge.key } })}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Badge badgeKey={badge.key} kind={badge.kind} stage={badge.stage} count={badge.count} size={72} label={false} />
              </Pressable>
            ))}
          </View>
        ) : (
          <Caption onGlass>{t("badges.none_yet")}</Caption>
        )}
        <TextLink label={t("badges.see_all")} onPress={() => router.push("/badges")} />
      </GlassCard>
      <Button title={t("impact.button")} variant="secondary" onPress={() => router.push("/impact")} />

      <GlassCard>
        <Section>{t("profile.interests_title")}</Section>
        {profile.interests.length > 0 ? (
          <View style={styles.row}>
            {profile.interests.map((item) => (
              <CategoryChip key={item} category={item} group={groupOf(groups, item)} />
            ))}
          </View>
        ) : (
          <Caption onGlass>{t("profile.interests_empty")}</Caption>
        )}
        <TextLink label={t("profile.edit_interests")} onPress={() => router.push("/interests")} />
      </GlassCard>
      {/* Room for the floating tab bar. */}
      <View style={{ height: 96 }} />
    </Screen>
  );
}
