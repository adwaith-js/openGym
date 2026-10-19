// The nutrition intake: a few questions, one per screen, and daily targets worked out from the
// answers (lib/nutrition.js computeTargets). The numbers are calculated, not guessed, and every
// one of them can still be changed on the last screen before it is saved.
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import {
  ACTIVITY, computeTargets, boundTargets, missingFields, normalizeProfile, trainingPerWeek, suggestActivity, macroKcal, LIMITS
} from '../lib/nutrition.js'
import { lastBW } from '../lib/history.js'
import { todayISO, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Button, NumberField } from '../components/ui.jsx'
import { fmtInt } from '../components/MacroBars.jsx'
import '../coach.css'
import '../nutrition.css'

const LB = 0.45359237
const toKg = (v, unit) => (v == null || v === '' ? null : unit === 'lb' ? Number(v) * LB : Number(v))
const fromKg = (kg, unit) => (kg == null ? null : Math.round((unit === 'lb' ? kg / LB : kg) * 10) / 10)

// Each choice's words through literal t() calls, so the string checker sees every key.
const ACTIVITY_TEXT = {
  sedentary: () => [t('Mostly sitting'), t('Desk job, little exercise.')],
  light: () => [t('Lightly active'), t('Training 1–2 days a week, or on your feet some of the day.')],
  moderate: () => [t('Active'), t('Training 3–4 days a week.')],
  high: () => [t('Very active'), t('Training 5–6 days a week, or a physical job.')],
  athlete: () => [t('Extremely active'), t('Hard training every day, or twice a day.')]
}
const GOAL_TEXT = {
  lose: () => [t('Lose fat'), t('Eat under maintenance and keep protein high.'), 'flame'],
  recomp: () => [t('Recomposition'), t('Slightly under maintenance: lose fat and build muscle slowly together.'), 'arm'],
  maintain: () => [t('Maintain'), t('Hold your weight where it is.'), 'scale'],
  gain: () => [t('Build muscle'), t('A small surplus for training to turn into muscle.'), 'barbell']
}
const PACES = { lose: [0.25, 0.5, 0.75, 1], gain: [0.1, 0.25, 0.5] }

function Choice({ on, icon, title, sub, onClick }) {
  return <button className={'ob-choice' + (on ? ' on' : '')} onClick={onClick}>
    {icon && <Icon name={icon} />}
    <span className="ob-choice-t">{title}{sub && <span className="ob-choice-s">{sub}</span>}</span>
    <Icon name="check" className="ob-k" />
  </button>
}

function Field({ label, unit, value, onChange, decimal = true }) {
  return <label className="nut-field" style={{ fontSize: 14, marginBottom: 12 }}>
    <span>{label}</span>
    <span className="row" style={{ gap: 8 }}>
      <NumberField nullable decimal={decimal} value={value} onChange={onChange} />
      <span className="muted" style={{ minWidth: 28 }}>{unit}</span>
    </span>
  </label>
}

export default function NutritionSetup() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const unit = S.unit === 'lb' ? 'lb' : 'kg'
  const today = todayISO()
  const perWeek = useMemo(() => trainingPerWeek(S.workouts, today), [S.workouts, today])

  // Start from what the app already knows: the last answers, the latest weigh-in, the goal weight.
  const [p, setP] = useState(() => {
    const prev = S.nutProfile || {}
    const bw = lastBW(S)
    return {
      sex: prev.sex || (S.body === 'female' ? 'female' : S.body === 'male' ? 'male' : null),
      age: prev.age ?? null,
      heightCm: prev.heightCm ?? null,
      weight: bw ? Number(bw.w) : fromKg(prev.weightKg, unit),
      target: S.targetW != null ? Number(S.targetW) : fromKg(prev.targetKg, unit),
      activity: prev.activity || suggestActivity(perWeek),
      goal: prev.goal || null,
      pace: prev.pace ?? null
    }
  })
  const set = patch => setP(v => ({ ...v, ...patch }))
  const profile = normalizeProfile({ ...p, weightKg: toKg(p.weight, unit), targetKg: toKg(p.target, unit), at: Date.now() })
  const calc = computeTargets(profile)
  const [edit, setEdit] = useState(null)   // the result's numbers typed over, or null
  const shown = edit || calc

  const STEPS = ['about', 'body', 'activity', 'goal', 'result']
  const [step, setStep] = useState(0)
  const key = STEPS[step]
  const canNext = key === 'about' ? !!(profile.sex && profile.age)
    : key === 'body' ? !!(profile.heightCm && profile.weightKg)
    : key === 'activity' ? !!profile.activity
    : key === 'goal' ? !!profile.goal
    : !!shown
  const next = () => { setEdit(null); setStep(step + 1) }
  const back = () => (step ? setStep(step - 1) : nav(-1))

  const save = () => {
    const targets = boundTargets(shown, profile)
    if (!targets || missingFields(profile).length) { toast(t('Some answers are missing')); return }
    update(s => {
      s.nutProfile = profile
      s.nutTargets = { ...targets, source: edit ? 'manual' : 'calc', at: Date.now() }
      // The body-weight card's goal line is the same goal: set it when there is none yet.
      if (s.targetW == null && p.target) s.targetW = Math.round(Number(p.target) * 10) / 10
    })
    toast(t('Targets saved'))
    nav('/nutrition', { replace: true })
  }

  const paceUnit = unit === 'lb' ? t('lb a week') : t('kg a week')
  return <div className="narrow ob">
    <div className="ob-top">
      <button className="iconbtn" onClick={back} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div className="ob-dots">{STEPS.map((s, i) => <span key={s} className={'ob-dot' + (i === step ? ' on' : i < step ? ' done' : '')} />)}</div>
      <span style={{ width: 36 }} />
    </div>

    <div className="ob-body">
      {key === 'about' && <>
        <div className="ob-eyebrow">{t('Nutrition')}</div>
        <h1 className="ob-h">{t('A little about you')}</h1>
        <p className="ob-p">{t('Used only to work out how much energy your body uses at rest. It stays in your profile.')}</p>
        <div className="ob-choices">
          <Choice on={p.sex === 'male'} icon="person" title={t('Male')} onClick={() => set({ sex: 'male' })} />
          <Choice on={p.sex === 'female'} icon="person" title={t('Female')} onClick={() => set({ sex: 'female' })} />
        </div>
        <div style={{ height: 14 }} />
        <Field label={t('Age')} unit={t('years')} value={p.age} decimal={false} onChange={v => set({ age: v })} />
      </>}

      {key === 'body' && <>
        <div className="ob-eyebrow">{t('Body')}</div>
        <h1 className="ob-h">{t('Height and weight')}</h1>
        <p className="ob-p">{t('Your latest weigh-in is filled in. The goal weight is optional.')}</p>
        <Field label={t('Height')} unit="cm" value={p.heightCm} onChange={v => set({ heightCm: v })} />
        <Field label={t('Current weight')} unit={unit} value={p.weight} onChange={v => set({ weight: v })} />
        <Field label={t('Goal weight')} unit={unit} value={p.target} onChange={v => set({ target: v })} />
      </>}

      {key === 'activity' && <>
        <div className="ob-eyebrow">{t('Activity')}</div>
        <h1 className="ob-h">{t('How active is a normal week?')}</h1>
        <p className="ob-p">{perWeek > 0
          ? t('You logged {0} training days a week over the last 4 weeks; that is where this starts. Count your job and daily walking too.', fmtNum(perWeek))
          : t('Count your training, your job and your daily walking.')}</p>
        <div className="ob-choices">
          {Object.keys(ACTIVITY).map(k => { const [title, sub] = ACTIVITY_TEXT[k](); return <Choice key={k} on={p.activity === k} title={title} sub={sub} onClick={() => set({ activity: k })} /> })}
        </div>
      </>}

      {key === 'goal' && <>
        <div className="ob-eyebrow">{t('Goal')}</div>
        <h1 className="ob-h">{t('What are you eating for?')}</h1>
        <div className="ob-choices">
          {['lose', 'recomp', 'maintain', 'gain'].map(k => { const [title, sub, icon] = GOAL_TEXT[k](); return <Choice key={k} on={p.goal === k} icon={icon} title={title} sub={sub} onClick={() => set({ goal: k, pace: null })} /> })}
        </div>
        {(p.goal === 'lose' || p.goal === 'gain') && <>
          <div className="ob-sub">{t('How fast?')}</div>
          <div className="ob-quick">
            {PACES[p.goal].map(kg => <button key={kg} className={'chip' + (profile.pace === kg ? ' on' : '')} onClick={() => set({ pace: kg })}>
              {fmtNum(fromKg(kg, unit))} {paceUnit}
            </button>)}
          </div>
          {p.goal === 'lose' && profile.pace >= 0.75 && <div className="ob-note warn">{t('Faster loss costs more muscle and is harder to keep up. 0.5 kg a week is a good default.')}</div>}
        </>}
      </>}

      {key === 'result' && <>
        <div className="ob-eyebrow">{t('Your daily targets')}</div>
        {calc ? <>
          <h1 className="ob-h">{fmtInt(shown.kcal)} kcal</h1>
          <p className="ob-p">{t('Resting {0} kcal, maintenance about {1} kcal a day.', fmtInt(calc.bmr), fmtInt(calc.tdee))}{' '}
            {profile.goal === 'lose' ? t('The target is under maintenance by your chosen pace, never more than a quarter under it.')
              : profile.goal === 'gain' ? t('The target is a small surplus over maintenance.')
              : profile.goal === 'recomp' ? t('The target is 10 % under maintenance.') : t('The target is maintenance.')}
          </p>
          <div className="nut-fields">
            {[['kcal', t('kcal')], ['p', t('Protein')], ['c', t('Carbs')], ['f', t('Fat')]].map(([k, label]) => <label key={k} className="nut-field">
              <span>{label}{k !== 'kcal' && <i> (g)</i>}</span>
              <NumberField nullable decimal={false} value={shown[k]} onChange={x => setEdit(o => ({ ...(o || calc), [k]: x }))} />
            </label>)}
          </div>
          {Math.abs(macroKcal(shown) - (Number(shown.kcal) || 0)) > 60 && <div className="small" style={{ marginTop: 6, color: 'var(--orange)' }}>{t('The macros add up to {0} kcal', fmtInt(macroKcal(shown)))}</div>}
          <div className="ob-note" style={{ marginTop: 14 }}>{t('Protein is set from your goal weight when you are losing towards it. The targets adjust as your weight and log build up: the nutrition screen suggests a change when your trend is off pace.')}</div>
          <div className="ob-note warn">{t('These are estimates for healthy adults, not medical advice. Below {0} kcal, or with a health condition, talk to a doctor or dietitian.', fmtInt(LIMITS.kcalMin))}</div>
        </> : <p className="ob-p">{t('Some answers are missing. Go back and fill them in.')}</p>}
      </>}
    </div>

    <div className="ob-foot">
      <Button variant="primary" style={{ flex: 1 }} disabled={!canNext} icon={key === 'result' ? 'check' : undefined} onClick={key === 'result' ? save : next}>
        {key === 'result' ? t('Save my targets') : t('Continue')}
      </Button>
    </div>
  </div>
}
