/** "Forgot password?" step 2: the emailed code plus a new password, then straight in. */
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, confirmPasswordReset } from "../api";
import { useAuth } from "../auth";
import { errorMessage } from "../i18n/errors";
import { useLanguage } from "../language";
import { resetTo } from "../navigation";
import { Button, Caption, ErrorMessage, Field, Intro, JoinHeader, Screen, Title, TroubleLink } from "../ui";

export default function ResetPassword() {
  const { t } = useTranslation();
  const { email = "" } = useLocalSearchParams<{ email: string }>();
  const { signIn } = useAuth();
  const { syncAfterLogin } = useLanguage();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { token, language } = await confirmPasswordReset(email, code.trim(), password);
      await syncAfterLogin(token, language);
      await signIn(token);
      resetTo("/");
    } catch (e) {
      setError(e as ApiError);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <JoinHeader back />
      <Title>{t("auth.reset_title")}</Title>
      <Intro>{t("auth.reset_intro", { email })}</Intro>
      <Field
        label={t("auth.code_label")}
        icon="keypad-outline"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
      />
      <Field
        label={t("auth.new_password_label")}
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        onSubmitEditing={onSubmit}
      />
      <Caption>{t("auth.password_hint")}</Caption>
      <ErrorMessage message={errorMessage(t, error)} />
      <Button title={t("auth.reset_button")} onPress={onSubmit} busy={busy} disabled={code.trim().length !== 6 || !password} />
      <TroubleLink from="join/reset-password" />
    </Screen>
  );
}
