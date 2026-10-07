/**
 * The app's starting point. It never shows anything for long; it decides
 * where the person should be:
 *
 *   not logged in             → Welcome
 *   logged in, no profile yet → Address (they re-enter it; it's never saved)
 *   logged in, has profile    → Profile
 */
import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { ApiError, getMyProfile } from "../api";
import { useAuth } from "../auth";
import { Body, Button, ErrorMessage, Loading, Screen, Title } from "../ui";

type Destination = "/welcome" | "/address" | "/profile";

export default function Start() {
  const { token, isLoading, signOut } = useAuth();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = useCallback(async () => {
    setError(null);
    if (!token) {
      setDestination("/welcome");
      return;
    }
    try {
      await getMyProfile(token);
      setDestination("/profile");
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "profile_not_found") {
        setDestination("/address");
      } else if (err.status === 401) {
        await signOut(); // token no longer valid
        setDestination("/welcome");
      } else {
        setError(err.message);
      }
    }
  }, [token, signOut]);

  useEffect(() => {
    if (!isLoading) decide();
  }, [isLoading, decide]);

  if (destination) return <Redirect href={destination} />;
  if (error) {
    return (
      <Screen>
        <Title>Hmm.</Title>
        <ErrorMessage message={error} />
        <Body muted>Make sure the backend is running and your phone is on the same Wi-Fi.</Body>
        <Button title="Try again" onPress={decide} />
      </Screen>
    );
  }
  return <Loading />;
}
