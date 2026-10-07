---
name: webgl-direction
description: Art-directs and builds an interactive WebGL experience for a website, grounded in that specific project. Reads the whole project (product, audience, brand, design system, copy, assets), proposes three concepts tied to it, each with placement, interaction, look and cost, lets the person choose, then builds the chosen one with Three.js or React Three Fiber, with performance budgets, a reduced-motion version, a no-WebGL fallback and mobile support, and verifies it in a real browser. Use when someone wants 3D, WebGL, shaders or an interactive hero for their site, asks what 3D experience would suit their project, or wants their site to feel less static. For Three.js API details it pairs well with API-focused Three.js skills.
---

# webgl-direction

Most WebGL on the web is a generic object that could sit on any site: floating particles, a glossy blob, a spinning globe. This skill does the opposite. The 3D comes **from the project itself**: its subject, its brand, its story, the way its users behave. Then it gets built so it runs well for everyone, including people on cheap phones and people who turn motion off.

Talk to the person in their language. Write code comments in the project's existing style.

## The flow

1. **Survey** the project with the script.
2. **Read** it like a creative director.
3. **Propose** three concepts.
4. **The person chooses.** Never build before they do.
5. **Build** the chosen concept.
6. **Verify** it in a real browser.
7. **Hand back** with evidence.

### 1. Survey

```bash
node <skill>/scripts/survey.mjs <project>
```

`<skill>` is the folder this file lives in. The script prints a summary and writes `<project>/.webgl-direction/survey.json` (add `.webgl-direction/` to the project's `.gitignore` if it isn't there): framework, router, whether Three.js or R3F is installed, color tokens, fonts, motion libraries, candidate brand assets (logos, characters, illustrations), product and design docs, and the page copy it can find.

### 2. Read

The survey gives facts. Now understand. Read, in this order:

1. Product and design docs (`PRODUCT.md`, `DESIGN.md`, `README`, `AGENTS.md`, `CLAUDE.md`, brand guidelines).
2. The home page and its components: what is above the fold, what each section is for.
3. The brand assets the survey found. Open the images and look at them.
4. The copy: headlines, tone, recurring words.

Then write, for yourself, five short answers. Concepts come from these, not from a list of cool effects:

- **What is this, in one sentence, and for whom?**
- **What is the one object or image that belongs to this world?** A product's core object, a mascot, a logo shape, a material, a place.
- **What does the audience need to feel or understand in the first ten seconds?**
- **What gesture belongs to this world?** How its users act: scroll, drag, hold, tap, point, wait.
- **What does the visual system forbid?** If the brand is flat ink on paper, a glossy PBR render breaks it.

### 3. Propose three concepts

Read [`references/concepts.md`](references/concepts.md) first. Present exactly three, different from each other in kind (not three variations of one idea). For each:

- **Name** — two to four words.
- **The idea** — two sentences. What the visitor sees and does.
- **Why it belongs here** — which answer from step 2 it comes from. If you can't point to one, drop the concept.
- **Where it lives** — hero, a section, a transition, loading, an empty state, 404, a background.
- **Interaction** — on desktop and on touch. Never hover-only.
- **Look** — how it uses the project's own tokens, type and assets.
- **Cost** — new dependencies and approximate size, effort (S/M/L), risk on low-end phones.
- **Without motion** — what someone with reduced motion or no WebGL sees.

Then give your recommendation and why, and say plainly if one of the three is the safe option and another is the ambitious one. If 3D doesn't add anything to this project, say so instead of forcing three ideas.

Show the concepts and stop. Ask the person to choose one, combine them, or ask for others.

### 4. Build

Read [`references/craft.md`](references/craft.md) and [`references/quality.md`](references/quality.md) before writing code. Set the bar first: a reference the person loves, captured into `workbench/reference/`, and `workbench/bar.md`. Non-negotiable:

- Work on a new git branch, never on main.
- The 3D runs client-side only and is lazy-loaded: it never blocks the first paint or the text.
- Reduced motion shows a still frame or the fallback, not a slower animation.
- No WebGL, failed context or a too-slow device shows a designed fallback, not a blank box.
- Mobile works with touch, renders at a capped pixel ratio and pauses when off-screen.
- Colors, fonts and assets come from the project's tokens, and follow its dark mode if it has one.
- The canvas is decorative to screen readers (`aria-hidden`) unless it carries information, and any information also exists as text.
- Don't change the rest of the site to make room for the effect without asking.
- Behind a debug flag in the URL, expose `window.__app = { ready, goto(state), states }` with named states that freeze time, so every capture is exact and repeatable.
- If the person will integrate it themselves, build it as a self-contained module with a small API (create, destroy, callbacks) and a demo page.

### 5. Verify and iterate

Run builder and critic rounds as described in `references/quality.md`: capture every named state, score each element against the bar, fix the single biggest gap, repeat.

```bash
node <skill>/scripts/capture-states.mjs "<url>?debug" --out workbench/round-N [--mobile] [--color-scheme dark]
```

Then test the interaction with real input events, and run the final check:

```bash
node <skill>/scripts/check.mjs <url> [--selector <css>] [--color-scheme light|dark] [--out <project>/.webgl-direction/check]
```

It opens the page in a real headless Chrome or Edge, on desktop and on a phone-sized viewport, and reports: whether a WebGL canvas rendered, console errors, frames per second over a few seconds, what the page shows with reduced motion, and screenshots of each case. Look at the screenshots. Fix anything that fails and run it again.

### 6. Hand back

Tell the person, in plain language:

- What you built and where it lives, with the screenshots.
- The numbers: added size, frames per second on desktop and mobile emulation, texture memory.
- The rounds: scores per element, what improved, and what is still below the reference.
- What happens with reduced motion and without WebGL.
- What you'd improve next, and anything you couldn't verify (real devices, real GPUs).

## What it doesn't do

- It doesn't model complex 3D assets. It builds from geometry, shaders, the project's own images and SVGs, or models the person already has.
- It doesn't replace testing on real phones: headless measurements are an estimate.
- It doesn't ship anything. It works on a branch and leaves merging to the person.
