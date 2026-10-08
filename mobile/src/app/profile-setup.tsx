import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ApiError, getConfig, saveProfile, uploadPhoto } from "../api";
import { useAuth } from "../auth";
import { resetTo } from "../navigation";
import { colors, type } from "../theme";
import { Avatar, BackButton, Button, Choice, ErrorMessage, Field, GlassCard, Screen, Section, Title, styles } from "../ui";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type PickedPhoto = { uri: string; mimeType: string };

export default function ProfileSetup() {
  const { token } = useAuth();
  const { alias = "", neighborhood = "" } = useLocalSearchParams<{ alias?: string; neighborhood?: string }>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [interestOptions, setInterestOptions] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True once the profile is saved but the photo upload failed.
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    // Interests are optional, so if this fails we just show none.
    getConfig()
      .then((config) => setInterestOptions(config.interests))
      .catch(() => setInterestOptions([]));
  }, []);

  function toggleInterest(item: string) {
    setInterests((current) =>
      current.includes(item) ? current.filter((i) => i !== item) : [...current, item],
    );
  }

  async function pickPhoto() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      // Compressing makes both iPhone and Android hand back a JPEG, so
      // iPhone HEIC photos are converted before upload. 0.6 keeps a phone
      // photo to roughly 1 MB, which uploads quickly over home Wi-Fi.
      quality: 0.6,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      // Don't give EXIF to the app. (This does NOT clean the file itself;
      // the backend strips EXIF/GPS from every photo it receives.)
      exif: false,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
      setError("Photos must be 5 MB or smaller.");
      return;
    }
    setPhoto({ uri: asset.uri, mimeType: asset.mimeType === "image/png" ? "image/png" : "image/jpeg" });
  }

  async function onSave() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setPhotoFailed(false);
    try {
      await saveProfile(token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        alias,
        interests,
      });
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "match_required") {
        resetTo("/address");
        return;
      }
      setError(err.message);
      setBusy(false);
      return;
    }

    if (photo) {
      try {
        await uploadPhoto(token, photo);
      } catch (e) {
        // The profile itself is saved; only the photo is missing.
        setError(`Your profile is saved, but the photo didn't upload. ${(e as ApiError).message}`);
        setPhotoFailed(true);
        setBusy(false);
        return;
      }
    }
    resetTo("/profile");
  }

  const joining = alias || neighborhood;

  return (
    <Screen>
      <BackButton />
      <Title>Set up your profile</Title>

      <View style={local.avatarWrap}>
        <Avatar uri={photo?.uri} initial={firstName.trim().slice(0, 1).toUpperCase() || undefined} />
        {photo ? <Text style={local.hidden} accessibilityLabel="Selected photo" /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo ? "Change photo" : "Add a photo"}
          onPress={pickPhoto}
          style={({ pressed }) => [local.addPhoto, pressed && styles.pressed]}
        >
          <Ionicons name="camera" size={20} color={colors.base} />
        </Pressable>
      </View>

      <Field label="First name" icon="person-outline" value={firstName} onChangeText={setFirstName} textContentType="givenName" />
      <Field label="Last name" icon="person-outline" value={lastName} onChangeText={setLastName} textContentType="familyName" />

      {joining ? (
        <GlassCard style={local.joiningCard}>
          <Ionicons name="home" size={18} color={colors.glowTurquoise} />
          <Text style={[type.label, { color: colors.glowTurquoise, flex: 1 }]}>Joining {joining}</Text>
        </GlassCard>
      ) : null}
      <Text style={[type.caption, { color: colors.textSoft }]}>
        Neighbors see your first name and last initial only.
      </Text>

      {interestOptions.length > 0 ? (
        <>
          <Section>Interests</Section>
          <View style={styles.row}>
            {interestOptions.map((item) => (
              <Choice
                key={item}
                label={item}
                selected={interests.includes(item)}
                onPress={() => toggleInterest(item)}
              />
            ))}
          </View>
        </>
      ) : null}

      <ErrorMessage message={error} />
      <Button
        title={photoFailed ? "Try the photo again" : "Finish"}
        onPress={onSave}
        busy={busy}
        disabled={!firstName.trim() || !lastName.trim()}
      />
      {photoFailed ? (
        <Button title="Continue without photo" variant="secondary" onPress={() => resetTo("/profile")} />
      ) : null}
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
