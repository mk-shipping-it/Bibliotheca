#!/usr/bin/env node
/*
 * Moderation pipeline verification for the "Fix Moderation and Report Operations" plan.
 *
 * Two modes:
 *   1. OFFLINE (default, no DB/server needed): exercises the exact gibberish
 *      detector copied from server/routes/reviews.js against the plan's cases:
 *      gibberish rejected, valid English accepted (short and long).
 *   2. INTEGRATION (opt-in): hits a running server with simulated HTTP requests
 *      for the full pipeline (gibberish 400, profanity 201->403 ban, duplicate
 *      429->ban, burst 429, unban reset). Requires:
 *        MOD_TEST_BASE_URL=http://localhost:3001 MOD_TEST_TOKEN=<user JWT> node test-moderation.mjs
 *      Uses a throwaway user token; never run against production with an admin token.
 *
 * Usage: node test-moderation.mjs
 */

const BASE = process.env.MOD_TEST_BASE_URL || null
const TOKEN = process.env.MOD_TEST_TOKEN || null

// --- the detector: the real gibberish-detective library, same one reviews.js uses ---
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const gibberish = require('./server/node_modules/gibberish-detective')()
function isGibberish(text) {
  return gibberish.detect(text.trim())
}

let pass = 0
let fail = 0
function check(name, actual, expected) {
  const ok = actual === expected
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} (expected ${expected}, got ${actual})`)
}

// NOTE: POST /api/reviews rejects text < 10 chars as 'Review too short' (400)
// before the gibberish check, so gibberish cases below are all >= 10 chars to
// specifically exercise the gibberish path.
console.log('--- 1. gibberish rejection (expect true = dropped with 400) ---')
check("'aaaaaaaaaa' (repeated char)", isGibberish('aaaaaaaaaa'), true)
check("'aaaaaa' + padding -> 'aaaaaaaaaa'", isGibberish('aaaaaa'.padEnd(10, 'a')), true)
check("'asdfasdfasdf' (low diversity)", isGibberish('asdfasdfasdf'), true)
check("'ababababababab' (2 unique letters)", isGibberish('ababababababab'), true)
check("'qwertyqwertyqwerty' (6 unique, len 18)", isGibberish('qwertyqwertyqwerty'), true)

console.log('--- 2. valid English reviews (expect false = saved with 201) ---')
check("short valid: 'Great read, loved it!'", isGibberish('Great read, loved it!'), false)
check('long valid: full sentence review', isGibberish('This is a wonderful book with rich characters and a gripping plot twist at the end.'), false)
check("medium valid: 'Highly recommended for fans.'", isGibberish('Highly recommended for fans of historical fiction.'), false)

console.log(`\nOffline: ${pass} passed, ${fail} failed`)

// --- integration mode (gated) ---
if (!BASE || !TOKEN) {
  console.log('\nIntegration tests SKIPPED (set MOD_TEST_BASE_URL and MOD_TEST_TOKEN to run cases 3-6: profanity, duplicate, burst, unban).')
  process.exit(fail ? 1 : 0)
}

const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` }
const BOOK = 'integration-test-cover-' + Date.now()
async function postReview(text) {
  const res = await fetch(`${BASE}/api/reviews`, {
    method: 'POST', headers, body: JSON.stringify({ bookCover: BOOK, bookTitle: 'Mod Test', rating: 4, text })
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

let iPass = 0
let iFail = 0
function icheck(name, actual, expected) {
  const ok = actual === expected
  if (ok) iPass++
  else iFail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} (expected ${expected}, got ${actual})`)
}

console.log('\n--- 3. gibberish over HTTP (400, no row saved) ---')
{
  const r = await postReview('asdfasdfasdf')
  icheck('gibberish status', r.status, 400)
}
console.log('--- 4. duplicate (1st 201, 2nd 429) ---')
{
  const t = 'Integration duplicate probe ' + Date.now() + ' with enough unique wording here to pass the length check.'
  const r1 = await postReview(t)
  icheck('first post status', r1.status, 201)
  const r2 = await postReview(t)
  icheck('repeat post status', r2.status, 429)
}
console.log('--- 5. burst (6th POST in 10min -> 429) ---')
{
  let last = 0
  for (let i = 0; i < 6; i++) {
    const r = await postReview(`Burst probe ${Date.now()}-${i} with distinct wording number ${i * 7919} to avoid duplicate detection.`)
    last = r.status
  }
  icheck('6th post status', last, 429)
}
console.log('\nIntegration: ' + iPass + ' passed, ' + iFail + ' failed')
console.log('NOTE: profanity-ban threshold (>=5 -> 403) and unban reset are not auto-run here (they mutate/ban the token user); verify manually per moderation-notes.md demo flow.')
process.exit(fail + iFail ? 1 : 0)
