/**
 * UNIT STUDIO — DIST pedal close-up (spec §C.3).
 * Three vertical-drag knobs (1px = 0.01) + stomp switch, wired to the clap
 * track's distortion pedal handles; state mirrored for taste profiling.
 */

export function openPedal(app) {
  document.querySelector('.overlay')?.remove();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <header>
      <span class="stamp fx-fringe" style="color:var(--magenta)">DIST PEDAL</span>
      <button class="close" aria-label="close">X</button>
    </header>
    <div style="flex:1;display:flex;align-items:center;justify-content:center;gap:24px">
      ${['DRIVE', 'TONE', 'MIX'].map((k) => `
        <div style="text-align:center">
          <div class="knob" data-knob="${k.toLowerCase()}" style="width:72px;height:72px;border:2px solid var(--magenta);
            border-radius:2px;box-shadow:var(--bevel);display:flex;align-items:center;justify-content:center;
            font-size:var(--t-ui);touch-action:none;cursor:ns-resize;user-select:none">0.5</div>
          <span class="label">${k}</span>
        </div>`).join('')}
    </div>
    <div style="display:flex;justify-content:center;padding:24px">
      <button id="stomp" style="width:88px;height:88px;border-color:var(--magenta)" aria-label="stomp">●</button>
    </div>`;
  document.body.appendChild(ov);

  const pedal = app.rack?.tracks.clap?.pedals.find((p) => p.id === 'distortion');
  const fx = ((app.state.channels.clap.fx ??= {}).distortion ??= { drive: 0.25, tone: 0.7, mix: 1 });
  const vals = { drive: fx.drive, tone: fx.tone, mix: fx.mix };
  let stomped = fx.mix > 0;

  ov.querySelectorAll('.knob').forEach((knob) => {
    const key = knob.dataset.knob;
    knob.textContent = vals[key].toFixed(2);
    let y0 = null, v0 = 0;
    knob.addEventListener('pointerdown', (e) => { y0 = e.clientY; v0 = vals[key]; knob.setPointerCapture(e.pointerId); });
    knob.addEventListener('pointermove', (e) => {
      if (y0 == null) return;
      vals[key] = Math.min(1, Math.max(0, v0 + (y0 - e.clientY) * 0.01));
      knob.textContent = vals[key].toFixed(2);
      fx[key] = vals[key];
      if (key === 'drive') pedal?.setDrive(vals[key]);
      if (key === 'tone') pedal?.setTone(vals[key]);
      if (key === 'mix') pedal?.setMix(vals[key]);
    });
    ['pointerup', 'pointercancel'].forEach((ev) => knob.addEventListener(ev, () => { y0 = null; }));
  });

  ov.querySelector('#stomp').addEventListener('click', (e) => {
    stomped = !stomped;
    const mix = stomped ? vals.mix || 1 : 0;
    fx.mix = mix;
    pedal?.setMix(mix);
    e.target.style.color = stomped ? 'var(--magenta)' : 'var(--paper-2)';
  });

  ov.querySelector('.close').addEventListener('click', () => {
    ov.style.animation = 'snap-in 120ms steps(2) reverse';
    setTimeout(() => ov.remove(), 120);
  });
}
