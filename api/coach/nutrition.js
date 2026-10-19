/* Meal estimates: a photo (or a few words) in, a checked estimate of its kcal and macros out.
 *
 * The same provider, credential, privilege drop and instance cap as the training Coach, and the
 * same rule that nothing the model says is acted on by the server: the estimate goes back to the
 * app, which shows it as a card the person edits and confirms (frontend/src/views/MealPhoto.jsx).
 * Only then does a food-log entry exist, written by the app like any other.
 *
 * What is different, and why:
 *   - Its own consent (`nutConsent` in the profile's state). The training Coach's consent screen
 *     lists what a plan job sends; a photo of a plate is not on that list.
 *   - Its own daily count (NUTRITION_DAILY_CAP, 30 by default): people log several meals a day,
 *     and the training Coach's ten jobs would be gone by lunch. The instance-wide cap still
 *     counts every estimate.
 *   - One at a time per profile and one at a time on the instance: an estimate runs the
 *     provider's runtime for a few seconds to a minute, and on a small box (a Raspberry Pi) two
 *     runtimes at once are what runs out of memory.
 *   - Nothing is stored. The photo lives in this process for the length of the call, and the
 *     answer for ten minutes after it, until the app collects it. A restart loses both; the app
 *     says the estimate failed and the person tries again.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import * as cfgStore from './config.js';
import { adapterFor } from './adapters/index.js';
import { canDropPrivileges, unprivilegedIds } from './adapters/spawn.js';
import { fetchFor } from './node-fetch.js';
import { extractJSON } from './core/parse.js';
import { MEAL_SYSTEM, MEAL_SCHEMA, buildMealPrompt, validateMeal } from './core/nutrition.js';
import { readState, shareJobDir, removeJobDir, bumpInstanceDaily, instanceUsedToday } from './jobs.js';
import { langTag } from './core/payload.js';

const DATA = process.env.DATA_DIR || '/data';
const COACH_DIR = path.join(DATA, 'coach');
export const DAILY_CAP = Math.max(0, Math.min(500, Number.parseInt(process.env.NUTRITION_DAILY_CAP || '30', 10) || 0));
// A photo through a runtime on a small CPU, or a local vision model, can take a while; still far
// below the training Coach's budget, because someone is holding the phone waiting.
const TIMEOUT_MS = Math.max(60000, Math.min(10 * 60000, +process.env.NUTRITION_TIMEOUT_MS || 3 * 60000));
const KEEP_MS = 10 * 60000;
// What the app sends is already shrunk to 1024 px (lib/meal-photo.js); this is a ceiling, not a target.
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const USER_ERROR = {
  off: 'the Coach is not set up on this instance',
  noimages: 'the AI provider on this instance cannot read photos',
  busy: 'still reading your last meal',
  cap: 'that is all the meal estimates for today, try again tomorrow',
  consent: 'meal estimates need your go-ahead first',
  shared: cfgStore.SHARED_ACCOUNT_REFUSAL,
  unprivileged: 'the Coach is switched off on this instance for safety reasons',
  input: 'send a photo or a description of the meal'
};
const HTTP_FOR = { off: 503, noimages: 400, busy: 409, cap: 429, consent: 403, shared: 409, unprivileged: 503, input: 400 };

export class NutritionError extends Error {
  constructor(code) { super(USER_ERROR[code] || code); this.code = code; }
}

/* ---------- the daily count, one small file per profile ---------- */

const safe = uid => String(uid).replace(/[^a-zA-Z0-9_-]/g, '');
const countFile = uid => path.join(COACH_DIR, 'nutrition-' + safe(uid) + '.json');
const todayISO = () => new Date().toISOString().slice(0, 10);
export function used(uid) {
  try {
    const d = JSON.parse(fs.readFileSync(countFile(uid), 'utf8'));
    return d.date === todayISO() ? Number(d.count) || 0 : 0;
  } catch { return 0; }
}
function bump(uid) {
  fs.mkdirSync(COACH_DIR, { recursive: true, mode: 0o700 });
  const n = used(uid) + 1;
  const file = countFile(uid), tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ date: todayISO(), count: n }), { mode: 0o600 });
  fs.renameSync(tmp, file);
  return n;
}
export const capState = uid => ({ used: used(uid), limit: DAILY_CAP });

/* ---------- the photo ---------- */

/** The decoded photo, checked by its own bytes rather than the type it claims, or null. */
export function readImage(img) {
  if (!img || typeof img !== 'object' || typeof img.data !== 'string' || !IMAGE_MIMES.has(img.mime)) return null;
  if (img.data.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(img.data)) return null;
  const buf = Buffer.from(img.data, 'base64');
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  const mime = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : null;
  if (!mime) return null;
  return { mime, data: img.data };
}

/* ---------- jobs ---------- */

const jobs = new Map();      // uid → { id, state, result?, errorClass?, at }
let running = 0;
const waiting = [];

function sweep() {
  const now = Date.now();
  for (const [uid, j] of jobs) if (j.state !== 'running' && now - j.at > KEEP_MS) jobs.delete(uid);
}

/** Whether the configured provider can read a photo at all — what the app's Photo button hangs on. */
export function imagesSupported() {
  const a = adapterFor(cfgStore.load().provider);
  return !!(a && a.images);
}

/**
 * Starts an estimate for `uid`. Throws NutritionError with the code the route maps to a status:
 * off, noimages, busy, cap, consent, shared, unprivileged, input.
 */
export function enqueue(uid, { image = null, note = '', meal = null, lang = null } = {}) {
  sweep();
  if (!cfgStore.isEnabled() || !cfgStore.isConnected()) throw new NutritionError('off');
  const cfg = cfgStore.load();
  const adapter = adapterFor(cfg.provider);
  if (!adapter) throw new NutritionError('off');
  const photo = image ? readImage(image) : null;
  if (image && !photo) throw new NutritionError('input');
  const words = String(note || '').slice(0, 400).trim();
  if (!photo && !words) throw new NutritionError('input');
  if (photo && !adapter.images) throw new NutritionError('noimages');
  if (jobs.get(uid)?.state === 'running') throw new NutritionError('busy');

  // Consent is checked here, on the server, not only by the screen that asks for it.
  const S = readState(uid);
  if (!S?.nutConsent?.agreedAt) throw new NutritionError('consent');

  const cred = cfgStore.credentialFor(uid);
  if (!cred.ok) throw new NutritionError(cred.reason === 'shared-account' ? 'shared' : 'off');
  cfgStore.bindInstanceCredential(uid);
  if (adapter.spawns !== false && !canDropPrivileges().ok) throw new NutritionError('unprivileged');

  if (DAILY_CAP > 0 && used(uid) >= DAILY_CAP) throw new NutritionError('cap');
  const instanceCap = cfg.caps?.instanceDaily || 0;
  if (instanceCap > 0 && instanceUsedToday() >= instanceCap) throw new NutritionError('cap');
  // Counted when asked, like the training Coach: the cap bounds what a profile can spend.
  bump(uid);
  bumpInstanceDaily();

  const job = { id: crypto.randomBytes(8).toString('hex'), uid, photo, note: words, meal, lang: langTag(lang), startedAt: Date.now() };
  jobs.set(uid, { id: job.id, state: 'running', at: Date.now() });
  waiting.push(job);
  pump();
  return { id: job.id };
}

function pump() {
  while (running < 1 && waiting.length) {
    const job = waiting.shift();
    running++;
    execute(job)
      .catch(e => { console.error('nutrition estimate crashed', job.id, e); done(job, { state: 'failed', errorClass: 'internal' }); })
      .finally(() => { running--; pump(); });
  }
}

function done(job, outcome) {
  cfgStore.logJob({
    at: new Date().toISOString(), uid: job.uid, kind: 'meal', trigger: 'manual',
    outcome: outcome.state === 'ready' ? 'ready' : 'failed', errorClass: outcome.errorClass || null,
    ms: Date.now() - job.startedAt, detail: outcome.detail || null
  });
  // Only the job the profile is still waiting on: a forget or a newer job replaced it otherwise.
  if (jobs.get(job.uid)?.id !== job.id) return;
  jobs.set(job.uid, { id: job.id, at: Date.now(), ...outcome });
}

async function execute(job) {
  const cfg = cfgStore.load();
  const adapter = adapterFor(cfg.provider);
  if (!adapter || !cfgStore.isEnabled()) return done(job, { state: 'failed', errorClass: 'off' });
  const jobDir = adapter.spawns === false ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'meal-'));
  const env = cfgStore.jobEnv(jobDir || os.tmpdir(), cfgStore.credentialFor(job.uid));
  try {
    const ids = jobDir && unprivilegedIds();
    if (ids) shareJobDir(jobDir, ids);
    let repair = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await adapter.invoke({
        cfg, kind: 'meal', jobDir, env, model: cfgStore.modelFor(cfg), timeoutMs: TIMEOUT_MS,
        prompt: buildMealPrompt({ note: job.note, meal: job.meal, lang: job.lang, hasImage: !!job.photo, repair }),
        system: null, baseSystem: MEAL_SYSTEM, schema: MEAL_SCHEMA,
        images: job.photo ? [job.photo] : null,
        fetch: fetchFor(TIMEOUT_MS), maxTokens: 2000
      });
      if (r.timedOut) return done(job, { state: 'failed', errorClass: 'timeout' });
      if (r.spawnError) return done(job, { state: 'failed', errorClass: 'missing', detail: String(r.stderr || '').slice(0, 300) });
      if (r.code !== 0) {
        const err = String(r.stderr || r.text || '');
        const authish = /auth|unauthor|api key|credential|token|401|403|login/i.test(err);
        return done(job, { state: 'failed', errorClass: authish ? 'auth' : 'provider', detail: err.slice(0, 300) });
      }
      const parsed = extractJSON(r.text);
      const checked = parsed.error ? { ok: false, errors: [parsed.error] } : validateMeal(parsed.value);
      if (checked.ok) return done(job, { state: 'ready', result: checked.result });
      repair = checked.errors;
    }
    return done(job, { state: 'failed', errorClass: 'unusable', detail: (repair || []).slice(0, 3).join('; ').replace(/"[^"]*"/g, '"…"').slice(0, 300) });
  } finally {
    if (jobDir) removeJobDir(jobDir, unprivilegedIds());
    job.photo = null;
  }
}

/** What the app polls: the profile's latest estimate, if it is still being kept. */
export function current(uid) {
  sweep();
  const j = jobs.get(uid);
  if (!j) return { job: null, cap: capState(uid) };
  return { job: { id: j.id, state: j.state, ...(j.result ? { result: j.result } : {}), ...(j.errorClass ? { errorClass: j.errorClass } : {}) }, cap: capState(uid) };
}

/** The estimate collected or abandoned by the app: dropped here. */
export function forget(uid) { jobs.delete(uid); }

/* ---------- routes ---------- */

export function nutritionRoutes({ json, readBody, readSession }) {
  const signedIn = (req, res) => {
    const user = readSession(req);
    if (!user) { json(res, 401, { error: 'not signed in' }); return null; }
    return user;
  };
  return {
    'POST /api/nutrition/estimate': async (req, res) => {
      const user = signedIn(req, res); if (!user) return;
      const body = await readBody(req);
      try {
        const job = enqueue(user.id, {
          image: body.image || null,
          note: body.note ? String(body.note) : '',
          meal: typeof body.meal === 'string' ? body.meal : null,
          lang: typeof body.lang === 'string' ? body.lang : null
        });
        json(res, 202, { job });
      } catch (e) {
        if (e instanceof NutritionError) return json(res, HTTP_FOR[e.code] || 400, { error: e.message, code: e.code });
        throw e;
      }
    },
    'GET /api/nutrition/estimate': async (req, res) => {
      const user = signedIn(req, res); if (!user) return;
      json(res, 200, current(user.id));
    },
    'POST /api/nutrition/estimate/done': async (req, res) => {
      const user = signedIn(req, res); if (!user) return;
      forget(user.id);
      json(res, 200, { ok: true });
    }
  };
}

/** For tests: drop every job and the queue. */
export function _reset() { jobs.clear(); waiting.length = 0; }
