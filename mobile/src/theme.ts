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
  // Only for destructive actions (Delete account). Checked for contrast on
  // the dark glass and the base purple.
  danger: "#FF6B7A",
};

/**
 * One accent per event category group (group tiles; chips at low opacity).
 * DESIGN.md has four accent colors; lavender and peach are lighter tints in
 * the same family for the fifth and sixth groups.
 */
export const groupAccent: Record<string, string> = {
  celebrate: "#FF3EA5", // glowPink
  buy_swap: "#FFF3A3", // glowYellow
  entertainment: "#8B5CF6", // glowPurple
  get_active: "#2EE6D6", // glowTurquoise
  community: "#FFB38A", // peach
  learn_connect: "#C4B5FD", // lavender
};
export const OTHER_ACCENT = "#D9D0F5";

/** A color at low opacity, e.g. for category chips: alpha("#FF3EA5", 0.22). */
export function alpha(hex: string, opacity: number) {
  const value = parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${opacity})`;
}

/** The dark purple gradient under the glow (design/BRAND.md), about 110°. */
export const baseGradient = {
  colors: ["#1A0F3D", "#1C1240", "#2E1747"] as const,
  locations: [0, 0.6, 1] as const,
  start: { x: 0, y: 0.32 },
  end: { x: 1, y: 0.68 },
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

// Sizes in points. Titles are SemiBold with -0.02em letter spacing
// (design/BRAND.md); React Native wants points, so -0.02 × font size.
export const type = {
  hero: { fontFamily: fonts.semibold, fontSize: 58, lineHeight: 60, letterSpacing: -0.02 * 58 },
  title: { fontFamily: fonts.semibold, fontSize: 42, lineHeight: 46, letterSpacing: -0.02 * 42 },
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
