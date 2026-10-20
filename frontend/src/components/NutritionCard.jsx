// Today's food on Home: what is left of the calorie target, and the three macros as bars.
// Tapping the card opens the day (views/Nutrition.jsx); the buttons log without leaving Home.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { dayTotals, remaining, expirePhotos } from '../lib/nutrition.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { addFoodSheet, quickAddSheet, photoMealFlow, photoLoggingAvailable } from '../views/Nutrition.jsx'
import { MacroBars, fmtInt } from './MacroBars.jsx'
import '../nutrition.css'

export default function NutritionCard() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const update = useStore(s => s.update)
  const today = todayISO()

  // A meal photo's thumbnail is kept 30 days; Home is opened every day, so this is where the
  // older ones are let go of (lib/nutrition.js expirePhotos). Nothing is written when none expired.
  useEffect(() => {
    if (expirePhotos(S.foodLog, today) !== S.foodLog) update(s => { s.foodLog = expirePhotos(s.foodLog, today) })
  }, [S.foodLog, today, update])

  const targets = S.nutTargets
  const totals = dayTotals(S.foodLog, today)

  if (!targets) {
    return <div className="card tappable" style={{ cursor: 'pointer' }} {...tappable(() => nav('/nutrition/setup'))}>
      <div className="row between">
        <div className="row" style={{ gap: 9 }}>
          <span className="lrow-i" style={{ background: 'var(--teal)' }}><Icon name="flame" /></span>
          <div>
            <div className="lbl2">{t('Nutrition')}</div>
            <div className="ttl">{t('Set your daily calories and macros')}</div>
          </div>
        </div>
        <Icon name="chevronRight" className="chev" />
      </div>
    </div>
  }

  const r = remaining(targets, totals)
  const over = r.left.kcal < 0
  const photo = photoLoggingAvailable(config, user, S)
  return <div className="card">
    <div className="nut-head" {...tappable(() => nav('/nutrition'))} style={{ cursor: 'pointer' }}>
      <div style={{ minWidth: 0 }}>
        <div className="lbl2">{t('Nutrition today')}</div>
        <div className={'nut-left' + (over ? ' over' : '')}>
          {fmtInt(Math.abs(r.left.kcal))}<small>{over ? t('kcal over') : t('kcal left')}</small>
        </div>
        <div className="nut-sub">{t('{0} of {1} kcal eaten', fmtInt(totals.kcal), fmtInt(targets.kcal))}</div>
      </div>
      <div className={'nut-ring nut-k' + (over ? ' over' : '')} style={{ '--p': Math.min(1, r.share.kcal || 0) }}>
        <span>{Math.round((r.share.kcal || 0) * 100)}%</span>
      </div>
    </div>
    <MacroBars targets={targets} totals={totals} />
    <div className="nut-actions">
      {photo && <Button size="sm" variant="tinted" icon="sparkles" onClick={() => photoMealFlow(today)}>{t('AI log')}</Button>}
      <Button size="sm" icon="plus" onClick={() => addFoodSheet({ d: today })}>{t('Add food')}</Button>
      <Button size="sm" icon="bolt" onClick={() => quickAddSheet({ d: today })}>{t('Quick add')}</Button>
    </div>
  </div>
}
