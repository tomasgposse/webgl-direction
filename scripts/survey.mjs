#!/usr/bin/env node
// Relevamiento de un proyecto web antes de proponer una experiencia WebGL.
// Uso: node survey.mjs <ruta-del-proyecto>
// Escribe <proyecto>/.depthfirst/survey.json e imprime un resumen. Sin dependencias.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.vercel', '.turbo', 'coverage', '.depthfirst', '.svelte-kit', '.nuxt', '.astro']);

function walk(dir, depth = 0, out = []) {
  if (depth > 6 || !fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || (e.name.startsWith('.') && e.name !== '.claude')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, depth + 1, out);
    else out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };
const files = walk(root);
const pkg = JSON.parse(read(path.join(root, 'package.json')) || '{}');
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const has = (name) => Object.keys(deps).some((d) => d === name || d.startsWith(name + '/'));

// --- Stack ---
const framework =
  has('next') ? 'next' : has('astro') ? 'astro' : has('nuxt') ? 'nuxt' : has('@sveltejs/kit') ? 'sveltekit'
  : has('vite') ? 'vite' : files.some((f) => f.endsWith('index.html')) ? 'static-html' : 'unknown';
const appRouter = framework === 'next' && files.some((f) => /[\\/]app[\\/](\[[^\]]+\][\\/])?(page|layout)\.(t|j)sx?$/.test(f));
const stack = {
  framework,
  frameworkVersion: deps.next || deps.astro || deps.nuxt || deps['@sveltejs/kit'] || deps.vite || null,
  router: framework === 'next' ? (appRouter ? 'app' : 'pages') : null,
  react: deps.react || null,
  typescript: has('typescript'),
  styling: [has('tailwindcss') && `tailwind ${deps.tailwindcss}`, has('styled-components') && 'styled-components', has('sass') && 'sass'].filter(Boolean),
  three: {
    three: deps.three || null,
    fiber: deps['@react-three/fiber'] || null,
    drei: deps['@react-three/drei'] || null,
    other: Object.keys(deps).filter((d) => /^(ogl|@react-three\/(?!fiber|drei)|postprocessing|lygia|theatre|@theatre|spline|@splinetool|pixi|babylon)/.test(d)),
  },
  motion: Object.keys(deps).filter((d) => /^(motion|framer-motion|gsap|lenis|@studio-freight\/lenis|animejs|lottie|@lottiefiles|react-spring|@react-spring)/.test(d)),
};

// --- Tokens: variables CSS con colores, fuentes ---
const cssFiles = files.filter((f) => /\.(css|scss|sass|less)$/.test(f));
const colorRe = /(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\)|oklab\([^)]*\))/g;
const colors = {};
for (const f of cssFiles) {
  const css = read(f);
  // Bloques con selector de tema oscuro: los valores se guardan aparte.
  const blocks = css.split('}');
  for (const b of blocks) {
    const dark = /dark/i.test(b.slice(0, b.indexOf('{') + 1));
    for (const m of b.matchAll(colorRe)) {
      const key = m[1];
      colors[key] ??= {};
      colors[key][dark ? 'dark' : 'light'] ??= m[2];
    }
  }
}
const fontFiles = files.filter((f) => /\.(woff2?|ttf|otf)$/.test(f)).map(rel);
const fontFamilies = new Set();
for (const f of [...cssFiles, ...files.filter((f) => /\.(t|j)sx?$/.test(f) && /layout|font|_app|_document|root/i.test(f))]) {
  const s = read(f);
  for (const m of s.matchAll(/font-family\s*:\s*([^;}{]+)/g)) fontFamilies.add(m[1].trim().split(',')[0].replace(/["']/g, ''));
  for (const m of s.matchAll(/(?:from\s+["']next\/font\/google["'][^]*?)?\b([A-Z][A-Za-z_]+)\(\s*\{[^}]*subsets/g)) fontFamilies.add(m[1].replace(/_/g, ' '));
  for (const m of s.matchAll(/localFont\(\s*\{[^]*?variable\s*:\s*["']([^"']+)["']/g)) fontFamilies.add(`local ${m[1]}`);
}
const easings = new Set();
for (const f of cssFiles) for (const m of read(f).matchAll(/cubic-bezier\([^)]*\)/g)) easings.add(m[0]);

// --- Assets de marca candidatos ---
const imgFiles = files.filter((f) => /\.(svg|png|webp|jpe?g|gif|avif|glb|gltf)$/i.test(f) && !/favicon|apple-touch|og-image|opengraph/i.test(f));
const brandHint = /logo|brand|mark|mascot|character|personaje|avatar|portrait|icon|isotipo|illustr|ilustr|hero|face|cara/i;
const assets = imgFiles
  .map((f) => ({ path: rel(f), kb: Math.round(fs.statSync(f).size / 1024), brand: brandHint.test(rel(f)) }))
  .sort((a, b) => Number(b.brand) - Number(a.brand) || a.path.length - b.path.length);
const models = assets.filter((a) => /\.(glb|gltf)$/i.test(a.path));

// --- Documentos del producto y del diseño ---
const docNames = /^(readme|product|design|brand|agents|claude|handoff|style|tokens|design-system|guidelines)[\w.-]*\.md$/i;
const docs = files
  .filter((f) => docNames.test(path.basename(f)) && rel(f).split('/').length <= 3)
  .map((f) => ({ path: rel(f), lines: read(f).split('\n').length }));

// --- Textos visibles: títulos y frases en componentes y contenido ---
const textFiles = files.filter((f) => /\.(t|j)sx|\.(html|astro|vue|svelte|mdx?)$/.test(f) && !/test|spec|stories/.test(f));
const headings = new Set();
for (const f of textFiles) {
  const s = read(f);
  for (const m of s.matchAll(/<h[12][^>]*>([^<{]{3,120})</g)) headings.add(m[1].replace(/\s+/g, ' ').trim());
}
// Archivos de contenido o i18n: frases entre comillas de largo razonable.
const contentFiles = files.filter((f) => /[\\/](content|i18n|locales|messages|copy|data)[\\/]/.test(f) && /\.(t|j)s|\.json$/.test(f));
const phrases = [];
for (const f of contentFiles) {
  for (const m of read(f).matchAll(/["'`]([A-ZÁÉÍÓÚÑ¿¡][^"'`\n]{18,160})["'`]/g)) {
    if (/https?:|\/|\.(png|jpg|svg|mp4)|className|\$\{/.test(m[1])) continue;
    phrases.push(m[1].trim());
    if (phrases.length >= 60) break;
  }
}

// --- Páginas y componentes de la home ---
const pages = files.filter((f) => /[\\/](app|pages|src[\\/]pages)[\\/].*(page|index)\.(t|j)sx?$|[\\/]index\.html$/.test(f)).map(rel);
const components = files.filter((f) => /[\\/]components[\\/][^\\/]+\.(t|j)sx|\.(vue|svelte)$/.test(f)).map(rel);
const themeSwitch = files.some((f) => /\.(t|j)sx?$/.test(f) && /data-theme|classList\.(add|toggle)\(["']dark|next-themes/.test(read(f)));

const survey = {
  project: pkg.name || path.basename(root),
  root,
  stack,
  tokens: { colors, fontFamilies: [...fontFamilies], fontFiles, easings: [...easings], darkTheme: themeSwitch || Object.values(colors).some((c) => c.dark) },
  assets: { brandCandidates: assets.filter((a) => a.brand).slice(0, 25), models, totalImages: assets.length },
  docs,
  pages,
  components: components.slice(0, 60),
  copy: { headings: [...headings].slice(0, 40), phrases: phrases.slice(0, 40) },
  reducedMotionHandled: files.some((f) => /prefers-reduced-motion|useReducedMotion/.test(read(f))),
};

const outDir = path.join(root, '.depthfirst');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'survey.json'), JSON.stringify(survey, null, 2));

// --- Resumen legible ---
const line = (k, v) => console.log(`${k.padEnd(16)} ${v}`);
console.log(`\n${survey.project}\n`);
line('Framework', `${stack.framework} ${stack.frameworkVersion || ''}${stack.router ? ` (${stack.router} router)` : ''}`);
line('React', stack.react || 'no');
line('3D installed', [stack.three.three && `three ${stack.three.three}`, stack.three.fiber && `r3f ${stack.three.fiber}`, stack.three.drei && `drei ${stack.three.drei}`, ...stack.three.other].filter(Boolean).join(', ') || 'none');
line('Motion libs', stack.motion.join(', ') || 'none');
line('Styling', stack.styling.join(', ') || 'plain CSS');
line('Colors', Object.entries(colors).slice(0, 12).map(([k, v]) => `${k} ${v.light || ''}${v.dark ? `/${v.dark}` : ''}`).join(' · ') || 'none found');
line('Dark theme', survey.tokens.darkTheme ? 'yes' : 'no');
line('Fonts', [...fontFamilies].join(', ') || fontFiles.join(', ') || 'none found');
line('Easings', [...easings].join(' ') || 'none');
line('Brand assets', survey.assets.brandCandidates.slice(0, 8).map((a) => a.path).join(', ') || 'none flagged');
line('3D models', models.map((m) => m.path).join(', ') || 'none');
line('Docs', docs.map((d) => d.path).join(', ') || 'none');
line('Pages', pages.slice(0, 8).join(', '));
line('Reduced motion', survey.reducedMotionHandled ? 'already handled somewhere' : 'not handled yet');
console.log(`\nHeadings: ${survey.copy.headings.slice(0, 8).join(' | ') || '—'}`);
console.log(`\n-> ${path.join(outDir, 'survey.json')}\n`);
