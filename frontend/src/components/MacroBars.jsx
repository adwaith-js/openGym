// Eaten against target, one bar per macro, and the number formats the nutrition screens share.
import { remaining } from '../lib/nutrition.js'
import { t, dateLocale } from '../lib/i18n.js'
import '../nutrition.css'

/** A whole number in the language's own digits and grouping: 2,410 / 2.410 / 2 410. */
export const fmtInt = n => Math.round(Number(n) || 0).toLocaleString(dateLocale())
/** Grams, whole above 10, one decimal below (half an egg white still shows). */
export const fmtG = n => { const v = Number(n) || 0; return (Math.abs(v) >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString(dateLocale()) }

/** The three macro bars, eaten against target. */
export function MacroBars({ targets, totals }) {
  const r = remaining(targets, totals)
  const rows = [['p', t('Protein'), 'nut-p'], ['c', t('Carbs'), 'nut-c'], ['f', t('Fat'), 'nut-f']]
  return <div className="nut-bars">
    {rows.map(([k, label, cls]) => {
      const share = r.share[k]
      const over = share != null && share > 1.05
      return <div key={k} className={'nut-bar ' + cls + (over ? ' over' : '')}>
        <span className="nut-bar-l">{label}</span>
        <span className="nut-bar-t"><span className="nut-bar-f" style={{ width: Math.min(100, (share || 0) * 100) + '%' }} /></span>
        <span className="nut-bar-v">{fmtG(totals[k])}<span> / {targets?.[k] ? fmtG(targets[k]) + ' g' : '–'}</span></span>
      </div>
    })}
  </div>
}

