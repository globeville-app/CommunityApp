/**
 * BROWSER DEMO ONLY: sample addresses to tap, because the demo can't look up
 * addresses. All are public places, never someone's home.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SIMULATE_OUTAGE } from "../demo/fakeBackend";
import { colors, type } from "../theme";
import { GlassCard } from "../ui";

const SAMPLES = [
  { label: "City and County Building", address: "1437 Bannock St, Denver, CO 80202" },
  { label: "Little Man Ice Cream (LoHi)", address: "2620 16th St, Denver, CO 80211" },
  { label: "Museum of Nature & Science", address: "2001 Colorado Blvd, Denver, CO 80205" },
  { label: "Union Station", address: "1701 Wynkoop St, Denver, CO 80202" },
  { label: "Coors Field", address: "2001 Blake St, Denver, CO 80205" },
  { label: "Aurora Municipal Center", address: "15151 E Alameda Pkwy, Aurora, CO 80012" },
  { label: "A misspelled address", address: "1437 Banock Stret" },
  { label: "Lookup service down", address: `${SIMULATE_OUTAGE} 1437 Bannock St, Denver` },
];

export function DemoAddressHints({ onPick }: { onPick: (address: string) => void }) {
  return (
    <GlassCard>
      <Text style={[type.label, { color: colors.glowTurquoise }]}>Try a sample address</Text>
      <Text style={[type.caption, { color: colors.textSecondary }]}>
        Samples use their real locations and Denver's official neighborhood map. The demo can't look up
        other addresses, but it recognizes Denver neighborhood names you type, like "Five Points".
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
            <Text style={[type.caption, { color: colors.textPrimary }]}>{sample.label}</Text>
          </Pressable>
        ))}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pressed: { opacity: 0.6 },
});
