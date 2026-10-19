// A meal photo, from the camera to an estimate: the copy the model reads, the thumbnail the log
// keeps, and the calls that ask the server (api/coach/nutrition.js).
//
// Two images come out of one photo, both drawn again on a canvas so no EXIF or GPS survives
// (lib/media-ingest.js encodeImage):
//   - 1024 px for the model. Enough to tell rice from noodles and a full plate from half of one;
//     anything bigger only costs upload time and the provider's image tokens. Never stored.
//   - 320 px for the log. Kept in the media store like a workout photo, synced to the server, and
//     dropped after 30 days (lib/nutrition.js expirePhotos).
import { api } from './api.js'
import { getLang, t } from './i18n.js'
import { sniffKind } from './media-sniff.js'
import { sha256Hex } from './sha256.js'
import { mediaStore } from './media-store.js'
import { normalizeMediaRef } from './media-refs.js'

export const AI_EDGE = 1024
export const THUMB_EDGE = 320

const toBase64 = blob => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''))
  r.onerror = () => reject(r.error)
  r.readAsDataURL(blob)
})

/** A refusal with a code the screen turns into a sentence (photoErrorText). */
export class PhotoError extends Error {
  constructor(code) { super(code); this.code = code }
}

/**
 * `file` (from the camera or the library) → { ai: { mime, data }, thumb: { blob, mime, width,
 * height } }. Throws PhotoError('type') for a video or anything that is not a picture, and
 * ('unreadable') for a picture this browser cannot open.
 */
export async function preparePhoto(file) {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer())
  const sniffed = sniffKind(head)
  if (!sniffed || sniffed.kind === 'video') throw new PhotoError('type')
  // The decoders and the canvas code only load when someone actually takes a meal photo.
  const { decodeImage, encodeImage } = await import('./media-ingest.js')
  let pic
  try { pic = await decodeImage(file, sniffed.mime) } catch { throw new PhotoError('unreadable') }
  try {
    const big = await encodeImage(pic, AI_EDGE, 0.8)
    const thumb = await encodeImage(pic, THUMB_EDGE, 0.7)
    return { ai: { mime: big.mime, data: await toBase64(big.blob) }, thumb }
  } catch {
    throw new PhotoError('unreadable')
  } finally {
    pic.close()
  }
}

/**
 * The thumbnail into the local media store, as owed to the server (the media sync uploads it once
 * a food-log entry names it), and the MediaRef the entry keeps. null when this device cannot
 * store files: the meal is still logged, without its picture.
 */
export async function storeThumb(thumb) {
  try {
    const hash = await sha256Hex(thumb.blob)
    await mediaStore.put(hash, thumb.blob, { mime: thumb.mime, pending: true })
    return normalizeMediaRef({ kind: 'image', hash, mime: thumb.mime, size: thumb.blob.size, width: thumb.width, height: thumb.height, at: Date.now() })
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ the server */

/** Starts an estimate. Rejects with the server's `code` on e.data.code (see ESTIMATE_ERRORS). */
export const requestEstimate = ({ image = null, note = '', meal = null }) =>
  api('/api/nutrition/estimate', { method: 'POST', body: JSON.stringify({ image, note, meal, lang: getLang() }), timeout: 45000 })

export const estimateStatus = () => api('/api/nutrition/estimate')

/** The card has been dealt with: the server lets go of the answer. Best effort. */
export const estimateDone = () => api('/api/nutrition/estimate/done', { method: 'POST', body: '{}' }).catch(() => {})

/**
 * Polls until the estimate `id` is ready or failed: { state, result?, errorClass? }. `onTick`
 * gets the seconds waited so far, for the screen. Stops when `signal` aborts.
 */
export async function waitForEstimate(id, { signal, onTick, every = 1500, maxMs = 5 * 60000, status = estimateStatus } = {}) {
  const start = Date.now()
  for (;;) {
    if (signal?.aborted) throw new PhotoError('cancelled')
    if (Date.now() - start > maxMs) throw new PhotoError('timeout')
    await new Promise(r => setTimeout(r, every))
    onTick?.(Math.round((Date.now() - start) / 1000))
    let s
    try { s = await status() } catch (e) { if (e?.status === 401) throw e; continue }
    const job = s?.job
    if (!job) throw new PhotoError('lost')
    if (job.id !== id) throw new PhotoError('lost')
    if (job.state !== 'running') return job
  }
}

// The server's refusal codes and the job's failure classes, in the app's own words.
export function photoErrorText(code) {
  switch (code) {
    case 'type': return t('That is not a photo.')
    case 'unreadable': return t('This photo could not be opened on this device.')
    case 'noimages': return t('The AI on this server cannot read photos. Describe the meal instead.')
    case 'busy': return t('Still reading your last meal.')
    case 'cap': return t('That is all the meal estimates for today.')
    case 'consent': return t('Meal estimates need your go-ahead first.')
    case 'off': return t('The Coach is not set up on this server.')
    case 'input': return t('Add a photo or describe the meal.')
    case 'timeout': return t('The AI took too long to answer. Try again.')
    case 'lost': return t('The estimate was lost (the server restarted?). Try again.')
    case 'auth': return t('The AI provider refused the account. Ask your admin to check the Coach settings.')
    case 'unusable': return t('The AI’s answer could not be used. Try again, or describe the meal.')
    case 'missing': return t('The AI runtime is missing on this server.')
    default: return t('The estimate failed. Try again, or log the meal by hand.')
  }
}
