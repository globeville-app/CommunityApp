/**
 * An organization's admins (1-5): add one by an existing member's email,
 * remove one, or leave. The last admin can't leave.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { addOrganizationAdmin, ApiError, getOrganization, OrgPage, removeOrganizationAdmin } from "../api";
import { useAuth } from "../auth";
import { errorMessage } from "../i18n/errors";
import { colors, type } from "../theme";
import { BackButton, Button, Caption, Divider, ErrorMessage, Field, GlassCard, ListRow, Loading, Screen, TextLink, Title } from "../ui";

const MAX_ADMINS = 5;

export default function OrganizationAdmins() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [org, setOrg] = useState<OrgPage | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!token) return;
    getOrganization(token, Number(id))
      .then(setOrg)
      .catch((e) => setError(e as ApiError));
  }, [token, id]);

  if (!org) return error ? <Screen><BackButton /><ErrorMessage message={errorMessage(t, error)} /></Screen> : <Loading />;
  const admins = org.admins ?? [];

  async function onAdd() {
    if (!token || !org) return;
    setBusy(true);
    setError(null);
    try {
      setOrg(await addOrganizationAdmin(token, org.id, email.trim()));
      setEmail("");
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(memberId: number, isYou: boolean) {
    if (!token || !org) return;
    setError(null);
    try {
      const result = await removeOrganizationAdmin(token, org.id, memberId);
      if (isYou) router.dismissTo("/my-organizations");
      else if (result) setOrg(result);
    } catch (e) {
      setError(e as ApiError);
    }
  }

  return (
    <Screen>
      <BackButton />
      <Title>{t("organizations.admins")}</Title>
      <Caption>{t("organizations.admins_intro")}</Caption>
      <GlassCard style={{ gap: 0, paddingVertical: 6 }}>
        {admins.map((admin, i) => (
          <View key={admin.member_id ?? i}>
            {i > 0 ? <Divider /> : null}
            <ListRow label={admin.is_you ? t("organizations.you", { name: admin.display_name }) : admin.display_name ?? ""}>
              {admins.length > 1 && admin.member_id ? (
                <TextLink
                  label={admin.is_you ? t("organizations.leave") : t("organizations.remove")}
                  onPress={() => onRemove(admin.member_id!, admin.is_you)}
                />
              ) : null}
            </ListRow>
          </View>
        ))}
      </GlassCard>
      {admins.length < MAX_ADMINS ? (
        <GlassCard>
          <Text style={[type.section, { color: colors.textPrimary }]}>{t("organizations.add_admin")}</Text>
          <Field
            label={t("organizations.admin_email")}
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button title={t("organizations.add")} variant="secondary" onPress={onAdd} busy={busy} disabled={!email.trim()} />
        </GlassCard>
      ) : (
        <Caption>{t("organizations.admins_full")}</Caption>
      )}
      <ErrorMessage message={errorMessage(t, error)} />
    </Screen>
  );
}
