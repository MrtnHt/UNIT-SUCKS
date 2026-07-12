/**
 * UNIT — vinyl shelf data chain (spec §B.2).
 *
 * getShelfRecords(profile) resolves through 4 tiers and ALWAYS returns 2–4
 * records. Every tier degrades silently; a broken shop looks identical to a
 * stocked crate. The served tier is tagged for owner analytics only (never UI).
 *
 *   1 MATCHED   POST /api/taste            (live taste match)
 *   2 LAST-GOOD sessionStorage cache       (TTL 30 min)
 *   3 RANDOM    GET  /api/products/random  (in-stock crates)
 *   4 SEED      bundled seedRecords.json   (evergreen releases)
 */
import SEED_RECORDS from './seedRecords.json';

const CACHE_KEY = 'unit.shelf.lastgood';
const CACHE_TTL_MS = 30 * 60 * 1000;
const TIER_TIMEOUT_MS = 3000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function clampRecords(list) {
  const arr = Array.isArray(list) ? list.filter(Boolean) : [];
  return arr.slice(0, 4);
}

function isValid(list) {
  return Array.isArray(list) && list.length >= 2;
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, records } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return isValid(records) ? records : null;
  } catch { return null; }
}

function writeCache(records) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), records }));
  } catch { /* private mode / quota — non-fatal */ }
}

async function tierMatched(profile) {
  const res = await withTimeout(fetch('/api/taste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile }),
  }), TIER_TIMEOUT_MS);
  if (!res.ok) throw new Error(`taste ${res.status}`);
  const data = await res.json();
  return clampRecords(data.products);
}

async function tierRandom() {
  const res = await withTimeout(
    fetch('/api/products/random?instock=1&per_page=4'),
    TIER_TIMEOUT_MS,
  );
  if (!res.ok) throw new Error(`random ${res.status}`);
  const data = await res.json();
  return clampRecords(data.products);
}

/**
 * @param {object} profile  taste profile (tags, primaryTag, ...)
 * @returns {Promise<{tier:string, records:object[]}>}  records.length in [2,4]
 */
export async function getShelfRecords(profile) {
  // Tier 1
  try {
    const records = await tierMatched(profile);
    if (isValid(records)) { writeCache(records); return { tier: 'MATCHED', records }; }
  } catch { /* fall through */ }

  // Tier 2
  const cached = readCache();
  if (isValid(cached)) return { tier: 'LAST_GOOD', records: cached };

  // Tier 3
  try {
    const records = await tierRandom();
    if (isValid(records)) return { tier: 'RANDOM', records }; // do NOT cache as match
  } catch { /* fall through */ }

  // Tier 4 — bundled, cannot fail
  return { tier: 'SEED', records: clampRecords(SEED_RECORDS) };
}
