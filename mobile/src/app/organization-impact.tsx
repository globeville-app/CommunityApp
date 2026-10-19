/**
 * Organization impact (admins only): the same layout as My Impact's host
 * section, plus badge progress. Never names, never compared.
 */
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { ApiError, BadgeCatalog, BadgeData, getBadgeCatalog, getOrganizationImpact, Impact } from "../api";
import { useAuth } from "../auth";
import { badgeName, progress, stageName } from "../badges";
import { Badge } from "../components/badges/Badge";
import { shortDate } from "../i18n/dates";
import { errorMessage } from "../i18n/errors";
import { useLanguage } from "../language";
import { alpha, colors, radius, space, type } from "../theme";
import { BackButton, Body, Caption, ErrorMessage, GlassCard, Loading, Screen, Section, Title } from "../ui";

export default function OrganizationImpact() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [impact, setImpact] = useState<Impact | null>(null);
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [catalog, setCatalog] = useState<BadgeCatalog | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([getOrganizationImpact(token, Number(id)), getBadgeCatalog(token)])
      .then(([data, rules]) => {
        setImpact(data.impact);
        setBadges(data.badges);
        setCatalog(rules);
      })
      .catch((e) => setError(e as ApiError));
  }, [token, id]);

  if (!impact) {
    return error ? (
      <Screen>
        <BackButton />
        <ErrorMessage message={errorMessage(t, error)} />
      </Screen>
    ) : (
      <Loading />
    );
  }

  const numbers = "brought_together" in impact ? impact : null;
  const growing = badges
    .filter((b) => b.kind === "growth" && b.next_threshold !== null && (b.count > 0 || b.stage > 0))
    .sort((a, b) => a.next_threshold! - a.count - (b.next_threshold! - b.count));
  return (
    <Screen>
      <BackButton />
      <Title>{t("organizations.impact")}</Title>
      <Caption>{t("organizations.impact_private")}</Caption>
      {numbers ? (
        <GlassCard>
          <Body onGlass>{t("organizations.brought_together", { count: numbers.brought_together })}</Body>
          <Body onGlass>{t("impact.first_timers", { count: numbers.first_timers })}</Body>
          <Body onGlass>{t("impact.came_back", { count: numbers.came_back })}</Body>
          <Body onGlass>
            {t("organizations.most_popular", {
              title: numbers.most_popular.title,
              date: shortDate(new Date(numbers.most_popular.starts_at), language),
              count: numbers.most_popular.attendee_count,
            })}
          </Body>
        </GlassCard>
      ) : (
        <GlassCard>
          <Caption onGlass>{t("organizations.impact_empty")}</Caption>
        </GlassCard>
      )}
      {growing.length > 0 ? (
        <GlassCard>
          <Section>{t("organizations.badges_title")}</Section>
          {growing.map((badge) => (
            <View key={badge.key} style={styles.row} testID={`org-progress-${badge.key}`}>
              <Badge badgeKey={badge.key} kind="growth" stage={badge.stage} count={badge.count} size={64} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[type.label, { color: colors.textPrimary }]}>
                  {badge.stage > 0
                    ? t("impact.progress_line", { badge: badgeName(t, badge.key), stage: stageName(t, badge.stage) })
                    : badgeName(t, badge.key)}
                </Text>
                <View style={styles.bar}>
                  <View style={[styles.fill, { width: `${Math.round(progress(catalog, badge) * 100)}%` }]} />
                </View>
                <Caption onGlass>
                  {t("badges.more_to", { count: badge.next_threshold! - badge.count, stage: stageName(t, badge.stage + 1) })}
                </Caption>
              </View>
            </View>
          ))}
        </GlassCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.s },
  bar: { height: 8, borderRadius: radius.date, backgroundColor: alpha("#FFFFFF", 0.12), overflow: "hidden" },
  fill: { height: 8, borderRadius: radius.date, backgroundColor: colors.glowTurquoise },
});
