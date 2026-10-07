import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";

import { ApiError, getConfig, saveProfile, uploadPhoto } from "../api";
import { useAuth } from "../auth";
import { resetTo } from "../navigation";
import { Body, Button, Choice, ErrorMessage, Field, Screen, Title, styles } from "../ui";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type PickedPhoto = { uri: string; mimeType: string };

export default function ProfileSetup() {
  const { token } = useAuth();
  const { alias = "" } = useLocalSearchParams<{ alias?: string }>();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [interestOptions, setInterestOptions] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // iPhone HEIC photos are converted before upload.
      quality: 0.8,
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
    try {
      await saveProfile(token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        alias,
        interests,
      });
      if (photo) await uploadPhoto(token, photo);
      resetTo("/profile");
    } catch (e) {
      const err = e as ApiError;
      if (err.code === "match_required") {
        resetTo("/address");
        return;
      }
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Set up your profile</Title>
      <Field label="First name" value={firstName} onChangeText={setFirstName} textContentType="givenName" />
      <Field label="Last name" value={lastName} onChangeText={setLastName} textContentType="familyName" />
      <Body muted>Neighbors see your first name and last initial only.</Body>

      <Body>Photo (optional)</Body>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={{ width: 72, height: 72, borderRadius: 36 }}
            accessibilityLabel="Selected photo"
          />
        ) : null}
        <View style={styles.flex}>
          <Button title={photo ? "Change photo" : "Add a photo"} variant="secondary" onPress={pickPhoto} />
        </View>
      </View>

      {interestOptions.length > 0 ? (
        <>
          <Body>Interests (optional)</Body>
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
      <Button title="Save profile" onPress={onSave} busy={busy} disabled={!firstName.trim() || !lastName.trim()} />
    </Screen>
  );
}
