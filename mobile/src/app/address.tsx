/**
 * Join: address → neighborhood, on one screen (design: "Join").
 * The top has "Where's home?" and the address field; once a match comes
 * back, a bottom sheet slides up with the neighborhood, its local names, and
 * "Join …" / "Edit address".
 *
 * PRIVACY: the address lives only in this screen's state while typing. It is
 * sent once to the backend and the field is cleared as soon as a match comes
 * back. It is never saved on the phone or passed to another screen; only the
 * neighborhood name travels on.
 */
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";

import { ApiError, MatchResult, matchAddress } from "../api";
import { useAuth } from "../auth";
import { DemoAddressHints } from "../components/DemoAddressHints";
import { errorMessage } from "../i18n/errors";
import {
  Button,
  Caption,
  Choice,
  ErrorMessage,
  Field,
  Hero,
  Intro,
  JoinHeader,
  Screen,
  Sheet,
  Title,
  TroubleLink,
  styles,
} from "../ui";

// Errors where trying the same address again might work.
const RETRYABLE = new Set(["network", "timeout", "geocoder_unavailable", "server_error", "throttled"]);

export default function Address() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  // "" means the official name; otherwise one of the aliases (e.g. "LoHi").
  const [alias, setAlias] = useState("");

  async function onSubmit() {
    if (!token || !address.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await matchAddress(token, address.trim());
      setAddress(""); // forget it right away
      setAlias("");
      setMatch(result);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  function onJoin() {
    if (!match) return;
    router.push({ pathname: "/profile-setup", params: { alias, neighborhood: match.name } });
  }

  const chosenName = match ? alias || match.name : "";

  const sheet = match ? (
    <Animated.View entering={SlideInDown.duration(350)}>
      <Sheet>
        <Caption onGlass>{t("join.youre_in")}</Caption>
        {/* Neighborhood names and their local names are never translated. */}
        <Hero fit>{match.name}</Hero>
        {match.aliases.length > 0 ? (
          <>
            <Caption onGlass>{t("join.which_name")}</Caption>
            <View style={styles.row}>
              {[match.name, ...match.aliases].map((option) => (
                <Choice
                  key={option}
                  label={option}
                  selected={chosenName === option}
                  onPress={() => setAlias(option === match.name ? "" : option)}
                />
              ))}
            </View>
          </>
        ) : null}
        <Button title={t("join.join_button", { name: chosenName })} onPress={onJoin} />
        <Button title={t("join.edit_address")} variant="secondary" onPress={() => setMatch(null)} />
        <Caption onGlass>{t("join.address_forgotten")}</Caption>
      </Sheet>
    </Animated.View>
  ) : null;

  return (
    <Screen footer={sheet}>
      <JoinHeader />
      <Title>{t("join.title")}</Title>
      <Intro>{t("join.intro")}</Intro>
      <Field
        label={t("join.address_label")}
        icon="location-outline"
        placeholder={t("join.address_placeholder")}
        value={address}
        onChangeText={setAddress}
        autoComplete="off"
        autoCorrect={false}
        textContentType="none"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      {match ? null : (
        <>
          <DemoAddressHints onPick={setAddress} />
          <ErrorMessage message={errorMessage(t, error)} />
          {error && RETRYABLE.has(error.code) ? (
            <Button title={t("common.try_again")} onPress={onSubmit} busy={busy} />
          ) : (
            <Button title={t("join.find_button")} onPress={onSubmit} busy={busy} disabled={!address.trim()} />
          )}
          {/* Passes only this screen's name, never the address typed above. */}
          <TroubleLink from="join/address" />
        </>
      )}
    </Screen>
  );
}
