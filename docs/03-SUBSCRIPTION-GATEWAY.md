# Module 3 — Subscription Data Gateway

Objective: turn "download my loop" into the newsletter engine for vinyl
pre-orders. The user's render is the incentive; the e-mail address is the price;
GDPR-clean double opt-in is the contract.

Implementation: [`src/export/renderLoop.js`](../src/export/renderLoop.js) (client
render) and [`server/exportGateway.js`](../server/exportGateway.js) (gate + list).

---

## 3.1 Data flow — exact sequence

```
[1] user hits EXPORT
      └─ UI opens gate modal: e-mail field + explicit newsletter checkbox
         ("Stuur mij Tekno sucks pre-orders") + privacy link

[2] client POST /api/export/init
      { email, consentNewsletter: true, tasteProfile: {…Module 2 payload…} }
      └─ server: validate e-mail syntax + MX
      └─ server: upsert subscriber in ESP (Brevo/Mailchimp) status=PENDING,
                 attach taste tags (hardcore-vinyl, …) as segment attributes
      └─ server: trigger double opt-in confirmation mail (ESP native)
      └─ server: sign export token  JWT { sid, exp: +15 min }
      └─ response 200 { exportToken }

[3] client renders the loop LOCALLY (no audio ever uploaded)
      └─ Tone.Offline() re-plays the pattern at current BPM → AudioBuffer
      └─ WAV: encode PCM16 in a worker      (always available)
      └─ MP3: lamejs 192 kbps in a worker   (smaller share file)

[4] client POST /api/export/confirm  { exportToken }
      └─ server verifies JWT, increments export counter, logs taste profile
      └─ response 200 { ok: true }

[5] client triggers browser download  unit-loop-195bpm.wav / .mp3
      └─ filename carries BPM + primary tag = free marketing when shared

[6] user clicks confirmation mail (double opt-in)
      └─ ESP flips PENDING → SUBSCRIBED, enters "vinyl pre-order" automation
```

Design decisions and why:

- **Render client-side, gate server-side.** Audio rendering in `Tone.Offline`
  costs the server nothing and scales to any traffic. The server only does what
  *must* be trusted: e-mail capture, consent recording, token signing. A
  serverless function + ESP handles thousands of exports for ~€0.
- **Token before render, confirm after.** The 15-minute JWT stops people
  scripting the list-signup endpoint without exporting, and gives the owner a
  true "exports completed" metric ([2] fired vs [4] fired = funnel drop-off).
- **Double opt-in is non-negotiable** (EU/GDPR + Dutch AP). It also keeps the
  list clean: a subscriber who confirmed to get gabber pre-orders is worth 50
  scraped addresses.
- **Taste tags on the subscriber record** are the compounding asset: the
  newsletter for a 190+ BPM release goes only to `hardcore-vinyl`-tagged
  subscribers → higher open rates → better ESP deliverability for every
  future mail.

## 3.2 Infrastructure

| Component | Choice | Cost |
|---|---|---|
| Gate endpoint | Cloudflare Worker or Vercel function (`server/exportGateway.js`) | free tier |
| ESP / list | Brevo (EU data residency, free ≤ 300 mails/day) or Mailchimp | €0–25/mo |
| Token signing | `EXPORT_JWT_SECRET` env var, HS256, 15 min TTL | — |
| MP3 encoder | `lamejs` in a Web Worker (client) | — |
| Rate limiting | 5 inits / IP / hour at the edge | — |
| Consent log | append-only store: e-mail hash, timestamp, checkbox text version | — |

## 3.3 Server contract

`POST /api/export/init`

```json
{
  "email": "raver@example.com",
  "consentNewsletter": true,
  "consentTextVersion": "2026-07-nl-v1",
  "tasteProfile": { "schema": "unit.taste-profile.v1", "profile": { "tags": ["hardcore-vinyl"] } }
}
```

→ `200 { "exportToken": "eyJhbGciOi..." }`
→ `422` invalid e-mail · `429` rate limited · `409` already subscribed (still returns token — never punish existing fans)

`POST /api/export/confirm` → `200 { "ok": true }` after JWT verify.

## 3.4 GDPR checklist

- [ ] Newsletter checkbox **unchecked by default**, separate from the download action wording.
- [ ] Export works even if… **no.** Deliberate product decision: e-mail is
      required, checkbox is optional. Required = "we mail you the confirmation";
      marketing consent is the checkbox. This split is what keeps it legal.
- [ ] Privacy statement linked in the modal; consent text versioned in the log.
- [ ] ESP with EU data processing agreement (Brevo: yes).
- [ ] Unsubscribe honored by ESP automatically.

## Acceptance criteria

- [ ] Export without valid token: impossible (client hides button, server is the enforcement).
- [ ] WAV and MP3 byte-identical pattern audibly matches live playback at same BPM.
- [ ] Subscriber appears in ESP with taste tags within 5 s of [2].
- [ ] Funnel metrics visible: inits, confirms, opt-in completions.
