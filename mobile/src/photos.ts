/** Picking a square photo from the library (profile and organization photos). */
import * as ImagePicker from "expo-image-picker";

export type PickedPhoto = { uri: string; mimeType: string };

// The server's limit (5 MB); checked here too so nobody waits for a refusal.
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** A photo, "too_large", or null if the member cancelled. */
export async function pickSquarePhoto(): Promise<PickedPhoto | "too_large" | null> {
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
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) return "too_large";
  return { uri: asset.uri, mimeType: asset.mimeType === "image/png" ? "image/png" : "image/jpeg" };
}
