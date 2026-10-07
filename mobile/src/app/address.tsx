/**
 * Address → neighborhood.
 *
 * PRIVACY: the address lives only in this screen's state while typing. It is
 * sent once to the backend and the field is cleared as soon as a match comes
 * back. It is never saved on the phone or passed to another screen.
 */
import { router } from "expo-router";
import { useState } from "react";

import { ApiError, matchAddress } from "../api";
import { useAuth } from "../auth";
import { Body, Button, ErrorMessage, Field, Screen, Title } from "../ui";

// Errors where trying the same address again might work.
const RETRYABLE = new Set(["network", "geocoder_unavailable", "server_error", "throttled"]);

export default function Address() {
  const { token } = useAuth();
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onSubmit() {
    if (!token || !address.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const match = await matchAddress(token, address.trim());
      setAddress(""); // forget it right away
      router.push({
        pathname: "/match",
        params: { name: match.name, aliases: JSON.stringify(match.aliases) },
      });
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Where do you live?</Title>
      <Body muted>
        We use your address once to find your neighborhood, then forget it. It's never saved or shown to
        anyone.
      </Body>
      <Field
        label="Street address"
        placeholder="1234 Main St, Denver, CO"
        value={address}
        onChangeText={setAddress}
        autoComplete="off"
        autoCorrect={false}
        textContentType="none"
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      <ErrorMessage message={error?.message ?? null} />
      {error && RETRYABLE.has(error.code) ? (
        <Button title="Try again" onPress={onSubmit} busy={busy} />
      ) : (
        <Button title="Find my neighborhood" onPress={onSubmit} busy={busy} disabled={!address.trim()} />
      )}
    </Screen>
  );
}
