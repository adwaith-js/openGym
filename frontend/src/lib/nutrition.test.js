import { describe, expect, it } from 'vitest'
import {
  addDays, daysBetween, normalizeProfile, missingFields, bmr, computeTargets, boundTargets, macroKcal,
  normalizeEntry, normalizeFood, entryFromFood, scaleMacros, dayTotals, remaining, byMeal, mealFor,
  dailySeries, loggedDays, weightTrend, suggestAdjustment, expirePhotos, normalizeNutritionState, LIMITS,
  trainingPerWeek, suggestActivity
} from './nutrition.js'

const PROFILE = { sex: 'male', age: 27, heightCm: 174, weightKg: 95, targetKg: 80, activity: 'moderate', goal: 'lose', pace: 0.5 }

describe('dates', () => {
  it('counts and moves calendar days across months and years', () => {
    expect(daysBetween('2026-10-01', '2026-10-19')).toBe(18)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-10-19', 30)).toBe('2026-11-18')
  })
})

describe('the intake', () => {
  it('keeps answers in range and drops the rest', () => {
    const p = normalizeProfile({ sex: 'robot', age: 7, heightCm: '174', weightKg: 95.04, activity: 'couch', goal: 'lose', pace: 3 })
    expect(p.sex).toBe(null)
    expect(p.age).toBe(null)
    expect(p.heightCm).toBe(174)
    expect(p.weightKg).toBe(95)
    expect(p.activity).toBe(null)
    expect(p.pace).toBe(LIMITS.pace.lose[1])
    expect(missingFields(p)).toEqual(['sex', 'age', 'activity'])
  })
  it('gives losing and gaining a default pace, and the others none', () => {
    expect(normalizeProfile({ goal: 'lose' }).pace).toBe(0.5)
    expect(normalizeProfile({ goal: 'gain' }).pace).toBe(0.25)
    expect(normalizeProfile({ goal: 'gain', pace: 2 }).pace).toBe(0.5)
    expect(normalizeProfile({ goal: 'recomp', pace: 0.5 }).pace).toBe(null)
  })
  it('reads a missing profile as an empty one', () => {
    expect(missingFields(null)).toEqual(['sex', 'age', 'heightCm', 'weightKg', 'activity', 'goal'])
  })
})

describe('computeTargets', () => {
  it('is Mifflin–St Jeor for resting energy', () => {
    expect(bmr({ sex: 'male', weightKg: 95, heightCm: 174, age: 27 })).toBeCloseTo(1907.5)
    expect(bmr({ sex: 'female', weightKg: 60, heightCm: 165, age: 30 })).toBeCloseTo(1320.25)
  })
  it('takes the weekly pace off maintenance and sets protein from the goal weight', () => {
    const t = computeTargets(PROFILE)
    // 1907.5 × 1.55 = 2956.6, − 550 (0.5 kg × 7700 / 7) = 2406.6 → 2410
    expect(t).toMatchObject({ kcal: 2410, p: 160, f: 67, bmr: 1908, tdee: 2957 })
    expect(t.c).toBe(292)
    // the macros add up to the energy, within rounding
    expect(Math.abs(macroKcal(t) - t.kcal)).toBeLessThan(10)
  })
  it('never cuts more than a quarter of maintenance, nor below BMR or 1200', () => {
    const fast = computeTargets({ ...PROFILE, activity: 'sedentary', pace: 1.0 })
    // 2289 maintenance: 1100 a day would be 48 %; held at BMR (the larger floor here)
    expect(fast.kcal).toBe(1910)
    const small = computeTargets({ sex: 'female', age: 60, heightCm: 150, weightKg: 45, activity: 'sedentary', goal: 'lose', pace: 1 })
    expect(small.kcal).toBe(1200)
  })
  it('adds a surplus for gaining, trims 10 % for recomp, holds for maintain', () => {
    const base = { ...PROFILE, targetKg: null }
    const maintain = computeTargets({ ...base, goal: 'maintain' })
    expect(maintain.kcal).toBe(2960)
    expect(computeTargets({ ...base, goal: 'gain', pace: 0.25 }).kcal).toBe(3230)
    expect(computeTargets({ ...base, goal: 'recomp' }).kcal).toBe(2660)
    expect(computeTargets({ ...base, goal: 'gain', pace: 0.25 }).p).toBe(171)
  })
  it('uses current weight for protein when the goal weight is not lower', () => {
    expect(computeTargets({ ...PROFILE, targetKg: 100 }).p).toBe(190)
    expect(computeTargets({ ...PROFILE, targetKg: null }).p).toBe(190)
  })
  it('returns null until every required answer is in', () => {
    expect(computeTargets({ ...PROFILE, age: null })).toBe(null)
  })
  it('never hands out negative carbs', () => {
    const t = computeTargets({ sex: 'female', age: 70, heightCm: 150, weightKg: 120, targetKg: 119, activity: 'sedentary', goal: 'lose', pace: 1 })
    expect(t.c).toBeGreaterThanOrEqual(0)
  })
})

describe('boundTargets', () => {
  it('holds any target to the rails', () => {
    expect(boundTargets({ kcal: 800, p: 400, c: -5, f: '60' }, PROFILE)).toEqual({ kcal: 1908, p: 333, c: 0, f: 60 })
    expect(boundTargets({ kcal: 9000, p: 150 }, null)).toEqual({ kcal: 6000, p: 150, c: 0, f: 0 })
    expect(boundTargets({ kcal: 900 }, null).kcal).toBe(1200)
  })
  it('refuses what is not a target', () => {
    expect(boundTargets(null)).toBe(null)
    expect(boundTargets({ p: 100 })).toBe(null)
    expect(boundTargets({ kcal: 'lots' })).toBe(null)
  })
})

describe('entries and foods', () => {
  it('rebuilds an entry from its known fields', () => {
    const e = normalizeEntry({ id: 1, d: '2026-10-19', meal: 'brunch', name: '  Chicken   rice ', kcal: '650.4', p: 30.04, c: -1, f: 18, src: 'photo', junk: true, _ts: 5 })
    expect(e).toEqual({ id: '1', d: '2026-10-19', meal: 'snack', name: 'Chicken rice', kcal: 650, p: 30, c: 0, f: 18, src: 'photo', _ts: 5 })
  })
  it('fills energy from the macros when only those were given', () => {
    expect(normalizeEntry({ id: 'a', d: '2026-10-19', p: 25, c: 10, f: 5 }).kcal).toBe(185)
  })
  it('refuses an entry with no day, no id, or nothing in it', () => {
    expect(normalizeEntry({ id: 'a', d: '19/10/2026', kcal: 100 })).toBe(null)
    expect(normalizeEntry({ d: '2026-10-19', kcal: 100 })).toBe(null)
    expect(normalizeEntry({ id: 'a', d: '2026-10-19' })).toBe(null)
  })
  it('keeps a quick-add with calories only', () => {
    expect(normalizeEntry({ id: 'q', d: '2026-10-19', kcal: 300, src: 'quick' })).toMatchObject({ kcal: 300, p: 0, name: '', src: 'quick' })
  })
  it('keeps the photo ref and the saved food it came from', () => {
    const photo = { kind: 'image', hash: 'a'.repeat(64) }
    expect(normalizeEntry({ id: 'p', d: '2026-10-19', kcal: 1, photo, foodId: 'f1' })).toMatchObject({ photo, foodId: 'f1' })
  })
  it('saves foods with a name only', () => {
    expect(normalizeFood({ id: 'f', name: '', kcal: 100 })).toBe(null)
    expect(normalizeFood({ id: 'f', name: 'Whey', p: 24, c: 3, f: 2, serving: '1 scoop' })).toEqual({ id: 'f', name: 'Whey', kcal: 126, p: 24, c: 3, f: 2, serving: '1 scoop' })
  })
  it('logs a saved food by the serving', () => {
    const food = { id: 'f', name: 'Oats', kcal: 150, p: 5, c: 27, f: 3 }
    expect(entryFromFood(food, { id: 'e', d: '2026-10-19', meal: 'breakfast', qty: 2 })).toMatchObject({ name: 'Oats ×2', kcal: 300, p: 10, c: 54, f: 6, foodId: 'f', src: 'food' })
    expect(entryFromFood(food, { id: 'e', d: '2026-10-19', meal: 'breakfast' }).name).toBe('Oats')
  })
  it('scales a portion', () => {
    expect(scaleMacros({ kcal: 600, p: 30, c: 70, f: 20 }, 1.5)).toEqual({ kcal: 900, p: 45, c: 105, f: 30 })
    expect(scaleMacros({ kcal: 600 }, 0)).toEqual({ kcal: 600, p: 0, c: 0, f: 0 })
  })
})

const LOG = [
  { id: '1', d: '2026-10-19', meal: 'breakfast', name: 'Oats', kcal: 300, p: 10, c: 54, f: 6, _ts: 2 },
  { id: '2', d: '2026-10-19', meal: 'lunch', name: 'Chicken rice', kcal: 650, p: 30, c: 85, f: 18, _ts: 3 },
  { id: '3', d: '2026-10-19', meal: 'breakfast', name: 'Coffee', kcal: 40, p: 2, c: 4, f: 2, _ts: 1 },
  { id: '4', d: '2026-10-18', meal: 'dinner', name: 'Steak', kcal: 700, p: 60, c: 0, f: 50 }
]

describe('a day', () => {
  it('adds up what was eaten', () => {
    expect(dayTotals(LOG, '2026-10-19')).toEqual({ kcal: 990, p: 42, c: 143, f: 26, n: 3 })
    expect(dayTotals(LOG, '2026-10-17')).toEqual({ kcal: 0, p: 0, c: 0, f: 0, n: 0 })
    expect(dayTotals(null, '2026-10-17').n).toBe(0)
  })
  it('says what is left, and goes negative once over', () => {
    const r = remaining({ kcal: 2410, p: 160, c: 292, f: 67 }, dayTotals(LOG, '2026-10-19'))
    expect(r.left).toEqual({ kcal: 1420, p: 118, c: 149, f: 41 })
    expect(r.share.p).toBeCloseTo(42 / 160)
    expect(remaining({ kcal: 500 }, { kcal: 990 }).left.kcal).toBe(-490)
    expect(remaining(null, { kcal: 10 }).share.kcal).toBe(null)
  })
  it('groups by meal, oldest first', () => {
    const m = byMeal(LOG, '2026-10-19')
    expect(m.breakfast.map(e => e.id)).toEqual(['3', '1'])
    expect(m.lunch.map(e => e.id)).toEqual(['2'])
    expect(m.dinner).toEqual([])
  })
  it('picks a meal from the time of day', () => {
    expect(mealFor(7)).toBe('breakfast')
    expect(mealFor(12.5)).toBe('lunch')
    expect(mealFor(16)).toBe('snack')
    expect(mealFor(19)).toBe('dinner')
    expect(mealFor(23)).toBe('snack')
  })
})

describe('history', () => {
  it('has a row for every day, logged or not', () => {
    const s = dailySeries(LOG, '2026-10-17', '2026-10-19')
    expect(s.map(r => [r.d, r.kcal, r.logged])).toEqual([['2026-10-17', 0, false], ['2026-10-18', 700, true], ['2026-10-19', 990, true]])
  })
  it('lists the logged days newest first', () => {
    expect(loggedDays(LOG).map(r => [r.d, r.kcal])).toEqual([['2026-10-19', 990], ['2026-10-18', 700]])
  })

  const weighIns = (perWeek, n = 8, start = 95) =>
    Array.from({ length: n }, (_, i) => ({ d: addDays('2026-10-19', -3 * (n - 1 - i)), w: start + (perWeek / 7) * 3 * i }))

  it('reads the weight trend as kg a week', () => {
    expect(weightTrend(weighIns(-0.5), '2026-10-19')).toBeCloseTo(-0.5, 2)
    expect(weightTrend(weighIns(-0.5).map(b => ({ ...b, w: b.w / 0.45359237 })), '2026-10-19', { unit: 'lb' })).toBeCloseTo(-0.5, 2)
  })
  it('has no trend from too few weigh-ins or too short a span', () => {
    expect(weightTrend(weighIns(-0.5, 3), '2026-10-19')).toBe(null)
    expect(weightTrend([0, 1, 2, 3, 4].map(i => ({ d: addDays('2026-10-19', -i), w: 95 })), '2026-10-19')).toBe(null)
  })

  const logDays = n => Array.from({ length: n }, (_, i) => ({ id: 'x' + i, d: addDays('2026-10-19', -i), kcal: 2400 }))
  const T = { kcal: 2410, p: 160, c: 292, f: 67 }

  it('suggests eating less when the loss is under half the pace', () => {
    const s = suggestAdjustment({ targets: T, profile: PROFILE, bodyweight: weighIns(-0.1), foodLog: logDays(16), today: '2026-10-19' })
    expect(s).toMatchObject({ delta: -150, reason: 'slow', days: 16 })
    expect(s.targets).toMatchObject({ kcal: 2260, p: 160, f: 67, c: 255 })
  })
  it('suggests eating more when losing too fast', () => {
    expect(suggestAdjustment({ targets: T, profile: PROFILE, bodyweight: weighIns(-1.0), foodLog: logDays(16), today: '2026-10-19' }).delta).toBe(150)
  })
  it('suggests nothing on pace, with too few logged days, or without a trend', () => {
    expect(suggestAdjustment({ targets: T, profile: PROFILE, bodyweight: weighIns(-0.5), foodLog: logDays(16), today: '2026-10-19' })).toBe(null)
    expect(suggestAdjustment({ targets: T, profile: PROFILE, bodyweight: weighIns(-0.1), foodLog: logDays(10), today: '2026-10-19' })).toBe(null)
    expect(suggestAdjustment({ targets: T, profile: PROFILE, bodyweight: [], foodLog: logDays(16), today: '2026-10-19' })).toBe(null)
  })
  it('pushes against drift when maintaining', () => {
    const s = suggestAdjustment({ targets: T, profile: { ...PROFILE, goal: 'maintain' }, bodyweight: weighIns(0.5), foodLog: logDays(16), today: '2026-10-19' })
    expect(s).toMatchObject({ delta: -150, reason: 'drift' })
  })
  it('never suggests going under the floor', () => {
    const low = { kcal: 1950, p: 160, c: 150, f: 60 }
    const s = suggestAdjustment({ targets: low, profile: PROFILE, bodyweight: weighIns(-0.1), foodLog: logDays(16), today: '2026-10-19' })
    expect(s.targets.kcal).toBe(1908)
    expect(suggestAdjustment({ targets: { ...low, kcal: 1908 }, profile: PROFILE, bodyweight: weighIns(-0.1), foodLog: logDays(16), today: '2026-10-19' })).toBe(null)
  })
})

describe('expirePhotos', () => {
  const photo = { kind: 'image', hash: 'a'.repeat(64) }
  it('drops photos older than the keep window and nothing else', () => {
    const log = [{ id: 'old', d: '2026-09-18', kcal: 1, photo }, { id: 'edge', d: '2026-09-19', kcal: 1, photo }, { id: 'new', d: '2026-10-19', kcal: 1, photo }]
    const out = expirePhotos(log, '2026-10-19')
    expect(out.find(e => e.id === 'old')).toEqual({ id: 'old', d: '2026-09-18', kcal: 1 })
    expect(out.find(e => e.id === 'edge').photo).toBe(photo)
    expect(out.find(e => e.id === 'new').photo).toBe(photo)
  })
  it('returns the same list when there is nothing to drop', () => {
    const log = [{ id: 'new', d: '2026-10-19', kcal: 1, photo }]
    expect(expirePhotos(log, '2026-10-19')).toBe(log)
  })
})

describe('an old profile, or an old backup', () => {
  it('loads with empty nutrition and no targets', () => {
    const S = normalizeNutritionState({ unit: 'kg', workouts: [] })
    expect(S).toMatchObject({ foodLog: [], foods: [], nutProfile: null, nutTargets: null })
  })
  it('cleans what a hand-edited or newer file holds', () => {
    const S = normalizeNutritionState({
      foodLog: [{ id: 'a', d: '2026-10-19', kcal: 100 }, { bad: true }, null],
      foods: [{ id: 'f', name: 'Whey', p: 24 }, { id: 'g' }],
      nutProfile: PROFILE,
      nutTargets: { kcal: 100, p: 150, source: 'robot', at: 7 }
    })
    expect(S.foodLog.map(e => e.id)).toEqual(['a'])
    expect(S.foods.map(f => f.id)).toEqual(['f'])
    expect(S.nutTargets).toEqual({ kcal: 1908, p: 150, c: 0, f: 0, source: 'manual', at: 7 })
  })
})

describe('the training log', () => {
  it('counts training days a week, a day with two sessions once', () => {
    const w = d => ({ id: d, d })
    const log = [w('2026-10-19'), w('2026-10-19'), w('2026-10-17'), w('2026-10-15'), w('2026-10-12'), w('2026-10-08'), w('2026-10-05'), w('2026-09-30'), w('2026-09-20')]
    expect(trainingPerWeek(log, '2026-10-19')).toBe(1.8)
    expect(trainingPerWeek([], '2026-10-19')).toBe(0)
  })
  it('turns that into a starting activity level', () => {
    expect(suggestActivity(0)).toBe('sedentary')
    expect(suggestActivity(2)).toBe('light')
    expect(suggestActivity(4)).toBe('moderate')
    expect(suggestActivity(4, { activeJob: true })).toBe('high')
    expect(suggestActivity(7, { activeJob: true })).toBe('athlete')
  })
})
