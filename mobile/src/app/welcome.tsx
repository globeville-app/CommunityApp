import { router } from "expo-router";
import { View } from "react-native";

import { APP_NAME } from "../config";
import { Button, Hero, Intro, Screen, styles } from "../ui";

export default function Welcome() {
  return (
    <Screen>
      <View style={[styles.flex, { justifyContent: "flex-end", gap: 12, paddingBottom: 24 }]}>
        <Hero>{APP_NAME}</Hero>
        <Intro>Meet your neighbors in Denver.</Intro>
      </View>
      <Button title="Sign up" onPress={() => router.push("/signup")} />
      <Button title="Log in" variant="secondary" onPress={() => router.push("/login")} />
    </Screen>
  );
}
