/**
 * UNIT SEQUENCER — taste profile classifier (Module 2)
 *
 * Maps live sequencer state → webshop product-category tags. Deterministic rule
 * engine: every rule is a row in RULES, every classification carries a
 * ruleTrace so the shop owner can audit why a loop matched a record bin.
 *
 * No PII leaves this module. sessionId is a random UUID per browser session.
 */

/** Ordered by specificity — first match becomes primaryTag. */
const RULES = [
  {
    tag: 'breakcore',
    trace: ['bpm>=190', 'break.active'],
    test: (s) => s.bpm >= 190 && s.channels.break?.active,
  },
  {
    tag: 'jungle',
    trace: ['160<=bpm<190', 'break.active'],
    test: (s) => s.bpm >= 160 && s.bpm < 190 && s.channels.break?.active,
  },
  {
    tag: 'hardcore-vinyl',
    trace: ['bpm>=190', 'clapDistortion>=0.7'],
    test: (s) => s.bpm >= 190 && s.fx.clapDistortion >= 0.7,
  },
  {
    tag: 'acid-tekno',
    trace: ['170<=bpm<190', 'delayWet>=0.4'],
    test: (s) => s.bpm >= 170 && s.bpm < 190 && s.fx.delayWet >= 0.4,
  },
  {
    tag: 'acid-tekno',
    trace: ['170<=bpm<190', 'acid.active'],
    test: (s) => s.bpm >= 170 && s.bpm < 190 && s.channels.acid?.active,
  },
  {
    tag: 'early-rave',
    trace: ['bpm>=190', 'clapDistortion<0.7'],
    test: (s) => s.bpm >= 190 && s.fx.clapDistortion < 0.7,
  },
  {
    tag: 'industrial-tekno',
    trace: ['140<=bpm<170', 'clapDistortion>=0.5'],
    test: (s) => s.bpm >= 140 && s.bpm < 170 && s.fx.clapDistortion >= 0.5,
  },
  {
    tag: 'tekno',
    trace: ['140<=bpm<170'],
    test: (s) => s.bpm >= 140 && s.bpm < 170,
  },
  {
    tag: 'electro-acid',
    trace: ['bpm<140'],
    test: (s) => s.bpm < 140,
  },
];

/** Fraction of programmed steps across active channels, 0..1. */
function patternDensity(channels) {
  let programmed = 0;
  let total = 0;
  for (const ch of Object.values(channels)) {
    if (!ch.active || !Array.isArray(ch.steps)) continue;
    total += ch.steps.length;
    programmed += ch.steps.filter(Boolean).length;
  }
  return total === 0 ? 0 : programmed / total;
}

export function classify(state) {
  const hits = RULES.filter((r) => r.test(state));
  const tags = [...new Set(hits.map((r) => r.tag))].slice(0, 2);
  return {
    tags,
    primaryTag: tags[0] ?? null,
    // rough confidence: how many independent signals agreed
    confidence: Math.min(1, 0.6 + 0.16 * hits.length),
    ruleTrace: hits.flatMap((r) => r.trace),
  };
}

export function buildPayload(state, sessionId) {
  return {
    schema: 'unit.taste-profile.v1',
    sessionId,
    capturedAt: new Date().toISOString(),
    source: typeof window !== 'undefined' && window.__UNIT_KIOSK__ ? 'kiosk' : 'web',
    audioState: {
      bpm: state.bpm,
      channels: Object.fromEntries(
        Object.entries(state.channels).map(([k, v]) => [k, !!v.active]),
      ),
      fx: { ...state.fx },
      patternDensity: Number(patternDensity(state.channels).toFixed(2)),
    },
    profile: classify(state),
  };
}

/**
 * Debounced reporter: call notify() on every state change; it POSTs the
 * payload at most once per `idleMs` of silence and only when the profile
 * actually changed.
 */
export function createTasteReporter({ endpoint = '/api/taste', idleMs = 3000, onProducts, onError } = {}) {
  const sessionId = crypto.randomUUID();
  let timer = null;
  let lastKey = '';

  return {
    notify(state) {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const payload = buildPayload(state, sessionId);
        const key = JSON.stringify(payload.profile.tags) + payload.audioState.bpm;
        if (key === lastKey) return;
        lastKey = key;
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            if (onProducts) onProducts(await res.json());
          } else if (onError) {
            onError(new Error(`taste ${res.status}`)); // let the shelf degrade a tier
          }
        } catch (err) {
          // shop offline ≠ sequencer broken; fail silent, retry on next tweak
          lastKey = '';
          if (onError) onError(err);
        }
      }, idleMs);
    },
  };
}
