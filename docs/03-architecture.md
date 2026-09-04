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
  synapse journey: arrival→binding, receptors→hillock, clearance→refill), each
  with its own transport control and hand-over, rather than one long run
  nobody can hold.

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
