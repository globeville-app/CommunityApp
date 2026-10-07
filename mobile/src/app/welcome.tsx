import { router } from "expo-router";
import { View } from "react-native";

import { APP_NAME } from "../config";
import { Body, Button, Screen, Title, styles } from "../ui";

export default function Welcome() {
  return (
    <Screen>
      <View style={[styles.flex, { justifyContent: "center", gap: 12 }]}>
        <Title>{APP_NAME}</Title>
        <Body muted>Meet your neighbors in Denver.</Body>
      </View>
      <Button title="Sign up" onPress={() => router.push("/signup")} />
      <Button title="Log in" variant="secondary" onPress={() => router.push("/login")} />
    </Screen>
  );
}
