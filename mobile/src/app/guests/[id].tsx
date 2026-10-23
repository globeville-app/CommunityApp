/**
 * The host's guest list (docs/MILESTONE_5.md): members' display names and
 * guests' first names, with Remove; after the event, "Came: X of Y". Never
 * phone numbers, and never who didn't come. Resource fairs and donation
 * drives show counts only.
 */
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ApiError, getGuests, GuestList, removeGuest } from "../../api";
import { useAuth } from "../../auth";
import { errorMessage } from "../../i18n/errors";
import {
  BackButton,
  Body,
  Caption,
  ConfirmDialog,
  Divider,
  ErrorMessage,
  GlassCard,
  ListRow,
  Loading,
  Screen,
  Section,
  TextLink,
  Title,
} from "../../ui";

export default function Guests() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Number(id);
  const [list, setList] = useState<GuestList | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [removing, setRemoving] = useState<{ id: number; first_name: string } | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    getGuests(token, eventId)
      .then(setList)
      .catch((e) => setError(e as ApiError));
  }, [token, eventId]);

  useFocusEffect(load);

  async function onRemove() {
    const guest = removing;
    setRemoving(null);
    if (!token || !guest) return;
    try {
      await removeGuest(token, eventId, guest.id);
      load();
    } catch (e) {
      setError(e as ApiError);
    }
  }

  if (!list && !error) return <Loading />;
  return (
    <Screen>
      <BackButton />
      <Title>{t("guests.title")}</Title>
      <ErrorMessage message={errorMessage(t, error)} />
      {list ? (
        <>
          <Body>{t("events.going_count", { count: list.going_count })}</Body>
          {list.came ? (
            <GlassCard>
              <Section>{t("guests.came", { confirmed: list.came.confirmed, of: list.came.of })}</Section>
              <Caption onGlass>{t("guests.came_note")}</Caption>
            </GlassCard>
          ) : null}
          {list.names_hidden ? (
            <Caption>{t("guests.names_hidden")}</Caption>
          ) : (
            <GlassCard style={{ gap: 0, paddingVertical: 6 }}>
              {list.members.map((member, i) => (
                <View key={`m${i}`}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow label={member.display_name} />
                </View>
              ))}
              {list.guests.map((guest, i) => (
                <View key={`g${guest.id}`}>
                  {i > 0 || list.members.length > 0 ? <Divider /> : null}
                  <ListRow label={t("guests.guest_name", { name: guest.first_name })}>
                    <TextLink label={t("guests.remove")} onPress={() => setRemoving(guest)} />
                  </ListRow>
                </View>
              ))}
              {list.members.length + list.guests.length === 0 ? <Caption onGlass>{t("guests.none")}</Caption> : null}
            </GlassCard>
          )}
        </>
      ) : null}
      <ConfirmDialog
        visible={removing !== null}
        title={t("guests.remove_confirm", { name: removing?.first_name ?? "" })}
        confirmLabel={t("guests.remove")}
        cancelLabel={t("settings.cancel")}
        onConfirm={onRemove}
        onCancel={() => setRemoving(null)}
      />
    </Screen>
  );
}
