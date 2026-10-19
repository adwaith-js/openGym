// Nutrition: daily calorie and macro targets, the food log, and what is left to eat today.
//
// Everything here is pure and has no imports, so the store, the screens, the Coach and the tests
// all read the same rules. The numbers that decide what someone eats are calculated here, by code
// with tests beside it, never guessed by a model: the Coach may explain them and propose a bounded
// change, and boundTargets() is what such a proposal has to pass.
//
// Units are canonical, whatever the profile's weight unit: body weight in kg, height in cm, energy
// in kcal, macros in grams. The screens convert at their edge (like lib/measurements.js does).
//
// State this module reads and writes (useStore DEF):
//   nutProfile = { sex, age, heightCm, weightKg, targetKg, activity, goal, pace, at }
//   nutTargets = { kcal, p, c, f, source: 'calc' | 'manual' | 'coach', at }
//   foodLog    = [{ id, d, meal, name, kcal, p, c, f, src, photo?, foodId?, _ts }]
//   foods      = [{ id, name, kcal, p, c, f, serving?, _ts }]

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack']
export const SOURCES = ['manual', 'quick', 'food', 'photo']
export const GOALS = ['lose', 'maintain', 'gain', 'recomp']
// Physical activity level on top of BMR. Training sessions are part of it: someone who lifts four
// times a week at a desk job is "moderate", not "sedentary".
export const ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, athlete: 1.9 }
// kcal per gram of each macro (Atwater factors).
export const KCAL_PER_G = { p: 4, c: 4, f: 9 }
// Energy in one kg of body weight change, the usual planning figure.
export const KCAL_PER_KG = 7700
// Thumbnails of photo-logged meals are kept this many days, then dropped from the entry so the
// server's media sweep removes the file (expirePhotos).
export const PHOTO_KEEP_DAYS = 30
// Safety rails for any target, calculated, typed in or proposed by the Coach.
export const LIMITS = { kcalMin: 1200, kcalMax: 6000, pace: { lose: [0.1, 1.0], gain: [0.1, 0.5] }, maxDeficitShare: 0.25 }

const num = v => (v === '' || v == null ? NaN : Number(v))
const finite = v => Number.isFinite(num(v))
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const round = v => Math.round(v)
const round1 = v => Math.round(v * 10) / 10
const ISO = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86400000

/** Days between two ISO dates (b − a), by calendar day whatever the time zone. */
export function daysBetween(a, b) {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / DAY_MS)
}
/** `iso` moved by `n` calendar days. */
export function addDays(iso, n) {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + n * DAY_MS)
  return d.toISOString().slice(0, 10)
}

/* ------------------------------------------------------------------ targets */

/**
 * The intake answers, cleaned: numbers in range or null, choices from their lists. What is
 * missing stays null, and computeTargets() says which fields it still needs.
 */
export function normalizeProfile(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const pick = (v, list, def = null) => (list.includes(v) ? v : def)
  const inRange = (v, lo, hi) => (finite(v) && num(v) >= lo && num(v) <= hi ? round1(num(v)) : null)
  const goal = pick(r.goal, GOALS)
  const paceRange = goal === 'gain' ? LIMITS.pace.gain : LIMITS.pace.lose
  return {
    sex: pick(r.sex, ['male', 'female']),
    age: finite(r.age) && num(r.age) >= 14 && num(r.age) <= 100 ? round(num(r.age)) : null,
    heightCm: inRange(r.heightCm, 100, 250),
    weightKg: inRange(r.weightKg, 30, 350),
    targetKg: inRange(r.targetKg, 30, 350),
    activity: pick(r.activity, Object.keys(ACTIVITY)),
    goal,
    // How fast, in kg per week. Only losing and gaining have one; maintain and recomp hold weight.
    pace: goal === 'lose' || goal === 'gain'
      // Two decimals: 0.25 kg a week is a common choice, and one decimal turned it into 0.3.
      ? (finite(r.pace) ? Math.round(clamp(num(r.pace), paceRange[0], paceRange[1]) * 100) / 100 : (goal === 'gain' ? 0.25 : 0.5))
      : null,
    at: finite(r.at) ? num(r.at) : null
  }
}

const REQUIRED = ['sex', 'age', 'heightCm', 'weightKg', 'activity', 'goal']
/** The intake fields still missing before targets can be calculated. */
export function missingFields(profile) {
  const p = normalizeProfile(profile)
  return REQUIRED.filter(k => p[k] == null)
}

/** Resting energy, Mifflin–St Jeor. */
export function bmr({ sex, weightKg, heightCm, age }) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'female' ? -161 : 5)
}

/**
 * Daily targets from the intake. Returns null while a required answer is missing.
 *
 *   kcal  maintenance (BMR × activity) moved by the goal: a deficit or surplus from the weekly
 *         pace (7700 kcal per kg), never more than 25 % below maintenance, never below the
 *         larger of BMR and 1200 kcal; recomp eats 10 % under maintenance
 *   p     2.0 g per kg of the reference weight (the goal weight when losing towards a lower one,
 *         so a heavier body is not handed an outsized protein figure), 1.8 g when gaining
 *   f     25 % of the energy, at least 0.6 g per kg of the reference weight
 *   c     whatever energy is left, never negative
 */
export function computeTargets(profile) {
  const p = normalizeProfile(profile)
  if (missingFields(p).length) return null
  const rest = bmr(p)
  const tdee = rest * ACTIVITY[p.activity]
  let kcal = tdee
  if (p.goal === 'lose') kcal = tdee - Math.min((p.pace * KCAL_PER_KG) / 7, tdee * LIMITS.maxDeficitShare)
  else if (p.goal === 'gain') kcal = tdee + (p.pace * KCAL_PER_KG) / 7
  else if (p.goal === 'recomp') kcal = tdee * 0.9
  kcal = clamp(kcal, Math.max(rest, LIMITS.kcalMin), LIMITS.kcalMax)
  kcal = Math.round(kcal / 10) * 10

  const ref = p.goal === 'lose' && p.targetKg != null && p.targetKg < p.weightKg ? p.targetKg : p.weightKg
  const prot = round((p.goal === 'gain' ? 1.8 : 2.0) * ref)
  const fat = round(Math.max(kcal * 0.25 / KCAL_PER_G.f, 0.6 * ref))
  const carbs = Math.max(0, round((kcal - prot * KCAL_PER_G.p - fat * KCAL_PER_G.f) / KCAL_PER_G.c))
  return { kcal, p: prot, c: carbs, f: fat, bmr: round(rest), tdee: round(tdee) }
}

/** Energy of a set of macros, in kcal. */
export const macroKcal = ({ p = 0, c = 0, f = 0 } = {}) => (Number(p) || 0) * KCAL_PER_G.p + (Number(c) || 0) * KCAL_PER_G.c + (Number(f) || 0) * KCAL_PER_G.f

/**
 * Targets held to the safety rails, whoever set them: kcal within 1200–6000 and never under the
 * profile's BMR when one is known, each macro a whole number of grams ≥ 0, protein no more than
 * 3.5 g per kg. Returns null for something that is not a target at all.
 */
export function boundTargets(raw, profile) {
  if (!raw || typeof raw !== 'object' || !finite(raw.kcal)) return null
  const p = normalizeProfile(profile)
  const floor = missingFields(p).length ? LIMITS.kcalMin : Math.max(LIMITS.kcalMin, round(bmr(p)))
  const kcal = round(clamp(num(raw.kcal), floor, LIMITS.kcalMax))
  const g = v => (finite(v) && num(v) > 0 ? round(num(v)) : 0)
  let prot = g(raw.p)
  if (p.weightKg) prot = Math.min(prot, round(3.5 * p.weightKg))
  return { kcal, p: prot, c: g(raw.c), f: g(raw.f) }
}

/* ------------------------------------------------------------------ entries */

const MAX_NAME = 80
const cleanName = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)
const grams = v => (finite(v) && num(v) > 0 ? round1(Math.min(num(v), 2000)) : 0)
const energy = v => (finite(v) && num(v) > 0 ? round(Math.min(num(v), 10000)) : 0)

/**
 * A food-log entry rebuilt from its known fields, or null when it is not one: it needs an id, a
 * day and some energy or a name. kcal left empty with macros given is filled from the macros.
 * The photo ref is kept as it is; lib/media-refs.js is the gate for reading it.
 */
export function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object' || raw.id == null || !ISO.test(raw.d || '')) return null
  const e = {
    id: String(raw.id).slice(0, 40),
    d: raw.d,
    meal: MEALS.includes(raw.meal) ? raw.meal : 'snack',
    name: cleanName(raw.name),
    kcal: energy(raw.kcal),
    p: grams(raw.p), c: grams(raw.c), f: grams(raw.f),
    src: SOURCES.includes(raw.src) ? raw.src : 'manual'
  }
  if (!e.kcal && (e.p || e.c || e.f)) e.kcal = round(macroKcal(e))
  if (!e.kcal && !e.name) return null
  if (raw.photo && typeof raw.photo === 'object') e.photo = raw.photo
  if (raw.foodId != null) e.foodId = String(raw.foodId).slice(0, 40)
  if (raw.note) e.note = String(raw.note).slice(0, 200)
  if (finite(raw._ts)) e._ts = num(raw._ts)
  if (raw._f && typeof raw._f === 'object') e._f = raw._f
  return e
}

/** A saved food (one tap to log again), or null. */
export function normalizeFood(raw) {
  if (!raw || typeof raw !== 'object' || raw.id == null) return null
  const name = cleanName(raw.name)
  if (!name) return null
  const f = { id: String(raw.id).slice(0, 40), name, kcal: energy(raw.kcal), p: grams(raw.p), c: grams(raw.c), f: grams(raw.f) }
  if (!f.kcal && (f.p || f.c || f.f)) f.kcal = round(macroKcal(f))
  if (raw.serving) f.serving = String(raw.serving).slice(0, 40)
  if (finite(raw._ts)) f._ts = num(raw._ts)
  if (raw._f && typeof raw._f === 'object') f._f = raw._f
  return f
}

/** An entry for `food`, `qty` servings of it, on `d`. */
export function entryFromFood(food, { id, d, meal, qty = 1 }) {
  const k = finite(qty) && num(qty) > 0 ? num(qty) : 1
  return normalizeEntry({
    id, d, meal, src: 'food', foodId: food.id,
    name: k === 1 ? food.name : `${food.name} ×${round1(k)}`,
    kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k
  })
}

/** Every macro of `x` times `k` (a portion slider on a photo estimate). */
export function scaleMacros(x, k) {
  const m = finite(k) && num(k) > 0 ? num(k) : 1
  return { kcal: round((Number(x.kcal) || 0) * m), p: round1((Number(x.p) || 0) * m), c: round1((Number(x.c) || 0) * m), f: round1((Number(x.f) || 0) * m) }
}

/* ------------------------------------------------------------------ days */

const ZERO = () => ({ kcal: 0, p: 0, c: 0, f: 0, n: 0 })

/** What was eaten on `d`: summed kcal and macros, and how many entries. */
export function dayTotals(foodLog, d) {
  const t = ZERO()
  for (const e of Array.isArray(foodLog) ? foodLog : []) {
    if (!e || e.d !== d) continue
    t.kcal += Number(e.kcal) || 0; t.p += Number(e.p) || 0; t.c += Number(e.c) || 0; t.f += Number(e.f) || 0; t.n++
  }
  return { kcal: round(t.kcal), p: round1(t.p), c: round1(t.c), f: round1(t.f), n: t.n }
}

/**
 * What is left of each target after `totals` (negative once over), and how far along each is
 * as a share of its target (0..∞; null when there is no target for it).
 */
export function remaining(targets, totals) {
  const out = { left: {}, share: {} }
  for (const k of ['kcal', 'p', 'c', 'f']) {
    const goal = Number(targets?.[k]) || 0
    const had = Number(totals?.[k]) || 0
    out.left[k] = k === 'kcal' ? round(goal - had) : round1(goal - had)
    out.share[k] = goal > 0 ? had / goal : null
  }
  return out
}

/** The entries of `d` grouped by meal, in meal order, each list oldest first. */
export function byMeal(foodLog, d) {
  const out = Object.fromEntries(MEALS.map(m => [m, []]))
  for (const e of Array.isArray(foodLog) ? foodLog : []) if (e && e.d === d) out[MEALS.includes(e.meal) ? e.meal : 'snack'].push(e)
  for (const m of MEALS) out[m].sort((a, b) => (Number(a._ts) || 0) - (Number(b._ts) || 0))
  return out
}

/** A meal label for a time of day, for a new entry's default. */
export function mealFor(hour) {
  if (hour < 10.5) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour >= 17.5 && hour < 22) return 'dinner'
  return 'snack'
}

/**
 * One row per day from `from` to `to` (inclusive): the day's totals, `logged` false on a day with
 * no entries. For the Stats charts and the Coach's history.
 */
export function dailySeries(foodLog, from, to) {
  const by = new Map()
  for (const e of Array.isArray(foodLog) ? foodLog : []) {
    if (!e || !ISO.test(e.d || '') || e.d < from || e.d > to) continue
    if (!by.has(e.d)) by.set(e.d, [])
    by.get(e.d).push(e)
  }
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const t = dayTotals(by.get(d) || [], d)
    out.push({ d, kcal: t.kcal, p: t.p, c: t.c, f: t.f, logged: t.n > 0 })
    if (out.length > 3660) break
  }
  return out
}

/** The days the log covers, newest first, each with its totals: the history list. */
export function loggedDays(foodLog) {
  const days = [...new Set((Array.isArray(foodLog) ? foodLog : []).filter(e => e && ISO.test(e.d || '')).map(e => e.d))].sort().reverse()
  return days.map(d => ({ d, ...dayTotals(foodLog, d) }))
}

/* ------------------------------------------------------------------ history */

/**
 * Body-weight trend in kg per week over the last `days` before `today`: the least-squares slope
 * of the weigh-ins (one day's single weigh-in moves with water and salt, a slope does not). null
 * with fewer than 4 weigh-ins or less than 14 days between the first and last.
 * `bodyweight` is the store's list ({ d, w } in `unit`).
 */
export function weightTrend(bodyweight, today, { days = 28, unit = 'kg' } = {}) {
  const from = addDays(today, -days)
  const pts = (Array.isArray(bodyweight) ? bodyweight : [])
    .filter(b => b && ISO.test(b.d || '') && b.d > from && b.d <= today && Number(b.w) > 0)
    .map(b => ({ x: daysBetween(from, b.d), y: unit === 'lb' ? Number(b.w) * 0.45359237 : Number(b.w) }))
  if (pts.length < 4) return null
  const xs = pts.map(p => p.x)
  if (Math.max(...xs) - Math.min(...xs) < 14) return null
  const mx = xs.reduce((a, b) => a + b, 0) / pts.length
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length
  let sxy = 0, sxx = 0
  for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2 }
  return sxx ? Math.round((sxy / sxx) * 7 * 100) / 100 : null
}

/**
 * A suggested change to the calorie target from what actually happened, or null. Needs 14 or more
 * logged days in the last 21 (so the weight trend is about the logged intake) and a weight trend.
 *
 *   lose:  losing under half the planned pace → −150 kcal; over 1.5 × the pace → +150 kcal
 *   gain:  gaining under half the planned pace → +150 kcal; over 1.5 × the pace → −150 kcal
 *   maintain / recomp: drifting more than 0.25 kg a week → 150 kcal against the drift
 *
 * The new figure still passes boundTargets(), and the grams of carbs absorb the change so protein
 * and fat stay where they were.
 */
export function suggestAdjustment({ targets, profile, bodyweight, foodLog, today, unit = 'kg' }) {
  if (!targets || !finite(targets.kcal)) return null
  const p = normalizeProfile(profile)
  if (!p.goal) return null
  const from = addDays(today, -21)
  const logged = new Set((Array.isArray(foodLog) ? foodLog : []).filter(e => e && e.d > from && e.d <= today).map(e => e.d))
  if (logged.size < 14) return null
  const trend = weightTrend(bodyweight, today, { days: 28, unit })
  if (trend == null) return null
  let delta = 0, reason = null
  const planned = p.pace || 0
  if (p.goal === 'lose') {
    if (-trend < planned * 0.5) { delta = -150; reason = 'slow' }
    else if (-trend > planned * 1.5) { delta = 150; reason = 'fast' }
  } else if (p.goal === 'gain') {
    if (trend < planned * 0.5) { delta = 150; reason = 'slow' }
    else if (trend > planned * 1.5) { delta = -150; reason = 'fast' }
  } else if (Math.abs(trend) > 0.25) {
    delta = trend > 0 ? -150 : 150; reason = 'drift'
  }
  if (!delta) return null
  const next = boundTargets({ ...targets, kcal: targets.kcal + delta, c: Math.max(0, (Number(targets.c) || 0) + delta / KCAL_PER_G.c) }, p)
  if (!next || next.kcal === round(targets.kcal)) return null
  return { targets: next, delta: next.kcal - round(targets.kcal), trend, reason, days: logged.size }
}

/* ------------------------------------------------------------------ photos */

/**
 * The log with every photo older than `keep` days dropped from its entry, or the same array when
 * there is nothing to drop. Dropping the ref is what frees the file: the server's media sweep
 * removes a blob no state refers to any more (api/media.js referencedHashes).
 */
export function expirePhotos(foodLog, today, keep = PHOTO_KEEP_DAYS) {
  if (!Array.isArray(foodLog)) return foodLog
  const cutoff = addDays(today, -keep)
  let changed = false
  const out = foodLog.map(e => {
    if (!e || !e.photo || !(e.d < cutoff)) return e
    changed = true
    const { photo, ...rest } = e
    return rest
  })
  return changed ? out : foodLog
}

/* ------------------------------------------------------------------ the whole state */

/** The nutrition fields of a loaded state, cleaned in place (old profiles simply have none). */
export function normalizeNutritionState(S) {
  if (!S || typeof S !== 'object') return S
  S.foodLog = (Array.isArray(S.foodLog) ? S.foodLog : []).map(normalizeEntry).filter(Boolean)
  S.foods = (Array.isArray(S.foods) ? S.foods : []).map(normalizeFood).filter(Boolean)
  S.nutProfile = S.nutProfile && typeof S.nutProfile === 'object' ? normalizeProfile(S.nutProfile) : null
  const t = boundTargets(S.nutTargets, S.nutProfile)
  S.nutTargets = t ? { ...t, source: ['calc', 'manual', 'coach'].includes(S.nutTargets?.source) ? S.nutTargets.source : 'manual', at: finite(S.nutTargets?.at) ? num(S.nutTargets.at) : null } : null
  return S
}
