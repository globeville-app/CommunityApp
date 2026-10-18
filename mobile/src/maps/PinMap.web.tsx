/**
 * BROWSER DEMO ONLY. Phones show a real map (PinMap.tsx). Here a simple
 * stand-in grid around the neighborhood: tap to drop or move the pin.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LatLng } from "../apiTypes";
import { alpha, colors, radius, type } from "../theme";

// About 650 m each way from the center.
const SPAN = 0.006;

export function PinMap({ center, pin, onChange, locked }: { center: LatLng; pin: LatLng | null; onChange: (pin: LatLng) => void; locked?: boolean }) {
  const { t } = useTranslation();
  const [box, setBox] = useState({ width: 1, height: 1 });
  const at = pin
    ? {
        left: ((pin.longitude - center.longitude) / SPAN / 2 + 0.5) * box.width,
        top: ((center.latitude - pin.latitude) / SPAN / 2 + 0.5) * box.height,
      }
    : null;
  return (
    <Pressable
      testID="pin-map"
      accessibilityLabel={t("post.pin_map_label")}
      disabled={locked}
      onLayout={(e) => setBox(e.nativeEvent.layout)}
      onPress={(e) => {
        const x = e.nativeEvent.locationX / box.width - 0.5;
        const y = e.nativeEvent.locationY / box.height - 0.5;
        onChange({
          latitude: Number((center.latitude - y * 2 * SPAN).toFixed(6)),
          longitude: Number((center.longitude + x * 2 * SPAN).toFixed(6)),
        });
      }}
      style={styles.frame}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={`h${i}`} style={[styles.street, { top: `${i * 16}%`, left: 0, right: 0, height: i === 3 ? 6 : 2 }]} />
      ))}
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={`v${i}`} style={[styles.street, { left: `${i * 16}%`, top: 0, bottom: 0, width: i === 2 ? 6 : 2 }]} />
      ))}
      <View style={styles.park} />
      <Text style={[type.caption, styles.note]}>{t("post.pin_demo_map")}</Text>
      {at ? (
        <View pointerEvents="none" style={[styles.pin, { left: at.left - 16, top: at.top - 32 }]}>
          <Ionicons name="location" size={32} color={colors.glowPink} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 320,
    borderRadius: radius.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassDarkBorder,
    backgroundColor: "#2A1F55",
  },
  street: { position: "absolute", backgroundColor: alpha("#FFFFFF", 0.14) },
  park: {
    position: "absolute",
    left: "50%",
    top: "52%",
    width: "22%",
    height: "18%",
    borderRadius: 12,
    backgroundColor: alpha(colors.glowTurquoise, 0.18),
  },
  note: { position: "absolute", left: 10, bottom: 8, color: colors.textSecondary },
  pin: { position: "absolute" },
});
