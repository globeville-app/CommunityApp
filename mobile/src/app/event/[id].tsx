/**
 * Event detail: everything about one event, "I'm going", the Partiful link,
 * reading it in your language, reporting, and (for the organizer) Edit and
 * Cancel. The app never shows who is going, only how many.
 *
 * Milestone 3: the location opens the "Open in" sheet, the organizer's name
 * opens their member page, organizers of pinless upcoming events get an
 * "Add a map pin" prompt, and the first "I'm going" offers auto check-in.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ApiError,
  cancelEvent,
  EventData,
  getEvent,
  getMyProfile,
  reportEvent,
  setGoing,
  translateEvent,
  Translation,
} from "../../api";
import { useAuth } from "../../auth";
import { syncGeofences } from "../../checkin/geofencing";
import { CategoryChip } from "../../components/CategoryChip";
import { DateBlock } from "../../components/EventCard";
import { timeRange, weekdayDate } from "../../i18n/dates";
import { errorMessage } from "../../i18n/errors";
import { useLanguage } from "../../language";
import { useGetThere } from "../../maps/OpenInSheet";
import { colors, space, type } from "../../theme";
import {
  BackButton,
  Body,
  Button,
  Caption,
  ConfirmDialog,
  ErrorMessage,
  Field,
  GlassCard,
  Loading,
  Notice,
  Screen,
  TextLink,
  Title,
} from "../../ui";

export default function EventDetail() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { language } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Number(id);

  const [event, setEvent] = useState<EventData | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  // Machine translation: shown until "Show original"; hidden if unavailable.
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [cannotTranslate, setCannotTranslate] = useState(false);
  // Report form and the organizer's cancel question.
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const getThere = useGetThere();

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setEvent(await getEvent(token, eventId));
      setTranslation(null); // the text may have been edited
    } catch (e) {
      setError(e as ApiError);
    }
  }, [token, eventId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!event) {
    return error ? (
      <Screen>
        <BackButton />
        <ErrorMessage message={errorMessage(t, error)} />
      </Screen>
    ) : (
      <Loading />
    );
  }

  // Which words to show: the organizer's own version in my language if
  // there is one, a machine translation if I asked for it, else the original.
  const mine = event.language === language;
  const organizerVersion = !mine && event.title_alt;
  const machine = !mine && !organizerVersion && translation && !showOriginal ? translation : null;
  const title = machine?.title ?? (organizerVersion ? event.title_alt! : event.title);
  const description = machine
    ? machine.description
    : organizerVersion && event.description_alt
      ? event.description_alt
      : event.description;
  const canTranslate = !mine && !organizerVersion && !cannotTranslate;

  const cancelled = event.status === "cancelled";
  const closed = cancelled || event.is_past;

  async function onTranslate() {
    if (!token || !event) return;
    if (translation) {
      setShowOriginal(false);
      return;
    }
    try {
      setTranslation(await translateEvent(token, event.id, language));
      setShowOriginal(false);
    } catch {
      // Not set up, or it failed: hide the button and keep the original text.
      setCannotTranslate(true);
    }
  }

  async function onGoing() {
    if (!token || !event) return;
    setBusy(true);
    setError(null);
    try {
      const result = await setGoing(token, event.id, !event.is_going);
      setEvent({ ...event, ...result });
      // Watch (or stop watching) this event's place, if auto check-in is on.
      syncGeofences(token).catch(() => undefined);
      if (result.is_going) {
        // Once, ever, on the first "I'm going": the auto check-in offer, then
        // the notification ask right after it.
        const profile = await getMyProfile(token).catch(() => null);
        const checkin = profile && !profile.checkin_offer_shown && !profile.auto_checkin;
        const notifications = profile && !profile.notif_offer_shown;
        if (checkin) {
          router.push({
            pathname: "/checkin-offer",
            params: notifications ? { which: "first", then: "notifications" } : { which: "first" },
          });
        } else if (notifications) {
          router.push("/notif-offer");
        }
      }
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function onReport() {
    if (!token || !event) return;
    setError(null);
    try {
      await reportEvent(token, event.id, reason.trim());
      setReported(true);
      setReporting(false);
    } catch (e) {
      setError(e as ApiError);
    }
  }

  async function onCancel() {
    setConfirmingCancel(false);
    if (!token || !event) return;
    try {
      setEvent(await cancelEvent(token, event.id));
    } catch (e) {
      setError(e as ApiError);
    }
  }

  const when = new Date(event.starts_at);

  return (
    <Screen>
      <BackButton />
      <View style={styles.top}>
        <DateBlock startsAt={event.starts_at} />
        <View style={{ flex: 1, gap: space.xs }}>
          <CategoryChip category={event.category} group={event.group} otherText={event.category_other} />
          {cancelled ? <Text style={styles.cancelled}>{t("events.cancelled")}</Text> : null}
        </View>
      </View>
      <Title>{title}</Title>

      {machine ? (
        <View style={styles.translatedRow}>
          <Caption>{t("events.auto_translated")}</Caption>
          <TextLink label={t("events.show_original")} onPress={() => setShowOriginal(true)} />
        </View>
      ) : canTranslate ? (
        <TextLink
          label={translation ? t("events.show_translation") : t("events.translate_button")}
          onPress={onTranslate}
        />
      ) : null}

      <GlassCard>
        <View style={styles.line}>
          <Ionicons name="time-outline" size={18} color={colors.glowTurquoise} />
          <Body onGlass>
            {t("events.date_time", {
              date: weekdayDate(when, language),
              time: timeRange(event.starts_at, event.ends_at, language),
            })}
          </Body>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("maps.directions_to", { place: event.location_text })}
          onPress={() =>
            getThere.open({ latitude: event.latitude, longitude: event.longitude, label: event.location_text })
          }
          style={({ pressed }) => [styles.line, styles.tappable, pressed && { opacity: 0.75 }]}
        >
          <Ionicons name="location-outline" size={18} color={colors.glowTurquoise} />
          <Text style={[type.body, styles.link]}>{event.location_text}</Text>
          <Ionicons name="navigate-outline" size={16} color={colors.textSecondary} />
        </Pressable>
        {event.organization ? (
          // "Hosted by [Organization]", opening its page (unless it's hidden).
          <Pressable
            accessibilityRole={event.organization.has_page ? "button" : undefined}
            disabled={!event.organization.has_page}
            onPress={() =>
              router.push({ pathname: "/organizations/[id]", params: { id: String(event.organization!.id) } })
            }
            style={({ pressed }) => [styles.line, styles.tappable, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="people-outline" size={18} color={colors.glowTurquoise} />
            <Text style={[type.body, event.organization.has_page ? styles.link : styles.plain]}>
              {t("events.hosted_by", { name: event.organization.name })}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole={event.organizer_member_id ? "button" : undefined}
            disabled={!event.organizer_member_id}
            onPress={() =>
              router.push({ pathname: "/member/[id]", params: { id: String(event.organizer_member_id) } })
            }
            style={({ pressed }) => [styles.line, styles.tappable, pressed && { opacity: 0.75 }]}
          >
            <Ionicons name="person-outline" size={18} color={colors.glowTurquoise} />
            <Text style={[type.body, event.organizer_member_id ? styles.link : styles.plain]}>
              {t("events.posted_by", { name: event.organizer_name ?? t("events.former_neighbor") })}
            </Text>
          </Pressable>
        )}
        {description ? <Body>{description}</Body> : null}
      </GlassCard>

      <Text style={[type.label, styles.going]}>{t("events.going_count", { count: event.going_count })}</Text>
      {cancelled ? <Notice message={t("events.cancelled_notice")} /> : event.is_past ? <Caption>{t("events.ended")}</Caption> : null}
      {closed ? null : (
        <Button
          title={event.is_going ? t("events.youre_going") : t("events.im_going")}
          variant={event.is_going ? "secondary" : "primary"}
          onPress={onGoing}
          busy={busy}
        />
      )}
      {event.partiful_url ? (
        <Button
          title={t("events.open_partiful")}
          variant="secondary"
          onPress={() => WebBrowser.openBrowserAsync(event.partiful_url!)}
        />
      ) : null}

      {event.needs_pin ? (
        <GlassCard>
          <Text style={[type.section, { color: colors.textPrimary }]}>{t("events.add_pin_title")}</Text>
          <Body onGlass>{t("events.add_pin_body")}</Body>
          <Button
            title={t("events.add_pin_button")}
            onPress={() => router.push({ pathname: "/event-form", params: { id: String(event.id), step: "pin" } })}
          />
        </GlassCard>
      ) : null}

      {event.is_organizer && !cancelled ? (
        <View style={styles.organizer}>
          <View style={{ flex: 1 }}>
            <Button
              title={t("events.edit")}
              variant="secondary"
              onPress={() => router.push({ pathname: "/event-form", params: { id: String(event.id) } })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={t("events.cancel_event")} variant="danger" onPress={() => setConfirmingCancel(true)} />
          </View>
        </View>
      ) : null}

      <ErrorMessage message={errorMessage(t, error)} />

      {reported ? (
        <Notice message={t("events.report_sent")} />
      ) : reporting ? (
        <GlassCard>
          <Text style={[type.section, { color: colors.textPrimary }]}>{t("events.report_title")}</Text>
          <Field label={t("events.report_reason_label")} value={reason} onChangeText={setReason} maxLength={200} />
          <Button title={t("events.report_send")} variant="secondary" onPress={onReport} disabled={!reason.trim()} />
        </GlassCard>
      ) : (
        <TextLink label={t("events.report_link")} onPress={() => setReporting(true)} />
      )}

      <ConfirmDialog
        visible={confirmingCancel}
        title={t("events.cancel_confirm")}
        confirmLabel={t("events.cancel_event")}
        cancelLabel={t("events.keep_event")}
        onConfirm={onCancel}
        onCancel={() => setConfirmingCancel(false)}
      />
      {getThere.sheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", gap: space.m, alignItems: "center" },
  cancelled: { color: colors.danger, fontFamily: "Outfit_600SemiBold" },
  translatedRow: { flexDirection: "row", alignItems: "center", gap: space.s, flexWrap: "wrap" },
  line: { flexDirection: "row", gap: space.xs, alignItems: "flex-start" },
  tappable: { minHeight: 44, alignItems: "center" },
  link: { flex: 1, color: colors.textPrimary, textDecorationLine: "underline" },
  plain: { flex: 1, color: colors.textPrimary },
  going: { color: colors.glowTurquoise },
  organizer: { flexDirection: "row", gap: space.s },
});
