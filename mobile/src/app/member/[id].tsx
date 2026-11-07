/**
 * A neighbor's small member page, opened from an event's "Posted by": name,
 * neighborhood, member since, and their badges unless they chose Only me.
 * Never their My Impact numbers. Other neighborhoods get "not found".
 * Also "Block": their events disappear for this member, silently. And
 * "Report": an offensive name or photo, or harassment, goes to the team
 * (Apple's rule for apps where people post).
 */
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ApiError, getMember, MemberPage, reportMember, setBlocked } from "../../api";
import { useAuth } from "../../auth";
import { Badge } from "../../components/badges/Badge";
import { shortDate } from "../../i18n/dates";
import { errorMessage } from "../../i18n/errors";
import { useLanguage } from "../../language";
import {
  Avatar,
  BackButton,
  Button,
  Caption,
  ConfirmDialog,
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
  styles,
} from "../../ui";

export default function Member() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [member, setMember] = useState<MemberPage | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [reported, setReported] = useState(false);
  const [reportError, setReportError] = useState<ApiError | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      getMember(token, Number(id))
        .then(setMember)
        .catch((e) => setError(e as ApiError));
    }, [token, id]),
  );

  if (error) {
    return (
      <Screen>
        <BackButton />
        <ErrorMessage message={errorMessage(t, error)} />
      </Screen>
    );
  }
  if (!member) return <Loading />;

  async function changeBlocked(blocked: boolean) {
    setConfirmingBlock(false);
    if (!token || !member) return;
    try {
      const { is_blocked } = await setBlocked(token, member.id, blocked);
      setMember({ ...member, is_blocked });
    } catch (e) {
      setError(e as ApiError);
    }
  }

  async function onReport() {
    if (!token || !member) return;
    setReportError(null);
    try {
      await reportMember(token, member.id, reason.trim());
      setReported(true);
      setReporting(false);
    } catch (e) {
      setReportError(e as ApiError);
    }
  }

  const neighborhood = member.alias ? `${member.alias} (${member.neighborhood.name})` : member.neighborhood.name;
  return (
    <Screen>
      <BackButton />
      <View style={{ alignItems: "center", gap: 14 }}>
        <Avatar uri={member.photo_url} initial={member.display_name.slice(0, 1).toUpperCase()} size={112} />
        <Title>{member.display_name}</Title>
        <Tag tone="yellow" label={neighborhood} />
        <Caption>{t("member.since", { date: shortDate(new Date(`${member.member_since}T12:00:00`), language) })}</Caption>
      </View>
      {member.badges.length > 0 ? (
        <GlassCard>
          <Section>{t("badges.row_title")}</Section>
          <View style={styles.row}>
            {member.badges.map((badge) => (
              <Badge key={badge.key} badgeKey={badge.key} kind={badge.kind} stage={badge.stage} count={badge.count} size={72} />
            ))}
          </View>
        </GlassCard>
      ) : null}
      {member.is_own ? null : member.is_blocked ? (
        <>
          <Caption>{t("member.blocked_note", { name: member.display_name })}</Caption>
          <TextLink label={t("member.unblock", { name: member.display_name })} onPress={() => changeBlocked(false)} />
        </>
      ) : (
        <TextLink label={t("member.block", { name: member.display_name })} onPress={() => setConfirmingBlock(true)} />
      )}
      {member.is_own ? null : reported ? (
        <Notice message={t("events.report_sent")} />
      ) : reporting ? (
        <GlassCard>
          <Section>{t("member.report_title", { name: member.display_name })}</Section>
          <Caption onGlass>{t("member.report_note", { name: member.display_name })}</Caption>
          <Field label={t("events.report_reason_label")} value={reason} onChangeText={setReason} maxLength={200} />
          <ErrorMessage message={errorMessage(t, reportError)} />
          <Button title={t("events.report_send")} variant="secondary" onPress={onReport} disabled={!reason.trim()} />
        </GlassCard>
      ) : (
        <TextLink label={t("member.report", { name: member.display_name })} onPress={() => setReporting(true)} />
      )}
      <ConfirmDialog
        visible={confirmingBlock}
        title={t("member.block_confirm", { name: member.display_name })}
        confirmLabel={t("member.block", { name: member.display_name })}
        cancelLabel={t("settings.cancel")}
        onConfirm={() => changeBlocked(true)}
        onCancel={() => setConfirmingBlock(false)}
      />
    </Screen>
  );
}
