/** "Forgot password?" step 1: the server emails a 6-digit code. */
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, requestPasswordReset } from "../api";
import { errorMessage } from "../i18n/errors";
import { Button, ErrorMessage, Field, Intro, JoinHeader, Screen, Title, TroubleLink } from "../ui";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      router.push({ pathname: "/reset-password", params: { email: email.trim() } });
    } catch (e) {
      setError(e as ApiError);
    }
    setBusy(false);
  }

  return (
    <Screen>
      <JoinHeader back />
      <Title>{t("auth.forgot_title")}</Title>
      <Intro>{t("auth.forgot_intro")}</Intro>
      <Field
        label={t("auth.email_label")}
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={onSubmit}
      />
      <ErrorMessage message={errorMessage(t, error)} />
      <Button title={t("auth.forgot_button")} onPress={onSubmit} busy={busy} disabled={!email.trim()} />
      <TroubleLink from="join/forgot-password" />
    </Screen>
  );
}
