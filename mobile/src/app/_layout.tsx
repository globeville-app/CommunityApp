import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { AuthProvider } from "../auth";
import { DemoBanner } from "../components/DemoBanner";
import { colors } from "../ui";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1 }}>
        <DemoBanner />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerTintColor: colors.text,
            headerTitle: "",
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
        </Stack>
      </View>
    </AuthProvider>
  );
}
