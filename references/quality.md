# Getting it to studio level

"Make it amazing" isn't a bar. A reference you can point at is. This is the loop that took a flat first version of a 3D book to something that holds up next to the reference it was measured against.

## 1. Set a bar you can point at

- Ask the person for a reference whose 3D they love (a URL or a recording). If they give none, propose two and let them pick.
- Capture it at the moments that matter and save the captures in `workbench/reference/`. Use them to measure, never to copy: no logos, content, code or signature effects from it.
- Write `workbench/bar.md`: one row per element, what the reference does, and the named state where you'll judge it.

## 2. Split the piece into elements

Judge each one alone. For a 3D object, typically:

| Element | Question |
|---|---|
| Object | Does it read as the real thing (thickness, edges, parts)? |
| Form | Does it bend, sag or settle like the material would? |
| Light | Is there a gradient across curvature, contact darkening, cast shadow? |
| Material | Does the surface look like its material (grain, print, sheen), not a flat color? |
| Shadow | Does a soft shadow ground it and follow its shape? |
| Motion | Does the entrance have weight? Is the rest state alive? Does input feel calm, not twitchy? |
| Interaction | Is it obvious it can be touched? Does every gesture land where the hand expects? |

## 3. Named states and a hook to reach them

The piece exposes, only with a debug flag in the URL:

```js
window.__app = { ready: true, goto(name) { /* freeze time and set the exact pose */ }, states: ["intro", "rest", "turning", ...] };
```

`goto` freezes time, so two captures of the same state are identical. Then:

```bash
node <skill>/scripts/capture-states.mjs "<url>?debug" --out workbench/round-N
node <skill>/scripts/capture-states.mjs "<url>?debug" --out workbench/round-N-mobile --mobile
```

## 4. Builder and critic rounds

Each round:

1. **Capture** every state.
2. **Critique** against the bar: score each element 1 to 10 and name **the single biggest gap**. Judge what's on screen, not what the code meant to do.
3. **Fix that gap only.** Keep the previous round's captures.
4. Log the round in `workbench/rounds.md`: scores, the gap, the fix.

Stop when every element meets the bar, when two rounds gain less than half a point, or when the person says stop. If an element is stuck for two rounds, change the approach instead of pushing the same one harder.

If the agent can spawn sub-agents, the critic should be a fresh one each round that only sees the captures and the bar, never the builder's notes.

## 5. Test the interaction, not just the pictures

Screenshots don't prove a gesture works. Drive the real page with input events (the DevTools protocol, or Playwright if the project has it) and assert the result: hover shows the hint, a click goes where it should, keys work, a drag moves exactly as far as intended, the console stays clean.

## Lessons that tend to repeat

- **Cinema tone mapping greys out paper and print.** ACES and similar curves are for HDR scenes. For printed objects, UI or flat brand color, use no tone mapping and design the light so a surface facing it lands at 1.0.
- **Light from one side means shadows fall to the other.** A raised page, card or panel casts its shadow away from the light, onto what's beside it, not where it stands.
- **Show-through and similar realism effects read as bugs when visible.** Keep them at the edge of perception.
- **Visible hints need exaggeration.** A corner that lifts 10° is invisible at a three-quarter view; 30° reads as an invitation.
- **Gestures must not overshoot.** Momentum can decide whether a page completes, never skip one.
- **Texture memory is a budget.** Count it: width × height × 4 bytes × 1.33 for mipmaps, per texture. Lower the resolution on small screens before cutting content.
- **If it could be done with CSS layers, it isn't a WebGL concept.** Depth that never shows volume, light or real motion in space looks like parallax and disappoints.
