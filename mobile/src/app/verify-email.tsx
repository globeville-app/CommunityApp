/**
 * New members type the 6-digit code from the welcome email before joining.
 * The start screen sends people here whenever the server says
 * "email_not_verified".
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, logout, resendVerification, verifyEmail } from "../api";
import { useAuth } from "../auth";
import { errorMessage } from "../i18n/errors";
import { resetTo } from "../navigation";
import { Button, ErrorMessage, Field, Intro, JoinHeader, Notice, Screen, TextLink, Title, TroubleLink } from "../ui";

export default function VerifyEmail() {
  const { t } = useTranslation();
  const { token, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onSubmit() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await verifyEmail(token, code.trim());
      resetTo("/"); // the start screen takes them to the address step
    } catch (e) {
      setError(e as ApiError);
      setBusy(false);
    }
  }

  async function onResend() {
    if (!token) return;
    setError(null);
    setResent(false);
    try {
      await resendVerification(token);
      setResent(true);
    } catch (e) {
      setError(e as ApiError);
    }
  }

  async function onOtherEmail() {
    if (token) await logout(token).catch(() => undefined);
    await signOut();
    resetTo("/welcome");
  }

  return (
    <Screen>
      <JoinHeader />
      <Title>{t("auth.verify_title")}</Title>
      <Intro>{t("auth.verify_intro")}</Intro>
      <Field
        label={t("auth.code_label")}
        icon="keypad-outline"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        onSubmitEditing={onSubmit}
      />
      {resent ? <Notice message={t("auth.verify_resent")} /> : null}
      <ErrorMessage message={errorMessage(t, error)} />
      <Button title={t("auth.verify_button")} onPress={onSubmit} busy={busy} disabled={code.trim().length !== 6} />
      <TextLink label={t("auth.verify_resend")} onPress={onResend} />
      <TextLink label={t("auth.verify_other_email")} onPress={onOtherEmail} />
      <TroubleLink from="join/verify-email" />
    </Screen>
  );
}
