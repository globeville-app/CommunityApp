/** Picking photos from the library (profile and organization photos, report screenshots). */
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export type PickedPhoto = { uri: string; mimeType: string };

// The server's limit (5 MB); checked here too so nobody waits for a refusal.
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// Profile photos show at most ~120 points wide; 1080 pixels is plenty for a
// sharp photo on any phone, and keeps uploads small and quick.
const PROFILE_PHOTO_SIDE = 1080;
// Screenshots are read by the team in the admin; this keeps text legible.
const SCREENSHOT_WIDTH = 1280;

/**
 * A fresh JPEG, at most `maxWidth` wide, written to the app's cache. Phones
 * hand back very different files (huge iPhone photos, HEIC, PNG); the upload
 * then always sends a small, ordinary JPEG.
 */
export async function shrinkToJpeg(uri: string, width: number, maxWidth: number): Promise<PickedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  if (width > maxWidth) context.resize({ width: maxWidth });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: saved.uri, mimeType: "image/jpeg" };
}

/**
 * The picked photo, shrunk. If shrinking fails, the original is used when
 * it's within the server's limit, so a member is never stuck.
 */
async function shrunkOrOriginal(asset: ImagePicker.ImagePickerAsset, maxWidth: number): Promise<PickedPhoto | "too_large"> {
  try {
    return await shrinkToJpeg(asset.uri, asset.width, maxWidth);
  } catch {
    if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) return "too_large";
    return { uri: asset.uri, mimeType: asset.mimeType === "image/png" ? "image/png" : "image/jpeg" };
  }
}

/** A square photo, "too_large", or null if the member cancelled. */
export async function pickSquarePhoto(): Promise<PickedPhoto | "too_large" | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    // The picker converts iPhone HEIC photos to JPEG when it compresses.
    quality: 0.8,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    // Don't give EXIF to the app. (This does NOT clean the file itself;
    // the backend strips EXIF/GPS from every photo it receives.)
    exif: false,
  });
  if (result.canceled || !result.assets?.length) return null;
  return shrunkOrOriginal(result.assets[0], PROFILE_PHOTO_SIDE);
}

/** A screenshot for a problem report, "too_large", or null if the member cancelled. */
export async function pickScreenshot(): Promise<PickedPhoto | "too_large" | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    exif: false, // the server strips EXIF anyway
  });
  if (result.canceled || !result.assets?.length) return null;
  return shrunkOrOriginal(result.assets[0], SCREENSHOT_WIDTH);
}
