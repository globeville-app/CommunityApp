/**
 * An invite link opened in the app (globeville.app/e/{code}): the server
 * gives this member access to the event, whatever their neighborhood, and
 * we go on to the event, with "I'm going" recorded as from an invite link.
 * Not signed in yet: the web page instead, where anyone can RSVP.
 */
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, openInvite } from "../../api";
import { useAuth } from "../../auth";
import { APP_NAME, INVITE_URL } from "../../config";
import { errorMessage } from "../../i18n/errors";
import { BackButton, Body, Button, ErrorMessage, Loading, Screen, Title } from "../../ui";

export default function OpenInvite() {
  const { t } = useTranslation();
  const { token, isLoading } = useAuth();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [error, setError] = useState<ApiError | null>(null);
  const webPage = `${INVITE_URL.replace(/\/+$/, "")}/e/${encodeURIComponent(code ?? "")}`;

  useEffect(() => {
    if (isLoading || !token || !code) return;
    openInvite(token, code)
      .then((event) =>
        router.replace({ pathname: "/event/[id]", params: { id: String(event.id), from: "invite_link" } }),
      )
      .catch((e) => setError(e as ApiError));
  }, [isLoading, token, code]);

  if (!isLoading && !token) {
    return (
      <Screen>
        <Title>{t("invite_open.signed_out_title")}</Title>
        <Body>{t("invite_open.signed_out_body", { app: APP_NAME })}</Body>
        <Button title={t("invite_open.open_page")} onPress={() => WebBrowser.openBrowserAsync(webPage)} />
        <Button title={t("invite_open.join")} variant="secondary" onPress={() => router.replace("/")} />
      </Screen>
    );
  }
  if (!error) return <Loading />;
  return (
    <Screen>
      <BackButton />
      <ErrorMessage message={errorMessage(t, error)} />
      <Button title={t("invite_open.to_events")} variant="secondary" onPress={() => router.replace("/events")} />
    </Screen>
  );
}
