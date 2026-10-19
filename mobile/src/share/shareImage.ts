/**
 * Turn the share card into a 1080 × 1080 PNG and open the phone's own
 * share sheet with it and the message. The app never posts anywhere itself.
 *
 * iPhone gets the image and the text together. Android's share sheet
 * (expo-sharing) takes the image only, so there the link on the card is
 * what invites people.
 */
import * as Sharing from "expo-sharing";
import type { RefObject } from "react";
import { Platform, Share, View } from "react-native";
import { captureRef } from "react-native-view-shot";

/** False when the member closed the share sheet without sharing (iPhone only can tell). */
export async function shareCardImage(card: RefObject<View | null>, message: string): Promise<boolean> {
  const uri = await captureRef(card, { format: "png", width: 1080, height: 1080, result: "tmpfile" });
  if (Platform.OS === "ios") {
    const result = await Share.share({ url: uri, message });
    return result.action !== Share.dismissedAction;
  }
  await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: message });
  return true;
}
