/**
 * The app's starting point. It never shows anything for long; it decides
 * where the person should be:
 *
 *   not logged in             → Welcome
 *   logged in, no profile yet → Address (they re-enter it; it's never saved)
 *   logged in, has profile    → Events
 */
import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, getMyProfile } from "../api";
import { useAuth } from "../auth";
import { errorMessage } from "../i18n/errors";
import { Button, ErrorMessage, Intro, Loading, Screen, Title } from "../ui";

type Destination = "/welcome" | "/address" | "/events";

export default function Start() {
  const { t } = useTranslation();
  const { token, isLoading, signOut } = useAuth();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const decide = useCallback(async () => {
    setError(null);
    if (!token) {
      setDestination("/welcome");
      return;
    }
    try {
      await getMyProfile(token);
      setDestination("/events");
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "profile_not_found") {
        setDestination("/address");
      } else if (err.status === 401) {
        await signOut(); // token no longer valid
        setDestination("/welcome");
      } else {
        setError(err);
      }
    }
  }, [token, signOut]);

  useEffect(() => {
    if (!isLoading) decide();
  }, [isLoading, decide]);

  if (destination) return <Redirect href={destination} />;
  if (error) {
    return (
      <Screen>
        <Title>{t("start.error_title")}</Title>
        <ErrorMessage message={errorMessage(t, error)} />
        <Intro>{t("start.error_hint")}</Intro>
        <Button title={t("common.try_again")} onPress={decide} />
      </Screen>
    );
  }
  return <Loading />;
}
