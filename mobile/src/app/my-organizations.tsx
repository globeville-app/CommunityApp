/**
 * Settings → Your organizations: invitations to help run one, the ones I
 * run, with their status, and "Request an organization".
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { answerOrganizationInvite, getMyOrganizations, getOrganizationInvites, MyOrg, OrgInvite } from "../api";
import { useAuth } from "../auth";
import { OrgRow } from "../components/OrgRow";
import { BackButton, Body, Button, Caption, GlassCard, Loading, Screen, Section, Title } from "../ui";

export default function MyOrganizations() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [orgs, setOrgs] = useState<MyOrg[] | null>(null);
  const [invites, setInvites] = useState<OrgInvite[]>([]);

  const load = useCallback(() => {
    if (!token) return;
    getMyOrganizations(token)
      .then((data) => setOrgs(data.organizations))
      .catch(() => setOrgs([]));
    getOrganizationInvites(token)
      .then((data) => setInvites(data.invites))
      .catch(() => setInvites([]));
  }, [token]);

  useFocusEffect(load);

  async function answer(invite: OrgInvite, accept: boolean) {
    if (!token) return;
    await answerOrganizationInvite(token, invite.id, accept).catch(() => undefined);
    load();
  }

  if (!orgs) return <Loading />;
  return (
    <Screen>
      <BackButton />
      <Title>{t("organizations.yours")}</Title>
      {invites.length > 0 ? (
        <GlassCard>
          <Section>{t("organizations.invites_title")}</Section>
          {invites.map((invite) => (
            <View key={invite.id} style={{ gap: 8 }}>
              <Body onGlass>{t("organizations.invite_text", { name: invite.organization.name })}</Body>
              <Button title={t("organizations.accept")} onPress={() => answer(invite, true)} />
              <Button title={t("organizations.decline")} variant="secondary" onPress={() => answer(invite, false)} />
            </View>
          ))}
        </GlassCard>
      ) : null}
      <GlassCard style={{ gap: 0, paddingVertical: 6 }}>
        {orgs.length === 0 ? (
          <Caption onGlass>{t("organizations.you_run_none")}</Caption>
        ) : (
          orgs.map((org, i) => (
            <OrgRow
              key={org.id}
              org={org}
              status={org.status}
              divider={i > 0}
              onPress={() => router.push({ pathname: "/organizations/[id]", params: { id: String(org.id) } })}
            />
          ))
        )}
      </GlassCard>
      <Button title={t("organizations.request")} onPress={() => router.push("/organization-form")} />
      <Caption>{t("organizations.request_intro")}</Caption>
    </Screen>
  );
}
