/**
 * UNIT STUDIO — fullscreen step grid (spec §C.1–C.2).
 * Tabs: KICK CLAP HAT ACID BREAK. Edits mutate app.state directly; the live
 * sequence reads state each pass, so changes land within one loop cycle.
 */

const TRACKS = ['kick', 'clap', 'hat', 'acid', 'break'];
const PARAMS = {
  kick:  [['PITCH', 'kickPitch', 0, 1], ['DECAY', 'kickDecay', 0, 1]],
  clap:  [['DRIVE', 'drive', 0, 1], ['TONE', 'tone', 0, 1]],
  hat:   [['DECAY', 'hatDecay', 0, 1], ['OPEN', 'openMix', 0, 1]],
  acid:  [['CUTOFF', 'cutoff', 0, 1], ['RESO', 'reso', 0, 1]],
  break: [['SLICE±', 'sliceShift', 0, 1], ['DRIVE', 'drive', 0, 1]],
};

let undoSnapshot = null;

export function openGrid(app, focusTrack = 'kick') {
  document.querySelector('.overlay')?.remove();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <header>
      <span class="stamp fx-fringe" id="g-name"></span>
      <nav id="g-tabs" style="display:flex;gap:4px">
        ${TRACKS.map((t) => `<button data-tab="${t}" style="min-width:64px">${t.toUpperCase()}</button>`).join('')}
      </nav>
      <button class="close" aria-label="close">X</button>
    </header>
    <div id="g-cells" style="display:grid;grid-template-columns:repeat(8,1fr);gap:4px;padding:12px;flex:1;align-content:center"></div>
    <div id="g-params" style="display:flex;gap:16px;padding:0 12px"></div>
    <footer style="display:flex;gap:8px;padding:12px">
      <button id="g-clear" style="flex:1">CLEAR TRACK</button>
      <button id="g-fill" style="flex:1;border-color:var(--cyan);color:var(--cyan)">FILL 4s</button>
      <button id="g-undo" hidden style="border-color:var(--green);color:var(--green)">UNDO</button>
    </footer>`;
  document.body.appendChild(ov);

  let track = focusTrack;
  const $ = (s) => ov.querySelector(s);

  function render() {
    $('#g-name').textContent = track.toUpperCase();
    ov.querySelectorAll('[data-tab]').forEach((b) =>
      b.style.borderColor = b.dataset.tab === track ? 'var(--cyan)' : '');
    const ch = app.state.channels[track];
    $('#g-cells').innerHTML = ch.steps.map((on, i) => `
      <button data-step="${i}" aria-label="step ${i + 1}" style="aspect-ratio:1;min-height:44px;
        ${on ? 'background:var(--cyan);color:var(--ink)' : 'background:var(--ink-2)'}">${on ? '■' : ''}</button>`).join('');
    $('#g-params').innerHTML = PARAMS[track].map(([lbl, key]) => `
      <label class="label" style="flex:1;display:block">${lbl}
        <input type="range" data-param="${key}" min="0" max="1" step="0.01"
          value="${ch.params?.[key] ?? 0.5}" style="width:100%;min-height:44px">
      </label>`).join('');
  }
  render();

  // wide layout: 1×16 on landscape ≥768
  if (matchMedia('(min-width: 768px)').matches) {
    $('#g-cells').style.gridTemplateColumns = 'repeat(16, 1fr)';
  }

  ov.addEventListener('click', (e) => {
    const t = e.target;
    if (t.classList.contains('close')) return close(ov);
    if (t.dataset.tab) { track = t.dataset.tab; render(); return; }
    if (t.dataset.step != null) {
      const ch = app.state.channels[track];
      const i = +t.dataset.step;
      ch.steps[i] = ch.steps[i] ? 0 : 1;
      render();
      return;
    }
    if (t.id === 'g-clear' || t.id === 'g-fill') {
      const ch = app.state.channels[track];
      undoSnapshot = { track, steps: [...ch.steps] };
      ch.steps = t.id === 'g-clear'
        ? Array(16).fill(0)
        : ch.steps.map((v, i) => i % 4 === 0 ? 1 : v);
      $('#g-undo').hidden = false;
      setTimeout(() => { $('#g-undo').hidden = true; undoSnapshot = null; }, 4000);
      render();
      return;
    }
    if (t.id === 'g-undo' && undoSnapshot) {
      app.state.channels[undoSnapshot.track].steps = undoSnapshot.steps;
      undoSnapshot = null; t.hidden = true; render();
    }
  });

  ov.addEventListener('input', (e) => {
    const key = e.target.dataset.param;
    if (!key) return;
    const v = +e.target.value;
    const ch = app.state.channels[track];
    (ch.params ??= {})[key] = v;
    applyParam(app, track, key, v);
  });

  // current-step sweep
  const sweep = (e) => {
    const cells = ov.querySelectorAll('[data-step]');
    cells.forEach((c) => c.style.outline = '');
    const cell = cells[e.detail.step];
    if (cell) cell.style.outline = '2px solid var(--paper)';
  };
  document.addEventListener('sequencer:step', sweep);
  ov.addEventListener('remove', () => document.removeEventListener('sequencer:step', sweep));

  // swipe-down ≥80px closes
  let y0 = null;
  ov.addEventListener('pointerdown', (e) => { y0 = e.clientY; });
  ov.addEventListener('pointerup', (e) => { if (y0 != null && e.clientY - y0 >= 80) close(ov); y0 = null; });
}

function close(ov) {
  ov.style.animation = 'snap-in 120ms steps(2) reverse';
  setTimeout(() => ov.remove(), 120);
}

/** Map grid sliders onto live rack handles (best-effort; state is authoritative). */
function applyParam(app, track, key, v) {
  const t = app.rack?.tracks[track];
  const ch = app.state.channels[track];
  switch (key) {
    case 'drive': {
      (ch.fx ??= {}).distortion = { ...(ch.fx.distortion ?? { tone: 0.7, mix: 1 }), drive: v };
      t?.pedals.find((p) => p.id === 'distortion')?.setDrive(v);
      break;
    }
    case 'tone': {
      if (ch.fx?.distortion) ch.fx.distortion.tone = v;
      t?.pedals.find((p) => p.id === 'distortion')?.setTone(v);
      break;
    }
    case 'cutoff': app.rack?.acidFilter.frequency.rampTo(200 + v * 4800, 0.03); break;
    case 'reso': app.rack?.acidFilter.Q.rampTo(1 + v * 14, 0.03); break;
    case 'kickPitch': { const p = app.rack?.tracks.kick?.voice; if (p) p.playbackRate = 0.7 + v * 0.6; break; }
    case 'hatDecay': case 'kickDecay': break; // sample decay: future envelope handle
    case 'openMix': { // probability of open hat on active steps
      ch.open = ch.steps.map((on, i) => on && (i % 8 === 7 || Math.random() < v * 0.3) ? 1 : 0);
      break;
    }
    case 'sliceShift': { // rotate slice map — instant re-chop
      const shift = Math.round(v * 15);
      ch.slices = ch.slices.map((_, i) => (i + shift) % 16);
      break;
    }
  }
}
