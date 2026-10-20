# Globeville Badge Catalog

These are the member badges every neighbor can earn. **This is the source of truth for badge rules.** `MILESTONE_3.md` says how to build them. Spanish names and descriptions are drafts for the neighborhood reviewer. Stage numbers are adjustable.

## Ground rules

- **No rankings.** No points, leaderboards or "top neighbor."
- **Growth, not tiers.** Growth badges move through five growth stages (see below). Keepsakes are earned once and never change. Nothing uses metal tiers.
- **Free to earn.** Nothing depends on spending or donating money.
- **Equal credit.** A small potluck counts the same as a big festival.
- **No tenure badges.** Badges for how long someone has lived somewhere favor homeowners over renters. "Member since" can appear as a plain fact instead.
- **Badges are permanent.** Members keep them when they move, and they appear in alumni history.
- **Members choose who sees their badges (decided Oct 18).** A setting, **Show my badges to: My neighborhood** (default) **/ Only me**, covers all badges at once. "All of Denver" waits for exploring other neighborhoods (`BACKLOG.md`). It never affects badge growth, My Impact or share cards, which the member sends on purpose.

## Growth stages (decided)

There are two kinds of badges.

**Growth badges** grow through five stages, shown with the emblem + growing ring design described below.

| Stage | English | Spanish (draft) | Meaning |
|---|---|---|---|
| 1 | Seed | Semilla | You started |
| 2 | Sprout | Brote | It's taking root |
| 3 | Bloom | Flor | It's flourishing |
| 4 | Tree | Árbol | It's part of who you are here |
| 5 | Grove | Arboleda | It grew beyond you, into others |

**Keepsakes / Recuerdos** are one-time badges with no stages, such as Ambassador or Familiar Face. They have a fixed stamp or pin look that is clearly different from growth badges.

### Rules
- **Plant names, glow art.** The stages are named for a plant's growth, and the art uses the `DESIGN.md` glow style on midnight purple. The glow builds with each stage. Grove is the only stage with the full prism glow (turquoise, purple, pink and yellow), which carries the "crystalline" top-stage feeling.

### How a growth badge looks (decided: emblem + growing ring)
Chosen for v1 because it is the simplest to build and reads clearly at every size. Exact drawing values are in `BADGE_UI.md`.
- **Emblem:** the badge's own symbol sits in the center and never changes between stages.
- **Ring:** a faint full ring circles the emblem, showing the whole path. A glowing arc fills one fifth of it per stage: 20% at Seed, 40% at Sprout, 60% at Bloom, 80% at Tree and a full circle at Grove. It starts at the bottom and fills clockwise. It is turquoise for Seed through Tree, and the prism gradient at Grove.
- **Stage pip:** a small circle at the bottom of the ring holds a Lucide plant icon for the current stage in light yellow: `bean`, `sprout`, `flower`, `tree-pine`, `trees`. This names the stage without any text.
- **Glow:** the glow strength increases slightly with each stage.
- **Size tiers (decided Oct 18):**
  - **Large:** badge detail, unlock moment, share card and See all. These use the standard pip.
  - **Profile:** a thicker ring and a bigger pip.
  - **List:** a thicker ring and no pip; the ring alone shows the stage.

  Exact values are in `BADGE_UI.md`.
- **The arc shows the stage, not progress within it.** Progress toward the next stage appears as a separate bar on the My Impact screen.
- **Build:** one reusable component that takes the emblem, the stage and a size. Fifteen emblems plus five pip icons cover every badge at every stage.
- **Never ranked.** Stages describe the member's own history. There are no totals, no leaderboards, and no sorting or comparing people by stage.
- **Lifetime counts.** Progress never expires, resets or goes backward, so slower participants still get there.
- **Adjustable numbers.** The thresholds for each stage live in one settings file. If they change, nobody loses a stage they already reached.
- **After Grove, the count keeps going.** For example "Grove · 112", with occasional share moments at round numbers.
- **Each stage-up is an unlock moment** and can be shared (see Unlock moment and sharing).
- **Hosting badges grow by impact, not event count.** They use the impact numbers from the My Impact dashboard (see Impact metric definitions).

## Stage thresholds (decided, adjustable)

**Shape:** early stages come quickly so new members see their profile grow and don't get impatient. Each later stage takes longer, so the higher stages keep their meaning. The target is about **2 years to Grove** for an active member, which is roughly 3 events a month and one event of a specific type every month or two.

| Track | Counts | Seed | Sprout | Bloom | Tree | Grove |
|---|---|---|---|---|---|---|
| **Everyday** | events attended | 1 | 3 | 9 | 24 | 60 |
| **Occasional** | events of one type, attended or hosted | 1 | 2 | 5 | 10 | 18 |
| **Variety** | different hosts, groups or categories | 2 | 4 | 8 | 15 | 30 |
| **Host reach** | neighbors brought together | 2 | 10 | 30 | 80 | 200 |

**Approximate time for an active member:**

| Stage | Time |
|---|---|
| Seed | the first time |
| Sprout | about 1 month |
| Bloom | about 3 months |
| Tree | about 8 months |
| Grove | about 2 years |

- The thresholds live in one settings file. If they change, nobody loses a stage they already reached.
- Host reach counts **neighbors brought together** (see Impact metric definitions).

**Open question: is 2 years right for Grove?** Many members are renters who move every few years, so a Grove might rarely be reached in one place. This is benched for the alumni feature (see below and `BACKLOG.md`).

### Neighborhood-aware progress (build now, use later)
Every counted attendance, hosting record and collected badge progress stores the **neighborhood it happened in**. Milestone 3 shows lifetime progress only. When the alumni feature arrives, progress can be split per neighborhood, for example "Clean Sweeper: Bloom in Globeville, Sprout in Highland," with no data lost. Adding the field now is cheap. Adding it later would mean old records can't be split.

## Step 1 rules (decided)

1. **Stages show with the badge.** Whoever can see a member's badges (see the badge visibility setting) sees each badge with its stage. There is no ranking, sorting or totals anywhere. Hiding single badges is still for later.
2. **No pre-launch collection.** The app isn't in production yet. Badges start counting from the v1 launch, so no back-collection of old "I'm going" taps is needed. Test data can be wiped.
3. **Cancelled or removed events never count.** This covers rainy days and anything else that gets called off. The team doesn't judge whether an event is "real." Members moderate themselves, as on any social network, and the existing Report action stays.
4. **One event can count toward several badges.** For example, a cleanup grows Clean Sweeper, Helping Hand and Local at the same time.
5. **Several unlocks combine into one celebration.** If one collection earns several badges or stages, the member sees a single moment, for example "You planted 4 badges 🌱." They can swipe through it, and each badge has its own Share option.
6. **Events with no end time end at midnight.** They end at the start of the next day, America/Denver time. For example, an event on 10/31 with no end time ends at 00:00 on 11/1. This sets both the auto check-in window and when the collect card appears.
7. **The category locks when the event ends.** If an organizer changes it afterward, badges already counted don't change.
8. **After Grove, celebrate at 2× and 3× the Grove number.** For example, an Everyday badge celebrates at 120 and 180 events. Adjust after launch if needed.

**Technical note for Milestone 3:** phones limit how many geofences one app can watch. iPhones allow 20. The app watches only the member's next 20 upcoming "I'm going" events, and swaps fences in as events pass.

## Open items (carried forward)

- **Grove timing for renters:** benched with alumni and per-neighborhood progress (`BACKLOG.md`).

## Impact metric definitions (decided)

These three numbers drive the Host badge and the host's My Impact screen. All three:
- count only **counted attendance** (auto check-in or collected)
- exclude the host's own attendance
- exclude cancelled events
- drop deleted members

| Metric | Definition | Used for |
|---|---|---|
| **Neighbors brought together** | Distinct members whose attendance counted at any event the host hosted. Each person counts once, however many of the host's events they attend. | The Host badge's stages (Host reach track), and My Impact |
| **First-timers welcomed** | Distinct members whose **first counted event in that neighborhood** was one this host hosted. | My Impact |
| **Came back** | Distinct members who attended one of this host's events and later had counted attendance at **any other event in the same neighborhood**, from any host. **No time limit.** | My Impact |

**Neighborhood, not the whole app.** "First-timer" and "came back" are scoped to the neighborhood where the event happened. In v1 everyone sees only their own neighborhood, so this matches "first event in the app." Once exploring and moving arrive, a visitor's first event in a new neighborhood correctly counts as a first-timer there.

**Build note:** each counted attendance already stores its neighborhood. Mark `is_first_in_neighborhood` when the attendance is recorded, so it never has to be worked out from history later.

## How attendance is recorded (decided)

Tapping "I'm going" alone never counts. Attendance is recorded in one of two ways. The member chooses which.

### 1. Auto check-in (opt-in)
- **The setting:** "Check me in automatically at events I'm going to / Regístrame automáticamente en los eventos a los que voy". It's offered once, the first time a member taps "I'm going." It can also be turned on or off later in Settings.
- **How it works:** for each event the member is going to, the app registers one geofence with the phone's operating system. The fence is about 150 m around the event's map pin, active only from 30 minutes before the start to the end of the event. This uses `expo-location` geofencing with `expo-task-manager`. If the phone enters the area during that window, the app records the attendance automatically and the badge collects itself.
- **What is and isn't tracked:**
  - The phone does the watching.
  - The server receives only "attended event X." No coordinates, location history or movement are ever sent or stored.
  - Each geofence is removed when its event ends, is cancelled, or the member taps "I'm going" off.
- **Permission:** this needs "Allow location: Always." The permission screen comes after a plain explanation in both languages of what is and isn't tracked. If the member declines, the setting stays off and they use click-to-collect.

### 2. Click-to-collect (everyone else)
- **No notifications and no questions.** After an event ends, a glowing **"Ready to collect / Listo para recoger"** card appears in the My Impact badge progress for each event the member tapped "I'm going" on. For example: "Alley Cleanup is ready to collect. 1 more to Sprout."
- **Tapping Collect** records the attendance and grows the badge, with an unlock moment if it reaches a new stage.
- **The window:** a card stays collectable for 7 days after the event, then disappears without counting.
- Members with auto check-in on still see click-to-collect for an event if the geofence didn't trigger, for example because their phone was off.

### What a counted attendance needs
- The event wasn't cancelled, and has ended (or is in progress, for auto check-in).
- The member had tapped "I'm going," and then either checked in automatically or collected within 7 days.
- The member isn't the event's host. Hosting counts separately.
- **Sensitive categories are excluded.** Attending a `resource_fair` or `donation_drive` never counts toward a badge, because attending can mean someone needed help. Hosting them does count. **Who attended them is never stored** (owner decision, Oct 2026): confirming attendance only adds 1 to the event's count and removes the member's "I'm going". So these events count toward the host's event-count badges (Helping Hand, for example) once 2 neighbors confirmed, but not toward Host Reach or the impact numbers, which need to know who came.

### Change needed in events
Events need a **map pin**, so auto check-in has coordinates to watch:
- When posting, the organizer drops or confirms a pin on a map. Keep the typed meeting-spot text as the display label.
- The pin is the event's location, not anyone's home. Milestone 1's rule about never storing home addresses is unaffected.
- Events posted before pins existed don't support auto check-in; their attendees use click-to-collect.

### Declining to collect (decided)
A member may have tapped "I'm going" but not gone. Both of these apply:
- **"I didn't make it / No pude ir"** on the collect card. Tapping it dismisses the card, records nothing toward badges, and removes the member from that event's "I'm going" count. It asks no confirmation and no reason.
- **Automatic expiry.** A card nobody acts on disappears 7 days after the event, without counting. The member stays in the going count.

Hosts never see who declined or how many people didn't show up.

## What counts as hosting

A hosted event counts when:
- the event wasn't cancelled and has ended, and
- at least 2 other neighbors confirmed they went.

---

## v1 badge catalog (decided)

There are 15 badges: 11 growth badges and 4 keepsakes. Learn & Connect events have no group badge in v1 (Brainiac is benched; see `BACKLOG.md`), but they still count toward badges that take any event. Spanish names are drafts for the neighborhood reviewer. Names were finalized before launch, so keys match the names. After launch, keys stay fixed even if labels change.

### Growth badges

Each grows through Seed → Sprout → Bloom → Tree → Grove, using the thresholds of its track.

| Key | Badge | Spanish (draft) | Track | What grows it |
|---|---|---|---|---|
| `local` | Local | Del Barrio | Everyday | Any event attended. Its Seed is the member's first event. |
| `best_guest` | Best Guest | Invitado de Lujo | Variety | Attending events from different hosts |
| `host` | Host | Anfitrión | Host reach | Neighbors brought together at events you hosted. Its Seed is the first hosted event that counts. |
| `day_one` | Day One | Día Uno | Occasional | Attending a neighbor's *first* hosted event that counts |
| `fiestero` | Fiestero | Fiestero | Occasional | Celebrate events |
| `treasure_hunter` | Treasure Hunter | Cazatesoros | Occasional | Buy, Sell & Swap events |
| `aficionado` | Aficionado | Aficionado | Occasional | Entertainment events, at any time of day |
| `recreationist` | Recreationist | Deportista | Occasional | Get Active events |
| `helping_hand` | Helping Hand | Mano Amiga | Occasional | Community & Giving events. Attending a `resource_fair` or `donation_drive` doesn't count; hosting one does. |
| `clean_sweeper` | Clean Sweeper | Escobita | Occasional | Cleanups, attended or hosted |
| `civic_voice` | Civic Voice | Voz Vecinal | Occasional | Community meetings, attended or hosted |

**Attended or hosted:**
- Group badges and signature badges count events the member attended *or* hosted.
- `local`, `best_guest` and `day_one` count attendance only.
- `host` counts hosting only.

**Spanish names are drafts.** "Escobita" (little broom) and "Del Barrio" especially need the reviewer's ear.

**Emblem choices (decided).** Lucide icon names, pinned to Lucide **1.47.0** or later. Brooms were added in recent versions.

| Badge | Emblem | Yellow accent |
|---|---|---|
| Local | Lucide `house` | door |
| Best Guest | Lucide `blend` | none |
| Host | **Custom paper lantern** (no Lucide match) | lantern body |
| Day One | Lucide `heart` | filled |
| Fiestero | Lucide `party-popper` | none |
| Treasure Hunter | Lucide `store` | none |
| Aficionado | Lucide `sparkles` | main sparkle filled |
| Recreationist | Lucide `zap` | filled |
| Helping Hand | Lucide `hand-helping` + our coin | coin |
| Clean Sweeper | Lucide `broom-sparkles` | sparkles |
| Civic Voice | Lucide `megaphone` | sound line |
| Ambassador (keepsake) | Lucide `languages` | the "A" |
| Open Door (keepsake) | Lucide `door-open` | doorway |
| Familiar Face (keepsake) | Lucide `smile` | eyes |
| Year-Rounder (keepsake) | Lucide `sun-snow` | sun |

Exact icon placement and accents are in `BADGE_UI.md`.

**Emblem source (decided):** emblems use the open-source **Lucide** icon set (lucide.dev, ISC license) wherever a fitting icon exists. They are drawn in our glow style: white 1.7-unit strokes at 24-unit scale, with one light-yellow (#FFF3A3) accent. Custom drawings are used only where Lucide has no match. Use the `lucide-react-native` package. The ISC license requires Lucide's copyright notice to ship with the app, so add it to the app's open-source licenses / credits screen.

### Keepsakes

Each is earned once and never grows.

| Key | Badge | Spanish (draft) | Earned by |
|---|---|---|---|
| `ambassador` | Ambassador | Embajador | Attending an event whose original language differs from the member's selected language |
| `open_door` | Open Door | Puerta Abierta | Hosting an event where the organizer wrote both an English and a Spanish version (a machine translation doesn't count) |
| `familiar_face` | Familiar Face | Cara Conocida | Attending at least one event in each of 3 calendar months in a row |
| `year_rounder` | Year-Rounder | Todo el Año | Attending in all four seasons, in any years. Seasons are Dec–Feb, Mar–May, Jun–Aug and Sep–Nov. |

### Community badges (calculated quietly, admin-only in Milestone 3)

A neighborhood is "known for" something based on the last 12 months. In Milestone 3, this is worked out each time the admin page loads, so no monthly job is needed. Community badges have no stages: a neighborhood either has one or doesn't. Tune the numbers with real data before they ever appear publicly.

| Kind | Example | Earned when, in the last 12 months |
|---|---|---|
| Group | "Known for celebrations" | At least 6 counted events in that group, with at least 20 different neighbors attending in total |
| Signature | "Known for cleanups", "Known for showing up" (community meetings) | At least 4 counted events of that type, with at least 15 different neighbors attending in total |

### Moved to later
- **Green Thumb and Swapper.** They overlap with the group badges.
- **Group Starter.**
- **Welcomer** (for welcoming first-timers). It needs the impact definitions first.
- **Growth versions of Ambassador and Open Door.**

### Unearned badges (decided)
On the "See all badges" screen, a badge the member hasn't earned yet shows:
- its emblem, dimmed, with no ring and no stage pip
- its one-line description underneath

Keepsakes not yet earned show the dimmed emblem inside a faint stamp outline.

### Badge descriptions (English approved; Spanish is a draft for the reviewer)
Each badge has a one-line description in both languages. It appears in the badge catalog, on unearned badges and in the unlock moment. 

| Badge | English | Spanish (draft) |
|---|---|---|
| Local | Show up to any neighborhood event. | Asiste a cualquier evento del barrio. |
| Best Guest | Go to events hosted by different neighbors. | Ve a eventos organizados por diferentes vecinos. |
| Host | Host events that bring neighbors together. | Organiza eventos que reúnan a tus vecinos. |
| Day One | Be there for a neighbor's first event. | Acompaña a un vecino en su primer evento. |
| Fiestero | Join block parties, festivals, cookouts and parades. | Únete a fiestas de cuadra, festivales, carnes asadas y desfiles. |
| Treasure Hunter | Shop, sell or swap at markets, pop-ups and yard sales. | Compra, vende o intercambia en mercados, pop-ups y ventas de garaje. |
| Aficionado | Catch music, comedy, movies, game nights and more. | Disfruta música, comedia, películas, noches de juegos y más. |
| Recreationist | Get active: pickup games, fitness, gardening and pet meetups. | Muévete: partidos, ejercicio, jardinería y paseos con mascotas. |
| Helping Hand | Pitch in at cleanups, volunteer days, drives and fundraisers. | Echa la mano en limpiezas, voluntariados, colectas y recaudaciones. |
| Clean Sweeper | Help clean up the neighborhood. | Ayuda a limpiar el barrio. |
| Civic Voice | Show up to community meetings. | Participa en las juntas vecinales. |
| Ambassador | Join an event posted in a language other than yours. | Asiste a un evento publicado en un idioma distinto al tuyo. |
| Open Door | Host an event in both English and Spanish. | Organiza un evento en inglés y en español. |
| Familiar Face | Come to an event three months in a row. | Asiste a un evento tres meses seguidos. |
| Year-Rounder | Show up in every season of the year. | Participa en todas las estaciones del año. |

**Rule:** descriptions and progress hints never mention resource fairs, and never invite people to *attend* donation drives, because attending those can mean someone needed help. Helping Hand's description names drives in the context of pitching in, which is fine.

## My Impact dashboard

A private screen that only the member sees, opened from their Profile. It has two sections.

### Badge progress (everyone)
- Each badge not yet earned shows a progress bar, for example "Clean Sweeper: 1 of 2 cleanups" or "Best Guest: 3 of 4 hosts".
- The badges closest to their next stage are listed first. Each growth badge shows its current stage and a bar toward the next one.
- Only badges with at least some progress are shown, so a new member sees a short list rather than 15 empty bars. A "See all badges" link opens the full catalog with how to earn each one.
- The bars count only attendance and hosting that count (see the rules above).
- **Hint text never suggests sensitive categories.** For example, Helping Hand's bar says "2 more to Bloom," never "1 more resource fair."

### Your impact as a host (appears after the first hosted event)
These are impact numbers, not volume. Examples:
- "Your events brought together **48 neighbors**." This counts distinct neighbors who confirmed attending.
- "**12** of them were at their first event in the neighborhood." This counts first-timers welcomed.
- "**31** came back to another neighborhood event." This counts neighbors who came back.
- "Your most popular: Alley Cleanup, Oct 12, with 14 neighbors."

The section has no level, no XP, no score, and no comparison with other hosts. The numbers are never shown to anyone else.

### Shared rules
- Nothing on this screen is visible to other members or ranked.
- Numbers count distinct people. Twenty events with the same 3 friends shows 3 neighbors, not 60.
- Deleted members drop out of the counts.

## Unlock moment and sharing

When a member earns a keepsake, a growth badge reaches a new stage, or a Grove badge passes a round number, the app celebrates it, similar to Duolingo's streak milestones.

**The moment**
- The badge animates in using the `DESIGN.md` glow style, with a short line in the member's language. For example, "You earned Clean Sweeper! Your cleanup made the neighborhood better."
- It appears the next time the member opens the app after the badge is awarded. It never interrupts them mid-task.
- If reduce-motion is on, a still version is shown instead.

**Sharing**
- The member gets two choices: **Share / Compartir** and **Not now / Ahora no**. Sharing is always their choice and is never automatic.
- **Share** creates an image card and opens the phone's own share sheet (Messages, WhatsApp, Instagram Stories and so on). The app never posts anywhere by itself.
- **The share card (square, story-friendly):**
  - the badge art and badge name
  - the headline "{first name} **earned** {badge}". Sharing never uses growth wording; the stage shows only as a small label.
  - a short line like "3 cleanups in Globeville", and the globeville wordmark
  - exact layout and strings: `BADGE_UI.md` §3
  - the card's text in the member's selected language
  - small text such as "Join your neighbors on globeville" with a link to the app. Every share invites someone new.
- **Privacy on the card:**
  - It never shows a last name, photo, address, event dates or event locations.
  - The neighborhood name appears by default, with a "Show my neighborhood" toggle on the share preview to remove it.
- Members can share any earned badge later from their profile or the My Impact screen, not only at the unlock moment.
- The app records only that a share happened and for which badge, for counting. It never records where it was shared or to whom.

## Organization badges (Milestone 4)

Organizations earn only the **hosting side** of the badges above. They use the same thresholds and design, with a section labeled "Organization badges."
- **Badges they can earn:** `host`, the five group badges, `clean_sweeper`, `civic_voice` and the `open_door` keepsake.
- **Badges they can't earn:** attendance badges (`local`, `best_guest`, `day_one`, `ambassador`, `familiar_face`, `year_rounder`), which belong to people.
- **Host credit:** an organization's event credits the organization, never the member who posted it, so nothing counts twice. The same 2-attendee rule applies.
- **Admins:** they don't get attendance credit at their own organization's events.
- **For attendees:** an organization counts as one host for Best Guest, and its first counted event counts for Day One.
- **No rankings:** organization badges are never ranked against people or other organizations.

Details are in `MILESTONE_4.md`.

## Considered and rejected

- **Founding Neighbor (first 100 members).** It rewards arriving early, not taking part, and makes later joiners feel second-class.
- **Points and levels.** They turn badges into a ranking.
- **Metal tiers (Basic, Bronze, Silver, Gold, Platinum).** Metals rank by value and status, and the terms are generic gaming language. Growth stages replace them.
- **Separate attendance-milestone badges (10, 25 or 50 events).** Growth stages already cover this.
- **Early Bird (first to tap "I'm going").** It rewards speed, which feels competitive.
- **Host XP bars and levels.** Visible levels rank hosts. XP per event rewards many low-effort events. Levels also favor people with more free time, space and money. The private My Impact dashboard replaces them.
- **Trust levels that unlock features.** The owner decided against this because it limits what members can do. Spam protection stays limited to simple rate limits, such as the existing 10-events-per-day cap.

## Later (needs features that don't exist yet)

- **Photographer:** shared photos from 3 events. Needs the media board.
- **Explorer:** attended events in 3 other neighborhoods. Needs cross-neighborhood exploring.
- **Alumni:** moved and kept their history. Needs "I'm moving."
- **Welcome Wagon:** attended a Welcome Neighbors event. Needs that category.
- **Plus One:** invited a neighbor who joined. Needs invites.
- **Co-host:** hosted with another neighbor. Needs co-hosting.
