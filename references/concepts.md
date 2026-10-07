# Where concepts come from

A good WebGL concept passes one test: **if you moved it to another site, it would stop making sense.** If it would work just as well on any site, it's decoration.

And a second test: **if it could be done with CSS layers, it isn't a WebGL concept.** Flat planes at different depths read as parallax. WebGL earns its cost with volume, light that changes as things move, and objects moving in space.

## Five sources

Every concept should come from at least one of these. Name it in the proposal.

| Source | Question | Example |
|---|---|---|
| **The object** | What thing is at the center of this world? | A finance app built around coins: coins that stack as you scroll. A coffee brand: steam that reacts to the cursor. |
| **The brand asset** | Is there a mascot, a character, a logo shape, an illustration style? | A designer's work printed as a real 3D booklet you can leaf through. A logo built from two rings that link when you drag them. |
| **The material** | What is this world made of? | Ink on paper, neon on a wall, concrete, fabric, glass, a screen. The effect simulates the material, not generic shading. |
| **The gesture** | How do this audience or this product make people act? | A studio that designs gesture games: hold the cursor still to choose, like raising a hand. A delivery app: drag to send. |
| **The story** | What change does the project tell? | Before and after, scattered to ordered, empty to full. The 3D performs that change once, driven by scroll. |

The strongest concepts combine two: the brand asset made of its material, the object moved by the audience's gesture.

## Placements

| Placement | Good for | Watch out |
|---|---|---|
| **Hero** | First impression, identity | It delays the most important text if it's heavy. The text must be readable before the 3D loads. |
| **Section** | Explaining one idea, a product feature | It must earn its scroll length. |
| **Transition** | Linking two sections, a page change | Short. Never block navigation. |
| **Loading** | Turning a wait into brand | Only if there's a real wait. Never add a wait to show it. |
| **Empty state or 404** | Small surprise, low risk | Good first project for a team new to WebGL. |
| **Background** | Atmosphere | Easiest to make generic. Needs a strong source. |

## Interactions

- **Cursor or pointer position** — the default. On touch it becomes drag or device tilt, or the piece animates on its own.
- **Scroll** — tie progress to a story with a start and an end. Never hijack scrolling speed.
- **Drag** — gives a sense of material. Needs a visible affordance.
- **Hold** — dwell to choose, charge or reveal. Show progress.
- **Click or tap** — a discrete response. Keep it fast.
- **Idle** — what it does when nobody touches it. It shouldn't look broken.

Every concept describes desktop **and** touch. Hover-only interactions don't exist on phones.

## Generic patterns to avoid

Unless a source above justifies them, these read as stock WebGL:

- Floating particles or a starfield.
- A glossy, iridescent blob that wobbles.
- A spinning globe or a wireframe sphere.
- A gradient mesh background with no reason.
- A low-poly landscape.
- Text exploding into particles on load.
- A 3D version of the logo slowly rotating.

They aren't forbidden. They need a reason that belongs to this project, stated in the proposal.

## Matching the visual system

- **Flat or illustrated brands** — lines, flat fills, posterized or hatched shading, the project's own drawings as textures. No realistic lighting.
- **Monochrome brands** — the effect is monochrome too. Color, if any, comes from where the brand already allows it.
- **Editorial, type-led brands** — the type can be the 3D material: letters on a surface, displacement, depth of field on text. Keep it readable.
- **Dark and light themes** — the scene reads the current theme and changes with it.

## Writing the three

- Make them different in kind: for example one built on a brand asset, one on a gesture, one on the story.
- Mark one as safe (small, low risk, fast) and one as ambitious.
- Be honest about cost. A concept that only works on a high-end laptop isn't a website concept.
