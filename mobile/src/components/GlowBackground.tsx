/**
 * The signature ambient glow: five soft blobs of color drifting behind the
 * whole app, each on its own slow loop so the colors blend without visibly
 * repeating. A dark overlay on top keeps text readable.
 *
 * Built the "cheaper" way the design doc describes: one pre-blurred white
 * blob image (assets/glow-blob.png), tinted per color and moved with
 * Reanimated. The animation runs on the UI thread, pauses while the app is
 * in the background, and stays still when the phone's Reduce Motion is on.
 */
import { useEffect, useState } from "react";
import { AppState, Image, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors, GLOW_DIM } from "../theme";

const blob = require("../../assets/glow-blob.png");

type Glow = {
  color: string;
  opacity: number;
  size: number; // diameter in points, before scaling
  // Start position as a fraction of the screen, and how far it drifts (points).
  x: number;
  y: number;
  dx: number;
  dy: number;
  scaleFrom: number;
  scaleTo: number;
  seconds: number;
};

// Opacities were chosen with a contrast check: with the overlay below, white
// and soft-white text stay at 4.5:1 or better even where three glows overlap.
const GLOWS: Glow[] = [
  { color: colors.glowDeep, opacity: 0.9, size: 340, x: 0.1, y: 0.15, dx: 160, dy: 120, scaleFrom: 0.9, scaleTo: 1.3, seconds: 16 },
  { color: colors.glowPurple, opacity: 0.75, size: 300, x: 0.75, y: 0.3, dx: -200, dy: 140, scaleFrom: 0.85, scaleTo: 1.2, seconds: 19 },
  { color: colors.glowPink, opacity: 0.6, size: 260, x: 0.2, y: 0.65, dx: 180, dy: -160, scaleFrom: 0.9, scaleTo: 1.25, seconds: 21 },
  { color: colors.glowTurquoise, opacity: 0.42, size: 220, x: 0.8, y: 0.75, dx: -150, dy: -220, scaleFrom: 0.85, scaleTo: 1.3, seconds: 24 },
  { color: colors.glowYellow, opacity: 0.38, size: 180, x: 0.5, y: 0.45, dx: 90, dy: 200, scaleFrom: 0.9, scaleTo: 1.2, seconds: 27 },
];

function GlowBlob({ glow, width, height, still }: { glow: Glow; width: number; height: number; still: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (still) {
      cancelAnimation(progress);
      progress.value = 0.5;
      return;
    }
    // Ease in and out, back and forth, forever.
    progress.value = withRepeat(
      withTiming(1, { duration: glow.seconds * 1000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [still, glow.seconds, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: glow.x * width - glow.size / 2 + glow.dx * progress.value },
      { translateY: glow.y * height - glow.size / 2 + glow.dy * progress.value },
      { scale: glow.scaleFrom + (glow.scaleTo - glow.scaleFrom) * progress.value },
    ],
  }));

  return (
    <Animated.View style={[styles.blob, { width: glow.size, height: glow.size, opacity: glow.opacity }, style]}>
      <Image source={blob} style={[styles.fill, { tintColor: glow.color }]} resizeMode="stretch" />
    </Animated.View>
  );
}

export function GlowBackground() {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(AppState.currentState === "active");
  const [size, setSize] = useState({ width: 390, height: 844 });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => subscription.remove();
  }, []);

  const still = reduceMotion || !active;

  return (
    <View
      pointerEvents="none"
      style={styles.container}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {GLOWS.map((glow) => (
        <GlowBlob key={glow.color} glow={glow} width={size.width} height={size.height} still={still} />
      ))}
      <View style={[styles.fill, styles.dim]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.base, overflow: "hidden" },
  blob: { position: "absolute", left: 0, top: 0 },
  fill: { width: "100%", height: "100%" },
  dim: { position: "absolute", left: 0, top: 0, backgroundColor: colors.base, opacity: GLOW_DIM },
});
