/**
 * The bottom tab bar: Events and Profile (more tabs come later). Floating
 * dark glass, per DESIGN.md: active tab in yellow, inactive in soft grey.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { colors } from "../../theme";

export default function TabLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.glowYellow,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: "Outfit_500Medium", fontSize: 11 },
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 20,
          marginHorizontal: 16,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
          borderRadius: 32,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.glassDarkBorder,
          backgroundColor: colors.glassDarkSolid,
        },
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tabs.Screen
        name="events"
        options={{
          title: t("tabs.events"),
          tabBarAccessibilityLabel: t("tabs.events"),
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarAccessibilityLabel: t("tabs.profile"),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
