/* Meal estimates (coach/nutrition.js, coach/core/nutrition.js): the validator every answer
   passes, the photo check, the prompt, each provider's image part, and the job loop end to end
   through the fixture provider. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData, writeState, sampleState } from './helpers.mjs';

const DIR = tempData();
const cfg = await import('../coach/config.js');
const N = await import('../coach/nutrition.js');
const { validateMeal, buildMealPrompt, MEAL_SYSTEM, FIXTURE_MEAL } = await import('../coach/core/nutrition.js');
const { anthropicSpec } = await import('../coach/core/adapters/anthropic.js');
const { openaiSpec } = await import('../coach/core/adapters/openai.js');
const { geminiSpec } = await import('../coach/core/adapters/gemini.js');
const { SYSTEM_PROMPT } = await import('../coach/core/system-prompt.js');
const { forcePrivilegeVerdict } = await import('../coach/adapters/spawn.js');
const ADAPTERS = (await import('../coach/adapters/index.js')).default;

cfg.save({ enabled: true, provider: 'fixture' });
forcePrivilegeVerdict({ ok: true, dropped: false, why: 'pinned by the test suite' });

const consented = (over = {}) => sampleState({ nutConsent: { agreedAt: new Date().toISOString(), version: 1 }, ...over });
// The smallest real JPEG header the photo check accepts (FF D8 FF), padded.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 1)]).toString('base64');
async function settle(uid, ms = 10000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const s = N.current(uid);
    if (s.job && s.job.state !== 'running') return s;
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error('estimate never finished');
}

/* ---------------------------------------------------------------- the validator */

test('a fixture answer passes, and the totals are the items\' sum', () => {
  const r = validateMeal({ ...FIXTURE_MEAL, kcal: 9999 })
  assert.equal(r.ok, true);
  assert.equal(r.result.kcal, 580);
  assert.equal(r.result.p, 30);
  assert.equal(r.result.items.length, 2);
  assert.equal(r.result.confidence, 'medium');
});

test('without items, the stated totals stand', () => {
  const r = validateMeal({ nutrition_contract: 1, food: true, name: 'Latte', items: [], kcal: 190, p: 10, c: 15, f: 10, confidence: 'high', note: '' });
  assert.equal(r.ok, true);
  assert.deepEqual([r.result.kcal, r.result.p, r.result.c, r.result.f], [190, 10, 15, 10]);
});

test('energy that cannot come from the macros is refused', () => {
  const r = validateMeal({ nutrition_contract: 1, food: true, name: 'Salad', items: [], kcal: 900, p: 5, c: 10, f: 2, confidence: 'high', note: '' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /does not agree with the macros/);
});

test('out-of-range numbers, missing names and a wrong contract are each named', () => {
  const r = validateMeal({ nutrition_contract: 2, food: true, name: '', items: [{ name: '', grams: -1, kcal: 99999, p: 'x', c: 0, f: 0 }], kcal: 1, p: 0, c: 0, f: 0 });
  assert.equal(r.ok, false);
  const all = r.errors.join(' | ');
  for (const bit of ['nutrition_contract', '"name" is missing', 'item 1 has no name', 'grams', 'kcal must be', 'p must be']) assert.ok(all.includes(bit), bit);
});

test('"no food in the photo" is an answer, not a failure', () => {
  assert.deepEqual(validateMeal({ nutrition_contract: 1, food: false, note: 'A cat.' }), { ok: true, result: { food: false, note: 'A cat.' } });
});

test('what is not an object is refused', () => {
  for (const v of [null, [], 'meal', 3]) assert.equal(validateMeal(v).ok, false);
});

/* ---------------------------------------------------------------- prompt and photo */

test('the prompt carries the person\'s words as data, the language, and the repair list', () => {
  const p = buildMealPrompt({ note: 'large\nportion', meal: 'lunch', lang: 'de', hasImage: true, repair: ['kcal is wrong'] });
  assert.match(p, /The photo above is the meal/);
  assert.match(p, /"language":"de"/);
  assert.match(p, /"meal":"lunch"/);
  assert.match(p, /"description":"large portion"/);
  assert.match(p, /- kcal is wrong/);
  assert.match(buildMealPrompt({ note: 'rice', lang: 'not a tag!' }), /"language":"en"/);
  assert.match(buildMealPrompt({ note: 'rice' }), /no photo/);
});

test('a photo is accepted by its own bytes only', () => {
  assert.deepEqual(N.readImage({ mime: 'image/jpeg', data: JPEG }), { mime: 'image/jpeg', data: JPEG });
  // claims PNG, is a JPEG: read as the JPEG it is
  assert.equal(N.readImage({ mime: 'image/png', data: JPEG }).mime, 'image/jpeg');
  assert.equal(N.readImage({ mime: 'image/jpeg', data: Buffer.from('GIF89a........').toString('base64') }), null);
  assert.equal(N.readImage({ mime: 'image/gif', data: JPEG }), null);
  assert.equal(N.readImage({ mime: 'image/jpeg', data: 'not base64 !' }), null);
  assert.equal(N.readImage({ mime: 'image/jpeg', data: 'A'.repeat(3 * 1024 * 1024) }), null);
});

/* ---------------------------------------------------------------- providers */

const IMG = [{ mime: 'image/jpeg', data: 'QUJD' }];
test('Anthropic gets the photo as an image block before the words, under the nutrition rules', () => {
  const b = anthropicSpec.body({ model: 'm', prompt: 'P', system: null, maxTokens: 10, images: IMG, baseSystem: MEAL_SYSTEM });
  assert.equal(b.system, MEAL_SYSTEM);
  assert.deepEqual(b.messages[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } });
  assert.deepEqual(b.messages[0].content[1], { type: 'text', text: 'P' });
  // a training job is unchanged
  const t = anthropicSpec.body({ model: 'm', prompt: 'P', system: null, maxTokens: 10 });
  assert.equal(t.system, SYSTEM_PROMPT);
  assert.equal(t.messages[0].content, 'P');
});

test('Chat Completions gets a data: URL image part; Gemini an inline_data part', () => {
  const o = openaiSpec.body({ model: 'm', prompt: 'P', maxTokens: 10, images: IMG, baseSystem: MEAL_SYSTEM });
  assert.equal(o.messages[0].content, MEAL_SYSTEM);
  assert.deepEqual(o.messages[1].content[1], { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } });
  const g = geminiSpec.body({ prompt: 'P', maxTokens: 10, images: IMG, baseSystem: MEAL_SYSTEM });
  assert.deepEqual(g.contents[0].parts[0], { inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } });
  assert.equal(g.systemInstruction.parts[0].text, MEAL_SYSTEM);
  assert.equal(openaiSpec.body({ model: 'm', prompt: 'P', maxTokens: 10 }).messages[1].content, 'P');
});

test('every provider says whether it can read a photo', () => {
  for (const [id, a] of Object.entries(ADAPTERS)) assert.equal(typeof a.images, 'boolean', id);
  assert.equal(ADAPTERS.codex.images, false);
  assert.equal(ADAPTERS.claude.images, true);
});

/* ---------------------------------------------------------------- the loop */

test('no consent of its own, no estimate — the training Coach\'s consent is not enough', () => {
  writeState(DIR, 'n-noconsent', sampleState());
  assert.throws(() => N.enqueue('n-noconsent', { note: 'rice' }), e => e.code === 'consent');
});

test('neither a photo nor words is refused before anything is spent', () => {
  writeState(DIR, 'n-empty', consented());
  assert.throws(() => N.enqueue('n-empty', {}), e => e.code === 'input');
  assert.throws(() => N.enqueue('n-empty', { image: { mime: 'image/jpeg', data: 'nope' } }), e => e.code === 'input');
  assert.equal(N.used('n-empty'), 0);
});

test('a photo goes through to a checked estimate, once at a time, and counts', async () => {
  const uid = 'n-photo';
  writeState(DIR, uid, consented());
  const { id } = N.enqueue(uid, { image: { mime: 'image/jpeg', data: JPEG }, meal: 'lunch', lang: 'en' });
  assert.throws(() => N.enqueue(uid, { note: 'again' }), e => e.code === 'busy');
  const s = await settle(uid);
  assert.equal(s.job.id, id);
  assert.equal(s.job.state, 'ready');
  assert.equal(s.job.result.name, 'Chicken rice');
  assert.equal(s.job.result.kcal, 580);
  assert.deepEqual(s.cap, { used: 1, limit: N.DAILY_CAP });
  N.forget(uid);
  assert.equal(N.current(uid).job, null);
});

test('the daily count is enforced', async () => {
  const uid = 'n-cap';
  writeState(DIR, uid, consented());
  for (let i = 0; i < N.DAILY_CAP; i++) { N.enqueue(uid, { note: 'rice ' + i }); await settle(uid); }
  assert.throws(() => N.enqueue(uid, { note: 'one more' }), e => e.code === 'cap');
});

test('a provider that cannot read photos still takes a description', async () => {
  cfg.save({ provider: 'codex' });
  try {
    writeState(DIR, 'n-codex', consented());
    // codex is not connected in the test, so the Coach is off before photos are even asked about
    assert.throws(() => N.enqueue('n-codex', { image: { mime: 'image/jpeg', data: JPEG } }), e => e.code === 'off' || e.code === 'noimages');
  } finally { cfg.save({ provider: 'fixture' }); }
});

test('with the Coach off there are no estimates at all', () => {
  cfg.save({ enabled: false });
  try {
    writeState(DIR, 'n-off', consented());
    assert.throws(() => N.enqueue('n-off', { note: 'rice' }), e => e.code === 'off');
    assert.equal(N.imagesSupported(), true);
  } finally { cfg.save({ enabled: true }); }
});

test('the rules cover descriptions without a photo, brands and several items', () => {
  assert.match(MEAL_SYSTEM, /nutrition label/);
  assert.match(MEAL_SYSTEM, /From words alone/);
  assert.match(MEAL_SYSTEM, /two items/);
  const p = buildMealPrompt({ note: 'a scoop of MuscleBlaze whey and an apple', meal: 'snack' });
  assert.match(p, /There is no photo; estimate from the description alone/);
  assert.match(p, /"source":"description"/);
  assert.match(p, /MuscleBlaze whey and an apple/);
});

test('a description alone goes through to an estimate', async () => {
  const uid = 'n-words';
  writeState(DIR, uid, consented());
  N.enqueue(uid, { note: 'a scoop of MuscleBlaze whey and an apple', meal: 'snack' });
  const s = await settle(uid);
  assert.equal(s.job.state, 'ready');
  N.forget(uid);
});

/* ---------------------------------------------------------------- several photos */

test('several photos of one meal go to the provider together, with the words after them', async () => {
  const uid = 'n-photos';
  writeState(DIR, uid, consented());
  // Record what the fixture is handed, then put it back as it was.
  const real = ADAPTERS.fixture.invoke;
  let seen = null;
  ADAPTERS.fixture.invoke = async opts => { seen = opts; return real.call(ADAPTERS.fixture, opts); };
  try {
    const img = { mime: 'image/jpeg', data: JPEG };
    N.enqueue(uid, { images: [img, img, img], note: 'plus a glass of milk', meal: 'dinner' });
    const s = await settle(uid);
    assert.equal(s.job.state, 'ready');
    assert.equal(seen.images.length, 3);
    assert.match(seen.prompt, /The 3 photos above are one meal: count each food once/);
    assert.match(seen.prompt, /"source":"photo and description"/);
    assert.equal(N.used(uid), 1, 'one estimate however many photos');
  } finally { ADAPTERS.fixture.invoke = real; N.forget(uid); }
});

test('more photos than allowed, or one unreadable among them, is refused before anything is spent', () => {
  const uid = 'n-photos-bad';
  writeState(DIR, uid, consented());
  const img = { mime: 'image/jpeg', data: JPEG };
  assert.throws(() => N.enqueue(uid, { images: Array(N.MAX_IMAGES + 1).fill(img) }), e => e.code === 'input');
  assert.throws(() => N.enqueue(uid, { images: [img, { mime: 'image/jpeg', data: 'nope' }] }), e => e.code === 'input');
  assert.equal(N.used(uid), 0);
});

test('one photo keeps the single-photo wording, and the older `image` field still works', async () => {
  assert.match(buildMealPrompt({ hasImage: true }), /The photo above is the meal\./);
  assert.match(buildMealPrompt({ hasImage: true, photoCount: 1 }), /The photo above is the meal\./);
  const uid = 'n-photo-legacy';
  writeState(DIR, uid, consented());
  N.enqueue(uid, { image: { mime: 'image/jpeg', data: JPEG } });
  assert.equal((await settle(uid)).job.state, 'ready');
  N.forget(uid);
});
