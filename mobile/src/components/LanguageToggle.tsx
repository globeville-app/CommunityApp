/**
 * English | Español (docs/LANGUAGE.md). Each name is written in its own
 * language and never translated; the current one is highlighted. Switching
 * re-renders the screens in place, so anything typed stays put.
 */
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LANGUAGE_NAMES, LANGUAGES } from "../i18n";
import { useLanguage } from "../language";
import { colors, MIN_TOUCH, type } from "../theme";

export function LanguageToggle() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("language.toggle_label")} style={styles.group}>
      {LANGUAGES.map((option) => {
        const selected = option === language;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected, checked: selected }}
            accessibilityLabel={LANGUAGE_NAMES[option]}
            // Read each name in its own language.
            accessibilityLanguage={option}
            onPress={() => setLanguage(option)}
            style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}
          >
            <Text style={[type.label, { color: selected ? colors.base : colors.textPrimary }]}>
              {LANGUAGE_NAMES[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: "row",
    padding: 3,
    gap: 2,
    borderRadius: MIN_TOUCH / 2 + 3,
    backgroundColor: colors.glassDark,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  option: {
    minHeight: MIN_TOUCH - 6,
    paddingHorizontal: 14,
    borderRadius: (MIN_TOUCH - 6) / 2,
    justifyContent: "center",
  },
  selected: { backgroundColor: colors.textPrimary },
  pressed: { opacity: 0.7 },
});
