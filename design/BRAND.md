# Globeville Brand: Logo and Wordmark (v1)

This file tells you how to implement the Globeville logo in the Expo app. It works alongside `DESIGN.md`: colors and type come from there, and this file adds the logo rules. The final assets are in `assets/brand/`. Use those files. Do not redraw the logo or re-typeset the icon.

## The two marks

| Mark | What it is | Where it goes |
|---|---|---|
| **Wordmark** | "globeville", all lowercase, Outfit SemiBold (600), white | Splash screen, join/welcome screen, web/marketing, anywhere the full name is shown as a logo |
| **gb icon** | Lowercase "gb" in Outfit SemiBold, white, on the midnight glow square | App icon, favicon, avatar for official accounts, small spaces |

Rules:
- The name is always lowercase in the logo: **globeville**. In sentences, write "Globeville". Never write "GlobeVille" or "GLOBEVILLE".
- The wordmark uses the normal letterforms, so the g hangs below the line. Do not raise or resize the g in the wordmark (we tried it and it reads like a 9).
- The gb icon is the one exception. Its g is enlarged by about 3.7% and raised, so its top and bottom line up with the top and bottom of the b. This is already built into the icon files. Do not rebuild it from live text.
- The logo is white on dark. On light backgrounds, use `globeville-wordmark-midnight.svg` (#1A0F3D).
- No gradients, outlines, shadows, glows or animation on the letters themselves. The glow belongs to the background.

## Wordmark specs

- Font: Outfit, weight 600 (`Outfit_600SemiBold` from `@expo-google-fonts/outfit`)
- Case: lowercase
- Letter spacing: −0.035em. React Native wants pixels, so use `letterSpacing: -0.035 * fontSize`. At 48px that is −1.68.
- Line height: 1.0 × font size
- Color: #FFFFFF on dark; #1A0F3D on light
- Clear space: keep empty space around the wordmark equal to the height of the "b" (about 0.72 × font size) on every side
- Minimum size: 18px font size, or 90px wide. Below that, use the gb icon instead.

**Background behind the hero wordmark.** The splash and welcome screens use the dark purple gradient from the approved mock:
`linear-gradient(110deg, #1A0F3D 0%, #1C1240 60%, #2E1747 100%)`.
In React Native, use `expo-linear-gradient` with colors `['#1A0F3D', '#1C1240', '#2E1747']`, locations `[0, 0.6, 1]`, start `{x: 0, y: 0.32}` and end `{x: 1, y: 0.68}`, which is about 110°.

## gb icon specs

- Canvas: 1024 × 1024
- Background: #1A0F3D, plus three soft radial glows:
  - purple #8B5CF6 at 70% opacity, centered (120, 140), radius 640
  - pink #FF3EA5 at 55% opacity, centered (980, 980), radius 560
  - turquoise #2EE6D6 at 40% opacity, centered (960, 60), radius 420
  - Each glow fades to 0% at its edge.
- Letters: white "gb" from the Outfit 600 outlines. The art box is 1168.3 × 733 and is placed at `translate(200 318) scale(0.537)`, which centers it at about 61% of the icon width.
- The g is scaled 733/707 so it spans the same height as the b, from the b's top to the bottom of its bowl.
- The rounded corners (radius 230 at 1024) appear only in previews and on the web. The iOS and Android app icons must be full-bleed squares, because the operating system applies its own mask.

## Files in `assets/brand/`

| File | Use |
|---|---|
| `icon.png` | 1024×1024, no transparency. Expo `icon` (iOS and default) |
| `adaptive-icon.png` | Android adaptive foreground: gb on transparent, scaled to 0.45 so it sits inside the 66% safe zone |
| `adaptive-icon-background.png` | Android adaptive background: the glow square without letters |
| `splash-icon.png` | gb mark on transparent, for the native splash screen |
| `favicon.png` | 48×48 rounded icon for web |
| `globeville-icon.svg` / `globeville-icon-rounded.svg` | Vector masters (square and rounded preview) |
| `gb-monogram-white.svg` | gb letters only, transparent, viewBox 1168.3 × 733 |
| `globeville-wordmark-white.svg` / `-midnight.svg` | Wordmark as vector outlines, viewBox `26 -723 3966 937` |

The SVGs are vector outlines traced from Outfit 600, so they render the same everywhere, even before fonts load.

## Implementation steps

1. Copy the folder into the app at `assets/brand/`.
2. **app.json / app.config.ts:**
   ```json
   {
     "expo": {
       "name": "Globeville",
       "icon": "./assets/brand/icon.png",
       "userInterfaceStyle": "dark",
       "android": {
         "adaptiveIcon": {
           "foregroundImage": "./assets/brand/adaptive-icon.png",
           "backgroundImage": "./assets/brand/adaptive-icon-background.png",
           "backgroundColor": "#1A0F3D"
         }
       },
       "web": { "favicon": "./assets/brand/favicon.png" },
       "plugins": [
         ["expo-splash-screen", {
           "image": "./assets/brand/splash-icon.png",
           "imageWidth": 160,
           "resizeMode": "contain",
           "backgroundColor": "#1A0F3D"
         }]
       ]
     }
   }
   ```
   The display name still comes from `shared/app_config.json`. If the config is `app.config.ts`, read the name from that file rather than hard-coding it.
3. **Add a `<Wordmark />` component** (`components/brand/Wordmark.tsx`):
   - Default: render `globeville-wordmark-white.svg` with `react-native-svg` and `react-native-svg-transformer`. Props: `height` (default 40), `color` (`'white' | 'midnight'`). Set the width from the viewBox ratio, 3966 / 937 ≈ 4.233 × height.
   - Use `accessibilityRole="image"` and `accessibilityLabel={appName}`, with the name from `shared/app_config.json`.
   - Do not use live `<Text>` for the logo. Live text shifts before the font loads, and that is not acceptable for the logo.
4. **Add a `<GbMark />` component** for small in-app uses, such as a header badge. It renders `gb-monogram-white.svg` at a given height.
5. **Where each mark appears:**
   - Splash: native splash with `splash-icon.png`, then fade into the Join screen.
   - Join/welcome screen: `<Wordmark height={44} />` centered above the address field, on the gradient background above.
   - Signed-in screens: no wordmark in the header. Neighborhood names are the titles there. If the tab bar or settings needs a brand touch, use `<GbMark height={20} />`.
6. **Screen titles (not the logo):**
   - Outfit 600, letter spacing −0.02em, white.
   - Sizes come from `DESIGN.md`.
   - Titles keep normal capitalization, for example "Highland" or "Your profile". Only the logo is all lowercase.

## Acceptance checks

- [ ] The iOS home-screen icon shows gb on the glow square, with no white or black corners showing.
- [ ] The Android adaptive icon stays readable under circle, squircle and teardrop masks. The letters are not clipped.
- [ ] The splash and Join screens show the same wordmark with no font-swap flicker.
- [ ] The wordmark keeps its proportions at heights 24, 44 and 80.
- [ ] VoiceOver and TalkBack read the logo as "Globeville".
- [ ] The app name appears in code only in `shared/app_config.json`. The logo art comes from the files above.
