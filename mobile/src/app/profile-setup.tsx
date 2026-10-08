import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
// Only the one icon set; the package root would pull in every icon font.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ApiError, getConfig, saveProfile, uploadPhoto } from "../api";
import { useAuth } from "../auth";
import { errorMessage } from "../i18n/errors";
import { useLanguage } from "../language";
import { resetTo } from "../navigation";
import { colors, type } from "../theme";
import { Avatar, Button, Choice, ErrorMessage, Field, GlassCard, JoinHeader, Screen, Section, Title, styles } from "../ui";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type PickedPhoto = { uri: string; mimeType: string };

export default function ProfileSetup() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { token } = useAuth();
  const { alias = "", neighborhood = "" } = useLocalSearchParams<{ alias?: string; neighborhood?: string }>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [interestOptions, setInterestOptions] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Errors are kept as codes so they re-translate if the language changes.
  const [error, setError] = useState<ApiError | null>(null);
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
      setError(new ApiError("photo_too_large"));
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
    resetTo("/profile");
  }

  const joining = alias || neighborhood;

  return (
    <Screen>
      <JoinHeader back />
      <Title>{t("setup.title")}</Title>

      <View style={local.avatarWrap}>
        <Avatar uri={photo?.uri} initial={firstName.trim().slice(0, 1).toUpperCase() || undefined} />
        {photo ? <Text style={local.hidden} accessibilityLabel={t("setup.selected_photo")} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo ? t("setup.change_photo") : t("setup.add_photo")}
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
            {t("setup.joining", { name: joining })}
          </Text>
        </GlassCard>
      ) : null}
      <Text style={[type.caption, { color: colors.textSoft }]}>{t("setup.privacy_note")}</Text>

      {interestOptions.length > 0 ? (
        <>
          <Section>{t("setup.interests_title")}</Section>
          <View style={styles.row}>
            {interestOptions.map((item) => (
              <Choice
                key={item}
                label={t(`interests.${item}`, { defaultValue: item })}
                selected={interests.includes(item)}
                onPress={() => toggleInterest(item)}
              />
            ))}
          </View>
        </>
      ) : null}

      <ErrorMessage
        message={photoFailed ? t("setup.photo_failed", { reason: errorMessage(t, error) }) : errorMessage(t, error)}
      />
      <Button
        title={photoFailed ? t("setup.retry_photo_button") : t("setup.finish_button")}
        onPress={onSave}
        busy={busy}
        disabled={!firstName.trim() || !lastName.trim()}
      />
      {photoFailed ? (
        <Button title={t("setup.skip_photo_button")} variant="secondary" onPress={() => resetTo("/profile")} />
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
