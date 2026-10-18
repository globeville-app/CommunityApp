/**
 * The map pin step: tap the map to drop the pin, drag it to the meeting
 * spot. Apple Maps on iPhone, Google Maps on Android (react-native-maps).
 * The pin marks the event's place, never anyone's home.
 */
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";

import type { LatLng } from "../apiTypes";
import { colors, radius } from "../theme";

export function PinMap({ center, pin, onChange, locked }: { center: LatLng; pin: LatLng | null; onChange: (pin: LatLng) => void; locked?: boolean }) {
  const { t } = useTranslation();
  const start = pin ?? center;
  return (
    <View style={styles.frame} accessibilityLabel={t("post.pin_map_label")}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ ...start, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
        onPress={locked ? undefined : (e) => onChange(e.nativeEvent.coordinate)}
        showsUserLocation={false}
        testID="pin-map"
      >
        {pin ? (
          <Marker
            coordinate={pin}
            draggable={!locked}
            onDragEnd={(e) => onChange(e.nativeEvent.coordinate)}
            pinColor={colors.glowPink}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 320, borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: colors.glassDarkBorder },
});
