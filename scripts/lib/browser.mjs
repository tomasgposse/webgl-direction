// Navegador headless (Chrome o Edge) controlado por el protocolo de DevTools.
// Sin dependencias: WebSocket nativo de Node 22+. Lo usan check.mjs y capture-states.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BROWSERS = [
  process.env.WEBGL_DIRECTION_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const browserPath = BROWSERS.find((p) => fs.existsSync(p));
if (!browserPath) throw new Error('No encontré Chrome ni Edge. Indicá la ruta con WEBGL_DIRECTION_BROWSER.');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let nextPort = 9411;

export async function open({ flags = [] } = {}) {
  const port = nextPort++;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'depthfirst-'));
  // Sin --disable-gpu: queremos WebGL real (por GPU o por SwiftShader).
  const proc = spawn(browserPath, ['--headless=new', '--hide-scrollbars', '--no-first-run', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, ...flags, 'about:blank'], { stdio: 'ignore' });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(200);
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  if (!target) throw new Error('El navegador no respondió.');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) listeners.forEach((l) => l(msg));
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const close = async () => { try { ws.close(); } catch {} proc.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} };
  return { send, on: (f) => listeners.push(f), close };
}

