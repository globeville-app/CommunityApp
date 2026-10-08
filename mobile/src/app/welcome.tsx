import { router } from "expo-router";
import { View } from "react-native";

import { Wordmark } from "../components/brand/Wordmark";
import { Button, Intro, Screen, styles } from "../ui";

export default function Welcome() {
  return (
    <Screen>
      {/* Logo centered, with clear space around it (design/BRAND.md). */}
      <View style={[styles.flex, { justifyContent: "center", alignItems: "center", gap: 32 }]}>
        <Wordmark height={44} />
        <Intro>Meet your neighbors in Denver.</Intro>
      </View>
      <Button title="Sign up" onPress={() => router.push("/signup")} />
      <Button title="Log in" variant="secondary" onPress={() => router.push("/login")} />
    </Screen>
  );
}
