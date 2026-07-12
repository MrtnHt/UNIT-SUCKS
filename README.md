# UNIT SEQUENCER — Product Scaling Pack

**303 Acid Synth & 909 Drum Computer → commercial ecosystem for UNIT Breda / Tekno sucks.**

This branch contains the full technical upgrade and 12-month commercial integration
strategy. Raw on the surface, enterprise-grade underneath.

## Modules

| # | Deliverable | Docs | Code |
|---|-------------|------|------|
| 1 | Audio Architecture Upgrades | [`docs/01-AUDIO-ARCHITECTURE.md`](docs/01-AUDIO-ARCHITECTURE.md) | [`src/audio/`](src/audio/) |
| 2 | Webshop Data Integration | [`docs/02-WEBSHOP-INTEGRATION.md`](docs/02-WEBSHOP-INTEGRATION.md) | [`src/integration/`](src/integration/) |
| 3 | Subscription Data Gateway | [`docs/03-SUBSCRIPTION-GATEWAY.md`](docs/03-SUBSCRIPTION-GATEWAY.md) | [`src/export/`](src/export/), [`server/`](server/) |
| 4 | Commercial Value Deck | [`docs/04-COMMERCIAL-VALUE-DECK.md`](docs/04-COMMERCIAL-VALUE-DECK.md) | — |

## Integration contract

All modules assume the MVP exposes one plain state object (adapt names to taste):

```js
export const sequencerState = {
  bpm: 175,                    // Tone.Transport.bpm.value
  channels: {                  // active steps per track
    kick:  { active: true,  steps: [/* 16 bools */],
             fx: { distortion?: {drive, tone, mix}, delay?: {time, feedback, wet},
                   reverb?: {decay, preDelay, wet}, filter?: {type, frequency, Q} } },
    clap:  { active: true,  steps: [],
             fx: { distortion?: {drive, tone, mix}, ... } },
    hat:   { active: true,  steps: [] },
    acid:  { active: true,  steps: [], pattern: [/* {note, accent, slide} */],
             fx: { delay?: {time, feedback, wet}, ... } },
    break: { active: false, steps: [/* 16 bools */], slices: [/* 16 indices */],
             breakNativeBpm: 165 },
  },
};
```

Everything downstream — audio chain, taste profiling, export gateway — reads from
this single source of truth. If your MVP keeps state in scattered globals, step one
is consolidating into this shape.

## Repo layout

```
docs/                 strategy + architecture documents (owner-facing)
samples/              909-kick/clap/hat-closed/hat-open.wav, amen-replay-165.wav
src/audio/
  engine.js           Tone.js context + sample preloading (Module 1 core)
  rack.js             context-agnostic graph factory (live + Tone.Offline export)
  previewPlayer.js    low-latency preview chain (record previews bypass glue comp)
  fx/                 distortion.js, delay.js, reverb.js, filter.js
src/integration/      taste-profile → webshop mapping (Module 2)
src/shop/
  shelfStore.js       4-tier shelf chain (matched → cache → random → seed)
  seedRecords.json    evergreen product fallback
src/presets/
  stylePresets.js     8 hand-programmed starter patterns (jungle/breakcore + 6 core)
src/export/           client-side loop rendering WAV/MP3 (Module 3, owned by export agent)
server/               email-gated download + newsletter gateway (Module 3, owned by export agent)
```

## Samples

The `samples/` directory must contain:

- **`909-kick.wav`**, **`909-clap.wav`**, **`909-hat-closed.wav`**, **`909-hat-open.wav`** —
  Roland TR-909 style drum samples, sourced from licensed/royalty-free packs only.
  **Roland™ trademark note:** UI labels must not use "TR-909" naming; prefer generic
  ("Kick", "Clap", "Hi-Hat") or pack-neutral descriptors to avoid trademark friction.

- **`amen-replay-165.wav`** — One-bar break loop at 165 BPM. **CRITICAL: this must be a
  royalty-free RE-PLAYED amen-style break pattern, NOT the original Winstons "Amen, Brother"
  recording.** The Winstons original is restricted; playing it here (commercial app, store kiosk)
  triggers mechanicals and licensing liability. Use a clean breakbeat sample pack or commission
  a re-recorded variant. Provenance: document the source pack name and link in your deployment notes.
