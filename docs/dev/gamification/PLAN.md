# Gamification plan: an evolving character for openGym

Status: **planning, nothing built yet.** Written 2026-10-20 from two research reports in this
folder. This file is the handoff: a new chat should read it first, then the open questions below.

- `research-01-gamification-and-mascots.md`: what works in Duolingo, Finch, Habitica, Pokémon,
  Zombies Run!, Apple rings and Strava; what the evidence says; safe rules for food; a reward economy; concepts.
- `research-02-animation-tech.md`: how to draw and animate the character in this codebase
  (SVG vs Rive vs Lottie, measured sizes), the derived-state module, celebrations, art sourcing, a phased plan.

---

## 1. Where we left off

| Item | State |
| --- | --- |
| Research: gamification, mascots, evidence, food safety | Done (`research-01`) |
| Research: animation tech, data model, art sourcing | Done (`research-02`) |
| Research: free asset sites and their licences | **Not done.** The agent was cut off by a usage limit; nothing saved. Redo (§9). |
| UI mockups of several concepts, rendered as iPhone screenshots | **Not done.** Next step after the owner answers §2. |
| Code | Nothing yet. Nutrition feature is shipped on `feature/nutrition`. |

## 2. Decisions for the owner (ask before building)

1. **Which character?** Concepts in §5. Owner's own idea is the Couch Potato → Super Potato.
   Research recommendation: build the engine first (it serves every concept), then the potato or the hatchling pet.
2. **Name.** "Super Potato" is also a well-known Japanese retro-games shop chain (trademark status
   unverified). Keep it as a private nickname, or call the final stage something like "Supreme Spud".
3. **Art route.** (a) Claude draws a simple geometric SVG potato, free and quick, good enough for v1.
   (b) Commission layered SVGs, about $400–1,500, 2–6 weeks. (c) Later, a Rive animation, plus $1,000–3,000.
   AI image generators: use them only for concept sketches. Raw AI art can't be copyrighted and can't be animated as-is.
4. **Nutrition XP on or off by default.** A body-neutral mode switch is planned either way (§3).
5. **Numbers.** Accept the starting economy in §4, or tune it.

## 3. Rules the design must keep (from the research)

- **Grow, never punish.** The character never dies, wilts, gets sick or cries. Mood bottoms out at
  "sleepy" or "waiting". Evolution never goes backwards. (Fish'n'Steps users avoided the app to avoid a sad fish; Finch is praised for never doing this.)
- **Weekly streaks, not daily.** Lifting needs rest days. Build on `streakWeeks` (`frontend/src/lib/history.js:882`).
  Freezes: earn 1 per 4 target weeks, hold up to 2. A "pause" covers illness and travel. A deload week counts.
  A broken streak shows "New chapter", never a failure screen.
- **Food rules:**
  - Reward logging, protein ≥ 90 % of target, and calories inside 90–110 %. **Never reward eating less.**
  - Going over: no red, no sad face, no XP loss; it just misses the range bonus.
  - Under 90 % earns nothing. If it keeps happening, one gentle line ("fuel matters for lifting").
  - No good/bad food labels. Cap nutrition XP per day.
- **Weight never touches the character.** Its look, mood and evolution come from behaviour only.
  The potato keeps its body shape and evolves through gear, posture, setting and skills, never by getting thinner.
- **Praise competence, don't pay wages.** Feedback like "heaviest squat yet" builds motivation;
  expected rewards for everything erode it. Occasional *surprise* cosmetic drops are fine.
- **Game power never changes the training.** No XP for volume beyond the plan, at most 2 sessions a day count,
  and a daily cap on PR XP (Ring Fit and Strava lessons).
- **Gentle reminders only.** At most one check-in after 3+ days, then silence. No Duolingo-style guilt messages.

## 4. Reward economy v1 (starting numbers)

XP is **derived from the log every time, never stored**, so editing or deleting a log changes XP and two devices never disagree.

| Source | XP | Rule |
| --- | --- | --- |
| Workout finished | 50 | ≥ 3 completed working sets; at most 2 sessions/day count |
| Cardio / calisthenics-only session | 30 | ≥ 15 min or a distance (decide how to detect: exercise type in the library) |
| PR (`workouts[].prs`) | 20 each | max 3 per session; the set must be ≥ 50 % of current e1RM |
| Food day logged | 10 | ≥ 2 entries that day |
| Protein hit | 15 | ≥ 90 % of `nutTargets.p` |
| Calories in range | 10 | 90–110 % of `nutTargets.kcal`; never for under |
| Nutrition cap | 35/day | |
| Weekly: training target met | 100 | planned sessions done |
| Weekly: food logged 5 of 7 days | 40 | |
| Weekly: protein 4 of 7 days | 40 | |

A good week comes to about 650 XP.
- **Level curve:** going from level n to n+1 costs `200 + 50·n` XP.
- **Evolution stages:** at levels 5, 12, 20 and 30, which is roughly weeks 2, 9, 20 and 42. The first change lands before the novelty dip at about 4 weeks, and the second around habit automaticity at about 9–13 weeks.
- **After the last stage:** levels past 30 unlock cosmetics, recolours and new story chapters; the stage itself doesn't change.

Honesty, kept light (it's a single-user app):
- Imported or backdated history (older than 7 days) counts for stats but not XP. Instead, a one-time "veteran" grant up to level 5.
- `mascot.since` sets where XP starts, so a CSV import can't max the character out on day one.
- Nutrition days are scored only from `nutTargets.at` onward. Old targets aren't stored, so changing the target must not re-score the past.

Badges (one-time, informational, never for weight lost):
- first PR per main lift; 10/50/100 sessions; first 5K/10K
- calisthenics skills (first pull-up, L-sit); 4/12/26 target weeks; 30 food-logged days

> research-02 sketched a different curve (triangular, 100 XP base, 6 stages). This plan uses research-01's
> numbers. Pin "a typical week reaches stage 2 in about 2 weeks" in a unit test and tune from there.

## 5. Concepts (for the mockups)

0. **Couch Potato → Super Potato** (owner's idea, refined). Stages:
   1. Couch Potato (sofa, remote)
   2. Sprout Spud (sneakers)
   3. Gym Tater (headband, chalk)
   4. Hash Brown Hero (cape, barbell)
   5. Super Potato (glow, mountain top)

   Same body shape throughout. Puns on wins, sincerity on hard days.
- **A. Hatchling companion.** An egg hatches into a small creature that trains with you. It learns a move named after each lift you PR, and goes on adventures on rest days, bringing back a story or a cosmetic. Most Duolingo/Finch-like.
- **B. Pixel RPG hero.** STR from lifting, END from runs, AGI from calisthenics skills, VIT from protein and logging. Each week is a dungeon whose boss falls when you meet the weekly target. "Pause damage" is built in.
- **C. Training garden.** Lifts grow oaks, runs grow wildflowers, calisthenics grows vines, food days enrich the soil. Missed weeks go dormant (winter), never dead. UbiFit Garden is the one concept with field-trial evidence.
- **D. Orbit.** Sessions are fuel, levels unlock planets, PRs discover moons. A ship's-log story, possibly voiced by the AI Coach. No body imagery at all.
- **E. No mascot.** Three weekly rings (Train / Move / Fuel), a level and badges. Cheapest to build, and every concept needs this engine anyway.

Mockup brief, still to do: for 4–5 of these, render iPhone-size screenshots in the app's real styling
(dark theme, the `card` / `lrow` classes from `frontend/src/index.css`). Screens per concept:
1. Home card: character, level, XP bar, this week's quests
2. Level-up or evolution moment
3. Progress page: stage roadmap and badges

All characters must be original SVG; nothing that resembles Duolingo's owl.

## 6. Technical design

**Approach: inline SVG character + CSS keyframes (idle loops) + Web Animations API (one-shot moments).**
- No new dependency, as CONTRIBUTING.md requires. About 15–25 KB gzipped for all stages and moods, and it lands in JS chunks the service worker already precaches.
- One shared face rig (`#eyes #brows #mouth`) across all stages, so 6 stages × 4 moods is not 24 drawings.
- Animate only `transform` and `opacity`. Pause when off-screen.
- Rive (what Duolingo uses) is an optional later phase only. It costs about 434 KB gzipped of JS + WASM, its WASM comes from a CDN by default, and its editor is proprietary.

Pieces, with the files involved:
- `frontend/src/lib/progress.js` + `progress.test.js`: a pure function `progress(S, today)` → `{ xp, level, stage, intoLevel, levelSpan, mood, badges, week: { target, done, quests } }`. Also `pendingCelebrations(p, seen)`.
  - Reads: `workouts` (`d`, `entries`, `prs`), `foodLog`, `nutTargets` (`.at`), `dayNotes` (a noted day off is rest, not neglect), and `streakWeeks`.
  - Reuses `dayTotals` / `addDays` / `daysBetween` from `lib/nutrition.js`.
  - Memoise on the arrays' identity.
- **Stored state, the only stored part:** `mascot: { on, name, skin, since, seen: { 'level:7': ts, 'stage:3': ts, 'badge:first-pr': ts }, paused? }` in `store/useStore.js` DEF.
  - `seen` must merge as a **grow-only key union**, and `since` as **earliest wins**.
  - Add both rules to `frontend/src/lib/sync-merge.js` **and** `api/sync-stamps.js`, with tests (`sync-stamps-parity.test.js`). The generic settings rule would drop flags, and celebrations would replay.
- `frontend/src/components/Mascot.jsx` + `mascot-art.jsx` (stage bodies, lazy chunk) + `mascot-faces.jsx`. Under `prefers-reduced-motion` it shows a static SVG.
- `frontend/src/lib/confetti.js`: a canvas one-shot of about 40 lines, ≤ 100 particles, DPR capped at 2. Skip it under reduced motion.
- **Celebrations:**
  - Computed after Finish workout and after saving food, both inside a tap, so sound can play via `lib/sound.js` `unlock()` / `chime()`.
  - Write `seen[key]` when the celebration opens.
  - One that arrives by sync shows a "Tap to celebrate" button instead of playing sound.
  - Add a level-up timbre in `rest-sounds.js`.
- **Haptics:** iPhone Safari has none. Use vibrate on Android; the iOS `<input switch>` trick is optional and unverified.
- **Reduced motion:** `index.css` already stops CSS animations. Web Animations and canvas need their own `matchMedia` check, through a shared `reducedMotion()` helper.

UI surfaces:
- **Home:** a character card above the Nutrition card, showing the character, level ring, this week's quests and a tap target to the progress page.
- **Workout finish:** an XP breakdown, with PR and level-up moments.
- **Nutrition:** a small happy bounce when protein is hit; nothing at all when over.
- **`/progress`:** stage roadmap, badges, story chapters and history.
- **Settings:** character on/off and name; body-neutral mode (no nutrition XP, no weight on game screens); pause.

## 7. Build phases

| Phase | Scope | Rough effort |
| --- | --- | --- |
| 0. Engine | `progress.js` + tests (XP, levels, stages, mood, badges, weekly quests, freezes/pause, `pendingCelebrations`); `mascot` in DEF; sync merge rules on both sides + tests. No UI. | 1.5–2 days |
| 1. MVP | A simple SVG potato (or the chosen concept), `Mascot.jsx`, Home card, level-up modal, confetti, sound, Settings toggles; English strings | 4–6 days |
| 2. Story + evolution | Final art, evolution cut-scene, `/progress` page with badges, story chapter cards (static JSON), "Tap to celebrate" | 3–5 days + art |
| 3. Rewards | Cosmetic unlocks (props as SVG layers), surprise drops, nudge copy from the character, the MCP server exposing level and badges | 3–5 days |
| 4. Optional | Rive version of the character, only if the SVG feels flat | 3–5 days + $1,000–3,000 art |

Every phase ships the usual way: push `feature/nutrition` (or a new `feature/gamify` branch; the image
workflow in `.github/workflows/fork-images.yml` then needs that branch added). GitHub builds the arm64 images, and the owner taps
**Settings → About & updates → Update this server**.

## 8. Unverified items carried over

From research-01:
- Hamari 2014 study count
- Teixeira 2012 SDT details
- the "losses hurt ~2×" figure
- Duolingo gem prices
- Nike Run Club mechanics
- the ISSN protein range

From research-02:
- iPhone CPU/battery figures for any runtime
- Glaxnimate Lottie export
- nginx `application/wasm` type
- Rive pricing (two sources disagree)
- the iOS switch-haptic in a home-screen PWA

## 9. To redo: free asset sources

The brief, for an agent or a fresh session: find 25–40 free sources and verify each licence on its own page.
- **Categories:**
  - animated characters: LottieFiles, Rive community, Noto animated emoji, Fluent Emoji
  - illustrations: Kenney, OpenGameArt, itch.io, Open Peeps, OpenMoji
  - avatars: DiceBear styles
  - icons and badges: game-icons.net, Tabler/Phosphor/Lucide
  - sound: Kenney audio, freesound, Pixabay, Mixkit
  - 3D: Quaternius, Kenney 3D, Poly Pizza
  - free tools: Inkscape, Rive free tier, Piskel/LibreSprite
- **For each source:** licence, attribution required or not, whether redistribution **inside a public AGPL repo** is allowed (many "free" licences — Freepik/Storyset, IconScout, marketplaces — forbid redistributing raw files), and a verdict.
- **Deliverables:** an `ASSETS-CREDITS.md` template, and a reminder that branded characters (Duolingo's owl) are off-limits even redrawn.

## 10. Handoff: starting a new chat

- **Repo:** fork `adwaith-js/openGym`, branch `feature/nutrition`. Upstream is `DuarteSantos8/openGym`.
- **Read first:** `CLAUDE.md`, `CONTRIBUTING.md` (dependency-light; tests beside `src/lib` code), and this file.
- **Deploy:** push → GitHub builds `ghcr.io/adwaith-js/opengym-{api,web}:nutrition` → owner taps Update this server.
  The Pi runbook is the project doc "openGym nutrition — deploy and rollback" (`contrib/pi/`).
- **Tests:** `cd frontend && npx vitest run`; `cd api && npm test`. About 13 upstream tests fail on dates and timezone
  (demoSeed, workout-at, .fit export, some coach jobs/payload). They fail the same on untouched upstream, so they're not regressions.
- **Prompt to paste into the new chat:**
  "Continue the openGym gamification work. Read docs/dev/gamification/PLAN.md on the feature/nutrition branch of
  adwaith-js/openGym, ask me the §2 questions, then do the mockups (§5) and the asset research (§9)."
