/**
 * BROWSER DEMO ONLY: sample addresses to tap, because the demo can't look up
 * addresses. All are public places, never someone's home.
 */
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SIMULATE_OUTAGE } from "../demo/fakeBackend";
import { colors, type } from "../theme";
import { GlassCard } from "../ui";

// Place names are proper names, kept as they are in both languages, like
// neighborhood names. The last two samples are descriptions, so they're
// translated (labelKey).
const SAMPLES: { name?: string; labelKey?: string; address: string }[] = [
  { name: "City and County Building", address: "1437 Bannock St, Denver, CO 80202" },
  { name: "Little Man Ice Cream (LoHi)", address: "2620 16th St, Denver, CO 80211" },
  { name: "Museum of Nature & Science", address: "2001 Colorado Blvd, Denver, CO 80205" },
  { name: "Union Station", address: "1701 Wynkoop St, Denver, CO 80202" },
  { name: "Coors Field", address: "2001 Blake St, Denver, CO 80205" },
  { name: "Aurora Municipal Center", address: "15151 E Alameda Pkwy, Aurora, CO 80012" },
  { labelKey: "demo.sample_misspelled", address: "1437 Banock Stret" },
  { labelKey: "demo.sample_outage", address: `${SIMULATE_OUTAGE} 1437 Bannock St, Denver` },
];

export function DemoAddressHints({ onPick }: { onPick: (address: string) => void }) {
  const { t } = useTranslation();
  return (
    <GlassCard>
      <Text style={[type.label, { color: colors.glowTurquoise }]}>{t("demo.samples_title")}</Text>
      <Text style={[type.caption, { color: colors.textSecondary }]}>{t("demo.samples_body")}</Text>
      <View style={styles.list}>
        {SAMPLES.map((sample) => {
          const label = sample.labelKey ? t(sample.labelKey) : sample.name!;
          return (
            <Pressable
              key={sample.address}
              accessibilityRole="button"
              accessibilityLabel={t("demo.use_sample", { name: label })}
              onPress={() => onPick(sample.address)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Text style={[type.caption, { color: colors.textPrimary }]}>{label}</Text>
            </Pressable>
          );
        })}
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
