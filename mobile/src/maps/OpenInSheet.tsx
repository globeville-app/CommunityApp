/**
 * The "Open in" sheet for an event's location, with "Remember my choice".
 * useGetThere() decides whether the sheet is needed at all: a remembered
 * app that's still installed, or a single installed app, opens directly.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, Text, View } from "react-native";

import { colors, type } from "../theme";
import { Button, Choice, Divider, ListRow, Sheet } from "../ui";
import { getRememberedMapApp, setRememberedMapApp } from "./mapsPreference";
import { installedMapApps, MapApp, openInMapApp, Place } from "./openIn";

export function useGetThere() {
  const [choices, setChoices] = useState<MapApp[] | null>(null);
  const [place, setPlace] = useState<Place | null>(null);

  async function open(next: Place) {
    const installed = await installedMapApps();
    const remembered = await getRememberedMapApp();
    if (remembered && installed.includes(remembered)) return openInMapApp(remembered, next);
    if (installed.length === 1) return openInMapApp(installed[0], next);
    // None found (rare): the browser link still works.
    setPlace(next);
    setChoices(installed.length ? installed : ["google"]);
  }

  const sheet = (
    <OpenInSheet
      choices={choices}
      onPick={async (app, remember) => {
        if (remember) await setRememberedMapApp(app);
        setChoices(null);
        if (place) await openInMapApp(app, place);
      }}
      onClose={() => setChoices(null)}
    />
  );
  return { open, sheet };
}

function OpenInSheet({
  choices,
  onPick,
  onClose,
}: {
  choices: MapApp[] | null;
  onPick: (app: MapApp, remember: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [remember, setRemember] = useState(false);
  return (
    <Modal visible={!!choices} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t("maps.close")} />
      <Sheet>
        <Text style={[type.section, { color: colors.textPrimary }]} accessibilityRole="header">
          {t("maps.open_in")}
        </Text>
        <View>
          {(choices ?? []).map((app, i) => (
            <View key={app}>
              {i > 0 ? <Divider /> : null}
              <ListRow label={t(`maps.app_${app}`)} chevron onPress={() => onPick(app, remember)} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="bookmark-outline" size={18} color={colors.textSecondary} />
          <Choice label={t("maps.remember")} selected={remember} onPress={() => setRemember(!remember)} />
        </View>
        <Button title={t("settings.cancel")} variant="secondary" onPress={onClose} />
      </Sheet>
    </Modal>
  );
}
