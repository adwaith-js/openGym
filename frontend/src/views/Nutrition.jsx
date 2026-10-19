// One day of food: what is left of the targets, the meals logged, a suggestion from history, and
// the days before. The sheets that log food live here too, so Home's card opens the same ones.
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import {
  MEALS, normalizeEntry, normalizeFood, entryFromFood, dayTotals, remaining, byMeal, mealFor,
  loggedDays, suggestAdjustment, boundTargets, addDays, macroKcal
} from '../lib/nutrition.js'
import { fmtDate, todayISO, uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField, Segmented, Stepper, Switch, TextField, SearchField } from '../components/ui.jsx'
import { MacroBars, fmtInt, fmtG } from '../components/MacroBars.jsx'
import { confirmSheet } from '../sheets.jsx'
import { photoMealFlow, photoLoggingAvailable, MealThumb } from './MealPhoto.jsx'
export { photoMealFlow, photoLoggingAvailable }
import '../nutrition.css'

const update = (fn, ...rest) => useStore.getState().update(fn, ...rest)
const toast = message => useUI.getState().toast(message)
const openSheet = render => useUI.getState().openSheet(render)

// Through literal t() calls, so the string checker sees every key.
export const mealLabel = m => ({ breakfast: t('Breakfast'), lunch: t('Lunch'), dinner: t('Dinner'), snack: t('Snack') })[m] || m
const mealOptions = () => MEALS.map(m => ({ value: m, label: mealLabel(m) }))
const nowMeal = () => { const d = new Date(); return mealFor(d.getHours() + d.getMinutes() / 60) }
export const macroLine = e => `${t('P')} ${fmtG(e.p)} · ${t('C')} ${fmtG(e.c)} · ${t('F')} ${fmtG(e.f)}`

/* ------------------------------------------------------------------ sheets */

/** Add or edit one entry by hand. `entry` edits it; `food` starts from a saved food. */
function EntryEditor({ d, entry, meal, close }) {
  const [name, setName] = useState(entry?.name || '')
  const [m, setM] = useState(entry?.meal || meal || nowMeal())
  const [v, setV] = useState({ kcal: entry?.kcal || null, p: entry?.p || null, c: entry?.c || null, f: entry?.f || null })
  const [save, setSave] = useState(false)
  const fromMacros = Math.round(macroKcal(v))
  const set = (k, x) => setV(o => ({ ...o, [k]: x }))

  const submit = () => {
    const next = normalizeEntry({ ...(entry || {}), id: entry?.id || uid(), d: entry?.d || d, meal: m, name, ...v, src: entry?.src || 'manual' })
    if (!next) { toast(t('Enter a name or the calories')); return }
    update(s => {
      s.foodLog = entry ? s.foodLog.map(e => (e.id === entry.id ? next : e)) : [...s.foodLog, next]
      if (save && !entry && next.name) {
        const food = normalizeFood({ id: uid(), name: next.name, kcal: next.kcal, p: next.p, c: next.c, f: next.f })
        if (food && !s.foods.some(x => x.name.toLowerCase() === food.name.toLowerCase())) s.foods = [...s.foods, food]
      }
    })
    close()
    toast(entry ? t('Saved') : t('Logged'))
  }
  const remove = () => {
    close()
    confirmSheet({
      title: t('Delete this entry?'), message: entry.name || fmtInt(entry.kcal) + ' kcal', confirmText: t('Delete'), danger: true,
      onConfirm: () => { update(s => { s.foodLog = s.foodLog.filter(e => e.id !== entry.id) }); toast(t('Deleted')) }
    })
  }

  return <>
    <h3>{entry ? t('Edit entry') : t('Add food')}</h3>
    <TextField value={name} maxLength={80} placeholder={t('What did you eat?')} onChange={e => setName(e.target.value)} autoFocus={!entry} />
    <div style={{ height: 10 }} />
    <Segmented value={m} onChange={setM} options={mealOptions()} />
    <div className="nut-fields">
      {[['kcal', t('kcal')], ['p', t('Protein')], ['c', t('Carbs')], ['f', t('Fat')]].map(([k, label]) => <label key={k} className="nut-field">
        <span>{label}{k !== 'kcal' && <i> (g)</i>}</span>
        <NumberField nullable value={v[k]} onChange={x => set(k, x)} placeholder={k === 'kcal' && fromMacros ? String(fromMacros) : ''} />
      </label>)}
    </div>
    {!v.kcal && fromMacros > 0 && <div className="small dim" style={{ marginTop: 6 }}>{t('{0} kcal from the macros', fmtInt(fromMacros))}</div>}
    {!entry && <div className="lrow" style={{ padding: '10px 2px 0' }}>
      <span className="lrow-m"><span className="lrow-t">{t('Save to my foods')}</span><span className="lrow-s">{t('Log it again with one tap')}</span></span>
      <Switch checked={save} onChange={setSave} />
    </div>}
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={submit}>{entry ? t('Save') : t('Log')}</Button>
    {entry && <><div style={{ height: 8 }} /><Button className="danger" icon="trash" onClick={remove}>{t('Delete')}</Button></>}
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

export function entrySheet(opts) {
  return openSheet(close => <EntryEditor {...opts} close={close} />)
}

/** How many servings of a saved food, and for which meal. */
function FoodPortion({ d, food, meal, close }) {
  const [qty, setQty] = useState(1)
  const [m, setM] = useState(meal || nowMeal())
  const preview = entryFromFood(food, { id: 'x', d, meal: m, qty })
  const log = () => {
    update(s => { s.foodLog = [...s.foodLog, entryFromFood(food, { id: uid(), d, meal: m, qty })] })
    close()
    toast(t('Logged'))
  }
  return <>
    <h3>{food.name}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{food.serving ? food.serving + ' · ' : ''}{fmtInt(food.kcal)} kcal · {macroLine(food)}</div>
    <Stepper value={qty} step={0.5} min={0.5} max={20} onChange={setQty} label={t('Servings')} />
    <div style={{ height: 10 }} />
    <Segmented value={m} onChange={setM} options={mealOptions()} />
    <div className="small dim" style={{ marginTop: 10 }}>{fmtInt(preview.kcal)} kcal · {macroLine(preview)}</div>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={log}>{t('Log')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

/** Saved foods first (one tap to log), then "enter it by hand". */
function AddFood({ d, meal, close }) {
  const S = useStore(s => s.S)
  const [q, setQ] = useState('')
  const foods = S.foods.filter(f => !q || f.name.toLowerCase().includes(q.trim().toLowerCase()))
  const pick = food => { close(); openSheet(c => <FoodPortion d={d} food={food} meal={meal} close={c} />) }
  const manual = () => { close(); entrySheet({ d, meal }) }
  const forget = food => confirmSheet({
    title: t('Remove from my foods?'), message: food.name, confirmText: t('Remove'), danger: true,
    onConfirm: () => update(s => { s.foods = s.foods.filter(f => f.id !== food.id) })
  })
  return <>
    <h3>{t('Add food')}</h3>
    {S.foods.length > 0 && <>
      {S.foods.length > 6 && <><SearchField value={q} onChange={setQ} onClear={() => setQ('')} placeholder={t('Search my foods')} /><div style={{ height: 8 }} /></>}
      <div className="nut-list" style={{ maxHeight: '44vh', overflowY: 'auto' }}>
        {foods.map(f => <div key={f.id} className="nut-entry" role="button" tabIndex={0} onClick={() => pick(f)}>
          <span className="nut-entry-m">
            <div className="nut-entry-t">{f.name}</div>
            <div className="nut-entry-s">{f.serving ? f.serving + ' · ' : ''}{macroLine(f)}</div>
          </span>
          <span className="nut-entry-k">{fmtInt(f.kcal)}</span>
          <button className="iconbtn" style={{ width: 28, height: 28, fontSize: 13 }} aria-label={t('Remove')} onClick={e => { e.stopPropagation(); forget(f) }}><Icon name="xmark" /></button>
        </div>)}
        {!foods.length && <div className="empty small">{t('No saved food matches')}</div>}
      </div>
      <div style={{ height: 12 }} />
    </>}
    <Button variant="primary" icon="pencil" onClick={manual}>{t('Enter it by hand')}</Button>
    {!S.foods.length && <div className="small dim" style={{ marginTop: 8 }}>{t('Foods you save show up here, ready to log with one tap.')}</div>}
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

export function addFoodSheet({ d = todayISO(), meal } = {}) {
  const S = useStore.getState().S
  if (!S.foods.length) return entrySheet({ d, meal })
  return openSheet(close => <AddFood d={d} meal={meal} close={close} />)
}

/** Calories only, for when the details do not matter. */
function QuickAdd({ d, close }) {
  const [kcal, setKcal] = useState(null)
  const [m, setM] = useState(nowMeal())
  const log = () => {
    const e = normalizeEntry({ id: uid(), d, meal: m, kcal, src: 'quick' })
    if (!e || !e.kcal) { toast(t('Enter the calories')); return }
    update(s => { s.foodLog = [...s.foodLog, e] })
    close()
    toast(t('Logged'))
  }
  return <>
    <h3>{t('Quick add')}</h3>
    <label className="nut-field" style={{ fontSize: 13 }}>
      <span>{t('Calories (kcal)')}</span>
      <NumberField nullable decimal={false} value={kcal} onChange={setKcal} autoFocus />
    </label>
    <div style={{ height: 10 }} />
    <Segmented value={m} onChange={setM} options={mealOptions()} />
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={log}>{t('Log')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

export function quickAddSheet({ d = todayISO() } = {}) {
  return openSheet(close => <QuickAdd d={d} close={close} />)
}

/** The targets typed in by hand, or recalculated from the intake. */
function TargetsEditor({ close }) {
  const S = useStore(s => s.S)
  const nav = useNavigate()
  const [v, setV] = useState({ ...(S.nutTargets || { kcal: null, p: null, c: null, f: null }) })
  const fromMacros = Math.round(macroKcal(v))
  const save = () => {
    const next = boundTargets(v, S.nutProfile)
    if (!next) { toast(t('Enter the calories')); return }
    update(s => { s.nutTargets = { ...next, source: 'manual', at: Date.now() } })
    if (next.kcal !== Math.round(Number(v.kcal))) toast(t('Calories held at {0}, the safe floor for you', fmtInt(next.kcal)))
    close()
  }
  return <>
    <h3>{t('Daily targets')}</h3>
    <div className="nut-fields">
      {[['kcal', t('kcal')], ['p', t('Protein')], ['c', t('Carbs')], ['f', t('Fat')]].map(([k, label]) => <label key={k} className="nut-field">
        <span>{label}{k !== 'kcal' && <i> (g)</i>}</span>
        <NumberField nullable decimal={false} value={v[k]} onChange={x => setV(o => ({ ...o, [k]: x }))} />
      </label>)}
    </div>
    {fromMacros > 0 && Math.abs(fromMacros - (Number(v.kcal) || 0)) > 50 && <div className="small" style={{ marginTop: 6, color: 'var(--orange)' }}>{t('The macros add up to {0} kcal', fmtInt(fromMacros))}</div>}
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={save}>{t('Save')}</Button>
    <div style={{ height: 8 }} />
    <Button icon="reset" onClick={() => { close(); nav('/nutrition/setup') }}>{t('Recalculate from my details')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

export function targetsSheet() {
  return openSheet(close => <TargetsEditor close={close} />)
}

/* ------------------------------------------------------------------ the screen */

function EntryRow({ e }) {
  return <button className="nut-entry" onClick={() => entrySheet({ d: e.d, entry: e })}>
    {e.photo ? <MealThumb photo={e.photo} /> : null}
    <span className="nut-entry-m">
      <div className="nut-entry-t">{e.name || t('Quick add')}</div>
      <div className="nut-entry-s">{e.p || e.c || e.f ? macroLine(e) : e.src === 'photo' ? t('From a photo') : t('Calories only')}</div>
    </span>
    <span className="nut-entry-k">{fmtInt(e.kcal)}</span>
  </button>
}

export default function Nutrition() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const [params, setParams] = useSearchParams()
  const today = todayISO()
  const d = /^\d{4}-\d{2}-\d{2}$/.test(params.get('d') || '') && params.get('d') <= today ? params.get('d') : today
  const setDay = x => setParams(x === today ? {} : { d: x }, { replace: true })
  const [hideTip, setHideTip] = useState(false)

  const targets = S.nutTargets
  const totals = dayTotals(S.foodLog, d)
  const r = remaining(targets, totals)
  const meals = byMeal(S.foodLog, d)
  const history = useMemo(() => loggedDays(S.foodLog).slice(0, 14), [S.foodLog])
  const tip = useMemo(() => (targets ? suggestAdjustment({ targets, profile: S.nutProfile, bodyweight: S.bodyweight, foodLog: S.foodLog, today, unit: S.unit }) : null),
    [targets, S.nutProfile, S.bodyweight, S.foodLog, today, S.unit])
  const photo = photoLoggingAvailable(config, user, S)
  const over = r.left.kcal < 0

  const applyTip = () => {
    update(s => { s.nutTargets = { ...tip.targets, source: 'calc', at: Date.now() } })
    toast(t('Targets updated'))
  }

  return <div className="narrow">
    <div className="hdr">
      <button className="iconbtn" onClick={() => nav('/home')} aria-label={t('Home')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('Nutrition')}</h1><div className="sub">{d === today ? t('Today') : fmtDate(d, true)}</div></div>
      <button className="iconbtn" onClick={targetsSheet} aria-label={t('Daily targets')}><Icon name="target" /></button>
    </div>

    <div className="nut-day">
      <button className="iconbtn" onClick={() => setDay(addDays(d, -1))} aria-label={t('Previous day')}><Icon name="chevronLeft" /></button>
      <div className="small muted" style={{ fontWeight: 500 }}>{d === today ? t('Today') : fmtDate(d, true)}</div>
      <button className="iconbtn" disabled={d >= today} onClick={() => setDay(addDays(d, 1))} aria-label={t('Next day')}><Icon name="chevronRight" /></button>
    </div>

    <div className="card">
      {targets ? <>
        <div className="nut-head">
          <div>
            <div className={'nut-left' + (over ? ' over' : '')}>{fmtInt(Math.abs(r.left.kcal))}<small>{over ? t('kcal over') : t('kcal left')}</small></div>
            <div className="nut-sub">{t('{0} of {1} kcal eaten', fmtInt(totals.kcal), fmtInt(targets.kcal))}</div>
          </div>
          <div className={'nut-ring nut-k' + (over ? ' over' : '')} style={{ '--p': Math.min(1, r.share.kcal || 0) }}><span>{Math.round((r.share.kcal || 0) * 100)}%</span></div>
        </div>
        <MacroBars targets={targets} totals={totals} />
        {r.left.p > 0 && d === today && totals.n > 0 && <div className="small dim" style={{ marginTop: 10 }}>{t('{0} g of protein still to go today', fmtG(r.left.p))}</div>}
      </> : <>
        <div className="muted small">{t('Set your daily calories and macros first: a few questions, and the numbers are worked out for you.')}</div>
        <div style={{ height: 10 }} /><Button variant="primary" icon="target" onClick={() => nav('/nutrition/setup')}>{t('Set my targets')}</Button>
      </>}
      <div className="nut-actions">
        {photo && <Button variant="tinted" icon="camera" onClick={() => photoMealFlow(d)}>{t('Photo')}</Button>}
        <Button icon="plus" onClick={() => addFoodSheet({ d })}>{t('Add food')}</Button>
        <Button icon="bolt" onClick={() => quickAddSheet({ d })}>{t('Quick add')}</Button>
      </div>
    </div>

    {tip && !hideTip && <div className="card nut-tip">
      <div className="row" style={{ gap: 8, marginBottom: 6 }}><Icon name="lightbulb" style={{ color: 'var(--acc)' }} /><b>{t('Adjust your target?')}</b></div>
      <div className="small">{tip.reason === 'slow'
        ? t('Over the last {0} logged days your weight moved {1} kg a week, slower than you planned.', tip.days, (tip.trend > 0 ? '+' : '') + tip.trend)
        : tip.reason === 'fast'
          ? t('Over the last {0} logged days your weight moved {1} kg a week, faster than you planned.', tip.days, (tip.trend > 0 ? '+' : '') + tip.trend)
          : t('Over the last {0} logged days your weight drifted {1} kg a week.', tip.days, (tip.trend > 0 ? '+' : '') + tip.trend)}
        {' '}{t('Try {0} kcal a day ({1}).', fmtInt(tip.targets.kcal), (tip.delta > 0 ? '+' : '') + tip.delta)}</div>
      <div className="row" style={{ gap: 8, marginTop: 10 }}>
        <Button size="sm" variant="primary" onClick={applyTip}>{t('Use {0} kcal', fmtInt(tip.targets.kcal))}</Button>
        <Button size="sm" variant="ghost" onClick={() => setHideTip(true)}>{t('Not now')}</Button>
      </div>
    </div>}

    {MEALS.map(m => meals[m].length > 0 && <div key={m} className="nut-meal">
      <div className="nut-meal-h"><span>{mealLabel(m)}</span><b>{fmtInt(meals[m].reduce((n, e) => n + e.kcal, 0))} kcal</b></div>
      <div className="nut-list">{meals[m].map(e => <EntryRow key={e.id} e={e} />)}</div>
    </div>)}
    {!totals.n && <div className="empty small" style={{ marginTop: 14 }}>{d === today ? t('Nothing logged yet today.') : t('Nothing logged on this day.')}</div>}

    {history.length > 0 && <>
      <h4 className="sec" style={{ margin: '22px 4px 8px' }}>{t('Recent days')}</h4>
      <div className="nut-list">{history.map(h => {
        const share = targets?.kcal ? h.kcal / targets.kcal : 0
        return <button key={h.d} className={'nut-hist' + (h.d === d ? ' on' : '')} onClick={() => setDay(h.d)}>
          <span className="small">{h.d === today ? t('Today') : fmtDate(h.d, true)}</span>
          <span className={'nut-bar nut-k' + (share > 1.05 ? ' over' : '')} style={{ display: 'block' }}><span className="nut-bar-t" style={{ display: 'block' }}><span className="nut-bar-f" style={{ display: 'block', width: Math.min(100, share * 100) + '%' }} /></span></span>
          <span className="nut-hist-v">{fmtInt(h.kcal)}</span>
        </button>
      })}</div>
    </>}
  </div>
}
