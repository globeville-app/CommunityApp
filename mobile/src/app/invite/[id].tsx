/**
 * Invite people (docs/MILESTONE_5.md): the event's link and a ready-to-send
 * message, sent from the host's own phone through the share sheet. The app
 * never reads the phone's contacts. Also: Copy link, and Reset link.
 */
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Share } from "react-native";

import { ApiError, getInvite, InviteInfo, logInviteShare, resetInvite } from "../../api";
import { useAuth } from "../../auth";
import { APP_NAME } from "../../config";
import { errorMessage } from "../../i18n/errors";
import {
  BackButton,
  Body,
  Button,
  Caption,
  ConfirmDialog,
  ErrorMessage,
  GlassCard,
  Intro,
  Loading,
  Notice,
  Screen,
  TextLink,
  Title,
} from "../../ui";

export default function InvitePeople() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const eventId = Number(id);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [wasReset, setWasReset] = useState(false);

  useEffect(() => {
    if (!token) return;
    getInvite(token, eventId)
      .then(setInvite)
      .catch((e) => setError(e as ApiError));
  }, [token, eventId]);

  async function onShare() {
    if (!token || !invite) return;
    logInviteShare(token, eventId).catch(() => undefined);
    await Share.share({ message: invite.message }).catch(() => undefined);
  }

  async function onCopy() {
    if (!invite) return;
    await Clipboard.setStringAsync(invite.url);
    setCopied(true);
  }

  async function onReset() {
    setConfirmingReset(false);
    if (!token) return;
    try {
      setInvite(await resetInvite(token, eventId));
      setWasReset(true);
      setCopied(false);
    } catch (e) {
      setError(e as ApiError);
    }
  }

  function onDone() {
    // Right after posting: on to the new event. Otherwise back where they came from.
    if (fresh) router.replace({ pathname: "/event/[id]", params: { id: String(eventId) } });
    else router.back();
  }

  if (!invite && !error) return <Loading />;
  return (
    <Screen>
      {fresh ? null : <BackButton />}
      <Title>{t("invite.title")}</Title>
      <Intro>{t("invite.intro")}</Intro>
      <ErrorMessage message={errorMessage(t, error)} />
      {invite ? (
        <>
          <GlassCard>
            <Caption onGlass>{t("invite.message_label")}</Caption>
            <Body onGlass>{invite.message}</Body>
          </GlassCard>
          <Button title={t("invite.share")} onPress={onShare} />
          <Button title={copied ? t("invite.copied") : t("invite.copy")} variant="secondary" onPress={onCopy} />
          {wasReset ? <Notice message={t("invite.was_reset")} /> : null}
          <Caption>{t("invite.no_contacts", { app: APP_NAME })}</Caption>
          <TextLink label={t("invite.reset")} onPress={() => setConfirmingReset(true)} />
        </>
      ) : null}
      <Button title={fresh ? t("invite.go_to_event") : t("invite.done")} variant="secondary" onPress={onDone} />
      <ConfirmDialog
        visible={confirmingReset}
        title={t("invite.reset_confirm")}
        confirmLabel={t("invite.reset")}
        cancelLabel={t("settings.cancel")}
        onConfirm={onReset}
        onCancel={() => setConfirmingReset(false)}
      />
    </Screen>
  );
}
