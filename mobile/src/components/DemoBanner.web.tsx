/** BROWSER DEMO ONLY: a strip saying this is a demo, with a reset button. */
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../auth";
import { resetDemo } from "../demo/fakeBackend";
import { resetTo } from "../navigation";
import { colors } from "../ui";

export function DemoBanner() {
  const { signOut } = useAuth();

  async function onReset() {
    resetDemo();
    await signOut();
    resetTo("/welcome");
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        <Text style={styles.strong}>Demo</Text> · sample data · simulated matching · stays in this browser
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset demo" onPress={onReset} style={styles.reset}>
        <Text style={styles.resetText}>Reset</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.accent,
  },
  text: { flex: 1, color: "#FFFFFF", fontSize: 12, lineHeight: 16 },
  strong: { fontWeight: "700" },
  reset: { minHeight: 32, paddingHorizontal: 10, justifyContent: "center", borderRadius: 6, borderWidth: 1, borderColor: "#FFFFFF80" },
  resetText: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
});
