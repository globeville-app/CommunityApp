/**
 * Settings → Your organizations: the ones I run, with their status, and
 * "Request an organization".
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { getMyOrganizations, MyOrg } from "../api";
import { useAuth } from "../auth";
import { OrgRow } from "../components/OrgRow";
import { BackButton, Button, Caption, GlassCard, Loading, Screen, Title } from "../ui";

export default function MyOrganizations() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [orgs, setOrgs] = useState<MyOrg[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      getMyOrganizations(token)
        .then((data) => setOrgs(data.organizations))
        .catch(() => setOrgs([]));
    }, [token]),
  );

  if (!orgs) return <Loading />;
  return (
    <Screen>
      <BackButton />
      <Title>{t("organizations.yours")}</Title>
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
