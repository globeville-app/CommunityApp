import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, View } from "react-native";

import { Outfit_300Light } from "@expo-google-fonts/outfit/300Light";
import { Outfit_400Regular } from "@expo-google-fonts/outfit/400Regular";
import { Outfit_500Medium } from "@expo-google-fonts/outfit/500Medium";
import { Outfit_600SemiBold } from "@expo-google-fonts/outfit/600SemiBold";

import { AuthProvider } from "../auth";
import { DemoBanner } from "../components/DemoBanner";
import { GlowBackground } from "../components/GlowBackground";
import { LanguageProvider, useLanguage } from "../language";
import { colors } from "../theme";

// Keep the native splash (the gb mark) up until the fonts and the language
// are ready.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Navigation paints its own background behind screens by default; make it
// see-through so the glow shows.
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "transparent",
    card: "transparent",
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  return (
    <ThemeProvider value={theme}>
      <AuthProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.base }}>
          {/* One shared glow behind every screen; screens are see-through. */}
          <GlowBackground />
          <LanguageProvider>{fontsLoaded ? <AppShell /> : null}</LanguageProvider>
        </View>
      </AuthProvider>
    </ThemeProvider>
  );
}

/** Everything that shows once fonts and language are ready. */
function AppShell() {
  const { language } = useLanguage();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  // Tell browsers and screen readers which language the text is in.
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") document.documentElement.lang = language;
  }, [language]);

  return (
    <View style={{ flex: 1 }} accessibilityLanguage={language}>
      <DemoBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </View>
  );
}
