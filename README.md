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
    kick:  { active: true,  steps: [/* 16 bools */] },
    clap:  { active: true,  steps: [] },
    hat:   { active: true,  steps: [] },
    acid:  { active: true,  steps: [], pattern: [/* {note, accent, slide} */] },
  },
  fx: {
    clapDistortion: 0.0,       // 0..1 — Module 1 pedal
    delayWet: 0.0,             // 0..1
    acidCutoff: 800,           // Hz
  },
};
```

Everything downstream — audio chain, taste profiling, export gateway — reads from
this single source of truth. If your MVP keeps state in scattered globals, step one
is consolidating into this shape.

## Repo layout

```
docs/                 strategy + architecture documents (owner-facing)
src/audio/            Tone.js engine upgrades (Module 1)
src/integration/      taste-profile → webshop mapping (Module 2)
src/export/           client-side loop rendering WAV/MP3 (Module 3)
server/               email-gated download + newsletter gateway (Module 3)
```
