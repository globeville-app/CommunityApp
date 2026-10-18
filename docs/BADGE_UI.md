# Globeville: Badge and share card visuals

**This doc is the visual spec for Milestone 3.** It describes exactly how badges and share cards are drawn. No mock files or images are needed. Read it with `BADGES.md` (the rules) and `MILESTONE_3.md` (the build).

**Approved by the owner on Oct 18, 2026.** Placement can be fine-tuned during the build, but don't change colors, icons or wording without asking.

## 1. Colors

| Token | Hex | Use |
|---|---|---|
| `teal` | `#2EE6D6` | Ring arc for Seed through Tree, and the pip outline |
| `purple` | `#8B5CF6` | Halo, prism gradient |
| `pink` | `#FF3EA5` | Prism gradient |
| `yellow` | `#FFF3A3` | Emblem accent, pip icon, keepsake stamp |
| `midnight` | `#1A0F3D` | Emblem fill (outer), pip fill, keepsake fill |
| `deep` | `#4A1D96` | Emblem fill (inner highlight) |
| `prism` | linear gradient, top-left to bottom-right: teal 0% → purple 35% → pink 70% → yellow 100% | Ring at Grove, the Share button |

## 2. The `<Badge>` component

**Props:**
- `badgeKey`
- `kind`: `growth` or `keepsake`
- `stage`: 0 means not earned, 1–5 means Seed–Grove
- `size`: in points
- `earned`

**Drawing approach:** draw with `react-native-svg` on a **200 × 200 viewBox** and scale it to `size`. All numbers below use that viewBox.

### Size tiers (decided)

| Tier | Size | Where it's used | Ring | Stage pip |
|---|---|---|---|---|
| **Large** | 120 pt and up | Badge detail, unlock moment, share card, See all badges | Standard | **Standard pip** |
| **Profile** | 64–119 pt | Profile Badges row, My Impact progress list | Thick | **Bigger pip** |
| **List** | under 64 pt | Collect cards ("grows Clean Sweeper"), any small inline badge | Thick | **No pip.** The ring alone shows the stage. |

### Growth badge layers (bottom to top)

1. **Halo:** a circle at (100,100) with r 96. Radial gradient from `purple` at opacity `0.15 + 0.08 × (stage − 1)` to transparent.
2. **Ring track:** a circle at (100,100), no fill, white at 12% opacity.
   - Standard: r 72, stroke 7.
   - Thick: r 70, stroke 9.
3. **Ring arc:** the same circle, stroked `teal` for stages 1–4 and `prism` at stage 5, with round line caps.
   - **Length:** `stage / 5` of the circumference, drawn with `strokeDasharray`.
   - **Direction:** starts at the bottom and fills clockwise (rotate 90° around the center).
   - **Glow:** see the glow section below.
4. **Emblem disc:** a circle at (100,100) with a stroke of white at 35% opacity, width 2.
   - Radius: r 50, or r 54 on the Profile and List tiers.
   - Fill: a radial gradient centered at (35%, 30%) with radius 80%, from `deep` to `midnight`.
5. **Emblem icon:** see the next section. On the Profile and List tiers, scale it with the disc (× 1.08).
6. **Stage pip** (Large and Profile only):

   | Pip | Center | Circle | Icon |
   |---|---|---|---|
   | Standard | (100,172) | r 15, fill `midnight`, stroke = ring color, width 2.5 | 20 units wide, stroke 2.4 (in Lucide units), `yellow` |
   | Bigger | (100,170) | r 21, fill `midnight`, stroke = ring color, width 3.2 | 29 units wide, stroke 2.3, `yellow` |

**Glow:** the arc and the emblem icon get a soft glow. The blur grows by stage: 0.8, 1.4, 2.2, 3.0, 4.0.
- Use an SVG Gaussian blur if `react-native-svg` supports it on both platforms.
- Otherwise, draw a second copy underneath: stroke width + 4, at 30% opacity.

### Stage pip icons (Lucide, decided)

| Stage | English | Spanish | Lucide icon |
|---|---|---|---|
| 1 | Seed | Semilla | `bean` |
| 2 | Sprout | Brote | `sprout` |
| 3 | Bloom | Flor | `flower` |
| 4 | Tree | Árbol | `tree-pine` |
| 5 | Grove | Arboleda | `trees` |

Draw pip icons as outlines (no fill) with round line caps and joins.

### Emblem icons

Each emblem is a Lucide icon (`lucide-react-native` **1.47.0 or later**) placed in a 64.8-unit box centered on the disc: `translate(67.6 67.6) scale(2.7)`.
- **Style:** white outlines, `strokeWidth 1.7` in Lucide's 24-unit grid, round line caps and joins.
- **Accent:** one accent per badge in `yellow`, as listed below.
- **Accent part numbers:** the numbers are the order of the drawing parts inside each Lucide icon in version 1.47.0, starting at 0. If a part moves in a later version, match by eye to the description.

| Badge | Icon | Yellow accent |
|---|---|---|
| `local` | `house` | Part 0, the door, as a yellow outline |
| `best_guest` | `blend` | None |
| `host` | **Custom paper lantern** (below) | The lantern body |
| `day_one` | `heart` | Part 0 filled yellow |
| `fiestero` | `party-popper` | None |
| `treasure_hunter` | `store` | None |
| `aficionado` | `sparkles` | Part 0, the big sparkle, filled yellow |
| `recreationist` | `zap` | Part 0 filled yellow |
| `helping_hand` | `hand-helping` | Plus a coin: a circle at (15.6, 3.4) with r 2.8, filled yellow, no stroke (in Lucide units) |
| `clean_sweeper` | `broom-sparkles` | The sparkles (parts 0, 1, 4, 5, 6, 8) as yellow outlines |
| `civic_voice` | `megaphone` | Part 1 as a yellow outline |
| `ambassador` | `languages` | Parts 3–5, the second script, as a yellow outline |
| `open_door` | `door-open` | Part 0 as a yellow outline |
| `familiar_face` | `smile` | Parts 2–3, the eyes, as a yellow outline |
| `year_rounder` | `sun-snow` | Parts 0–1, the sun, as a yellow outline |

**Custom paper lantern** (Host), in 200-unit coordinates. White strokes are width 4.5 with round caps and joins:

| Part | Drawing |
|---|---|
| Hanging string | Line from (100,70) to (100,78), white |
| Top and bottom caps | Lines from (90,78) to (110,78), and from (90,124) to (110,124), white |
| Tassel | Line from (100,124) to (100,132), white |
| Body | Ellipse centered at (100,101), rx 24, ry 22, filled `yellow` at 85% |
| Ribs | Path `M100 79 C88 86 88 116 100 123 M100 79 C112 86 112 116 100 123`, stroke `midnight` width 2.5 at 50% opacity, no fill |

### Keepsakes

Keepsakes have no ring and no pip. They show a stamp edge instead:

- **Stamp:** a 48-point star polygon centered at (100,100), alternating outer radius 84 and inner radius 76. Fill `midnight`, stroke `yellow` width 2.5.
  - On the Profile and List tiers, use radii 90 and 82 with stroke 4.
- **Inner dashed ring** (Large only): a circle with r 66, no fill, stroke `yellow` at 50% opacity, width 1.5, dashes 2 and 4.
- **Emblem:** the same emblem disc and icon as growth badges. The disc is r 50 on Large and r 56 on smaller tiers.

### Unearned badges (See all badges)

- **Growth:** the emblem disc and icon only, at **35% opacity**. No halo, ring or pip.
- **Keepsakes:** the same, inside the stamp outline drawn with no fill and `yellow` at 25% opacity.
- **Description:** show it under the badge, per `BADGES.md`.

### Screen reader labels

| Badge type | English | Spanish |
|---|---|---|
| Growth | "{Badge}, {Stage} stage, {count} {units}." For example, "Clean Sweeper, Bloom stage, 5 cleanups." | "{Insignia}, etapa {Etapa}, {count} {unidades}." For example, "Escobita, etapa Flor, 5 limpiezas." |
| Keepsake | "{Badge}, earned." | "{Insignia}, obtenida." |
| Unearned | "{Badge}, not earned yet. {Description}" | "{Insignia}, aún no obtenida. {Descripción}" |

## 3. Share card (approved)

**Format:** the app renders a **1080 × 1080 px PNG** with `react-native-view-shot`.

**Units:** the numbers below are in design units on a **360 × 360** card. Multiply them by 3 for the 1080 px image, and by `size / 360` for the on-screen preview.

### Card layout

**Corners:** 22, on screen only. The exported PNG has square corners.

**Background:** fill `#160B33`, with these soft radial glows layered on top:
- teal at 35%, centered at (15%, 10%), size 60% × 45%
- pink at 30%, centered at (90%, 25%), size 55% × 45%
- purple at 55%, centered at (50%, 100%), size 70% × 55%
- yellow at 18%, centered at (80%, 90%), size 40% × 30%

Each glow fades to transparent at 70% of its size. Add a 1-unit inner border in white at 10%.

**Padding:** 20 top and bottom, 22 left and right.

**Content, from top to bottom, all centered except the wordmark:**

| # | Element | Style |
|---|---|---|
| 1 | The `globeville` wordmark, top left | White, Outfit 600, 18, letter-spacing −0.035em (per `BRAND.md`) |
| 2 | The badge | `<Badge>` at 150, **Large tier with the standard pip**, at the member's current stage; 4 below the wordmark |
| 3 | Headline line 1 | "{First name} earned" / "{Nombre} ganó". Outfit 500, 14, `yellow` |
| 4 | Headline line 2 | The badge name. Outfit 600, 27, white, letter-spacing −0.01em |
| 5 | Stage label (growth badges only) | A pill with the stage name ("Bloom" / "Flor"). Outfit 500, 12, color `#8FF3EA`, background teal at 16%, border teal at 55%, padding 3 × 11, fully rounded, 7 above |
| 6 | Count line | Outfit 400, 15, color `#D9D0F5`, 6 above |
| 7 | Call to action, pinned 16 from the bottom | "Join your neighbors on **globeville.app**" / "Únete a tus vecinos en **globeville.app**". Outfit, 11.5, white at 90%, with the URL in weight 600 |

**Count line wording:**
- **Neighborhood switch on:** "{count} {units} in {Neighborhood}", for example "5 cleanups in Globeville" / "5 limpiezas en Globeville".
- **Switch off:** "{count} {units}" with no neighborhood.
- **Keepsakes:** no stage pill and no count. Show the badge's one-line description instead.

**Wording rule:** sharing always says **"earned / ganó"**, never growth words like "grew." The stage only appears as the small pill.

**Never on the card:**
- last name or photo
- address
- event names, dates or places
- other members

### Message sent with the image

Pass this as the share text, along with the image:

| Neighborhood switch | English | Spanish |
|---|---|---|
| On | "I earned the {Badge} badge on globeville 🎉 Join our neighborhood: {invite_url}" | "Gané la insignia {Insignia} en globeville 🎉 Únete a nuestro barrio: {invite_url}" |
| Off | "I earned the {Badge} badge on globeville 🎉 Join your neighbors: {invite_url}" | "Gané la insignia {Insignia} en globeville 🎉 Únete a tus vecinos: {invite_url}" |

`invite_url` is `https://globeville.app`, read from `shared/app_config.json`.

### Share preview screen (in the app)

The screen sits on the app background (`DESIGN.md` glow on midnight). From top to bottom:

1. **Title:** "Share your badge" / "Comparte tu insignia". Outfit 600, 20.
2. **Card preview:** the share card at the screen width minus 40 pt.
3. **Toggle row:** "Show my neighborhood" / "Mostrar mi barrio", **on by default**.
   - Styled as a glass card: white at 6%, border white at 10%, radius 14.
   - The switch is teal when on.
   - Changing it re-renders the preview.
4. **Share / Compartir:** a full-width pill, 50 pt tall, with a `prism` gradient (left to right) and white Outfit 600 text at 16. It opens the share sheet with the image and the message text, then calls `/api/badges/{key}/shared`.
5. **Not now / Ahora no:** a text button, color `#D9D0F5`.
6. **Privacy note:** 11 pt, color `#8C82B5`.
   - English: "Only your first name is shown. Never your last name, photo, address or event details."
   - Spanish: "Solo se muestra tu nombre. Nunca tu apellido, foto, dirección ni detalles del evento."

**Instagram:** apps can't attach a link to an Instagram story, so the URL on the card is how story viewers find the app. Don't build anything Instagram-specific.

**Later, not in Milestone 3:** the `globeville.app` link preview line (currently a placeholder, "globeville: your neighborhood, together") lives on the landing page and will be revised by the owner.

## 4. Count wording

These unit words are used on badge detail ("5 cleanups"), progress bars, screen reader labels, share cards and Grove milestones. Put them in `en.json` / `es.json` under `badges.<key>.unit` with singular and plural forms, using i18next plurals. The Spanish is a draft for the reviewer.

| Badge | English (1 / many) | Spanish (1 / many) |
|---|---|---|
| `local` | event / events | evento / eventos |
| `best_guest` | host / hosts | anfitrión / anfitriones |
| `host` | neighbor brought together / neighbors brought together | vecino reunido / vecinos reunidos |
| `day_one` | first event / first events | primer evento / primeros eventos |
| `fiestero` | celebration / celebrations | celebración / celebraciones |
| `treasure_hunter` | market or swap / markets and swaps | mercado o intercambio / mercados e intercambios |
| `aficionado` | night out / nights out | salida / salidas |
| `recreationist` | active event / active events | evento activo / eventos activos |
| `helping_hand` | time pitching in / times pitching in | vez echando la mano / veces echando la mano |
| `clean_sweeper` | cleanup / cleanups | limpieza / limpiezas |
| `civic_voice` | meeting / meetings | junta / juntas |

Keepsakes have no count.
