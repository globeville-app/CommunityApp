/**
 * BROWSER DEMO ONLY. Phones make a PNG of the card and open the share sheet
 * (shareImage.ts). A browser shares just the message, where it can.
 */
import type { RefObject } from "react";
import type { View } from "react-native";

export async function shareCardImage(_card: RefObject<View | null>, message: string) {
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (data: { text: string }) => Promise<void> }) : null;
  if (nav?.share) await nav.share({ text: message }).catch(() => undefined);
}
