/**
 * An organization's page (docs/MILESTONE_4.md, step 4): photo, name, type
 * and neighborhoods; Follow; the description with the translate button;
 * Organization badges; upcoming events; "Past events: 12"; Report.
 * Admins also see Edit, Admins, Impact and the follower count.
 */
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";

import { ApiError, getOrganization, OrgPage, reportOrganization, setFollowing, translateOrganization } from "../../api";
import { useAuth } from "../../auth";
import { Badge } from "../../components/badges/Badge";
import { EventCard } from "../../components/EventCard";
import { errorMessage } from "../../i18n/errors";
import { useLanguage } from "../../language";
import { colors, space, type } from "../../theme";
import {
  Avatar,
  BackButton,
  Body,
  Button,
  Caption,
  ErrorMessage,
  Field,
  GlassCard,
  Loading,
  Notice,
  Screen,
  Section,
  Tag,
  TextLink,
  Title,
  styles as ui,
} from "../../ui";

export default function OrganizationPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { language } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [org, setOrg] = useState<OrgPage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [cannotTranslate, setCannotTranslate] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      getOrganization(token, Number(id))
        .then((page) => {
          setOrg(page);
          setTranslated(null);
        })
        .catch((e) => setError(e as ApiError));
    }, [token, id]),
  );

  if (!org) {
    return error ? (
      <Screen>
        <BackButton />
        <ErrorMessage message={errorMessage(t, error)} />
      </Screen>
    ) : (
      <Loading />
    );
  }

  // The description in my language: the admins' own version, or a machine translation on request.
  const mine = org.language === language;
  const ownVersion = !mine && org.description_alt;
  const description =
    translated && !showOriginal ? translated : ownVersion ? org.description_alt! : org.description;
  const canTranslate = !mine && !ownVersion && !!org.description && !cannotTranslate;

  async function onFollow() {
    if (!token || !org) return;
    setBusy(true);
    try {
      const result = await setFollowing(token, org.id, !org.is_following);
      setOrg({ ...org, ...result });
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function onTranslate() {
    if (!token || !org) return;
    if (translated) return setShowOriginal(false);
    try {
      setTranslated((await translateOrganization(token, org.id, language)).description);
      setShowOriginal(false);
    } catch {
      setCannotTranslate(true);
    }
  }

  async function onReport() {
    if (!token || !org) return;
    try {
      await reportOrganization(token, org.id, reason.trim());
      setReported(true);
      setReporting(false);
    } catch (e) {
      setError(e as ApiError);
    }
  }

  const approved = !org.status || org.status === "approved";
  return (
    <Screen>
      <BackButton />
      <View style={{ alignItems: "center", gap: 12 }}>
        <Avatar uri={org.photo_url} initial={org.name.slice(0, 1).toUpperCase()} size={112} />
        {/* Organization names are never translated. */}
        <Title>{org.name}</Title>
        <Tag tone="yellow" label={t(`organizations.types.${org.type}`)} />
        <Caption>{org.neighborhoods.map((n) => n.name).join(" · ")}</Caption>
      </View>

      {org.is_admin && !approved ? <Notice message={t(`organizations.status_note.${org.status}`)} /> : null}
      {org.is_admin && org.change_pending ? <Caption>{t("organizations.change_pending")}</Caption> : null}

      {approved ? (
        <Button
          title={org.is_following ? t("organizations.following") : t("organizations.follow")}
          variant={org.is_following ? "secondary" : "primary"}
          onPress={onFollow}
          busy={busy}
        />
      ) : null}

      {org.is_admin ? (
        <GlassCard>
          <Text style={[type.label, { color: colors.glowTurquoise }]}>
            {t("organizations.followers", { count: org.follower_count ?? 0 })}
          </Text>
          <View style={styles.adminRow}>
            <View style={{ flex: 1 }}>
              <Button
                title={t("organizations.edit")}
                variant="secondary"
                onPress={() => router.push({ pathname: "/organization-form", params: { id: String(org.id) } })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={t("organizations.admins")}
                variant="secondary"
                onPress={() => router.push({ pathname: "/organization-admins", params: { id: String(org.id) } })}
              />
            </View>
          </View>
          <Button
            title={t("organizations.impact")}
            variant="secondary"
            onPress={() => router.push({ pathname: "/organization-impact", params: { id: String(org.id) } })}
          />
        </GlassCard>
      ) : null}

      {description ? (
        <GlassCard>
          <Body onGlass>{description}</Body>
          {translated && !showOriginal ? (
            <View style={styles.inline}>
              <Caption onGlass>{t("events.auto_translated")}</Caption>
              <TextLink label={t("events.show_original")} onPress={() => setShowOriginal(true)} />
            </View>
          ) : canTranslate ? (
            <TextLink
              label={translated ? t("events.show_translation") : t("events.translate_button")}
              onPress={onTranslate}
            />
          ) : null}
          {org.link ? <TextLink label={t("organizations.website")} onPress={() => WebBrowser.openBrowserAsync(org.link!)} /> : null}
        </GlassCard>
      ) : null}

      {org.badges.length > 0 ? (
        <GlassCard>
          <Section>{t("organizations.badges_title")}</Section>
          <View style={ui.row}>
            {org.badges.map((badge) => (
              <Badge key={badge.key} badgeKey={badge.key} kind={badge.kind} stage={badge.stage} count={badge.count} size={72} />
            ))}
          </View>
        </GlassCard>
      ) : null}

      <Section>{t("organizations.upcoming")}</Section>
      {org.upcoming_events.length === 0 ? (
        <Caption>{t("organizations.no_upcoming")}</Caption>
      ) : (
        org.upcoming_events.map((event) => <EventCard key={event.id} event={event} />)
      )}
      <Caption>{t("organizations.past_count", { count: org.past_event_count })}</Caption>

      <ErrorMessage message={errorMessage(t, error)} />
      {reported ? (
        <Notice message={t("events.report_sent")} />
      ) : reporting ? (
        <GlassCard>
          <Text style={[type.section, { color: colors.textPrimary }]}>{t("organizations.report_title")}</Text>
          <Field label={t("events.report_reason_label")} value={reason} onChangeText={setReason} maxLength={200} />
          <Button title={t("events.report_send")} variant="secondary" onPress={onReport} disabled={!reason.trim()} />
        </GlassCard>
      ) : org.is_admin ? null : (
        <TextLink label={t("events.report_link")} onPress={() => setReporting(true)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  adminRow: { flexDirection: "row", gap: space.s },
  inline: { flexDirection: "row", alignItems: "center", gap: space.s, flexWrap: "wrap" },
});
