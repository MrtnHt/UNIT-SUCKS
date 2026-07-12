# Module 1 — Audio Architecture Upgrades

Objective: make the sequencer sound and feel like hardware. Three workstreams:
low-latency scheduling, a master limiter bus that survives 16 tracks of 909 abuse,
and an adjustable distortion pedal on the Clap track.

Implementation lives in [`src/audio/engine.js`](../src/audio/engine.js) and
[`src/audio/fx/clapDistortion.js`](../src/audio/fx/clapDistortion.js).

---

## 1.1 Low-latency asset scheduling

### Context tuning

The default Tone.js context is tuned for stability, not feel. Replace it before
any node is created:

```js
const context = new Tone.Context({
  latencyHint: 'interactive',   // asks the OS for the smallest safe buffer
  lookAhead: 0.05,              // 50 ms scheduling horizon (default 0.1 = mushy)
  updateInterval: 0.02,         // clock tick every 20 ms
});
Tone.setContext(context);
```

Rules that keep it tight:

1. **Never create nodes inside the step callback.** Every `new Tone.Player()` or
   `new Tone.MembraneSynth()` inside the sequencer loop allocates on the audio
   thread's watch. All voices are pre-built at init (`engine.js` builds the full
   voice rack once) and only *triggered* in the loop.
2. **Always schedule with the callback's `time` argument**, never `Tone.now()`:
   ```js
   new Tone.Sequence((time, step) => {
     voices.kick.triggerAttackRelease('C1', '16n', time);   // sample-accurate
     Tone.Draw.schedule(() => ui.highlightStep(step), time); // UI on its own rail
   }, steps, '16n');
   ```
   `time` is the precise audio-clock timestamp; `Tone.now()` is "whenever JS got
   around to it." `Tone.Draw` keeps DOM work off the audio path.
3. **Preload every sample into decoded buffers** before the play button is even
   enabled. `Tone.ToneAudioBuffers` (see `engine.js`) decodes once; players share
   buffers, so 16 clap hits ≠ 16 decode jobs.
4. **Resume the context inside the user's first gesture** (`Tone.start()` in the
   click handler) — required by autoplay policy, and doing it lazily elsewhere
   costs you the first bar.
5. In-store tablet: pin Chrome/Android, kiosk mode, and set
   `latencyHint: 'interactive'` only — do not chase `0` buffer sizes on cheap
   tablets; underruns sound worse than 10 ms extra latency.

### Measuring, not guessing

`engine.js` exposes `getLatencyReport()` returning `context.baseLatency`,
`context.outputLatency` and current `lookAhead`. Log it on boot; if
`outputLatency > 40 ms` on the store tablet, that tablet is the problem, not the code.

---

## 1.2 Production-grade master bus (anti-clipping chain)

Sixteen channels of 909 at festival BPM will clip any browser's output stage.
Browsers hard-clip at 0 dBFS — it sounds like a broken speaker, not like saturation.
The fix is a proper gain-staged bus, identical in spirit to a club PA chain:

```
SEQUENCER CHAIN (live playback):
track voice → [insert pedals: filter → distortion → delay → reverb]
            → track Channel (gain/pan/mute/solo, -6 dB headroom)
            → sequencerBus (Tone.Gain, -3 dB)
            → glueCompressor (Tone.Compressor: ratio 4, attack 3ms, release 0.25s, threshold -12 dB)
            → brickwall (Tone.Limiter, threshold -1 dBFS)
            → Tone.getDestination()

PREVIEW CHAIN (record previews, bypasses glue comp to avoid pumping):
previewPlayer → previewChannel (-3 dB) → brickwall limiter → Tone.getDestination()

While a preview plays, duckSequencer() ramps the SEQUENCER bus down -12 dB
(120 ms) and back up (400 ms) — the loop keeps running under the record.
```

Key decisions:

- **Per-track `Tone.Channel`** gives mute/solo/pan for free and enforces headroom
  at the source. Default channel volume `-6 dB`: eight simultaneous hits sum to
  roughly `+3 dB` over one hit, which the bus still absorbs.
- **Per-track FX insert order** is stable (filter → distortion → delay → reverb)
  and declared in `sequencerState.channels.<id>.fx` with optional sub-objects.
- **Glue compressor before the limiter.** The limiter alone works but pumps
  audibly when the kick and clap land together. The compressor takes the first
  6–8 dB musically; the limiter only catches transient peaks.
- **Preview chain bypasses glue comp.** Record previews use a separate branch
  to avoid dynamic compression artifacts; the `duckSequencer` ramps gain down
  when the live sequencer plays so both can coexist on one output.
- **`Tone.Limiter(-1)` as the only hard ceiling.** `-1 dBFS` ceiling, not `0`:
  consumer DACs overshoot on inter-sample peaks; the 1 dB margin is the
  difference between "loud" and "crackles on phone speakers."
- **Nothing ever connects to `Tone.getDestination()` directly** except the
  limiter. This is enforced in `rack.js` — all `connect()` calls are wired
  by `buildRack()`, the single graph builder for both live and Tone.Offline export.

Full implementation: [`src/audio/rack.js`](../src/audio/rack.js) and [`src/audio/engine.js`](../src/audio/engine.js).

---

## 1.3 Clap distortion pedal

An adjustable stompbox on the Clap track: drive amount, tone filter, dry/wet, and
an output trim that compensates loudness so the knob changes *character*, not
*volume* (critical — otherwise "more distortion" always sounds "better" and the
taste-profile data in Module 2 gets polluted).

```
clap voice → Distortion (oversample 4x) → tone LPF → output trim → clap Channel
                      ▲ drive 0..1
```

Exact Tone.js configuration and knob mapping:
[`src/audio/fx/clapDistortion.js`](../src/audio/fx/clapDistortion.js). Wire the UI
knob to `clapDistortion.setDrive(value01)` and mirror the value into
`sequencerState.fx.clapDistortion` — Module 2 reads it from there.

---

## Acceptance criteria

- [ ] No `new Tone.*` calls inside any Transport/Sequence callback (grep-able).
- [ ] Boot log shows `lookAhead: 0.05` and `outputLatency` on target hardware.
- [ ] Full pattern, all channels, BPM 200, distortion 100%: master meter never
      exceeds -1 dBFS, no browser clipping artifacts.
- [ ] Clap drive knob sweep 0→1 changes timbre with < 2 dB perceived loudness delta.
