/**
 * BROWSER DEMO ONLY: sample addresses to tap, because matching in the demo
 * is simulated. All are public places, never someone's home.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SIMULATE_OUTAGE } from "../demo/fakeBackend";
import { colors } from "../ui";

const SAMPLES = [
  { label: "City and County Building", address: "1437 Bannock St, Denver, CO 80202" },
  { label: "Little Man Ice Cream (LoHi)", address: "2620 16th St, Denver, CO 80211" },
  { label: "Museum of Nature & Science", address: "2001 Colorado Blvd, Denver, CO 80205" },
  { label: "Aurora Municipal Center", address: "15151 E Alameda Pkwy, Aurora, CO 80012" },
  { label: "A misspelled address", address: "1437 Banock Stret" },
  { label: "Lookup service down", address: `${SIMULATE_OUTAGE} 1437 Bannock St, Denver` },
];

export function DemoAddressHints({ onPick }: { onPick: (address: string) => void }) {
  return (
    <View style={styles.box}>
      <Text style={styles.heading}>Try a sample address</Text>
      <Text style={styles.note}>
        The demo simulates matching. It also recognizes Denver neighborhood names you type, like "Five
        Points".
      </Text>
      <View style={styles.list}>
        {SAMPLES.map((sample) => (
          <Pressable
            key={sample.label}
            accessibilityRole="button"
            accessibilityLabel={`Use sample: ${sample.label}`}
            onPress={() => onPick(sample.address)}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Text style={styles.chipText}>{sample.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8, padding: 14, borderRadius: 12, backgroundColor: colors.accentLight },
  heading: { fontSize: 14, fontWeight: "700", color: colors.accent },
  note: { fontSize: 13, lineHeight: 18, color: colors.text },
  list: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pressed: { opacity: 0.6 },
  chipText: { fontSize: 13, color: colors.accent, fontWeight: "600" },
});
