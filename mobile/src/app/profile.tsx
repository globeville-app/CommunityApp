import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";

import { ApiError, getMyProfile, logout, Profile as ProfileData } from "../api";
import { useAuth } from "../auth";
import { neighborhoodLabel } from "../format";
import { resetTo } from "../navigation";
import { Avatar, Button, ErrorMessage, GlassCard, Loading, Screen, Section, Tag, Title, styles } from "../ui";

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

  // Stats, badges, the neighborhoods card and the tab bar from the design
  // arrive with the milestones that build those features.
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 14, paddingTop: 24 }}>
        <Avatar uri={profile.photo_url} initial={profile.first_name.slice(0, 1).toUpperCase()} size={128} />
        <Title>{profile.display_name}</Title>
        <Tag tone="yellow" label={neighborhoodLabel(profile)} />
      </View>

      {profile.interests.length > 0 ? (
        <GlassCard>
          <Section>Interests</Section>
          <View style={styles.row}>
            {profile.interests.map((item) => (
              <Tag key={item} label={item} />
            ))}
          </View>
        </GlassCard>
      ) : null}

      <View style={[styles.flex, { justifyContent: "flex-end" }]}>
        <Button title="Log out" variant="secondary" onPress={onLogOut} />
      </View>
    </Screen>
  );
}
