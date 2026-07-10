/**
 * UNIT SEQUENCER — export gateway (Module 3, server side)
 *
 * Deployable as a Cloudflare Worker / Vercel function / 1-file Express app.
 * Responsibilities — ONLY the parts that must be trusted:
 *   POST /api/export/init     e-mail gate → ESP subscribe (double opt-in) → JWT
 *   POST /api/export/confirm  JWT verify → metrics
 *
 * Env: EXPORT_JWT_SECRET, BREVO_API_KEY, BREVO_LIST_ID
 * Audio never touches this server; rendering is client-side (renderLoop.js).
 */
import { SignJWT, jwtVerify } from 'jose';

const TOKEN_TTL_S = 15 * 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const secret = () => new TextEncoder().encode(process.env.EXPORT_JWT_SECRET);

// ---------------------------------------------------------------------------
// ESP adapter — Brevo (EU data residency). Swap this object for Mailchimp etc.
// ---------------------------------------------------------------------------

const esp = {
  /** Upsert contact with taste tags; Brevo template handles double opt-in. */
  async subscribe({ email, tags, consentTextVersion }) {
    const res = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        includeListIds: [Number(process.env.BREVO_LIST_ID)],
        templateId: 1, // double opt-in confirmation template
        redirectionUrl: 'https://unitbreda.example/bevestigd',
        attributes: {
          TASTE_TAGS: tags.join(','),
          CONSENT_VERSION: consentTextVersion,
          SOURCE: 'sequencer-export',
        },
      }),
    });
    // 201 created, 204 already exists — both fine
    if (!res.ok && res.status !== 425) {
      throw new Error(`ESP subscribe failed: ${res.status}`);
    }
    return res.status === 204 ? 'existing' : 'pending';
  },
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleInit(request) {
  const body = await request.json().catch(() => null);
  if (!body || !EMAIL_RE.test(body.email ?? '')) {
    return json(422, { error: 'invalid_email' });
  }

  const tags = body.tasteProfile?.profile?.tags ?? [];
  let subscriberState = 'skipped';
  if (body.consentNewsletter === true) {
    subscriberState = await esp.subscribe({
      email: body.email,
      tags,
      consentTextVersion: body.consentTextVersion ?? 'unversioned',
    });
  }

  const exportToken = await new SignJWT({ tags })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(hashEmail(body.email)) // never store raw e-mail in the token
    .setExpirationTime(`${TOKEN_TTL_S}s`)
    .setIssuedAt()
    .sign(secret());

  const status = subscriberState === 'existing' ? 409 : 200;
  return json(status, { exportToken });
}

export async function handleConfirm(request, metrics = console) {
  const body = await request.json().catch(() => null);
  try {
    const { payload } = await jwtVerify(body?.exportToken ?? '', secret());
    metrics.info?.('[export] completed', { tags: payload.tags });
    return json(200, { ok: true });
  } catch {
    return json(401, { error: 'invalid_or_expired_token' });
  }
}

// ---------------------------------------------------------------------------

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function hashEmail(email) {
  // stable pseudonymous subject; swap for SHA-256 via WebCrypto in production
  let h = 0;
  for (const c of email.toLowerCase()) h = (Math.imul(h, 31) + c.charCodeAt(0)) | 0;
  return `sub_${(h >>> 0).toString(16)}`;
}

/** Cloudflare Worker entry. Rate limiting: bind a KV/DO or use CF rules (5/IP/h). */
export default {
  async fetch(request) {
    const { pathname } = new URL(request.url);
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    if (pathname === '/api/export/init') return handleInit(request);
    if (pathname === '/api/export/confirm') return handleConfirm(request);
    return json(404, { error: 'not_found' });
  },
};
