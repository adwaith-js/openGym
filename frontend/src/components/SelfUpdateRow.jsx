// "Update this server" (Settings → About, admins only): asks the host to pull the newest images
// and restart (api 'POST /api/admin/update', contrib/pi/opengym-autoupdate.sh), then follows it.
// Shown only when the host set SELF_UPDATE=1; the api restarts during an update, so failed polls
// while it is down read as "restarting", not as an error.
import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { useUI } from '../store/useUI.js'
import { Row } from './ui.jsx'

const POLL_MS = 3000
const GIVE_UP_MS = 6 * 60000
const FINAL = new Set(['updated', 'uptodate', 'rolledback', 'failed', 'paused'])

// The build the page itself is running: "1.4.1+nutrition-3b53af0" → "nutrition-3b53af0".
const pageBuild = () => String(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '').split('+')[1] || null

function statusText(s) {
  if (!s) return t('Checks GitHub for a new build and installs it')
  const when = s.at ? new Date(s.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : ''
  const msg = {
    uptodate: t('Up to date'), updated: t('Updated'), rolledback: t('The new build failed and was rolled back'),
    failed: t('The last update failed'), paused: t('Updates are paused on the server'), checking: t('Checking…'), updating: t('Installing…')
  }[s.state] || s.message
  return [msg, when].filter(Boolean).join(' · ')
}

export default function SelfUpdateRow() {
  const [info, setInfo] = useState(null)          // GET /api/admin/update
  const [busy, setBusy] = useState(null)          // null | 'asking' | 'waiting' | 'restarting'
  const timer = useRef(null)
  const toast = m => useUI.getState().toast(m)

  useEffect(() => {
    let alive = true
    api('/api/admin/update').then(r => { if (alive) setInfo(r) }).catch(() => {})
    return () => { alive = false; clearTimeout(timer.current) }
  }, [])
  if (!info?.enabled) return null

  const follow = (since, started) => {
    timer.current = setTimeout(async () => {
      if (Date.now() - started > GIVE_UP_MS) { setBusy(null); toast(t('No answer from the server yet. Check again in a minute.')); return }
      let r
      try { r = await api('/api/admin/update', { timeout: 5000 }) } catch { setBusy('restarting'); return follow(since, started) }
      setInfo(r)
      const s = r.status
      if (r.requested || !s || s.at === since || !FINAL.has(s.state)) { setBusy('waiting'); return follow(since, started) }
      setBusy(null)
      // A new build is on the server but this page is the old one: reload into it.
      if (s.state === 'updated' && s.version && s.version !== pageBuild()) {
        toast(t('Updated to {0}. Reloading…', s.version))
        setTimeout(() => location.reload(), 1200)
      } else toast(statusText(s))
    }, POLL_MS)
  }

  const start = async () => {
    if (busy) return
    setBusy('asking')
    try {
      await api('/api/admin/update', { method: 'POST', body: '{}' })
      follow(info?.status?.at || null, Date.now())
    } catch (e) {
      setBusy(null)
      toast(e?.message || t('Could not ask the server to update'))
    }
  }

  const subtitle = busy === 'restarting' ? t('Restarting on the new build…')
    : busy ? t('Checking and installing, this takes a minute or two…')
    : statusText(info.status) + (info.status?.version ? ' · ' + info.status.version : '')
  return <Row icon="download" iconTint="var(--acc)" title={t('Update this server')} subtitle={subtitle}
    accessory={busy ? 'none' : 'chevron'} onClick={start} />
}
