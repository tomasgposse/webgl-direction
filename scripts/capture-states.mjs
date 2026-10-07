#!/usr/bin/env node
// Captura una pieza WebGL en sus estados con nombre, para comparar cada ronda contra la referencia.
// La página expone window.__app = { ready, goto(nombre), states } (solo con un parámetro de debug en la URL).
//
// Uso: node capture-states.mjs <url> --out <carpeta> [--states a,b,c] [--size 1440x900] [--mobile] [--color-scheme light|dark]
// Escribe <carpeta>/<estado>.png y <carpeta>/index.html con todas las capturas lado a lado.

import fs from 'node:fs';
import path from 'node:path';
import { open, sleep } from './lib/browser.mjs';

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:/.test(a));
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
if (!url || !args.includes('--out')) {
  console.error('Uso: node capture-states.mjs <url> --out <carpeta> [--states a,b] [--size 1440x900] [--mobile] [--color-scheme light|dark]');
  process.exit(1);
}
const outDir = path.resolve(opt('--out'));
const mobile = args.includes('--mobile');
const [width, height] = opt('--size', mobile ? '390x844' : '1440x900').split('x').map(Number);
const scheme = opt('--color-scheme', null);
fs.mkdirSync(outDir, { recursive: true });

const b = await open();
const errors = [];
b.on((m) => {
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
});
try {
  await b.send('Page.enable');
  await b.send('Runtime.enable');
  await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: mobile ? 3 : 2, mobile });
  if (scheme) await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  await b.send('Page.navigate', { url });
  const evaluate = async (expression) => (await b.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;

  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) { ready = await evaluate('!!(window.__app && window.__app.ready)'); if (!ready) await sleep(250); }
  if (!ready) throw new Error('La página no expuso window.__app.ready. ¿Falta el parámetro de debug en la URL?');

  const states = opt('--states', null)?.split(',') || (await evaluate('window.__app.states'));
  const shots = [];
  for (const name of states) {
    await evaluate(`window.__app.goto(${JSON.stringify(name)})`);
    await sleep(350);
    const { data } = await b.send('Page.captureScreenshot', { format: 'png' });
    const file = `${name}.png`;
    fs.writeFileSync(path.join(outDir, file), Buffer.from(data, 'base64'));
    shots.push(file);
    console.log(`✓ ${name}`);
  }
  // Hoja de contacto para la revisión.
  fs.writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Estados</title>
<style>body{margin:24px;font:13px system-ui;background:#f4f4f2}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:20px}
figure{margin:0}img{width:100%;border:1px solid #ddd;background:#fff}figcaption{margin-top:6px;color:#555}</style>
<main>${shots.map((f) => `<figure><img src="${f}"><figcaption>${f.replace('.png', '')}</figcaption></figure>`).join('')}</main>`);
  if (errors.length) console.log(`\n${errors.length} errores en la consola:\n  ${[...new Set(errors)].slice(0, 5).join('\n  ')}`);
  console.log(`\n-> ${outDir}`);
} finally {
  await b.close();
}
