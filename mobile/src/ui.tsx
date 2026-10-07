/**
 * The few building blocks every screen uses. Design: clean white, one
 * typeface (the phone's system font), near-black buttons, green accent,
 * touch targets at least 44 points tall.
 */
import { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const colors = {
  background: "#FFFFFF",
  text: "#111111",
  muted: "#5F6368",
  border: "#D9D9D9",
  primary: "#111111", // near-black buttons
  accent: "#1D6B52", // green
  accentLight: "#E6F2EE",
  error: "#B3261E",
  errorLight: "#FCEDEC",
};

const MIN_TOUCH = 44;

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "primary" | "secondary";
};

export function Button({ title, onPress, disabled, busy, variant = "primary" }: ButtonProps) {
  const isPrimary = variant === "primary";
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        (pressed || inactive) && styles.dimmed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={isPrimary ? "#FFFFFF" : colors.text} />
      ) : (
        <Text style={isPrimary ? styles.primaryText : styles.secondaryText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/** A tappable option that can be on or off (interests, alias choice). */
export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** A small read-only label, e.g. an interest on the profile. */
export function Tag({ label }: { label: string }) {
  return (
    <View style={[styles.choice, styles.choiceSelected]}>
      <Text style={[styles.choiceText, styles.choiceTextSelected]}>{label}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 24, gap: 16, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  body: { fontSize: 17, lineHeight: 24, color: colors.text },
  muted: { color: colors.muted },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: "600", color: colors.text },
  input: {
    minHeight: MIN_TOUCH + 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.text,
  },
  button: {
    minHeight: MIN_TOUCH + 6,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  primaryText: { color: "#FFFFFF", fontSize: 17, fontWeight: "600" },
  secondaryText: { color: colors.text, fontSize: 17, fontWeight: "600" },
  dimmed: { opacity: 0.6 },
  error: { backgroundColor: colors.errorLight, borderRadius: 10, padding: 12 },
  errorText: { color: colors.error, fontSize: 15, lineHeight: 21 },
  choice: {
    minHeight: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  choiceSelected: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  choiceText: { fontSize: 16, color: colors.text },
  choiceTextSelected: { color: colors.accent, fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
