/**
 * The design tokens (design/DESIGN.md). Change colors, type and
 * spacing here, in one place.
 */

export const colors = {
  base: "#1A0F3D", // midnight purple background; also text on light buttons
  glowTurquoise: "#2EE6D6",
  glowPurple: "#8B5CF6",
  glowDeep: "#4A1D96",
  glowPink: "#FF3EA5",
  glowYellow: "#FFF3A3",
  textPrimary: "#FFFFFF",
  textSecondary: "#D9D0F5", // only on glassDark or base, never straight on the glow
  textSoft: "#EDE7FF",
  glass: "rgba(255,255,255,0.14)",
  glassBorder: "rgba(255,255,255,0.28)",
  glassDark: "rgba(22,12,52,0.66)",
  glassDarkSolid: "rgba(22,12,52,0.85)", // fallback where blur isn't available
  glassDarkBorder: "rgba(255,255,255,0.15)",
  secondaryBorder: "rgba(255,255,255,0.5)",
};

/**
 * How dark the base overlay over the glow is. The design doc suggests 30%;
 * 45% is what keeps soft-white body text at 4.5:1 where the brightest glows
 * overlap (checked with the WCAG contrast formula, see the design PR).
 */
export const GLOW_DIM = 0.45;

export const fonts = {
  light: "Outfit_300Light",
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
};

// Sizes in points, with letter spacing from the design doc's percentages.
export const type = {
  hero: { fontFamily: fonts.medium, fontSize: 58, lineHeight: 60, letterSpacing: -2.6 },
  title: { fontFamily: fonts.medium, fontSize: 42, lineHeight: 46, letterSpacing: -1.5 },
  section: { fontFamily: fonts.medium, fontSize: 20, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  intro: { fontFamily: fonts.light, fontSize: 17, lineHeight: 25 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: fonts.semibold, fontSize: 17 },
  label: { fontFamily: fonts.medium, fontSize: 14 },
} as const;

export const space = { xs: 8, s: 12, m: 16, l: 24 };
export const SCREEN_PADDING = 24;

export const radius = {
  card: 26,
  sheet: 40,
  date: 18,
};

export const MIN_TOUCH = 44;
export const BUTTON_HEIGHT = 58;
