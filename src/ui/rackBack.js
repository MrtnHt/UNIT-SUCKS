/**
 * UNIT STUDIO — flip-rack easter egg (spec §C.4). Read-only routing view;
 * node dots blink on sequencer:step; any tap exits.
 */

export function openRackBack() {
  document.querySelector('.overlay')?.remove();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.style.transform = 'scaleX(-1)';
  const lane = (y, label) => `
    <text x="20" y="${y - 8}" fill="var(--paper-2)" font-size="11" transform="scale(-1,1) translate(-320,0)">${label}</text>
    <polyline points="20,${y} 150,${y} 150,180 190,180" fill="none" stroke="var(--paper)" stroke-width="2"/>
    <circle class="node" cx="20" cy="${y}" r="4" fill="var(--cyan)"/>`;
  ov.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <svg viewBox="0 0 320 320" style="width:min(90vw,480px)">
        ${lane(40, 'KICK → DIST')}
        ${lane(70, 'CLAP → DIST')}
        ${lane(100, 'HAT (choke)')}
        ${lane(130, 'ACID → FLT')}
        ${lane(160, 'BREAK ×16')}
        <polyline points="190,180 230,180" fill="none" stroke="var(--paper)" stroke-width="2"/>
        <rect x="190" y="165" width="34" height="30" fill="none" stroke="var(--line)" stroke-width="2"/>
        <rect x="234" y="165" width="30" height="30" fill="none" stroke="var(--line)" stroke-width="2"/>
        <polyline points="264,180 300,180" fill="none" stroke="var(--cyan)" stroke-width="2"/>
        <polyline points="20,260 250,260 250,195" fill="none" stroke="var(--magenta)" stroke-width="2" stroke-dasharray="4 3"/>
        <text x="30" y="252" fill="var(--magenta)" font-size="11" transform="scale(-1,1) translate(-330,0)">PREVIEW (bypass comp)</text>
        <text x="185" y="215" fill="var(--paper-2)" font-size="11" transform="scale(-1,1) translate(-410,0)">COMP → LIM</text>
      </svg>
      <p class="label" style="color:var(--paper-2);transform:scaleX(-1) skewX(2deg)">NOTHING TO TWEAK BACK HERE. GO MAKE NOISE.</p>
    </div>`;
  document.body.appendChild(ov);

  const blink = () => {
    ov.querySelectorAll('.node').forEach((n) => {
      n.setAttribute('fill', 'var(--paper)');
      setTimeout(() => n.setAttribute('fill', 'var(--cyan)'), 60);
    });
  };
  document.addEventListener('sequencer:step', blink);
  ov.addEventListener('pointerdown', () => {
    document.removeEventListener('sequencer:step', blink);
    ov.remove();
  });
}
