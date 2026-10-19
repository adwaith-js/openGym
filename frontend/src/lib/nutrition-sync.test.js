// @vitest-environment happy-dom
/* The food log and saved foods across devices (lib/sync-merge.js, api/sync-stamps.js): logged
   offline on two phones, edited on one and removed on the other, wiped by a reset, sent back by an
   app from before nutrition existed, and restored from a backup that has none. */
import { describe, expect, it } from 'vitest'
import * as Server from '../../../api/sync-stamps.js'
import { mergeStates, stampChange, resetIdsOf, sinceReset } from './sync-merge.js'
import { restoredStateFor, DEF } from '../store/useStore.js'
import { normalizeNutritionState } from './nutrition.js'

const clone = v => JSON.parse(JSON.stringify(v))
const T = 1_800_000_000_000
// One change on one device, stamped the way the store stamps every change (useStore update).
const change = (prev, wall, mut) => { const n = clone(prev); mut(n); n._ts = stampChange(prev, n, wall); return n }
const meal = (id, extra = {}) => ({ id, d: '2026-10-19', meal: 'lunch', name: 'Chicken rice', kcal: 650, p: 30, c: 85, f: 18, src: 'manual', ...extra })
const base = () => ({ _ts: T, unit: 'kg', workouts: [], routines: [], foodLog: [meal('a')], foods: [{ id: 'f1', name: 'Whey', kcal: 120, p: 24, c: 3, f: 2 }] })

describe('the food log across devices', () => {
  it('keeps what both phones logged offline', () => {
    const cur = base()
    const phone = change(cur, T + 1000, S => { S.foodLog.push(meal('b', { meal: 'dinner' })) })
    const desk = change(cur, T + 2000, S => { S.foodLog.push(meal('c', { meal: 'snack', kcal: 200 })) })
    const m = mergeStates(phone, desk)
    expect(m.foodLog.map(e => e.id).sort()).toEqual(['a', 'b', 'c'])
    expect(mergeStates(desk, phone).foodLog.map(e => e.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('keeps an entry removed on one phone removed, whatever the other still holds', () => {
    const cur = base()
    const gone = change(cur, T + 1000, S => { S.foodLog = [] })
    const stale = change(cur, T + 5000, S => { S.restSec = 60 })   // newer copy, unrelated change
    expect(mergeStates(stale, gone).foodLog).toEqual([])
    expect(mergeStates(gone, stale).foodLog).toEqual([])
    expect(gone.deleted.foodLog.a).toBeGreaterThan(T)
  })

  it('keeps an edit made after the removal', () => {
    const cur = base()
    const gone = change(cur, T + 1000, S => { S.foodLog = [] })
    const edited = change(cur, T + 2000, S => { S.foodLog[0].kcal = 700 })
    expect(mergeStates(gone, edited).foodLog.map(e => e.kcal)).toEqual([700])
  })

  it('merges two edits of the same entry field by field', () => {
    const cur = base()
    const a = change(cur, T + 1000, S => { S.foodLog[0].kcal = 720 })
    const b = change(cur, T + 2000, S => { S.foodLog[0].meal = 'dinner' })
    for (const m of [mergeStates(a, b), mergeStates(b, a)]) {
      expect(m.foodLog[0]).toMatchObject({ id: 'a', kcal: 720, meal: 'dinner' })
    }
  })

  it('treats saved foods the same way', () => {
    const cur = base()
    const a = change(cur, T + 1000, S => { S.foods.push({ id: 'f2', name: 'Oats', kcal: 150 }) })
    const b = change(cur, T + 2000, S => { S.foods = [] })
    const m = mergeStates(a, b)
    expect(m.foods.map(f => f.id)).toEqual(['f2'])
  })

  it('a reset takes the log and the saved foods with it', () => {
    const cur = base()
    const ids = resetIdsOf(cur)
    expect(ids.foodLog).toEqual(['a'])
    expect(ids.foods).toEqual(['f1'])
    const later = change(cur, T + 9000, S => { S.foodLog.push(meal('new')) })
    const kept = sinceReset(later, T + 5000, ids)
    expect(kept.foodLog.map(e => e.id)).toEqual(['new'])
    expect(kept.foods).toEqual([])
  })

  it('targets are a setting: the one set last wins', () => {
    const cur = { ...base(), nutTargets: { kcal: 2400, p: 160, c: 290, f: 67, source: 'calc', at: T } }
    const a = change(cur, T + 1000, S => { S.nutTargets = { ...S.nutTargets, kcal: 2250, source: 'manual' } })
    const b = change(cur, T + 5000, S => { S.foodLog.push(meal('b')) })
    expect(mergeStates(b, a).nutTargets.kcal).toBe(2250)
    expect(mergeStates(a, b).nutTargets.kcal).toBe(2250)
  })
})

describe('the server', () => {
  it('keeps the food log when an app from before nutrition pushes', () => {
    const cur = { ...base(), edited: { restSec: T } }
    const old = clone(cur)
    delete old.foodLog; delete old.foods; delete old.edited
    old.restSec = 120
    old._ts = T + 5000
    Server.stampPut(cur, old, { overRead: true, now: T + 5000 })
    expect(old.foodLog.map(e => e.id)).toEqual(['a'])
    expect(old.foods.map(f => f.id)).toEqual(['f1'])
  })
  it('stamps a removal an unstamped writer made', () => {
    const cur = base()
    const next = clone(cur)
    next.foodLog = []
    next._ts = T + 5000
    Server.stampPut(cur, next, { overRead: true, now: T + 5000 })
    expect(next.deleted.foodLog.a).toBeGreaterThan(0)
  })
})

describe('an old profile or backup', () => {
  it('loads with an empty log and no targets', () => {
    const remote = { _ts: T, unit: 'kg', workouts: [{ id: 'w', d: '2026-10-01' }] }
    const S = restoredStateFor({ ...clone(DEF), _ts: 0 }, remote)
    expect(S.foodLog).toEqual([])
    expect(S.foods).toEqual([])
    expect(S.nutTargets).toBe(null)
    expect(S.nutProfile).toBe(null)
  })
})

describe('the JSON backup', () => {
  // Settings.jsx doExport writes the whole state; an import overlays it on DEF (store replaceState).
  const exportBackup = S => JSON.stringify(S, null, 2)
  const importBackup = json => normalizeNutritionState(Object.assign(clone(DEF), JSON.parse(json)))
  it('carries the log, saved foods, intake and targets through export and import unchanged', () => {
    const before = normalizeNutritionState(Object.assign(clone(DEF), {
      ...base(),
      nutProfile: { sex: 'male', age: 27, heightCm: 174, weightKg: 95, targetKg: 80, activity: 'moderate', goal: 'lose', pace: 0.5, at: T },
      nutTargets: { kcal: 2410, p: 160, c: 292, f: 67, source: 'calc', at: T }
    }))
    const after = importBackup(exportBackup(before))
    for (const k of ['foodLog', 'foods', 'nutProfile', 'nutTargets']) expect(after[k]).toEqual(before[k])
  })
  it('imports a backup from before nutrition with nothing logged', () => {
    const after = importBackup(JSON.stringify({ unit: 'kg', workouts: [], bodyweight: [{ d: '2026-10-01', w: 95, t: T }] }))
    expect(after).toMatchObject({ foodLog: [], foods: [], nutProfile: null, nutTargets: null })
    expect(after.bodyweight).toHaveLength(1)
  })
})
