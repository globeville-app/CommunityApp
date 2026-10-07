/**
 * "Your neighborhood: Highland." If locals call it something else (LoHi),
 * the person picks the name they use.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Body, Button, Choice, Screen, Title, styles } from "../ui";

export default function Match() {
  const params = useLocalSearchParams<{ name: string; aliases: string }>();
  const name = params.name ?? "";
  const aliases: string[] = params.aliases ? JSON.parse(params.aliases) : [];
  // "" means the official name.
  const [alias, setAlias] = useState("");
  const chosenName = alias || name;

  return (
    <Screen>
      <Body muted>Your neighborhood</Body>
      <Title>{name}</Title>
      {aliases.length > 0 ? (
        <>
          <Body>Which name do you use?</Body>
          <View style={styles.row}>
            {[name, ...aliases].map((option) => (
              <Choice
                key={option}
                label={option}
                selected={chosenName === option}
                onPress={() => setAlias(option === name ? "" : option)}
              />
            ))}
          </View>
        </>
      ) : null}
      <View style={[styles.flex, { justifyContent: "flex-end", gap: 12 }]}>
        <Button
          title={`Join ${chosenName}`}
          onPress={() => router.push({ pathname: "/profile-setup", params: { alias } })}
        />
        <Button title="Edit address" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
