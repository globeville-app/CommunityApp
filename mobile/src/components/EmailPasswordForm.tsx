/** The shared form behind the Sign up and Log in screens. */
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, AuthResult } from "../api";
import { useAuth } from "../auth";
import { errorMessage } from "../i18n/errors";
import { useLanguage } from "../language";
import { resetTo } from "../navigation";
import { Button, Caption, ErrorMessage, Field, JoinHeader, Screen, Title } from "../ui";

type Props = {
  title: string;
  buttonTitle: string;
  hint?: string;
  submit: (email: string, password: string) => Promise<AuthResult>;
};

export function EmailPasswordForm({ title, buttonTitle, hint, submit }: Props) {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const { syncAfterLogin } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Kept as the error itself, not its words, so it re-translates if the
  // language is switched while it's showing.
  const [error, setError] = useState<ApiError | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { token, language } = await submit(email.trim(), password);
      await syncAfterLogin(token, language);
      await signIn(token);
      // The start screen works out where to go next.
      resetTo("/");
    } catch (e) {
      setError(e as ApiError);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <JoinHeader back />
      <Title>{title}</Title>
      <Field
        label={t("auth.email_label")}
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Field
        label={t("auth.password_label")}
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType="password"
        onSubmitEditing={onSubmit}
      />
      {hint ? <Caption>{hint}</Caption> : null}
      <ErrorMessage message={errorMessage(t, error)} />
      <Button title={buttonTitle} onPress={onSubmit} busy={busy} disabled={!email || !password} />
    </Screen>
  );
}
