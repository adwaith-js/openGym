// Logging a meal from a photo (or a few words): consent the first time, then the photo, the
// wait, and the card. The card is the point. The AI only proposes; every number on it can be
// changed, the portion scaled, and nothing is logged until "Log it" is pressed.
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { normalizeEntry, normalizeFood, scaleMacros, mealFor } from '../lib/nutrition.js'
import { preparePhoto, storeThumb, requestEstimate, waitForEstimate, estimateDone, photoErrorText } from '../lib/meal-photo.js'
import { uid } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField, Segmented, Stepper, Switch, TextArea, TextField } from '../components/ui.jsx'
import { useMediaUrl } from '../components/CustomMedia.jsx'
import { fmtInt, fmtG } from '../components/MacroBars.jsx'
import '../nutrition.css'

export const NUT_CONSENT_VERSION = 1
const toast = m => useUI.getState().toast(m)
const nowMeal = () => { const d = new Date(); return mealFor(d.getHours() + d.getMinutes() / 60) }
const mealOptions = () => [['breakfast', t('Breakfast')], ['lunch', t('Lunch')], ['dinner', t('Dinner')], ['snack', t('Snack')]].map(([value, label]) => ({ value, label }))

/**
 * Whether this app can ask for an estimate at all: signed in to a server whose Coach is on. The
 * phone's own-key Coach and the demo have no meal estimates (yet), so the button is not offered.
 */
export const photoLoggingAvailable = (config, user) => !DEMO && !MOBILE && !!(config?.coach?.enabled && user)
/** Whether that server's provider can see a photo; without it, the flow offers words only. */
export const photosReadable = config => config?.coach?.images !== false

/** The thumbnail of a photo-logged meal, from the local media store or the server's copy. */
export function MealThumb({ photo, className = 'nut-thumb' }) {
  const { url } = useMediaUrl(photo || null)
  return url ? <img className={className} src={url} alt="" loading="lazy" decoding="async" /> : <span className={className} />
}

function Consent({ onAgree, onDecline }) {
  const config = useStore(s => s.config)
  return <>
    <h3>{t('Log meals from a photo')}</h3>
    <div className="small" style={{ lineHeight: 1.45 }}>
      <p style={{ marginTop: 0 }}>{t('Take a photo of your meal, or describe it, and the AI estimates its calories and macros. You check every number before anything is logged.')}</p>
      <p>{t('What leaves this server: the photo (shrunk to 1024 px, location data removed), what you type about the meal, and the meal name. Nothing about your training, weight or account.')}</p>
      <p>{t('It goes to {0}, the AI provider this server is set up with. The photo is not stored there by openGym or on this server; a small thumbnail is kept with your log for 30 days.', config?.coach?.providerLabel || t('the configured AI provider'))}</p>
      <p style={{ color: 'var(--yellow)' }}>{t('Estimates from a photo are rough, often 20 to 30 % off. Weigh and log by hand when it matters.')}</p>
    </div>
    <Button variant="primary" onClick={onAgree}>{t('I understand, let’s go')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={onDecline}>{t('Not now')}</Button>
  </>
}

function Review({ d, est, thumb, photo, meal: meal0, note, close }) {
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [name, setName] = useState(est.name)
  const [k, setK] = useState(1)
  const [m, setM] = useState(meal0 || nowMeal())
  const [edited, setEdited] = useState(null)   // the numbers typed over the estimate, or null
  const [save, setSave] = useState(false)
  const base = scaleMacros(est, k)
  const v = edited || base
  const setField = (f, x) => setEdited(o => ({ ...(o || base), [f]: x }))
  const scale = x => { setK(x); setEdited(null) }

  const log = () => {
    const e = normalizeEntry({ id: uid(), d, meal: m, name, ...v, src: 'photo', ...(photo ? { photo } : {}), ...(note ? { note } : {}) })
    if (!e) { toast(t('Enter a name or the calories')); return }
    update(s => {
      s.foodLog = [...s.foodLog, e]
      if (save && e.name && !s.foods.some(f => f.name.toLowerCase() === e.name.toLowerCase())) {
        const food = normalizeFood({ id: uid(), name: e.name, kcal: e.kcal, p: e.p, c: e.c, f: e.f })
        if (food) s.foods = [...s.foods, food]
      }
    })
    estimateDone()
    close()
    toast(t('Logged'))
  }

  return <>
    {thumb && <img className="nut-photo" src={thumb} alt="" />}
    <div className="row between" style={{ marginTop: 10, gap: 8 }}>
      <TextField value={name} maxLength={80} onChange={e => setName(e.target.value)} aria-label={t('Name')} />
      <span className={'nut-conf' + (est.confidence === 'low' ? ' low' : '')}>{est.confidence === 'high' ? t('Confident') : est.confidence === 'low' ? t('Rough guess') : t('Estimate')}</span>
    </div>
    {est.items?.length > 0 && <ul className="nut-items">
      {est.items.map((it, i) => <li key={i}><span>{it.name}{it.grams != null ? ` · ${fmtInt(it.grams * k)} g` : ''}</span><span>{fmtInt(it.kcal * k)} kcal</span></li>)}
    </ul>}
    {est.note && <div className="small dim" style={{ marginTop: 6 }}>{est.note}</div>}
    <div style={{ height: 10 }} />
    <Stepper value={k} step={0.25} min={0.25} max={4} onChange={scale} label={t('Portion')} unit="×" />
    <div className="nut-fields">
      {[['kcal', t('kcal')], ['p', t('Protein')], ['c', t('Carbs')], ['f', t('Fat')]].map(([f, label]) => <label key={f} className="nut-field">
        <span>{label}{f !== 'kcal' && <i> (g)</i>}</span>
        <NumberField className="field" nullable value={v[f]} onChange={x => setField(f, x)} />
      </label>)}
    </div>
    <div style={{ height: 10 }} />
    <Segmented value={m} onChange={setM} options={mealOptions()} />
    <div className="lrow" style={{ padding: '10px 2px 0' }}>
      <span className="lrow-m"><span className="lrow-t">{t('Save to my foods')}</span><span className="lrow-s">{t('Log it again with one tap')}</span></span>
      <Switch checked={save} onChange={setSave} />
    </div>
    <div style={{ height: 14 }} />
    <Button variant="primary" icon="check" onClick={log}>{t('Log it')} · {fmtInt(v.kcal)} kcal</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={() => { estimateDone(); close() }}>{t('Discard')}</Button>
    {S.nutTargets && <div className="small dim" style={{ marginTop: 8, textAlign: 'center' }}>{t('P {0} g · C {1} g · F {2} g', fmtG(v.p), fmtG(v.c), fmtG(v.f))}</div>}
  </>
}

function MealPhotoFlow({ d, close }) {
  const S = useStore(s => s.S)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const [step, setStep] = useState(S.nutConsent?.agreedAt ? 'pick' : 'consent')
  const [note, setNote] = useState('')
  const [meal, setMeal] = useState(nowMeal())
  const [waited, setWaited] = useState(0)
  const [err, setErr] = useState(null)
  const [est, setEst] = useState(null)
  const [thumbUrl, setThumbUrl] = useState(null)
  const [photo, setPhoto] = useState(null)
  const camRef = useRef(null)
  const libRef = useRef(null)
  const ctl = useRef(null)
  const canPhoto = photosReadable(config)

  // Leaving the sheet stops the wait; a new photo lets go of the previous preview.
  useEffect(() => () => ctl.current?.abort(), [])
  useEffect(() => () => { if (thumbUrl) URL.revokeObjectURL(thumbUrl) }, [thumbUrl])

  const agree = () => {
    update(s => { s.nutConsent = { agreedAt: new Date().toISOString(), version: NUT_CONSENT_VERSION } })
    setStep('pick')
  }

  // The server reads consent from the stored profile, and the store pushes a change a moment
  // later; the first estimate after agreeing can arrive first. Pushed now and asked once more.
  const ask = async body => {
    try { return await requestEstimate(body) }
    catch (e) {
      if (e?.data?.code !== 'consent' || !useStore.getState().S.nutConsent?.agreedAt) throw e
      await useStore.getState().pushState()
      return requestEstimate(body)
    }
  }

  const run = async file => {
    setErr(null)
    setStep('reading')
    setWaited(0)
    ctl.current?.abort()
    ctl.current = new AbortController()
    try {
      let image = null
      if (file) {
        const prepared = await preparePhoto(file)
        image = prepared.ai
        setThumbUrl(URL.createObjectURL(prepared.thumb.blob))
        setPhoto(await storeThumb(prepared.thumb))
      }
      const r = await ask({ image, note, meal })
      const job = await waitForEstimate(r.job.id, { signal: ctl.current.signal, onTick: setWaited })
      if (job.state !== 'ready') throw Object.assign(new Error(job.errorClass), { code: job.errorClass })
      if (!job.result.food) { estimateDone(); setErr(job.result.note ? t('No food found in the photo: {0}', job.result.note) : t('No food found in the photo.')); setStep('pick'); return }
      setEst(job.result)
      setStep('review')
    } catch (e) {
      if (e?.code === 'cancelled') return
      setErr(photoErrorText(e?.data?.code || e?.code))
      setStep('pick')
    }
  }
  const onFile = e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(f) }

  if (step === 'consent') return <Consent onAgree={agree} onDecline={close} />

  if (step === 'reading') return <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
    {thumbUrl && <img className="nut-photo" src={thumbUrl} alt="" style={{ marginBottom: 14 }} />}
    <div className="row" style={{ justifyContent: 'center', gap: 8 }}><Icon name="sparkles" style={{ color: 'var(--acc)' }} /><b>{t('Reading your meal…')}</b></div>
    <div className="small dim" style={{ marginTop: 6 }}>{waited > 4 ? t('{0} s · this can take up to a minute', waited) : t('This takes a few seconds')}</div>
    <div style={{ height: 14 }} />
    <Button variant="ghost" className="dim" onClick={() => { ctl.current?.abort(); estimateDone(); close() }}>{t('Cancel')}</Button>
  </div>

  if (step === 'review' && est) return <Review d={d} est={est} thumb={thumbUrl} photo={photo} meal={meal} note={note.trim()} close={close} />

  return <>
    <h3>{t('Log a meal')}</h3>
    {err && <div className="small" style={{ color: 'var(--orange)', marginBottom: 10 }}>{err}</div>}
    <Segmented value={meal} onChange={setMeal} options={mealOptions()} />
    <div style={{ height: 10 }} />
    <TextArea rows={2} maxLength={400} value={note} onChange={e => setNote(e.target.value)}
      placeholder={canPhoto ? t('Optional: anything the photo cannot show (“half portion, no sauce”)') : t('Describe the meal (“chicken rice, large, with soup”)')} />
    <div style={{ height: 12 }} />
    {canPhoto && <>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={libRef} type="file" accept="image/*" hidden onChange={onFile} />
      <div className="row" style={{ gap: 8 }}>
        <Button variant="primary" icon="camera" style={{ flex: 1 }} onClick={() => camRef.current?.click()}>{t('Take photo')}</Button>
        <Button icon="image" style={{ flex: 1 }} onClick={() => libRef.current?.click()}>{t('From library')}</Button>
      </div>
      <div style={{ height: 8 }} />
    </>}
    <Button icon="pencil" variant={canPhoto ? 'plain' : 'primary'} disabled={!note.trim()} onClick={() => run(null)}>{t('Estimate from the description')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Cancel')}</Button>
  </>
}

/** Opens the flow for day `d`. */
export function photoMealFlow(d) {
  return useUI.getState().openSheet(close => <MealPhotoFlow d={d} close={close} />)
}
