import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ApiError, getMyProfile, logout, Profile as ProfileData } from "../api";
import { useAuth } from "../auth";
import { LanguageToggle } from "../components/LanguageToggle";
import { neighborhoodLabel } from "../format";
import { shortDate } from "../i18n/dates";
import { errorMessage } from "../i18n/errors";
import { useLanguage } from "../language";
import { resetTo } from "../navigation";
import {
  Avatar,
  Button,
  Caption,
  ErrorMessage,
  GlassCard,
  Loading,
  Screen,
  Section,
  Tag,
  Title,
  styles,
} from "../ui";

export default function Profile() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { token, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setProfile(await getMyProfile(token));
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "profile_not_found") resetTo("/address");
      else setError(err);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onLogOut() {
    if (token) {
      // If the server can't be reached we still log out on this phone.
      await logout(token).catch(() => undefined);
    }
    await signOut();
    resetTo("/welcome");
  }

  if (error) {
    return (
      <Screen>
        <ErrorMessage message={errorMessage(t, error)} />
        <Button title={t("common.try_again")} onPress={load} />
      </Screen>
    );
  }
  if (!profile) return <Loading />;

  // Stats, badges, the neighborhoods card and the tab bar from the design
  // arrive with the milestones that build those features.
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 14, paddingTop: 24 }}>
        <Avatar uri={profile.photo_url} initial={profile.first_name.slice(0, 1).toUpperCase()} size={128} />
        <Title>{profile.display_name}</Title>
        <Tag tone="yellow" label={neighborhoodLabel(profile)} />
        <Caption>{t("profile.joined", { date: shortDate(new Date(profile.joined_at), language) })}</Caption>
      </View>

      {profile.interests.length > 0 ? (
        <GlassCard>
          <Section>{t("profile.interests_title")}</Section>
          <View style={styles.row}>
            {profile.interests.map((item) => (
              <Tag key={item} label={t(`interests.${item}`, { defaultValue: item })} />
            ))}
          </View>
        </GlassCard>
      ) : null}

      {/* Bilingual on purpose, so anyone can find it in either language. */}
      <GlassCard style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <View style={styles.flex}>
          <Section>{t("language.settings_row")}</Section>
        </View>
        <LanguageToggle />
      </GlassCard>

      <View style={[styles.flex, { justifyContent: "flex-end" }]}>
        <Button title={t("profile.log_out_button")} variant="secondary" onPress={onLogOut} />
      </View>
    </Screen>
  );
}
