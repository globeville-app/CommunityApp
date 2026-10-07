import { useCallback, useEffect, useState } from "react";
import { Image, View } from "react-native";

import { ApiError, getMyProfile, logout, Profile as ProfileData } from "../api";
import { useAuth } from "../auth";
import { neighborhoodLabel } from "../format";
import { resetTo } from "../navigation";
import { Body, Button, ErrorMessage, Loading, Screen, Tag, Title, colors, styles } from "../ui";

export default function Profile() {
  const { token, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      setProfile(await getMyProfile(token));
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "profile_not_found") resetTo("/address");
      else setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onLogOut() {
    if (token) {
      // If the server can't be reached we still log out on this phone.
      await logout(token).catch(() => undefined);
    }
    await signOut();
    resetTo("/welcome");
  }

  if (error) {
    return (
      <Screen>
        <ErrorMessage message={error} />
        <Button title="Try again" onPress={load} />
      </Screen>
    );
  }
  if (!profile) return <Loading />;

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 12, paddingTop: 24 }}>
        {profile.photo_url ? (
          <Image
            source={{ uri: profile.photo_url }}
            style={{ width: 120, height: 120, borderRadius: 60 }}
            accessibilityLabel="Profile photo"
          />
        ) : (
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: colors.accentLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Title>{profile.first_name.slice(0, 1).toUpperCase()}</Title>
          </View>
        )}
        <Title>{profile.display_name}</Title>
        <Body muted>{neighborhoodLabel(profile)}</Body>
      </View>

      {profile.interests.length > 0 ? (
        <>
          <Body>Interests</Body>
          <View style={styles.row}>
            {profile.interests.map((item) => (
              <Tag key={item} label={item} />
            ))}
          </View>
        </>
      ) : null}

      <View style={[styles.flex, { justifyContent: "flex-end" }]}>
        <Button title="Log out" variant="secondary" onPress={onLogOut} />
      </View>
    </Screen>
  );
}
