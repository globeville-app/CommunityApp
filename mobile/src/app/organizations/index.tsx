/**
 * Organizations serving my neighborhood, A–Z. No counts, no ranking.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, listOrganizations, OrgSummary } from "../../api";
import { useAuth } from "../../auth";
import { OrgRow } from "../../components/OrgRow";
import { errorMessage } from "../../i18n/errors";
import { BackButton, Caption, ErrorMessage, GlassCard, Loading, Screen, Title } from "../../ui";

export default function Organizations() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      listOrganizations(token)
        .then((data) => setOrgs(data.organizations))
        .catch((e) => setError(e as ApiError));
    }, [token]),
  );

  if (!orgs) {
    return error ? (
      <Screen>
        <BackButton />
        <ErrorMessage message={errorMessage(t, error)} />
      </Screen>
    ) : (
      <Loading />
    );
  }
  return (
    <Screen>
      <BackButton />
      <Title>{t("organizations.list_title")}</Title>
      <GlassCard style={{ gap: 0, paddingVertical: 6 }}>
        {orgs.length === 0 ? (
          <Caption onGlass>{t("organizations.none_here")}</Caption>
        ) : (
          orgs.map((org, i) => (
            <OrgRow
              key={org.id}
              org={org}
              divider={i > 0}
              onPress={() => router.push({ pathname: "/organizations/[id]", params: { id: String(org.id) } })}
            />
          ))
        )}
      </GlassCard>
    </Screen>
  );
}
