/**
 * BROWSER DEMO ONLY: the phone pickers don't run in a browser, so the
 * demo uses the browser's own date and time inputs. Same values as the
 * phone version ("2026-10-24", "18:00").
 */
import { StyleSheet, Text, View } from "react-native";

import { colors, MIN_TOUCH, type } from "../theme";

type Props = { label: string; mode: "date" | "time"; value: string; onChange: (value: string) => void };

export function DateTimeField({ label, mode, value, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Text style={[type.label, styles.label]}>{label}</Text>
      <input
        type={mode}
        aria-label={label}
        value={value}
        step={mode === "time" ? 300 : undefined}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        style={{
          minHeight: MIN_TOUCH,
          padding: "0 14px",
          borderRadius: 16,
          border: `1px solid ${colors.glassBorder}`,
          background: colors.glass,
          color: colors.textPrimary,
          fontFamily: "Outfit_400Regular, sans-serif",
          fontSize: 16,
          colorScheme: "dark",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: MIN_TOUCH },
  label: { color: colors.textSoft, flexShrink: 1 },
});
