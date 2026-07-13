/**
 * UNIT SEQUENCER — taste + shelf middleware (Module 2, server side)
 *
 * Deployable as a Cloudflare Worker / Vercel function / 1-file Express app.
 * Two routes, both reading from the same WooCommerce store:
 *
 *   POST /api/taste            (docs/02-WEBSHOP-INTEGRATION.md §2.1/§2.3/§2.4)
 *     1. validate payload (schema unit.taste-profile.v1, known tag slugs)
 *     2. log profile → analytics store (fire-and-forget, append-only)
 *     3. GET {WC_URL}/wp-json/wc/v3/products?tag={tagIds}&per_page=4
 *        auth: WooCommerce consumer key/secret — SERVER-SIDE ONLY
 *     4. cache per tag-set, TTL 10 min
 *
 *   GET /api/products/random   (shelf tier 3 — src/shop/shelfStore.js)
 *     in-stock catalogue sample, no taste-matching, short cache.
 *
 * Env: WC_URL, WC_KEY, WC_SECRET, WC_CURRENCY, TASTE_LOG_URL
 */
import { KNOWN_TAGS } from '../src/integration/tasteProfile.js';

const TASTE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
const RANDOM_CACHE_TTL_MS = 60 * 1000; // 1 min — keep it feeling "random"
const KNOWN_TAG_SET = new Set(KNOWN_TAGS);

// ---------------------------------------------------------------------------
// Module-level caches — live for the isolate's lifetime.
// ---------------------------------------------------------------------------

/** Lazy, once-per-isolate: tag slug -> WooCommerce tag id. */
let tagMapPromise = null;

/** Product-response cache, keyed by sorted comma-joined tag slugs. */
const tasteCache = new Map(); // key -> { at: number, body: object }

/** Random-products cache, keyed by the raw query string. */
const randomCache = new Map(); // key -> { at: number, body: object }

// ---------------------------------------------------------------------------
// WooCommerce adapter
// ---------------------------------------------------------------------------

function wcAuthHeader() {
  const raw = `${process.env.WC_KEY}:${process.env.WC_SECRET}`;
  const token = typeof Buffer !== 'undefined'
    ? Buffer.from(raw).toString('base64')
    : btoa(raw);
  return `Basic ${token}`;
}

async function fetchTagMap() {
  const res = await fetch(`${process.env.WC_URL}/wp-json/wc/v3/products/tags?per_page=100`, {
    headers: { Authorization: wcAuthHeader() },
  });
  if (!res.ok) throw new Error(`WooCommerce tag lookup failed: ${res.status}`);
  const tags = await res.json();
  return new Map(tags.map((t) => [t.slug, t.id]));
}

function getTagMap() {
  if (!tagMapPromise) tagMapPromise = fetchTagMap().catch((err) => { tagMapPromise = null; throw err; });
  return tagMapPromise;
}

/** Shared WooCommerce product -> shelf-record shape (docs/02 §2.3). */
function mapProduct(p, matchedTag) {
  const productTagSlugs = (p.tags ?? []).map((t) => t.slug);
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    currency: process.env.WC_CURRENCY ?? 'EUR',
    permalink: p.permalink,
    image: p.images?.[0]?.src ?? null,
    stockStatus: p.stock_status,
    matchedTag: matchedTag ?? productTagSlugs.find((s) => KNOWN_TAG_SET.has(s)) ?? null,
  };
}

async function fetchProductsByTags(tagSlugs) {
  const tagMap = await getTagMap();
  const ids = tagSlugs.map((slug) => tagMap.get(slug)).filter(Boolean);

  const res = await fetch(
    `${process.env.WC_URL}/wp-json/wc/v3/products?tag=${ids.join(',')}&per_page=4&status=publish`,
    { headers: { Authorization: wcAuthHeader() } },
  );
  if (!res.ok) throw new Error(`WooCommerce product lookup failed: ${res.status}`);
  const products = await res.json();

  return products.map((p) => {
    const productTagSlugs = (p.tags ?? []).map((t) => t.slug);
    const matchedTag = tagSlugs.find((slug) => productTagSlugs.includes(slug)) ?? tagSlugs[0];
    return mapProduct(p, matchedTag);
  });
}

async function fetchRandomProducts({ instock, perPage }) {
  const params = new URLSearchParams({ per_page: String(perPage), status: 'publish', orderby: 'rand' });
  if (instock) params.set('stock_status', 'instock');

  const res = await fetch(
    `${process.env.WC_URL}/wp-json/wc/v3/products?${params}`,
    { headers: { Authorization: wcAuthHeader() } },
  );
  if (!res.ok) throw new Error(`WooCommerce random lookup failed: ${res.status}`);
  const products = await res.json();
  return products.map((p) => mapProduct(p, null));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateTastePayload(body) {
  if (!body || body.schema !== 'unit.taste-profile.v1') return 'invalid_schema';
  if (!body.audioState || typeof body.audioState !== 'object') return 'invalid_audio_state';
  const tags = body.profile?.tags;
  if (!Array.isArray(tags) || tags.length === 0) return 'invalid_tags';
  if (!tags.every((t) => KNOWN_TAG_SET.has(t))) return 'unknown_tag';
  return null;
}

// ---------------------------------------------------------------------------
// Taste log — fire-and-forget, never blocks the response.
// ---------------------------------------------------------------------------

function logTaste(body) {
  if (!process.env.TASTE_LOG_URL) return;
  fetch(process.env.TASTE_LOG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {
    // analytics store offline ≠ request failure
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleTaste(request) {
  const body = await request.json().catch(() => null);
  const error = validateTastePayload(body);
  if (error) return json(422, { error });

  logTaste(body);

  const tagSlugs = body.profile.tags;
  const cacheKey = [...tagSlugs].sort().join(',');
  const cached = tasteCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TASTE_CACHE_TTL_MS) {
    return json(200, { products: cached.body, cacheAge: Math.floor((Date.now() - cached.at) / 1000) });
  }

  const products = await fetchProductsByTags(tagSlugs);
  tasteCache.set(cacheKey, { at: Date.now(), body: products });

  return json(200, { products, cacheAge: 0 });
}

export async function handleProductsRandom(request) {
  const { searchParams } = new URL(request.url);
  const instock = searchParams.get('instock') === '1';
  const perPage = Math.min(20, Math.max(1, Number(searchParams.get('per_page')) || 4));

  const cacheKey = `${instock ? 'instock' : 'all'}:${perPage}`;
  const cached = randomCache.get(cacheKey);
  if (cached && Date.now() - cached.at < RANDOM_CACHE_TTL_MS) {
    return json(200, { products: cached.body, cacheAge: Math.floor((Date.now() - cached.at) / 1000) });
  }

  const products = await fetchRandomProducts({ instock, perPage });
  randomCache.set(cacheKey, { at: Date.now(), body: products });

  return json(200, { products, cacheAge: 0 });
}

// ---------------------------------------------------------------------------

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Cloudflare Worker entry. Rate limiting: bind a KV/DO or use CF rules. */
export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (request.method === 'POST' && pathname === '/api/taste') return handleTaste(request);
    if (request.method === 'GET' && pathname === '/api/products/random') return handleProductsRandom(request);
    return json(404, { error: 'not_found' });
  },
};
