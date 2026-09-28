# Architecture

Companion to [01-feature-spec.md](01-feature-spec.md) (what to build) and
[04-roadmap.md](04-roadmap.md) (in what order). This file holds the rules
every new feature must stay inside.

## Layering

```
src/
  core/    Pure TypeScript, framework-free. Scientific rules and teaching
           content: ion data, summation and threshold, and the neuron part
           model. Unit-testable without a browser.
  state/   Zustand stores. Hold only semantically meaningful values
           (selection, which inputs fired, current phase, zoom target).
           Derived values come from core/ functions — never stored.
  stage/   Canvas scenes plus the rAF-driven animation. Geometry
           (layout.ts), the causal timeline (chain.ts), painting
           (drawScene.ts) and Konva wiring (NeuronStage.tsx).
  ui/      DOM chrome: control panel, info panel, dialogs.
```

Dependency rule: `core` imports nothing from the app; `state` imports `core`;
`stage` and `ui` import both. Nothing imports sideways between `stage` and
`ui`.

## The two animation worlds

1. **DOM (Motion)** — chrome transitions: dialogs, panels, buttons.
   Declarative, fire-and-forget.
2. **Canvas (Konva + rAF)** — everything inside the scene. A single
   `Konva.Animation` per stage ticks it; per-frame values live in **refs**,
   and React is informed only through change-signatures (a run id, a phase
   name), never per frame.

## Signals never appear or disappear unexplained

The rule the first rebuild was made for. Two halves:

- **Every signal has a visible cause.** Nothing moves unless an input neuron
  was fired. An action potential exists only *after* summed input crossed
  threshold at the hillock, and it is always born there — never partway along
  the axon, never spontaneously. This is enforced in code, not just in
  drawing: `stage/chain.ts` derives the whole scene from elapsed time, and its
  tests assert that `axonHead` is null unless `hillockLevel ≥ THRESHOLD`.
- **Fading is allowed; deletion is not.** Graded ripples genuinely decay, and
  a subthreshold total genuinely leaks away — those are the lessons of N03 and
  N18. What is forbidden is a signal being *switched off*: a run that falls
  short must visibly drain, with the panel saying why.

## Three signal grammars

A signal crossing this scene is not one thing flowing through a wire. It is a
chain of different physics with conversions between them, and each must look
different:

| Stage | Character | How it is drawn |
| --- | --- | --- |
| Dendrite ripple | graded, analog, decaying | small warm glow, shrinking as it travels inward |
| Action potential | all-or-nothing, regenerating, constant | bright travelling **segment** with a glowing leading edge, same size the whole way |
| Synaptic transmission | chemical, discrete, delayed | pale individual particles crossing a gap, after a visible pause |

Never draw a continuous glowing line from one cell through to the next: that
teaches current flowing down a wire. The hand-off is a transformation.

## Scene composition

- **One focus neuron, drawn fully; partners drawn as context.** Partners use
  thinner strokes, a dimmer colour (`PARTNER`), flat somas with no nucleus,
  and their own branches run off the canvas edges — the frame is a window on a
  network that keeps going.
- Selecting a part of the focus neuron dims everything else to ~28 %, so
  anatomy exploration and physiology never compete for attention.
- Firing clears the current selection (a dimmed scene would hide the run).

## Spatial navigation instead of pages

There is **no page switcher**. Other views are reached by zooming into a place
on the neuron, so a topic is always anchored to where it happens and nothing
feels like a separate app.

- Zoom targets are declared in `stage/layout.ts` (`ZOOM_TARGETS`) with a
  centre, a magnification, and an honest promise of what will live there.
- The camera is the Konva **layer's** scale and position, animated
  imperatively. Putting it on the layer means the drawn scene and the
  transparent hit shapes transform together, so hit detection stays correct
  at any magnification.
- **Chrome is counter-scaled.** Labels, markers and the hillock meter divide
  their sizes by the camera scale, so they stay legible while the biology
  really does get bigger.
- Markers are drawn — and listen — only at fit zoom.
- **Simulation state lives in stores, not in views.** Zooming must never reset
  what is running, and a change made in a zoomed view must be visible when you
  zoom back out ("change one thing → observe what changes next", X01, raised
  to an architectural rule).
- **Magnification must be stated.** Every zoomed view names its factor, and
  the panel says that relative sizes in the drawing are deliberately
  distorted (boutons, vesicles and clefts are drawn far larger than life).
- **Camera moves interpolate magnification geometrically**, and their duration
  follows how many powers of ten they cross, so every zoom feels like the same
  rate of travel. The pan finishes in the first ~55 % of the move: a
  positional error that is invisible at ×1 is half a screen at ×2400, so
  panning late throws the target off the canvas.

## One honest scale, and level of detail

The scene has a single real scale, declared in `core/membrane.ts` and derived
in `stage/layout.ts`: the soma is 20 µm across, which fixes ~4.4 px per µm.
Everything smaller follows from biology rather than from what reads nicely —
the axon is 1.4 µm wide, the membrane 5 nm (0.022 scene pixels, invisible until
you zoom). Real numbers in `core/`, geometry derived from them, and tests
asserting the ratios the teaching text quotes: the text cannot drift from the
drawing.

Detail then appears as the camera earns it:

| Magnification | A process looks like |
| --- | --- |
| below ×5 | a line |
| ×5 – ×500 | a tube: a wall on each side, cytoplasm between |
| ×500 and up | a lipid bilayer — two leaflets of heads, tails in an oily middle |

Membrane targets sit at ×2400, picked so the bilayer renders ~52 px thick.
At that magnification one wall fills the canvas, so the textbook picture of a
membrane patch is reached *honestly, by zooming*, instead of by switching to a
different diagram.

**A structure's own texture must carry its physics, and both extremes mislead.**
The bilayer went through both: a perfectly sealed band teaches that permeability
is about having no room, and a regular row of separated pieces teaches that the
gaps are pores. Neither is what stops an ion — charge cannot enter a
low-dielectric oily phase, whatever the spacing. So the lipids sit close with
**small irregular gaps** (jittered deterministically per molecule, so the crowd
looks fluid without shimmering each frame), the hydrophobic core carries only a
whisper of tint, and the panel text carries the mechanism the picture cannot:
gaps are real but transient, small uncharged molecules do cross, ions never do.
Keep drawn gaps narrower than the particles that will later need channels, or
the "ions can only cross at a channel" lesson is undercut before it arrives.

## Canvas text must be drawn in screen space

Counter-scaling a font by 1/magnification asks the canvas for a 0.005 px font
at ×2400, and it simply refuses — labels disappear. All canvas text therefore
goes through `screenLabels()`, which resets the transform to the device pixel
ratio and maps each scene anchor through the layer matrix by hand. Labels are
a real 13 px at every magnification, positioned by a scene anchor plus an
offset in screen pixels. Geometry (rings, meters, dashes) can stay in scene
coordinates with counter-scaled sizes; only text cannot.

**Labels are chrome, so they are painted last, on plates.** `screenLabels()`
does not draw — it QUEUES, resolving each anchor to a screen position under the
transform in force at that moment, and `flushLabels()` paints the whole
collection after everything else in the frame. Ten call sites scattered through
the renderer were otherwise each painting at their own depth, which put the
channel names underneath the drifting ion crowd. Every label also gets its own
rounded plate, in slate rather than near-black: a plate darker than the canvas
background is invisible, and the point is for the words to have a container.
Plate height is derived from the font size, not from the glyphs, so a row of
labels lines up whatever letters it contains. A label already inside a panel
(the voltmeter's own readings) opts out with `plate: false`.

**Painting labels last means chrome must declare a keep-out.** Words on top of
everything are also words on top of the meter: the channel nearest the corner
had its name landing on the voltmeter panel on any window shorter than about
760 px, because the label band is anchored to the membrane (mid-canvas) while
the panel is anchored to the bottom. The meter publishes its screen rect and a
colliding label steps SIDEWAYS out of it, never upward — the channel names sit
in a band just under the membrane, and lifting one out of that band would read
as belonging to something else. Anything else parked in a corner has to do the
same. Chrome that overlaps chrome cannot be settled by z-order; one of the two
has to move.

## The camera turns PART OF THE WAY towards a membrane patch

A patch inherits the angle of the wall it sits on — 1.3° on the axon, 132° on a
dendrite trunk. That difference is worth keeping: arriving somewhere plainly
slanted says you have come to a particular place on a particular branch, not to a
diagram. But it cannot be kept in full — at 132° the crowd's rectangle stops
matching the screen so the corners empty, labels hang across the bilayer, and a
"+" charge mark reads as a multiplication sign. So the camera turns only far
enough to bring the tilt within `MAX_PATCH_TILT`, keeping its direction, and the
cytoplasm ends up below.

- **Cap it, do not remove it.** A patch already within the cap is left exactly as
  it is, camera unmoved.
- **The cap is set by the strictest thing that breaks.** Here that is glyph
  legibility: a plus survives 20° and dies by 45°. If glyphs were drawn upright in
  screen space — orientation carries no information for a charge sign — the cap
  could be much looser.
- **Anything that has to cover the screen derives its extent from the same
  constant.** The ion crowd's rectangle is the screen's rectangle turned by
  MAX_PATCH_TILT. Two numbers that must agree, written once.

- The turn happens LATE in the move, mirroring the pan finishing early: spinning a
  recognisable neuron is disorienting, while the same turn among featureless
  lipids reads only as levelling out.
- `patchLevelAngle()` must mirror what the renderer does on entering a patch,
  INCLUDING its Y flip — a mirrored frame needs the other half-turn or the cell is
  upside down. Two tests hold the two in step.
- **`m.a` is not the scale** once the layer can rotate; it is `scale·cos θ`. Screen
  helpers take `hypot(m.a, m.b)`.
- **The view rect is not the screen.** Under rotation it is a bounding box — right
  for culling and backdrops, wrong for anything pinned to a corner. Chrome pinned
  to the canvas takes canvas coordinates (`screen: true`), never a scene anchor
  standing in for one.

## The scene is the world; a drawer is thinking about the world

"Everything is the same scene, just closer" is load-bearing: the canvas never
lies about being the neuron. So content that is NOT the neuron — thought
experiments, lab benches, comparison rigs — never replaces the canvas. It slides
in as a DRAWER over a dimmed backdrop (the pattern atomic-playground uses for the
periodic table: in from the right, ✕ / backdrop / Escape to close), and the scene
stays visibly underneath, untouched, waiting. The drawer's own grammar carries
the honesty claim — "this is an aside, not a place" — structurally, before any
caption says it.

- **The criterion is what the content claims to be, not how big it is.** The
  spike demo stays on the canvas because it is the actual membrane doing the
  actual thing. The balance-an-ion lab bench goes in the drawer because it is a
  thought experiment about the membrane. A future myelin comparison rig would go
  in the drawer; the myelinated axon itself would not.
- The demo menu may list both kinds; choosing a drawer exhibit OPENS the drawer
  rather than swapping what the canvas claims to be.
- The drawer still opens with one plain line of framing ("a lab bench — four
  separate patches, not a picture of your neuron"). The grammar helps; the words
  seal it. Those words belong in the drawer's describer, as the first line of
  "What am I seeing?", not in a standfirst over the exhibit: a heading and a
  subheading take height from the only part of a drawer that is an experiment,
  and four membranes with a battery wired to them announce themselves.
- Port atomic-playground's `SideDrawer` (full-height slide-in, dimmed backdrop,
  Escape/✕/backdrop close) rather than inventing a second overlay pattern.

## Info panel state rules

Three sections, with different persistence:

1. **"Right now"** — live: the running chain's phase narration, or the zoom
   you are in, or the selected part, or the resting state. Never sticky; it
   would lie.
2. **Middle section** — follows context: the selected part's explanation, the
   zoom target's promise, or the scene overview.
3. **"What this simplifies" / "Keep in mind"** — the honesty line for whatever
   is currently on screen. Every simplified visualization states what it
   simplifies (F01).

**Drawer describers use the house container** (2026-08-27): `rounded-xl border
border-slate-700 bg-slate-800/40 p-3`, scrolling INSIDE its own frame —
`BenchInfoPanel` is the reference, inherited from the atomic playground's
info-block style. A bare unbordered column is not the pattern.

## Visual language

Shared vocabulary — every new feature must stay inside it:

- **Copper / bronze** = protein machinery (the pump copper, channels a cooler
  bronze), with **mint green** reserved for energy being spent (ATP). Distinct
  from the lipids, the ions and the amber of explanation.
- **Gold / warm white** = electrical activity. Gold is also the Na⁺ family
  colour, and a depolarization *is* Na⁺ entering, so the preview stays
  truthful once the ion machinery exists.
- **Pale slate particles** = chemical messengers. Chemistry is discrete stuff;
  electricity is glow. Never mix the two grammars.
- **Red** stays reserved for the threshold marker and, later, positive charge;
  **sky blue** for negative charge — inherited from the Atomic Playground so
  the two apps agree. Ion species therefore get non-red, non-blue bodies:
  **gold Na⁺, violet K⁺, green Cl⁻, pink Ca²⁺** (`stage/particleStyle.ts`).
- **An ion's charge is drawn ONE way** (2026-08-28, `drawIonCharge`): the
  atomic playground's charge-playground badge, ported — a **filled disc in the
  top-right corner** (centre at 0.85 × the ball's radius), red `#ef4444` for +
  and sky `#0ea5e9` for −, with a white glyph inside. The glyph is vector
  strokes rather than text, because this app draws ions inside contexts
  magnified by thousands, where a font is unreadable or refused outright.
- **A badge's SIZE is a fraction of its ball**: `BADGE_FRACTION` = 0.46 of the
  radius, and a view may nudge that only within `BADGE_MIN` 0.34 → `BADGE_MAX`
  0.6. Below the floor the glyph stops being legible; above the ceiling the
  badge outshouts the ion it belongs to.
- **…and never smaller than it LOOKS in the charge bench**
  (`BADGE_MIN_SCREEN_PX`, set by the user 2026-08-28 from that view's own
  badge, which is the reference every other view is held to). This one is a
  screen-space number, so the drawing helper never applies it: the caller,
  which is the only party that knows its own transform, converts it with
  `badgeMinR(scale)` and passes the result in its own units — the membrane
  view with the camera's magnification, a bench with its ×2. A floor may not
  grow a badge past the ball it belongs to. A test pins the constant against
  the charge bench's actual badge, so the reference cannot drift from the
  thing that defines it.
- **A control's enabled-ness may never depend on a value only the animation
  loop can advance** (2026-08-28). A drawer disabled its buttons on "is the
  run finished?", computed during render from a clock that only the rAF loop
  moves — so when the run finished nothing re-rendered, nothing re-enabled,
  and the exhibit was over for good. Either the loop clears the state (and
  that clearing is the re-render), or the control does not depend on it.
- **Animate the CONTAINER; never let the contents resize with it.** The
  contents rail grew from 44 px to 320 px and every paragraph inside rewrapped
  on every frame — visible jitter (user, 2026-08-28). The cause was a Tailwind
  `flex-1` sitting beside an inline `width`: `flex-1` is `flex: 1 1 0%` and it
  wins, so the list was genuinely being re-laid-out sixty times a second. The
  fix is the general rule for any slide-open panel: give the inner content a
  FIXED width and `shrink-0`, give the animating box `overflow-hidden`, and
  let the box REVEAL the content rather than resize it. Then nothing inside
  can reflow, because nothing inside ever changes width. `scrollbar-gutter:
  stable` closes the same hole one level down — a scrollbar appearing would
  narrow the text column under it.
- **ONE magnifier, drawn one way, everywhere.** A door that opens another view
  wears a round dark plate with the amber ring and a lens — nothing else. It
  was a rounded rectangle on the filter and a bare lens on the spike bench's
  probe, so the app's two "there is more of this to see" doors did not look
  like the same kind of thing (user, 2026-08-28). A child learns an affordance
  once or not at all. `drawMagnifier` is the only copy.
- **Tint the compartment the voltage is ABOUT, not the apparatus.** Asked to
  colour the inside of the patch pipette red or blue, the honest answer was
  that a pipette holds neutral salt water: the app's red/blue means charge,
  and the charged compartment in that picture is the CYTOPLASM below the wall.
  It gets the same wash the membrane-charge drawer uses, so stepping the
  voltage recolours the cell and speeds the flicker in one move.
- **A graph about a graph teaches nobody.** The patch clamp had three modes —
  one channel, four with a total, and five thousand summed — and the sum was
  the intended punchline. It went (user, 2026-08-28): a summed trace is an
  abstraction of an abstraction. What is left is one door and one record of
  that door, plus IONS ACTUALLY GOING THROUGH IT, which is what the current
  is. The claim the sum was making survives as a sentence, which is the honest
  form for something nothing on screen draws.
- **Give the instrument the corner and the phenomenon the room.** The trace
  had most of the canvas and the apparatus a narrow column; it is the other
  way round now. The trace is kept, small, explicitly for the adult reading
  along — two audiences, two sizes.
### Two doors onto everything (2026-08-28)

- **Every exhibit needs at least TWO entry points: one in the contents, one
  out on the picture.** A door nobody knows about is a door nobody opens — the
  magnifier on the filter and the probe on the little neuron were both good
  doors and both undiscoverable (user, 2026-08-28).
- **⚠ EVERY HOOK RUNS ON EVERY RENDER, OR NONE OF THEM DO.** Two `useMemo`
  calls were added to `InfoPanel` below `if (target?.presents === 'axon')
  return <AxonInfoPanel />`. Arriving at the axon skipped them, React saw
  fewer hooks than the render before, and the whole tree came down — a WHITE
  PAGE, on that one view (2026-08-28). Neither the typechecker nor the build
  says a word about it and there is no linter here, so it has a test:
  `src/ui/__hooks.test.ts` reads every component's source and fails on a hook
  below an early return. Broke it on purpose and watched it fail. **When you
  add state to a component, put it above every `return`.**
- **THE PAGE'S WIDTH IS A SUM, and it has to be re-added when any term
  changes.** The stage is a fixed 1060 px (1062 with its border), so
  everything else lives in whatever is left. Adding the contents rail without
  taking that width from anywhere put the canvas against the right edge with
  the background cropping behind it (user, 2026-08-28). The row is `w-fit` and
  centred now, and the sum is written beside it in `App.tsx`:
  12 + 40 + 8 + 264 + 8 + 1062 + 20 = 1414.
- **PADDING DOES NOT DEFEND A ROW OF UNSHRINKABLE THINGS.** The first attempt
  was `max-w` plus a right padding, which looks like it guarantees a gap and
  does not: every child in that row is `shrink-0`, so once the viewport drops
  a little under the cap they overflow straight through the padding. A capped
  box with padding is a promise the layout cannot keep; a `w-fit` row that is
  centred is one it can.
- **A string replacement that does not match is a change that did not happen.**
  Two of the three edits in the first attempt at this silently no-opped, and it
  was reported as fixed. Assert on the match, or verify the file afterwards —
  never both write and report from the same unchecked step.
- **An exhibit about existing views must SHOW those views, not new drawings of
  them** (user, 2026-08-28). The three-sizes exhibit hand-composed a membrane
  out of lipids and gates and used the little map for the whole cell — two
  fresh pictures of things the app already draws, which is the fault "one
  biology, one drawing" names. It calls `drawScene` at the real cameras now,
  so the close view IS the axon-membrane zoom and the wide view IS the home
  screen. The camera arithmetic moved into `stage/camera.ts` for the same
  reason: a second caller must not mean a second copy.
- **Draw at the scene's own size and scale with CSS.** A view drawn smaller is
  a different picture; the same picture shown smaller is the same picture.
- **A stand-in that is MISSING a method is not being strict, it is being
  wrong.** `strictCanvas` had no `getTransform`, so the real scene function
  threw on a context a browser is perfectly happy with. It tracks a transform
  now — scale and rotation with care, which is what the scene reads.
- **⚠ A STRING REPLACEMENT THAT DOES NOT MATCH IS A CHANGE THAT DID NOT
  HAPPEN.** Two rounds in a row this session ended with work reported as done
  that had silently no-opped — a page-width fix and an entire exhibit-door
  round, both written with unasserted `.replace()` calls, both verified only
  by re-running the arithmetic rather than by reading the file. Assert on the
  match, then grep the result. Never write and report from the same unchecked
  step.
- **When a bench's lesson is that things DIFFER, give each thing its own
  control.** The gating bench's whole point is that each door answers its own
  cause and is deaf to the others; one shared dial would have thrown that away
  while looking tidier. `respondsTo()` states the deafness and a test pins it,
  because a bench where every lane quietly answered every dial would look fine
  and teach the opposite.
- **Generalise a mechanism before copying it.** The gating families are the
  same two-state door as the patch clamp with a different law setting the
  odds, so `dwellsFor(seed, po, tau, window)` was lifted out and both use it.
  Three families times a private flicker generator would have been three
  things to keep true.
- **APPLY THE CAUSE PHYSICALLY.** A gate is not a switch wired to a button.
  The gating bench's first cut had three dials that set a number and the doors
  answered — true to the model and dead on the page. The causes now ARRIVE and
  DO something: the charge flashes across the wall and the ± marks flare, a
  messenger flies in and lands in the receptor's mouth, a finger presses the
  wall and the bilayer CURVES under it. A child should see the thing that
  opens a door doing the opening (user, 2026-08-28).
- **⚠ A PUSH BENDS A SHEET; IT DOES NOT MOVE IT.** The mechanical panel's first
  cut slid the whole wall down by a fixed offset when the finger pressed —
  which draws a membrane on a lift, and says nothing about why the door opens.
  A pressed membrane **sags**: full depth under the finger, dead flat where it
  meets the undisturbed wall, no crease at the join, and the lipids standing
  square to the slope all the way down (`membraneBend`, and `drawLipids`'
  `waveAt`/`slopeAt`). The cause of a mechanically-gated channel is the
  STRETCH, and the stretch is only visible if the sheet is drawn bending.
  Corollary: **anything sitting on a surface that moves must be read off the
  same function that moved it** — the fingertip, and the ± charges on the two
  faces — or the finger ends up pressing on air (user, 2026-08-30: "visualize
  push with slight membrane curving").
- **⚠ TWO DRAWINGS THAT SHARE A MOTION SHARE THE CODE, NOT THE OUTLINE.** The
  mechanically-gated channel opens exactly as the ligand-gated one does — the
  same 8-unit separation, measured off both drawings independently — but its
  silhouette is its own. The arithmetic went into one `separatingChannel`
  factory and each channel became a set of paths over it. Copying the module
  and swapping the strings would have left two copies of every future fix, and
  the one that drifted would be the one nobody was looking at. The other half
  of the rule matters as much: **do not let the shared code collapse the two
  pictures into one.** Two doors that open alike can still be two different
  doors, and a test asserts the silhouettes are not interchangeable
  (2026-08-30).
- **⚠ WHEN TWO DOORS MUST LOOK DIFFERENT, CHANGE THE EXEMPLAR, NOT THE RULE.**
  The user asked for the ligand- and voltage-gated doors to be told apart by
  colour (2026-08-30) — which collided head-on with the colour rule below,
  their own. Both were sodium, so both were yellow, and the messenger arriving
  to open the ligand one was a sodium ion too: three things on one panel, one
  colour. The fix was not to bend the rule but to notice that **"ligand-gated"
  is a family, not a channel**, and its members pass different ions. The panel
  became a GABA-A receptor, which really does pass chloride, so it is green
  *because of what goes through it*. Four doors, four colours, rule intact.
  Generally: a picture that has to say something new is usually asking for a
  better-chosen subject, not a broken convention. And **an exemplar carries its
  numbers with it** — the Hill figures moved from a nicotinic receptor's to a
  GABA-A receptor's in the same edit, because a swapped exemplar with the old
  constants quotes one channel under another's name.
- **⚠ A CAUSE THAT ACTS ON NOTHING VISIBLE INVITES THE WRONG ANSWER.** The
  voltage panel drew the charge flipping and the flap swinging, and a child
  watching asked what pulls the ball into the hole (user, 2026-08-30). Nothing
  does — the inactivation ball is hydrophobic, and its seat is buried until the
  gate opens — but the picture could not say so, because **the one part the
  charge actually acts on was missing**. Adding the S4 sensor was not
  decoration: without it the flap moved for no reason, and an unexplained
  movement gets explained by whatever else is moving. Three consequences worth
  keeping: draw the part the cause acts ON, not just the cause and the
  consequence; **put a visible pause between the links of a chain**, or two
  steps read as one event; and **draw the absence** — the seat appearing is
  what makes "it had nowhere to go" an observation rather than a caption.
- **⚠ DRAW THE EVENT, NOT A SYMBOL FOR IT — AND CHECK THE APP HASN'T ALREADY
  DRAWN IT.** The voltage panel's cause was a lightning-bolt zig-zag: a *sign
  meaning* electricity, laid on the canvas, where the app already had one way
  of saying "the signal is here" — the yellow bloom the axon views use
  (`SIGNAL_RGB` with its near-white core). Two private idioms for one idea is
  how a single visual language stops being one. **Before inventing a way to
  show something, search for the way this app already shows it** (user,
  2026-08-30: "display signal as flash, not a flash icon"). A cause that
  arrives from off-frame should also *enter* from off-frame — a bloom centred
  beyond the panel's edge says "this came from somewhere else"; the same light
  generated inside the frame says the button made it.
- **⚠ EVERY PIECE OF ONE PROTEIN WEARS THE PROTEIN'S OUTLINE.** The
  inactivation ball was the only part of the voltage-gated channel drawn
  without the species rim its body carries, and it read as a separate object
  that had drifted up against the pore rather than as something hanging off its
  own tail (2026-08-30).
- **⚠ ONE SILHOUETTE FOR EVERY CHANNEL IS A CLAIM THAT THEY ARE ONE OBJECT.**
  A single lobed drawing stood in for the leak, both voltage-gated doors, the
  ligand-gated receptor and the aquaporin, with colour and a caption to tell
  them apart — which taught that a channel is one thing with different labels,
  the misconception the traced drawings exist to dismantle. Two consequences:
  **an option that can only take one value is an invitation to animate
  something that does not animate** (the aquaporin was drawn permanently
  `open: 0.45` — a door held ajar, when it has no door), and **once the last
  caller leaves a generic drawing, delete it**. Kept "just in case", it is what
  the next caller reaches for, and then there are two visual languages again.
  Its tests go with it: a suite defending a shape nothing renders reads as
  coverage and is worse than none.
- **⚠ A SHARED SILHOUETTE DOES NOT MEAN SHARED PARTS.** Not every voltage-gated
  channel inactivates — the axon's delayed rectifier repolarises the spike by
  *staying* open, and the patch clamp's own model is two-state with no
  inactivation in it at all. Drawing the ball-and-chain on those would put a
  mechanism on screen that the record directly underneath visibly never
  performs. **Check the drawing against the model rendered beside it**, not
  just against the family name (2026-08-30).
- **⚠ WHEN A CONTROL HAS NO CAUSE, IT IS NOT A GATE.** The balance bench's door
  was toggled by hand with nothing arriving to open it, which breaks the app's
  own rule that no button opens a channel directly. What the toggle really
  varies is whether the membrane is **permeable** to that ion — so the honest
  drawing is a leak channel that is *there or not there*, and the wall is cut
  only where something is standing in it. Ask what the control actually
  changes before choosing which protein to draw.
- **⚠ A PART DRAWN STILL, THEN MOVING, LOOKS CAUSED — BY WHATEVER ELSE IS ON
  SCREEN.** The inactivation ball sat motionless and then swung into the pore,
  and a child asked twice what pulled it. Nothing does; but the only cause
  drawn on that panel was the charge, so the charge is what the picture
  appeared to say. The fix is not a label, it is **motion that was there all
  along**: the ball now jostles on its tether from the first frame and goes
  still the moment it binds, so "it was trying the whole time and there was
  nowhere to hold on" is something watched rather than claimed. Generally,
  **when the true answer is "nothing caused this", the absence has to be
  animated** — stillness reads as waiting for a cause (2026-08-30).
- **⚠ PAUSES ARE MEASURED IN MILLISECONDS, NOT IN FRACTIONS OF A RUN.** A chain
  of five events needs a real gap between each cause and its consequence, and a
  gap defined as a fraction stops being visible the moment the run is
  retimed — which is how these gaps vanished twice. The corollary: **a cause
  and its own arrival share ONE ramp.** The flash IS the depolarisation
  arriving; a pause between them would invent a delay that does not exist.
  Pause between links, never inside one.
- **⚠ WHEN THE TEMPLATE FIGHTS THE MEANING, REPLACE THE SENTENCE.** "Opens
  when …" produced "Opens when never — it has no gate, so it is always open",
  which has to be unpicked backwards before it says anything. A phrase written
  to slot into a template is not the same as a phrase that reads; give the odd
  one out its own whole line rather than contorting it to fit.
- **⚠ SIZE MEANS SOMETHING ONLY WHERE SIZE IS THE SUBJECT.** Ion keys are
  drawn all the same size on purpose — they are specimens, and one bigger key
  would say one species mattered more. The selectivity filter is the exception,
  because its entire answer is that a BARE sodium ion is smaller than a bare
  potassium ion and still cannot get through; a button that drew them the same
  size contradicted the picture it opened. Note which radius: bare and hydrated
  give OPPOSITE orders, and muddling them inverts the lesson (2026-08-30).
- **⚠ A CONVENTION CAN BE RIGHT AND STILL INVISIBLE — CHECK THE STRENGTH, NOT
  JUST THE HUE.** The patch clamp was accused of not colouring a positive
  inside red. It always had: the ramp is red-for-positive everywhere in the
  app. But its alpha is proportional to distance from zero, and that view's
  steps are −72, 0 and +40 mV — so the blue came out two-thirds louder than the
  red and the red read as nothing. **Turn the whole ramp up; never flatten the
  proportion**, because the difference in strength is itself true. When someone
  says a colour rule "isn't working", check whether it is absent or merely
  quiet (2026-08-30).
- **⚠ ANATOMICAL LAYERING LOSES TO LEGIBILITY ON THE PART THE EXHIBIT IS
  ABOUT.** The voltage-gated flap was painted under the body, which is where it
  sits — and the protein's dark middle then covered its end, so shut, the door
  appeared to stop halfway and vanish. The tidier z-order hid the one thing the
  panel exists to show (2026-08-30).
- **⚠ DRAW THE THING, NOT AN ANNOTATION OF THE THING.** The ball's landing site
  was a yellow dashed ring *around* where the socket is; it is now a dark
  recess that opens in the mouth, which IS the socket. The test for the
  difference: an annotation is something you would have to explain in a key, and
  the canvas carries no explanation. Corollary from the same round — **when a
  mechanism already speaks, delete the outline that repeats it**: the extra ring
  drawn as the ball seated said in outline what the ball says by going still.
- **⚠ ANYTHING LAID ABOVE A ROW OF DRAWINGS MUST BE A FIXED SIZE, OR IT IS NOT
  A ROW.** Shortening one panel's caption lifted its whole picture: the four
  membranes stopped agreeing because the only variable-height thing above them
  had changed. **Size such a block for the WORST case, not today's text** — the
  panels narrow as the window does, and a height that fits exactly the longest
  current sentence clips it on a smaller screen, trading a moving drawing for a
  truncated caption. Related, and already learned once: *anything added above a
  canvas must be subtracted from its height* (2026-08-30).
- **⚠ MOUNT ORDER IS Z-ORDER AMONG EQUALS.** Every drawer in this app is
  `fixed z-50`, so the one written later in `App.tsx` paints on top. That makes
  the list an ordering rather than a bag: **a drawer reachable FROM another must
  be mounted after it**, or it opens behind the drawer that opened it and reads
  as a dead button — with nothing in the code to explain why. The chain is
  written down where the mounting happens (2026-08-30).
- **⚠ A MAGNIFIER NAMES WHAT IS BEHIND IT, SO IT GOES ON THE ONE THING IT SHOWS.**
  The structure exhibit takes apart a single fixed channel; putting a magnifier
  on all four gating panels would have been three claims that were not true.
  It goes on the panel whose door that exhibit actually is. The corollary is the
  useful half: when a view needs a second, discovery-side entry point, the place
  to find it is wherever the app already draws the same object.
- **⚠ FIT A DRAWING BY THE DIMENSION THAT IS TRUE OF ALL OF THEM, AND LET THE
  LAYOUT FOLLOW.** Fitting the scene's channels to one shared width was tried
  and measured first: the ligand-gated one is much narrower for its height than
  the leak, so a common width made it stand 61% taller than its neighbours — a
  protein sticking out of a membrane because of an arithmetic convenience. What
  is true of all of them is that they **straddle the same wall**, so they are
  fitted by height, and the membrane gap asks the drawing how wide it came out.
  The general form: when a drawing and a layout number disagree about a size,
  **the drawing wins and the number is derived from it** — a layout figure and a
  picture that are two different widths is a hole or an overlap, every time
  (2026-08-30).
- **⚠ AN EMPTY WALL DOES NOT READ AS "NOT PERMEABLE"; IT READS AS BROKEN.** The
  equilibrium bench drew its channel only while the door was open, which is
  true to the physics — the variable really is permeability — and wrong on the
  screen: a chamber with nothing in its wall looks like one that has lost its
  channel. **Absence is not a legible state for a thing that was there a moment
  ago.** Let the object stay and change what it DOES (2026-08-30).
- **⚠ A MENU NAMES PLACES, NOT GESTURES — SO TWO ROWS WITH ONE DESTINATION ARE
  ONE ROW.** 'Axonal conduction' and 'Myelin & saltatory conduction' differed
  only in that one started the race on arrival. The same fault as "Change one
  thing" before them, and the same fix: merge, and keep the arrival that asks
  the question best.
- **⚠ A DIFFERENCE OF KIND CANNOT BE CARRIED BY A DIFFERENCE OF SHADE.** The
  gating bench's neurotransmitter was given a spare orange belonging to no
  species, meaning "not one of the four" — and was read as the chloride the
  channel passes. A single glossy ball IS what this app means by "ion", whatever
  colour it is painted, so a new colour just made a fifth ion. It is drawn from
  bonded ATOMS now, in the element colours the water molecules use. **When two
  things are different KINDS of thing, change the grammar, not the palette**
  (2026-08-30).
- **⚠ BEFORE BUILDING A VIEW, ASK WHICH EXISTING ONE IT WOULD DUPLICATE.** A
  proposal for a resting-potential exhibit — bare membrane, ion soup, charge
  gathering at the faces — was, once corrected, exactly the capacitor bench the
  app already had. The useful question is not "is this a good picture" but
  "**what does the app not yet answer**". Here: ⚖️ had one ion's equilibrium and
  ⚡ had the charge at the faces, and nothing showed the resting potential as a
  weighted compromise between two ions. That gap was the exhibit.
- **⚠ A BUTTON CHANGES THE WALL, NEVER THE READING.** The resting bench's three
  settings add or remove DOORS; the voltage is then read off the doors through
  the same equation the spike uses. Offered as "set it to hyperpolarised /
  resting / depolarised" it would have been a remote control for a number, which
  this app has ruled out twice before — and here it is also the whole lesson,
  because the doors ARE the answer.
- **⚠ A PAUSE IS ONLY HONEST WHERE SOMETHING IS BEING WAITED FOR.** Three
  gated doors shared one opening clock, and its deliberate pause — built so the
  voltage-gated chain would read as a chain — made the stretch-gated door look
  as though the finger had missed. That door waits for nothing: the sheet
  bending IS the opening. **Timing is part of the mechanism, so it cannot be
  shared between mechanisms that differ** (2026-08-30).
- **⚠ A NUMBER ON THE BOARD WITH NOTHING TO EXPLAIN IT IS A NUMBER FROM
  NOWHERE.** Chloride held 29% of the resting vote with no mark on the scale
  and no door in the wall. The fix was not a caption: its Nernst voltage went on
  the scale, and the exhibit was arranged so the child can make chloride the
  LOUDEST voice by removing its competition. **Let them cause the thing you want
  them to notice** — that is the difference between an explanation and an
  exhibit (2026-08-30).
- **⚠ RELATIVE WORDS NEED THEIR ANCHOR PRINTED WITH THEM.** "Hyperpolarised"
  and "depolarised" are defined against a cell's own resting potential and
  describe a cell moved off it. A membrane the child has BUILT with different
  doors is not a depolarised neuron — it is a different membrane resting
  somewhere else. The words stay (they are the right words, and the ones a
  lecture uses) but every reading says what it is compared with, and the thing
  it is compared with is drawn on the scale (2026-08-30).
- **⚠ A PRESET DOES THE INTERESTING PART ON THE CHILD'S BEHALF.** The resting
  bench began with three buttons that set up known-interesting walls, and they
  went: where the *making* is the lesson, a button that makes it for you is the
  lesson removed. Keep the reset — every transport that can reach an end needs
  a control that says start over — and nothing else.
- **⚠ A DRAWING AUTHORED IN PIXELS CANNOT BE SHRUNK INTO A WORLD — IT HAS TO BE
  SCALED INTO ONE.** The traced proteins carry pixel-sized floors so nothing
  vanishes at bench size: line widths near 1.1, a charge badge at
  `Math.max(2.4, …)`. The neuron scene's whole membrane is **0.022 world units**
  across, so a world-sized reach turned every one of those floors into the
  biggest thing on the canvas — the ink reached 60× the membrane and the view
  went to a flat wash (2026-08-30). Draw such a picture at its own size inside a
  context scaled by one factor, the way a magnified frame is drawn.
  **A minimum expressed in absolute units is a unit dependency in disguise**;
  it is the first thing to check whenever a drawing moves between two spaces.
- **⚠ A TEST THAT DOES NOT GO THROUGH THE CALL SITE DOES NOT GUARD THE CALL
  SITE.** Two regression tests for the above were written and both were worse
  than none. One called the traced drawing directly and **passed with the bug
  restored** — the fault was in what the caller handed it, not in the drawing.
  One bounded *everything* the scene drew, and failed identically with and
  without the fix, because at high magnification a full-bleed path legitimately
  maps hundreds of thousands of pixels out. The fix was to give the scene
  exactly ONE way to draw a channel (`drawSceneChannel`) and measure that. When
  a bug lives in an interface, **make the interface a function and test the
  function**; and measure the one thing that must be bounded, not everything on
  the canvas.
- **⚠ NOTHING SPEAKS UNLESS IT IS ASKED TO.** The resting bench said its
  reading aloud whenever the reading changed — which was every door the child
  dropped, so it talked over them at the moment they were looking hardest.
  Voice is a control, not a reaction: **a speaker glyph the child can press,
  next to the word it says**, and never on a state change (2026-08-30).
- **⚠ THE VOICE AND THE PAGE MAY NEED DIFFERENT SPELLINGS.** The synthesiser is
  `en-US` and this app is written in British English; given "depolarised" it
  mangles the vowel, given "depolarized" it says it correctly. `sayAs` hands
  the synthesiser its own spelling and leaves the page alone — **what the child
  hears is the point, so the sound wins over the spelling**.
- **⚠ A QUANTITY IN THE EQUATION NEEDS SOMETHING ON THE BOARD.** Chloride held
  a third of the resting vote with no chloride channel anywhere in the picture.
  It is true — every membrane leaks a little of everything, through doors too
  many to draw — but truth that the picture cannot show is a number from
  nowhere. Two fixes, and both were needed: **draw the invisible part** (the
  paler half of each bar is leak with no door), and **let the child make it
  visible** (a chloride door in the tray, so its share can be earned in front of
  them). (2026-08-30)
- **⚠ A MENU ROW NAMES THE QUESTION, NOT ONE OF ITS ANSWERS.** "Resting membrane
  potential" was the title of a bench that now builds hyperpolarised and
  depolarised walls too. Renamed to the question it asks.
- **⚠ A SHARED SIZE CONSTANT OUTLIVES THE ONE DRAWING IT DESCRIBED.**
  `CHANNEL_HALF = 21` was the half-width of the single generic channel, and
  every bilayer in the app cut its gap to it. When that drawing was replaced by
  four traced proteins of four different widths, the constant did not error — it
  quietly went on cutting holes eight pixels too wide either side, everywhere it
  was still used. **Deleting it with no replacement is the fix**; a view derives
  its gap from the drawing that stands in it, and a test asserts no two of those
  drawings are the same width, so a single number can never fit again
  (2026-08-30).
- **⚠ A CONTROL BELONGS BESIDE THE THING IT ACTS ON.** The resting bench's reset
  was the last survivor of a row under the canvas — a whole strip of height
  spent on one button, marooned from everything it changes. It moved onto the
  canvas next to the reading it undoes.
- **⚠ THE PICTURE IS THE QUANTITY; DO NOT PRINT IT AGAIN.** A share bar's LENGTH
  is its weight in the equation — that is the whole reason it is a bar — so the
  percentage written on top said the same thing a second time, in a form the
  child has to do arithmetic with. Keep the name (a colour needs one), drop the
  number. Same family as: if the canvas already says it, the column must not
  repeat it (2026-08-30).
- **⚠ TWO PICTURES OF ONE QUANTITY IS THE CANVAS REPEATING ITSELF.** The
  resting bench drew each ion's weight in the equation as a bar — and the doors
  in the wall directly above it are that same weight, in the same colours,
  already. The rule against the column repeating the canvas applies just as much
  *within* the canvas. Before adding a second reading of something, check
  whether the first one is already on screen (2026-08-30).
- **⚠ A MEASUREMENT FILTERED IN ONE AXIS MEASURES THE WHOLE OTHER AXIS.** A test
  meant to check where a small object sat filtered path points by x alone — and
  caught the membrane, which runs the full width of the canvas, so it measured
  from the wall down and passed whatever the object did. **Window both axes when
  measuring one thing on a busy canvas**, and prefer an edge (the topmost ink)
  to a span, which any large neighbour will dominate (2026-08-30).
- **⚠ A CAUTIOUS DRAWING CAN BE THE WRONG ONE.** Ions crossed an open channel
  one at a time, which looks like modesty and is not: a single open sodium
  channel carries **7.5 million ions a second**, so a conducting pore never
  holds one ion. Drawing one was three orders of magnitude the wrong way and
  taught that a current is a trickle of individuals. **Check the order of
  magnitude before choosing how much to show** — and when the honest number is
  undrawable, cap it, say so, and let the cap scale with the model so a fast
  channel still visibly outruns a slow one (2026-08-30).
- **⚠ WHEN A DRAWING CHANGES SHAPE, ITS TESTS MAY BE MEASURING THE OLD SHAPE.**
  The throughput test counted 0 → something transitions, which a continuous
  stream never makes; the claim was right and the measurement had quietly
  stopped applying. Throughput is occupancy × speed, so measure both.
- **⚠ KNOW WHAT `strictCanvas` RECORDS BEFORE MEASURING WITH IT.** An `arc` is
  recorded by its CENTRE, not its extent, so "topmost ink" cannot tell a circle
  drawn on a line from one drawn below it — a test built on that failed
  identically in both states. Points are also recorded in DEVICE coordinates,
  so a scene drawn inside a scaled context is in a different space from the
  layout numbers describing it. And a window drawn round one small object will
  catch its neighbours: on this canvas a nine-point speaker glyph outvoted the
  two-point sample it sat beneath. **Probe what is in the window before
  asserting on it** (2026-08-30).
- **⚠ A CONTROL THAT DOES A DIFFERENT KIND OF THING MUST NOT SIT IN THE SAME
  SLOT.** "How it is built" opened another drawer from the place the other three
  gating panels keep the CAUSE that opens their door — the wrong promise, in a
  row of three buttons keeping it. Position is a claim about what a control
  does. It moved onto the canvas as a **magnifier**, which is this app's grammar
  for "there is more to see here"; the slot keeps its height as a spacer,
  because the four canvases must still start at the same y (2026-08-30).
- **⚠ ONE CONTROL, ONE APPEARANCE — AND THE DIFFERENCES GO IN `title`.** The app
  had grown five resets, each invented where it was needed. A control that does
  the same thing in every exhibit has to look and read the same in every
  exhibit, or the child learns each one separately. The face says "↺ Reset"
  everywhere and the sentence explaining what "back" means here belongs in the
  hover. **Guarded structurally**, because the failure is somebody writing a
  sixth: the glyph may appear in exactly one file, and describers interpolate
  the label (2026-08-30).
- **⚠ COPYING A DRAWING'S NUMBERS IS NOT COPYING ITS LOOK, IF THE TWO ARE AT
  DIFFERENT SCALES.** The permeability tray's `roundRect(…, 6)` and
  `lineWidth = 1` are drawn inside a ×4 context, so on screen they are 24 px and
  4 px — and a 24 px radius on a 26 px box is clamped by canvas to half the
  height, making a pill with a thick rim. Copied literally into a bench that
  works in CSS pixels they gave a gently-rounded rectangle with a hairline, and
  the buckets were reported wrong twice. **Compare what is SEEN**, scale applied
  — and note that canvas silently clamps a corner radius to half the shorter
  side, so a radius can mean "pill" in one context and "slightly rounded" in
  another (2026-08-30).
- **⚠ A TEST ON SIZE IS NOT A TEST ON APPEARANCE.** The guard for those buckets
  compared width and height, and passed both times they looked wrong. If the
  complaint is "it looks different", the test has to pin the things that make it
  look different — radius, stroke, fill — not the bounding box.
- **⚠ A HANDFUL OF EVENLY SPACED BALLS IS A QUEUE, NOT A CURRENT — AT ANY
  COUNT.** Three rounds were spent tuning how many ions crossed a channel, and
  none of them fixed the complaint, because the fault was the DRAWING and not
  the number: evenly spaced identical balls read as countable individuals. What
  reads as a current is what the patch clamp had been doing all along — a dense
  stream that fans out and fades as it leaves the pore. **When tuning a
  parameter three times does not fix a look, the parameter is not the problem**
  (2026-08-30).
- **⚠ FIND THE FUNCTION THAT DRAWS THE USER'S SCREEN BEFORE CHANGING ANYTHING.**
  Three consecutive rounds of work on the ion current went into the axon lens's
  `drawTraffic` — and `drawRibbon` only runs at the `axon-signal` camera, while
  the action-potential row goes to `axon-membrane`, drawn by `drawScene`. None
  of it was ever on the screen being reported, and every test written for it was
  green the whole time.
  **"Test through the call site" does not save you here** — that rule was
  already written down and was followed; the call site was simply in the wrong
  file. The question that comes first is **"what route does the user take to
  this picture, and which function is at the end of it?"** Trace it from the
  menu row or the zoom target to the draw call, and confirm it before editing.
  A second symptom the user reports — here, "a short flash after the balls" —
  is usually the fastest way to identify the real drawing (2026-08-30).
- **⚠ TINT ONCE. TWO MIXES IN SERIES WASH A COLOUR OUT.** The neuron scene
  muted a channel toward its ion by 0.38 and the traced drawing muted it again
  by 0.55 — because tinting a protein with what it passes is the DRAWING's job,
  and the caller had done it too. Potassium came out `#9d8b88`, a brownish grey,
  where the bench shows `#a18bb9`. **A caller hands over the pure thing and lets
  the drawing do its own single mix**; when two layers each "soften" a colour,
  the result is neither of their intentions (2026-08-30).
- **⚠ THE SAME PROTEIN MUST LOOK THE SAME IN EVERY VIEW, AND THAT IS TESTABLE
  NOW.** `strictCanvas` records every colour painted (`styles`). The guard for
  the above compares the scene's OUTPUT with the bench's rather than their
  inputs — which is the only comparison that catches a wash applied on the way
  in.
- **⚠ A FLASH MARKS AN EVENT THAT IS NOT OTHERWISE VISIBLE.** The gate ring
  fired both when a door opened and when it shut. Shutting is already visible
  twice over — the flap swings back, the current stops — so the flash there was
  a bright interruption over the very thing worth watching. Ask what else on
  screen already says it before adding an emphasis (2026-08-30).
- **⚠ A RULE'S REASON IS NARROWER THAN A RULE ENFORCED STRUCTURALLY.** "A carried
  ion has no sideways component" was guarded by forbidding the field to exist —
  but the reason given for it is that a PORE is barely wider than one ion, which
  says nothing about an ion out in the crowd. When a rule blocks something its
  own stated reason permits, **test the reason, not the shape of the data**.
- **⚠ A FLASH MUST BE BRIEFER THAN THE STATE IT ANNOUNCES.** The gate ring was
  already fixed to fire on opening only — and still read as belonging to the
  CLOSING, because the sodium door is open for 0.053 of a run and the flash
  lasted 0.05 of it. An event marker that outlasts its event becomes a highlight
  on the state instead. **Measure the window against the briefest thing it has
  to mark**, and check where it is still lit rather than only where it starts
  (2026-08-30).
- **⚠ A TEST'S MAGIC OFFSET ROTS WHEN THE CONSTANT IT WAS CHOSEN FOR MOVES.**
  Two tests probed the flash at +0.02 and +0.03, fine for a window of 0.05 and
  meaningless at 0.018 — they failed for a reason unrelated to what they check.
  Where a test needs a point "inside the window", **derive it from the window**.
- **⚠ A MENU NAMES THE THING, NOT A DESCRIPTION OF IT.** "How far a signal
  reaches" sat among *Equilibrium potential*, *Patch clamp recording* and
  *Membrane charge & capacitance*. A list that mixes named concepts with
  descriptions of them teaches that some of these have names and some do not —
  and the child is being given the vocabulary on purpose (2026-08-30).
- **⚠ A COMPARISON BEHIND A TOGGLE IS A COMPARISON YOU HAVE TO REMEMBER.** D05's
  myelin switch was replaced by two pipes drawn at once, bare above and wrapped
  below, sharing the same holes. When the whole point of an exhibit is *what
  changes between two cases*, put both cases on screen; a switch makes the child
  hold one of them in their head (2026-08-30).
- **⚠ REUSE THE DRAWING, NOT JUST THE IDEA — AND MAKE IT TAKE A FUNCTION.**
  D05 was first drawn as its own straight tube and read as schematic beside the
  axon views' wobbling, rounded, playful one. It now calls `drawTube` itself.
  What made that possible is that `drawTube` takes a HEAT function rather than
  owning its own data: the race feeds it a spike's voltage, D05 feeds it a
  decay. **A drawing parameterised by what to colour with is reusable; one that
  fetches its own is not.**
- **⚠ `elapsed ÷ current_period` REWRITES HISTORY.** An animation's phase was
  `ms / period`, i.e. `ms × rate` — which assumes the rate has always been what
  it is now. Every time the rate moved, the whole accumulated phase moved with
  it, and the error grew with the clock: at a two-minute clock a **0.1 mV**
  change in driving force jumped every ion a third of the way down the pore in
  one frame. The honest phase is ∫rate·dt, and a pure function of (state, clock)
  has no history to integrate — so **put the rate somewhere that needs no
  memory**. Here that is DENSITY: current is density × speed, and a fixed
  journey time with a varying count says the same thing without a clock that
  lies (2026-08-30).
- **⚠ A RATE OF ZERO MUST EMPTY, NOT FREEZE.** The same model sent the period to
  infinity as the driving force vanished, leaving ions stranded mid-pore for
  ever. A current of zero is an empty pore, not a stopped one — check what a
  model draws at the limit, not only in the middle of its range.
- **⚠ ONE NUMBER, OWNED BY ONE PLACE, BEATS ANY TEST OF AGREEMENT.** The
  passive-spread bench drew its doors three times the size the axon views draw
  theirs. The fix that lasts is not a test that the two agree — it is that there
  is only one of the number, exported from whichever view owns it. **Then the
  disagreement is unrepresentable**, and the only thing left to guard is
  somebody declaring a second constant, which is a structural check
  (2026-08-30).
- **⚠ A BOUND DERIVED FROM THE THING UNDER TEST IS NOT A BOUND.** The first
  guard for that size bounded the drawn ink by `DOOR_HALF_HEIGHT × 2.4` — so
  tripling `DOOR_HALF_HEIGHT` tripled the bound and the guard passed. Compare
  against a number the change cannot move.
- **⚠ WHEN SPLITTING A FILE PROGRAMMATICALLY, NAME ALL THREE PARTS.** A slice
  written as `head + new + middle` — with the tail silently dropped — deleted
  494 lines of a working module. It was recoverable only because the file was
  tracked. The safe shape is `head + new + tail`, every part named and the
  result's length checked; and **`tsc` immediately after any structural edit**
  is what turns a silent amputation into a ten-second one (2026-08-30).
- **⚠ AN AFFORDANCE IS A CLAIM THAT THE STATE EXISTS.** D05 let a child build a
  fibre with no leak channels — and the model underneath never had one: a wall
  with no holes drawn still carried the membrane's own finite resistance, which
  IS the leak. A control that offers an impossible state teaches that it is
  possible, however carefully the words hedge. **Check what the extremes of a
  control mean in the model before shipping the control** (2026-08-30).
- **⚠ "UNDER" IS A DRAW ORDER, NOT AN OPACITY.** Channels meant to be beneath a
  myelin sleeve were drawn AFTER it at 28% — on top of the sheath — and read as
  ghosts hovering over it, which is exactly what they were. Painting them first
  and letting the sleeve occlude them gives real covering: no alpha trick,
  nothing floating, and the anatomy intact. **When something should be behind
  something else, put it behind it** (2026-08-31).
- **⚠ INSULATION COVERS; IT DOES NOT DELETE.** Myelin was drawn as though it
  removed channels. It does not — it wraps over the membrane and leaves the
  nodes bare, and the covered channels are still there. Drawing them faintly
  under the sleeve says that; drawing nothing says a sleeve is a different
  membrane. A related truth worth keeping: **a node leaks HARDER than a bare
  fibre's hole at the same distance**, because more signal survives to reach it.
  Myelin wins by covering most of them, not by making each leak less — and a
  test that assumed otherwise had to be corrected.
- **⚠ MEASURE THE PAYOFF WHERE THE PAYOFF IS.** Two attempts to test "the
  wrapped fibre loses less" summed spark brightness, which measures what is
  LEFT rather than what has leaked, and reported the opposite. The honest
  measure was how much ARRIVES at the far end.
- **⚠ A TOLERANCE DRIFTS AWAY FROM THE DRAWING IT IS ABOUT.** "Is this hole
  near a node" used a tolerance of 0.056 of the fibre while the gap the sheath
  actually cuts is 0.0156 — so four holes counted as exposed and, measured, not
  one was inside a gap. **Derive the two from each other instead of comparing
  them**: a node IS one of the holes, and the sleeves are cut around them, so a
  gap cannot miss a hole it was cut around. Where a "near enough" test exists,
  ask what number the DRAWING uses (2026-08-31).
- **⚠ A CONSTANT COMPUTED FROM THIS WINDOW CANNOT BE ASKED ABOUT ANY OTHER
  ONE.** A canvas sized to fill its drawer pushed the only control out of an
  `overflow-hidden` grid. Two guards passed with the bug in place, because at
  the developer's window height the too-tall canvas happened to fit. **Make a
  layout decision a function of the viewport and test it across a range** —
  600 px to 1600 px catches what one measurement never will (2026-08-31).
- **⚠ A QUANTITY THAT SPANS TWO ORDERS OF MAGNITUDE CANNOT BE DRAWN
  LITERALLY.** Flash brightness followed the surviving voltage, which is right —
  and left the bare fibre invisible past its first hole, because by mid-fibre
  only 1% of the push is left. A power stretches the range onto the screen
  **without touching the order**: every hole is still dimmer than the one
  before. Quote the exponent in the honesty note; an exaggeration the user asked
  for is still an exaggeration to declare (2026-08-31).
- **⚠ BORROW A LAYOUT ONLY WHERE ITS ANCHOR MAKES SENSE.** `raceLayout` builds
  up from the ruler on the canvas floor — right for every axon view, which all
  put their ruler in the same place, and wrong for a bench with no ruler, where
  it left 331 px above the block and 121 below. Reuse the DRAWING and keep the
  placement local when the reason for the original placement does not apply.
- **⚠ SIZE THE CANVAS TO THE PICTURE, NOT TO THE DRAWER.** Filling the available
  height left two 54 px pipes in 250 px of emptiness. A bigger margin and a
  bigger void are not the same thing.
- **⚠ ONE MARK, ONE MEANING — AND "IT IS THE APP'S OWN DRAWING" IS NOT A
  DEFENCE.** Reusing the axon views' node flash for a leak looked like good
  citizenship and was the opposite: that burst is this app's single mark for
  *the signal is here*, and the race uses it to say the signal has been
  REBUILT. On a leak it meant the reverse, and at a node it meant both at once.
  **Before borrowing a mark, ask what it already means**, not just whether it
  exists. The right reuse was the ion current from the membrane views — charge
  leaving through a hole is the same event as charge crossing one — and aiming
  it outward says the thing a stationary burst cannot: it is going away
  (2026-08-31).
- **⚠ A BAN ON A SYMBOL IS NOT A BAN ON THE SUBJECT.** The first guard forbade
  the signal's colours anywhere in that file, which outlawed the one honest use:
  the push going in at the left end IS the signal. Forbid the wrong PAIRING, not
  the vocabulary.
- **⚠ FIND WHICH PART OF A MARK CARRIED THE WRONG MEANING.** A leak drawn with
  the axon views' node burst was rejected for "symbolising signal" — and the
  next correction asked for the leak to be visibly made OF the signal. Those
  look contradictory until you separate the mark's parts: the colour was never
  the problem, the STILLNESS was. A bright thing sitting on a wall is the race's
  "rebuilt here"; bright things *moving away* are "draining away". Fix the part
  that lied (2026-08-31).
- **⚠ A CAUSE AND ITS EFFECT MUST BE ONE FACT DRAWN TWICE.** The travelling
  signal and the leaking holes were computed from the same number but looked
  like separate events — different colour, different direction, no visible
  link — so a child could not see why one caused the other. Making the escaping
  bits the same light as the blob they come out of, and letting the blob shrink
  as they go, turns two pictures into one sentence.
- **⚠ AN IDLE MARKER IN THE SIGNAL'S COLOUR IS A LIE ABOUT WHERE THE SIGNAL IS.**
  Each fibre wore a standing glow at its inlet whether or not anything was
  running — the same fault, in the same colour, that had just been removed from
  the leaks one step earlier. If a colour means "here it is", nothing may wear
  it while it is not here. A control or an inlet can be marked by its SHAPE
  (2026-08-31).
- **⚠ A SIGNAL MUST NOT WEAR THE COLOUR OF WHAT IT ACTS ON.** The user asked
  for a yellow flash; sodium is yellow and the door it opens is a sodium door.
  Drawn white-hot at the core and yellow at the rim, which is both what was
  asked for and legible. Same fault, same fix, one panel over: a messenger is
  **not an ion** and must not be painted like one — GABA got orange, a colour
  belonging to no species in this app, and a lumpy outline with no charge badge.
- **⚠ Colour means SPECIES, never category.** The gating bench first gave each
  family its own colour so four doors could be told apart — which broke this
  app's own standing rule that every channel is tinted with the ion it passes,
  and quietly taught that colour means "kind of gate". The reference figure the
  user supplied does exactly what the rule does: its channels are coloured by
  ion, so its two sodium channels SHARE a colour and are told apart by their
  cause. Two doors that pass the same ion look the same; what distinguishes
  them is what opens them, which is the exhibit's point anyway.
- **NOTHING IS FETCHED AT RUNTIME, and a test says so.** This app has to work
  on a laptop with no internet — a kitchen table, a classroom with no wifi. The
  photographs are bundled, Tailwind is compiled in, there are no web fonts.
  `src/__offline.test.ts` fails if a `fetch`, an `XMLHttpRequest` or a
  remotely-loaded `src`/`href` ever appears in the source. The `https://` links
  in `realPhotos.ts` are CREDITS, which a licence requires, and the test tells
  the difference between citing a URL and loading one.
- **Build with a RELATIVE base.** An absolute `/neuro-playground/` tied the
  build to the one path GitHub Pages serves it from; copy `dist/` anywhere else
  and every asset 404s. Relative resolves against `index.html` itself, so one
  build works on a host, in a folder, and behind any local server — which is
  what "run it offline" actually needed.

- **⚠ CORRECTED (2026-08-29): the ball is an INACTIVATION BALL after all.**
  The claim below was made from a figure where a ball hung on a stalk and a
  handover called it a voltage sensor. A traced drawing the user then supplied
  settles it the other way: in its third state the ball has moved INTO THE
  PORE, and a sensor does not plug the channel it senses for. A real
  voltage-gated sodium channel has BOTH — an S4 that feels the field and swings
  the gate, and a tethered ball that plugs the open pore a moment later — and
  the drawing shows the gate and the ball but not the sensor. So neither does
  the app: the cause is drawn as the charge itself flipping, and the missing
  sensor is DECLARED in the honesty note rather than invented into the picture.
  The general lesson: when two sources disagree about what a part is, the one
  that shows the part MOVING wins, because behaviour identifies a part and a
  label does not.
- ~~**THE BALL ON THE STALK IS A VOLTAGE SENSOR, NOT AN INACTIVATION BALL.**~~
  An earlier reading of the reference figure took it for a plug and animated it
  blocking the pore. The handover the user then supplied lists them as two
  separate features — a *gate* (a hook-like intracellular flap) AND a *voltage
  sensor* (a small circular domain on a stalk) — and that is right: it is S4,
  it carries the four positive charges this app already draws on every
  voltage-gated channel, and it MOVES WITH THE FIELD. Held down against a
  negative inside; pushed up when the inside goes positive; and its rising is
  what swings the gate. So the sensor must LEAD the gate, opening and closing:
  a sensor that moved afterwards would be a picture of a consequence, and this
  is the cause. Pinned by a test.
- **A cause that lets go mid-run says the effect needs no cause.** The bound
  messenger stays SEATED for as long as the door is open, and leaves only once
  it has shut behind it — otherwise the picture shows a channel held open by
  nothing.
- **The drawing says where; the caller draws the charge.** `particleStyle`
  imports from `bilayer`, so a channel cannot reach for the app's charge badge
  without an import cycle — and a second copy of the badge would break the
  "charge is drawn one way" rule. `sensorAt()` returns the position and the
  caller puts the badge there.

- **TWO EXHIBITS MUST NOT ANSWER THE SAME QUESTION.** The gating bench grew a
  per-door open-probability bar, and the patch clamp already exists to answer
  "how often". The bar went (user, 2026-08-28): this bench is about MECHANICS —
  signal applied, door opens, holds, shuts, ready again — and the flicker went
  with it. A deterministic open-hold-close is not a simplification here, it is
  the right level: odds are a different lesson with a different exhibit.
- **The thing that closes a door has to be seen closing it.** The inactivation
  ball hung decoratively in the cytoplasm while the gate shut on its own —
  a picture of nothing. It swings up and SEATS IN THE PORE now, and it arrives
  BEFORE the gate is shut, because the plug is what does the shutting.
- **Binding is a PUZZLE, not a hover.** A socket is cut into the channel's
  extracellular mouth and the messenger is the piece that fits it, drawn at the
  socket's own coordinates so it cannot land beside its hole. "Binds" becomes
  something a child watches happen rather than a word.

- **A LEAK CHANNEL IS NOT A GATE WITH THE GATE LEFT OUT.** Drawing both with
  one silhouette made the app say they are the same object with different
  labels. A leak has no gate, no sensor and no binding site, and its shape
  shows it — three subunits shoulder to shoulder, the back one visible between
  the two in front, with a way through that is simply always there.
  (2026-08-29, from a drawing the user supplied.) The rule this refines: ONE
  drawing per THING, not one drawing for a category. Two proteins that differ
  are allowed to look different; the same protein in two views is not.
- **TWO DOORS THAT OPEN DIFFERENTLY ARE WORTH TWO DRAWINGS.** The
  voltage-gated channel opens by a flap swinging and shuts by a ball plugging
  it; the ligand-gated one has neither — its SUBUNITS COME APART. Drawing both
  with one silhouette and one animation would have said they differ only in
  what you press, which is the opposite of the lesson. (2026-08-29, from the
  user's two traced drawings.)
- **⚠ A DRAWING'S TWO END POSITIONS ARE NOT AN ANIMATION.** A source figure
  gives each moving part twice — closed here, open there. Swapping one path for
  the other is a CUT, and a child watching a cut learns that the door changes
  rather than that something moves it (user, 2026-08-29: "do not teleport").
  Make each part ONE piece that travels: measure the two drawn positions,
  work out the motion that connects them, and animate that. The ligand
  channel's flap turned out to be the same shape at 168° and 102°, so it
  rotates through 66°; its ball rides an arc, with the chain REDRAWN each frame
  so it is attached at both ends the whole way — which a swapped pair of
  drawings cannot promise. Both pinned by tests: no step of the journey may be
  a leap, and the arc must bow round the protein rather than through it.
- **A traced outline beats one reasoned out by eye.** Where a silhouette comes
  from somebody's structure drawing, trace it: `svgPath.ts` turns path data
  into canvas calls and THROWS on a command it does not know, because a path
  that quietly loses a curve looks almost right — the worst possible failure
  for a copy. Fit the trace by height so it straddles whatever wall it is put
  in, and let its width be whatever the drawing says rather than something
  chosen; then cut the bilayer's gap to fit the protein rather than assuming
  every protein is the same width.

- **A CHANNEL IS SUBUNITS WITH A GAP, not a bead with a hole drilled in it.**
  The silhouette was one outline with a slot cut in it, and the user judged it
  "not even close" to the reference figure (2026-08-28). They were right, and
  the difference is not cosmetic: a channel really is several separate protein
  subunits standing in a ring, and the gap between them really is the way
  through. Two closed paths, lobed — wide at both mouths, pinched at the waist
  where the greasy middle squeezes them, rounded caps. Opening widens the GAP;
  the subunits never move apart, because the protein does not fly apart.
- **⚠ ONE canvas stand-in, and it must fail where the real thing fails.**
  `axonRibbon.test.ts` carried its own permissive recorder, and it cost exactly
  what the rule says: the moment the channel was redrawn with beziers those
  tests threw on a context a browser is perfectly happy with, while
  `strictCanvas` three files away had supported beziers all along. Deleted; one
  stand-in now.
- **⚠ Never describe a source you have not opened.** An exhibit was built with
  comments saying it followed "the reference figure" when the image had never
  been fetched — the layout was inferred from the filename and from textbook
  figures in general, and written up as though it had been read. Fetch it, or
  say plainly that you are inventing. (2026-08-28; the fetch returned 403 and
  the user supplied the image directly.)
- **Include the CONTROL CASE.** The leak channel has no gate, no button and no
  dial, and it is the reason "gated" means anything: the other three are doors
  with a lock, and this one is a doorway. An exhibit about a distinction needs
  the thing on the other side of it.
- **A poke is a MOMENT, not a setting.** The cause arrives, works and leaves,
  and the picture is a pure function of how long ago it started — so there is
  no per-frame state to go stale and a backgrounded tab cannot leave a door
  stuck open.
- **A row of chips grows into whatever is beside it.** The exhibit shelf reached
  eight chips and ran under the voltage panel at the bottom right of the
  membrane view. Two columns, bottom left, clear of it — and the lesson: a
  control strip that grows with the app needs a shape that grows in the
  direction with room.
- **Fit a scaled canvas by BOTH sides.** The three-sizes exhibit scaled the
  scene to the available width alone and cropped the bottom off. Fit is the
  smaller of the two ratios.

- **A REMOTE CONTROL cannot be an exhibit** (2026-08-28, after three tries at
  the same thing). "One signal, three sizes" was first a guided tour that flew
  the main camera and pressed things on arrival, then a switch on the main
  canvas doing the same driving. Both had one flaw underneath: the thing was a
  remote control for the scene, so it could not be put in a drawer without
  covering what it controlled. The fix was to stop it being a remote control —
  the exhibit DRAWS ITS OWN THREE VIEWS from one clock and never touches the
  scene, and then "a drawer covers the world" simply does not arise, because
  there is nothing behind it that needs seeing.
- **A corridor is the wrong shape for a set of magnifications.** Progress
  strip, back, next and auto-advance, through a patch, an axon and a cell. The
  destinations were right; three sizes of one thing want a knob, not a route.
- **A switch between views of ONE event must not restart it.** Stepping from
  the patch to the axon keeps the clock exactly where it was. A switch that
  reset the run would be quietly saying they are three events, which is the
  opposite of the claim.
- **The three pictures are drawn with the app's own functions** — the same
  lipids, the same gate, the same ribbon, the same little neuron — so it is
  one biology at three magnifications rather than a fourth drawing of it.
- **Before deleting a view, list what it is the ONLY home for.** Asked whether
  the axon view could go, the answer was no: propagation itself, myelin and
  the race, every real photograph in the app, one of the three sizes, and a
  whole lecture of the course. "Is it reachable elsewhere" is the wrong
  question; "what dies with it" is the right one.
- **A SHELF, not markers scattered over the picture** (2026-08-28, after
  trying the other way). The membrane exhibits were briefly pinned to the
  structures they open — bilayer on bare wall, channel on a channel, charge on
  the cytoplasm side — with positions derived from the protein layout so they
  could not drift. Sound reasoning, and it looked wrong: four markers dotted
  over a picture read as clutter ON the picture rather than as a set of things
  you can do WITH it. They are one row in one container at the foot of the
  canvas now.
- **And notice what that dissolved.** Two exhibits had been kept out of the
  canvas because they are not places: a magnifier stuck on the wall for
  "equilibrium potential" would point at nothing. That argument was entirely
  about being PINNED. A shelf in a corner points at nothing by design — it is
  a set of instruments, not a set of labels — so the split stopped doing any
  work and all six went back together. **When a design changes, re-derive the
  exceptions instead of inheriting them.**
- **A chip in a shelf still carries a word.** Six abreast means short labels,
  not no labels: icons rank, they do not name. The full name lives in `title`
  and in the contents, and both come from the one exhibit registry so a door
  and its drawer cannot come to disagree about what it is called.
- **⚠ The contents does NOT repeal "spatial navigation, not pages".** It looks
  exactly like the thing that rule forbids, so it is built not to be: picking
  an entry **flies the camera to the place first** and opens the exhibit when
  it lands. The menu is an index INTO the world, not a way around it, and
  every route still teaches where on a neuron the thing happens. If a drawer
  ever opened before the camera moved, the menu would have become a page
  switcher — a test pins the order.
- **A menu names PLACES, not gestures.** "Change one thing" had a row whose
  destination was character for character the resting-potential row's; it was
  removed. It is not a view, it is what you do once you are at a patch. The
  no-duplicate-destinations test is what caught it.
- **The contents lists what EXISTS.** A menu of greyed-out promises teaches
  that the app is mostly empty, and it would be a second place where a claim
  about what the app contains could rot. Unbuilt Parts carry one line that
  interpolates `FRONTIER_SHORT` — the FRONTIER rule, applied to navigation.
- **The structure is the lecture course, ENRICHED.** Several things this app
  teaches are not lecture headings (the whole cell as a place, the guided
  signal trace); they are folded into the Part they belong to and flagged
  `extra`, rather than left out because a syllabus did not name them.

- **A FAN must not light as a unit either.** The miniature lit every
  synapse-bearing dendrite whenever anything fired, so choosing one input
  flashed all three branches (user, 2026-08-28). This is the axon rule one
  structure earlier, and it fails twice over: it says every input arrives
  whenever any input arrives, AND it contradicts the control the child just
  used — they were offered a choice and the picture ignored it. `litTrunks()`
  is the one function both the canvas and the miniature read, so they cannot
  disagree about which branch was chosen. Null means "no run to ask about",
  and then the whole fan is the honest answer.
- **The place being MEASURED must be among the places that light.** The
  spike-train bench drew its electrode at the zoom target's own point and its
  glow at `regionPoints(region)` — two sets computed independently that never
  met. On the dendrites the clamp sits on trunk 1 at t = 0.3 and the lit set
  was trunks 2, 3 and 4 at t = 0.45, so the cell lit up everywhere except the
  one spot the child was watching: the spot the current goes into and the spot
  the trace beside it is a recording OF. A picture that lights everywhere but
  the point of measurement says the measurement is happening somewhere else.
  `litPoints()` now derives one set from the other, so they cannot drift.
  (User, 2026-08-28.) The general rule: **when two things must refer to the
  same place, one of them has to be computed FROM the other.**
- **Count the parts against the textbook, and name each one out loud.** The
  channel's cross-section was drawn with two helices a side where the standard
  figure shows three — and the two that were there were both mislabelled (the
  outer called the voltage sensor, which belongs to another domain; the inner
  called the pore helix, which it is not). The genuinely missing piece, the
  short PORE HELIX that never crosses the membrane, is not a detail: its far
  end points at the middle of the pore and is slightly negative, and that is
  what makes the middle of a greasy wall habitable for a cation. A part left
  out of a drawing is a mechanism left out of the lesson. Caught by the user
  against a textbook, 2026-08-28.
- **Widen the drawing rather than crowd it.** Three helices a side needed
  room, and the honest fix was the wider protein — 3.7 nm half-width, closer
  to a real Kv channel anyway — not thinner ribbons.
- **Do not draw a space that is too small to be a space.** The side view had
  a dark cavity between the helices. Flat, it read as a black shape painted on
  the protein; shaded like a recess, it read as a wide open mouth — and either
  way it invited the question this whole drawer exists to kill: if there is a
  hole that size, why is the channel picky? A channel is a packed mass of
  protein with a thread of water down the middle, far too narrow to draw as a
  space at this magnification. So it is not drawn as one. What marks the way
  through is what actually marks it: the filter's atoms and the ion moving
  between them. (Removed at the user's instruction, 2026-08-28, after an
  attempt to make it look more hole-like made it worse.)
- **Teach the mechanism with something the child has DONE.** The filter's
  concerted exchange — never let go of one thing until you have hold of the
  next — is monkey bars. The energy balance is a price: you only make the swap
  if it comes out even. Both went into the describer after the user asked for
  the explanation in a kid's terms; the analogy has to carry the actual
  mechanism, not just soften the vocabulary.
- **A canvas gradient is resolved in USER SPACE at fill time, not where it
  was created.** Build it inside the transform it will be filled in, or it
  lands somewhere else entirely. This cost three rounds of "the aura is not
  purple": the gradient was made around the body's centre and the context was
  THEN translated to that centre, throwing the origin twice as far out, so the
  shape was painted from the transparent tail and the colour was never drawn
  at all. Every attempt to fix it changed the hue, which was never the
  problem. `paintChannelBody` is now one function, used by both views, and a
  test asserts the call order `save, translate, scale, createRadialGradient`.
  **When two or three attempts at a visual fix change nothing, stop changing
  the value and check the thing is being drawn.**
- **When a count becomes absolute, a shared index space becomes a lie.** The
  equilibrium chambers numbered their balls once — index `i` was outside if
  `i < outsideBalls`, inside otherwise — which was coherent while the set was
  a fixed sixty split by ratio. The moment one ball became a fixed AMOUNT,
  adding ions to the outside raised `outsideBalls` and re-labelled which balls
  were inside: two that had been in the cytoplasm jumped out through the wall
  and two appeared inside from nowhere, for a change made to the outside only.
  Each side has its own ranks now. **A change to one compartment must not move
  anything in the other.**
- **Infer an EVENT from what conserves, not from what changed.** The same
  bench animated a ball swimming through the channel whenever `outsideBalls`
  changed — sound while the total was fixed, and wrong the moment the child
  could add ions, because then the app was drawing transport that had not
  happened. A transfer conserves the total; if the total moved, the child
  moved it and nothing crossed.
- **A quantity drawn as a COUNT must have a fixed value per item.** The
  equilibrium bench drew sixty balls always, split by ratio, so a chamber with
  a trace in it looked exactly as full as one at 150 mM — "all of it outside"
  is the same ratio either way (user bug report, 2026-08-28). Worse, a ball
  was worth a different amount at every setting, so the four chambers could
  not be compared with each other. One ball is now a fixed 5 mM. Anything
  present still gets at least one ball, because rounding a trace to nothing
  would say the chamber is empty when it is not.
- **Never put the difference in the MACHINE when it belongs to the thing
  going through it** (2026-08-28, the deepest error in D15's first cut). The
  filter's oxygens were animated to reach further for potassium than for
  sodium, which is a picture of a protein that can tell the two apart and
  decide. It cannot. It does exactly the same thing to both, and one of them
  fills the space it makes. Same cage, same closing, same everything — the ion
  is the only variable, and the leftover daylight is the mechanism.
- **If the point of a view is a distance, DERIVE the scale from that distance.**
  D15's first scale was picked by eye at 78 px/nm, and the gap the whole
  exhibit exists to show came out three pixels wide. The scale is now the
  largest that still fits the view, applied to heights and widths alike, and
  the test pins the OUTCOME (the gap is over 8 px) rather than the constant.
  A close-up that is not close enough to show its subject is not a close-up.
- **Ask the geometry where a pose should land.** The working leg ended at a
  made-up `t = 0.32`, which on the real rung spacing put the ion halfway
  between two sites, gripped by nothing. `siteT(i)` computes it.
- **A KEY wears its charge whatever its size; the crowd does not.** The size
  guard that silences an unreadable badge on a four-pixel ion silenced it on
  the TRAY SPECIMEN too, because the tray is drawn at crowd size — and then
  nothing anywhere in the permeability bench said sodium was positive
  (regression, 2026-08-28). The guard is about legibility in a crowd; a key
  exists precisely to say the thing the crowd is too small to say. `isKey` on
  `drawTraveller`, pinned by a test.
- **When a magnification hides the schematic shape, put the shape back.**
  Blown up to atoms, the lipid's head is a crowd of spheres and the circle the
  child knows has vanished into it. A soft disc in the head's own colour sits
  behind exactly the atoms the circle stands for — derived as the smallest
  circle holding them, never a typed-in radius. Soft-edged and in the head's
  colour ON PURPOSE: a crisp ring of some substance round a head would be read
  as the water coat this app has just taught. It is not a substance; it is the
  schematic laid over the thing it is a schematic of.
- **The dashed frames and their connectors ARE the caption.** "How the app
  draws it" under the inset was the canvas explaining itself, which is the one
  thing the canvas does not do.
- **A floating control needs a plate, not a frame.** An amber box around a row
  of amber buttons is a container saying what the buttons already say. Give
  each button its own readable plate over the drawing and drop the box.
- **Two pictures of one object share the colour AND the opacity profile**
  (2026-08-28, after three rounds on one aura). The side and top views of the
  channel carried the same violet and still did not match: the side body faded
  a third of the way out, the top held to two thirds, so one read plum and the
  other read washed — and the fix that kept getting reached for was a
  different HUE, which was the wrong dial. Match the falloff before touching
  the colour. And an object does not change colour when you walk round it:
  one constant, both views.
- **A tint with a provenance beats a tint that is merely legible.** The
  channel's violet is a mix of the app's protein bronze with potassium's own
  blue, because this app tints every channel with the species it passes. A
  purer violet reads more obviously as purple and says less; the user chose
  the derived colour over the obvious one.
- **Density is the dial; opacity is not** (2026-08-28). Asked for fewer lipid
  heads in the top view, the first attempt faded them out with distance — and
  a half-transparent lipid head reads as a lipid head that is somehow not
  quite there. Nothing in this app is partly present. When a field is too
  busy, draw fewer of them at full strength.
- **Measure the container you are actually in.** The channel panels were sized
  from a viewport estimate 56 px more cautious than the drawer's real chrome
  (`h-screen`, `p-5`, the grid's `pt-2`), and left a band of the drawer empty.
  Derive the budget from the chrome that exists, and keep the margin small and
  named.
- **Anything added above a canvas must be SUBTRACTED from its height**
  (2026-08-28). A size key was put over the channel panels and their height
  left alone; both drawings were cut off at the bottom. The guard is the SUM —
  key + panel + chrome ≤ the height the column actually has — not the symptom:
  a "labels are inside the canvas" test passes happily while the whole column
  hangs off the drawer, because a taller canvas has more room for labels. A
  test that cannot fail on the bug is not a guard. `CH_BUDGET` in
  `channelScene.ts` is the pattern.
- **A control that floats over a drawing needs a reserved band, not luck.**
  The exhibit's buttons moved onto the canvas in the ⚡ button's grammar (an
  amber pill overlaying the stage); the drawing is pushed down out from under
  it by a band folded into `WALL_Y`, and a test pins that no name starts above
  the pill. Labels vanishing under a button is not a layout.
- **A field drawn to the frame's edge spends the panel on background.** The
  top view's lipid heads were packed shoulder to shoulder across the whole
  canvas, so the channel — the thing the panel is of — was small and crowded.
  Draw the field sparser and let it thin out with distance from the subject.
- **Symbolise only the charge you are not already drawing** (2026-08-28). The
  membrane-charge exhibit marked both faces with ± strokes. At a positive
  interior the inner face's marks sat exactly where the potassium crowd
  presses against the wall — an abstract plus under a drawn plus — and a child
  read it as a plus being pulled onto a plus. The inner face is now marked
  ONLY while it is negative, because a negative face is made of charge this
  picture never draws; a positive one is the crowd itself, already on screen.
  The outer face keeps its marks at every voltage: its crowd is not drawn at
  all. `skinFaces()` holds the rule and a test pins it.
- **A protein is ONE STRING, not a bundle of sticks** (2026-08-28, the user,
  from the textbook picture). Helices drawn as separate ribbons teach that a
  subunit is a handful of parts. Draw the connecting loops — and draw the one
  that matters: the loop between the fifth and sixth helices dips back into
  the membrane and IS the selectivity filter. The pickiest part of the machine
  is a fold in the chain, and the drawing has to let a finger trace it there.
  Loops go on before the helices so a helix sits in front of its own string.
- **A true difference too small to see needs a KEY, never an exaggeration**
  (2026-08-28). Sodium is drawn smaller than potassium because it is smaller —
  3.4 px against 4.8 — and the charge badge is bigger than either, so the fact
  the exhibit exists to teach was invisible. The fix is not to lie about the
  radii on the stage: it is a to-scale key beside the buttons showing both
  ions, bare and coated, magnified together with the magnification written on
  it. Same rule as the crowd's ion key, one level down. Applies doubly when
  the two things being compared are **never on screen at the same moment** —
  a difference across two separate runs is a difference nobody can see.
- **An account of what happened OUTLIVES the animation that showed it**
  (2026-08-28, the sibling app's "What just happened" rule). A verdict that is
  rendered only while a run is playing vanishes at the exact moment a child
  starts reading it. Write the story when the event starts; keep it until the
  next event overwrites it or a reset clears it. "Right now" may be live —
  a story may not.
- **Conservation applies to everything drawn, not only to ions.** An ion's
  water coat used to be stripped at the filter and vanish; the waters now fall
  back and rejoin the water they came from, fading only once they are far
  enough away to be lost among the rest. If a picture shows something leaving,
  it must show where it went.
- **If the words claim an exchange, the picture must show both halves.** The
  text said the filter pays for the coat; nothing was seen being paid. The
  filter's oxygens now close in and take the water's place as the coat comes
  off — the trade, drawn.
- **A realistic drawing carries the same species tint its schematic does**
  (2026-08-28). This app tints every channel with the ion it passes; when the
  realistic structure was left plain protein-bronze beside its own violet
  schematic, the two pictures stopped obviously being the same object. The
  tint goes on the protein's BODY, with the helices left bronze, so it reads
  as "potassium channel" rather than as "made of potassium" — and the body
  must stay darker than every helix tone, or the coil's shadow side vanishes
  into it.
- **An amber dashed frame claims a MAGNIFICATION, and takes two of them**
  (2026-08-28): the small box, the big box, and connectors between. One frame
  alone says "this is a magnification of" and never finishes the sentence. And
  a panel that is a different VIEW of the same object — not a magnified piece
  of it — gets no amber frame at all, or it claims a relation that does not
  exist.
- **A new visual idea must be built out of something the child already knows,
  and named** (2026-08-28, paid for twice by the same mistake). An ion's
  hydration shell was drawn once as a translucent blob and once as a ring of
  anonymous dots; both times the user asked what it meant. It now uses the
  water molecule they have already fired at a wall in another drawer, inside a
  dashed outline, with a spoken name. Novel decoration refers to nothing.
- **When a picture invites a wrong question, fix the PICTURE, not by adding an
  explanation of a thing that is not happening** (2026-08-28). Helices drawn
  alone left gaps that read as ways through, and the proposed fix was a force
  field making the space look impermeable — but nothing is repelled there;
  there is simply no space. The fix was to draw the protein as the solid mass
  it is. An added aura would have taught a force that does not exist.
- **A name goes on the background, with a line reaching in** (2026-08-28). A
  label placed against the thing it names collides with it, and a reader then
  has to unpick which ink is which. Names sit out at the canvas margins;
  thin leader lines, no arrows, do the pointing.
- **Charge is ONE picture wherever it appears** (`drawChargeDot`): the same
  filled disc with a white glyph that an ion wears, whether it is marking an
  ion, a channel's voltage sensor, or the little negative a pore's oxygens
  turn inward. Bare ± strokes were invisible at small sizes and were a second
  vocabulary for a thing the app had already settled.
- **If a drawing raises a question, the drawing must answer it** (2026-08-28,
  from the user asking why a positive ion is not repelled by a channel marked
  +). The answer was already true and simply not drawn: the sensor charges sit
  in separate parts at the EDGES, nowhere near the passage, and the passage
  itself is lined with oxygens turning a little negative inward — which is
  what pulls a cation in. Both are now visible in both views, and said in the
  words. A picture that provokes a misconception it could have prevented is
  not neutral.
- **Draw the cause the MODEL has, not the cause the story wants** (ruled by
  the user, 2026-08-28). The spike-train bench injects current into one patch,
  the way an electrode does; a first attempt drew dendrites lighting up
  instead, which reads beautifully and depicts synaptic input the model never
  integrates. The picture and the model must not disagree — so the bench draws
  the **electrode**, quietly, and the describer names it as apparatus rather
  than anatomy. A signal still never appears without a cause; the cause is
  just an honest one. The dendrites get their turn when whole-cell summation
  arrives with a model behind them.
- **One scale per view, and everything in it obeys** (2026-08-28). If a view
  draws a membrane at its real thickness, every molecule in that view is drawn
  at its real size too — the comparison between them is the teaching. When
  that makes the smallest object too small to see, **magnify the whole view**
  (which the declared ×N follows automatically); if that is still not enough,
  a whole CLASS may share ONE declared exaggeration — every traveller in the
  permeability bench is drawn ×2, so their sizes relative to each other stay
  true and only their size relative to the wall is stretched. Never give one
  object a private exaggeration to make it comfortable.
- **A molecule is built from atoms, not from an outline** (2026-08-28): real
  van der Waals radii, real bond lengths, one radius per element. Sizes then
  EMERGE and cannot disagree between molecules — the bug being that the same
  carbon was drawn 1.85× bigger in glucose than in CO₂. It also gives the
  drawing facts it can teach with: a rod turns its narrow face to a gap, which
  is what a "kinetic diameter" means.
- **Never draw an opening wide enough to raise a question the exhibit answers
  differently** (2026-08-28). The permeability wall parts for a crosser, but
  the parting is sized by the crosser and stays narrower than glucose, which
  never crosses — a gap that looks glucose-sized asks "so why doesn't that fit
  through?" and teaches sieving, which is precisely the misconception the
  bench exists to kill. Chrome is the one exception,
  and it must say so: the permeability trays show magnified keys, declared in
  the honesty note.
  The bug this came from: the travellers were 3.5–9× oversized and looked
  right only because the lipids were oversized too. **Two wrongs cancelling is
  why nobody saw it** — so check a size against its own ruler, not against its
  neighbour.
- **An ion too small to label gets a KEY, not a smaller label** (2026-08-28).
  Below `ION_LABEL_MIN_PX` (5 screen px of body radius — the charge bench's
  ion, the smallest anyone has judged readable) a badge or a name cannot be
  read, and shrinking one to fit produces a smudge that teaches nothing. The
  view instead shows **one specimen of the species at readable size, wearing
  its badge, in the view's own chrome** (`ui/IonKey`) — the header, beside the
  name, never over the stage, which carries no explanation. The crowd on the
  stage stays at its honest scale. `needsIonKey(radiusPx)` answers whether a
  view owes its reader one; the equilibrium bench, whose ions are ~3 px, is
  the case that produced the rule.
- **A phospholipid is ONE molecule everywhere** (2026-08-28,
  `bilayer.drawLipidAt`): a shaded head facing the water and two tails
  splaying inward, every proportion a fraction of the head's radius, so the
  bench-sized molecule and the scene's honest magnification-derived one are
  recognisably the same creature. **The two leaflets' tails stop just short of
  the midplane** (`MID_SEAM`), leaving a faint seam the oily core shows
  through — checked against the physics: the leaflets do meet, but the
  terminal methyls are the least ordered, lowest-density part of the wall and
  a real bilayer's electron-density profile has a trough exactly there. Not a
  gap anything could pass through, and not a crossing overlap. It replaced three conventions that had grown up separately — a
  dark mark stamped inside the ion (membrane view), a large plus floating well
  above it (permeability bench), and a hollow ring (charge bench, one round
  old). A second drawing of one property is how a visual language stops being
  one; a test pins the badge's place and its glyphs.
- **A drawing helper called from inside a scaled context contains NO absolute
  pixel constant** (2026-08-28, paid for with a solid-red screen): sizes are
  proportional to the thing being drawn, or the caller passes screen-space
  numbers explicitly. A membrane patch's transform reaches ×3100, where a
  "minimum 2 px" stroke is wider than the canvas. Test such helpers at a
  radius of 0.001, not only at comfortable sizes.
- **"Charge aura" means the COMPARTMENT tint**, not a halo on a particle: the
  cytoplasm wears the shared `chargeRamp`/`polarityT` wash, strongest against
  the membrane and fading inward, because the charge a voltage *is* sits in a
  thin skin at the wall. Used by the equilibrium bench and the charge bench.
- **Slate** = membrane. Highlighted membrane is only *slightly* brighter
  (`#b8c4d4`), never near-white: a white highlight swallows the travelling
  signal drawn on top of it.
- Headlines use uppercase, letter-spaced, muted slate
  (`text-xl font-semibold uppercase tracking-wider text-slate-300`).
- Info blocks share one house style: `p-3` container on `bg-slate-800/40`,
  `text-xs` uppercase slate-400 section headers with `border-t` separators,
  `text-sm` icon-led paragraphs.
- Part icons are chosen for **function**, not shape (👂 listen, ➕ add up,
  ⚡ send, 📣 pass on) — structure relates to function (N02).

## Konva rules (learned the hard way)

- **Freeze position props at mount and move nodes imperatively.** Changed x/y
  props are re-applied at commit and cause teleports.
- **Painting and hit detection are separate.** The scene is painted by one
  `Shape` with a `sceneFunc` on the raw 2D context; clicks are handled by
  transparent Konva primitives layered over it. Konva's hit canvas paints with
  an internal colour key, so `fill="rgba(0,0,0,0)"` still registers hits, and
  an explicit numeric `hitStrokeWidth` gives thin lines a usable target.
- Order hit shapes so the more specific one wins (soma over branch roots,
  zoom markers on top).
- Glossy particles use one extended radial gradient — no canvas shadows.
- Stage sizes are viewport-measured once at module load.

## Where words go

Three places, and each has exactly one job. Getting this wrong is the single most
common way a view becomes unreadable while every test still passes.

| place | carries | never carries |
| --- | --- | --- |
| **the canvas** | *names* ("outside the cell", "resting", a protein's short name) and *readings on a scale* (mm, mV, ms, ×140) | a sentence |
| **a button** | a name, an icon, and a one- or two-word *state reading* on the thing it controls ("working", "open now") | a description |
| **the info block** | everything else — what just happened, what it means, what is exaggerated, what is not built yet | — |

### ⚠ Every NAME in the app is drawn by one function (2026-09-04)

User: *"unify labels across the app. Source of truth: vesicle view."* There
were **two** label systems. The vesicle view (D06) drew a name as a dark
rounded plate `rgba(2,6,23,0.72)` with no rim, `11px system-ui` in `#cbd5e1`,
and a leader from the plate's **box centre** to the part it names. The
whole-neuron scene drew its own: `13px ui-sans-serif`, a slate plate, ink
`#64748b` two steps dimmer, no leader at all — so the same word looked like
two different kinds of thing depending on which view you stood in, and nine
bench views sat somewhere between the two.

`spokenLabels.ts` now owns the style — `LABEL_PLATE`, `LABEL_INK`,
`labelFont()`, `drawConnector()` — and every canvas imports it. `drawName` is
`drawSpoken` without the F04 glyph, with `named()` for its hit box (`spoken()`
reserves 18 px for a glyph, and a silent name padded for one sits off-centre
on its own plate).

- **A leader leaves the label's BOX CENTRE**, never its ink edge. Two views
  started theirs at the edge with their own ink, which reads as a second
  gesture on the same canvas.
- **On the whole-neuron scene the leader is drawn AFTER the keep-out nudge.**
  That scene shoves a label sideways when a panel is in the way, so a line
  drawn from the anchor it was queued with misses its own plate by up to a
  plate's width.
- **A leader is only for a name that points at a discrete THING.** Not for an
  extended structure (`dendrites`, `axon`, `axon terminals` — a line to one
  point on a two-hundred-pixel fan reads as "this one branch"), not for a
  half-plane (`outside the cell` has no point to aim at), and never for a
  reading (a line from "−70 mV" to a membrane claims the number is its name).
- ⚠ **Unifying the LOOK of labels is not a decision about VOICE.** Which terms
  speak stays per term, on request (see *User shorthands*). Adopting the
  vesicle view's style wholesale would have handed some forty terms a speaker
  nobody asked for. Ruled by the user, 2026-09-04.

### One 🏷 switch, and it hides names only

Whether names are drawn is a preference about the APP, not about the exhibit
you happen to be standing in: turn them off at the synapse and they stay off
in the channel drawer. `state/labelsStore.ts` holds the one flag; it replaced
two private copies (`snareStore.labelsOn`, `synapseStore.labelsOn`) before a
third could be written.

**The switch never hides a reading on a scale.** A graph without its axis is
not a simpler graph. Names go; `×1,925`, `−70 mV`, `12 ms`, `open`/`shut`,
`threshold`/`total` stay. Guarded in `labelStyle.test.ts` by drawing a scene
twice, with the switch on and off, and requiring the readings to be identical.

**The one reading that speaks** is the resting bench's big state word
(`resting` / `DEPOLARIZED`), which carries a bespoke amber speaker disc. It is
a deliberate exception, kept at the user's decision (2026-09-04): that word
names the membrane's state in a term the child needs said aloud, and it is the
only way the word is ever said. Recorded here so it stops looking like drift.

Reasons, in the order they were learned:

- **A sentence on the canvas is in the one place a child cannot scroll back to**,
  and it competes with the drawing it is talking about. The voltage panel used to
  paint "inside negative, as it always is" under its reading; the number and the
  word `DEPOLARIZED` stayed, the sentence went to `voltageNote`.
- **A description inside a button is a paragraph in a place built for a press.**
  Five were found and moved. Put the sentence in `title=` as well, so hovering and
  screen readers keep it.
- **But a button with no name is the same failure.** Three push buttons were once
  reduced to bare lightning bolts of different sizes, on the argument that a size
  is something a picture says better than a phrase. The ordering did read — but a
  control whose meaning must be inferred is a puzzle, and a child should not have
  to solve the interface before starting on the biology. Icons rank and decorate;
  they do not replace the name.
- **If the canvas already says it, the column must not repeat it.** The parts of
  the neuron are labelled out there and clicking one selects it, so the list of
  parts in the column was a second index to something already indexed — deleted
  entirely, and nothing was lost, because selecting a part still fills the
  describer. Likewise three hint sentences, each explaining an affordance that is
  visible and obvious on the canvas, and a `⚡ Fire an action potential` row that
  duplicated a canvas button.

**Exhibit launchers** are standalone buttons with no group heading and no selected
state, in the sibling app's grammar (`🧪 Periodic table`, `🌡️ States of matter`).
A heading over two items costs a row of the column to say what the two items say,
and a bordered group implies they are alternatives when they are simply two doors.

**Who reads what (2026-08-27).** Kids do not read labels. The words are still
required — but each audience gets its own channel:

- **Icons and the picture carry the meaning for the kid.** Every button gets an
  icon where one exists that genuinely says the thing; a view should be readable
  from its pictures alone, by someone who reads nothing.
- **A view derives from a previous context.** The kid understands where they are
  because of where they just were — the zoom they took, the drawer that slid over
  the scene they were watching — not because a label names it. Never design a
  view that only makes sense if its title is read.
- **Buttons and labels address the adult** — the parent or teacher driving the
  session. Name them properly for a grown-up; do not babytalk a control.
- **An exhibit launcher is named for the scientific concept it demos**, with an
  icon of its own (2026-08-27: "Balance an ion" → "⚖️ Equilibrium potential",
  "Fire it again" → "📈 Spike trains & refractory period", "One molecule, up
  close" → "🫧 Phospholipid bilayer", the tour → "🧭 Signal propagation"). A
  shared 🔬 on every button ranks nothing; a distinct icon is the kid's handle
  on the door.
- **The info block is written to be read ALOUD.** Assume an adult reads it to
  the kid: kid-friendly sentences, real names kept (an adult can pronounce
  "phosphate"; a kid can hear it).
- **A canvas name-label can say itself (F04):** an amber 🔊 glyph before the
  name, tap to hear it. The voice lives ON the label, not in a side list — a
  kid cannot relate a word list to the picture (2026-08-27). Hit boxes are
  pure functions exported beside the drawing, so the pointer handler and the
  paint can never disagree.
- **Relation markers are dashed amber ROUNDED RECTANGLES joined by wide dashed
  lines** — "this small thing is that big thing" (the wall's marked lipid, the
  molecule panel's corner schematic, the frame round the atomic view). The
  dashed amber CIRCLE stays reserved for the camera's "you are here" ring on
  the miniature; two different questions, two shapes (2026-08-27).

## Handing the scene over to a view of its own

Some zoom targets replace the scene rather than magnifying it: the stretch of axon,
the terminal. They are drawn on a second, untransformed layer, and the scene layer's
opacity falls as they come up. Two rules make that read as a flight rather than a
cut.

**Gate on ARRIVAL, in decades, from either side.** `arrivalAt(scale, viewScale)`
returns how far the camera has got, measured as `1 − |log₁₀(scale / viewScale)| /
ARRIVE_DECADES`. Decades because `interpolate` advances scale *geometrically*, so a
fixed number of decades is a fixed portion of any flight in either direction.

> The bug this replaces: the test was `(scale / viewScale − 0.5) / 0.5`, a ramp
> from half a view's magnification up to it. Approaching from below that is right.
> Approaching from **above** it saturates — flying out from ×3100 towards the axon's
> ×14 it read `1.00` for the entire 2292 ms, so the axon view was painted at full
> strength over a camera still at ×2300.

**The scene's opacity must read the same gated number the view does.** It read the
raw intent instead, and faded to nothing in 240 ms while the view replacing it was
still invisible. That gap is what made a zoom-out look like a cross-fade.

**Pan while wide.** Which end of a flight is wide depends on the direction, so
`PAN_PORTION` applies to the *first* portion when diving in and the *last* when
pulling out. Panning early on the way out swept sideways at ×3000 and threw the very
membrane being left behind off the canvas within a few frames. The turn is mirrored
the same way.

**Two shapes on one layer must not clear the canvas.** Konva clears a layer before
drawing its children, so a `clearRect(0, 0, W, H)` in a `sceneFunc` is never doing
anything useful — and the moment a second view moves onto that layer it erases
whatever its sibling just drew. This is what made the synapse view invisible while
its model and its drawing were both correct.

## Level of detail must dissolve, never switch

`scale >= BILAYER_SCALE` was a hard switch: molecular lipids above it, a plain
stroked line below, nothing in between — so a wall made of molecules vanished in one
frame. Magnification does not work like that; things get smaller until you cannot
see them. `bilayerBlend` smoothsteps between ×500 and ×200.

Two corollaries that cost a round each:

- **The two representations must not both be on screen.** Drawing the plain wall
  unconditionally, so the membrane was continuous at every scale, put a grey line
  *under* the bilayer — visible through the gaps between lipids and along a tilted
  wall. It fades on `1 − blend` instead.
- **A capped detail run must taper at its ends.** The molecular run is capped at 460
  lipids a side, and measurement showed the cap already bites *at* bilayer
  magnification (575 wanted at ×500). A capped run that simply stops leaves a hard
  edge mid-membrane; fading its last stretch turns a cut into detail running out.

## The whole-cell miniature

A small neuron sits at the top of the column in **every** view. It answers two
questions and nothing else.

**Where — one dashed amber ring, on the zoom target's own `center`.** The same point
the camera flies to, so there is nothing to keep in sync. It was briefly a box round
the whole *region*, reasoning that a patch of axon membrane and the stretch you
watch a signal cross are the same place at this size. Wrong in the way that matters:
**the canvas shows a small piece of axon, and a mark round the entire axon says the
canvas is showing all of it. A marker's job is to say what is on screen.**

The ring may share the signal's amber because it does not share its shape — a thin
dashed outline is never read as a glow. What *was* unreadable was amber laid **along**
the axon as a thick stroke, which is a lit axon however you dash it.

**Whether a signal is running, and where.** The axon lights patch by patch in every
view, from whichever clock is running. It used to do three different things — a
travelling sweep on the axon view, a uniform glow at a membrane patch, and a third
thing during the chain. One of those three was the misconception the milestone exists
to dismantle: *an axon lighting as a unit is precisely what saltatory conduction is
not.*

**And the terminal arborization is part of the axon** (corrections 2026-09-04:
"the whole thing lights up at once… not consistent with the rest of the
neuron"). The spike INVADES the arbor — one wave forking at the branch points,
each terminal's traced route covered in turn, near boutons reached first — at
the axon leg's own pace, a duration measured from the route lengths
(`ARBOR_MS` in chain.ts), never a flash when the phase changes. The per-route
coverage is one named decision (`terminalReach` in layout.ts) that the big
scene and the miniature both ask, so the two pictures cannot disagree about
where the wave is. Declared exaggeration, like every leg of the chain: a real
arbor is invaded in tens of microseconds.

⚠ **And it is drawn in the cable's OWN language** (same round, second pass:
"a yellow glowing dot with white tail moves along the lines, same as on axon
body"). The first attempt lit a growing prefix of each route — progressive,
and still a different animal from the signal on the cable it continues. It
is now the same `travellingSignal` the axon uses, with the axon's own tail
length (`ARBOR_TAIL_PX` = 0.11 of the cable). **When one structure continues
another, the signal on it must be drawn by the same function** — a second
way of saying "a spike is here" is a second thing for the child to learn.

⚠ **Fronts on a branching path are DEDUPED, not drawn per route.** Seven
routes share their first stretches and every route is covered at one speed,
so the heads on a shared stretch are the same point: one signal per route
would stack seven glows into a flare on the shared limb — brightest exactly
where the picture is least interesting. `arborFronts` returns one front per
distinct position, so one dot leaves the axon and BECOMES many at the forks,
which is the thing the picture is for. Measured over a run: 1, 2, 3, 4, 5, 6,
7, then falling back as routes arrive and their boutons take over.

### ⚠ A view and the scene it is reached from must AGREE, not be reconciled by the camera (2026-09-04)

User: *"the vesicle release view is horizontally aligned, whereas the acting
connection on the whole neuron view is vertical."*

The outgoing synapse used to lie along the scene's x axis — bouton left,
target right — while every close view of it draws the cleft the textbook way,
across the middle with the target below. The camera made up the difference
with a quarter turn on the way in. That was defensible and it was still wrong:
the picture was right at both ends and the child had to rotate it in their
head to get from one to the other.

**The scene was turned instead, and the camera's turn deleted.** The terminal
now speaks DOWNWARD — its target under the arbor, the cleft lying across, the
glial cells flanking left and right — which is exactly what the release view
draws. Which way a neuron's axon points is arbitrary; nothing is less true for
standing this way, and one less rotation is one less thing that is only true
after you have thought about it.

- **Prefer moving the WORLD over rotating the camera.** A camera turn is a
  correction applied on every arrival; a world that already stands correctly
  needs no correction and cannot drift out of agreement with the view.
- **When the axis moves, everything hung off it moves too.** The astrocytes
  flanked above/below only because the landing turn was a quarter — the same
  two cells read through a rotation. With no turn, the scene's flanks and the
  view's flanks are the same two sides.
- **Every actor in a demo belongs on the map of it.** The postsynaptic cell is
  the last link of the chain the miniature lights up, so the miniature draws
  it (dimmer — it is the other end of the story, not the subject).

⚠ **A miniature's box is SOLVED to contain its content at a fixed shape — it
is never a fixed shape laid over the content and allowed to crop.**
`NEURON_MAP_BOX` took its width from the x extent alone and derived height
from `MAP_ASPECT`, which quietly cut the top and bottom off. That was harmless
until a cell moved downward, and then the postsynaptic neuron was drawn
outside its own sheet. The width is now whichever of the two demands is
larger: the content's own span, or the span its height needs at that aspect.

### ⚠ The way out lives on the MAP, not over the picture (2026-09-04)

User: *"'outgoing synapse' is missing 'back to the whole picture' button."* It
was never missing. It floated over the stage at `top-3 z-10`, and two views —
the synapse framings and the spike demo — lay a FULL-WIDTH control column
across the same band, at the same z, later in the DOM. The button was painted
over and the transport bar took its clicks. The axon views never showed the
fault because their plate is CENTRED: the rule held by accident in three views
and failed in two, which is what a rule expressed only as repeated `top-3
z-10` in five files buys you.

It was first fixed by arithmetic (the hatch owned its band, columns started
below it). The user then moved it somewhere better: *"place it inside the 'map
neuron' container, in the left bottom corner, for all occurrences."*

**The control now sits in the corner of the whole-cell miniature.** That is
strictly better than owning a band on the stage, and the reason is worth
keeping: the miniature is permanent and is nobody's overlay, so nothing can
ever be laid across it; it is the same corner in every view, so the control
does not move as the chrome around it changes; and **the picture it sits on IS
the whole picture it returns you to** — the control and its destination are
the same object. The stage's chrome columns went back to `top-3`, reclaiming
the height the workaround had cost.

- **When a control is reported missing, look for it underneath something**
  before adding a second one. A duplicate would have "fixed" this while
  leaving two escape hatches to keep in step.
- **Chrome that must never be covered should not be a sibling of the things
  that cover it.** Z-order and offsets are a negotiation; a different
  container is not.
- **It is minimal there, and still named.** A corner of a thumbnail is not
  where a big amber pill belongs — but an icon alone ranks and does not name,
  so the word stays and the sentence moves to `title`.

### ⚠ A door has to be findable at rest; hover answers a different question (2026-09-04)

User: *"magnifying glass areas are not visible on the big neuron, as things
got more cluttered. Make the hover state into active state, but without
labels. On hover add yellow glow and labels."*

The zoom markers were drawn when the scene was nearly empty: a slate ring at
0.75 alpha was plenty. The scene has since gained a traced dendritic fan with
twigs, seven boutons, four whole partner cells and six astrocytes — and the
markers quietly stopped being findable. **A door nobody can see is a door that
is not there**, and nothing failed to warn us because nothing was measuring
whether a marker stood out from what is behind it.

- **The RESTING state carries the prominence.** Full-strength ring and icon —
  what hover used to look like. Finding a door must not require hovering over
  the place the door is, which is circular.
- **It survives clutter by DARKENING what is behind it, not by shouting.** A
  backing disc, the same answer the app already uses for a name that would
  disappear into what it lies on. More brightness competing with a bright
  scene is an arms race the scene wins.
- **Its ink is chrome, not anatomy.** A marker wearing the cell's own slate
  competes with the cell; near-white reads as "a thing you can press".
- **Hover then means the glow and the name.** The yellow was briefly reserved
  for hover; the user's next call (*"make nav dashed circles yellow"*) went
  further and better. The miniature's "you are here" ring was ALREADY amber,
  so **a yellow dashed circle now means one thing on both pictures** — a place
  you can go, or the place you are. Hover is told apart by the glow and the
  name, which is a difference you can see without a comparison.
- **The choice is returned as numbers** (`markerStyle`), so it can be asked
  directly instead of counting marks on a canvas.

⚠ **The general lesson: a drawing calibrated against an empty scene expires
when the scene fills up.** Every "how visible is this?" decision made early is
provisional, and nothing in a test suite notices it going stale.

### ⚠ Stroke a shape ONCE: overlapping caps composite twice (2026-09-04)

User: *"dendrites of the main neuron have visible dots on the places where its
pieces collide."*

The fan is modelled as SEGMENTS — a hit region, a ripple's route and a
miniature's line all want segments — and the scene drew them one at a time
with a round cap at each end. Under the fan's own `globalAlpha` that
**double-composites every join**: two overlapping round caps at α = 0.85 paint
1 − 0.15² = 0.98, so each of some thirty joins on a branch came out as a
bright dot. The ink was right; drawing it thirty times was not.

- **A branch is one mark.** It is laid down as a single tapered ribbon —
  walked up one side and back down the other, at the width the taper gives
  each point — and filled once, so a join is not an event.
- **A polyline stroke cannot taper and a per-segment stroke cannot join**, so
  where a process must do both, fill a ribbon rather than stroke a line.
- ⚠ **The general form: any translucent drawing made of overlapping pieces
  shows its seams.** Partial alpha turns "drawn twice" into a visible mark,
  and it is invisible at α = 1 — so it survives every test that draws opaque.
- **Segments are DERIVED from the strokes**, never maintained beside them, so
  the model the hit regions use and the shape the eye sees cannot drift.

### ⚠ Where a 🏷 switch goes, and whether it is earned at all (2026-09-04)

Asked for as a rule — *"rely mostly on the facts: how cluttered the layout is,
how many events occurring."* Here are the facts, counted across the exhibits:

| exhibit | names on canvas | canvases | something runs? | switch |
| --- | --- | --- | --- | --- |
| vesicles & SNARE | 18 | 1 | timeline | yes |
| ion channel structure | 8 | 2 | an attempt | yes |
| phospholipid bilayer | 8 | 3 | assembly | yes |
| the synapse | 4 | 1 | timeline | yes |
| selectivity filter | 3 | 1 | an attempt | yes |
| resting voltage | 3 | 1 | dragging | yes |
| patch clamp | 3 | 1 | rolling strip | yes |
| membrane charge & capacitance | 3 | 1 | — | **no** |
| membrane permeability | 1 | 1 | drifting | **no** |

**A switch is EARNED by either fact, not by having labels at all.**

1. **Density** — about six or more names, so hiding them materially changes
   what can be seen (SNARE's eighteen; the channel's and the bilayer's eight).
2. **Motion across the names** — a run, a timeline or a recording whose moving
   parts pass through where the names sit, so at some moment a name is in the
   way of the thing it names.

**It is not earned by a sparse, mostly still picture.** One or three names
that nothing crosses are simply part of the drawing, and a control to hide
them answers a question nobody asked — every switch is one more thing to
learn before the exhibit starts. Those two exhibits show their names always.

**Where it goes** (user, 2026-09-04: *"make sure 'labels' are in the top right
corner, unless space is already taken. Align horizontally with other buttons,
if any"*):

1. **The TOP-RIGHT corner** — of the picture, or of the panel the picture sits
   in. One place, so it is found without looking.
2. **Unless that corner is taken.** Then the nearest free corner, and the
   reason is written down: inside a zoom the stage's top-right carries the ×N
   reading, so the switch goes top-LEFT there.
3. **If a row of controls already exists, the switch joins THAT ROW**, pushed
   to its right end (`ml-auto`) — never a strip of its own above it. One row
   of chrome: the actions from the left, the way-of-reading control at the
   right. This supersedes the earlier "outside the picture, in a row of its
   own" for the filter and the bilayer lab.

⚠ The switch is horizontally aligned with whatever it stands beside — same
row, same baseline. Two controls at two heights read as two unrelated things.

⚠ **Never over an instrument.** A graph, a ruler or a recording is the thing
the view exists to be read; chrome laid on it covers the answer. This is how
the switch came to sit on the myelin view's voltage-against-distance plot.

⚠ **On the whole-neuron stage:** top-right at the whole picture, top-LEFT
inside a zoom — those views put their own plates CENTRED at the top, the ×N
reading is top-right, and the bottom is where the instruments are.

### ⚠ A new exhibit opens on a picture the child already owns (2026-09-04)

User, of D17's first version: *"the new visualisation is not kids-friendly, is
torn out of context. Make clear: where is astrocyte? where is neuron? Reuse
the visuals kid already knows. Re-build from scratch."*

That first version invented its own composition — two horizontal walls and a
vertical one — and it was **a diagram of a process rather than a picture of a
place**. Everything in it was defensible in isolation and the whole was
unreadable: a child arriving from the synapse view had to work out what they
were looking at before they could learn anything, and the answer to "where is
the astrocyte" was "the grey-green band down the right-hand side".

**A drawer that deepens a view opens on THAT VIEW'S picture.** D17 now uses the
synapse view's own `synapseGeometry`, its bouton, its cleft, its spine and its
two green glial fingers, drawn by that view's own `drawAstroFinger` — asked
for, never copied. What the drawer adds is only what it is about: the doors on
those fingers and the journey through them.

- **The orientation question is answered IN the picture, not in a caption.**
  Where is the astrocyte? The green thing at both mouths of the gap, the one
  the previous view already named. Where are the neurons? The two grey cells
  above and below it. These names are drawn at EVERY moment of the run, not
  only at the still it opens on.
- **New composition is a cost, and it is paid by the child.** Reuse is not
  laziness here; it is the difference between arriving somewhere and being
  moved somewhere.
- **The corollary for the code:** if a drawer needs a structure the parent view
  already draws, EXPORT that drawing rather than writing a second one. Two
  drawings of one astrocyte at one synapse is two astrocytes.

### ⚠ A switch with nothing to switch is not a control (2026-09-04)

The spike-train bench draws no NAMES at all — only readings (the mV axis ticks
and the `spike`/`nothing` outcomes), and readings are never hidden by the 🏷
switch. Asked whether to put a switch there anyway for positional consistency,
the user ruled: **skip it — nothing to hide.** Consistency of PLACEMENT is
worth having; consistency of PRESENCE is not, when presence means a control
that appears to do nothing. It is recorded here so the gap looks deliberate
rather than missed.

### ⚠ Fill the room, and PROVE what you trimmed to do it (2026-09-04)

User: *"stretch canvas to take all available space horizontally."* Against a
recorded correction of 2026-08-28: fitting by width alone *"cropped the bottom
off"*, after which the scales exhibit fitted by BOTH sides.

Both are right, and they only fit together if the trim is measured. The scene's
height follows the browser WINDOW while a drawer's room does not, so on a tall
screen the scene is the taller shape of the two, the both-sides fit becomes
height-bound, and a band of panel goes unused. **The 2026-08-28 fault was not
the fitting — it was that nothing measured where the scene's ink ENDED**, so
the crop ate the cell instead of the water around it.

`SCENE_INK_Y` (layout) is that measurement; `fitScene` fills the width by
trimming margin symmetrically, and **only while the trim provably stays inside
the margin**. When it would not, the both-sides fit is what happens: the
picture stays whole and the slack comes back. The old behaviour is the
fallback, not the rule.

- **A fit is a DECISION, so it takes its shapes as arguments.** As a
  module-level constant it could not be exercised: in a test environment the
  window is short, the scene is short, width already binds, and the branch
  that matters never runs. A guard that cannot reach the branch is not a
  guard.

### ⚠ The way out travels with the map (2026-09-04)

Wherever a picture of the whole neuron appears, the control that returns you
to the whole neuron appears with it — same corner, same words. That now
includes a picture of it inside a DRAWER: the spike-train bench carries an
inset of the cell, and its drawer ✕ is not the same act, because the bench is
opened AT a zoom and closing it leaves you inside a patch. There the control
does both steps: close, then pull out.

This is the earlier ruling (*a drawer closes; it does not travel*) holding
rather than bending: a drawer with no map still only closes. What earns the
way out is the MAP, not the container.

### ⚠ Name the cast. An identity the app RELIES on and does not state is an assumption the reader makes for it (2026-09-04)

User: *"what makes us think that neurotransmitter, displayed in 'the synapse'
demo is glutamate?"*

The answer was that the app had already committed to glutamate in every number
it used — AMPA-type receptor rates, a 0 mV reversal, glutamate's own diffusion
coefficient, 4,000 molecules a vesicle, a synapse landing on a spine — and then
never said so. `core/synapse.ts` used the word "transmitter" seventeen times
and "glutamate" none. The identification was sound; it was simply invisible.

**That is not untidiness, it is a correctness risk, and here is why.** The
reuptake drawer teaches that the astrocyte does most of the clearing. That is
true OF GLUTAMATE and false of several other transmitters — GABA and the
monoamines are largely recovered by the neuron that released them. Beside a
synapse the app never named, it reads as a fact about transmitters in general.
**The app was one unstated assumption away from teaching something wrong — not
because the synapse was mislabelled, but because it was unlabelled.**

- **Say what the cast IS, and give the evidence** so it is read off the picture
  rather than asserted: this synapse names glutamate and says how you can tell
  (it excites, it lands on a spine, its receptors are AMPA-type).
- **A claim that is true of one member of a family says which member.** Where a
  fact depends on the identity, the qualifier travels with the fact.
- **Guard it.** Both are pinned by tests on the words themselves, the way the
  generic ligand-gated channel is already pinned to say it is generic.

### ⚠ Which terms speak is ONE list, asked by every producer (2026-09-04)

Voice (F04) is granted per term, on request. When the scene's part names were
given voices, the decision was put in a single predicate (`sceneTermSpeaks`)
that BOTH the part names and the zoom markers consult — so a marker cannot
quietly acquire a voice by being handed a `speak` field. A marker's label
names a DOOR: "Passive spread" is somewhere to go, not a piece of a neuron,
and teaching it as a part is exactly what the predicate keeps out.

**A hit box is built from the geometry the drawing used.** The scene's names
are painted on a canvas, and where they land is known only once the frame is
composed — the camera has moved them and the keep-out nudger may have pushed
them sideways. So the drawing records where each spoken name actually ended up
and the stage hit-tests against that, never against a second calculation.

### ⚠ A drawer CLOSES; it does not travel (2026-09-04)

The same round briefly gave every drawer the stage's own "back to the whole
picture" — a misreading of a request that was about the synapse ZOOM view.
The user ruled: *"drawers do not need such."* The two are different acts. A
zoom is somewhere you went, and the camera has to bring you back. A drawer is
something you opened OVER where you already are, and closing it is the whole
of the return — naming it as travel promises a journey that never happens.

### A drawer hides the column, so a drawer says where it is (2026-08-31)

⚠ **And the first question to ask is whether it should be a drawer at all.**
D05 grew an on-canvas miniature, an on-canvas reset chip and a control row of
its own — three re-inventions of chrome the app already has — and every one of
them was a symptom of the exhibit being in the wrong kind of container. Moving
it to a place deleted all three. **When a drawer starts rebuilding the app's
furniture, that is evidence about the container, not a list of things to
build.** What follows still holds for the drawers that really are drawers.


The miniature is permanent *in the column* — and a drawer covers the column. So
the exhibits that fill the screen are exactly the ones with nothing on them
saying which part of which cell they are about. D05 was the worst case: a whole
view about a stretch of axon that never showed the axon it was a stretch of.

**A full-screen exhibit that is about a place draws the miniature itself,
top-left.** Not a new drawing of a cell — `drawNeuronInset`, from
`NEURON_MAP_BOX`, the same geometry the big canvas uses. A second hand-drawn
neuron is a picture that can quietly stop being a picture of *this* neuron.

**And it stays at rest.** Two reasons, either sufficient: a miniature must not
inherit a demo's pacing, and `drawNeuronInset` lights a whole region at once —
which for the axon is the one thing this app's miniatures may never show.

### One parameter, one claim (2026-08-31)

`drawNeuronInset`'s `ringAt` meant two things at once: *you are here* **and**
*a pipette is clamped here*. Fine while one bench drew the cell; wrong the moment
a second exhibit wanted to say where it was looking without claiming apparatus
its picture does not have. The fix is a flag, not a copy — **a second copy of a
drawing is a second copy of every bug in it.**

## Put things ON the shape, not on a line through it (2026-09-01)

A traced silhouette is a curve, and anything living on it has to ASK IT where it
is. The synapse laid its active zone — five vesicles, four calcium doors, the
cleft's ceiling, the tear — along a straight line at the bouton's lowest point,
and measured, the outer vesicles were **47 and 88 px outside the cell**.

- **Flatten the traced path and query it** (`svgPath.flattenPath` →
  `boutonShape.boutonFloorAt`). A traced shape you can only draw is a shape you
  will end up guessing about.
- **Apposed membranes follow each other.** The postsynaptic face is defined as
  *the presynaptic wall plus one cleft*, so the gap is the same width all the way
  across by construction. It was an ellipse near the foot's height, which is how
  a 26 px cleft became a lens.
- **The guard is "everything", not "the middle one".** The centre of a curved row
  is always right; it is the ends that are wrong.

### An opening in a shape is ON the outline too — both ends of it (2026-09-01)

Round two of the same fault, one level up. A fused vesicle was drawn as a full
circle with its outline clipped by a **horizontal band** at the wall's height,
over a tear whose width was a chosen number — so on the sloped parts of the
foot, the cut across the vesicle and the membrane it was merging into
disagreed, and the user's verdict was exact: *"the cut on the vesicles does not
repeat the curve of the presynaptic bouton... it looks unrelated."*

- **A joint between two drawings is ONE geometry.** The omega's arc now ends at
  the two points where the circle crosses the traced outline (`pocketAt`,
  bracketed and bisected against the curve), and the tear in the wall runs
  exactly between those same two points — carried on the tear object itself
  (`xL`/`xR`), so the torn wall and the arc's feet *cannot* disagree. Two
  shapes that must meet and are solved separately will meet only in the flat
  case.
- **Clearance is against the curve, not the point below.** A docked circle
  placed `r + membrane` above the wall *at its own x* was already through the
  outline SIDEWAYS on the sloped slots — found because the omega rework made
  the curve the reference and reported a 10 px "tear" at the instant of fusion.
  `dockedY` raises the centre until the whole circle clears the outline.

## Cause on screen no later than effect (2026-09-01)

The model dumps a vesicle's whole dose into the cleft AT the instant of fusion
(`core/cleft.ts` — the crossing is sub-microsecond). The drawing gave the merge
its own leisurely `FUSE_MS = 9` — longer than the entire fusion leg — so on the
legged clock the cloud appeared, peaked and faded **while the vesicles were
still sinking**: the effect ran seconds ahead of its cause, and the two read as
unrelated events.

- **An animation drawn under a model instant must fit inside what that instant
  causes.** The mouth opens in `PORE_OPEN_MS` (√-eased, so it is visibly open
  by the first drawn moment after fusion), the cargo drains on the transmitter's
  own stay in the gap, and the slow part — the pocket flattening into the wall —
  comes *after* the payload, where slowness costs nothing.
- **The housekeeping ends.** Every transient the drawing invents needs its own
  end state on the wall: the pocket flattens (`FLATTEN_FROM_MS` +
  `FLATTEN_MS`), the tear heals, and the run's last frame shows a whole
  membrane — a terminal torn open for the rest of the window was the other lie.
- **The guard walks the user's clock.** The test walks `synapseClock` and
  asserts a moment exists where the cloud is out AND the mouth is fully open,
  and that the wall is torn within a blink of the cloud's first pixel.

## Loose matter has identity (2026-09-01)

The user's ruling, after three rounds of piecemeal fixes to teleporting
particles: *"all ions and all neurotransmitter balls have identity. They live
in the soup, visible from the very beginning. Each has its own travel
trajectory. None fades out, none materializes from nowhere, none teleports."*

- **A population is a fixed-size cast, not an effect.** Cycling drips,
  concentration-faded clouds and threshold-popping crowds all mint and destroy
  particles. A cast (`stage/synapseCast.ts`) returns the same members in the
  same order at every moment; each member's position is one continuous
  piecewise trajectory, a pure function of the run position. The model still
  owns every WHEN (fusions, bound/open crossings, integrated current,
  clearance); the cast owns only the WHERE between those moments.
- **Clearance is departure, never a fade.** Removed transmitter leaves the gap
  at an end and rests in the bath; cleared calcium is grabbed by the buffers
  and drifts deeper into the terminal (`BUFFER_RATIO` is the model's own
  fact). Counts at a place still track the model — by travel.
- **Conservation becomes a testable fact.** The cast's length never changes,
  and the drawn ink at rest equals the drawn ink mid-release.
- **The teleport guard samples SCREEN time.** Walk `synapseClock`, evaluate
  every cast at every step, and bound each ball's per-step movement. It caught
  two real faults on its first run: a puff outrunning the screen step in a
  fast leg, and a path plunging 100 px where the bulb's flank turns steep.
- **A path through the gap follows the gap.** A straight line between two
  points of a thin CURVED band cuts through its walls near the ends (measured:
  13 px inside the bouton). Parametrise travel as (x, fraction-between-walls)
  and ask the membranes for y at every step — *put things ON the shape*,
  applied to motion. And keep gap-dwellers inside the apposed region: past it
  the band flares and even a faithful path plunges.

## A layout is SOLVED from a budget, not chosen (2026-08-31)

"Make the active area twice as large" had no answer while the frame was divided
by hand: the neck took a share, the bulb took a share, the spine head took a
share, and whatever one gained another lost. The fix is to have the caller
declare what it needs below the subject — fixed pixels, and pixels that scale
with the drawing — and solve for the scale.

Two things follow, and both are rules:

- **What a request actually reached is measured and reported, never asserted.**
  A literal 2× on both structures does not fit 660 px; the answer is "×1.96 on
  the active zone, ×1.74 on the head, and here is why", not a silent 1.2×.
- **Size a part off the STRUCTURE it belongs to, not off the canvas.** The
  active zone was `max(40, width * 0.085)` — a fraction of the window — which is
  precisely why giving the terminal more room left the active zone exactly the
  same size. It is a patch of the terminal's own membrane; its size is the
  terminal's business.

## Where the outside is, say so with the same ink (2026-08-31)

A vesicle's lumen is **topologically outside the cell**. That is the whole
reason exocytosis works: nothing is carried through a wall, a pocket of outside
that was folded in is unfolded again. So the lumen is painted with the bath's
own constant — not a colour picked to match it, which is two things that can
stop agreeing.

For that to be a fact rather than something you check by eye, the bath had to
become **opaque**: a translucent wash over the page meant what you saw was a
blend of two layers, and no test could ask the question.

This replaced an earlier ruling ("a vesicle is a bilayer ring, never a hollow
circle"). What that rule protected — *the material is the point, two bilayers
can join and become one* — is carried better by the two rules the same round
added: **exocytosis tears the wall** (a real gap, clipped out, never a vesicle
drawn over an intact line), and **a vesicle loses its outline where it overlaps
the membrane**. An outline that stops where the walls meet says *same material*
more directly than a ring ever did. The molecular ring survives where it is
resolvable, in D06.

## A machine's cargo sits where the machine has a seat (2026-09-06)

A ball being carried through a protein goes at the protein's own **chamber** —
the rounded pocket the handover draws — not at the point the door is anchored
at. Those are not the same place: a transporter is at its NARROWEST in the
middle of the wall, which is exactly where a door's point sits, so a ball put
there reads as jammed in the neck rather than held in a site.

**Find the seat, do not declare it.** `poreSeat(glyph, side)` walks the pore's
clear width out from the wall's middle toward the side the cargo enters by and
returns the first row wider than the rows either side of it. Measured on PMCA:
the chamber is 22.3 units across against 9.0 at the middle. A number typed here
would drift the first time a file changed. (User, 2026-09-06: "calcium ion
should be positioned not in the middle of the channel, but closer to the
entrance there where you see a visual curved shaped, circle shaped slot".)

**And measure a shape by CROSSING it, not by sampling its points.** The first
version of this asked flattened points how wide the pore was; a long straight
edge has no points between its ends, so VGLUT read as having no gate at all for
a third of its height. Cast a ray and take the crossings.

### A transporter's gates must swing BOTH ways (2026-09-06)

`open` is signed — −1 open to the side the cargo comes from, 0 shut, +1 open to
where it goes — and that sign is the whole difference between a transporter and
a door. The drawing clamped it to [0, 1], so half of every cycle was drawn
identically to shut. If a state exists in the model and the drawing cannot show
it, the drawing is not showing the model.

### One pore, one molecule — and the waiting room is the one already there
(2026-09-06)

A pore carries one thing at a time, so anything that queues for it needs a
schedule: which pore, what order, how long a turn. But do NOT invent a waiting
line where the picture already has one. A line standing off each vesicle's
filler — the calcium's pattern, copied — put a ball FURTHER from its bubble than
the pool spot it left, an 11 px turn-back against the dogleg guard. The standing
pool IS the queue; a ball leaves it when the pore is its own.

## One protein, one drawing — across REGISTERS too (2026-09-06)

The same molecule appearing in two views must be the same glyph, the same ink
from the code book, and the same behaviour. The SNARE drawer drew VGLUT as a
hand-made barrel in `#6366f1` — which is EAAT's wall exactly, the *astrocyte's*
transporter, in a drawer that has no astrocyte in it — while the synapse view
drew the same protein from the handover in purple, running a transport cycle.

- **The behaviour is part of the drawing.** A close-up that shows LESS of the
  machinery than the wide view is the wrong way round.
- **Share the decision, not just the picture.** The cycle's four beats live in
  one function (`transportOpen`) that both views read: a second private copy is
  a second copy of every correction ever made to it.
- **Scale is the one thing that may differ, and it is declared.** The wide view
  draws a channel several times its 5 px membrane — an exaggeration, or it would
  vanish; the drawer resolves the bilayer molecule by molecule, so the protein
  simply spans it.
- **A channel wears what it passes — but never its cargo's EXACT ink.** The
  proton pump takes the protons' red family, a shade off their body colour.
  Painting a protein in its cargo's own hex makes "count the cargo's ink"
  unanswerable, which is how VGLUT's first teal was caught.

### A guard that walks a run must sample in SCREEN TIME (2026-09-06)

Seven guards written as "400 samples of the run" were one sample per 50 ms while
that run was 20 s. When the run grew to 30.4 s to pay for a cycle, the same
motion at the same speed started reporting 30 px teleports: the walk had got
coarser, not the picture. Derive the step from the run's own length, so a stage
given more time can never loosen a guard — and so a guard can never punish the
clock for being generous.

## A drawer must be able to say what it does that the view cannot (2026-09-06)

Before building a drawer, answer one question in a sentence: **what does this do
that the view it sits over cannot?** If the answer is "the same thing, closer",
it is not a drawer — the view already has a camera, and this app already has
zoom targets that dive four times deeper than a hand-rolled one will.

Caught twice now. D17, "where the transmitter goes", was built and deleted
(2026-09-04) because its content belonged on the main view. S14's first two legs
were built and deleted (2026-09-06) for the same reason, and the user asked the
question that settles it: *"If it's a copy, why recreate instead of zooming in
the big view?"* Measured before deleting them: the same scene through the same
function, **1.6×** in where the view's own 🔍 place goes **4×**, and **13.6 s**
of screen for a stretch the big view already gives **19.4 s**.

**What a drawer legitimately owns** is anything a single run cannot play:

- a FORK — a choice the child makes, where the same thing happens three ways
  (retrieval: kiss-and-run, clathrin, ultrafast);
- a COMPARISON that needs two things side by side;
- a register the view genuinely cannot reach.

**And a drawer still borrows everything it can.** S14 draws `drawSynapse` held
on a still and the app's own `vesicle`, `fusedShape`, `pocketAt` and lipid
paver; what it adds is only what no view has drawn. When it needs a piece of the
scene out of the way, the scene gets ONE explicit hook (`skipDocked`) rather
than the drawer keeping a private copy of a bubble.

## Jiggly lipids — the DEFAULT bilayer (2026-09-06)

**When a membrane jostles — two rules** (user, 2026-09-06, superseding the
blanket "always" this section first said):

1. **A view whose resting picture already moves gets jiggly lipids; a view
   whose resting picture is a STILL keeps still lipids.** A jostling wall under
   a labelled still reads as noise, not heat — which is how 'Ion channel
   structure' earned its lipids back their stillness the same day they were
   given a clock.
2. **Where the bilayer or its parts are the main actor or subject, it jiggles
   regardless** — the phospholipid bilayer lab (thermal motion IS the lesson),
   the SNARE bench and the synaptic-vesicle-endocytosis drawer (fusion and
   retrieval are things that happen TO the membrane), the synapse's own
   molecular register (its vesicles fuse into that wall and are pinched back
   out of it).

The audit, as applied (2026-09-06): jiggling — permeability (motes at rest),
capacitance (membrane is the subject), channel types (the leak trickles at
rest), patch clamp (the channel flickers and the trace sweeps at rest), resting
voltage (leak traffic), the lipid lab, the SNARE bench, the synapse zone, the
endocytosis panels. Still — ion channel structure (a labelled anatomy until
Send is pressed).

**Mechanics — one owner.** The maths is `lipidJiggle(i, ms, free)` in
`stage/bilayer.ts`: a pure function of the lipid's identity and the clock —
sines at three incommensurate frequencies, no per-lipid state, nothing to
shimmer, `Math.random` nowhere. It began as the phospholipid lab's; when the
walls needed it the maths moved to the module the membrane is made in and the
lab now points at it (`export const jiggle = lipidJiggle`). A second copy is a
second copy of every correction ever made to it.

**Usage.** Both membrane-drawing paths take an optional `ms`:

- `drawLipids(ctx, { …, ms })` — the straight-run walls (permeability,
  capacitance, channel types, patch clamp, channel structure, resting voltage).
- `paveMembrane(ctx, samples, { …, ms })` — the traced walls (SNARE bench,
  synapse zone, vesicles, astrocyte, endocytosis panels).

Pass **screen time** (the rAF clock), never the model's position: thermal
motion does not pause when a run is scrubbed or finished. Absent `ms`, the run
is byte-for-byte what it drew before the clock existed — tests stay
deterministic by simply not passing one, or by passing a constant.

**Rules, each from a bug:**

- **Each leaflet is its own molecule** (user: "lipids move individually, not in
  bond with an opponent"). The identity is `slot * 2 + leaflet`, so the head and
  the head facing it across the oily core move on different beats. One jiggle
  applied to the pair is a rigid object the bilayer does not contain.
- **The identity is the SLOT, never the pushed x.** `pushAt` moves a molecule
  every frame while a wall parts; an identity that rides the moving x re-rolls
  the phase as it goes — a shimmer, not a jostle.
- **Guard the drawing, not the helper, and bucket by draw order.** Two traps
  found by breaking: a rigid rotation swings tail marks across the midline, so
  bucketing marks by which side they LAND on sees a bonded pair "move apart";
  and a fixture two slots wide compares neighbours, which differ even when
  bonded. One slot, halves by draw order, and the rigid case measures as
  floating-point dust (1.8e-14 px against real motion's ~0.1 px).

## The 'side-by-side interactive comparison' layout (2026-09-06)

`ui/SideBySide.tsx` — the named, reusable form of the layout born in the
equilibrium bench and matured in 'Ion channel types' (D04). The user refers to
it by this name. One container per thing being compared, in a stretching row;
each container stacks, top to bottom: **headline** (speaker FIRST, then icon,
then name — the child must not hunt for the word the button says), an optional
**fixed-height caption** (fixed because a caption that reflows moves the
picture below it, and the pictures must sit in a row), the **canvas**
(transparent — the container's own `bg-slate-950/40` is the ground; a scene
washes only what its meaning needs), and the **action at the foot** (h-38px,
full width, tinted like its panel, icon inside the label; a panel with no
action keeps an empty slot the same height so the canvases start at one y).

Panel sizes are still SOLVED in each exhibit's scene module from the drawer's
content box — the component owns the anatomy, never the budget. Its reference
users are D04 (four panels, captions, one panel with no action) and S14
(three panels, no captions, a run-all control above the row).

## Ask the DECISION, not the ink (2026-08-31)

Four guards written for the synapse and the SNARE drawer passed with the code
deliberately broken. Every one failed the same way: it counted marks on a canvas
and hoped they belonged to the thing it was about.

- "the transmitter appears already spread" counted vertices in a horizontal
  band — and was measuring the **bouton's control points**, 442 of them, at
  every moment of the run *including moments when the gap was empty*;
- "a vesicle is a ring of membrane, never a hollow circle" counted arcs and
  strokes in the frame — and the **terminal's wall alone** cleared the
  threshold;
- "the door is drawn on the machinery" compared a hit box with the function it
  came from, which proves nothing about where the ink went;
- "the spine meets the terminal" asked only that it be below the foot and above
  the shaft, which stayed true with the spine pulled three radii away.

**The fix is the same every time: make the decision a named, exported function
and test that.** `transmitterCloud`, `vesicleRing`, `snareLens` exist as
functions because a test needed to reach the real call site — the app's oldest
lesson here, restated. Where the claim really is about the picture ("the ink
goes where the door says"), then scan the frame — but scan it *for that spot*,
not for a count.

And the corollary, which caught two more: **a guard you have not broken is a
guess.** Three of the four passed their first break attempt.

## Level of detail cuts BOTH ways (2026-08-31)

The rule has always been "molecules dissolve as you pull back". The synapse
scene is the first view where it points the other way and the answer was to draw
*less* detail than the app owns: the bouton is ~1 µm drawn ~440 px, so its
membrane is 5 nm ≈ 2 px and a phospholipid head is a third of a pixel. Paving it
with molecules would be drawing something nobody can resolve.

So the same membrane is a **two-leaflet band** on the synapse scene and a
**paved bilayer** in D06, where one 40 nm vesicle fills the frame. That is not
two drawings of a membrane — the paver is one shared function
(`bilayer.paveMembrane`, extracted from the whole-neuron scene for exactly this)
and the band is what it looks like when its molecules are smaller than a pixel.

## Two doors at one place need two icons, not one menu (2026-08-31)

Two exhibits now live on the axon. The rule *a marker's job is to say what is on
screen* makes a shared marker with a chooser behind it the wrong answer: it puts
a page between the child and the place. So each gets its own marker, **spaced by
at least a marker's diameter** — measured against `MARKER_R`, not a chosen gap —
and the app's own 🔎-in-a-dashed-ring is what both wear. A door you cannot aim at
is not a second door.

## When the payload is 5% of the run, the clock is the bug (2026-09-01)

"No neurotransmitters are visibly released" was a true report about a correct
model. Measured: transmitter is in the cleft for **0.87 ms of a 60 ms window —
4.6% of the run**. A linear clock shows that as a blink however slowly the whole
thing plays, and slowing the whole thing slows the empty 95% with it.

The rule already existed (*a run's clock follows the interest*) and this is the
sharpest case of it yet: **before reaching for a slower animation, measure what
fraction of the run the subject is actually on screen.** If it is a few per
cent, the fix is legs, not speed. Slow the leg, never the item — the map is
linear inside each leg, so nothing ever moves at a pace the model did not give
it, and a test walks the clock to prove it.

## Guard the MIDDLE of a transition, not only its ends (2026-09-06)

*A guard you have not broken is a guess* — and D18's break round found the next
turn of that screw: **a guard you broke with a fixture that is already past the
moment cannot fail either.**

Three deliberate mutations to the synapsin ropes survived: tying every vesicle
instead of the reserve, never moving a freed vesicle, and assigning
`globalAlpha` outright instead of multiplying it. All three looked like solid
guards. All three were measured on a fixture that had hammered the terminal
until `freed` reached 1 — by which point the reserve pool is empty, no rope is
drawn on that frame at all, and the mutated code never runs.

The ropes have **three** states — tied, going slack while the reserve comes
forward, gone — and only the ends were being asserted. The middle one is the
only one a child actually watches.

So: when a thing changes over time, **build a fixture for the moment it is
changing**, not only for before and after, and assert the in-between: present,
part-way, and strictly between where it started and where it is going. The same
round also deleted an `if (s.freed >= 1) return []` that no mutation could make
matter — **code a break cannot reach is not a rule, it is decoration.**

**And a journey has more than one leg** (2026-09-06). D18's transmitter balls
wait in the bubble, cross the mouth, then drift down the gap — three branches.
Two mutations survived a whole round by hiding in the crossing leg alone: no
assertion ever sampled a moment when a ball was on it. Count the branches in the
function and make sure a fixture lands on each; "before and after" is two
fixtures for a three-legged journey.

**Ask for what the budget PROMISED, not merely for the absence of collision**
(2026-09-06). The pools' seats are solved to leave `GAP_X` of clear air between
neighbours. A break that spaced them on the vesicle's *ring* instead of its
outer radius left 94.8 px between 92 px bubbles — 2 px of air, visibly wrong,
and a guard asking "do any two overlap?" passed it. A solved layout exports the
pitch it solved for, and the guard asks for that number.

## When a request needs a molecule drawn, change the COUNT, not the molecule (2026-09-06)

*Level of detail cuts both ways* says: draw less than the app owns when the
molecules would be smaller than a pixel. D18 met the case where the user wants
them anyway — "make vesicles have visible lipids" — and the arithmetic was
brutal: a pool vesicle was **31 px across while one shared lipid is 32.7 px
thick.** The molecule was larger than the object.

There are only three ways out, and two of them are bad. Shrinking the lipid to
fit is drawing something sub-pixel. Exaggerating the lipid alone breaks *one
protein, one drawing* and leaves a bubble that is mostly skin. The third is to
**make the object big enough to be made of something** — which meant cutting the
counts from 5/6/9 to 3/4/6, and that was the user's call to make, so it was put
to them with the numbers.

The rule: when an exhibit must show what a thing is MADE of, the thing's size is
no longer free. Solve it from the molecule up, put the cost — fewer of them — to
the user, and declare whatever exaggeration is left beside the true proportion.
D18's lipid head is 3x its honest size and says so; its COUNT is not
exaggerated, and neither is its structure.

## Everything that opens the wall opens it for EVERYONE (2026-09-07)

D18's reported tear. Every fusion inserts its vesicle's membrane into the wall,
so it pushes the wall's molecules aside — and **it pushes the other fusions
aside too.** The bubbles were drawn at their parking spaces while the gaps they
were meant to fill had moved. Measured on the drawn molecules: two bubbles
merging together tore a **59 px hole**, at a place neither of them was.

One fusion alone was always sound, which is the trap: the bug needed a burst to
appear, and every fixture in the guard suite used a single spike.

Two rules come out of it:

- **When several instances of an effect share a surface, each one is subject to
  the others.** Compute the displacements first, then place every actor in the
  displaced frame. Do not place actor *i* from the undisplaced geometry.
- **Keep the material frame and the drawn frame apart, and know which one each
  question belongs in.** "Which side of this opening is that molecule on?" is
  asked in the wall's own undisplaced coordinates — that is the frame the
  pushing is *decided* in. "Where do I paint this bubble?" is asked in displaced
  ones. Mixing them is exactly what tore the membrane.

## A sampler must be told which molecule will pave it (2026-09-07)

Two drawings of one membrane in a single picture, reported as *"lipids in
membrane and vesicles are different, unify"*. The size gap was the visible part;
the cause was structural.

**A lipid's shape is a RATIO, not a size.** `drawLipidAt` seats the head at
`halfMem − headR` and stops the tail at `headR × MID_SEAM`, so the tail's length
is `halfMem − 1.75 × headR`. Scale a lipid by changing only one of the two
numbers and you have not scaled it — you have drawn a different molecule. The
wall's ratio was 5.0, the vesicles' 2.5: a small head on long tails beside a fat
head on stubs.

**And the shared samplers silently allowed only one molecule.** `omegaRing`,
`wallPoints` and `ringPoints` each computed their sample spacing from a private
constant pinned to the default lipid. Any caller paving with a different one got
heads strung out in a dotted line — and could not even express the fix. The
packing rule now lives once, in `bilayer.ts` as `lipidSpacing(geom)`, and every
sampler takes the spacing of the molecule that will pave it.

So, generally: **wherever a routine SAMPLES a path for something else to draw
on, the sampling density is part of that something else, and must travel with
it.** A default is fine; a hard-coded constant that only suits one caller is a
rule that cannot be followed. And when the same routine has a fast path (here, a
resting ring short-circuiting to `ringPoints`), thread the parameter through it
too — otherwise the object changes appearance the moment it stops being still,
which is precisely the bug this exhibit shipped.

## True geometry can still read as a fault — and the register decides (2026-09-09)

*"Membrane gets gaps at exocytosis."* Measured, there was no tear: every gap
away from the fusion was the wall's own molecular spacing. The gaps were the
fusion MOUTH, and the mouth was geometrically exact — a sphere collapsing into a
plane opens a crater, 120 px wide at the half-merge.

**Correct and unreadable are not exclusive.** At the SNARE bench the same
geometry reads perfectly, because one vesicle fills the frame and conserving its
membrane molecule by molecule IS that bench's lesson. On a wide panel where the
wall is a long straight line, an opening that size reads as the line breaking.

So the question is never "is it right?" alone, but **"is the thing it is right
about this view's subject?"** Here the subject is a pool running out; the
membrane's continuity is context that must not distract, so the opening is
capped at a pore and the wall carries on across. There the subject is the fusion
itself, so every molecule is accounted for. One biology, two registers, each
declaring what it gives up.

**And a drawing that stops conserving must stop drawing the conserved thing.**
`omegaRing` unrolls a sunken bubble's molecules along the wall; once the wall
draws its own across that stretch, taking the whole ring would lay the membrane
two deep — at four fifths of a merge, 66 of the ring's 85 molecules. Only the
dome is taken. **A guard hunting for gaps cannot see this**, because too much
ink leaves no hole: it needed a guard that counts.

## Ink drawn UNDER something must go when that something does (2026-09-09)

D18's docking-site mark is a tint on the wall, painted under the wall's
molecules on purpose: seen through them it reads as a denser stretch of
membrane, which is what an active zone is. Then a bubble merges there, the wall
gives up its molecules across that stretch — and the tint is left alone on the
canvas as a bare grey block.

Nothing about either piece was wrong. The fault was in the **dependency**: ink
that is designed to be seen through a layer has no meaning without that layer,
and the layer had a perfectly good reason to leave.

So, whenever something is drawn to be seen THROUGH or UNDER something else, ask
what it looks like when the thing above it is gone — and tie the two together
so they leave and return in the same frame. Here the tie was already available
in the meaning: the mark says "an empty parking space", and a space with a
bubble merging out of it is not empty. **Fixing it at the meaning rather than at
the ink is what makes it come back at the right moment too.**

## An object travels; a CONCENTRATION fades (2026-09-08)

This app forbids fading things into existence, and for a good reason: 21c-14
rewrote the clathrin coat because pinwheels were swelling out of nothing, and a
protein arrives from the cytosol and binds — it does not condense out of the
air. So when D18 needed to show a retrieved vesicle being refilled with
transmitter, the rule appeared to bite.

It does not, and the line is worth drawing. **An OBJECT has a place it came
from, so it must travel.** A protein, a vesicle, an ion: draw the journey.
**A CONCENTRATION does not** — "more of it than there was" is the whole event,
and there is no path to show. When five drawn balls stand for thousands of
molecules being pumped in, the honest picture is the amount going up.

The test: *could you point at where it came from?* If yes, it travels. If the
answer is "from all around, a molecule at a time", it is a concentration, and
fading — or better, appearing one at a time so the reading is a COUNT — is the
truthful idiom rather than a shortcut.

## When the user IS the variable, a second panel is answering nothing (2026-09-08)

D18 spent several rounds hardening a two-terminal comparison against a child who
hammers the button — patterns, refractories, rests — and then the user's own
testing dissolved the problem: *"kids would press the fire button continuously…
that's what the kid already does."*

The insight is sharper than "the burst is redundant". **If the child's own input
already supplies the variable being compared, a second panel is invisible**, not
merely unnecessary: the child cannot perceive that one panel is doing something
their finger is not, so the difference between the panels has no cause they can
see. The comparison was real in the model and unobservable in the room.

So the test to apply before building any A/B exhibit: **can the viewer see what
makes A different from B?** If the difference is a stimulus they themselves are
generating, they cannot — and the honest exhibit is ONE subject with the
viewer's own behaviour as the variable, which is also how the experiment is
really done (same synapse, two rates; not two synapses).

**What replaces the comparison is a prediction.** With one terminal, five
countable bubbles and one message per press, the exhibit says: count them, press
that many times, and the next press is the one that fails. A thing the child can
predict beats a thing they can compare, because it makes them commit first.

**And the input still needs a limit that belongs to the subject, not the hand.**
A refractory — real, and the reason a neuron has one — means hammering asks more
often without making the terminal fire faster. Without it the exhibit measures
the child's wrist.

## A comparison must survive the child (2026-09-07)

D18 put two terminals side by side and let the child tap a shared button. The
user saw the flaw before the guards did: *"kid will fire signal button
continuously… both sides get the same amount of sparks in the end. comparison
idea does not work."*

Measured, it was worse than suspected: from a tap every 800 ms downwards the two
sides were **identical in every column**. Both were throttled by the same
per-message spacing and by the same resupply ceiling, so hammering collapsed
them into the same terminal drawn twice.

**Two things a comparison needs, and the second is easy to forget:**

1. The two sides must differ in something the user cannot flatten.
2. **The user's input must not be able to become the dominant variable.** A free
   button that injects events lets the child's wrist overwrite the very
   parameter being compared.

The fix that generalises: **an input should TRIGGER a behaviour, not inject
one.** Each side turns a tap into its own pattern — count, spacing, and a
refusal to start another until it has rested — so tapping faster asks more
often and changes nothing else. It is also the truer model: what is being
compared is two firing patterns, not two button-press counts, and a real neuron
has a refractory period for exactly this reason.

**Before shipping any comparison, drive it at the extremes** — as slow as a
patient adult and as fast as a child can hit it — and check the difference
survives. Ours did not, and only a measurement said so.

## An unguarded change is a change that may not have happened (2026-09-07)

One of five requested edits in this round silently did not apply: the string it
was meant to replace had drifted, the replace was a no-op, the suite stayed
green, and the feature was reported as done. It surfaced only because a
break-round mutation could not find its own pattern either.

Nothing about the code was wrong. What was missing was a guard: no test asked
where that glow was drawn, so nothing could tell the difference between "moved
it" and "did not move it".

So: **every item on the action list needs an assertion that fails if it was not
done** — before it is reported as done. It is the same reason a break round
exists, one step earlier: a green suite only means the things it asks about are
true.

## When one drawn thing stands for MANY, the rules change with it (2026-09-07)

D18 was asked to make each drawn vesicle represent a large group, so five
bubbles could stand for the whole pool near a patch of wall. That is a drawing
decision with a modelling consequence, and missing it would have been a
scientific error.

**A per-item probability does not survive quantisation.** Release probability is
a property of an individual vesicle — a few tenths — and the model rolled it for
each drawn bubble. Correct while a bubble was a bubble; wrong the moment one
stood for hundreds, because the average of hundreds of coin flips is a steady
share, not a gamble. Drawing it as a dice roll would have overstated the noise
by an order of magnitude, and it was also what made the picture uncountable: two
identical taps gave different answers.

So: **whenever a drawn item is promoted to a stand-in for a group, re-derive
every per-item rule attached to it.** Probabilities become fractions. Discrete
events become rates. "This one either goes or does not" becomes "this much of it
goes". And say in the info block what one drawn thing means, because the child's
arithmetic depends on it — "the last bubble has gone" has to mean "this patch
has spent what it had nearby", not "the synapse is dead".

## Some requests cannot both be met — do the arithmetic and say so (2026-09-07)

D18 was asked for merges that never overlap AND for a strong signal that visibly
exhausts the terminal. They are arithmetically exclusive: a parking space frees
itself partway through a fusion and storage refills it at once, so messages
spaced far enough apart not to overlap always find the row refilled. Simulated
before building: a strong signal sent `1,1,1,1,1` and nothing ever ran out.

The useful move was not to pick one silently, and not to ask an open question
either. It was to **work out the exclusion exactly, quote the simulation, and
put the concrete alternatives with their costs in numbers** — merges overlapping
0.65 s apart, or seven messages instead of five, or the exhaustion moving to the
next tap. The user then supplied a decision RULE rather than a choice ("whatever
makes clearer differentiation between yes and no"), which settled it and would
have settled the next three questions too.

**Ask for the rule, not just the answer.** A user who has told you what they are
optimising for has armed you for every trade that follows.

## A threshold's job is to reject the NEAR MISS (2026-09-07)

D18's gauge has a line on it marked *signal received*, and the first guard for
it asked only that a failed message stayed below the line. A mutation dropping
the line to a quarter of its value survived the whole break round.

The reason is worth keeping: **a total failure produces exactly zero, and every
positive threshold is above zero.** The case a threshold exists to reject is
never the empty one — it is the NEAR MISS: here, the couple of stray balls of a
neighbour's cargo still crossing when a message finds nothing to send. A guard
that only tries the empty case is testing that the number is positive.

So: when a rule turns a continuous reading into a yes/no, find the largest input
that must say *no* and the smallest that must say *yes*, and pin the line
between them — in the constants, so it cannot drift when they change.

## A failure must be drawn, or the exhibit teaches the opposite (2026-09-07)

The sharpest correction this app has had. Asked what conclusion the pools
exhibit was meant to support, the user answered: *"no matter how intense and how
many signals the bouton gets, it manages to pass down the signal"* — the exact
inverse of synaptic depression, which is the whole reason the exhibit exists.

The model was never wrong: 190 messages, 40 vesicles, 84% of messages releasing
nothing. **The failures simply had no ink.** A message that released nothing was
drawn as a flash arriving and then nothing happening — and *nothing happening
reads as nothing to look at*, never as "that one failed". What did have ink was
the successes, which kept coming, and the reserve mobilisation, which looks like
a rescue. A viewer assembles the story from what is drawn, so they assembled the
opposite one.

**The rule: if an exhibit's subject is that something FAILS, the failure needs a
mark of its own.** Absence is not a mark. Ask of every exhibit: what does the
negative case look like, and would a viewer who saw only negative cases know
anything had happened at all?

The fix that generalises is to **draw the consequence, not the mechanism's
absence**. Here that meant giving the gap its far side: the receiving cell,
lighting up by exactly as much transmitter as reaches it. A success is a light,
a weak release is a dim light, and a failure is a flash arriving and the far
side staying dark — which is a *visible event*, not an absence. The negative
case now has ink because the positive case has a place to happen.

Two measurements that shaped it, both worth repeating elsewhere:

- **Check the reading is not saturated.** Scaled against one vesicle, the light
  was full for one bubble and full for three: "a lot got through" and "a little
  did" looked identical. Scale a reading against the MOST that could happen, not
  against a typical case, and check the ends differ.
- **An answer must follow its cause closely enough to be recognised as its
  answer.** The first version lit up 4.4 seconds after the message, because the
  journey was expressed as a fraction of another clock instead of as a real
  crossing. Anything the viewer is meant to read as a consequence must be timed
  in absolute terms against the thing that caused it.

## Stillness is what makes motion readable (2026-09-07)

*"Vesicles are all the time moving around, I am not able to track which are
gone."* Measured: something moving in **100% of frames**, and three or four
objects pushed off the panel entirely.

Both causes were fixes from the round before — a wall that slid to conserve
membrane, and a crowd that closed ranks after every departure. Each was right in
isolation and each added a *global* movement in response to a *local* event.
Together they meant nothing on screen ever stood still, and a picture where
everything moves shows nothing.

The rule: **an event should move what it happens to, and nothing else.** Before
adding a motion, ask how many objects it moves per event and how often the event
fires. One release firing a movement of all thirteen objects, twice a second, is
not an animation — it is noise.

Two corollaries, both of which fell out of this:

- **Conservation inside a frame is a register question.** Making room by pushing
  everything aside is honest when one object fills the picture. In a small
  window on a much larger structure, the real answer is that the disturbance
  dies away long before the frame's edge — so the honest drawing moves nothing,
  and the material is accounted for locally instead (here: the wall simply does
  not draw its own molecules where the vesicle's membrane now is).
- **Gaps are a reading.** Once things stop shuffling, the holes they leave
  become countable, and "how many have gone" is answerable by looking. Closing
  ranks destroys exactly that information while adding motion — it costs twice.

And **a place must be visible for its emptiness to be**: the docking sites are
marked, faintly, so an empty one reads as empty rather than as background.

## Draw what a thing is tied TO (2026-09-07)

*"I don't understand what is that yellow 'rope' that connects vesicles?"* The
ropes ran from bubble to bubble, with one string going off to an anchor point
that was never drawn. "Tied down" cannot read when there is nothing to be tied
to; without its other end a rope is just a line between two things.

**Anything whose meaning is a RELATION must have both ends on the page.** A
tether needs its anchor, a pump needs the gradient it works against, a scaffold
needs to be drawn before anything can be attached to it. Where the other end is
real — here, the actin network a terminal's reserve is genuinely tethered to by
synapsin — draw it, quietly, as furniture; it costs one muted object and turns
an unreadable line into a picture that explains itself.

## Two kinds of motion, and only one of them eases (2026-09-07)

D18's reported teleporting, and the shape of the fix generalises.

Things on screen move for two quite different reasons:

- **A change of PLACE** — it docked, it closed ranks, the reserve came forward.
  This is a journey. It must be eased, or it is a teleport.
- **Being CARRIED** — a bubble stuck to a membrane that is being shoved aside by
  an opening. This is not a journey at all. It must be rigid: the same instant,
  the same amount, no easing.

Easing both makes the carried thing lag the surface it is attached to — and then
jump when something forces them to line up. Easing neither leaves the teleports.
Getting it wrong in either direction was measured at 307–529 px in one frame.

**The mechanism that separates them without special cases.** One function gives
the exact position — seat or schedule, plus whatever the surface is doing under
it — together with a **key naming the rule that produced it**. The animator eases
only the DIFFERENCE between one rule and the next: when the key changes, the
whole discrepancy becomes an offset (which leaves the thing exactly where it
was) and a critically damped spring walks that offset to nothing. Everything
continuous passes through untouched and on time.

It covers discontinuities you have not found yet, which a list of hand-handled
transitions does not: D18 had four, and three of them only appeared under
measurement.

**Use a spring, not a decay.** An exponential decay toward a target is fastest
at the very start — measured, a bubble moved 19.3 px in its first frame and then
crawled, reading as a dart. Critical damping sets off from rest, has no
overshoot, and carries velocity, so a target that moves mid-journey bends the
path instead of restarting it.

**And a teleport does not scale with the frame.** Real motion covers twice the
ground in twice the time; a jump is the same size however often you look. Walk
the run at two framerates and require the worst movement to roughly double — a
guard that needs no magic number for "how far is too far", and that no absolute
threshold can fake.

## Slowing an animation is a CHAIN, not a number (2026-09-07)

"Make the animation much slower" looked like one constant. It was four, in a
strict order, and the order is what the guards now pin:

    FUSE_MS  <  CARGO_MS  <=  RECOVER_MS

A bubble's cargo has to outlast the fusion that let it out, or the balls vanish
before they have been seen leaving. A bubble must not rejoin the crowd while its
own cargo is still falling down the gap, or both teleport. So the later constants
are **derived** from the earlier ones rather than typed, and slowing the first
one carries the rest with it.

**And the slower drawing charged the model rent.** A fusion holds its parking
space, so three spaces at three seconds each cap a terminal at one release a
second — below what the exhibit needs. The sweep's cheapest answer was to raise
the release probability, which would have been *bending the biology to protect
the demonstration*: the thing *never quietly protect the story* exists to stop.

The two levers that paid instead were both **artifacts of the drawing, not
facts about the cell**:

- **The occupancy was fictional.** A real fusion clears its site in about a
  millisecond; the seconds this exhibit spends on one are demonstration. What
  the picture actually needs is only that a fresh vesicle is not painted over
  one still standing proud of the wall — which the geometry dates precisely
  (p = 0.812). So the space frees itself at 0.85, and a guard MEASURES the
  clearance rather than trusting the number.
- **A count was understated.** Four docked spaces instead of three cost no
  drawing (the widest rank was already four) and moved *toward* the biology, not
  away: a real readily-releasable pool runs to five or ten.

They paid well enough that the release probability came **down**, 0.55 → 0.50.

The rule: **when a pacing change starves the model, look first for the constants
that are artifacts of the drawing.** They are free to move. The ones that
describe the cell are not — and if only those are left, say so and put the
trade to the user rather than nudging them.

## A stronger signal is MORE, never BIGGER (2026-09-06)

The user asked for "a small flash of light" against "a big flash of light" to
tell one message from a burst. That reads instantly, and it teaches something
false: an action potential is **all-or-none**, every spike the same size, which
the spike-train bench already teaches. A burst is more spikes.

Raised as a conflict rather than resolved (the standing rule), and the user took
the honest option: five identical flashes, arriving as a train a child can
count. It is also the better picture — five things in one glance beats a
brightness a child has nothing to compare against.

Generally: **when a quantity in the biology is a rate or a count, draw a rate or
a count.** Reaching for size or brightness to encode it is how an exhibit ends
up teaching that a big stimulus makes a big spike.

**And the count a child reads comes from the model.** D18's burst icon is
`'⚡'.repeat(BURST_N)` — so the bolts in the headline, the bolts on the button
and the flashes on the canvas cannot drift apart. A hand-typed "⚡⚡⚡⚡⚡"
is a fourth copy of a number that already exists.



## Measure the claim where the CHILD reads it (2026-09-06)

D18's whole claim is "the burst terminal runs dry and the gentle one keeps up".
The first guard measured it on the leftover docked count — and failed with the
two terminals **inverted**: the hammered terminal held 4 parked vesicles and the
gentle one 2.

The model was right. A hammered terminal **mobilises its reserve**, so late in a
run it genuinely holds more parked bubbles than a gentle one — which is real
biology (it is why hard use can strengthen a synapse for a moment, and it is in
the info block). The internal count was simply not the claim.

What the child sees is the **puff in the gap**. Re-measured there: the burst
terminal fails 0.67 of its messages against the gentle one's 0.33, and releases
0.45 per message against 1.00 — a difference that reads on screen, and the one
the exhibit is actually making.

This is *Ask the DECISION, not the ink* pointed at the model rather than the
drawing: pick the quantity the exhibit's sentence is about. A guard on a nearby
internal number can be perfectly true, perfectly green, and about something
else — or, as here, true and pointing the wrong way.

## A fade must be a property of the surface, not of the ink (2026-08-31)

Canvas `globalAlpha` is **set, not multiplied.** A drawing that assigns its own
alpha wipes whatever a caller put there — and `drawScene` assigns it in eighteen
places, one for every part of the cell that fades on its own.

So `layer.opacity()` did nothing for the scene: Konva applies a node's opacity by
setting `globalAlpha` before calling its `sceneFunc`, and the first assignment
inside threw it away. The whole-cell axon went on standing at full strength
behind the two views that replace it, at any camera distance. **A ghost that no
test could see, because no test could ask "how bright was the ink".**

Two rules come out of it:

- **Composite the LAYER, not its contents.** The scene now fades by setting the
  CSS opacity of its own canvas element, so nothing a drawing does to
  `globalAlpha` can escape it — and it is the honest semantic: *the scene gives
  way* is one thing happening to one picture. An invisible layer also stops
  listening, so a faded-out cell is not still clickable underneath.
- **Inside a drawing, `globalAlpha` is multiplied, never assigned.** A view that
  takes a `fade` has to honour it all the way down. `strictCanvas` records the
  alpha in force at every ink-laying call (`alphas`), so this is now a testable
  question rather than a discipline: *did anything paint brighter than the fade
  it was handed?*

And a third, about the stand-in itself: its `save`/`restore` tracked the
transform and nothing else, so a colour or alpha set inside a save block was
still readable afterwards. **It was more forgiving than a browser, which is the
direction that hides faults.** It restores the drawing state now, and two tests
that had been reading colours off the context afterwards were rewritten to read
`styles` — the colours actually laid down.

## The menu lists what is planned, marked as planned (2026-08-31)

⚠ **This reverses an earlier rule of `core/contents.ts`**, which said the menu
lists only what exists, "because a menu of greyed-out promises teaches that the
app is mostly empty, and it would be a second place where a claim about what the
app contains could rot". The user asked for the overview and that is theirs to
decide; the reasoning is answered rather than discarded:

- A planned row is visibly a different kind of thing — dim, tagged `planned`,
  and **inert by construction**: its `to` is `null`, so there is nothing for a
  stray click to do. A greyed-out button that still navigates is the worst of
  both.
- A planned row claims what the **spec** contains, not what the app contains.
  `FRONTIER` is still the single source of *how far this app goes*, and a Part
  with nothing built still says so, above its planned rows rather than instead
  of them.
- Tests keep the two apart: nothing may be listed as planned that is also
  reachable, planned ⇔ no destination, every planned row carries its spec ID,
  and `inCourseOrder()` — which other code audits doors against — still returns
  only rows a child can reach.

They are held to the same rules as a built row: an icon for the kid, a name for
the adult, a question either can be asked. And they **interleave by lecture**
rather than sitting in a block at the bottom, so a Part reads as one list of what
it will contain.

## A view about distance carries the axon views' ruler (2026-08-31)

Every axon view puts a scale on its floor. D05 — the one exhibit whose entire
subject is *how far* — had none, so λ was a dashed line at a place with no name,
and the user read that as λ being in the wrong place. It was not: measured, the
bare fibre holds exactly 1/e of its push at the mark. **A correct marker on an
unlabelled axis is still unreadable**, which is the same failure as *a right
model can still be an unreadable view*.

`drawScaleRuler` is now shared out of `axonRibbon`: the caller owns the marks and
where they fall (this axon's are squashed by `alongCable`; D05's are linear), the
ruler owns how a ruler looks.

## Clocks belong to events, not to renders

Every animation clock must be owned by the thing it is timing.

- **Once per run, not once per phase.** The miniature's chain sweep was keyed on the
  chain's phase, and the phase changes three times while the signal is on its way out
  (axon → terminal → target). Each change tore the effect down and rebuilt it with a
  fresh start time, so the little axon fired **three times for one action potential**.
  Arm it on the event, remember it by run id, and keep the frame handle in a ref so
  the sweep survives the re-renders that used to kill it.
- **A miniature must not inherit a demo's pacing.** The map followed the membrane
  demo's own position — and that demo deliberately *stops* at each gate moment so a
  child can read what opened. So the little axon crawled and halted half a dozen
  times on its way past: a true picture of the demo's pacing and a false picture of
  the neuron, which a spike crosses in a seventh of a millisecond, stopping nowhere.
  The map runs at its own speed and pauses in exactly one place — the ring — which is
  honest about a different thing: *the pause is not the signal waiting, it is us
  waiting, at the spot we chose to look at.*
- **On a legged clock, a flourish's duration is a SCREEN fact — size it in screen
  ms, never model ms.** The synapse's arrival afterglow was set to "10 model ms"
  (2026-09-02); the legged clock crawls through the early legs, so those 10 ms hung
  on screen for ~13 real seconds — while the postsynaptic flash's *same* 10 model
  ms, playing in a fast leg, lasted ~2 s. Anything whose length is chosen for the
  eye (a fade, a pulse, an afterglow) must be defined on the screen clock — via the
  clock's inverse (`screenOfModel`), so it stays a pure function of position and
  scrubbing replays it. Model-ms durations are only for things the model itself
  dates. And when guarding such a budget, **pin the absolute number**: a guard that
  samples at fractions of the constant passes at any length (measured — 13 s
  slipped through one).

## A run's clock follows the interest, not the model's even time

If a step's payload occupies a small fraction of its window, a flat rate spends
almost all the watching time on the least interesting part. The terminal's whole
event — release, crossing, binding — lives in about four milliseconds of a sixty
millisecond run, and at a flat rate the transmitter was on screen for half a second
one second after pressing, followed by twenty seconds of calcium draining. It was
reported as *"no transmitter is displayed"*, which is exactly what it amounted to.

Split the window into **legs**, each with its own share of screen time
(`SYNAPSE_LEGS`), and give the payload most of it.

**Slow the leg, never the item.** The transmitter transient is not stretched
relative to what surrounds it; it is genuinely the briefest thing on the page and it
still looks the briefest. Slowing a whole leg keeps every duration in proportion to
every other, which is what keeps the picture honest about timing.

**Check it by walking the clock in a test** and reporting when each model moment
lands on screen. A pacing bug is invisible to every other kind of test.

**Every transport that can reach an end needs a control that says start over**, and
it must say so. At the end of the terminal's run, ▶ did nothing — resuming a run
already at its last frame advances it to its last frame — so it now offers
**↺ Fire again**.

## Model patterns

**Integrate once into a table indexed by position; then be a pure function of it.**
This is what makes pause, scrub and memoisation possible at all — there is no
accumulated state to rewind, only a number to set. Every run in the app follows it:
`trajectory`, `fibreRun`, `synapseRun`.

**The exception, and its price.** The spike-train bench cannot tabulate in advance,
because the pushes arrive when a child presses them. It carries the same four
numbers forward with the same rate constants imported from the same module — so the
refractory period is not implemented anywhere: sodium's `h` gate is simply still shut.

**Randomness must be seeded, never random.** Release is genuinely probabilistic and a
terminal that emptied its pool every time would teach the opposite. `Math.random`
would break pausing, scrubbing and memoisation at once, so each vesicle draws from a
**hash of its index**: the same run always plays the same way, and the five behave
like five independent draws.

**Accumulate a hazard, do not fire a cue.** Vesicle fusion times fall out of an
integrated rate — an inhomogeneous Poisson process, which is what release is — rather
than being triggered at a chosen moment.

**Carry fractional time.** `trainAdvance` keeps a `debtMs` so a 60 Hz tab and a 144 Hz
tab run identical physics. Clamp the frame at the **caller**, which is the only place
that knows about real time: clamping inside a function whose argument is *model* ms
silently refused to advance and made every gap in an experiment produce the same
result.

## Drawing a scene: plan the anatomy before the picture

The synapse view had to be rebuilt because it was drawn as a *layout* — a top, a
middle and a bottom — before anyone had asked where the parts of a real terminal
actually are. Five of the seven faults reported against it were anatomical, not
aesthetic. The check that would have caught them all:

**For every structure on the page, ask: is this where it really is, is it made of
what it is really made of, and is the reader looking at it from a plausible
direction?**

Three specific traps it fell into, all worth naming because they generalise:

- **Do not invent a surface that is off the page.** The terminal was given a "roof"
  to hold its calcium channels. A bouton is about a micrometre across; at this
  magnification its far wall is off the top of the frame. Drawing it invented a
  surface, and then put machinery in it. A cell that continues past the edge of the
  picture should **fade out at the edge**, which is both honest and easy.
- **Machinery that works together must be drawn together.** The calcium doors were
  on the opposite wall from the vesicles — which contradicted this app's own model,
  where the sensor reads a microdomain *at the mouth of a channel*. If two parts of a
  model are coupled by proximity, the drawing must show them as neighbours or it is
  arguing against itself.
- **Draw what a thing is made of when that is the point.** A vesicle drawn as a
  circle is a bubble on a wall. Drawn as a **bilayer sphere** it is obvious why it
  can fuse: two bilayers can become one bilayer, which a bag of anything else could
  not do. The most important fact about an object is often its material.

**Orient the camera to the structure.** In the scene this synapse lies along the x
axis, so its real cleft is vertical — but every textbook draws a cleft horizontally,
and so does this view. Without a `turn` on the zoom target the camera flew in on a
vertical wall and landed on a horizontal one: ninety degrees of unexplained rotation
at the exact moment a child is working out what they are looking at. The camera
performs the turn itself, visibly, on the way in.

**A membrane is a liquid, not a ruled line.** Views that draw a membrane along a
path get its wander for free; views that draw a horizontal run must add it
(`waveAt` / `slopeAt` on `LipidRun`), and the two walls of a gap should not be
parallel. Molecules stand square to the surface, not bolt upright on a slope.

**Make the model's hidden states visible where you can.** Desensitization was a
number in a describer and nothing on the canvas. With three receptors drawn, each
standing for a third of the population, one of them can be shown *shut while still
holding its transmitter* — and the fact stops being a curiosity. Allocate such states
by **threshold, not rounding**, so a drawn item does not flicker as a fraction
wobbles across a boundary.

## A test stand-in must fail where the real thing fails

The permissive canvas mock used in these tests accepted everything, and that is
precisely why it could not catch the bug it existed to catch.

`mix` read hexadecimal colours only — slicing characters and calling `parseInt` —
and handed back `rgb(NaN, NaN, NaN)` for anything else. That survived unnoticed for a
long time because its result only ever became a `fillStyle`, and **an unparseable
fillStyle is silently ignored by the spec**. The first time such a string reached
`addColorStop`, which *throws* on a colour it cannot parse, it took down the scene
function — and the scene function took the **Konva animation** down with it. The
symptoms were a frozen camera, a blank view and a dead button, none of which points
anywhere near a colour parser.

`strictCanvas()` checks the two things a browser checks and a noop cannot:

- **every colour** given to `addColorStop`, `fillStyle` or `strokeStyle` parses;
- **no radius or coordinate** is negative or non-finite. A NaN coordinate does not
  throw in a browser — it silently draws nothing, which is the hardest kind of blank
  screen to diagnose.

Two rules from this:

> **Silent NaN is the fault, not the throw.** A function that can return a malformed
> value will eventually be handed to something strict. Pin "never returns NaN" with a
> test rather than relying on every consumer being forgiving.

> **After writing a regression test, break the code again and watch it fail.** A test
> that passes on the bug is worse than no test, because it is believed.
>
> This is not a formality, and it caught one the same day it was reread
> (2026-08-30). The bilayer had a bare hole beside two channels because the gap
> was cut to their fully-OPEN width. The first test looked at the picture —
> were there lipid vertices in the band that used to be bare? — and **passed
> with the bug put back**, because the band was wide enough to catch the first
> molecule beyond the too-wide gap. The fault was in *which number gets cut*, so
> the number was exported (`wallGapAt`) and pinned directly. Corollary:
> **when a bug is a wrong value, test the value.** A test that only looks at the
> downstream picture is measuring through too much machinery to be sharp.

And one about what the stand-in has to *record*, not just reject:

> **A list of method names cannot tell you whether something moved or jumped.**
> Several of this app's drawings come from sources that give a moving part
> twice, in its two end positions — and two end positions are not an animation.
> The only test that catches a swap is one that compares where the ink actually
> landed from one frame to the next, so `strictCanvas` records every path
> vertex (`points`). **In DEVICE coordinates**, because a part that moves by
> having the whole context translated under it looks perfectly still in its own
> local frame (2026-08-30).
>
> It also records every string the canvas WRITES (`texts`). This app has more
> rules about what a canvas may say than about almost anything else — it
> carries names and readings on a scale and no explanation, and if the canvas
> says it the column must not repeat it — and none of them could be tested,
> because a list of method names does not include the words (2026-08-30).

> **⚠ AND A TEST ON THE SHARED RULE DOES NOT REACH A COPY THAT IGNORES IT.**
> When "ions crossing a channel" existed twice and only one copy was fixed, the
> user reported the demo "looks exactly as before" — and the new tests were all
> green, because they measured the rule rather than the callers. Where the
> failure is structural (somebody writing the number down again), **the guard
> has to be structural too**: no file outside the owner may set that value to a
> literal, and the other caller must be seen asking (2026-08-30).
>
> **⚠ AND THAT STILL WAS NOT ENOUGH — FOUR GUARDS IN A ROW MISSED THE SAME BUG.**
> Each fed the shared rule a value by hand and asserted on the answer. The rule
> was never wrong; what the CALLER handed it was, and no test went through a
> caller. The habit that works: **when a decision lives at a call site, make the
> call site a named function and test that function** — `drawSceneChannel`,
> `ionsInPore`. If a test can be written without touching the code path the user
> is looking at, it is not a guard for what the user is looking at (2026-08-30).

And one about duplication: `mix` existed **twice**, privately, in two drawing
modules. One copy was fixed. A second copy of a fixed bug is a bug that comes back,
so the duplicate was deleted rather than repaired.

## Scientific honesty rules

**Measure, never assert.** Every number in a describer is read off the model at the
moment it is shown. When the two scales of an event have to agree, *measure the
agreement* — and keep the disagreement, because it is usually the mechanism:

> One patch alone peaks at +59.2 mV; a patch mid-axon at +58.7. A test pins the gap
> below 2 mV **and a second test pins it above zero** — a patch in a cable loses a
> little current sideways to its neighbours, and that leak is exactly what wakes the
> next patch. The discrepancy between the scales *is* what joins them.

**A result that does not change when the input changes is a broken parameter.** Two
bugs were caught this way and by nothing else: the unit-confused clamp, and the ohmic
calcium current.

**Use the right constitutive law, not the familiar one.** Sodium and potassium use
Hodgkin and Huxley's ohmic form `g·(V − E)`, which is good when a gradient is
ten-to-one and the I–V curve is nearly straight. Calcium's is twenty *thousand* to
one: nearly every ion crossing came from outside, so the current follows the outside
concentration almost proportionally while the Nernst voltage follows only its
logarithm. Quartering external calcium — the experiment the fourth power was
discovered with — changed the current by **13%**. Goldman–Hodgkin–Katz is the
standard treatment and is what `ghkCa` uses.

**Say which numbers are calibrated.** `HILL_K_UM` is set so one action potential
releases about the measured fraction of the pool; the *shape* of the curve is Dodge
and Rahamimoff's and is not adjustable. Said out loud in the source rather than
buried.

**Say which numbers are not drawn.** The ion piles are one ball per millimole, and
free calcium inside a cell is 0.0001 mM — ten thousand times below the smallest thing
that scheme can draw. The terminal uses calcium's real interior figure and the
describer says so. The **outside** pile stays real and movable, which is what makes
the low-calcium experiment work.

**Declare every exaggeration in the same breath as the real number.** The cleft is
20 nm and is drawn about ten times too wide; `synapseScaleNote` states both.

**Never quietly protect the story.** When honest physics does something inconvenient
— weak pushes summating and firing the cell — say so in the describer and pin it with
a test. A model tidied to keep a sentence true is teaching a tidier cell than the
real one.

**A claim about what the app contains rots.** The tour's closing paragraph said the
synapse was not built; it was true when written and false the moment the terminal
landed. Two tests now enforce both halves of that sentence.

## Real photographs: the source rules (2026-08-27, from `core/realPhotos.ts`)

Everything else in this app is drawn; the "real thing" blocks are not, and a
photograph in a science app for children is a factual claim. The rules, all
enforced by tests rather than remembered:

1. **Trusted origins only** — Wikimedia Commons and catalogued institutional
   collections (`TRUSTED_ORIGINS`): places where every file has a provenance
   page someone can check and a community or curator who corrects it. Never a
   photo-sharing site: a first pass took two images from one, where the licence
   was fine and the provenance was a stranger's caption — both were replaced.
   The `source` link must point into the origin it claims.
2. **CC0 or CC BY only**, version stated. Prefer real micrographs; a
   licence-free official *visualization* is the fallback only where no real
   photograph exists at these licences — and it must then be captioned as a
   drawing, never shown in a "real thing" block.
3. **Credit, licence and link printed beside every image, every time** — not
   in a credits screen.
4. **Say what kind of image it is** (electron micrograph, fluorescence, …):
   grey is the microscope's doing, colours are the dye's, and neither is "what
   it looks like".
5. **A photograph must be OF something on screen right now** — the block's
   contents change with the view, or the block is absent. A gallery bolted to
   the side of a simulation teaches nothing.
6. Images are **normalized to ~900 px JPEG local copies** in `public/real/`
   (no hotlinking), and a test pins that every manifest entry has a file and
   every file an entry.
7. **Every view should ideally carry a real-photo block** (2026-08-27): a
   place or structure on screen should get to meet its photograph, sized
   generously in the sibling app's proportions (images h-36 to h-44, inline in
   the info column, never thumbnails). The exception is a view whose concept
   is genuinely abstract, with nothing a camera could point at — a spike-train
   graph, an equilibrium bench. "No good free image found yet" is a to-do;
   "nothing to photograph" is a decision, and each step's record says which
   one it is.

## When a view is judged unreadable

Green tests say the physics is sound. They say nothing about whether a child can read
the picture, and most of what goes wrong here is in the picture.

**Rebuild the view; do not defend it with the model behind it.** Two exhibits were
removed on this ground and both came back better as graphs:

- a *weak stimulus* on the membrane patch, which was correct in every respect — but
  the patch's whole vocabulary is doors opening and crowds moving, so a push that
  fails had nothing to draw, and "not enough" looked identical to "broken";
- a *paired-pulse slider*, which asked a child to compare two runs from memory using
  a gap in milliseconds they have no feel for, on a view that only ever draws one
  instant.

Both failures are the same failure: **the refractory period is a fact about a
sequence, and a picture of a moment is the wrong instrument for it however good the
model behind it is.** A graph does not have that problem — a flat stretch after a
press is drawn in the same ink as a spike, on the same axis, with the press marked
underneath.

## Where a concept lives: place or drawer (2026-08-27)

Extends *The scene is the world; a drawer is thinking about the world* with the
placement law the replan adopted, so that every new feature has exactly one
possible home:

- **A part of the neuron is a place**, reached by zooming to where it is on the
  cell — never a page, never a menu entry that swaps what the canvas claims to be.
- **A drawer knows which view it extends.** Every drawer used to hang off the
  membrane patch, so "all the drawers" and "this patch's drawers" were the same
  set and the patch's shelf could simply list them all. D06 extends the
  **synapse**, so a `home` on the exhibit says which view's chrome it belongs
  to, and the shelf claims only its own (2026-08-31). A shelf that advertises a
  door onto a view the child is not looking at is a dead button.
- **An abstract concept is a drawer** — graphs of speed or quantity, structure
  exhibits, lab benches — and it is **triggered from the view it extends**, not
  from a global menu.

  ⚠ **"Comparisons" used to be on that list and has come off it (2026-08-31).**
  The rule was already out of step with the app: *Axonal conduction & myelin*
  compares a bare fibre with a wrapped one and has always been a place, because
  what it compares are two stretches of cable. *Passive spread* was built as a
  drawer on the strength of the written word and was moved out again on the
  user's instruction. **What decides is what the exhibit is OF, not how many of
  them it shows.** Two of a thing that is a place is still a place; a comparison
  of quantities with nowhere to stand — speeds, populations — is still a drawer. The bilayer-structure drawer opens
  from the membrane view; the SNARE drawer from the synapse view. A drawer
  button is chrome of the view whose subject it deepens, so the child's mental
  map stays spatial even for non-spatial content.
- A larger biological process that is a place is split into **legs** (the
  synapse journey: the round trip, then receptors→hillock), each with its own
  transport control and hand-over, rather than one long run nobody can hold.
  ⚠ **A leg is a unit of what the child can hold, not a fixed count.** The third
  leg — clearance & recycling — stopped being a leg on 2026-09-06: leg 1 grew to
  run the whole glutamate–glutamine loop and close on its own opening frame, so
  what was left of leg 3 is a DRAWER over that view, filed beside the SNARE
  bench. When a leg's ending moves, its NAME moves with it: "arrival to binding"
  became "the round trip" the same day, because a row that promises an ending
  the run no longer has is a claim about the app that has rotted.

## A structure exhibit keeps its schematic as a ghost

On the **scene**, level of detail dissolves and the two representations are
never both on screen (*Level of detail must dissolve, never switch*). A
**drawer structure exhibit** is the deliberate, scoped exception, because its
job is different: it explains what the scene's symbol stands for, and a symbol
cannot be explained after it has been dissolved away.

- The scene's symbolic drawing — the gate-shaped channel, the bilayer-ring
  vesicle — stays behind or beside the detailed structure as a **ghost**:
  dimmed, same silhouette, unmistakably the same object. The child must be able
  to answer "so THAT shape was THIS" without a caption.
- Every exhibit showing a part of something carries a **locator**: a small
  thumbnail of the parent structure with one dashed ring on the part shown —
  the whole-cell miniature's grammar, one level down. When the exhibit zooms
  further (channel side view → selectivity filter), the ring moves with it. A
  child is never dropped somewhere without being shown where they landed.
- The two rules do not conflict because they answer different questions: the
  scene's dissolve says *magnification is continuous*; the drawer's ghost says
  *this is the same object you were just looking at*. A drawer never claims to
  be the scene, so continuity of magnification is not at stake there.

## One biology, one drawing

A structure must look the same everywhere it appears at a given scale, and the
only way that stays true is one code path:

- The bilayer — in the membrane view, wrapped round a vesicle, in the D01
  drawer — is always drawn by the same module (`stage/bilayer.ts` /
  `LipidRun`). A vesicle *is* a ring of that bilayer; that it is the same
  material is the reason it can fuse at all.
- Channels, pumps and receptors reuse their scene drawings (or ghosts of them)
  in every drawer that discusses them.
- Never a second private drawing of a thing that already has one — the copies
  drift, exactly as two private copies of a helper do.

The shared palette is part of the same contract: red/blue only for charge,
gold flash for the action potential, pale slate for chemical messengers —
in drawers as on the scene.

Per-exhibit drawing specs live in
[05-visual-language.md](05-visual-language.md). There is **one visual language
at every level of detail**: a miniature, ghost or drawer figure may reduce
detail, never switch style (ruled by the user 2026-08-27, replacing a
short-lived "schematic register" that had been invented to accommodate a
textbook-flat reference). An incoming reference is reconciled there in
writing — and any conflict with a standing rule is put to the user as explicit
questions **before** the spec is written, never resolved silently.

## An opening is sized off the SHEET, not off what must pass through it (2026-09-11)

> "membrane gets gaps at exocytosis" — user, 2026-09-09
> "there's still no seamless merge, gaps appear. fix" — user, 2026-09-11

The same complaint twice, and the first fix was real. A vesicle sinking into a
flat wall geometrically opens a **crater** — measured on D18, 45 px a quarter of
the way through a merge and **120 px at the half**. Capping that to a pore and
letting the wall carry its own molecules across the rest took the worst opening
down to 25 px. The membrane was continuous everywhere a probe could walk it: the
worst hole on the wall line or on the merging bubble's dome was **3.9 px**.

And the child still saw a gap, because **25 px was being judged against the
wrong number**. The cap had been sized off the thing that has to get out —
`cargoR * 1.3`, a pore wide enough to pass a transmitter ball whole. But nobody
looks at a hole and thinks "is that wide enough for the cargo". They look at it
against **the wall it is in**, and in that wall neighbouring lipid heads sit
**0.11 px apart**. A 25 px opening is 230× a normal gap and five missing
molecules. Of course it reads as a break.

**So size the opening off the material, not off the payload.** The wall now
stands aside by **half its own packing pitch**, which removes exactly the one
head nearest the site. Measured per leaflet, the clear span goes **25.4 px →
4.8 px** — one molecule's step — and because the two leaflets are staggered the
sheet as a whole never opens past **2.3 px**.

The payload is then wider than the hole it leaves by, and that is the right way
round: a real fusion pore is 1–2 nm against a 40 nm vesicle, so the drawing's
sin was always the cargo's size and never the pore's. It is declared beside the
real number in the info block, as every exaggeration here is.

### Measuring it

Three things this cost, all of them guard-shaped:

- **Measure a gap as a CLEAR SPAN, and in ONE leaflet.** Centre-to-centre
  distance is not what an eye sees — subtract the two heads. And a bilayer's two
  rows are staggered, so a hole in one leaflet is filled, in projection, by the
  other's heads: measuring the band as a whole reported 2.3 px where the leaflet
  that actually had the hole was open by 4.8 px. Collapsing the two hid the very
  thing being measured.
- **Bound it against the packing.** "Less than `G.r * 0.6`" is a number with no
  meaning in it. `one molecule missing` is `2 x pitch - 2 x headR`; `two missing`
  is `3 x pitch - 2 x headR`, half again as wide. A bound between them says what
  it is guarding, and fails the moment a second molecule goes.
- **Walk every leg that opens the wall.** Exocytosis and endocytosis both open
  it, and the *bud* was the worse of the two (25.4 px against 20.9). A guard that
  walked only the merge would have gone green while the picture was still broken
  where the child watches a new bubble being made. Breaking the fix confirmed it:
  the worst point reported was at 0.35 **of a bud**.

### And the older lesson underneath

The first round's reasoning still stands and is not superseded: a crater is the
*true* geometry, and at the SNARE bench — one vesicle filling the frame, where
conserving its membrane molecule by molecule IS the lesson — it reads as an
opening and is drawn. On a wide panel with a long straight wall it reads as a
break. **The register decides**, and what D18 gives up is the other bench's
material conservation, which is that bench's lesson and not this one's.

## Ink a guard cannot see is a claim you cannot make (2026-09-11, D07)

Two guards on D07 went green while measuring nothing, for two different
reasons, and both are traps any future exhibit can walk into.

### `fillRect` lays no vertices

`strictCanvas` records **path vertices** — `moveTo`, `lineTo`, `rect`, `arc` and
the curves. `fillRect` and `strokeRect` are ink-laying calls, so they reach
`alphas` and `inks`, but they put **nothing in `points`**. A wash painted with
`fillRect` is therefore in the picture and invisible to every positional guard:
the test asking "is the negative wash painted on the INSIDE of the cell?" found
no marks below the membrane at all and could only fail with `undefined`, never
with a wrong answer. The bar under each panel was the same — three `fillRect`s,
zero points, a guard that could not tell a bar from no bar.

**So draw a rectangle you intend to make claims about as a path** —
`beginPath`, `rect`, `fill`. It is the same pixels and it is measurable. Where
a `fillRect` really is decoration, leave it, but then do not pretend a guard
covers it.

### Isolate a measurement by DIFFERENCE, not by picking the most X

The second failure was subtler. The guard for "the inside reads blue while the
magnesium blocks" pulled every colour the panel laid down and took the one
leaning furthest to blue. It passed, and it was reading a **lipid**: this app's
slate is `148, 163, 184`, which leans blue by 36, and at a mild depolarisation
the wash's own tint is weaker than that. The guard was true, green, and pointed
at the wrong object — the *Measure the claim where the CHILD reads it* failure
in its purest form, one level further in.

The fix is not a better heuristic. **Change only the variable under test and
diff the two renders.** Every colour that differs between a panel at −70 mV and
the same panel at +20 mV belongs to the wash, because nothing else in the frame
depends on the voltage. No filter, no ranking, no way for a lipid to creep in.
The same shape works for any "does X respond to Y?" claim on a busy canvas.

## One number, one picture — or they will disagree (2026-09-11, D07)

> "at −15 mV … the Mg block lifts up, but after the channel opens it 'falls'
> back to the top of the channels, covering the entrance. Yet, the ions pass
> through this channel. Fix this inconsistency." — user

Two drawings in one frame were both showing the magnesium block. The stone drew
it as a **depth** — how far down the pore it sat, scaled by how far the pore had
opened. The seven travelling ions drew it as a **count** — a seeded coin per
crossing, against the same fraction. Each was defensible alone. Together they
contradicted each other in front of the child: a stone parked over the doorway
while ions streamed past it.

**A fraction may be spent once.** When one drawn thing stands for many, the rule
is already written here — a probability becomes a fraction of something
countable — and the mistake was applying it to the ions and not to the stone. A
single stone has only its own TIME to spend, so a 47% block is a stone in its
seat 47% of the time, flickering in and out. Which is also what magnesium really
does, far faster than an eye can follow.

Then the ions stopped rolling their own coin and started **asking the stone**:
a traveller gets in exactly when the stone was out as it arrived. One decision,
two views of it, no way to disagree.

### The aggregate is not the claim

The first guard written for this compared the share of ions that get in against
the share of time the stone is out of its seat. **Both drawings passed it** —
the old one and the new one — because the disagreement was never in the rate.
Both renderings produce the same rate; they differed instant by instant, which
is the only place a viewer ever looks.

So the guard had to be per-traveller: each ion's decision against the stone **at
the moment that ion reached the mouth**, which meant the drawing had to hand
back when that moment was. And the companion guard — "it never parks in the
doorway" — had to be measured as the **share of time spent part-way** between
its two places, because that is the only measurement that tells a stone which is
travelling from a stone which has stopped. The old drawing scores 100% at any
middling voltage; the new one at most a tenth.

Both were caught only by the break round. Written and passing, neither could
fail: one band was 8.8 px wide against a fault that parked the stone 17 px in,
and the other was asking about averages. **A guard you have not broken is a
guess** — and this was two of them in one commit.

## A wobble is a FRACTION of what wobbles (2026-09-11, the bilayer)

> "the lipids layer keeps looking very uneven: lipids are grouped, overlapping
> on z-direction. Unify height" — user

`lipidJiggle`'s amplitude was an absolute **0.9 px**, tuned by eye in the lipid
lab where a head is 2.84 px across the radius — a wander of **0.32 head radii**,
which reads as a liquid. The synapse view paves its walls with the same molecule
at a third the size, and there the same 0.9 px is **0.9 head radii**. Measured:
**1.2 head radii of scatter across the wall** and **0.68 of the packing pitch
along it**, so heads climbed over each other and the row lost its line.

**This app draws at magnifications thousands apart, so a part's size is a
fraction of the thing it belongs to and never a number of pixels.** It is the
same lesson the charge badges cost once already (`BADGE_FRACTION`, and a
`BADGE_MIN_SCREEN_PX` that callers must convert themselves). Motion is a part
too: an amplitude tuned in one view is a different motion in every other.

The fractions were calibrated so the view they were tuned in comes out
byte-identical — which is what makes such a fix safe to make at all, and is
worth a guard of its own.

### Guard the WIRING, not just the rule

The first guard called `lipidJiggle` directly at three scales and required the
same fraction. It passed — and it went on passing when the paver stopped handing
`geom.headR` down at all, because the guard never went through the paver. A rule
can be right in the one place a test looks and unused everywhere the drawing
actually happens.

So the second guard paves a straight wall at two molecule sizes and measures the
**drawn scatter** in head radii off the canvas. It fails the moment the size
stops being passed: 2.71 head radii against 1.78.

## Two views of one law are aligned by their RANGES, not by their drawings (2026-09-13)

> "'the block lifts, it never opens' — this is not what you have displayed in
> 'AMPA & NMDA receptors' drawer. Align across visualisations." — user

The drawer shows the magnesium coming out of the channel. The spine says it
never does. Both are drawn by the same two functions, and at any given voltage
they give the same answer to the pixel.

**What differs is not the drawing, it is how far each view can GO.** The drawer
has a dial that reaches +20 mV, where the block is 9% and the stone is out nine
times in ten. A spine driven only by its own catchers tops out at −16.4, where
it is still in the way more than half the time.

So the alignment is not a change to either picture — it is **saying where one
ends and the other begins, on the control the child is actually touching**. A
dashed mark on the dial at the spine's ceiling, and a line in each view's notes
pointing at the other. Past the mark the child is doing what other synapses, or
the cell's own back-propagating spike, would have to do — which is the fact the
whole exhibit is built on, not a discrepancy to be smoothed away.

⚠ And the number on the mark is MEASURED from the other view's model, with a
guard that runs a long burst and requires it to land there. A stated ceiling
that nothing checks is a caption, not an alignment.

## A moment is where the INK crosses, not where the tag turns over (2026-09-13)

> "redness still is happening too late. Expected start: 15.1 ms." — user

Two separate reasons the answer was late, and both were in how the moment was
being FOUND rather than in anything drawn.

**The probe's own sampling.** A 240-step sweep of the run steps 63 ms of screen
at a time, which is a quarter of a model millisecond where this falls — so it
returned the first SAMPLE after the crossing rather than the crossing, and
landed at 15.35 against a true 14.6. *The user's eye was reading the moment more
precisely than the measurement was.* Bisect for a threshold; do not sweep for it.

**And the cast's own label.** A sodium dot is tagged `'spine'` only once it has
finished SETTLING — measured, 15.3 model ms against a crossing at 14.4. The tag
is about the ball's phase in its journey; the child's question is *when did it
get in*, and getting in is crossing the wall. **Ask the geometry, not the
bookkeeping**: is it below the membrane?

### And a dot on a bar is a claim with the same problem

Every event on the timeline is a moment in the MODEL, and for most of them the
drawing is at that moment too. Sodium is not: the model has it crossing at
12.9 ms and the cast, which pauses it at the mouth and eases it through, does not
put one inside until 14.6. A dot nearly two milliseconds before the thing it
names is a dot pointing at nothing — and it is the dot the reading is checked
against. Date it off the ink.

⚠ Guard a placement as ARITHMETIC, not as a string. A break that kept the
`e.id === 'sodium-in'` branch and put the model's own moment back inside it
passed a `toContain` check perfectly.

## One control per interaction, and a pause is not one of them (2026-09-13)

> "no need of two action buttons. Remove send a message. Keep play." — user

Three rounds on this one control, and the shape only settles once the
INTERACTION is named. This view's interaction is *tap again and again*:

- one button that swapped ⚡ for ▶/⏸ meant every press during a run **paused**
  it — the burst could not be delivered at all;
- two buttons delivered the burst and were redundant furniture;
- one button that always sends, and also starts the run if nothing is running,
  is the whole interaction and nothing else.

**A pause costs the burst, and the burst is the exhibit**, so there isn't one:
taking hold of the scrubber stops the run where you put it, which is the same
affordance the round trip already has. *Borrow a neighbouring view's styling,
never its state machine.*

## A transport moves the PICTURE; make it move the model too (2026-09-13)

> "when I'm dragging the timeline, the background change does not occur."
> — user

The drawing is a pure function of the run's position, so scrubbing works on it
perfectly. The receiving cell's model is an integrator, stepped by wall time —
so while the child dragged the bar, the picture moved and the voltage, the
magnesium, the cascade and the ions carried on at their own pace, with the one
reading the scrubber exists for not following it at all.

**A view with a transport has one clock, and everything in it reads that clock.**
Step the model by the change in the run's own position, not by the frame's.

⚠ **But never backwards.** A drawing rewinds because it is a function; a model
cannot un-tap a message or un-admit an ion. Clamp the step at zero and let the
model hold while the picture scrubs back.

## An unobservable drawn is an assertion you did not mean to make (2026-09-13)

> "Depolarization is a cause of an NMDA activation and not its result. Pushback
> if I'm wrong and if I'm right, fix." — user, and they were right

The model had the causality correct all along: the voltage is driven by AMPA
alone and the block follows the voltage. Two pieces of INK said otherwise.

**The stone's depth was multiplied by how open the gate was.** So at rest, with
no glutamate anywhere near it, the magnesium was drawn hanging *above* the
channel. The child met the resting state as "the pore is clear", watched the
stone drop IN as the gate opened, and only then saw it lift — the story exactly
backwards. A 96% block is a plugged pore; that is what rest looks like.

**And the block's flicker was drawn on a shut channel.** `stoneSeated` spends the
block as a fraction of TIME, so even a 96% block has a spell in every
twenty-eight where the stone is up — MEASURED, one landed at 3.6 s, seven seconds
before anything had happened at all.

Which way a block flickers on a channel with no current through it is
**unobservable**. Drawing it is not honesty about the physics; it is asserting
something the physics does not say, in the one place where the child is reading
for cause and effect. Hold it still where it cannot be seen, and leave the
fraction untouched everywhere it can.

### Guard the order as an ORDER

Not as a set of facts about each part. Record the millisecond each beat first
happens and assert the sequence: head warms ≤ block eases ≤ conducts ≤ ions
cross, with none of them simultaneous. A chain of individually-correct states
says nothing about the order they play in.

⚠ And guard the DRAWN position, not only the model's number. Here the model said
1.0 — fully seated — throughout, and the drawing painted it at the top of its
travel. A break that restored that multiplication moved no number any guard was
asking about.

## Two models of one event need their clocks put beside each other (2026-09-13)

> "bg is blue after Na ions pnentrated." — user, after two rounds on the colour
> and one on where it was painted

Third cause, and the deepest. The receiving cell's model and the picture were
running on clocks nobody had measured against each other:

| | |
| --- | --- |
| the head's colour peaks | **1.0 s** after the tap |
| …and is back to zero by | **8 s** |
| the drawn sodium gets inside at | **10.9 s** |

So the effect played, and then its cause was drawn — three seconds after the
answer had finished. Every guard on the model was right, every guard on the ink
was right, and the exhibit taught nothing, because *when* was never asked.

**When one press drives two models, measure the lag between them before
believing either.** The round trip ruled on exactly this on 2026-09-02 ("the
sodium didn't even penetrate the cell, but the yellow aura is already there")
and the answer is the same: **the reading is paced by the DRAWN thing.** Here
that is one line — the pulse begins when the ions land, and a waveform returns
zero until its start.

⚠ And the lag is MEASURED off the cast, never typed, so it follows the clock and
the legs. A hand-written delay is a second copy of the schedule.

### A lag is a remainder, not a constant

A tap that lands mid-run is not a full lag from its answer — it is however much
of the run is LEFT before the moment arrives. Scheduling every tap a full lag
ahead pushes each one further into the future than the last, and a burst never
overlaps at all.

### And a control swapped away is a control that cannot be pressed

Borrowing the round trip's action plate brought its ⚡→▶ swap, which is right for
a view with ONE stimulus per run. This view's entire interaction is tapping
again and again — so with the bolt gone, every press during a run paused it, and
a burst could not be delivered. **Match a control to the interaction, not to the
neighbouring view's layout**; share the styling, not the state machine.

## The right ink in the wrong PLACE is the same as no ink (2026-09-13)

> "bg of the dendritic does not get red at depolarization." — user, after the
> previous round had already fixed the colour and the opacity

And it was being laid: measured, `rgba(247, 113, 113, 0.42)` on every hot frame.
Two rounds of work on WHICH colour and HOW STRONG, both correct, and the child
still saw no red — because the question nobody had asked was WHERE.

The wash is a vertical gradient from above the face to the foot of the whole
picture. At this framing its strongest stop lands at y = 409 and the head's face
is at 465 — so the peak fell in the cleft, which the clip then threw away. What
reached the head was the tail: 0.30 at the top, 0.09 at the bottom, **fading out
precisely across the thing it was drawn for**.

**A fill's geometry is as much a claim as its colour**, and a guard on "is the
ink there" will not see it. Ask where the ink LANDS relative to the shape it is
for.

### And ask whether a gradient is a claim you meant to make

A gradient says *this end is more than that end*. That is true of a patch of a
big cell, which is why the round trip has one. It is false of a spine head,
which is isopotential at this scale: the whole of it is at one voltage, so the
whole of it gets one colour. The soft edge a gradient was also doing is the
clip's job, and the rim's own fade already does it.

⚠ Guard it by counting the STOPS. A flat fill lays one; a gradient lays several,
and the ones that land inside the shape are the weak ones. "Exactly one stop, at
full strength" catches the geometry, the strength and the fade at once.

## A ramp built around NEUTRAL is the wrong instrument for something never neutral (2026-09-13)

> "'depolarized cell bg' was supposed to get red, which does not happen. Why?"
> — user

Two faults, and each alone was enough to hide the effect.

**The opacity was `|t|`.** The app's charge wash paints harder the further from
neutral a compartment is, which is right when the subject is *how charged is
this*. A cell CHANGING from negative to less negative passes through neutral —
so measured, the wash faded to **alpha 0.000 on every run**, at exactly the
moment the exhibit was about. *Let the colour carry the reading and the opacity
say only how much there is to read.*

**And the ramp runs blue → SLATE → red.** The spine head is never neutral: it
goes from very negative to less negative and never once has no charge, so the
slate is a colour it has no business wearing. Measured, its entire working range
came out between rgb(96,123,149) and rgb(170,113,127) — slate to a mauve barely
distinguishable from it.

**Same two inks, one stop skipped.** A cold-to-hot span keeps the visual
language exactly and simply does not pass through the colour of no charge.
Measured after: rest sky-blue, one message warm, a burst red.

⚠ Guard a palette claim against the PALETTE, never against the new function's
own endpoints — a first version compared each step to `span(0)` and `span(1)`,
which is circular, and a break that started the walk at the slate was perfectly
linear between its own ends and passed.

⚠ And test a reading at the rate a HAND can produce. A claim measured only at
the model's fastest tapping is a claim about a speed nobody can deliver.

## A COINCIDENCE needs a mark of its own (2026-09-13)

> "display an NMDA receptor activation … the magnesium block lifts up, opens the
> channel, calcium and sodium ions flow in the cell. Displayed or pushed back if
> there is a scientific misconception." — user

Everything the chain needs was already drawn: the gate opening on glutamate, the
stone in the throat, the aura reddening, the ions crossing. What was missing was
a mark for the one state the receptor exists to detect — **both at once**. A
ligand-bound NMDA at rest looked exactly like a conducting one, so the picture
could not say which of them it was showing.

**When a thing's whole point is that two conditions coincide, the coincidence is
a state, and a state needs ink.** Name it (`nmdaLive`), draw it in the grammar
the app already has for "current is flowing" — a glow under the protein, growing
with the current — and guard each half separately: ligand without depolarisation
must not light it, depolarisation without ligand must not light it, and both
together must be many times either.

⚠ Guard its SIZE, not its presence. It grows with the current, so a barely
conducting receptor has one too and a count is 1 either way.

### The pushback, and it is a measurement

"The magnesium block lifts up, opens the channel" is right about the lift and
wrong about the opening, and the difference matters because the whole exhibit
rests on it. Woodhull at this synapse:

- **96%** blocked at rest;
- **57%** at the very best one synapse can do to itself — and tripling the
  messages after that moves it by under four points, because the voltage
  saturates at the receptors' reversal.

So the stone spends less of its TIME in the throat — about eleven spells in
twenty instead of nineteen — and what gets through is a trickle that got twelve
times bigger, not an open pore. That is enough: the calcium threshold is
crossed by a trickle over time, not by an open channel. Keep the real numbers in
the info block rather than smoothing them into the story.

## A reading is of a CHANGE when the absolute never moves (2026-09-13)

> "Na entering the cell should depolarize it, give red tint." — user

The spine's aura was the app's charge ramp fed the spine's absolute voltage,
which is correct and unreadable. MEASURED: rest is −70 mV and a burst through
three receptors reaches −22.6, so on absolute polarity the aura runs from −0.77
to −0.30 — **blue to slightly-less-blue**. Everything about it was true and the
child could not see the thing it was drawn to show.

**When the quantity the exhibit is about never leaves one end of a scale, the
reading is of the CHANGE, not the value.** Here: the departure from rest,
stretched over the range this synapse can actually reach, so full red means "as
far as this synapse goes" — and the number the stretch is against is MEASURED
(the peak a burst through three receptors reaches), never chosen.

Then say so. The absolute millivolts stay in the info block, and the note that
a spine head never goes positive stays with them: the exaggeration is in the
ink, not in the claim.

⚠ The test of whether it worked is not the tint at the top of the range but the
DIFFERENCE the exhibit exists to show: the same single message must be visibly
redder with three catchers than with one. Measured, −0.32 against +0.23.

## An inherited default is not a decision (2026-09-13)

> "glutamate is gone from NMDA before it gets activated, which is wrong. Why did
> you make this decision?" — user

Nobody had. The seat window every receptor's ligand was released on came from
`receptorOpenWindow`, which is AMPA's: bound for about a millisecond. NMDA's
glutamate stays bound for hundreds of milliseconds, and **that slow unbinding is
the whole reason NMDA is the slow one** — so the receptor was being drawn opening
on its own clock while its ligand left on somebody else's.

This is the third time in two days that borrowing a picture has silently
borrowed a schedule with it (see *Reusing a picture means inheriting its CLOCK*
and *A cast is keyed to a CAST LIST*). The pattern is worth naming on its own:

**When one actor in a borrowed scene behaves differently, mark it in the DATA
the scene carries, not in the drawing.** One flag on the geometry — which seat is
slow — and the cast, the windows and the picture all agree, because there is one
place to disagree from.

And when asked "why did you decide X", check whether it was decided at all. "I
inherited it and did not notice" is a more useful answer than a reconstructed
rationale, and it points at the class of bug rather than the instance.

## Two correct drawings of one object, with nothing in between, is a teleport (2026-09-13)

> "adjust snare removal animation. Currently teleports. Expected: smooth
> animation." — user

A SNARE complex before fusion is a rope standing between the bubble and the
wall. After fusion it is a cis-complex lying flat IN the wall, a vesicle-radius
away. Both drawings were right, both were carefully reasoned, and the change
between them happened in one frame.

**Nobody had drawn it wrong. There was simply nothing there.** This is the
failure mode of a picture assembled from correct states: every state is
defended, and the transitions are whatever falls out. The same fault was sitting
next to it — a carrier that reached the wall and vanished, with a receptor
appearing in its place.

Ask, of every pair of states: **is this a substitution, or is it one thing
changing?** A trans-complex becoming a cis-complex is not two ropes, it is the
same four helices zipping the rest of the way. A carrier reaching the wall is
not a bubble swapped for a protein, it is a piece of membrane opening into
another piece of membrane. When it is one thing changing, the ends TRAVEL — and
travel eased, because a change of place is a journey.

### Tie the transition to the event it belongs to

Not to a timer of its own. The SNARE zips flat over the window in which the
bubble FLATTENS, because that is when a trans-complex becomes a cis-complex.
Then the two cannot drift apart, and neither can be tuned without the other.

### What the transition is FOR

The merge was not decoration. It is the only moment the app can show a
lumen-facing catcher becoming an outward-facing one — a whole teaching note,
previously asserted in prose and never drawn. **A transition is often where the
lesson is**, because a state can only show you what a thing is, and the lesson
is usually how it got there.

⚠ And guard the direction as a DECISION, not as ink: nothing a guard can count
on a canvas tells you which way a protein faces. A break that walked the catcher
into the wall still upside-down moved no marks at all and was invisible to an
ink test measuring the same place.

## Draw a flow by QUANTISING it, never by animating beside it (2026-09-13)

The cascade at the spine was driven by a calcium number nobody could see
arriving. The obvious repair — draw some ions crossing the channel — is also the
obvious trap: a second animation, tuned by eye, running alongside the number
that actually decides.

**Quantise the thing that decides.** `nmdaFlow` is the whole of what gets past
the block: the calcium that accumulates is its integral, and the ions that cross
are that same integral in lumps of a declared size. One drawn ion per quantum.
Nothing about the threshold had to be re-tuned to draw them, because the amount
is computed exactly as it was — and the picture cannot show a trickle while the
model counts a flood.

### A gate the picture can see

An ion may cross only while the throat is visibly clear, by the same call the
stone's own position is drawn from. A quantum that comes due against a seated
stone does not vanish — it **waits at the mouth**, which is what a block looks
like from outside, and goes on the next lift.

Three things had to be true for that to hold, and each was a separate bug:

- **The crossing must FIT inside the clear hold.** Derive it from the spell
  (`spell × (1 − 2·move) × 0.8`), never type it. At 280 ms against a 134 ms hold
  the stone came back down on top of an ion that was still in the pore — which
  is the exact inconsistency this app was corrected for once already.
- **Look ahead before setting off.** Clear *now* is not enough; the rule is a
  pure function of time, so ask it for the far end of the crossing too.
- **A throat with an ion in it is not blocked.** The spell is
  `hash(k) < plug`, and `plug` drifts with the voltage — so a spell that was
  clear at launch can turn *under* the ion. Commit the throat clear for the
  crossing.

⚠ But keep the commitment out of the GATE. Asking the committed value where the
gate is decided lets the tail of one ion's commitment open the door for the next
— and, worse, **masks the gate entirely**: a break that let ions through
whatever the stone was doing passed every consistency check, because each launch
forced the stone out. The gate asks the raw rule; the commitment is for the
picture.

### Order of events is a measurement

How common to draw the interesting species is not a matter of taste. MEASURED at
one-in-three, the first calcium got past the stone at 3.6 s while CaMKII had
already latched at 2.8 — the cascade lighting off a calcium the child never saw
arrive, which is the very thing the step existed to fix. One-in-two puts the
calcium in at 1.3 s, the climb starting at 1.7 and latching at 2.8. **Cause on
screen, then effect** — and the exaggeration that buys it is declared beside the
others.

### And a commitment that softens a rule needs a bound

The commitment costs a little of the block. How little is the measurement, and
the bound on it is what keeps the look-ahead a rule rather than decoration:
0.7 points of block given up with it, 1.7 without.

## A cast is keyed to a CAST LIST — carry it, don't re-derive it (2026-09-13)

> "NT bind the wrong place. Expected: bind receptors." — user

Eleven separate functions asked `receptorSites(g)` for the row of receptors:
who catches which transmitter ball, when a channel may show itself bound, where
sodium crosses, when the departing flash launches, when the timeline's "bound"
dot falls. Each of them was right, and all of them were asking a function that
returns the ROUND TRIP's five seats at the round trip's spacing about the round
trip's centre.

The spine draws two, tightly clustered, at a centre of its own. MEASURED: a
seated ball could be **535px from the nearest drawn receptor**, spread over
twelve columns, one of them off the side of the stage. Four of the five columns
of sodium poured through bare membrane. Every one of those eleven functions was
individually correct and the picture was nonsense.

**The set of actors is data, and it travels with the scene.** Put the row the
framing actually drew onto the geometry, give it one accessor, and have every
consumer ask that. One list, one answer — instead of eleven copies of a default
that only one view is entitled to.

This is *one number, one picture* at the scale of a whole cast: two derivations
of "which receptors are there" in one frame will contradict each other, and the
one that draws the circles is not necessarily the one that decides where the
balls go.

### What it fixes on the way

A cast list is also a set of INDICES. Once the row is carried, "receptor i" means
the same receptor to the drawing and to the clock — so the NMDA's own seat
window is simply the last index, and it stops showing itself bound off the tap
seconds before its glutamate is drawn arriving.

### Guarding it

The cast-level claim (a seated ball is within a receptor's mouth of a drawn
receptor) is necessary and not sufficient: the drawing builds its own geometry,
so it can pass while the scene never hands the row over. Measure the INK too —
and by DIFFERENCE, because a crowded gap always has a wandering ball near some
x. Render the same run at the same moment with and without the framing's flag:
the wanderers are identical in both, so what differs is exactly who is seated.

⚠ And check the mirror claim is actually measurable before asserting it. "More
ink at the drawn seats" is not: one or two seated balls are swamped by the crowd.
Where a ball can ONLY be a seated ball is at the seats nobody drew.

## Chrome takes its room from the MAGNIFICATION, and the room is for the ACTORS (2026-09-13)

> "add timeline, shift the whole view down, so the timeline does not cover
> vesicle release." — user

The spine view kept 104px clear at the top "for the timeline". That was room for
the MEMBRANE, and the membrane is not what happens there: a docked vesicle
stands above the wall, not on it. MEASURED at that framing the middle bubble's
top sat at y = −69, sixty-nine pixels off the top of the picture, and everything
of it that was on screen was behind the bar.

**Size the gutter off the tallest thing that has to be seen in it**, not off the
line the thing is attached to.

### And solve it, because the two are coupled

Pushing the wall down shrinks the picture, and a smaller picture has a smaller
vesicle, which needs less room. So it is a fixed point, not a nudge:

    TOP − rise·k(TOP) = CHROME + GAP,   k(TOP) = SHARE·(H − TOP) / 2·ry

⚠ **And ask which actors.** "Every docked bubble in frame" does not converge —
the bouton's floor is a curve, the outermost bubble stands 166px above the wall
against the middle one's 56, and buying clearance for it walks the picture down
without limit. The right set is the ones that *do something*: the bubbles this
run opens. Have the guard ask the RUN which those are, so the drawing's filter
and the claim cannot drift apart. (A first version filtered on `≤ half the
active zone` and excluded the slots sitting at *exactly* half, by a rounding
error — 30px short, and green.)

### What pays for it

**The magnification.** `SPINE_SHARE` is untouched — the head still fills the
share of the frame it was asked to — there is simply less frame: 3.10× → 2.33×.
You cannot have more chrome and the same absolute zoom, and saying which one
gives is part of the change.

⚠ Then **do not re-tune the zoom guard to match**, or it measures nothing. Ask
the legibility question instead: *how wide is a receptor on screen?* That claim
does not move when the chrome does.

## A layout has TWO frames, and only one of them is the camera (2026-09-13)

> "Move them to the left along the membrane, so that they appear centered in
> relation to the screen." — user

The camera could not do it. MEASURED, the spine head is wider than the stage, so
a frame holding the left flank cannot also centre the middle of the active zone
— the two are 337px apart and no offset gives both. Neither can the zoom:
satisfying both needs k ≤ 1.83 against the 2.33 the rest of the view is solved
at.

So the answer was not the camera at all: the DENSITY moved. A postsynaptic
density is not a point under the middle of an active zone; the zone is a stretch
of apposed membrane and the density sits somewhere on it.

**When a framing request cannot be met by the camera, ask whether the SUBJECT
has any freedom** — and if it does, spend that instead, with the anatomy's own
limit as the clamp. Here: the density may move anywhere on the active zone and
nowhere off it, because a density opposite no release site is not a synapse. The
clamp is the guard.

⚠ And the anchor is then **handed DOWN, not recomputed.** It is solved from the
camera, the camera belongs to the view, and the drawing must never work it out
for itself or there are two answers to one question. Everything that belongs to
the synapse — the seats, the queue in the wall beside it, the cascade under it,
the carriers waiting to reach it — takes the same anchor.

### Inside a shape is not the same as below its top

Pushing those carriers deeper and further apart put one of them 5px THROUGH the
wall. Its depth was right and its spread was right; nothing was asking whether
the head was still that wide down there — it narrows toward the neck. **Anything
placed in a body's interior is clamped to the outline's own span at that
depth**, read off the same cubics that draw it.

## One membrane, one paving rule — or the two halves meet at a corner (2026-09-13)

> "adjust bilayer orientation on the left side of the spine, by connecting the
> membrane 2 parts." — user

The spine's wall was paved by two different rules that had grown up separately.
The flanks were walked along the outline's own cubics, by ARC LENGTH, with the
tangent they actually have. The face was laid by a loop over X — a molecule
every step of *x*, every one of them standing STRAIGHT DOWN.

Across the active zone those two agree, because the face is nearly flat there,
which is why this survived so long. At the shoulder they do not: the face falls
away on a quarter-ellipse at about 45°, and MEASURED the flank's last molecule
sat at (134, 503) while the face's first was at (140, 468) — 35px apart on a
1.62px pitch, a 108px hole at the spine's magnification, with the two halves
meeting at a right angle.

**Two rules for one surface is a seam.** A surface gets ONE paving rule, one
inward-normal rule, and one step, and the two stretches then meet by
construction rather than by luck.

### The three things that were separately wrong

- **A step in x is not a step along the curve.** Where a wall approaches
  vertical, a fixed x-step is an unbounded arc-length step. March by
  `step / √(1 + slope²)` instead: tiny steps where it is steep, full ones where
  it is flat. A thousand *even* steps in x still left the first two molecules
  8px apart.
- **A tangent of (1, 0) is a claim, not a default.** If a wall can slope, read
  its slope.
- **"Which way is in" cannot be decided from X alone.** The old rule took
  whichever normal pointed back at the spine's axis, which is only meaningful on
  a roughly vertical wall — and a face, a shoulder and a cap's underside are
  not. Point it at the structure's own INTERIOR and one rule covers every
  stretch, including the ones that face downward.

### Guarding a seam

⚠ **A nearest-neighbour sweep cannot see a gap between two dense runs.** Every
molecule at the end of a tightly packed run still has a close neighbour behind
it, so "does everything have a neighbour?" is green across a hole. A first
version of this guard also took the two molecules nearest the join and found
them both on the same side of it.

**Ask each PART for its own nearest molecule and measure the gap between
those.** And guard the orientation across the seam too: walk the join and
require the inward direction to change by no more than the packing's own step
could turn it — the broken version stepped about 90° there.

## A journey along a surface is the SURFACE's path (2026-09-13)

> "if we plan to 'drag' an AMPA along the membrane into synaptic cleft, let's
> shift camera so that the left side of the spine is in view. So we can follow
> the membrane and channel's path." — user

A receptor climbing the spine's neck was placed by interpolating x from the
neck's half-width to the surface pool's, and y from the neck to the face. Two
lerps between two correct endpoints — and everything in between was wrong.
MEASURED at the spine's framing, the halfway point sat 544px inside the wall it
was supposed to be in, drifting through open cytoplasm.

Both ends were right, so every guard that looked at the ends was green.

**If a thing is IN a surface, its route is that surface's own path.** Sample the
outline you already draw, step along it, and take the orientation from the
tangent — one rule for the whole journey instead of an eased quarter-turn that
is only correct where it starts and where it stops. Here that turned out to
matter twice over: the route round a mushroom cap's underside points the protein
DOWNWARD for a stretch, which no interpolation between "on the left wall" and
"on the face" can ever produce.

### And then the frame is what gives

Following a real surface costs room, and the room has to come from somewhere.
Measured, the spine head is 1567px wide at this magnification on a 1060px stage:
centring it put BOTH flanks outside the picture, so the journey the exhibit was
built to show happened 253px off the left edge.

One flank can be watched or neither. **A camera that cannot hold the whole
subject frames the part that is ACTING**, and the rest is simply out of shot —
which is what a camera does and needs no apology in the drawing. Solve the
offset from the path itself (`min(path.x) − the protein's own reach + a gutter`)
so a change to the outline moves the camera rather than quietly pushing the
journey off the edge again.

The cost is real and must be paid, not absorbed: everything drawn off the head's
half-width — a mirrored pool at ±0.5 of the active zone, cascade proteins at
±0.42 of the head — was suddenly past the edge. **Size interior furniture off
what it BELONGS to** (the proteins under a synapse are the synapse's, so their
spread is their own diameter) and it survives any camera.

### One line, one definition

Five things shared one stretch of wall here: where a carrier fuses, where two
climbers are caught, and where two receptors already stand. Four drawings of one
line is four chances for a protein to stand on another protein. One exported
function lays the queue out and everything asks it — including the paver that
punches the holes.

## Reusing a picture means inheriting its CLOCK — keep only the legs you can act (2026-09-13)

> "There's no need to copy behaviour from the earlier view. This view starts
> with NT release (all release preceding actions are not present in the
> animation)." — user

The companion to the rule below, and its other half. That one says a borrowed
picture has to be DRIVEN. This one says it must not be driven blindly.

S13 borrows the round trip's drawing, so it was handed the round trip's whole
sixty-millisecond run: the spike arriving, the calcium doors, the sensors, and
then the long glutamate–glutamine loop home through the astrocyte. Two of those
stretches have no actors on this side at all — the calcium doors were removed
from this framing, and the astrocyte with them. **A leg whose actors you have
taken off the stage is screen time spent on an empty stage**, and a journey
whose destination is not drawn is a journey nobody can follow.

So a borrowing view declares a WINDOW in the run's own model time and keeps the
legs inside it. Measured: 34.5 s of run became 15.2 s, and the release — the
thing the view is about — now starts at second zero instead of second seven.

**The shares inside the window are the original's.** Derive the borrowed run's
screen length from the kept legs (`SYNAPSE_SCREEN_MS × Σ kept share`), never as
a number of its own, or dropping legs silently stretches the ones that remain
and the same release plays at two different paces in two views. *Slow the leg,
never the item* — and do not speed one up by deleting its neighbours either.

⚠ And guard the WINDOW at both ends by naming what must be outside it: not
"starts at 2.56" (which is circular — move the constant and the guard follows)
but "starts at or after the calcium doors' leg ENDS, and finishes at or before
the astrocyte's begins".

## …and a drawing whose CLOCK never ticks is a still (2026-09-13)

> "send message button click does not initiate any process. The only thing I see
> is the movement of MG block." — user

The companion to the rule below, and the second time this session that a view
was fully guarded and did nothing.

S13's view draws the round trip's own picture — deliberately, so the app has one
drawing of a synapse. But that picture animates off the **synapse run's** clock:
the bubble merging, the transmitter crossing, the receptors opening, the ions in
flight are all a function of `u`. The spine's own model supplies only the
voltage, the magnesium and the cascade. So when the run was never advanced at
this framing, the magnesium moved and nothing else did — which is exactly what
the user reported, element for element.

**Reusing a drawing means inheriting its clock.** A view that borrows a picture
has to drive every input that picture animates on, not just the ones it added.
Three things were missing: the tap fired only the spine's model, the run was not
advanced unless the camera was at the synapse, and arriving at the spine RESET
the run out from under the drawing.

### What to guard

Two halves, because neither catches the other:

- **the picture moves** — render it at several points of the run and require the
  ink to differ. A still picture is a measurable thing.
- **the wiring exists** — the control drives every clock, and every clock is
  allowed to advance and to survive at this framing.

A scene test calls the draw function directly with whatever arguments it likes,
so it will happily paint a beautiful animation that the app never asks for.

## A drawing that is never CALLED fails nothing (2026-09-12)

> "currently, 'the spine' is empty canvas" — user

S13's view had ten guards on its drawing and all of them were green. Its
`spineFadeRef` was declared, and read to decide how strongly to paint — and the
one line that raises it toward 1 had been lost while unwinding an earlier
experiment. So the fade stayed at 0, the layer's `sceneFunc` returned before
drawing anything, and the view came up blank.

**Nothing failed, and nothing could have.** Every test called `drawSpine`
directly. The defect was not in the drawing at all; it was that the drawing was
never called. A view has two halves — what it paints, and the wiring that asks
it to paint — and a scene test only ever exercises the first.

So the gating is now asked of the wiring itself. For each view of its own, the
stage's source must contain its fade **declared**, **driven** (`+=`),
**consumed** (turned into what is shown), and its layer **handed to the
animation** that redraws it. Source-text guards are usually a smell — they
assert spelling rather than behaviour — but here the behaviour lives in a React
component built on a canvas library, and the alternative was another round of
"it's blank".

The companion half is measurable properly: a target's `scale` and the gate's
`viewScale` must agree, or the fade is driven and still never arrives.

### The wider shape

This is the *unguarded change* rule seen from the other end. That rule says a
change needs an assertion that fails if it did not happen; this one says an
assertion can pass on code the app never runs. When a step adds a view, a
layer, or anything reached only through a framework's own callback, ask what
proves it is REACHED — not merely that it is correct once it is.

## A borrowed model keeps its own clock, and the two will not agree (2026-09-13)

> *"postsynaptic spine is supposed to get red background inside the spine as a
> symbol of depolarization. This should happen the moment sodium ions enter the
> cell via AMPA channel. But this does not happen"*

S13's model is stepped by the run's own position — `u × SPINE_SCREEN_MS` — so its
clock unit IS the screen millisecond. Its `TIME_FACTOR` was 70, meaning its
receptors lived at 70× real time. **The picture they are painted on plays at 275
screen-ms per real-ms**, measured off `spineClock` at the leg where the sodium
lands. The cell was answering 3.9× faster than its own cause was arriving: the
head's tint rose at 10.67 s and was gone by 11.94 — **1.3 seconds of a 15.2
second run**, a flash rather than an event.

Nothing failed. Fifteen hundred guards were green, because every one of them
asked the model about the model. The disagreement was between two clocks that had
never been put beside each other.

**The rule.** When a model is drawn into a picture with a clock of its own, the
model's rates are not free — they are the picture's pace, measured, not a number
the model picked for itself. Ask the clock; do not type the answer.

### …but the picture's full pace may be unaffordable, and the LESSON is the budget

Matching 275 exactly puts NMDA's decay at 60 × 275 = **16 500 ms — longer than
the 15 180 ms run.** Every tap would then overlap every other and tempo would
stop meaning anything. Measured at 275, seven taps latched the cascade at every
spacing from 220 ms to 1.5 s alike — which flatly contradicts what the view says
aloud: *"Tap slowly instead and nothing happens... It is not how many messages —
it is how close together they are."*

So the factor was found by **walking it**, not chosen:

| `TIME_FACTOR` | NMDA decay | red holds | 1 tap/s |
| --- | --- | --- | --- |
| 70 | 4200 | 1.26 s | never |
| **140** | 8400 | **2.54 s** | **never** ← taken |
| 200 | 12000 | 3.62 s | 9 taps |
| 275 | 16500 | 4.46 s | 7 taps — the lesson is gone |

**Read the exhibit's own words before spending a constant.** The info block is
where the claims are; a pacing change that makes one of them false is not a
pacing change, it is a rewrite.

### A chain, and the constant to spend is the one the literature pins loosest

`CA_CLEAR_MS` had to move, and both directions were defensible: hold the screen
value (1800 → 6.5 real ms) or hold the real value (25.7 → 7068 screen ms).
Scaling it **inverted the tempo reading** — seven taps needed in quick succession
and only six when spread a second apart, teaching the opposite of the point.
Holding the real value near 6.5 ms kept the reading the right way round *and*
moved the number toward the literature (a spine head clears calcium with a tau of
~12 ms at room temperature, a few ms at body temperature). The constant that gave
was the one measurement pinned loosest, and it landed better than it started.

### And a threshold is re-derived by BISECTING the near miss, never by scaling

Widening the receptors doubles what a given burst admits. `CA_HALF` was re-solved
by asking both sides — six taps must still fail, seven must still fire — which
brackets it at 0.1057…0.1193. Scaling it by the same factor would have been
arithmetic on the wrong quantity.

### A wrist does not scale, so some claims move whatever you do

`TAP_REST_MS` is 210 ms of wall clock — the fastest a child can press. Stretch the
cell's clock and the same hammering becomes a **higher frequency in cell time**
(220 ms is 1.6 real ms at 140 against 3.1 at 70), so the synapse summates further
and its ceiling really does rise: −16.4 mV → −9.3, and the block at full drive
46% → 38%. That is the model being honest, not the claim being softened. **Say
so, re-measure the prose, and guard the CONTRAST rather than the level** — the
drawer's dial clears the block, one synapse still does not come close.

## One ink cannot carry two readings — split them across hue and strength (2026-09-13)

The head's colour had to say two things at once: *whether* the spine is
depolarised, and *by how much*. It cannot.

**The palette is the constraint, and it is not negotiable.** `particleStyle`
reserves its hues by meaning — gold, violet, green and pink are the four
signalling ions, amber is force and explanation, teal the transmitter, orange
glutamine — leaving **red and sky for charge sign**. Sky and red are
near-complementary, so the straight line between them passes close to the grey
axis whatever route it takes: measured, a lavender-grey at 0.5, a mauve at 0.6,
not warm until about 0.8. Bowing the path away from grey means borrowing an ion's
ink — through violet it wears potassium's, through pink calcium's. **Skipping the
neutral STOP was not enough; the neutral is in the geometry of the two inks.**

So the ink is fixed and the only lever is **where a reading sits on it** — which
is `SPAN_NEUTRAL`, the crossing of the red and blue channels, solved off the two
inks rather than typed.

### The proof that one channel is not enough

Four requirements sat on one curve. Measured reaches: one message 0.208, three
catchers on one message 0.465, a burst through one 0.530, a burst through three
0.849.

1. one message must clear the crossing (0.587), or it never reads as depolarised;
2. three catchers must be 0.2 redder than one, on the same message;
3. three catchers must be 0.2 redder than one, on a burst;
4. a burst through three must clear 0.9.

From 3 + 4, `f(C) ≤ 0.8`. From 1 + 2, `f(B) > 0.787`. But **B sits below C**, so
`f(B) ≤ f(C)`. The slot is **1.3 points wide** — satisfiable only exactly on the
boundary, with no margin. No shaping function rescues it.

**The rule.** When one ink is asked to carry two readings, do the arithmetic
before tuning. If the range is not there, split the readings across the two
channels a wash already has: **hue says WHICH, alpha says HOW MUCH.**

`spineWash` had been `0.5 + 0.5 × spineCharge` — the same number painted twice,
which is this document's own *One number, one picture*. It now reads `spineReach`
directly, so the two channels cannot both be bent by one constant.

### Guard the COMPOSITE, not either half

A separation asked of the hue alone can be green while the head on screen has
barely moved; one asked of the alpha alone says nothing about colour. `spineHeadInk`
composites bath, cytoplasm and wash exactly as the canvas does, and the guards ask
*that*: one message lands 42.5 from rest, three catchers 20.0 from one, a burst
through three 24.3 from a burst through one. **Measure the claim where the child
reads it.**

### And prose carrying a measured number must interpolate it

*"About eleven times out of twenty at the reddest a burst can make it"* was
measured against the old ceiling. The ceiling moved and the sentence went on
saying eleven — a claim about the model the model no longer made. The info block
now interpolates `seatedInTwenty(SPINE_CEILING_MV)`, and a guard reads the prose
back against `mgBlock`. **A number spoken aloud to the child rots exactly like a
number in code.**

## When the user IS the variable and they do nothing, the exhibit teaches nothing (2026-09-13)

> *"It's not clear for a kid what has to be done, so the kid played once."*

S13's claim needed a burst, and the burst was the child's to produce. The app's
own rule had already named this failure — *a comparison must survive the child:
an input should TRIGGER a behaviour, not inject one, or the user's wrist becomes
the dominant variable* — and the rule says to **drive it at both extremes before
shipping.** Driven at the "presses once" extreme, this exhibit taught nothing.

**And the second fault was worse than the first.** Even a child who tapped eight
times saw ONE drawn release: the model counted the messages, the picture had no
notion of a second one arriving later, so *"close together"* was never on screen.
**An interaction the picture cannot draw is an interaction that teaches nothing
even when it is performed.** Ask of any input: if the child does this five times,
does the picture show five?

The cure is to let the RUN be the experiment and the child's hand be an
amplifier. What that buys: the comparison can now be a before/after of the SAME
stimulus on ONE subject, which is what this document already prefers to a second
panel — and the failing case (messages spread out) can be **drawn** rather than
left as a claim the child must discover by not discovering it.

### A scripted run needs legs for the same reason a model does

The burst must be 260 model ms apart or the calcium never stacks; eight releases
260 ms apart is a blur in which no bubble is seen to open. One number, two
directions — and a leg is what separates them: the model keeps its gaps, the
screen gets 2.35× as much of them. *Slow the leg, never the item.*

### A schedule is exact; the firing is QUANTISED — and a refused input is silent

The scripted burst did not fire the cascade at all. A 220 ms gap quantised to a
16 ms frame lands alternately at 224 and **208**, and 208 is under the terminal's
210 ms refractory, so `spineFire` dropped those messages. It returns nothing, so
a refused message is indistinguishable from one never sent: three of eight went
missing and nothing failed anywhere.

**Two rules.** Any interval a schedule relies on must clear its gate by more than
a slow frame — a gap tuned to the gate exactly is a gap that misses half the
time. And when a call can REFUSE, **count what was taken, not what was sent**;
otherwise the failure is invisible at every level.

### The chapters land on measured moments, not on guesses

Acts four and five are named after events the model decides, so the story is
built, **walked**, and its boundaries read off that walk. *A chapter whose dot
does not sit on the thing it names is a dot pointing at nothing.*

### And the WORDS move with the picture

Captions saying *"tap eight times fast"* were instructions for a control that no
longer existed. The count moved to `core/spine.ts`, because the story, the prose
and the threshold guard are three claims about one fact, and a guard now reads
the info block back for the word "tap". **Changing an interaction is a
documentation change.**

## A receptor JOINS the density — and a count that sizes a layout must be continuous (2026-09-13)

> *"Newly transported AMPAs are overlapped with membrane and do not get active
> at ion binding."*

**One fault, two symptoms.** The slide's destination was a formula of its own and
landed the receptor 11 px from the nearest seat. That is "overlapped with
membrane" — on bare wall between two receptors. It is *also* "does not get active
at ion binding", because **a transmitter ball is drawn at the SEAT**: a receptor
eleven pixels away has somebody else's ligand beside it. *A cast is keyed to a
cast list — carry it, do not re-derive it.* **Ask where a traveller will STAND.**

**And the row jumped.** Its width is a function of how many receptors are in it,
so `ampa` stepping 1 → 2 → 3 teleported the whole density by 26 px, twice. Both
drawings were correct, which is why nothing caught it. **A count that sizes a
layout must be CONTINUOUS**: count an arriving thing as the fraction of the way
it has come, and the step where the row gains a seat cancels exactly.

⚠ **The decision was already right.** `receptorOpenFrac` reported peak 1.000 for
every new receptor before anything changed. Only the ink was misplaced — so *ask
the decision, not the ink* cuts both ways: a decision that is right does not
prove the picture is.

## Replaying one animation for many events teleports everything in it (2026-09-13)

> *"New Vesicles should not teleport, but arrive from top."*
> *"Ions should not teleport either. Ideally, ions should have identity."*

Both were the same fault. A drawing that is a pure function of a run's clock
jumps every time that clock restarts: measured at a message boundary, the model
went 17.9 → 2.6 ms, the sodium leapt **69 px** back out of the cell, and two of
three vesicles **un-fused**.

Three rules came out of fixing it.

**Give what must persist an IDENTITY.** Sodium became a list of objects with a
clock each instead of a formula asked for a position — 69 px a frame became 1.8.
Nothing the picture does to its phase can move one backwards.

**Quantise it from the flow that decides.** One drawn ion per quantum of the
conductance, so the potentiated synapse passes visibly more with no second number
to keep in step — a count for a count. ⚠ The FIRST one is due after a fraction of
a quantum, not a whole one, or the channel stands open with nothing going through
it.

**Fill the gap with the transition the picture skipped, and walk it HOME.** A
message ends with its vesicles fused; the next needs them docked. Rather than
falling back to rest, the picture holds and fresh bubbles come down from the
pool — drawn with the same helpers a docked one uses, because a bubble on its way
and a bubble at the dock are one object at two moments. Then the gap walks the
phase to the window's END, where the picture is the same as its start in
everything except the bubbles the restock just brought down, so the wrap changes
nothing on screen.

⚠ **Two bugs in the doing, both worth keeping.** A fixed restock time exceeded
the burst's own step and gave NEGATIVE play windows — it is a share of the gap
now. And one act's restock overlapped the previous act's release, restocking a
terminal that was still releasing: **a window that fills a gap must be checked
against what is on either side of it.**

## Two things on the same frame do not read as cause and effect (2026-09-13)

> *"I expected the 2 pink glyphs to do some work… They get color, but it's not
> visually clear what is their role."*

CaMKII lit and the carriers set off on the same frame. Both correct; neither
caused the other on screen — the child saw a thing change colour and, elsewhere,
a thing move. **Give the cause time to arrive before the effect starts**: a
signal lead, a pulse that travels, and the thing it reaches brightening as it
lands.

⚠ **And draw the signal in ink that is not already spoken for.** It is a word,
not a rope — the protein does not tow anything — so it is a RING, because every
travelling ball in this app is an ion and a pink one setting off from here would
read as calcium going the wrong way. The compression is declared.

## The transport puts the CELL back, not just the picture (2026-09-13)

> *"timeline does not revert all actions, if dragged backwards"*

⚠ **This reverses an earlier rule of this document, on purpose.** *Never
backwards — a model cannot un-tap a message* was right while the child's finger
was the input: a model that rewound would have been inventing a past that never
happened.

Scripting the messages changed the premise. **A model can be rewound precisely
when its inputs are reproducible.** A hand is not; a schedule is. So the general
rule is the test, and "never backwards" was its special case.

### Walk it in fixed steps of the run's own time, never in frames

Stepping by `frame.timeDiff` makes the state depend on how fast the machine is
drawing — the same moment is a different cell on a slow tab, and scrubbing back
and forth cannot land on what it left. A cursor that advances in whole steps of
the run's own clock makes the position decide the state and nothing else. A long
drag re-walks under a budget, over a frame or two; playing forward costs one step.

## The magnesium stops tossing a coin — a reading spent on TIME is unreadable (2026-09-13)

> *"NMDA open state is easy to miss."*
> *"Do not demo probability of Mg block, either keep closed or open. Lift or
> deepen depending on the voltage."*

⚠ **This reverses 21c-35, at the user's word, in both views that draw this
receptor.** 21c-35 ruled that one drawn stone has only its own TIME to spend, so
a 47% block was a stone in its seat 47% of the time — *never on how far down it
hovers*. That is truer to the physics, and it cost the exhibit the one reading it
exists for: **a channel whose stone flickers never looks open.**

**The rule.** A value drawn as how OFTEN something happens is a value nobody can
integrate by eye. Spend it on a POSITION and declare the simplification. Truth
the child cannot read teaches nothing.

### Then check what else was reading it

Three things downstream broke, and each is its own lesson.

**A threshold that worked against a flickering value is all-or-nothing against a
steady one.** D07's ions asked `stoneIn(…) < 0.5`, which was right while ions
arriving at different moments met the stone in different states. A depth gives
every ion the same answer: measured at −30 mV, **0% got in against a block
leaving 31% of the current flowing.** *When one drawn thing stands for MANY,
probabilities become fractions* — of the CAST now, not of the clock.

**A gate on top of a quantity already carried is that quantity counted twice.**
The spine gated ion launches on the stone's depth, and it stopped the exhibit
dead: a burst through one catcher only takes the block from 96% to 72%, so a
stone that had to be half out let nothing through, ever. `nmdaFlow` already
carries `1 − plug`; the quanta arrive slowly all by themselves.

**An eased change needs its CAUSE to run first.** The stone's lift was driven by
an ion being in the pore, so the ion spent the whole lift inside a half-blocked
throat — the 2026-09-11 correction happening again, in slow motion. Driving the
lift from the QUEUE makes it the cause: a quantum comes due, the stone moves,
then something crosses.

### And a reading nobody can see is worth changing how it is delivered

The pore's ions were already a perfect `na ca na ca` and nobody could see it: one
ball at a time, seconds apart, is a stream of singles that happen to differ. A
quantum buys a PAIR now — tight within, long between — so "it passes both" is a
rhythm rather than an inference. **Still one in the pore at a time.**

And a coincidence that had no mark got two: a pip per condition, in the ink of
the thing each reports, with the throat lighting only when both are true. One
function answers all three drawings of it.

## A mark that needs a key is not a reading (2026-09-15)

> *"what are green and pink outlined circles under NMDA receptors?"* → *"ok,
> remove them."*

Two condition-pips were added to say that NMDA needs both its conditions at once.
**The question was the answer**: a reader who knows this codebase could not tell
what they were. Two unlabelled dots are not a reading on a scale, they are a
legend with the legend missing.

**The test.** If someone has to ask what a glyph means, a child cannot read it.
Put the mark ON the thing it is about — the throat lighting when both conditions
hold needs no key, because it is the pore itself — or drop it.

## A protein displaces what it stands among, at the size it is NOW (2026-09-15)

> *"3 new AMPA receptors are covered by a membrane."*

A ligand channel's subunits part as it opens: MEASURED, **8.82 px half-width shut
and 10.69 open**. The paver punched its hole at the shut width, so the nearest
lipids stood at 9.5 and every receptor put on shoulder-pads the moment it did its
job. The thing standing in a wall now says how much room it needs, and the caller
hands it its current openness.

⚠ **The first measurement pointed the wrong way.** Heads at 3.0 and 6.6 px looked
like the hole failing entirely — they were the receptor's own glyph arcs at
another depth. Asking the paver directly, rather than counting marks on a canvas,
found the real gap. *Ask the decision, not the ink* — and when you do measure
ink, be sure which ink.

## A container arrives with its contents (2026-09-15)

> *"vesicles should arrive filled, not NT teleport."*

Restocking bubbles came down empty and their transmitter appeared when the next
message began: cargo teleporting into a container already parked. A vesicle is
filled at the pool and travels loaded.

⚠ **And when one object is drawn by two callers, both ask ONE layout helper.**
The cast lays a docked vesicle's seven balls with `cargoIn`; the descending one
draws all of `cargoIn`. Same helper, same seven, same places — so the hand-over
moves nothing. Two private layouts would have shifted the cargo at exactly the
frame the label changed.

## Two populations of one thing, and one of them is a still (2026-09-21)

> *"Give ions identity. Let them go through the channel when the channel opens."*

Giving the CROSSING sodium identity left the waiting ions as a cast asked at a
frozen millisecond — a still that jiggled and never went anywhere. A child could
watch a channel open, see ions standing above it, and see a **different** ion
come through.

**The rule.** When a thing exists in two states, it is one list with one life
each, not a live list and a frozen one. And the event PICKS from what is already
there rather than conjuring a fresh instance: the object the child is looking at
must be the object that acts.

### Size the pool against the busiest moment

A supply that refills only when empty starves the exhibit exactly where the
demand is highest. MEASURED at two ions per receptor, the burst act sent SIX
against the spread act's nine — fewer for eight messages close together than for
three spread out, which is the claim the view exists to make, backwards. Three
per receptor puts it the right way round.

### A guard that mirrors the drawing has to mirror ALL of it

Three guards failed first run and none of them was the model:

- an ion's position was read as one `0…2` ramp, but its clock restarts each
  stage — it reported a **17.5 px jump the picture never makes**, because the
  drawing carries a crossing ion from where it STOOD into the mouth over the
  first third and the guard started it at the mouth;
- "it must be SAMPLED waiting before it crosses" — two stages can turn over
  inside one step, so an item whose turn comes the instant it finishes arriving
  is never caught in the middle state, and was still drawn there all the while;
- "the queue was empty before the row arrived" was asked of the frame BEFORE,
  and the last one can leave in the very step that refills.

## Alive, not drafted

Biological structures carry deliberate, deterministic unevenness — lipids not
lined up along the membrane's width, receptor spacing jittered, outlines that
wander (`waveAt`) — because a ruled row of identical molecules teaches
"machine", not "alive". Constraints, all already paid for elsewhere:

- The unevenness is **seeded per element identity** (*Model patterns*): never
  `Math.random`, never resampled on a re-render, or the crowd twitches.
- Jitter must never violate an invariant the model owns (no ion may enter the
  bilayer; a carried ion stays in its pore) — the clamp stays at the model.

## Current status

- `core/`: `ions.ts` (four signalling ions), `integration.ts` (summation,
  dendritic decay, threshold), `membrane.ts` (real sizes and the bilayer's
  teaching text), `proteins.ts` (the pump), `channels.ts` (channel types and
  their gating rules), `voltage.ts` (Nernst and the chord-conductance
  equation), `neuron.ts` (part model and teaching text, with guardrails locked
  down by tests).
- `state/neuronStore.ts`: selection, current run, phase, zoom target.
  `state/ionStore.ts`: how many ions of each species sit on each side.
- `stage/`: `layout.ts` (whole-scene geometry, the scene's scale, zoom
  targets), `chain.ts` (the causal timeline), `ions.ts` (ion crowds in a
  membrane patch's local frame), `drawScene.ts` (painting, level of detail,
  screen-space labels), `NeuronStage.tsx` (camera, hit shapes, animation loop).

Two patterns worth keeping as more inhabitants arrive in the membrane:

- **A membrane patch has its own local frame** (`ZoomTarget.frame`), where
  `along` runs parallel to the membrane and `depth` is distance from its middle.
  Everything living at a patch is placed in that frame, so "inside" means inside
  the cell rather than lower on the canvas — and the same code works on the
  axon's wall and the dendrite's.
- **Crowds are laid out on change and animated by formula.** Positions are
  computed only when the counts change; the jiggle is a pure function of the
  clock and a per-ion seed. No per-particle state, nothing to shimmer, and the
  "no ion may ever enter the bilayer" invariant is a clamp that tests can sweep.
- **A particle's place must depend only on its own identity, never on how many
  particles there are.** Laying a crowd out on a grid sized by the total count
  means adding one member reshuffles every other one — the whole population
  twitches on every edit. Positions come from a **jittered grid**: a fixed grid
  (never sized by the count) whose cell is chosen per (species, side, index),
  plus a deterministic full-cell offset. Adding appends, removing pops, nothing
  else moves, and the jiggle seed follows the same index so an untouched
  particle's motion stays continuous across an edit.
  A low-discrepancy sequence was tried first and covers the area just as evenly,
  but it is a rank-1 lattice — its points lie on families of parallel lines, and
  the eye reads those as stripes. Even coverage is not the same as looking
  scattered.
- **Something embedded must displace what it sits among.** A protein in the
  bilayer interrupts the lipids around it; drawing them straight through would
  make it look pasted on top of the membrane rather than built into it.
- **A particle crossing must come from somewhere and arrive somewhere.** An ion
  that appears at a channel mouth and vanishes past it is the same misconception
  as a signal with no cause — it says the channel manufactures ions. Transported
  particles travel out of the crowd, through, and into the crowd on the far side,
  fading only while deep among the others where one more or fewer is
  indistinguishable. Hide a cycle's wrap where nothing is legible, never next to
  the thing being explained.
- **Solid things displace the crowd, and a stray particle can corrupt a count.**
  The ion cloud is kept out of every protein's footprint, which differs per side
  because the pump reaches further into the cell than out of it. This is not
  tidiness: on the pump, a stray ion lands among the ones being carried, and
  "three out, two in" is the lesson that protein exists to teach. Wherever the
  picture asks to be COUNTED, nothing unrelated may sit in the counting area.
- **Displace along the axis that carries no meaning.** Nudge a blocked ion
  sideways, not deeper — depth is encoding how close to the membrane it sits, while
  a shift along the membrane means nothing. And keep the nudge a function of the
  particle's own identity plus fixed geometry, so the crowd never reshuffles.
- **Things moving through a channel separate ALONG it, never across it.** A pore
  is barely wider than one ion, so offsetting particles sideways to tell them
  apart sends them through solid protein. Queue them instead — which is also how
  the real pump holds its three sodium, at distinct sites at different depths.
  Where an invariant like this matters, delete the field rather than zero it: a
  `CarriedIon` has a depth and nothing else, so it *cannot* leave the channel.
- **An object's extent needs ONE definition.** The pump's body outline, its two
  pore mouths and the point at which a carried ion is clear of it were each
  computed separately, and drifted: the pore stopped at the barrel while the body
  continued into the cytoplasmic head, so the opening looked walled off, and
  released ions came to rest inside the head. `PROTEIN_OUT`, `PROTEIN_BARREL_IN`
  and `proteinIn(kind)` are now the single source all three derive from. Any
  shape with things entering, leaving or resting against it wants this.
- **A mechanism the kid is meant to count must be a pure function of the clock.**
  The pump's cycle lives in `stage/proteins.ts` as `pumpStateAt(ms)`, so the
  stoichiometry on screen and the stoichiometry in the tests are the same thing —
  three sodium out, two potassium in, energy spent once, never both mouths open.
  Any mechanism with a number attached should be written this way.
- **Every change explains itself, through one funnel.** All mutations go through
  `state/experiment.ts`, which snapshots before and after and hands both to
  `core/consequences.ts`. The wording is computed from the real numbers, so it
  cannot claim something the simulation did not do — and no control can forget to
  explain itself. The answer to an action belongs ABOVE the controls: a
  consequence below the fold is a consequence nobody reads.
- **Sequencing logic does not belong in the animation loop.** A headless browser
  reports a frame delta of zero, so timed playback never advances and no
  screenshot can check it — a stalled demo and a working one look identical. Keep
  the advance rule pure in `core/` and drive a whole run from a test, at several
  frame rates.
- **An ending is not a state to be dismissed.** Hold the last moment like any
  other, then finish: back to rest, with the primary button offering another go.
  A separate "again" and a separate "close" are two controls for "I have finished
  looking at this".
- **Watch for config that can never fire.** The first item in a
  crossed-a-threshold sequence is never crossed, because it sits at the start —
  so its pause silently did nothing until the rule that consumes it was made
  explicit.
- **A primary action should not disappear when used.** The fire button and the
  transport were two panels swapping places, so the moment a child pressed the
  thing, nothing on screen still said what it was called — and its replacement
  opened with a bare ▶, which means "resume" to someone who has not started
  anything. One control, whose play button IS the fire button, labelled with what
  pressing it will do.
- **Give every icon a word.** ⏸ and ↻ alone are guesswork at this age. And fix the
  control's width so the bar does not jump as the label changes.
- **One quantity, one instrument.** A number in one corner and a marker sitting at
  that same number in another is not two readings, it is one reading told twice —
  and splitting it hides the relationship instead of showing it. Merge them, and
  draw the marker in the reading's own colour so the connection is visible.
- **When merging, the always-true thing is the subject.** The voltage number is
  the panel's headline and the spike trace its body, because the reading is a fact
  and the curve is a prediction until a spike runs. The other way round would file
  the resting voltage inside something captioned "what a spike would do".
- **A reading needs a frame to be read against — where there is something to
  read it against.** The voltage meter floated over a membrane patch dense with
  ions and merged into them, so it gained a bordered screen-space panel holding
  its reading, scale and marks together. This is not a blanket rule for all
  chrome: the hillock indicator sits over near-empty space on the whole-neuron
  view and needs no box. Judge it against what is actually behind the reading.
- **An event is a POSITION, not an elapsed time.** The action potential's state
  is one number, 0→1, and every reading is a pure function of it. That is what
  makes pause, scrub and replay free — there is nothing accumulating to rewind —
  and it means the whole scene scrubs together, since gates, aura, charge marks,
  meter and graph were always reading the same number. Prefer this to a start
  timestamp for anything a kid might want to stop and look at.
- **A prediction can be shown before it happens, if it is exact.** The spike's
  trace is drawn at rest, faint, as the shape a spike would have from here —
  because it is a function of the gradients, not a recording. Dragging a gradient
  reshapes it immediately, which is the fastest way to show that the spike is a
  consequence rather than an animation.
- **Moving the viewpoint is not a change to the world.** Scrub and pause do not go
  through `applyChange`; only things that alter the membrane do. Otherwise the
  consequence panel fills with narration about looking.
- **Subscribe to the narrowest thing that matters.** A per-frame store value wired
  into a React panel re-renders it sixty times a second to print an unchanged
  word. Select the phase, or a boolean, not the live object.
- **Every value a frame loop reads goes in a ref — including the ones that arrive
  as ordinary reactive state.** A `requestAnimationFrame` closure with a narrow
  dependency list captures its scope once, so a store value read plainly in the
  component body is frozen at mount for the drawing while React keeps updating the
  words. The bench shipped like this: the dial said +75 mV, the panel said
  "reversed", and every chamber painted its charge for the −72 mV it started at.
  A stale draw is invisible in a way a stale label is not, and the two halves
  disagreeing on screen is the only symptom. If a value is used inside the loop,
  mirror it into a ref beside the others in the same commit that reads it.
- **Words and picture are built from the same numbers.** A describer beside an
  exhibit reads the live state directly — the driving force, the balance point, the
  mark count — rather than restating what someone believes is drawn. Then a
  drawing bug shows up as a contradiction on screen instead of hiding behind
  agreeable prose.
- **A describer may not be dismissible.** The first version of the bench's notes
  was a draggable, toggleable overlay, and the flaw was structural: because it
  could be shut, the LIVE half — the part that says what the control just did —
  was only there for someone who already knew to ask for it. Tips can hide;
  "Right now" cannot. It is a fixed column beside the exhibit, in the same
  bordered-block house style as every other describer, sharing `Section` rather
  than reimplementing it.
- **`minmax(0, 1fr)`, never a bare `1fr`, for a column holding a measured canvas.**
  A plain `1fr` is `minmax(auto, 1fr)`, so its floor is the column's min-content —
  and a canvas given an explicit pixel width from a `ResizeObserver` reading of its
  own box feeds that measurement straight back into the column's minimum. Wider
  canvas, wider column, wider canvas: a ratchet that ends in a horizontal
  scrollbar. Position such a canvas absolutely as well, so it contributes nothing
  to intrinsic size and the box measures only the space available.
- **Resolution decides what may be drawn as happening.** One ball on the bench
  stands for a couple of millimolar, so at equilibrium NO ball may cross: the
  real two-way traffic is far below what a ball can represent. Showing it anyway
  produced a ball bouncing off the membrane. Same rule as the spike's cost — when
  the true effect is below the display's resolution, show the state and let the
  words carry the mechanism.
- **A wiggle must be smaller than the margin it sits in.** Jostling is how motion
  without transport is drawn; if the jiggle can carry a particle across a barrier,
  it is telling the opposite story.
- **Half of a journey should be the approach.** Paths that all end at the same
  opening read as a crowd pouring through it; if the crossing takes most of the
  time, the same balls read as separate events queueing.
- **Let the force set the speed.** A push worth ten times another should look ten
  times as urgent, not merely produce more of the same-speed events.
- **Build a gradient once per frame, not once per object.** A canvas gradient is
  defined about the origin and painted through the current transform, so one
  serves every particle of a species.
- **Anything drawn IN ADDITION to the population will read as spawning.** The
  equilibrium swap was two extra balls layered over a conserved crowd, and they
  popped in and out — the same complaint the conservation work had just fixed,
  reappearing in the piece added to fix it, and only visible once the main flow
  stopped and the eye had nothing else to follow. Travellers must BE population
  members, left out of the static pass while away.
- **A looping animation has to return to where it began**, or the wrap is a
  teleport. A one-way loop needs a real event behind each repetition; a repeating
  one needs to be a round trip.
- **A direction flag that also swaps the endpoints will invert something.**
  `journey()` chose which channel mouth came first AND reassigned source and
  destination from one boolean, so every outward crossing ran backwards. Pass
  things in the order they are used and let the caller name it.
- **If a thing can be counted, make it conserved.** Two attempts at bench traffic
  failed the "no particles from nowhere" rule — extra dots animated in, then crowd
  members that faded at the reset — because the count and the picture were separate
  facts. The fix is to make them one fact: the balls are the amount, and a crossing
  is drawn because a ball's side actually changed. Then nothing needs to fade,
  because nothing needs hiding.
- **Prefer letting the system find the answer to asking the kid to hunt for it.**
  The same equation solved for the other unknown turned a search into a
  demonstration — and made "how much crosses" a visible measure of how far the
  setting was off, with no numbers to read.
- **A guard rail can quietly become the answer.** Flooring ion counts at half a
  ball kept a logarithm finite and also fixed calcium's balance point at the wrong
  value and blocked it from ever reaching equilibrium — the settling stalled against
  the floor. Keep guards far away from anything the app displays or converges on.
- **An exhibit still has to obey the scene's rules.** A drawer is a different
  place, not a licence: crossing ions on the bench arrive out of the crowd and
  leave into it, the same as everywhere else. Where the crowd is small enough to
  count, "emerge from deep anonymity" is not enough — the traveller must leave and
  arrive at REAL crowd positions, placed by the same function as the static ones.
- **Never `ctx.filter` per object in a draw loop.** A blur on thirty small arcs per
  frame per panel stopped the page dead — and the failure showed up as a
  screenshot that never returned, not as a slow one. Soft edges come from
  gradients.
- **Two formulas agreeing is not a test.** A sign error inverted both pushes on an
  ion, and the test passed because it checked that they summed to a driving-force
  formula that was inverted the same way. Assert against the thing that MOVES —
  does this arrow point where the ion goes — not against a second expression of
  the same arithmetic. A screenshot caught what the suite could not.
- **A colour may not carry two meanings.** Red and sky mean charge SIGN on every ±
  mark in this app, so colouring a force arrow red for "inward" quietly overloaded
  them. Colour by the established meaning; let shape or arrowhead carry the rest.
- **A sandbox keeps its own copy.** Demos that ARE the membrane share the cell, so
  an experiment in one holds in another. An exhibit that says "this is not your
  neuron" must not be able to reach into it — the balance bench has its own
  concentrations, or fiddling on a lab bench would silently rewrite the cell it is
  teaching about.
- **A force has two halves; never show only one.** Which way an ion moves comes
  from the DRIVING FORCE, `V − E`, not from the concentration gradient — and the
  ion's charge decides the sign, so chloride moves inward at a voltage where the
  current it carries flows out. Where the two halves cancel the ion does not move
  at all, however wide the door, and that voltage is the one thing in this topic
  worth building an exhibit around. Showing crowding alone had sodium pouring in at
  the peak of a spike, which is the moment its inflow ends.
- **Two questions, two exhibits — one cell.** A membrane patch answers "what
  happens when a spike runs?" and "what makes an ion move?", and those want
  different controls and different readouts; having to LOCK the ion sliders during
  a spike was the symptom. The demo chooses what is shown and what is reachable.
  It must never own the cell: concentrations, pump and leaks stay shared, so an
  experiment set up in one exhibit still holds in the other.
- **Do not show the answer before the question.** A faint preview of the whole
  curve made the graph legible and spoiled the surprise — a child should be able to
  wonder what comes next and be caught out by the undershoot. Draw only what has
  happened. Reference lines are fine: they are properties of the gradients, not of
  the event.
- **Let a size be the label.** Two pushes are a small lightning and a big one, on
  buttons of the same shape. Nothing to read, nothing to decipher, and the proper
  term is kept for the sentences that explain what happened — where a word is worth
  learning rather than worth guessing.
- **Fix the scenario's magnitude, not its outcome.** Named pushes carry absolute
  amplitudes, so which one fires is the mechanism's to decide. Scaled to the
  current threshold, "the one that fires" would keep firing however badly the
  gradients were wrecked — the app protecting its own story instead of reporting.
- **A failing case needs its own script, not the winning one with gaps.** A push
  below threshold gets three moments of its own; borrowing the spike's would have
  put "the sodium door flies open" at the end of a run in which nothing opened.
- **"How far open" means a fraction of the thing's own full width**, never of what
  this particular run happened to reach — or a run in which almost nothing happens
  reports everything as wide open.
- **A property that only exists in feedback needs a model with feedback.**
  Threshold is not a shape, so no envelope in time can produce it. The gates
  answer to the voltage and the voltage answers to the gates, integrated. What
  came free: the all-or-nothing law, a spike that fails when the gradients cannot
  support it, and the cost of a spike as an integral rather than a
  back-calculation.
- **An integrator can still be a pure function of position.** Integrate ONCE into
  a table indexed by position and memoise it on its inputs. Every reader stays
  pure, pause and scrub keep working, and nothing is scripted — the equations run
  again whenever the inputs change. This is what let a closed-loop model land
  without touching N17.
- **A better model must not silently overturn an older lesson.** Started from its
  own steady state, the closed-loop model has blocking the leaks send the voltage
  DOWN, not up — real physics, and the opposite of what checkpoint A teaches. Two
  different resting voltages on screen would be worse than either, so the
  integration starts at the voltage the rest of the app derives and its leak is
  solved to make that a true equilibrium. When a new model disagrees with a
  shipped lesson, decide which claim the app makes — do not let both be true in
  different corners.
- **Derive the EVENT, not just the number.** The action potential is not a curve
  drawn over time. `core/actionPotential.ts` describes two conductances and reads
  the voltage off the same chord-conductance equation the resting potential comes
  from, so the peak, the undershoot and the return are consequences of two
  proteins with different timing. This is what lets a flattened gradient break
  the spike with no special case written for it.
- **A shut gate has to be shut.** A smooth S-curve standing in for something that
  is genuinely off never reaches zero, and the remainder is not always harmless:
  2.5 % of the sodium peak is a quarter of the leak conductance, and it moved the
  resting voltage 33 mV before the spike began. Subtract the value at rest.
- **The picture and the model share one authority.** `gateOf()` reads the spike's
  own conductance envelopes, so a channel drawn open is a channel the voltage was
  actually computed from. Two clocks for one mechanism will always drift apart.
- **A section scrolls; the column does not.** Each panel keeps its border and
  heading fixed and moves its own contents, and the explanation block takes the
  leftover height. Scrolling the whole column solved the squeezed-to-nothing
  problem but took the headings with it.
- **Show the flux, never a fake change in the pile.** The display quantum is one
  ball = 1 mM; a whole spike moves 0.005 mM. Animating the sliders would overstate
  it two-hundredfold, so during a spike they lock and what moves is the flow —
  direction and a running total in mM. The bars holding still IS the lesson. When
  a real effect is below the resolution of the display, show the rate instead, and
  say why the reading does not budge. (Where that rate is SHOWN is a separate
  question: it belongs with the mechanism it is about, not tucked into the
  resting-state controls — the live spike readings were moved out of the ion
  section for that reason and wait for N17's graph.)
- **A signed field needs one ramp through a neutral middle, not two hues.**
  Choosing a colour by the sign of a value makes the crossing a switch: red, off,
  blue. Interpolate through the neutral instead, keep the field always faintly
  present, and shape the strength with an exponent nearer 1 than 0.5 — a square
  root is steepest exactly at the crossing, which is the worst place for it.
  Charge draining away should look like metal cooling.
- **Normalise a direction by how far it can actually go.** Depolarization reaches
  toward sodium's own voltage, hyperpolarization toward potassium's, so each side
  is measured against its own limit. That is the honest question for the picture
  and it dissolves the asymmetry that a curve-fudge was hiding.
- **One charge-colour ramp, shared — and it may mean different things in
  different exhibits, provided each exhibit's zero is unmistakable.** `chargeRamp`
  in `stage/particleStyle.ts` serves both. Over the neuron it shows deviation from
  resting; on the bench, where a battery imposes the voltage and there is no
  resting value to be relative to, it shows polarity itself. Two meanings for one
  visual is a debt. It was first paid by colouring the battery to match, which
  turned out to be the wrong currency — see the rule below on colouring controls.
  What pays it now is that on the bench "no colour" and "no voltage" are the same
  pixel: the compartments are built from the ramp's own neutral, so an uncharged
  membrane looks uncharged, and the ± marks and field arrows make the cause
  visible in the place it acts.
- **Never tint a control with a state colour.** A colour on the thing you are
  holding reads as a promise about what will happen, so a control may only wear a
  colour it can actually keep. The battery cannot: which way an ion moves is the
  sign of (Vm − E_ion) times its charge, PER SPECIES, and one number cannot say it
  for four ions. The dial states its value and claims nothing further. When a
  control loses its accent colour, set a deliberate neutral rather than removing
  the property — the browser's own accent is a new cue, not the absence of one.
- **The reference that predicts flux is the ion's own Nernst voltage — never rest,
  never zero.** At rest the deviation is zero while sodium carries ~130 mV of
  driving force and potassium ~20; they cancel in net current, not per ion. And
  0 mV is not special for any ion. So a rest-relative or an absolute reading is
  chosen for what it makes legible — deviation over the neuron because that is
  what depolarized and hyperpolarized MEAN, absolute on the bench because a
  battery imposes the voltage — and neither is allowed to imply a direction of
  movement. Direction is per-species and belongs at the doors (`flowOf`) and on
  each ion's balance mark.
- **Hue is spoken for; only lightness is free.** Once a hue carries a meaning,
  nothing else may use it decoratively. Compartments on the bench were told apart
  by two dark colours, and the inside's slate-900 is a navy — so the cytoplasm
  claimed a negative charge at every setting of the dial, including a reversed
  one. They are told apart by lightness of the ramp's neutral now. Check a new
  background against the ramp before choosing it, not after.
- **The bath is the zero, and it is drawn as such.** A membrane voltage is the
  inside measured against the outside, so the extracellular side is the reference
  and is left untinted. That is not a gap in the picture; it is the convention made
  visible. Tinting both sides would state two facts ("inside positive AND outside
  negative") where there is one ("75 mV across this, inside high"), and both bulk
  fluids are electroneutral anyway — the charge is the skin on the two faces, and
  the ± marks already draw it symmetrically.
- **Encode a quantity by count when the physics is proportional.** A membrane is a
  capacitor, so Q = C·V and twice the voltage is twice the charge held apart: the
  ± marks on the faces scale in NUMBER, and the proportionality is asserted in a
  test rather than merely the monotonicity. A count is also something a child
  watches change one at a time while dragging, where opacity is only noticeable
  against a memory. Reserve opacity for things that genuinely fade.
- **Encode a field's strength in weight, never in length.** E = V/d with d fixed,
  so a stronger field is a heavier arrow across the same gap. An arrow that grew
  longer would claim a force in the water beside the membrane, where there is
  none. Give a field its own neutral colour, too: the charge hues already mean
  "this much charge, of this sign", and a field is neither.
- **An aura shows deviation from rest, not absolute state.** A cell at rest is
  already polarized; an absolute aura would be permanently on and the small
  hyperpolarizing dip invisible against it. Deviation-from-rest is also what the
  words depolarized and hyperpolarized mean. Scale it as a square root when the
  two directions differ by an order of magnitude, so the small one stays visible
  without the ordering being falsified. Absolute polarity stays with the charge
  marks — two channels, two jobs.
- **A list of parts is navigation, not a control board.** Tapping a protein opens
  its explanation, and whatever intervention it allows lives beside those words.
  Still no button that opens a channel: each answers to its own cause.
- **An event may set emphasis, never overwrite a control.** A spike brings sodium
  and potassium forward, but only when the kid has not said what to look at, and
  it writes nothing to the store — so there is no setting to restore and nothing
  that looks like the app changing a switch behind their back. Emphasis is derived
  at the point of drawing; the control belongs to the person.
- **If a fast thing matters, stop on it.** The spike is told as numbered moments
  with real pauses, each position measured off the model and each captioned with
  what to look at. Pacing may be uneven where physics is not: every reading is
  still a pure function of the position.
- **A change is far easier to see than a state.** Flash a gate at the instant it
  opens, derived from "how far past the moment are we" rather than detected
  between frames — so it also fires when the timeline is dragged backwards. And
  strictly one-sided: a centred window pre-announces the event, which had a
  channel glowing while its own caption said it was shut.
- **Hand-written words and measured numbers must be compared by a test.** Captions
  drift from the model silently. The step order is asserted against the model's
  own gate crossings, because that is exactly the disagreement no type check can
  see.
- **A threshold measured in the wrong units reorders the story.** "Open" as an
  absolute conductance meant a wide channel counted as open at 4 % of its own
  maximum, which put potassium's door open before the peak and made the captions
  lie. One drawn channel stands for a population: open means a fraction of its OWN
  widest.
- **Dimming must never open a hole in a barrier.** Drained proteins faded toward
  the background left their slot in the lipids reading as a gap in the membrane —
  and "ions cannot cross except at a channel" is why the bilayer is drawn at all.
  Take the colour out; leave the substance.
- **Two honest rules that disagree both get the light.** A protein is emphasised
  for carrying the current OR for having just changed. Share alone spotlit sodium
  on the beat announcing potassium; both were true, and showing both is better
  than picking one.
- **Name the thing, not just show it.** The voltage readout says DEPOLARIZED and
  HYPERPOLARIZED, because those are the words the lesson turns on and a bar
  climbing a scale never says them. Prefer a number and a word to an instrument.
- **Emphasis is a share of the mechanism, not a list of favourites.** Which
  protein matters changes THROUGH an event, so it is derived from how much of the
  current each one is carrying right now. The spotlight then hands over from
  sodium's channel to potassium's to the plain leak on its own, in the order the
  narration already describes, because it is reading the same mechanism. A
  hand-written list of "relevant" parts would have dimmed the leak channel — which
  sets the voltage the spike starts and ends at, and is what brings the membrane
  home afterwards.
- **Never build a fresh object inside a store selector.** It fails the equality
  check on every call and the component re-renders forever — a blank page, not a
  slow one. Publish it from the animation loop instead, coarsely quantised, the
  way the live spike reading is published.
- **A thing's colour can name what it is FOR, if it stays what it is.** Channels
  are tinted with the species they pass, so selectivity is on the drawing and not
  only in the panel, and the selectivity filter — the part that physically does
  the choosing — is painted at full species strength. But the tint is blended into
  the protein bronze: proteins, lipids and ions have to stay three different kinds
  of thing, and a channel drawn in flat sodium gold reads as being made of sodium.
  The pump is left uncoloured because it carries both ions, which turns out to be
  the visible half of "a machine, not a hole".
- **Screen time and biological time are different units, and one of them is a
  fact about neurons.** A lag scaled by the animation duration was reported as
  "276 ms later" in one panel while another said "0.7 ms" about the same event.
  Anything quoted as a duration of the biology must be in the biology's units;
  screen time may only be described as screen time.
- **One mechanism per job.** A speed control and staged pauses were two ways to
  slow the same demonstration down. Worse, the speed control was a thing the child
  had to find in order to see the lesson properly — which means the default had
  already failed. Fix the default; delete the control.
- **A figure the app quotes about itself has to follow the app.** The AP owns up
  to being ~375× slower than life, so the slow-motion speeds make that 1,500× and
  the sentence is a function of the speed, not a constant. Anything self-describing
  — magnification, slowdown, scale — belongs in a function of the thing it
  describes.
- **Slow motion slows the POSITION, not the model.** Because the event is a
  position rather than an elapsed time, playback speed is one multiplier in the
  loop and every reading, pause and scrub keeps working untouched.
- **Emphasis needs a positive half.** Dimming alone does not work: a bronze shape
  at a third opacity still reads as bronze. The state being pointed at gets a
  white halo, a lit outline and a ringed label; the rest have their COLOUR drained
  as well as their weight, because hue separates things that alpha does not. White
  for the spotlight, always — a species colour would be read as that species.
- **"Nothing is emphasised" is a state, not a value.** It is not the same as
  "everything is at full strength": one is the resting picture, the other says
  every element is the important one. Model it as `null`, not as 1.
- **Dim must not read as absent.** Greying a species out says "not the story
  here". Whatever is still really happening to it belongs in the words — chloride
  keeps crossing during a spike and helps hold the peak down, while calcium has no
  doorway at all, and those are two different silences.
- **"The readout IS the control" holds only while both want the same direction.**
  Mirrored back-to-back bars read beautifully and drag terribly: the two halves of
  one gradient answered the same gesture with opposite results. When the best
  reading direction and the best dragging direction disagree, the control wins —
  or split them into two elements.
- **Aligned baselines beat mirrored ones for comparing.** Back-to-back bars show
  asymmetry handsomely and make two lengths in opposite directions hard to judge.
  Stack them on a shared baseline instead.
- **A spatial metaphor in the panel must match the picture.** Outside was LEFT in
  the panel and ABOVE the membrane on the canvas, while a comment claimed the
  panel put the piles "the way the cell has them". Stack the panel the way the
  scene is stacked, or drop the claim.
- **A spotlight beats a hide switch.** Focusing one species dims the rest and
  needs no undoing; nothing focused means everything is in colour. Hiding puts the
  burden of remembering on the kid, and hiding ions would misrepresent the cell.
- **Derive the headline number; never assert it.** The resting voltage is not a
  constant anywhere in the code — it comes out of Nernst plus the
  chord-conductance equation, from the gradients and the open channels. That is
  what makes "switch the leaks off and watch it collapse" possible at all, and
  it is why the pump cannot be blamed for it: the pump is not an input to the
  equation. Prefer a real equation the app can be *wrong* in front of over a
  number typed in to look right.
- **Give the cause, not the effect, as the control.** There is no button that
  opens a channel: the buttons depolarize the membrane or release a messenger,
  and the gates answer. A universal open/close switch would teach that channels
  are manual, which is the opposite of the lesson. Same rule as "signals never
  appear without a cause", one level down.
- **The clearest readout should be the control.** The gradient bars started as
  display-only with steppers beside them; the bar was what people actually read,
  so the bar became the slider and the steppers went away.
- **A view's own controls belong on the canvas.** Zooming in happens by
  clicking a ring in the scene, so zooming out is a screen-fixed button
  overlaying the stage rather than a side-panel row. Chrome that is not anchored
  to a structure is a real DOM button on top of the canvas, not a Konva shape:
  accessible, hoverable, and no coordinate maths.
- `ui/`: `ControlPanel`, `InfoPanel`, `AboutDialog`.

See the [roadmap](04-roadmap.md) for per-step status.
