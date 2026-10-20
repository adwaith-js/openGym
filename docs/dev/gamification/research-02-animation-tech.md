# 02: Animation technology for an evolving mascot in openGym

Research date: 2026-10-20. "Measured" means I downloaded the npm tarball and gzipped the file myself (`gzip -9`). "Unverified" means I found no primary source or test result for the claim.

## TL;DR

- **Recommendation: hand-built inline SVG "rig" animated with CSS keyframes and the Web Animations API (WAAPI).** It adds no dependency, costs about 15 to 25 KB gzipped for all 6 stages × 4 moods, lands in the JS bundle that `sw.js` already precaches, and switches state with a React prop. It is the only option that meets CONTRIBUTING.md's dependency rule.
- **Phase 2 upgrade, only if commissioned art needs it: Rive `@rive-app/canvas-lite`**, lazy-loaded, with its WASM self-hosted. This is the tech Duolingo uses. Its state machine and data binding fit "mascot driven from app state" better than Lottie does. The cost is about 110 KB gzipped of JS plus 324 KB gzipped of WASM (measured). Out of the box it fetches WASM from unpkg/jsdelivr, which breaks the app's "no third party" promise and offline use. Keep the SVG mascot as the fallback.
- **Derive, don't store.** A pure `lib/progress.js` computes XP, level, stage, mood and badges from `workouts`, `foodLog`, `nutTargets`, `bodyweight` and `dayNotes`. Only a small `mascot` object is stored: the chosen name/skin, a `since` date, and a grow-only set of celebrations already shown.
- **Confetti** takes about 40 lines of canvas code. **Haptics** on iOS: none in Safari (the app already greys out Vibrate), except a fragile `<input switch>` hack. **Sound** reuses `lib/sound.js`. **Reduced motion:** `index.css` already kills CSS animations globally, but WAAPI animations are not covered by that rule, so they need their own check.

---

## 1. Rendering options compared

### 1.1 Measured runtime sizes (npm, 2026-10-20)

| Package (version, licence) | JS file (raw → gzip) | WASM (raw → gzip) | Total gzip |
|---|---|---|---|
| none (inline SVG + CSS/WAAPI) | 0 | – | **0** (art only) |
| `@rive-app/canvas-lite` 2.45.0, MIT | rive.js 492 KB → **110 KB** | rive.wasm 792 KB → **324 KB** | ~434 KB |
| `@rive-app/canvas` 2.45.0, MIT | 576 KB → **126 KB** | 2.10 MB → **866 KB** | ~992 KB |
| `@rive-app/webgl2` 2.45.0, MIT | 565 KB → **122 KB** | 2.23 MB → **926 KB** | ~1.05 MB |
| `lottie-web` 5.13.0, MIT, `lottie_light.min.js` (UMD) | 168 KB → **46 KB** | – | 46 KB |
| `lottie-web` ESM light / ESM full | 365 KB → 72 KB / 589 KB → 114 KB | – | 72 / 114 KB |
| `@lottiefiles/dotlottie-web` 0.81.0, MIT | index.js 165 KB → **33 KB** | 1.24 MB → **496 KB** | ~529 KB |
| `canvas-confetti` 1.9.4, ISC (for reference) | 25 KB → **6.9 KB** | – | 6.9 KB |

Notes:
- Rive's `canvas-lite` "drops the text, layout, audio, and scripting engines to save space". `webgl2` is the recommended renderer and the only one with vector feathering, but non-Normal blend modes are "expensive, especially on mobile" ([Rive: canvas vs webgl](https://rive.app/docs/runtimes/web/canvas-vs-webgl)).
- Both the Rive and dotLottie runtimes **fetch their WASM from a public CDN by default**: `rive.js` contains `https://unpkg.com/` and `https://cdn.jsdelivr.net/npm/`, and dotLottie hard-codes `cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web@0.81.0/dist/dotlottie-player.wasm` (measured by grepping the tarballs). Each has a `setWasmUrl()` to point at a self-hosted copy. You must use it here, both for the privacy promise and because the service worker never cached the CDN file.
- The full `lottie.min.js` contains an `eval(` (for After Effects expressions) and the light build has none (measured). LottieFiles' own security docs warn that expressions in an untrusted file can cause XSS ([LottieFiles relottie security](https://docs.lottiefiles.com/en/tools/relottie/ecosystem/security)). If Lottie is used, use the light/SVG build.

### 1.2 Comparison

| | **Inline SVG + CSS/WAAPI** | **Rive** | **Lottie (lottie-web / dotLottie)** | **Sprite sheet / pixel art on canvas** | **CSS-only (divs/emoji)** | **Animated WebP/APNG/video** |
|---|---|---|---|---|---|---|
| Runtime cost | 0 KB | 434 KB to 1 MB gz (above) | 46 KB (light) or 529 KB (dotLottie) | 0 KB (≈2 KB of own code) | 0 KB | 0 KB |
| Asset size, 6 stages × 4 moods + celebration | ~15 to 25 KB gz with a shared face rig (estimate) | one .riv, typically under 100 KB (a [Fiverr seller's claim](https://fiverr.com/alan_art/design-and-animate-an-interactive-rive-character-mascot)); Duolingo's complex Lily file is "under a megabyte" ([Rive blog](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life)) | one JSON per clip, roughly 20 to 80 KB each → hundreds of KB (estimate, unverified) unless dotLottie themes/slots are used | 24 frame strips in PNG/WebP @2x ≈ 0.3 to 1 MB (estimate) | ~1 KB | 0.5 to 3 MB; AVIF/WebM alpha is broken or unsupported on Safari ([Jake Archibald](https://jakearchibald.com/2024/video-with-transparency/)) |
| iPhone CPU/battery | Lowest when only `transform`/`opacity` are animated (compositor thread) ([web.dev](https://web.dev/articles/animations-and-performance)); path morphing and filters repaint on the main thread | Each playing frame is rendered on the main thread through WASM. It pauses offscreen (`IntersectionObserver` is present in rive.js, measured). The only benchmark found ran on old Android: ~60 fps for Rive vs ~17 for Lottie, with more graphics memory for Rive ([Callstack](https://callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation)). No iPhone/WebKit figures, so **unverified on iOS** | lottie-web SVG renderer rewrites DOM attributes every frame (main thread). dotLottie has `freezeOnOffscreen` (measured in d.ts) | `drawImage` per frame is cheap. Step through frames at 8 to 12 fps | Lowest | The video decoder is hardware-backed, but there is no state; each mood is a separate file |
| Offline | Part of the JS bundle, so precached already | .riv and .wasm are **not** precached today: `sw.js` precaches what index.html names, filtered to `js/css/png/svg/webmanifest/json`, and `scripts/sw-stamp.mjs lazyAssets()` lists only `.js/.css`. Both filters need extending | Lottie JSON is precached only if imported into a JS chunk. dotLottie WASM has the same gap as Rive | PNG matches the precache regex only when index.html names it, so import it from JS or extend the lazy list | Bundled | Same gap as Rive |
| Driving state from the app | Props become classes or `data-mood`, and `el.animate()` runs one-shots | State machine inputs (`stateMachineInputs(name)`, `.value`, `.fire()`), plus the newer Data Binding (`autoBind`, `viewModelInstance`, measured in rive.d.ts). Rive docs now steer state-machine control through data-binding properties ([Rive web state machines](https://rive.app/docs/runtimes/web/state-machines)) | lottie-web: segments and frame ranges only. dotLottie: `stateMachineLoad/Start`, `stateMachineSetNumericInput/BooleanInput/StringInput`, `stateMachineFireEvent`, plus `setTheme`/`setSlots` (measured in d.ts) | Pick the row = mood and column range = clip | Classes | Swap `src` |
| Authoring tools | Any vector editor (Inkscape free, Figma, Affinity); hand-edit group ids | Rive editor (proprietary). Free plan exports .riv "with a splash screen". Cadet $9, Voyager $32 per seat/month ([rive.app/pricing](https://rive.app/pricing)); a third-party listing shows $17 for Cadet billed monthly ([Front Desk Review](https://frontdeskreview.com/software/design-tools/rive/)) | After Effects + Bodymovin (Adobe subscription), LottieFiles Creator (web, freemium; pricing not verified), Glaxnimate (open source; Lottie export **unverified**) | Aseprite (paid, source-available), LibreSprite/Piskel (free) | Code | Any video tool |
| Licence | Yours | Runtimes MIT. The editor and the .riv source (.rev) are proprietary; see the AGPL note below | MIT runtimes; the format is open | Yours | Yours | Yours |
| Fit for openGym | **Best** | Best quality; heavy, plus a vendor tool | Middle ground; weak at interactive state | Good if a pixel-art style is chosen | Placeholder only | Celebration only, not the card |

**AGPL note (unverified, not legal advice):** AGPL asks for the "preferred form for modification". For a .riv file that would arguably be the Rive editor project, which can only be edited in a proprietary tool. Lottie JSON and SVG are open, text-diffable formats that contributors can edit. If Rive is adopted, commit the exported .riv and say in the README where the editable source lives.

**Duolingo and Rive.** Duolingo drives its ten World Characters' mouths from phoneme timings through Rive state machines: "The State Machine's powerful system is what allowed this project to be feasible on a grand scale", with 20+ mouth shapes per character ([Duolingo blog: visemes](https://blog.duolingo.com/world-character-visemes)). For Lily, "eight head animations and eight body animations combine into more than 64 neutral-movement variations" through blending, using nested artboards ([Rive blog: Lily](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life)). Duolingo's streak-milestone post, where Duo transforms into a phoenix, covers the design process but names no tool ([Duolingo blog](https://blog.duolingo.com/streak-milestone-design-animation)). The lesson for openGym is the architecture, not the vendor: a small set of layered body parts that the app combines from inputs, rather than one pre-rendered clip per combination.

### 1.3 Recommendation

1. **Primary: inline SVG rig + CSS keyframes for idle loops + WAAPI for one-shots.** Draw one SVG per stage (body silhouette, limbs, props) that shares a single **face rig** (`#eyes`, `#brows`, `#mouth` groups) across all stages. Moods become face swaps plus a body-posture class, so 6 × 4 does not mean 24 drawings. Idle motion is a `transform` bob, a blink (`scaleY` on `#eyes`) and a breathing scale, all compositor-friendly.
2. **No-dependency fallback beneath it: a static SVG per stage** with no animation. This is also the `prefers-reduced-motion` rendering. If even SVG art is not ready, a CSS/emoji placeholder (🥔 + level ring) unblocks the logic work.
3. **Optional later: Rive canvas-lite**, loaded with `import()` only when the Home card is visible. Use `RuntimeLoader.setWasmUrl('./assets/rive.wasm')`, add `.wasm`/`.riv` to the service-worker precache, and keep the SVG mascot as the fallback for load failures and reduced motion.

Sketch of the SVG component (`components/Mascot.jsx`):

```jsx
// Stage art is static JSX per stage, all sharing one face rig; mood and stage are props.
import { STAGE_ART } from './mascot-art.jsx'          // { couch: <g/>, … } lazily split if large
import { FACES } from './mascot-faces.jsx'            // { happy, tired, celebrating, sleepy }

export default function Mascot({ stage, mood, size = 120 }) {
  const Body = STAGE_ART[stage], Face = FACES[mood]
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img"
         aria-label={`${stage} mascot, ${mood}`} className={`mascot m-${mood}`}>
      <g className="m-bob">{Body}<g className="m-face">{Face}</g></g>
    </svg>
  )
}
```

```css
/* transform/opacity only: composited, cheap. index.css already disables these under reduced motion. */
.mascot .m-bob { animation: bob 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
.m-tired .m-bob { animation-duration: 5s; }            /* slower = sluggish */
.mascot .m-face #eyes { animation: blink 5s infinite; transform-box: fill-box; transform-origin: center; }
@keyframes bob   { 50% { transform: translateY(-4px) scaleY(1.02); } }
@keyframes blink { 0%, 96%, 100% { transform: scaleY(1); } 98% { transform: scaleY(.1); } }
.mascot-paused .m-bob, .mascot-paused #eyes { animation-play-state: paused; } /* toggled by IntersectionObserver */
```

---

## 2. Driving the character from app state: `lib/progress.js`

### 2.1 Why derive instead of store

openGym's state is one JSON document per user, merged field by field across devices (`lib/sync-merge.js`): workouts are unioned by id, `foodLog` by id, `bodyweight` by day, and deletions are tombstoned in `S.deleted`. A stored counter such as `xp: 1250` does not survive that model:

- **Two devices increment concurrently.** The phone logs a workout (+50 → 1300) and the iPad logs a food day (+20 → 1270). Scalars are last-writer-wins, so one award is lost. Counters would need CRDT handling, but this merge has no counter type.
- **Edits and deletions.** Workouts can be moved, edited and deleted (`session-edit.js`, `rebuildPrHistory`), and a reset wipes listed ids. A derived XP follows automatically; a stored one drifts.
- **Imports and backups.** A CSV/Hevy import or restored backup yields correct XP without migration.
- **Testability.** `progress(S, today)` is a pure function that fits the `src/lib` + Vitest convention.

Cost: it recomputes over all workouts and food entries, O(n) with n in the low thousands, which is negligible. Memoize on the `workouts`/`foodLog` array identity.

### 2.2 What does need storing

```js
// useStore DEF addition
mascot: null,   // { on, name, skin, since, seen: { [key]: ts }, _ts }
```

- `on`, `name`, `skin`: user choices, merged last-writer-wins by stamp like other settings.
- `since` (ISO date): the day the mascot was switched on. History from before it counts at a discount or not at all. This avoids a year of imported workouts (the importer writes `prs: []` and ids from `importId('iw', …)`, `lib/import-csv.js`) evolving the potato to its final stage on day one, mirroring the reasoning in `workout-date.js` that badges for imported history would be "an invention". Merge rule: the earlier date wins.
- `seen`: celebrations already shown, keyed `level:7`, `stage:3`, `badge:first-pr`. This must be a **grow-only key union** (like `STAMPED_MAPS` in sync-merge.js), not whole-object last-writer-wins. Today `hints` falls under the generic settings rule, so a flag can be lost. For hints that is harmless; for a celebration it means it replays. Add `mascot` to sync-merge.js with a test, plus the server's `api/sync-stamps.js` parity (`sync-stamps-parity.test.js` exists).

### 2.3 Real field names used

From `store/useStore.js` DEF and `lib/nutrition.js`:
- `workouts[]`: `{ id, d, start, end, entries[{ id, sets, topW }], prs: [exerciseId…], excludeFromProgression? }` (`finish-workout.js buildCompletedWorkout`)
- `foodLog[]`: `{ id, d, meal, name, kcal, p, c, f, src, _ts }`. `nutTargets`: `{ kcal, p, c, f, source, at }`. `nutProfile.targetKg`
- `bodyweight[]`: `{ d, w, t }` in `S.unit`. `targetW`
- `dayNotes`: `{ [iso]: { tag, text, _ts } }`, an excused day off (the nudge already respects it)
- Reusable helpers: `dayTotals(foodLog, d)`, `remaining(targets, totals)`, `addDays`, `daysBetween`, `weightTrend` from nutrition.js

### 2.4 API sketch

```js
// lib/progress.js: pure, no imports beyond lib helpers. Everything here is derived from synced state.
import { dayTotals, addDays, daysBetween } from './nutrition.js'

export const XP = { workout: 50, pr: 15, prCap: 3, foodLogged: 5, foodOnTarget: 15, weighIn: 2 }
// Level n needs 100·n·(n-1)/2 XP total: 0, 100, 300, 600, 1000, …
export const levelForXp = xp => Math.floor((1 + Math.sqrt(1 + 8 * Math.max(0, xp) / 100)) / 2)
export const xpForLevel = n => 100 * n * (n - 1) / 2
// Stage thresholds by level; the names are i18n keys.
export const STAGES = [
  { id: 'couch', from: 1 }, { id: 'sprout', from: 3 }, { id: 'spud', from: 6 },
  { id: 'fit', from: 10 }, { id: 'athlete', from: 15 }, { id: 'super', from: 21 },
]

/** A real session: at least one completed work set (imports included, but only from `since`). */
const counts = (w, since) => w && w.d && (!since || w.d >= since) && (w.entries || []).length > 0

/** One day's nutrition verdict: logged at all, and within ±10 % kcal with ≥ 90 % protein. */
export function dayNutrition(foodLog, targets, d) {
  const t = dayTotals(foodLog, d)
  if (!t.n) return { logged: false, onTarget: false }
  const ok = targets?.kcal > 0 && Math.abs(t.kcal - targets.kcal) <= targets.kcal * 0.1
    && (!(targets.p > 0) || t.p >= targets.p * 0.9)
  return { logged: true, onTarget: !!ok }
}

/** Everything the mascot shows, from state alone. `today` is an ISO date (injected for tests). */
export function progress(S, today) {
  const since = S.mascot?.since || null
  const ws = (S.workouts || []).filter(w => counts(w, since))
  // One workout per day earns full XP; extra sessions the same day earn half (no farming).
  const perDay = new Map()
  let xp = 0
  for (const w of ws) {
    const n = perDay.get(w.d) || 0; perDay.set(w.d, n + 1)
    xp += n === 0 ? XP.workout : XP.workout / 2
    xp += Math.min((w.prs || []).length, XP.prCap) * XP.pr
  }
  const foodDays = new Set((S.foodLog || []).filter(e => e?.d && (!since || e.d >= since)).map(e => e.d))
  let onTargetDays = 0
  for (const d of foodDays) {
    const v = dayNutrition(S.foodLog, S.nutTargets, d)
    xp += XP.foodLogged + (v.onTarget ? XP.foodOnTarget : 0)
    if (v.onTarget) onTargetDays++
  }
  xp += (S.bodyweight || []).filter(b => b?.d && (!since || b.d >= since)).length * XP.weighIn

  const level = levelForXp(xp)
  const stage = [...STAGES].reverse().find(s => level >= s.from).id
  return {
    xp, level, stage,
    intoLevel: xp - xpForLevel(level), levelSpan: xpForLevel(level + 1) - xpForLevel(level),
    mood: moodFor(S, ws, today),
    badges: badgesFor(S, ws, onTargetDays, today),
  }
}

/** celebrating > happy > ok > tired > sleepy. A noted day off counts as rest, not neglect. */
export function moodFor(S, ws, today) {
  const last = ws.reduce((m, w) => (w.d > m ? w.d : m), '')
  if (ws.some(w => w.d === today && (w.prs || []).length)) return 'celebrating'
  if (!last) return 'sleepy'
  let gap = daysBetween(last, today)
  for (let d = addDays(last, 1); d < today; d = addDays(d, 1)) if (S.dayNotes?.[d]) gap--
  const ateWell = dayNutrition(S.foodLog, S.nutTargets, addDays(today, -1)).onTarget
  if (gap <= 1) return ateWell || !S.nutTargets ? 'happy' : 'ok'
  if (gap <= 4) return 'ok'
  return gap <= 7 ? 'tired' : 'sleepy'
}

/** Badges are pure predicates over state: earned is derived, "already celebrated" is mascot.seen. */
export const BADGES = [
  { id: 'first-workout', test: c => c.ws.length >= 1 },
  { id: 'ten-workouts', test: c => c.ws.length >= 10 },
  { id: 'first-pr', test: c => c.ws.some(w => (w.prs || []).length) },
  { id: 'fuel-7', test: c => c.onTargetDays >= 7 },
  // …streaks, goal weight reached (bodyweight vs targetW / nutProfile.targetKg), etc.
]
export const badgesFor = (S, ws, onTargetDays) => BADGES.filter(b => b.test({ S, ws, onTargetDays })).map(b => b.id)

/** What to celebrate now: the derived milestones minus the synced `mascot.seen`. Only the newest
 *  stage/level is returned (a device that was offline for a month gets one cut-scene, not twelve). */
export function pendingCelebrations(p, seen = {}) {
  const out = []
  if (!seen[`stage:${p.stage}`]) out.push({ kind: 'evolve', key: `stage:${p.stage}` })
  else if (!seen[`level:${p.level}`]) out.push({ kind: 'level', key: `level:${p.level}` })
  for (const b of p.badges) if (!seen[`badge:${b}`]) out.push({ kind: 'badge', key: `badge:${b}` })
  return out
}
```

Design choices to settle (flagged, not decided):
- **Nutrition is judged against current `nutTargets`**, since historical targets are not stored, so changing targets can re-score past days and move XP. Options: judge only days on or after `nutTargets.at` (`at` is already stored), or award a flat "logged" XP for old days. Either way, **never play a "de-evolution"**: if derived stage drops, show the lower stage quietly.
- `excludeFromProgression` / `noProg` sessions should probably still earn XP, since they are real effort. Deload weeks are good behaviour.
- The levelling curve (triangular, 100 XP base) puts stage 6 at level 21, which is 21,000 XP: roughly a year at 4 workouts a week plus daily food logging and weigh-ins (about 380 XP a week). Tune it with a test that asserts "typical user reaches stage 2 in about 2 weeks".

### 2.5 Unit tests (`lib/progress.test.js`)

```js
import { describe, it, expect } from 'vitest'
import { progress, levelForXp, xpForLevel, pendingCelebrations, moodFor } from './progress.js'

const W = (d, prs = []) => ({ id: 'w' + d, d, entries: [{ id: 'squat', sets: [{ w: 100, r: 5, done: true }] }], prs })
const base = { workouts: [], foodLog: [], bodyweight: [], nutTargets: null, dayNotes: {}, mascot: null }

describe('progress', () => {
  it('level curve is monotonic and inverts xpForLevel', () => {
    for (let n = 1; n < 40; n++) expect(levelForXp(xpForLevel(n))).toBe(n)
  })
  it('empty state is a level-1 couch potato, sleepy', () => {
    expect(progress(base, '2026-10-20')).toMatchObject({ xp: 0, level: 1, stage: 'couch', mood: 'sleepy' })
  })
  it('is order-independent: two devices merging the same workouts derive the same XP', () => {
    const a = progress({ ...base, workouts: [W('2026-10-01'), W('2026-10-03', ['squat'])] }, '2026-10-20')
    const b = progress({ ...base, workouts: [W('2026-10-03', ['squat']), W('2026-10-01')] }, '2026-10-20')
    expect(a.xp).toBe(b.xp)
  })
  it('deleting a workout takes its XP away (no drift)', () => {
    const two = progress({ ...base, workouts: [W('2026-10-01'), W('2026-10-02')] }, '2026-10-20').xp
    const one = progress({ ...base, workouts: [W('2026-10-01')] }, '2026-10-20').xp
    expect(two - one).toBe(50)
  })
  it('history before mascot.since does not count (a CSV import cannot max the mascot out)', () => {
    const S = { ...base, mascot: { since: '2026-10-10' }, workouts: [W('2025-01-01'), W('2026-10-11')] }
    expect(progress(S, '2026-10-20').xp).toBe(50)
  })
  it('a noted day off does not make the mascot tired', () => {
    const S = { ...base, workouts: [W('2026-10-14')], dayNotes: { '2026-10-15': { tag: 'sick' }, '2026-10-16': { tag: 'sick' }, '2026-10-17': { tag: 'sick' } } }
    expect(moodFor(S, S.workouts, '2026-10-20')).toBe('ok')
  })
  it('a celebration already seen on another device is not replayed', () => {
    const p = { stage: 'sprout', level: 3, badges: ['first-workout'] }
    expect(pendingCelebrations(p, { 'stage:sprout': 1, 'badge:first-workout': 1, 'level:3': 1 })).toEqual([])
  })
})
```

Plus a sync-merge test: two copies with different `mascot.seen` keys merge to the union.

---

## 3. Celebrations and moments

**Trigger point.** Compute `pendingCelebrations(progress(S), S.mascot.seen)` after `finishWorkout` and after a food entry is saved. Both happen inside a user tap, which matters for sound (below). Write `seen[key] = Date.now()` when the modal *opens*, not when it closes, so a second device that syncs mid-celebration does not replay it.

**Level-up modal.** Reuse the app's existing modal/sheet components (`store/useUI.js` holds modal state). Show a WAAPI pop (`scale .6→1.1→1`, `opacity 0→1`, 400 ms) and the XP bar filling via `transform: scaleX()`, not `width`.

**Evolution cut-scene (about 2.5 s, skippable on tap):**
```js
// All transform/opacity; each step awaits Animation.finished. `old`/`neu` are stacked <svg>s.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches
async function evolve(old, neu, flash) {
  if (still) { old.style.opacity = 0; neu.style.opacity = 1; return }   // straight swap + text
  await old.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
                    { duration: 300, iterations: 3 }).finished                       // wiggle
  await flash.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: 'forwards' }).finished // white overlay
  old.style.opacity = 0; neu.style.opacity = 1
  flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' })
  await neu.animate([{ transform: 'scale(.7)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
                    { duration: 500, easing: 'cubic-bezier(.2,1.4,.4,1)' }).finished
  confetti()
}
```
Avoid animating `filter: brightness(0)` for a silhouette effect. Filters repaint every frame. Use a pre-drawn white silhouette copy and fade it instead.

**Confetti, no dependency.** `canvas-confetti` is only 6.9 KB gzipped (ISC), but the hand-rolled version is about 40 lines. The technique is particles with velocity, gravity and spin, a `requestAnimationFrame` loop, and cleanup when all particles have left the screen. Keep to about 100 particles or fewer on mobile ([OpenReplay walkthrough](https://blog.openreplay.com/adding-confetti-effects-javascript-fun-walkthrough/)).
```js
// lib/confetti.js: a one-shot full-screen canvas, removed when the last piece falls off-screen.
export function confetti({ n = 90, colors = ['#c6f432', '#5b8cff', '#ff6b6b', '#ffd23f'] } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return   // skip entirely
  const c = Object.assign(document.createElement('canvas'), { className: 'confetti' })
  const dpr = Math.min(2, devicePixelRatio || 1)                         // cap fill cost on 3x screens
  c.width = innerWidth * dpr; c.height = innerHeight * dpr
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:999'
  document.body.append(c)
  const g = c.getContext('2d'); g.scale(dpr, dpr)
  const P = Array.from({ length: n }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 12 - 4,
    r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, s: 5 + Math.random() * 5,
    col: colors[(Math.random() * colors.length) | 0],
  }))
  const tick = () => {
    g.clearRect(0, 0, innerWidth, innerHeight)
    let alive = 0
    for (const p of P) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr     // gravity, drag, spin
      if (p.y < innerHeight + 20) alive++
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.col
      g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore()
    }
    alive ? requestAnimationFrame(tick) : c.remove()                       // self-cleanup
  }
  requestAnimationFrame(tick)
}
```
The physics (positions after k ticks) can be split into a pure `step(particles)` and unit-tested if wanted.

**Haptics.** iOS Safari has no `navigator.vibrate`. The app already knows this: Settings greys out Vibrate with "iPhone doesn't let openGym vibrate", and `lib/sound.js` exports `vibrateSupported()`. Options:
1. *(Recommended)* Use `vibrate([20, 40, 60])` where supported (Android), and on iPhone substitute sound plus the visual pop.
2. The `<input type="checkbox" switch>` hack: programmatically clicking a hidden switch's `<label>` makes iOS play its switch haptic ([azukiazusa](https://azukiazusa.dev/en/blog/ios-safari-web-haptics), [ios-haptics npm, MIT](https://npmjs.com/package/ios-haptics)). The switch control shipped in Safari 17.4 ([WebKit](https://webkit.org/?p=15054)), but WebKit's post never mentions haptics. Library authors say it "might stop working if Apple changes its internal handling". Whether it needs user activation, or works in a home-screen PWA, is **unverified**. If tried, it is about 10 lines and needs no dependency. Gate it behind the existing vibrate setting.
3. The Capacitor iOS shell could use `@capacitor/haptics`. That is a new dependency, though in the same family as the existing `@capacitor/*` ones. Native build only.

**Sound.** Reuse `lib/sound.js` (`chime(enabled, kind)`, `unlock()`), whose header documents the iOS rules: Web Audio must be started inside a tap, and it obeys the silent switch unless `playOnSilent` is on. Celebrations triggered by the "Finish workout" or "Save food" tap can call `unlock()` then `chime()` in that handler. A celebration discovered on app open, from another device's sync, has no gesture to start audio. Show it silently or behind a "Tap to celebrate" button whose tap unlocks audio. Add a level-up timbre to `rest-sounds.js` rather than shipping audio files. Respect `S.sound`.

**Reduced motion.** `index.css:147` already has `@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}`, so the idle CSS loops stop automatically. That rule does **not** stop `element.animate()` (WAAPI) or canvas confetti, which must check `matchMedia('(prefers-reduced-motion: reduce)')` themselves, as `SwipeCards.jsx`, `CustomMedia.jsx` and `Workout.jsx` already do. Put a `reducedMotion()` helper in `lib/` and use it in both places. Reduced-motion users still get the modal, the new stage art and the text: the information, without the motion.

---

## 4. Getting the art

**Original art only.** The character must not resemble Duolingo's Duo, which is a registered trademark and copyrighted character, or any existing mascot. A potato is generic, but "Super Potato" is also the name of a well-known Japanese retro-games shop chain (**unverified** trademark status). Run a quick trademark search on the final names, or keep stage names generic ("Stage 6: Supreme Spud"). Avoid the green-owl palette and the round-eye shapes. Avoid prompts like "in the style of Duolingo".

**Commissioning (price ranges found):**
- Fiverr Rive mascot gigs range widely: "4 to 6 animation states, basic state machine" for **$90** ([Fiverr tim_joey1](https://fiverr.com/tim_joey1/create-game-character-rive-animation-and-interactive-state-machine-for-web-app)), and **$600** for one custom character with a single idle loop, Rive source and commercial rights, at **$70/h** for more ([Fiverr alan_art](https://fiverr.com/alan_art/design-and-animate-an-interactive-rive-character-mascot)).
- A specialist's published ranges: basic animated mascot **$300 to $800**, multi-state mascot **$1,000 to $3,000**, interactive Rive mascot with state machines **$2,500 to $6,000+** ([dev.to/uianimation](https://dev.to/uianimation/how-much-does-custom-mascot-animation-cost-4c64)). This is a vendor's own blog, so it is a marketing source.
- Freelance 2D animator rates: about **$25 to $50/h** for beginners up to **$75 to $175/h** for seniors ([Twine](https://twine.net/blog/2d-animator-hourly-rates)).
- **Estimate for this brief** (6 stages × 4 moods as a layered SVG rig, plus one evolution sequence): about **$400 to $1,500** for static layered SVGs from a mid-level Fiverr/Upwork illustrator. Animate them yourself with CSS/WAAPI. A Rive state-machine build on top adds **$1,000 to $3,000**. These are my synthesis, not quotes.
- **Contract essentials:** full copyright assignment, or an exclusive licence that allows redistribution under AGPL-3.0 or CC BY-SA 4.0 in a public repo. Deliver layered source files (SVG with named groups `#eyes`, `#mouth`, `#arm-l`, …; or the editor project). No AI-generated content unless disclosed. Exclusivity matters: the $600 gig charges extra for "exclusive rights".

**Free or hand-drawn.** CC0 or CC-BY character packs (OpenGameArt, Kenney) rarely match a 6-stage evolution and would need attribution. Hand-drawing in Inkscape is realistic for a simple, geometric style: rounded potato body, dot eyes, a few props per stage (couch, sweatband, dumbbell, cape). Simple shapes animate well and stay tiny. This is the recommended phase-1 route.

**AI image generators:**
- *Copyright.* The US Copyright Office (Jan 2025) found prompts alone "instructions that convey unprotectible ideas". Purely AI outputs are not copyrightable. Human selection and arrangement, and substantial human modification, are protected only for the human contribution ([FKKS summary](https://technologylaw.fkks.com/post/102jyvq/key-insights-on-copyright-and-ai-from-the-u-s-copyright-offices-2025-report)). For an AGPL project this means a raw AI mascot cannot be licensed meaningfully, and anyone could reuse it.
- *Terms.* Midjourney paid plans give you ownership "to the fullest extent possible", but the free trial is CC BY-NC. Generations are public in the gallery unless you pay for Stealth (Pro/Mega). Companies with more than $1M revenue need Pro or Mega ([terms.law](https://www.terms.law/2026/01/15/midjourney-commercial-use-rights-complete-2026-guide/)). There is no IP indemnity.
- *Consistency.* Generators struggle to keep one character identical across 24 pose/mood combinations: proportions, eye shapes and colours drift. Using image references or character-reference features helps but does not give a rig.
- *Raster to vector.* Auto-tracing (Inkscape Trace Bitmap/potrace, vtracer, Vectorizer.ai) produces many unnamed paths with no layering, which cannot be animated. In practice you **redraw over the AI image as a reference** in a vector tool, building it from named layers. At that point the human contribution is the art, which is also what makes it copyrightable. Use AI for concept exploration only.

---

## 5. Performance budget and file sizes

Target: Home-screen card (about 120 px) showing 1 of 24 stage/mood combos, plus one full-screen celebration.

| Item | SVG route (recommended) | Rive route | Lottie route |
|---|---|---|---|
| Runtime | 0 | 434 KB gz JS+WASM (canvas-lite), lazy | 46 KB gz (light) |
| 6 stage bodies | 6 × 2 to 3 KB gz (≈ 3 to 6 KB raw SVG each, about 40 to 80 paths) | one .riv for everything, ≈ 50 to 150 KB | 6 × 15 to 40 KB JSON (est.) |
| 4 face rigs (shared) | 4 × 0.3 to 0.5 KB | (inside .riv) | (inside each JSON, or dotLottie slots) |
| Evolution cut-scene | ~1 KB of WAAPI code + 1 KB confetti | (state in .riv) | 50 to 150 KB JSON |
| **Total extra download** | **≈ 15 to 25 KB gz** | **≈ 500 to 600 KB gz** | **≈ 150 to 400 KB gz** |

All asset numbers except the runtimes are estimates. Re-measure with `vite build` once art exists.

Rules of thumb for the budget:
- **Main bundle impact under 10 KB gz.** Put the stage art in its own chunk via `React.lazy`/`import()`. The SW `LAZY` list precaches it automatically because it is `.js`.
- **Card at rest.** Only `transform`/`opacity` animate, with at most 2 concurrent loops (bob plus blink). Pause with an `IntersectionObserver` when scrolled away and on `visibilitychange`. Blink every ~5 s instead of running 60 fps motion constantly. No SVG `filter`, `mask` or blur in animated groups; bake shadows into flat shapes.
- **Celebration.** Under 3 s, at most 100 confetti particles, canvas DPR capped at 2, canvas removed when done. One WAAPI sequence at a time.
- **Memory.** Unmount the celebration overlay when done. With Rive, call `rive.cleanup()` on unmount, since the WASM objects are not garbage-collected.
- **Measure, don't assume.** No iPhone/WebKit benchmark for any of these runtimes was found (**unverified**). Before adopting Rive, profile on the actual iPhone with Safari Web Inspector's Timelines while the Home card idles for 60 s.
- **Rive-specific plumbing**, if adopted: extend `sw.js`'s precache filter and `sw-stamp.mjs lazyAssets()` to include `.wasm`/`.riv` (the `sw.test.js`/`sw-lazy.test.js` suites pin this behaviour). Call `RuntimeLoader.setWasmUrl` to a same-origin URL. Confirm nginx serves `application/wasm` (needed for `instantiateStreaming` under the existing `X-Content-Type-Options: nosniff`; **unverified** against the image's mime.types). The CSP is only `frame-ancestors 'none'`, so WASM is not blocked.

---

## 6. Phased build plan

| Phase | Scope | Effort (one dev, rough) |
|---|---|---|
| **0. Logic** | `lib/progress.js` + `progress.test.js` (XP, level, stage, mood, badges, `pendingCelebrations`). `mascot` added to DEF. Merge rule (grow-only `seen`, earliest `since`, stamped settings) in `sync-merge.js` + `api/sync-stamps.js` with parity/merge tests. No UI. | 1.5 to 2 days |
| **1. SVG MVP** | Placeholder hand-drawn SVG potato (6 stages share one face rig, 4 moods). `Mascot.jsx` with CSS idle loop, offscreen pause, reduced-motion static. Home card with XP ring and level. Level-up modal (WAAPI pop), `lib/confetti.js`, a level-up chime in `rest-sounds.js`, Android vibrate. Settings toggle (on/off, name), `since` set on enable. i18n keys in all locale packs (locale tests). | 4 to 6 days |
| **2. Real art + evolution** | Commission or hand-draw final layered SVGs (calendar time 2 to 6 weeks, $400 to $1,500 if commissioned). Evolution cut-scene. Badges screen (derived list + seen state). "Tap to celebrate" for celebrations found after sync. | 3 to 5 dev days + art |
| **3. Rewards and cosmetics** | Unlockable skins/props (headband, cape) as SVG layers gated by level/badges, stored in `mascot.skin`. Optional iOS switch-haptic, behind the existing setting. Mascot mood in the missed-workout nudge copy (`lib/nudge.js`, `reminder.tone`). Expose level/badges in the MCP server's read-only tools. | 3 to 5 days |
| **4. (Optional) Rive** | Only if the SVG rig feels flat and an animator delivers a .riv. Lazy `@rive-app/canvas-lite`, self-hosted WASM, SW precache changes + tests, SVG fallback kept for reduced motion/failure. Needs a maintainer decision because it is a new dependency (CONTRIBUTING.md). | 3 to 5 days + $1,000 to $3,000 art |

Total for a shippable feature (phases 0 to 2): about 2 to 3 dev-weeks plus art, with **no new runtime dependency**.

---

## Sources

Runtimes and formats
- Rive: Canvas vs WebGL runtimes. https://rive.app/docs/runtimes/web/canvas-vs-webgl
- Rive: web state machines / data binding. https://rive.app/docs/runtimes/web/state-machines
- Rive pricing. https://rive.app/pricing
- Rive pricing (third-party, Sept/Oct 2026). https://frontdeskreview.com/software/design-tools/rive/
- Rive help: pricing (older page, conflicting figures). https://rive.app/community/doc/pricing/docuWp6cbOeg
- Rive: Apple runtime resource usage. https://rive.app/docs/runtimes/apple/resource-usage
- Callstack: Lottie vs Rive benchmark. https://callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation
- LottieFiles: relottie security (expressions/XSS). https://docs.lottiefiles.com/en/tools/relottie/ecosystem/security
- LottieFiles: dotLottie interactivity / state machines. https://docs.lottiefiles.com/en/format/dotlottie/interactivity
- Jake Archibald: Video with alpha transparency on the web. https://jakearchibald.com/2024/video-with-transparency/
- web.dev: Animations and performance. https://web.dev/articles/animations-and-performance
- npm registry tarballs (measured locally): @rive-app/canvas, canvas-lite, webgl2 2.45.0; lottie-web 5.13.0; @lottiefiles/dotlottie-web 0.81.0; canvas-confetti 1.9.4. https://www.npmjs.com/

Duolingo
- Duolingo blog: World character visemes (Rive state machines). https://blog.duolingo.com/world-character-visemes
- Rive blog: Duolingo's AI video call brings Lily to life. https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life
- Duolingo blog: Streak milestone design and animation. https://blog.duolingo.com/streak-milestone-design-animation

Celebrations, haptics, audio
- OpenReplay: Adding confetti effects in JavaScript. https://blog.openreplay.com/adding-confetti-effects-javascript-fun-walkthrough/
- WebKit: An HTML switch control (Safari 17.4). https://webkit.org/?p=15054
- azukiazusa: iOS Safari web haptics. https://azukiazusa.dev/en/blog/ios-safari-web-haptics
- ios-haptics (npm). https://npmjs.com/package/ios-haptics

Art, pricing, licensing
- dev.to/uianimation: How much does custom mascot animation cost. https://dev.to/uianimation/how-much-does-custom-mascot-animation-cost-4c64
- Fiverr gig (tim_joey1). https://fiverr.com/tim_joey1/create-game-character-rive-animation-and-interactive-state-machine-for-web-app
- Fiverr gig (alan_art). https://fiverr.com/alan_art/design-and-animate-an-interactive-rive-character-mascot
- Twine: 2D animator hourly rates. https://twine.net/blog/2d-animator-hourly-rates
- FKKS: Key insights from the US Copyright Office 2025 AI report. https://technologylaw.fkks.com/post/102jyvq/key-insights-on-copyright-and-ai-from-the-u-s-copyright-offices-2025-report
- terms.law: Midjourney commercial use rights (2026). https://www.terms.law/2026/01/15/midjourney-commercial-use-rights-complete-2026-guide/
- Inkscape manual: Tracing an image. https://inkscape-manuals.readthedocs.io/en/latest/tracing-an-image.html

Codebase (read only): `frontend/src/store/useStore.js` (DEF), `frontend/src/lib/nutrition.js`, `frontend/src/lib/sync-merge.js`, `frontend/src/lib/finish-workout.js`, `frontend/src/lib/workout-date.js`, `frontend/src/lib/import-csv.js`, `frontend/src/lib/sound.js`, `frontend/src/index.css`, `frontend/public/sw.js`, `frontend/scripts/sw-stamp.mjs`, `web/nginx.conf.template`, `frontend/package.json`.
