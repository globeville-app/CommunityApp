/**
 * Delete account (docs/SETTINGS.md): says plainly what happens, asks for the
 * password, then deletes everything on the server and logs out here.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, deleteAccount } from "../api";
import { useAuth } from "../auth";
import { errorMessage } from "../i18n/errors";
import { resetTo } from "../navigation";
import { BackButton, Body, Button, ErrorMessage, Field, GlassCard, Screen, Title } from "../ui";

export default function DeleteAccount() {
  const { t } = useTranslation();
  const { token, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onDelete() {
    if (!token || !password) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(token, password);
    } catch (e) {
      setError(e as ApiError);
      setBusy(false);
      return;
    }
    // The server already deleted the token; forget it here too.
    await signOut();
    resetTo({ pathname: "/welcome", params: { deleted: "1" } });
  }

  return (
    <Screen>
      <BackButton />
      <Title>{t("delete.title")}</Title>
      <GlassCard>
        <Body>{t("delete.warning")}</Body>
      </GlassCard>
      <Field
        label={t("delete.password_label")}
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType="password"
      />
      <ErrorMessage message={errorMessage(t, error)} />
      <Button title={t("delete.delete_button")} variant="danger" onPress={onDelete} busy={busy} disabled={!password} />
    </Screen>
  );
}
