/** Settings → Blocked members: everyone this member blocked, to unblock them. */
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, BlockedMember, getBlockedMembers, setBlocked } from "../api";
import { useAuth } from "../auth";
import { errorMessage } from "../i18n/errors";
import { BackButton, Body, ErrorMessage, GlassCard, ListRow, Loading, Screen, TextLink, Title } from "../ui";

export default function BlockedMembers() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [members, setMembers] = useState<BlockedMember[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      getBlockedMembers(token)
        .then((reply) => setMembers(reply.members))
        .catch((e) => setError(e as ApiError));
    }, [token]),
  );

  async function unblock(member: BlockedMember) {
    if (!token) return;
    try {
      await setBlocked(token, member.id, false);
      setMembers((current) => (current ?? []).filter((m) => m.id !== member.id));
    } catch (e) {
      setError(e as ApiError);
    }
  }

  if (!members && !error) return <Loading />;
  return (
    <Screen>
      <BackButton />
      <Title>{t("settings.blocked_members")}</Title>
      <ErrorMessage message={errorMessage(t, error)} />
      {members && members.length === 0 ? <Body muted>{t("settings.blocked_none")}</Body> : null}
      {members && members.length > 0 ? (
        <GlassCard style={{ gap: 0, paddingVertical: 6 }}>
          {members.map((member) => (
            <ListRow key={member.id} label={member.display_name}>
              <TextLink label={t("settings.unblock")} onPress={() => unblock(member)} />
            </ListRow>
          ))}
        </GlassCard>
      ) : null}
    </Screen>
  );
}
