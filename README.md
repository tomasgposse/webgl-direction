# depthfirst

**English** · [Español](#español)

Most WebGL on the web is a generic object that could sit on any site: floating particles, a glossy blob, a spinning globe. `depthfirst` is an agent skill that does the opposite. It reads your project, proposes three 3D concepts that come **from that project** (its subject, its brand, its story), lets you choose, builds the one you pick and keeps improving it against a reference you love until it holds up.

*Depth first: it reads the project first, then adds the depth.*

![A printed booklet in 3D in a portfolio hero, open on a case study](docs/book-spread.png)

## What it does

1. **Surveys the project**: framework, color tokens, fonts, brand assets, docs and copy (`scripts/survey.mjs`).
2. **Proposes three concepts** tied to the project, each with placement, interaction on desktop and touch, look, cost, and what people with reduced motion or no WebGL will see. It can also say that 3D doesn't fit.
3. **You choose.** It never builds before that.
4. **Builds it** with Three.js: lazy-loaded, paused off screen, a capped pixel ratio, a still frame for reduced motion and a designed fallback without WebGL.
5. **Sets a bar and iterates**: captures a reference, splits the piece into elements (object, form, light, material, shadow, motion, interaction), and runs builder and critic rounds on named states until each element meets the bar (`scripts/capture-states.mjs`, [`references/quality.md`](references/quality.md)).
6. **Verifies it in a real browser**: WebGL rendered, console errors, frames per second, a phone with a slow CPU, reduced motion and no WebGL, with screenshots (`scripts/check.mjs`).

## What it doesn't do

- It doesn't model complex 3D assets: it builds from geometry, shaders, your own images and SVGs, or models you already have.
- It doesn't replace testing on real phones: headless numbers are an estimate.
- It doesn't ship: it works on a branch, or hands you a module to integrate.

## Example: a printed portfolio

[`prototypes/book`](prototypes/book) is what came out of running the skill on my portfolio: my work as a printed booklet in the hero. Pages curve into the spine, a turning page casts its shadow on the one below, the cover lifts a corner to invite you in, and touching an open page takes you to that case study. It went through seven measured rounds; the scores and what's still below the reference are in [`workbench/rounds.md`](prototypes/book/workbench/rounds.md).

| | |
|---|---|
| ![Closed booklet with the cover corner lifting](docs/book-cover.png) | ![A page mid-turn casting a shadow](docs/book-turning.png) |

To run it: serve `prototypes/book` with any static server and open it. Boska and Switzer (Fontshare) aren't included; drop the `.woff2` files in `assets/` to see it with them.

## Install

```bash
npx skills add tomasgposse/depthfirst
```

Or clone it into your skills folder (for Claude Code, `~/.claude/skills/depthfirst`). Then ask your agent something like: *"Use depthfirst to propose an interactive 3D experience for this site."*

Requires Node 22+ and Chrome or Edge for the scripts. Tested on Windows.

---

## Español

La mayoría del WebGL en la web es un objeto genérico que podría estar en cualquier sitio: partículas flotando, una gota brillante, un globo que gira. `depthfirst` es una skill para agentes que hace lo contrario. Lee tu proyecto, propone tres conceptos 3D que salen **de ese proyecto** (su tema, su marca, su historia), te deja elegir, construye el elegido y lo mejora contra una referencia que te guste hasta que esté a la altura.

*Depth first: primero lee el proyecto y después le agrega profundidad.*

### Qué hace

1. **Releva el proyecto:** framework, tokens de color, tipografías, assets de marca, documentos y textos.
2. **Propone tres conceptos** anclados al proyecto, con ubicación, interacción en escritorio y en touch, estética, costo y qué ve quien tiene movimiento reducido o no tiene WebGL. También puede decir que el 3D no suma.
3. **Vos elegís.** Nunca construye antes.
4. **Lo construye** con Three.js: carga diferida, pausa fuera de pantalla, resolución limitada, un cuadro quieto para movimiento reducido y una alternativa diseñada sin WebGL.
5. **Fija una vara e itera:** captura una referencia, separa la pieza en elementos y hace rondas de constructor y crítico sobre estados con nombre hasta que cada elemento esté a la altura.
6. **Lo verifica en un navegador real:** WebGL, errores, cuadros por segundo, celular con CPU lenta, movimiento reducido y sin WebGL, con capturas.

### Qué no hace

- No modela assets 3D complejos.
- No reemplaza probar en teléfonos reales.
- No publica: trabaja en una rama o te entrega un módulo para integrar.

### Ejemplo

[`prototypes/book`](prototypes/book): mi trabajo como un cuadernillo impreso en el hero de mi portfolio. Las rondas y lo que todavía está por debajo de la referencia están en [`workbench/rounds.md`](prototypes/book/workbench/rounds.md).

### Instalación

```bash
npx skills add tomasgposse/depthfirst
```

## License · Licencia

MIT
