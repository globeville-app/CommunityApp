/**
 * My Impact: private, only the member sees it (docs/MILESTONE_3.md, step 5).
 *   - the auto check-in re-offer card, once ever, when the server says so
 *   - Ready to collect cards: Collect / I didn't make it
 *   - badge progress, closest to the next stage first
 *   - for hosts, three numbers and the most popular event; no score
 *   - See all badges
 * Hints never name an event category, so sensitive ones never show.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import {
  ApiError,
  BadgeCatalog,
  BadgeData,
  CollectCard,
  collectEvent,
  declineEvent,
  getBadgeCatalog,
  getCollectCards,
  getImpact,
  getMyBadges,
  Impact,
  markCheckinOfferSeen,
} from "../api";
import { useAuth } from "../auth";
import { badgeName, inProgress, progress, stageName } from "../badges";
import { turnOnAutoCheckin } from "../checkin/autoCheckin";
import { BadgeCodeField } from "../components/BadgeCodeField";
import { Badge } from "../components/badges/Badge";
import { shortDate } from "../i18n/dates";
import { errorMessage } from "../i18n/errors";
import { useLanguage } from "../language";
import { alpha, colors, radius, space, type } from "../theme";
import { BackButton, Body, Button, Caption, ErrorMessage, GlassCard, Loading, Screen, Section, TextLink, Title } from "../ui";

export default function MyImpact() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { token } = useAuth();
  const [cards, setCards] = useState<CollectCard[] | null>(null);
  const [reoffer, setReoffer] = useState(false);
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [catalog, setCatalog] = useState<BadgeCatalog | null>(null);
  const [impact, setImpact] = useState<Impact>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [collect, mine, rules, host] = await Promise.all([
        getCollectCards(token),
        getMyBadges(token),
        getBadgeCatalog(token),
        getImpact(token),
      ]);
      setCards(collect.cards);
      setReoffer(collect.show_checkin_reoffer);
      setBadges(mine.badges);
      setCatalog(rules);
      setImpact(host);
    } catch (e) {
      setError(e as ApiError);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onCollect(card: CollectCard) {
    if (!token) return;
    setBusyId(card.event_id);
    setError(null);
    try {
      const { celebrations } = await collectEvent(token, card.event_id);
      if (celebrations.length > 0) router.push("/celebrate");
      await load();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusyId(null);
    }
  }

  async function onDecline(card: CollectCard) {
    if (!token) return;
    setError(null);
    try {
      await declineEvent(token, card.event_id);
      setCards((list) => (list ?? []).filter((c) => c.event_id !== card.event_id));
    } catch (e) {
      setError(e as ApiError);
    }
  }

  async function onReoffer(turnOn: boolean) {
    if (!token) return;
    setReoffer(false); // either choice: gone for good
    await markCheckinOfferSeen(token, "reoffer").catch(() => undefined);
    if (turnOn) await turnOnAutoCheckin(token).catch(() => undefined);
  }

  if (!cards) {
    return error ? (
      <Screen>
        <BackButton />
        <ErrorMessage message={errorMessage(t, error)} />
      </Screen>
    ) : (
      <Loading />
    );
  }

  const growing = inProgress(catalog, badges);
  const host = "brought_together" in impact ? impact : null;

  return (
    <Screen>
      <BackButton />
      <Title>{t("impact.title")}</Title>
      <Caption>{t("impact.private_note")}</Caption>

      {reoffer ? (
        <GlassCard style={styles.glowCard}>
          <Text style={[type.section, styles.white]}>{t("impact.reoffer_title")}</Text>
          <Body onGlass>{t("checkin.what_it_does")}</Body>
          <Body onGlass>{t("checkin.what_it_never_does")}</Body>
          <Button title={t("checkin.turn_on")} onPress={() => onReoffer(true)} />
          <Button title={t("impact.no_thanks")} variant="secondary" onPress={() => onReoffer(false)} />
        </GlassCard>
      ) : null}

      <ErrorMessage message={errorMessage(t, error)} />

      {cards.map((card) => {
        const title = card.language !== language && card.title_alt ? card.title_alt : card.title;
        // The hint: the badge this collect brings closest to its next stage.
        const next =
          card.grows
            .filter((g) => g.next_threshold !== null && g.stage > 0)
            .sort((a, b) => a.next_threshold! - a.count - (b.next_threshold! - b.count))[0] ?? card.grows[0];
        return (
          <GlassCard key={card.event_id} style={styles.glowCard}>
            <Text style={[type.label, { color: colors.glowYellow }]}>{t("impact.ready_to_collect")}</Text>
            <Text style={[type.section, styles.white]}>{title}</Text>
            <Caption onGlass>{shortDate(new Date(card.starts_at), language)}</Caption>
            {next ? (
              <View style={styles.grows}>
                <Badge badgeKey={next.badge} kind="growth" stage={next.stage} size={40} label={false} />
                <Body onGlass>
                  {next.stage === 0
                    ? t("impact.starts", { badge: badgeName(t, next.badge) })
                    : t("badges.more_to", {
                        count: (next.next_threshold ?? next.count) - next.count,
                        stage: stageName(t, next.stage + 1),
                      })}
                </Body>
              </View>
            ) : null}
            <Button title={t("impact.collect")} busy={busyId === card.event_id} onPress={() => onCollect(card)} />
            <Button title={t("impact.didnt_make_it")} variant="secondary" onPress={() => onDecline(card)} />
          </GlassCard>
        );
      })}

      {growing.length > 0 ? (
        <GlassCard>
          <Section>{t("impact.progress_title")}</Section>
          {growing.map((badge) => (
            <View key={badge.key} style={styles.progressRow} testID={`progress-${badge.key}`}>
              <Badge badgeKey={badge.key} kind="growth" stage={badge.stage} count={badge.count} size={64} />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[type.label, styles.white]}>
                  {t("impact.progress_line", { badge: badgeName(t, badge.key), stage: stageName(t, badge.stage) })}
                </Text>
                <View style={styles.bar} accessible={false}>
                  <View style={[styles.barFill, { width: `${Math.round(progress(catalog, badge) * 100)}%` }]} />
                </View>
                <Caption onGlass>
                  {t("badges.more_to", {
                    count: badge.next_threshold! - badge.count,
                    stage: stageName(t, badge.stage + 1),
                  })}
                </Caption>
              </View>
            </View>
          ))}
        </GlassCard>
      ) : null}

      {host ? (
        <GlassCard>
          <Section>{t("impact.host_title")}</Section>
          <Body onGlass>{t("impact.brought_together", { count: host.brought_together })}</Body>
          <Body onGlass>{t("impact.first_timers", { count: host.first_timers })}</Body>
          <Body onGlass>{t("impact.came_back", { count: host.came_back })}</Body>
          <Body onGlass>
            {t("impact.most_popular", {
              title: host.most_popular.title,
              date: shortDate(new Date(host.most_popular.starts_at), language),
              count: host.most_popular.attendee_count,
            })}
          </Body>
        </GlassCard>
      ) : null}

      <BadgeCodeField />
      <TextLink label={t("badges.see_all")} onPress={() => router.push("/badges")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  white: { color: colors.textPrimary },
  glowCard: { borderColor: alpha(colors.glowYellow, 0.6) },
  grows: { flexDirection: "row", alignItems: "center", gap: space.xs },
  progressRow: { flexDirection: "row", alignItems: "center", gap: space.s },
  bar: { height: 8, borderRadius: radius.date, backgroundColor: alpha("#FFFFFF", 0.12), overflow: "hidden" },
  barFill: { height: 8, borderRadius: radius.date, backgroundColor: colors.glowTurquoise },
});
