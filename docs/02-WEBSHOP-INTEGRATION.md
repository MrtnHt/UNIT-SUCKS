# Module 2 — Webshop Data Integration

Objective: the sequencer becomes a **taste sensor**. What a visitor programs —
tempo, distortion, active channels — is a musical fingerprint. We classify it and
answer with matching vinyl from the UNIT Breda / Tekno sucks webshop, live.

Implementation: [`src/integration/tasteProfile.js`](../src/integration/tasteProfile.js).

---

## 2.1 Architecture blueprint

```
┌─────────────────────────── BROWSER ───────────────────────────┐
│  sequencerState (BPM, fx, channels)                           │
│        │  debounced 3s after last tweak                       │
│        ▼                                                      │
│  tasteProfile.js → classify() → profile + tags                │
│        │  POST /api/taste  (JSON, no PII)                     │
└────────┼──────────────────────────────────────────────────────┘
         ▼
┌─────────────── MIDDLEWARE (Node/serverless, ~50 LOC) ─────────┐
│  1. validate payload (schema below)                           │
│  2. log profile → analytics store (append-only)               │
│  3. GET {shop}/wp-json/wc/store/v1/products?category={ids} │
│     public Store API — read-only, no credentials              │
│  4. cache per tag-set, TTL 10 min                             │
└────────┼──────────────────────────────────────────────────────┘
         ▼
  { products: [ {name, price, permalink, image, stock} ] }
         ▼
  app renders "PRESSED ON WAX — records that sound like your loop"
  panel with add-to-cart deep links
```

Non-negotiables:

1. **Reads go through the public Store API** (`/wp-json/wc/store/v1/*` on
   unitbreda.nl — verified open, no consumer keys needed). The middleware stays
   in place for caching, taste-logging and shape-mapping; if authenticated
   endpoints are ever needed, keys still live server-side only.
2. **Categories are the join key** (not tags — the live shop's tags are unused,
   its categories are already curated: `free-tekno` 293, `hardcore` 160,
   `techno` 106, `jungle_drum_and_bass` 86, `industrial` 14, …). The classifier
   emits its own slugs; `CATEGORY_MAP` in `server/tasteMiddleware.js` translates
   them to shop categories. No owner curation needed.
3. **The taste log is an asset.** Every payload (anonymous, no PII) appended to a
   store gives the owner a demand heatmap: "62% of December sessions classified
   hardcore-vinyl" is direct purchasing intelligence for the label.

## 2.2 Classification rules

Deterministic and inspectable — no ML until there's data to train on
(rule engine in `tasteProfile.js`, thresholds in one table). Rules are ordered
by specificity; the first matching rule fires:

| Rule (all conditions AND) | Tag | Specificity |
|---|---|---|
| break channel active **and** 160 ≤ BPM < 190 | `jungle` | highest |
| break channel active **and** BPM ≥ 190 | `breakcore` | highest |
| BPM ≥ 190 **and** clapDistortion ≥ 0.7 | `hardcore-vinyl` | high |
| 170 ≤ BPM < 190 **and** delayWet ≥ 0.4 | `acid-tekno` | high |
| 170 ≤ BPM < 190 **and** acid channel active | `acid-tekno` | high |
| BPM ≥ 190 **and** clapDistortion < 0.7 | `early-rave` | high |
| 140 ≤ BPM < 170 **and** clapDistortion ≥ 0.5 | `industrial-tekno` | medium |
| 140 ≤ BPM < 170 | `tekno` | medium |
| BPM < 140 | `electro-acid` | low (catch-all floor) |

Multiple rules may fire; tags are ranked by specificity (jungle/breakcore are
always highest) and the top 2 are sent.

## 2.3 Sample JSON payload (`POST /api/taste`)

```json
{
  "schema": "unit.taste-profile.v1",
  "sessionId": "b7f9e2a1-4c1d-4e0e-9a52-7f3d0c8e6b21",
  "capturedAt": "2026-07-09T14:32:11Z",
  "source": "web",
  "audioState": {
    "bpm": 195,
    "channels": {
      "kick": true,
      "clap": true,
      "hat": true,
      "acid": false
    },
    "fx": {
      "clapDistortion": 0.85,
      "delayWet": 0.10,
      "acidCutoff": 800
    },
    "patternDensity": 0.44
  },
  "profile": {
    "tags": ["hardcore-vinyl", "early-rave"],
    "primaryTag": "hardcore-vinyl",
    "confidence": 0.92,
    "ruleTrace": ["bpm>=190", "clapDistortion>=0.7"]
  }
}
```

And the acid case: `bpm: 175`, `fx.delayWet: 0.55`, acid channel `true` →
`"tags": ["acid-tekno"]`, `"ruleTrace": ["170<=bpm<190", "delayWet>=0.4", "acid.active"]`.

Middleware response:

```json
{
  "products": [
    {
      "id": 1412,
      "name": "Tekno sucks 004 — GABBER ONTOLOGIE EP",
      "price": "13.50",
      "currency": "EUR",
      "permalink": "https://shop.unitbreda.example/product/ts004",
      "image": "https://shop.unitbreda.example/wp-content/uploads/ts004.jpg",
      "stockStatus": "instock",
      "matchedTag": "hardcore-vinyl"
    }
  ],
  "cacheAge": 118
}
```

## 2.3b Shelf fallback (`GET /api/products/random`)

`src/shop/shelfStore.js` degrades through 4 tiers so the shelf is never empty:
matched (above) → last-good cache → **random in-stock catalogue** → bundled
seed data. The random tier hits the same middleware, no tag context needed:

```
GET /api/products/random?instock=1&per_page=4
→ 200 { "products": [ /* same shape as §2.3 */ ], "cacheAge": 12 }
```

`instock=1` filters to `stock_status=instock`; `per_page` is clamped 1–20
(default 4). Cached 60 s per query (shorter than the taste-match cache — this
tier exists precisely to still feel fresh when the matched tier is down).

## 2.4 WooCommerce side (one-time setup)

1. Nothing — the category taxonomy already exists and is curated.
2. No REST keys needed (public Store API, read-only).
3. Middleware env: `WC_URL` (default unitbreda.nl), `TASTE_LOG_URL` (optional).
4. Category slug → ID map resolved once at boot (`GET /products/categories`), cached.
5. Bonus: product descriptions embed per-track MP3s — surfaced as `previewUrl`
   for the shelf's preview player.

## Acceptance criteria

- [ ] No Woo credentials in any client bundle (CI grep for `ck_`/`cs_`).
- [ ] Profile POST fires max once per 3 s of idle state, not per knob event.
- [ ] Full state → product panel round trip < 800 ms warm cache.
- [ ] Taste log row count grows in analytics store; zero PII fields present.
