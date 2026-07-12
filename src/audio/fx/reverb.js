/**
 * UNIT — reverb pedal (generic, per-track).
 * voice → Reverb → channel. NOTE: Tone.Reverb builds its impulse async;
 * call `await pedal.ready()` before starting transport (live AND offline).
 */
import * as Tone from 'tone';

const clampDecay = (s) => Math.min(5, Math.max(0.5, s));
const clampPre = (s) => Math.min(0.05, Math.max(0, s));

export function createReverb({ decay = 2.5, preDelay = 0.005, wet = 0.15 } = {}) {
  const reverb = new Tone.Reverb({
    decay: clampDecay(decay),
    preDelay: clampPre(preDelay),
    wet: Math.min(1, Math.max(0, wet)),
  });

  return {
    id: 'reverb',
    inserts: [reverb],
    node: reverb,
    /** Resolves once the impulse response is generated. */
    ready() { return reverb.ready; },
    setDecay(v) { reverb.decay = clampDecay(v); return reverb.ready; },
    setPreDelay(v) { reverb.preDelay = clampPre(v); return reverb.ready; },
    setWet(v) { reverb.wet.rampTo(Math.min(1, Math.max(0, v)), 0.05); },
    tailSeconds() { return clampDecay(reverb.decay) + clampPre(reverb.preDelay); },
    dispose() { reverb.dispose(); },
  };
}
