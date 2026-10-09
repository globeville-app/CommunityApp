/**
 * "What are you into?": interests are event categories, picked with the same
 * picker as events (several at once, up to 8, no "Other"). Optional: "Skip
 * for now" is always there. Shown after joining (onboarding=1), and from the
 * Profile tab and the Events "For you" chip.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, getMyProfile, updateInterests } from "../api";
import { useAuth } from "../auth";
import { useCategories } from "../categories";
import { CategoryPicker } from "../components/CategoryPicker";
import { errorMessage } from "../i18n/errors";
import { resetTo } from "../navigation";
import { BackButton, Button, ErrorMessage, Intro, Loading, Screen, TextLink, Title } from "../ui";

export default function Interests() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { ready } = useCategories();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const [selected, setSelected] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!token) return;
    getMyProfile(token)
      .then((profile) => setSelected(profile.interests))
      .catch(() => setSelected([]));
  }, [token]);

  function leave() {
    if (onboarding) resetTo("/events");
    else router.back();
  }

  async function onDone() {
    if (!token || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await updateInterests(token, selected);
      leave();
    } catch (e) {
      setError(e as ApiError);
      setBusy(false);
    }
  }

  if (!ready || !selected) return <Loading />;

  return (
    <Screen>
      {onboarding ? null : <BackButton />}
      <Title>{t("picker.interests_title")}</Title>
      <Intro>{t("picker.interests_subtitle")}</Intro>
      <TextLink label={t("picker.skip")} onPress={leave} />
      <CategoryPicker mode="multi" selected={selected} onChange={setSelected} />
      <ErrorMessage message={errorMessage(t, error)} />
      <Button title={t("picker.done")} onPress={onDone} busy={busy} />
    </Screen>
  );
}
