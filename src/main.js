console.log('[main] starting');

const root = document.getElementById('root');
if (!root) {
  const msg = 'ERROR: root element not found';
  console.error('[main]', msg);
  document.body.innerHTML = `<div style="color:red;padding:20px;font-family:monospace">${msg}</div>`;
  throw new Error(msg);
}

(async () => {
  try {
    console.log('[main] importing boot...');
    const { boot } = await import('./ui/studioScene.js');
    console.log('[main] boot imported, calling boot()');
    await boot(root);
    console.log('[main] boot completed');
  } catch (err) {
    console.error('[main] ERROR:', err);
    root.innerHTML = `<div style="color:#ff2bd6;padding:20px;font-family:monospace;white-space:pre-wrap;font-size:11px">BOOT ERROR\n\n${err.message}\n\n${err.stack?.slice(0, 500)}</div>`;
  }
})();
