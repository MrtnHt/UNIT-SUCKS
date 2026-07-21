import { boot } from './ui/studioScene.js';
import { injectSpeedInsights } from '@vercel/speed-insights';

const root = document.getElementById('root');
if (!root) {
  document.body.innerHTML = '<div style="color:red;padding:20px">ERROR: root element not found</div>';
  throw new Error('root element not found');
}

try {
  boot(root);
  // Initialize Vercel Speed Insights
  injectSpeedInsights();
} catch (err) {
  console.error('[main] boot failed at startup:', err);
  root.innerHTML = `<div style="color:#ff2bd6;padding:20px;font-family:monospace;white-space:pre-wrap">BOOT ERROR:\n\n${err.message}\n\n${err.stack}</div>`;
  throw err;
}
