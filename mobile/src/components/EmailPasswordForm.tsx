/** The shared form behind the Sign up and Log in screens. */
import { useState } from "react";

import { ApiError } from "../api";
import { useAuth } from "../auth";
import { resetTo } from "../navigation";
import { BackButton, Button, Caption, ErrorMessage, Field, Screen, Title } from "../ui";

type Props = {
  title: string;
  buttonTitle: string;
  hint?: string;
  submit: (email: string, password: string) => Promise<{ token: string }>;
};

export function EmailPasswordForm({ title, buttonTitle, hint, submit }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { token } = await submit(email.trim(), password);
      await signIn(token);
      // The start screen works out where to go next.
      resetTo("/");
    } catch (e) {
      setError((e as ApiError).message);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <BackButton />
      <Title>{title}</Title>
      <Field
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <Field
        label="Password"
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType="password"
        onSubmitEditing={onSubmit}
      />
      {hint ? <Caption>{hint}</Caption> : null}
      <ErrorMessage message={error} />
      <Button title={buttonTitle} onPress={onSubmit} busy={busy} disabled={!email || !password} />
    </Screen>
  );
}
