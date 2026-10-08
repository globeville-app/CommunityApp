# Globeville Design System (v1)

Hand this file to Claude Code with the milestone specs. It describes the look of every screen so the Expo app matches the approved mocks. Where a milestone spec and this file disagree on visuals, this file wins; on behavior and data, the milestone spec wins.

## The idea

Globeville feels like ambient lighting at a good party: slow, glowing color drifting behind frosted-glass surfaces. One signature move (the glow), everything else calm and readable.

## Color tokens

| Token | Hex | Use |
| --- | --- | --- |
| `base` | `#1A0F3D` | App background (midnight purple). Also text on light buttons. |
| `glowTurquoise` | `#2EE6D6` | Glow light, badges, highlight text (dates) |
| `glowPurple` | `#8B5CF6` | Glow light |
| `glowDeep` | `#4A1D96` | Glow light (deep purple) |
| `glowPink` | `#FF3EA5` | Glow light, badges, progress bars |
| `glowYellow` | `#FFF3A3` | Glow light, primary buttons, active tab, "Home" labels |
| `textPrimary` | `#FFFFFF` | Main text |
| `textSecondary` | `#D9D0F5` | Supporting text, labels |
| `textSoft` | `#EDE7FF` | Intro paragraphs on the glow |
| `glass` | `rgba(255,255,255,0.12–0.16)` + border `rgba(255,255,255,0.24–0.30)` | Inputs, light cards, avatars, chips |
| `glassDark` | `rgba(22,12,52,0.55–0.66)` + border `rgba(255,255,255,0.14–0.16)` | Sheets, list cards, tab bar |

Rules:
- Never put text directly on a bright glow. Text sits on the base, on `glassDark`, or on a solid button.
- Primary buttons are `glowYellow` with `base` text. Never white text on pink, yellow or turquoise.
- Badges and icons in glow colors use `base` for the icon stroke.

## Typography

- Family: **Outfit** (Google Fonts), weights 300, 400, 500, 600. Load with `expo-font` / `@expo-google-fonts/outfit`.
- Scale (pt): hero 54–66 / 500 / tracking −4 to −5% · screen title 40–46 / 500 / −3.5% · section 20 / 500 · body 15–17 / 400 · intro 17 / 300 · caption 13–14 / 400 · tab label 11 / 500.
- Sentence case everywhere. No all-caps labels.

## Shape and spacing

- Screen side padding 24. Gaps 8 / 12 / 16 / 24.
- Radii: pills and buttons fully rounded (height ÷ 2) · cards 24–28 · bottom sheets 40 (top corners only).
- Touch targets ≥ 44 pt. Primary button height 58.

## Components

- **Ambient glow background (signature).** Base fill plus 5 large circles (180–340 pt) in the five glow colors, blurred about 70 pt, opacity 0.4–0.9. Each drifts on its own loop (16, 19, 21, 24, 27 s, ease-in-out, alternating), moving 90–220 pt and scaling 0.85–1.3, so colors blend without visibly repeating. On content-heavy screens add a `base` overlay at 30% opacity for readability.
- **Glass input:** `glass` fill, 1 pt border, blur 20, fully rounded, icon left.
- **Bottom sheet:** `glassDark`, blur 30, top radius 40, top hairline border, grab handle 40×5.
- **Primary button:** `glowYellow`, `base` text 17/600, soft yellow glow shadow.
- **Secondary button:** transparent with a 1 pt white 50% border, white text.
- **Pills / chips:** selected = white fill + `base` text; unselected = `glass`.
- **Badge:** 64 pt circle in a glow color, `base` icon, matching soft glow shadow, label below 13/500.
- **Floating tab bar:** 64 pt tall, 16 pt from the sides, 20 pt above the bottom safe area, `glassDark` with blur 24, fully rounded. Inactive `textSecondary`, active `glowYellow`.
- **Date block:** 58×62, radius 18, `glowYellow` fill, month 13/500, day 24/600, `base` text.

## Screens (match the canvas mocks)

1. **Join:** glow full screen, "Where's home?" + glass address field at top; bottom sheet with "You're in", huge neighborhood name, alias pills, "Join Highland", "Edit address", privacy note.
2. **Profile setup:** glass avatar with yellow add-photo button, glass name field, turquoise "Joining Highland" row, interest pills, "Finish".
3. **Member profile:** glass avatar, name, yellow neighborhood pill, three big stats, glowing badges, `glassDark` neighborhoods card, floating tab bar.
4. **Neighborhood:** huge neighborhood name, avatar stack, `glassDark` "Known for" card, glass "Next up" event row with yellow date block, tab bar.
5. **Event:** glow visible at the top with glass back button and co-host chips; `glassDark` sheet with turquoise date, title, location, "RSVP on Partiful", pink progress bar, "Give", Venmo/Zelle glass pills, text-updates checkbox.
6. **Media board:** not yet restyled; follow these tokens when it's built.

## Building it in Expo

- **Glass:** `expo-blur` `BlurView` (dark tint) behind translucent fills. Android blur support varies; fall back to a solid `glassDark` (`rgba(22,12,52,0.85)`) where blur isn't available.
- **Glow:** draw the circles with `@shopify/react-native-skia` (Circle + Blur) and animate positions with `react-native-reanimated`. A cheaper alternative: pre-rendered blurred PNG blobs animated with Reanimated transforms.
- **Performance:** one shared glow component; pause the animation when the screen isn't focused or the app is backgrounded; cap at 5 glows.
- **Reduced motion:** if the device's reduce-motion setting is on (`useReducedMotion()` from Reanimated, or `AccessibilityInfo.isReduceMotionEnabled()`), render the glows still.
- **Contrast:** check every text color against its real background, including glass over the brightest glow position. Minimum 4.5:1 for body text.
- Put all tokens in one `theme.ts` so colors can change in one place later.

## Reference

The mocks live on a private claude.ai design canvas ("Globeville MVP Mocks"). Claude Code can't open that link, so export screenshots of each screen from the canvas and add them to `design/screens/` in the repo alongside this file.
