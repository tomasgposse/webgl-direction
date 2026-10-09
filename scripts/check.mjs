#!/usr/bin/env node
// Verifica una experiencia WebGL en un navegador real (Chrome o Edge, headless).
// Uso: node check.mjs <url> [--out carpeta] [--selector canvas] [--seconds 4] [--color-scheme light|dark]
// Casos: escritorio, celular con CPU lenta, movimiento reducido y sin WebGL.
// Sin dependencias: usa el protocolo de DevTools con el WebSocket nativo de Node 22+.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:/.test(a));
if (!url) {
  console.error('Uso: node check.mjs <url> [--out carpeta] [--selector canvas] [--seconds 4]');
  process.exit(1);
}
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const outDir = path.resolve(opt('--out', '.depthfirst/check'));
const selector = opt('--selector', 'canvas');
const seconds = Number(opt('--seconds', 4));
const scheme = opt('--color-scheme', null);
fs.mkdirSync(outDir, { recursive: true });

import { open, sleep } from './lib/browser.mjs';
async function runCase(name, { width, height, mobile = false, reducedMotion = false, cpu = 1, flags = [] }) {
  const b = await open({ flags });
  const errors = [];
  const warnings = [];
  let scriptBytes = 0;
  b.on((m) => {
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) {
      const text = m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200);
      (m.params.type === 'error' ? errors : warnings).push(text);
    }
    if (m.method === 'Network.loadingFinished') scriptBytes += m.params.encodedDataLength || 0;
  });
  try {
    await b.send('Page.enable');
    await b.send('Runtime.enable');
    await b.send('Network.enable');
    await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 3 : 1, mobile });
    if (mobile) await b.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    if (cpu > 1) await b.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await b.send('Emulation.setEmulatedMedia', { features: [
      { name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' },
      ...(scheme ? [{ name: 'prefers-color-scheme', value: scheme }] : []),
    ] });
    await b.send('Page.navigate', { url });
    const evaluate = async (expression) => (await b.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
    for (let i = 0; i < 60 && (await evaluate('document.readyState')) !== 'complete'; i++) await sleep(250);

    // Llevar el elemento a pantalla (puede cargarse en diferido) y esperar el primer cuadro.
    // Solo hacer scroll si el elemento no está a la vista (y sin animación, por si el sitio usa scroll suave).
    await evaluate(`(() => { const c = document.querySelector(${JSON.stringify(selector)}); if (!c) return;
      const r = c.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) return;
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, r.top + scrollY - innerHeight / 2 + r.height / 2); })()`);
    await sleep(3000);
    const info = await evaluate(`(() => {
      const c = document.querySelector(${JSON.stringify(selector)});
      if (!c) return { found: false };
      const r = c.getBoundingClientRect();
      let webgl = null;
      if (c instanceof HTMLCanvasElement) webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
      return { found: true, webgl, size: [Math.round(r.width), Math.round(r.height)],
        buffer: c instanceof HTMLCanvasElement ? [c.width, c.height] : null,
        visible: r.width > 0 && r.height > 0 && getComputedStyle(c).visibility !== 'hidden' && getComputedStyle(c).opacity !== '0',
        canvases: document.querySelectorAll('canvas').length };
    })()`);

    // Mover el puntero sobre el elemento mientras se miden los cuadros por segundo.
    const box = await evaluate(`(() => { const c = document.querySelector(${JSON.stringify(selector)}); if (!c) return null; const r = c.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })()`);
    const fpsPromise = evaluate(`new Promise((done) => { let n = 0; const t0 = performance.now(); const tick = (t) => { n++; t - t0 < ${seconds * 1000} ? requestAnimationFrame(tick) : done(Math.round(n / ((t - t0) / 1000))); }; requestAnimationFrame(tick); })`);
    if (box) {
      const steps = 24;
      for (let i = 0; i <= steps; i++) {
        const x = box[0] + box[2] * (0.2 + 0.6 * (i / steps));
        const y = box[1] + box[3] * (0.5 + 0.25 * Math.sin(i / 3));
        await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await sleep((seconds * 1000) / steps / 1.5);
      }
    }
    const fps = await fpsPromise;
    const { data } = await b.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(outDir, `${name}${scheme ? `-${scheme}` : ''}.png`);
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    return { name, ...info, fps, errors: [...new Set(errors)], warnings: [...new Set(warnings)], transferredKB: Math.round(scriptBytes / 1024), screenshot: file };
  } finally {
    await b.close();
  }
}

const cases = [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844, mobile: true, cpu: 4 }],
  ['reduced-motion', { width: 1440, height: 900, reducedMotion: true }],
  ['no-webgl', { width: 1440, height: 900, flags: ['--disable-webgl', '--disable-3d-apis'] }],
];
const results = [];
for (const [name, c] of cases) {
  try { results.push(await runCase(name, c)); }
  catch (e) { results.push({ name, failed: String(e.message || e) }); }
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ url, selector, results }, null, 2));

// Resumen e indicadores.
console.log(`\n${url}\n`);
let problems = 0;
for (const r of results) {
  if (r.failed) { console.log(`✗ ${r.name.padEnd(15)} no se pudo medir: ${r.failed}`); problems++; continue; }
  const notes = [];
  if (r.name === 'no-webgl') {
    notes.push(r.found && r.webgl ? 'WebGL siguió activo: revisar la detección' : 'sin WebGL: mirá la captura y confirmá que se ve la alternativa');
  } else if (r.name === 'reduced-motion') {
    notes.push(`${r.fps} fps de la página; mirá la captura: tiene que ser un cuadro quieto o la alternativa`);
  } else {
    if (!r.found) { notes.push(`no encontré "${selector}"`); problems++; }
    else if (!r.webgl) { notes.push('el elemento existe pero no tiene contexto WebGL'); problems++; }
    else notes.push(`WebGL ${r.size.join('×')} (buffer ${r.buffer?.join('×')}) · ${r.fps} fps`);
    if (r.canvases > 1) notes.push(`${r.canvases} canvas en la página`);
  }
  if (r.errors.length) { notes.push(`${r.errors.length} errores`); problems++; }
  if (r.warnings.length) notes.push(`${r.warnings.length} avisos`);
  console.log(`${r.errors.length || (r.name !== 'no-webgl' && r.name !== 'reduced-motion' && !r.webgl) ? '✗' : '✓'} ${r.name.padEnd(15)} ${notes.join(' · ')} · ${r.transferredKB} KB transferidos`);
  r.errors.slice(0, 5).forEach((e) => console.log(`    error: ${e}`));
  r.warnings.slice(0, 3).forEach((e) => console.log(`    aviso: ${e}`));
}
console.log(`\nCapturas y reporte en ${outDir}\n`);
process.exit(problems ? 1 : 0);
