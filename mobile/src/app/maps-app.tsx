/**
 * Settings → Maps app: "Ask every time", or one of the maps apps on this
 * phone. Saved on the phone only.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { getRememberedMapApp, setRememberedMapApp } from "../maps/mapsPreference";
import { installedMapApps, MapApp } from "../maps/openIn";
import { BackButton, Caption, Choice, GlassCard, Loading, Screen, Title } from "../ui";

export default function MapsApp() {
  const { t } = useTranslation();
  const [installed, setInstalled] = useState<MapApp[] | null>(null);
  const [chosen, setChosen] = useState<MapApp | null>(null);

  useEffect(() => {
    Promise.all([installedMapApps(), getRememberedMapApp()]).then(([apps, saved]) => {
      setInstalled(apps);
      setChosen(saved && apps.includes(saved) ? saved : null);
    });
  }, []);

  async function choose(app: MapApp | null) {
    setChosen(app);
    await setRememberedMapApp(app);
  }

  if (!installed) return <Loading />;
  return (
    <Screen>
      <BackButton />
      <Title>{t("maps.settings_title")}</Title>
      <GlassCard>
        <View style={{ gap: 10 }}>
          <Choice label={t("maps.ask_every_time")} selected={chosen === null} onPress={() => choose(null)} />
          {installed.map((app) => (
            <Choice key={app} label={t(`maps.app_${app}`)} selected={chosen === app} onPress={() => choose(app)} />
          ))}
        </View>
        <Caption onGlass>{t("maps.settings_note")}</Caption>
      </GlassCard>
    </Screen>
  );
}
