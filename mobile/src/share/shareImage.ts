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

export async function shareCardImage(card: RefObject<View | null>, message: string) {
  const uri = await captureRef(card, { format: "png", width: 1080, height: 1080, result: "tmpfile" });
  if (Platform.OS === "ios") {
    await Share.share({ url: uri, message });
  } else {
    await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: message });
  }
}
