/**
 * The building blocks every screen uses, styled with the app's design
 * system (design/DESIGN.md, tokens in theme.ts): frosted glass over the
 * ambient glow, Outfit type, yellow primary buttons, white/glass pills.
 *
 * Text rules (from a contrast check): white and soft-white text may sit
 * directly on the glow; grey (textSecondary) and turquoise text only inside
 * dark glass (GlassCard, Sheet, ErrorMessage).
 */
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BUTTON_HEIGHT, MIN_TOUCH, SCREEN_PADDING, colors, fonts, radius, space, type } from "./theme";

export { colors } from "./theme";

type IconName = ComponentProps<typeof Ionicons>["name"];

// Android's blur support varies, so it gets a solid dark glass instead.
const canBlur = Platform.OS !== "android";

/** Frosted glass behind a view's content (blur + translucent fill). */
function Frost({ dark, intensity, style }: { dark?: boolean; intensity: number; style?: ViewStyle }) {
  if (!canBlur) {
    return (
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: dark ? colors.glassDarkSolid : colors.glass }, style]}
      />
    );
  }
  return (
    <>
      <BlurView intensity={intensity} tint="dark" style={[StyleSheet.absoluteFill, style]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? colors.glassDark : colors.glass }, style]} />
    </>
  );
}

// ---- Layout -------------------------------------------------------------------

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A round glass back button for the top of a screen. */
export function BackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      style={({ pressed }) => [styles.round, pressed && styles.pressed]}
    >
      <Frost intensity={20} style={{ borderRadius: MIN_TOUCH / 2 }} />
      <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
    </Pressable>
  );
}

// ---- Text ---------------------------------------------------------------------

export function Hero({ children, fit }: { children: ReactNode; fit?: boolean }) {
  return (
    <Text
      style={[type.hero, styles.white]}
      accessibilityRole="header"
      numberOfLines={fit ? 2 : undefined}
      adjustsFontSizeToFit={fit}
      minimumFontScale={0.5}
    >
      {children}
    </Text>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text style={[type.title, styles.white]} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <Text style={[type.section, styles.white]}>{children}</Text>;
}

/** Body text. `muted` = soft white (safe on the glow); `onGlass` = grey (dark glass only). */
export function Body({ children, muted, onGlass }: { children: ReactNode; muted?: boolean; onGlass?: boolean }) {
  return (
    <Text style={[type.body, { color: onGlass ? colors.textSecondary : muted ? colors.textSoft : colors.textPrimary }]}>
      {children}
    </Text>
  );
}

export function Intro({ children }: { children: ReactNode }) {
  return <Text style={[type.intro, { color: colors.textSoft }]}>{children}</Text>;
}

export function Caption({ children, onGlass }: { children: ReactNode; onGlass?: boolean }) {
  return <Text style={[type.caption, { color: onGlass ? colors.textSecondary : colors.textSoft }]}>{children}</Text>;
}

// ---- Inputs and buttons -------------------------------------------------------

export function Field({ label, icon, ...props }: TextInputProps & { label: string; icon?: IconName }) {
  return (
    <View style={styles.field}>
      <Text style={[type.label, { color: colors.textSoft }]}>{label}</Text>
      <View style={styles.input}>
        <Frost intensity={20} style={{ borderRadius: (BUTTON_HEIGHT - 2) / 2 }} />
        {icon ? <Ionicons name={icon} size={20} color={colors.textSoft} style={styles.inputIcon} /> : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="rgba(237,231,255,0.7)"
          selectionColor={colors.glowYellow}
          style={styles.inputText}
          {...props}
        />
      </View>
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
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={isPrimary ? colors.base : colors.textPrimary} />
      ) : (
        <Text style={[type.button, { color: isPrimary ? colors.base : colors.textPrimary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

/** A pill you can switch on and off (interests, neighborhood name choice). */
export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, selected ? styles.pillOn : styles.pillOff, pressed && styles.pressed]}
    >
      <Text style={[type.label, { color: selected ? colors.base : colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

/** A read-only pill, e.g. an interest on the profile. */
export function Tag({ label, tone = "glass" }: { label: string; tone?: "glass" | "yellow" }) {
  const yellow = tone === "yellow";
  return (
    <View style={[styles.pill, yellow ? styles.pillYellow : styles.pillOff]}>
      <Text style={[type.label, { color: yellow ? colors.base : colors.textPrimary }]}>{label}</Text>
    </View>
  );
}

// ---- Surfaces -----------------------------------------------------------------

/** Dark glass card for text blocks. */
export function GlassCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      <Frost dark intensity={30} style={{ borderRadius: radius.card }} />
      {children}
    </View>
  );
}

/** Bottom sheet: dark glass, rounded top, hairline border, grab handle. */
export function Sheet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.sheet}>
      <Frost dark intensity={30} style={{ borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet }} />
      <View style={styles.handle} />
      {children}
    </View>
  );
}

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Frost dark intensity={30} style={{ borderRadius: radius.card }} />
      <Ionicons name="alert-circle" size={20} color={colors.glowPink} />
      <Text style={[type.body, styles.errorText]}>{message}</Text>
    </View>
  );
}

/** Round glass avatar: a photo, or the first letter of the name. */
export function Avatar({ uri, initial, size = 112 }: { uri?: string | null; initial?: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Frost intensity={20} style={{ borderRadius: size / 2 }} />
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          accessibilityLabel="Profile photo"
        />
      ) : (
        <Text style={[type.title, styles.white]}>{initial}</Text>
      )}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.glowYellow} />
    </View>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "transparent" },
  flex: { flex: 1 },
  white: { color: colors.textPrimary },
  content: { padding: SCREEN_PADDING, gap: space.m, flexGrow: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  round: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  field: { gap: space.xs },
  input: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  // zIndex keeps the icon and text above the frosted layer; in a browser the
  // glass would otherwise blur the typed text.
  inputIcon: { marginRight: 10, zIndex: 1 },
  inputText: { flex: 1, height: "100%", zIndex: 1, fontFamily: fonts.regular, fontSize: 17, color: colors.textPrimary },
  button: {
    height: BUTTON_HEIGHT,
    borderRadius: BUTTON_HEIGHT / 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.l,
  },
  primary: {
    backgroundColor: colors.glowYellow,
    shadowColor: colors.glowYellow,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.secondaryBorder },
  inactive: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  pill: {
    minHeight: MIN_TOUCH,
    borderRadius: MIN_TOUCH / 2,
    paddingHorizontal: 18,
    justifyContent: "center",
    borderWidth: 1,
  },
  pillOn: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  pillOff: { backgroundColor: colors.glass, borderColor: colors.glassBorder },
  pillYellow: { backgroundColor: colors.glowYellow, borderColor: colors.glowYellow },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.glassDarkBorder,
    padding: 20,
    gap: space.s,
    overflow: "hidden",
  },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 12,
    paddingBottom: 34,
    gap: space.m,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.35)",
    marginBottom: space.xs,
  },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: "rgba(255,62,165,0.6)",
    overflow: "hidden",
  },
  errorText: { flex: 1, color: colors.textPrimary },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: "hidden",
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
