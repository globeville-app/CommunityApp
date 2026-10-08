/** BROWSER DEMO ONLY: a strip saying this is a demo, with a reset button. */
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../auth";
import { resetDemo } from "../demo/fakeBackend";
import { resetTo } from "../navigation";
import { colors, fonts } from "../theme";

export function DemoBanner() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  async function onReset() {
    resetDemo();
    await signOut();
    resetTo("/welcome");
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        <Text style={styles.strong}>{t("demo.banner_label")}</Text> · {t("demo.banner_text")}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("demo.reset_label")} onPress={onReset} style={styles.reset}>
        <Text style={styles.resetText}>{t("demo.reset_button")}</Text>
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
    backgroundColor: colors.glassDarkSolid,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassDarkBorder,
    zIndex: 2,
  },
  text: { flex: 1, color: colors.textSecondary, fontSize: 12, lineHeight: 16, fontFamily: fonts.regular },
  strong: { color: colors.glowYellow, fontFamily: fonts.semibold },
  reset: {
    minHeight: 32,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
  },
  resetText: { color: colors.textPrimary, fontSize: 12, fontFamily: fonts.semibold },
});
