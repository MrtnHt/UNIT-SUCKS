/**
 * UNIT SEQUENCER — taste + shelf middleware (Module 2, server side)
 *
 * Backed by the PUBLIC WooCommerce Store API of unitbreda.nl — read-only,
 * no consumer keys needed (verified live: /wp-json/wc/store/v1/* is open).
 *
 *   POST /api/taste            classifier tags → shop CATEGORIES → products
 *   GET /api/products/random   shelf tier 3 (src/shop/shelfStore.js)
 *
 * The shop's curated taxonomy is categories, not tags (tags are unused there).
 * CATEGORY_MAP translates classifier slugs → real unitbreda.nl category slugs.
 * Product descriptions embed per-track MP3s → mapped to previewUrl.
 *
 * Env: WC_URL (default https://unitbreda.nl), TASTE_LOG_URL (optional)
 */
import { KNOWN_TAGS } from '../src/integration/tasteProfile.js';

const TASTE_CACHE_TTL_MS = 10 * 60 * 1000;
const RANDOM_CACHE_TTL_MS = 60 * 1000;
const KNOWN_TAG_SET = new Set(KNOWN_TAGS);
const WC_URL = () => process.env.WC_URL ?? 'https://unitbreda.nl';

/** Classifier tag slug → unitbreda.nl product-category slug (live taxonomy). */
const CATEGORY_MAP = {
  'hardcore-vinyl': 'hardcore',
  'early-rave': 'hardcore',
  'acid-tekno': 'free-tekno',
  'tekno': 'free-tekno',
  'industrial-tekno': 'industrial',
  'jungle': 'jungle_drum_and_bass',
  'breakcore': 'jungle_drum_and_bass',
  'electro-acid': 'electronic_house_edm_down-tempo_new-beat_big-beat',
};

// ---------------------------------------------------------------------------
// Module-level caches — live for the isolate's lifetime.
// ---------------------------------------------------------------------------

/** Lazy, once-per-isolate: category slug -> Store API category id. */
let catMapPromise = null;

const tasteCache = new Map(); // sorted tag key -> { at, body }
const randomCache = new Map(); // query key -> { at, body }

// ---------------------------------------------------------------------------
// Store API adapter (public, unauthenticated)
// ---------------------------------------------------------------------------

async function fetchCategoryMap() {
  const res = await fetch(`${WC_URL()}/wp-json/wc/store/v1/products/categories?per_page=100`);
  if (!res.ok) throw new Error(`Store API category lookup failed: ${res.status}`);
  const cats = await res.json();
  return new Map(cats.map((c) => [c.slug, c.id]));
}

function getCategoryMap() {
  if (!catMapPromise) catMapPromise = fetchCategoryMap().catch((err) => { catMapPromise = null; throw err; });
  return catMapPromise;
}

/** Store API product -> shelf-record shape (docs/02 §2.3). Prices are in minor units. */
function mapProduct(p, matchedTag) {
  const minor = p.prices?.currency_minor_unit ?? 2;
  const price = p.prices?.price != null
    ? (Number(p.prices.price) / 10 ** minor).toFixed(minor)
    : null;
  const previewUrl = /https?:\/\/[^"'\s]+?\.mp3/.exec(p.description ?? '')?.[0] ?? null;
  return {
    id: p.id,
    name: p.name,
    price,
    currency: p.prices?.currency_code ?? 'EUR',
    permalink: p.permalink,
    image: p.images?.[0]?.src ?? null,
    stockStatus: p.is_in_stock ? 'instock' : 'outofstock',
    matchedTag: matchedTag ?? null,
    previewUrl,
  };
}

async function fetchProductsByTags(tagSlugs) {
  const catMap = await getCategoryMap();
  // classifier tags → category slugs (deduped) → Store API ids
  const catSlugs = [...new Set(tagSlugs.map((t) => CATEGORY_MAP[t]).filter(Boolean))];
  const ids = catSlugs.map((slug) => catMap.get(slug)).filter(Boolean);
  if (ids.length === 0) return [];

  const res = await fetch(
    `${WC_URL()}/wp-json/wc/store/v1/products?category=${ids.join(',')}&per_page=4&stock_status=instock`,
  );
  if (!res.ok) throw new Error(`Store API product lookup failed: ${res.status}`);
  const products = await res.json();

  return products.map((p) => {
    const productCatSlugs = (p.categories ?? []).map((c) => c.slug);
    const matchedTag = tagSlugs.find((t) => productCatSlugs.includes(CATEGORY_MAP[t])) ?? tagSlugs[0];
    return mapProduct(p, matchedTag);
  });
}

async function fetchRandomProducts({ instock, perPage }) {
  // Store API has no orderby=rand; over-fetch by popularity and sample.
  const params = new URLSearchParams({ per_page: '20', orderby: 'popularity' });
  if (instock) params.set('stock_status', 'instock');

  const res = await fetch(`${WC_URL()}/wp-json/wc/store/v1/products?${params}`);
  if (!res.ok) throw new Error(`Store API random lookup failed: ${res.status}`);
  const products = await res.json();

  return products
    .sort(() => Math.random() - 0.5)
    .slice(0, perPage)
    .map((p) => mapProduct(p, null));
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
