/**
 * "Please update": shown instead of the whole app when the server says this
 * version is too old (GET /api/config, min_app_version). Old copies of the
 * app stay on phones for months, so this is how a server change that old
 * versions can't handle is shipped safely.
 */
import { Linking, View } from "react-native";
import { useTranslation } from "react-i18next";

import { APP_NAME, STORE_URL } from "../config";
import { Button, Intro, Screen, Title } from "../ui";

export function UpdateRequired() {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: 16 }}>
        <Title>{t("update.title")}</Title>
        <Intro>{t("update.intro", { app: APP_NAME })}</Intro>
        {STORE_URL ? <Button title={t("update.button")} onPress={() => Linking.openURL(STORE_URL)} /> : null}
      </View>
    </Screen>
  );
}
