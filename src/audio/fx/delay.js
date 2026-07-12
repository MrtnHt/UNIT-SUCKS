/**
 * UNIT — delay pedal (generic, per-track).
 * voice → FeedbackDelay → channel. BPM-synced time, feedback capped 0.95.
 */
import * as Tone from 'tone';

const SYNC = new Set(['4n', '8n', '16n', '32n', '8t', '16t']);

export function createDelay({ time = '8n', feedback = 0.3, wet = 0.2 } = {}) {
  const delay = new Tone.FeedbackDelay({
    delayTime: SYNC.has(time) ? time : '8n',
    feedback: Math.min(0.95, feedback),
    wet: Math.min(1, Math.max(0, wet)),
  });

  return {
    id: 'delay',
    inserts: [delay],
    node: delay,
    setTime(v) { delay.delayTime.rampTo(SYNC.has(v) ? Tone.Time(v).toSeconds() : Tone.Time('8n').toSeconds(), 0.05); },
    setFeedback(v) { delay.feedback.rampTo(Math.min(0.95, Math.max(0, v)), 0.05); },
    setWet(v) { delay.wet.rampTo(Math.min(1, Math.max(0, v)), 0.05); },
    /** worst-case audible tail in seconds, for render-length calc */
    tailSeconds() {
      const t = delay.delayTime.value;
      const fb = delay.feedback.value;
      // repeats until -60 dB: n = 60 / (-20*log10(fb))
      const perRepeat = fb > 0 ? -20 * Math.log10(fb) : 60;
      const repeats = perRepeat > 0 ? Math.min(32, 60 / perRepeat) : 0;
      return t * repeats;
    },
    dispose() { delay.dispose(); },
  };
}
