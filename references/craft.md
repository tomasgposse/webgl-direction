# Building it well

## Stack

- **A small scene** (a few meshes, custom shaders, no complex scene graph), even in React → plain `three` with **named imports**, mounted in a `useEffect` and disposed by hand. It tree-shakes: a scene of planes with shader materials came to ~130 KB gzipped.
- **A larger scene in React** (many objects, state-driven, loaders, controls) → React Three Fiber (`three`, `@react-three/fiber`; add `@react-three/drei` only for what you use). It's worth knowing that fiber registers the whole `three` namespace, so it doesn't tree-shake: the same small scene came to ~240 KB gzipped with fiber.
- **Not React** → plain `three`.
- A full-screen shader with no scene graph can be a raw WebGL canvas and a fragment shader: the smallest option.
- Install the latest stable versions and check the installed major version before writing code: R3F's major version follows React's.

## Loading

- Client-side only. In Next.js App Router, the 3D lives in a `"use client"` component imported with `next/dynamic` and `ssr: false` from another client component.
- Lazy: import it when it's about to be visible (IntersectionObserver), or after the page is idle for a hero.
- The text and layout around it render first, with the fallback in place. The canvas fades in over the fallback when its first frame is ready, so there's never a blank box.
- Budget: aim for under ~180 KB gzipped for the 3D chunk (three alone is most of it). Say the real number in the handoff.

## Render loop

- Cap the pixel ratio: `Math.min(devicePixelRatio, 2)`, and 1.5 on small screens.
- Pause when off-screen or when the tab is hidden. In R3F, `frameloop="demand"` plus `invalidate()` for scenes that only move on input, or toggle `frameloop` with an IntersectionObserver.
- Use `antialias` only if lines or edges need it; prefer shading that hides aliasing.
- No allocations inside the frame loop: reuse vectors and colors.
- Dispose geometries, materials and textures on unmount.

## Reduced motion

- Read `prefers-reduced-motion: reduce` and react to changes.
- With reduced motion, render one composed still frame (or show the fallback). Don't just slow it down.
- Scroll-driven pieces jump to their end state.

## Fallback

- Detect WebGL before mounting: create a canvas and ask for `webgl2` or `webgl`. If it fails, keep the fallback.
- Catch context loss (`webglcontextlost`) and switch to the fallback.
- The fallback is designed: the project's static image, SVG or a CSS version, in the same space, so the layout never jumps.

## Mobile and input

- Pointer events, not mouse events. Every interaction works with touch.
- Don't block page scroll with the canvas: set `touch-action` to what you need, and only capture drags that start on the object.
- Phones get a lighter version when needed: fewer segments, fewer instances, no post-processing.

## Brand fidelity

- Read colors from the project's CSS variables at runtime (`getComputedStyle(document.documentElement)`), so the scene follows the theme. Re-read them when the theme changes (watch the attribute or class the project toggles).
- Use the project's own assets as textures or as the source of geometry (SVG paths → shapes, lines or tubes).
- Match the project's easing curves and durations.

## Accessibility

- `aria-hidden="true"` on the canvas when it's decorative. If it shows information, put the same information in text nearby.
- Nothing essential is only reachable through the 3D.
- Interactive objects that matter get a keyboard path, or the action exists elsewhere as a normal button.
- No flashing more than three times per second.

## Verification checklist

- [ ] First paint shows text and the fallback, not a blank space.
- [ ] No console errors or warnings from the scene.
- [ ] Smooth on desktop; acceptable at mobile size with CPU throttling.
- [ ] Reduced motion shows a still frame.
- [ ] Without WebGL, the fallback shows and the layout doesn't jump.
- [ ] Touch works and page scroll isn't blocked.
- [ ] Follows light and dark themes, if the project has both.
- [ ] Unmounting (navigating away and back) doesn't leak or duplicate canvases.
