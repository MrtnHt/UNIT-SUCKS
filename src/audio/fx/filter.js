/**
 * UNIT — filter pedal (generic, per-track). LP/HP/BP with resonance.
 */
import * as Tone from 'tone';

const TYPES = new Set(['lowpass', 'highpass', 'bandpass']);

export function createFilter({ type = 'lowpass', frequency = 800, Q = 1 } = {}) {
  const filter = new Tone.Filter({
    type: TYPES.has(type) ? type : 'lowpass',
    frequency,
    Q,
    rolloff: -24,
  });

  return {
    id: 'filter',
    inserts: [filter],
    node: filter,
    setType(t) { if (TYPES.has(t)) filter.type = t; },
    setFrequency(hz) { filter.frequency.rampTo(Math.min(18000, Math.max(20, hz)), 0.03); },
    setQ(q) { filter.Q.rampTo(Math.min(20, Math.max(0, q)), 0.03); },
    dispose() { filter.dispose(); },
  };
}
