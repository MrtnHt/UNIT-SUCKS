/**
 * UNIT STUDIO — squad-house scene (spec §A).
 * Boot: power scrim → startAudio → PILOT-175 audible <150ms after tap.
 * Gear objects: 5 machines + DIST pedal + poster (long-press → flip-rack).
 */
import { preloadSamples, initLiveRack, startAudio, stopAudio, setBpm, buffers } from '../audio/engine.js';
import { attachPreview } from '../audio/previewPlayer.js';
import { loadPreset } from '../presets/stylePresets.js';
import { openGrid } from './stepGrid.js';
import { openPedal } from './pedalView.js';
import { openRackBack } from './rackBack.js';
import { mountShelf } from './vinylShelf.js';
import { openShareSheet } from '../export/shareCard.js';

const GEAR = [
  { track: 'kick',  label: 'KICK 9' },
  { track: 'clap',  label: 'CLAP 9' },
  { track: 'hat',   label: 'HI-HAT' },
  { track: 'acid',  label: 'ACID BOX' },
  { track: 'break', label: 'BRK-LOOP' },
];

export const app = {
  state: loadPreset('pilot-175'),
  rack: null,
  playing: false,
};

export async function boot(root) {
  root.innerHTML = `
    <div class="app">
      <div class="transport fx-flicker">
        <button id="play" aria-label="play/stop">▶</button>
        <div class="bpm">
          <button id="bpm-dn" aria-label="bpm down">−</button>
          <output id="bpm">${app.state.bpm}</output>
          <button id="bpm-up" aria-label="bpm up">+</button>
        </div>
        <button id="dice" aria-label="randomize">DICE</button>
        <button id="share" class="share" aria-label="share">SHARE</button>
      </div>
      <div class="scene" id="scene">
        <div class="poster" id="poster">UNIT<small>DEALIN' BEATS<br>SINCE 2015</small></div>
        <div class="slipmat" id="slipmat"></div>
        ${GEAR.map((g) => `
          <div class="gear" data-track="${g.track}">
            <span class="label">${g.label}</span>
            <button class="led on" data-mute="${g.track}" aria-label="mute ${g.track}"></button>
          </div>`).join('')}
        <div class="gear fx-pedal" data-gear="dist"><span class="label">DIST</span></div>
        <span class="sticker">Tekno sucks</span>
        <div class="vu" aria-hidden="true"><i id="vu-bar" style="height:0%"></i></div>
      </div>
      <div class="shelf-zone" id="shelf"></div>
    </div>
    <div class="scrim" id="scrim"><span class="label" style="font-size:inherit">POWER ON</span></div>
    <div class="fx-grain"></div><div class="fx-scan"></div>`;

  const $ = (s) => root.querySelector(s);
  const loading = preloadSamples().catch((e) => { console.warn('[scene] samples:', e.message); return null; });

  // --- power scrim: first gesture starts everything -------------------------
  $('#scrim').addEventListener('pointerdown', async () => {
    $('#scrim').querySelector('.label').textContent = 'LOADING TAPE…';
    await loading;
    app.rack = await initLiveRack(app.state);
    attachPreview(app.rack);
    await startAudio(app.state.bpm);
    app.playing = true;
    $('#play').textContent = '■';
    $('#scrim').classList.add('off');
    syncMuteLeds(root);
  }, { once: true });

  // --- transport -------------------------------------------------------------
  $('#play').addEventListener('click', () => {
    app.playing = !app.playing;
    if (app.playing) { startAudio(app.state.bpm); $('#play').textContent = '■'; }
    else { stopAudio(); $('#play').textContent = '▶'; }
  });

  const bpmStep = (d) => {
    app.state.bpm = Math.min(220, Math.max(120, app.state.bpm + d));
    $('#bpm').textContent = app.state.bpm;
    setBpm(app.state.bpm);
  };
  holdRepeat($('#bpm-up'), () => bpmStep(+1));
  holdRepeat($('#bpm-dn'), () => bpmStep(-1));

  $('#dice').addEventListener('click', () => { randomize(); $('#bpm').textContent = app.state.bpm; });
  $('#share').addEventListener('click', () => openShareSheet(app));

  // --- gear ------------------------------------------------------------------
  root.querySelectorAll('.gear[data-track]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.dataset.mute) { toggleMute(e.target.dataset.mute, e.target); return; }
      openGrid(app, el.dataset.track);
    });
  });
  $('[data-gear="dist"]').addEventListener('click', () => openPedal(app));

  // poster long-press 600ms → flip-rack easter egg
  let pressTimer = null;
  $('#poster').addEventListener('pointerdown', () => {
    pressTimer = setTimeout(() => openRackBack(app), 600);
  });
  ['pointerup', 'pointerleave'].forEach((ev) =>
    $('#poster').addEventListener(ev, () => clearTimeout(pressTimer)));

  // --- live visuals ------------------------------------------------------------
  document.addEventListener('sequencer:step', () => {
    if (!app.rack) return;
    const db = app.rack.meter.getValue();
    const pct = Math.min(100, Math.max(0, (db + 48) / 48 * 100));
    $('#vu-bar').style.height = `${pct}%`;
    $('#slipmat').classList.toggle('fx-spin', app.playing);
  });

  mountShelf($('#shelf'), app);
}

function toggleMute(track, led) {
  const ch = app.state.channels[track];
  if (!ch) return;
  ch.active = !ch.active;
  led.classList.toggle('on', ch.active);
  app.rack?.tracks[track]?.channel.set({ mute: !ch.active });
}

function syncMuteLeds(root) {
  root.querySelectorAll('[data-mute]').forEach((led) => {
    led.classList.toggle('on', app.state.channels[led.dataset.mute]?.active !== false);
  });
}

/** Genre-safe randomize: kick stays 4-on-floor, density-bounded. */
function randomize() {
  const rnd = (density) => Array.from({ length: 16 }, () => Math.random() < density ? 1 : 0);
  const ch = app.state.channels;
  ch.clap.steps = rnd(0.2);
  ch.hat.steps = rnd(0.45);
  if (ch.acid.active) ch.acid.steps = rnd(0.3);
  if (ch.break.active) {
    ch.break.slices = ch.break.slices.map((s, i) => Math.random() < 0.3 ? Math.floor(Math.random() * 16) : i);
  }
}

/** Press-and-hold repeat (±1 per 100ms) per spec A.1. */
function holdRepeat(btn, fn) {
  let iv = null;
  btn.addEventListener('pointerdown', () => { fn(); iv = setInterval(fn, 100); });
  ['pointerup', 'pointerleave'].forEach((ev) => btn.addEventListener(ev, () => clearInterval(iv)));
}
