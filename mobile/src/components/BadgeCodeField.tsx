/**
 * "Have a badge code?": the 6-character code from the collect page, for a
 * guest who just installed the app (the link can't survive the install).
 * Shown on the last joining step and in My Impact. While joining, the
 * unlock moment waits until they reach the events tab (AppWatchers).
 */
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, claimBadge } from "../api";
import { useAuth } from "../auth";
import { errorMessage } from "../i18n/errors";
import { Button, Caption, ErrorMessage, Field, GlassCard, Notice, Section } from "../ui";

export function BadgeCodeField({ celebrateNow = true }: { celebrateNow?: boolean }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [collected, setCollected] = useState(false);

  async function onClaim() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setCollected(false);
    try {
      const { celebrations } = await claimBadge(token, { code: code.trim().toUpperCase() });
      setCode("");
      setCollected(true);
      if (celebrateNow && celebrations.length > 0) router.push("/celebrate");
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlassCard>
      <Section>{t("claim.title")}</Section>
      <Caption onGlass>{t("claim.intro")}</Caption>
      <Field
        label={t("claim.code_label")}
        icon="ribbon-outline"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
      />
      <ErrorMessage message={errorMessage(t, error)} />
      {collected ? <Notice message={t("claim.collected")} /> : null}
      <Button title={t("claim.button")} variant="secondary" onPress={onClaim} busy={busy} disabled={code.trim().length !== 6} />
    </GlassCard>
  );
}
