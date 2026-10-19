import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
// Only the one icon set; the package root would pull in every icon font.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ApiError, getMyProfile, saveProfile, uploadPhoto } from "../api";
import { neighborhoodLabel } from "../format";
import { PickedPhoto, pickSquarePhoto } from "../photos";
import { useAuth } from "../auth";
import { errorMessage } from "../i18n/errors";
import { useLanguage } from "../language";
import { resetTo } from "../navigation";
import { colors, type } from "../theme";
import {
  Avatar,
  BackButton,
  Button,
  ErrorMessage,
  Field,
  GlassCard,
  JoinHeader,
  ListRow,
  Loading,
  Screen,
  Title,
  TroubleLink,
  styles,
} from "../ui";



export default function ProfileSetup() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ alias?: string; neighborhood?: string; edit?: string }>();
  // Edit mode (from Settings): the same form, filled in from the saved
  // profile. The neighborhood is shown but can't be changed here.
  const editing = params.edit === "1";
  const [alias, setAlias] = useState(params.alias ?? "");
  const [neighborhood, setNeighborhood] = useState(params.neighborhood ?? "");
  const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editing);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  // Errors are kept as codes so they re-translate if the language changes.
  const [error, setError] = useState<ApiError | null>(null);
  // True once the profile is saved but the photo upload failed.
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    if (!editing || !token) return;
    getMyProfile(token)
      .then((profile) => {
        setFirstName(profile.first_name);
        // Only the initial of the last name is ever stored.
        setLastName(profile.last_initial);
        setAlias(profile.alias ?? "");
        setNeighborhood(neighborhoodLabel(profile));
        setSavedPhotoUrl(profile.photo_url);
      })
      .catch((e) => setError(e as ApiError))
      .finally(() => setLoaded(true));
  }, [editing, token]);


  async function pickPhoto() {
    setError(null);
    const picked = await pickSquarePhoto();
    if (picked === "too_large") setError(new ApiError("photo_too_large"));
    else if (picked) setPhoto(picked);
  }

  async function onSave() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setPhotoFailed(false);
    try {
      // Interests are chosen on their own screen (interests.tsx) and kept as
      // they are here. Read them fresh: they may have changed there since
      // this form opened, and the save replaces the whole profile.
      const interests = editing ? (await getMyProfile(token)).interests : [];
      await saveProfile(token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        alias,
        interests,
        language,
      });
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "match_required") {
        resetTo("/address");
        return;
      }
      setError(err);
      setBusy(false);
      return;
    }

    if (photo) {
      try {
        await uploadPhoto(token, photo);
      } catch (e) {
        // The profile itself is saved; only the photo is missing.
        setError(e as ApiError);
        setPhotoFailed(true);
        setBusy(false);
        return;
      }
    }
    done();
  }

  /** Joining continues to "What are you into?"; editing returns to the profile. */
  function done() {
    if (editing) resetTo("/profile");
    else resetTo({ pathname: "/interests", params: { onboarding: "1" } });
  }

  const joining = alias || neighborhood;

  if (!loaded) return <Loading />;

  return (
    <Screen>
      {editing ? <BackButton /> : <JoinHeader back />}
      <Title>{editing ? t("setup.edit_title") : t("setup.title")}</Title>

      <View style={local.avatarWrap}>
        <Avatar uri={photo?.uri ?? savedPhotoUrl} initial={firstName.trim().slice(0, 1).toUpperCase() || undefined} />
        {photo ? <Text style={local.hidden} accessibilityLabel={t("setup.selected_photo")} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo || savedPhotoUrl ? t("setup.change_photo") : t("setup.add_photo")}
          onPress={pickPhoto}
          style={({ pressed }) => [local.addPhoto, pressed && styles.pressed]}
        >
          <Ionicons name="camera" size={20} color={colors.base} />
        </Pressable>
      </View>

      <Field
        label={t("setup.first_name_label")}
        icon="person-outline"
        value={firstName}
        onChangeText={setFirstName}
        textContentType="givenName"
      />
      <Field
        label={t("setup.last_name_label")}
        icon="person-outline"
        value={lastName}
        onChangeText={setLastName}
        textContentType="familyName"
      />

      {joining ? (
        <GlassCard style={local.joiningCard}>
          <Ionicons name="home" size={18} color={colors.glowTurquoise} />
          <Text style={[type.label, { color: colors.glowTurquoise, flex: 1 }]}>
            {editing ? t("setup.your_neighborhood", { name: neighborhood }) : t("setup.joining", { name: joining })}
          </Text>
        </GlassCard>
      ) : null}
      <Text style={[type.caption, { color: colors.textSoft }]}>{t("setup.privacy_note")}</Text>

      {editing ? (
        <GlassCard style={{ gap: 0, paddingVertical: 6 }}>
          <ListRow label={t("profile.edit_interests")} chevron onPress={() => router.push("/interests")} />
        </GlassCard>
      ) : null}

      <ErrorMessage
        message={photoFailed ? t("setup.photo_failed", { reason: errorMessage(t, error) }) : errorMessage(t, error)}
      />
      <Button
        title={
          photoFailed ? t("setup.retry_photo_button") : editing ? t("setup.save_button") : t("setup.finish_button")
        }
        onPress={onSave}
        busy={busy}
        disabled={!firstName.trim() || !lastName.trim()}
      />
      {photoFailed ? (
        <Button title={t("setup.skip_photo_button")} variant="secondary" onPress={done} />
      ) : null}
      {editing ? null : <TroubleLink from="join/profile-setup" />}
    </Screen>
  );
}

const local = StyleSheet.create({
  avatarWrap: { alignSelf: "center", marginVertical: 8 },
  addPhoto: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glowYellow,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.glowYellow,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  joiningCard: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
