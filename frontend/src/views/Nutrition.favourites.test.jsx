// @vitest-environment happy-dom
// Favourites: Add food opens on them, a meal logged earlier and never saved can be starred from
// "Recently logged", and a favourite logs again through the servings sheet.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { addFoodSheet, toggleFavourite, photoMealFlow } from './Nutrition.jsx'
import { todayISO } from '../lib/format.js'

const clone = v => JSON.parse(JSON.stringify(v))
const mounted = []

// Renders the sheet on top of the stack, as the app's sheet host would.
function mountTopSheet() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const text = host => host.textContent

let toast
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  toast = vi.fn()
  useUI.setState({ sheets: [], toast })
  const S = clone(DEF)
  const d = todayISO()
  S.foods = [{ id: 'f1', name: 'Overnight oats', kcal: 420, p: 30, c: 55, f: 9 }]
  // An AI-logged meal that was never saved, and one from the favourite.
  S.foodLog = [
    { id: 'e1', d, meal: 'lunch', name: 'Chicken rice', kcal: 580, p: 38, c: 70, f: 14, src: 'photo' },
    { id: 'e2', d, meal: 'breakfast', name: 'Overnight oats', kcal: 420, p: 30, c: 55, f: 9, src: 'food', foodId: 'f1' }
  ]
  useStore.setState({ S })
})
afterEach(() => { act(() => mounted.splice(0).forEach(r => r.unmount())); document.body.innerHTML = '' })

describe('Add food → Favourites', () => {
  it('opens on the favourites, with the unsaved meal under Recently logged', () => {
    act(() => { addFoodSheet() })
    const host = mountTopSheet()
    expect(text(host)).toContain('Favourites')
    expect(text(host)).toContain('Overnight oats')
    expect(text(host)).toContain('Recently logged')
    expect(text(host)).toContain('Chicken rice')
  })

  it('starring a past meal makes it a favourite with what was logged', () => {
    act(() => { toggleFavourite(useStore.getState().S.foodLog[0]) })
    const foods = useStore.getState().S.foods
    expect(foods.map(f => f.name)).toEqual(['Overnight oats', 'Chicken rice'])
    expect(foods[1]).toMatchObject({ kcal: 580, p: 38, c: 70, f: 14 })
    act(() => { toggleFavourite(useStore.getState().S.foodLog[0]) })
    expect(useStore.getState().S.foods.map(f => f.name)).toEqual(['Overnight oats'])
  })

  it('tapping a favourite opens its servings, and Log adds it to the day', () => {
    act(() => { addFoodSheet() })
    const host = mountTopSheet()
    const row = [...host.querySelectorAll('.nut-entry')].find(r => r.textContent.includes('Overnight oats'))
    act(() => { row.click() })
    const portion = mountTopSheet()
    const log = [...portion.querySelectorAll('button')].find(b => b.textContent.trim() === 'Log')
    act(() => { log.click() })
    const log2 = useStore.getState().S.foodLog
    expect(log2).toHaveLength(3)
    expect(log2[2]).toMatchObject({ name: 'Overnight oats', foodId: 'f1', kcal: 420 })
  })

  it('with no favourites it opens on By hand', () => {
    useStore.setState({ S: { ...useStore.getState().S, foods: [] } })
    act(() => { addFoodSheet() })
    const host = mountTopSheet()
    expect(host.querySelector('textarea, input')).toBeTruthy()
    expect(text(host)).not.toContain('Recently logged')
  })
})

describe('AI log', () => {
  it('offers the favourites, and takes several photos from the library', () => {
    useStore.setState({ S: { ...useStore.getState().S, nutConsent: { agreedAt: '2026-10-20T00:00:00Z', version: 1 } } })
    act(() => { photoMealFlow(todayISO()) })
    const host = mountTopSheet()
    const fav = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Favourites')
    expect(fav).toBeTruthy()
    expect(host.querySelector('input[type=file][multiple]')).toBeTruthy()
    act(() => { fav.click() })
    // The AI log closes and Add food opens on the favourites.
    const next = mountTopSheet()
    expect(next.textContent).toContain('Overnight oats')
    expect(next.textContent).toContain('Recently logged')
  })
})
