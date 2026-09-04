# Implementation roadmap

Working agreement: **one step at a time, manual browser testing after
each step**, then update the status here. Feature IDs refer to
[01-feature-spec.md](01-feature-spec.md).

Statuses: `todo` · `in progress` · `awaiting manual test` · `done`

Architecture rules every step must respect live in
[03-architecture.md](03-architecture.md).

> Tables were converted from the original fixed-width layout to pipe tables
> so per-step history and feedback rounds can be appended as sub-steps
> (the pattern that carried the Atomic Playground through V1).

**Spec note:** steps 4 and 16 originally cited feature `N58`, which does not
exist in the spec. Read as **X04** (scale transition) and **C05** (signal
tracing) respectively.

---

## What the corrections taught — read before planning a step

Every rule below was paid for by a round of rework. They are stated in full, with
the bug that produced each, in [03-architecture.md](03-architecture.md); this is the
index a plan should be checked against **before** it is written, because most of
these were not caught by tests and could not have been.

### The recurring shape of the mistake

Nine rounds in, the same failure keeps arriving in different clothes:

> **A model can be right and the view still unreadable, and the view is where
> teaching happens.** Green tests were green through every single visual bug in this
> project. When a view is judged unreadable, rebuild the view — do not defend it
> with the model behind it.

Two exhibits were deleted on that ground and came back better as graphs. Plan for
it: **a step is not "build the model, then draw it".** It is *build the model,
measure it, then find the instrument that makes what it does visible* — and the
instrument is sometimes not the view you started from. A fact about a **sequence**
(the refractory period) cannot be taught by a picture of a **moment**, however good
the model is.

### Rules a plan must be checked against

**Words.** The canvas carries names and readings; the info block carries every
sentence; a button carries a label and/or an icon and nothing else — but never no
name. If the canvas already says it, the column must not repeat it.

**Camera and hand-over.** A view of its own is gated on *arrival* — in decades, from
either side — and the scene's opacity reads that same number. Pan while wide, which
means the first portion diving in and the last portion pulling out. Level of detail
dissolves rather than switching, and the two representations are never both on
screen.

**Clocks.** A clock belongs to the event it is timing, not to whatever is
re-rendering. A miniature never inherits a demo's pacing: a demo pauses so a child
can read, a neuron does not.

**Model.** Integrate once into a table indexed by position, then be a pure function
of it — that is what makes pause, scrub and memoisation possible at all. Seed
randomness. Carry fractional time and clamp the frame at the caller.

**Honesty.** Measure, never assert — and *keep the disagreement*, because it is
usually the mechanism. Say which numbers are calibrated and which are not drawn.
Declare every exaggeration beside the real number. Never quietly protect the story.
Pin any claim about what the app contains with a test, because such claims rot.

### Three diagnostics worth reaching for

1. **A result that does not change when the input changes is a broken parameter.**
   It caught the unit-confused clamp (every gap in an experiment produced the same
   answer) and the ohmic calcium current (quartering external calcium moved it 13%).
   Sweep a parameter and print a table *before* trusting a model.
2. **When two views must show the same event, measure the agreement rather than
   asserting it** — and write a second test that the difference is *not* zero.
3. **Draw the thing into a recording context and count the calls.** It proved the
   synapse model and scene were both correct and sent the search to the wiring,
   where a sibling shape was clearing the canvas.

### How a step should be sequenced

1. Read the feature row in [01-feature-spec.md](01-feature-spec.md) and the relevant
   sections of [03-architecture.md](03-architecture.md).
2. Ask what can be **derived** rather than asserted, and what the honest boundary of
   the step is — what it must *refuse* to draw because it is not built.
3. Build the model. **Measure it and print a table** before drawing anything: peaks,
   timings, and a sweep of whatever the child can change.
4. Choose the instrument that makes what you measured visible. If the natural view
   cannot show it, that is a finding, not an obstacle.
5. Draw it, reading every value from the run at a position.
6. Write tests that pin the *findings*, not the implementation.
7. Update the spec-status table, append the step's record below, and hand over with
   manual test steps.

## Step 0 — Scaffold & stack smoke test

| Step | Features | Scope | Status |
| --- | --- | --- | --- |
| 0 | — | Establish app shell, canvas/stage, side information panel, top-level view navigation, animation loop, responsive layout, state store, unit-test setup. Reuse the proven interaction architecture from Atom Builder where practical. | done (2026-08-23) |

Manual test target: app starts, main neuron renders, a draggable test object
moves smoothly, info panel opens, navigation preserves view state.

Delivered: Vite + React 19 + TS + Tailwind v4 + Konva + Zustand + Motion +
Radix + Vitest; kept-mounted sibling views (neuron / membrane) so canvases
keep their state; placeholder neuron with a `Konva.Animation` loop; draggable
glossy Na⁺ test ion; info panel in the house style; Radix + Motion dialog;
`core/ions.ts` with the four V1 ions; GitHub Pages deploy workflow.

## Milestone 1 — The neuron in its network, and the scale map (N01–N07)

**Revised 2026-08-23** after a design review of the first attempt. Three
problems with the isolated-neuron version drove the change:

1. **The action potential appeared inside the axon with no cause.** Selecting
   the axon simply materialized a signal at its start — teaching that axons
   generate signals spontaneously. The root cause was that nothing upstream
   existed on screen for a signal to come *from*.
2. **The neuron was drawn alone**, which misrepresents what a neuron is: its
   entire function is listening to other cells and passing something on.
3. **Upcoming topics had no home.** A `Neuron | Membrane` page switcher made
   future views feel like separate apps — exactly what the spec warns against.

The fix folds all three together: a small **network scene** where every signal
starts at a fired input neuron, and a **zoom-target map** anchoring each
upcoming topic to the place on the neuron where it happens. Summation and
threshold (N18, S07–S08) come earlier than originally planned, because they
fall out of the new layout for free.

| Step | Features | Scope | Status |
| --- | --- | --- | --- |
| 1 | N01–N06, N18, S07–S08 (early) | Three-neuron scene; anatomy selection; the full causal chain from a fired input to the target cell, with summation and threshold; zoom-target map with a working camera. | done (2026-08-23) |
| 2 | N07, X04 (partial) | Membrane cross-section as the content of the **axon-membrane and dendrite-membrane zoom targets**: lipid bilayer, inside/outside, at honest magnification. Level-of-detail from line → tube → bilayer. No separate view — the camera goes there. | done (2026-08-23) |

**Milestone 1 complete** — N01–N07 all delivered. Two steps drafted here were
moved rather than done, because both are cross-cutting polish that wants the
content to exist first (which is where the original spec had them):

- **F02 explanation depth levels** → Milestone 9. Writing two depth levels for
  every string before the content settles would mean retrofitting all of it.
- **Magnification scale bar and free wheel zoom** → after Milestone 2, when
  there are more populated zoom levels for a bar to describe.

### Step 1 (rebuild) — what was built

**The scene.** Three input neurons on the left, the focus neuron in the middle,
one target neuron on the right. Partners are drawn thinner and dimmer, with
flat somas and their own branches running off the canvas edges — the frame is
a window on a network that keeps going, not the whole world. Real counts
(thousands of synapses) are stated in the panel.

**Every signal has a cause.** Nothing moves until an input neuron is fired
(click it on the canvas, or use the one / two / all three buttons). The chain
then runs, slowly enough to follow:

input neuron fires → its own action potential runs down *its* axon → it stops
at the bouton and chemical messengers cross the gap → a graded ripple starts on
our dendrite and **fades** as it spreads inward → ripples **add up** at the
hillock, shown on a meter with threshold marked → *if* the total crosses
threshold, an action potential is born **at the hillock** and travels at
constant amplitude → vesicles release at our boutons → the target neuron gets
one small ripple, which on its own is not enough to fire it.

**Below threshold it fizzles.** One input is not enough: the total drains away
and the panel explains that it faded rather than vanished, and suggests firing
more together. Two or three fire it. That is the N18 lesson, discovered rather
than told.

**Three signal grammars** keep the hand-offs honest (see
[03-architecture.md](03-architecture.md)): graded ripples are small fading
glows, action potentials are bright constant-amplitude travelling segments,
and synaptic transmission is discrete pale particles crossing a gap after a
visible delay. No continuous glowing line ever runs from one cell into the
next — that would teach current in a wire.

**The zoom map.** Five dashed rings mark where upcoming topics live: incoming
synapse, dendrite membrane, axon hillock, axon membrane, outgoing synapse.
Clicking one glides the camera to that place and names its magnification; the
panel says what will be built there and which milestone brings it. The camera
is the Konva layer's transform, so hit detection stays correct while zoomed,
and chrome (labels, markers, meter) is counter-scaled to stay legible. The
page switcher is gone.

**Anatomy exploration (N01–N06)** is unchanged in spirit: every part is selectable
on the canvas or from the list, dimming the rest and swapping the panel to that
part's explanation and its own "what this simplifies" note. Part text was
revised to name the axon hillock as the action potential's birthplace, and to
state that dendrites never generate signals of their own.

**Locked down by tests** (46 in total — 5 ions, 15 neuron text, 11
integration, 15 chain): the axon carries a signal only when
`hillockLevel ≥ THRESHOLD`; a subthreshold run never puts anything on the axon,
never releases, and never reaches the target; every action potential starts
within the first 5 % of the axon; the phase order input → crossing → ripple →
summing → axon → release → target always holds; ripple amplitude decays
monotonically inward; and the teaching text still contains no decision
language.

Fixes during the rebuild: input-neuron axons were drawn as prominently as the
focus neuron (thinner and dimmer now, so the subject stays the subject); the
synapse site was computed as the tree's leftmost endpoint, which could place a
synapse on a branch the ripple never travels (it is now guaranteed to sit on
the ripple's path); the "dendrites" label overlapped a branch.

**Superseded from the first attempt:** `stage/motion.ts` (selection-driven
demos) is replaced by `stage/chain.ts` (event-driven causal timeline);
`ui/PageNav.tsx`, `ui/MembraneView.tsx` and `state/pageStore.ts` are gone,
replaced by the camera. `core/neuron.ts`, the dendrite geometry and the
drawing helpers carried over.

### Step 2 — the membrane, and one honest scale

**The scene now has a single real scale.** The soma is declared to be 20 µm
across, which fixes 4.4 px per µm, and everything smaller follows from biology
instead of from what looks nice: the axon is drawn 1.4 µm wide because that is
a realistic thin unmyelinated axon, and the membrane is 5 nm — **0.022 scene
pixels**, genuinely invisible until you zoom. Those numbers live in
`core/membrane.ts` and the geometry derives from them, so the teaching text
can never drift from the drawing. Tests assert the ratios the text quotes
(280× thinner than the axon, 4000× thinner than the soma).

**Level of detail.** A process is a line below ×5, a **tube** with a wall on
each side and cytoplasm between from ×5, and a real **lipid bilayer** from
×500 — two leaflets of round heads with tails meeting in an oily middle. The
membrane targets sit at **×2400**, chosen so the bilayer renders about 52 px
thick with 10 px lipid heads; at that magnification the axon is 14,784 px
across, so one wall fills the canvas and the picture becomes the textbook
view honestly, by zooming, rather than by switching to a different diagram.

**Both sides are named.** The cytoplasm side is tinted and labelled "inside
the cell — cytoplasm", the other "outside the cell", so the point of N07 — the
membrane separates two ionic worlds — is visible rather than asserted. A live
`×N` readout sits in the canvas corner, and the panel states the real
thickness and why this magnification is needed.

**The plunge is a journey.** Camera moves interpolate magnification
*geometrically* and last longer the more powers of ten they cross (about 3 s
for ×1 → ×2400, 1.2 s for a hop to ×7), so every zoom feels like the same rate
of travel rather than an instant jump followed by a crawl.

**Feedback round — the membrane must look impermeable.** The lipids were far
too sparse, and investigating why turned up a fourth bug: the lipid count came
from probing the whole axon for visibility, which at ×2400 overestimated the
visible span by more than ten times, so a capped number of lipids got spread
across it. The visible range is now derived from the view's own size around
the nearest point on the wall, and packing is explicit
(`LIPID_PACKING = 0.86`, heads slightly overlapping). Tails were also redrawn
in the classical style: each pair splays from nearly touching at the head to
well apart at the tips, with a kink partway down. The splay is deliberately
kept narrower than the packing spacing — wider, and neighbouring tails cross
into a dark mush instead of reading as legs.

**Feedback round — a sealed wall is its own misconception.** The filled version
read as impermeable, which is also wrong: a bilayer is a *liquid*. Final
version keeps small **irregular** gaps between molecules (packing 1.16 plus a
deterministic per-molecule jitter, so it reads as a jostling crowd rather than
a row of fixed pores), gives heads a radial gradient and tails a gradient along
their length so each molecule has a discernible shape, and drops the brown core
fill — it was invented to hide dark voids and is not scientifically required,
since the tails already mark the hydrophobic region. Only a whisper of neutral
tint remains there.

Scientific note recorded during this round, because the two requests pull in
opposite directions and the resolution is what matters: real packing *is*
shoulder-to-shoulder (~0.6 nm² per lipid), so persistent ion-sized gaps do not
exist, and **ions never cross through gaps at all** — what stops them is that
charge cannot enter a low-dielectric oily phase. Small uncharged molecules
(O₂, CO₂) do cross, by dissolving through the oil. The text now carries exactly
that: the gaps are real but transient, the membrane is not sealed shut, and
what blocks sodium and potassium is charge rather than size. Gaps are kept
narrower than a head so the coming lesson — ions can *only* cross at a channel
— is not undercut before channels exist.

**Earlier in the same round — tight packing was teaching the wrong barrier.** Packing the
lipids harder made the membrane look denser but left regular dark notches
between heads and dark slits between tails, and a dark gap reads as a pore:
the picture implied permeability is about *size and spacing* when the real
barrier is the oily middle. Fixed structurally rather than by packing tighter
(which only deepens the notches): the membrane is now painted as a
**continuous filled body** with the oily core inside it, and the lipids are
drawn as texture on top, so every space between molecules shows membrane
substance instead of a void. Packing eased back to 0.94 so heads read as
individual molecules again. The teaching text now says outright that the gaps
are not doorways, that the bilayer is fluid and closes any space at once, and
that what blocks ions is the oil rather than a lack of room — plus the honest
counterpart: oxygen and carbon dioxide *do* dissolve straight through, because
they carry no charge. Five new tests hold those claims in place.

Three further bugs found and fixed while verifying:

- **Canvas text vanished at high magnification.** Counter-scaling a font by
  1/magnification asks for a 0.005 px font at ×2400, which the canvas refuses
  to render — the compartment labels and the readout were simply absent. All
  canvas text is now drawn in **screen space**: the transform is reset to the
  device pixel ratio and anchors are mapped through the layer matrix by hand.
  Labels are now exactly 13 px at every magnification.
- **The camera lost the target mid-plunge.** Interpolating position linearly
  while scale grows geometrically means a positional error that is invisible at
  ×1 is half a screen at ×2400, so the membrane drifted off-canvas partway
  through. The pan now finishes in the first 55 % of the move: pan while wide,
  then plunge.
- **Zoom markers were clickable during the assembly animation**, which zoomed
  into a piece of axon that had not grown yet. They listened only once the
  neuron had finished building — moot since the animation was removed
  (see below), and the gate went with it.

### Known follow-ups (not blockers)

- Dendritic decay is uniform: all three synapses are treated as equally far
  from the soma. Distance-dependent weighting (a distal synapse having less
  say) is a natural X01 experiment later.
- Only spatial summation exists. Temporal summation (the same input firing
  twice in quick succession) belongs with the refractory-period work.
- One inhibitory input, landing on the soma or the axon initial segment where
  they really do, is the obvious next addition (S06, C03).
- The layout targets a desktop-width window (~1400 px), like the Atomic
  Playground. Responsive and touch behaviour stays in step 50.

## Milestone 2 — Ions, gradients & membrane potential (N08–N15)

| Step | Features | Scope | Status |
| --- | --- | --- | --- |
| 5 | N08–N09 | Ion data model for Na⁺, K⁺, Cl⁻, Ca²⁺; inside/outside concentration state; draggable/adjustable conceptual ion populations. | done (2026-08-27) |
| 6 | N11–N12 | Na⁺/K⁺ pump and leak-channel animations. Pump explicitly shows 3 Na⁺ out / 2 K⁺ in. | done (2026-08-27) |
| 7 | N13–N15 | Reusable channel component with channel type, gating state, conductance/permeability, and ion selectivity. Voltage-gated and ligand-gated examples. | done (2026-08-27) |
| 8 | N10 | Resting membrane potential view: voltage meter synchronized with ion/channel state. | done (2026-08-27) |
| 9 | X01 | Change-one-variable experiment. Every modification must identify the immediate and downstream consequences. | done (2026-08-27) |

### Step 5 — the ions, and the gradient you can change

**Ions now live in the membrane view**, drawn at their real hydrated sizes
(0.66–0.82 nm), which makes every one of them genuinely smaller than a lipid
head — and invisible until about ×1200, so they appear only after the bilayer
does. Sodium and chloride crowd the outside, potassium the inside, and calcium
appears outside only: with 0.0001 mM inside, its drawn count is honestly zero,
which is the whole reason a splash of Ca²⁺ later reads as a loud signal.

**Counts are pedagogical, proportions are not.** `particlesFor()` maps mM to
balls linearly (one ball ≈ 10 mM, floor 1, cap 15), so the lopsidedness between
the sides stays roughly true — 15 sodium out vs 2 in, 14 potassium in vs 1 out,
chloride 11 vs 1 — while staying countable. A test asserts every species' drawn
gradient still points the same way as the real concentrations do. The panel says
each ball stands for a crowd; the sizes, unlike the counts, are honest.

**The gradient is the kid's to change** (N09): steppers per species per side,
plus "back to the real numbers". Each row shows which way that ion *would* move
if a doorway opened, and the info panel narrates the current setup live — flatten
sodium and it stops claiming sodium is stored; flatten both and it says a
wide-open door would move nothing. That is X01 arriving early, and it works
before any channel exists.

**Nothing crosses, by construction.** Ion depth is clamped so no ion can ever
overlap the bilayer, and a test sweeps twelve seconds of jiggle for every ion in
the crowd to prove it. Ions are never still — thermal motion is procedural from
the clock, so no per-ion state is stored and nothing shimmers — but without a
channel they cannot get anywhere.

Two adjustments during the step: the membrane magnification went from ×2400 to
×3100 so an ion's charge mark (drawn as vector strokes, not text, at that size)
is legible; and the fire/parts controls are hidden while inside a membrane
patch, since neither has anything to act on there and they were squeezing the
explanation panel.

Raising magnification is the honest lever for legibility, since the sizes stay
tied to real biology and the readout states the factor — better than quietly
drawing ions too big.

**Feedback round — the crowd twitched on every change.** Changing one number
reorganized the whole canvas. Cause: the layout was a jittered grid whose
columns and rows were derived from the TOTAL count, and species were dealt
round-robin, so adding one sodium changed every ion's cell *and* its jiggle
phase. Fixed by making a place a pure function of the ion's own identity: each
species and side draws from its own stretch of the **R2 low-discrepancy
sequence**, whose defining property is that the first k points are evenly spread
for every k. Adding or removing an ion now appends or pops, and nothing else
moves — including the jiggle seed, so an untouched ion's motion stays
continuous. Four regression tests assert exactly that, comparing whole ion
objects before and after a change.

**Feedback round — one ball per click showed nothing.** The scale changed
instead of the step alone: one ball now represents **1 mM**, so the piles ARE
the real concentrations (145 sodium outside against 15 inside, 140 potassium
inside against 5 out), and each stepper press moves 10. Crowds of a few hundred
made the lopsidedness obvious where crowds of fifteen did not. Drawing that many
ions per frame needs one gradient per species reused by moving the context, the
same trick the lipids use — hundreds of gradient objects a frame would not do.

**Feedback round — the crowd sat in stripes.** The low-discrepancy sequence
covers an area evenly but is a rank-1 lattice: its points lie on families of
parallel lines, and the eye reads those as rows. Replaced with a **jittered
grid** — a fixed grid (never sized by the count, so the no-twitch property
holds) with a full-cell random offset per ion, which is standard stratified
sampling and looks naturally scattered. Species start at different cells so they
interleave.

**The concentration bars became the control.** Each half is now a slider —
drag either side of the membrane to set how much is there, still stepping by 10,
with the species colour as the accent and the outside half mirrored so its fill
grows away from the membrane. The ± steppers are gone: the bar was already the
clearest reading of the gradient, so it should be the thing you grab.

**Zooming out moved onto the canvas**, beside where you click to zoom in, so
both directions are worked from the same place; the magnification readout moved
to the top right to make room. The side panel no longer has a zoom button.

**Species can be greyed out** rather than hidden: 👁 per row dims that species
on the canvas to colourless grey and dims its row. Hiding ions outright would
misrepresent what the cell contains; greying lets one species be followed
through a crowded picture while the rest stay honestly present.

Also removed this round: the "About this playground" button, and **"Build it
again"**. The assembly animation itself was kept at the time, then **removed
entirely** in a later round at the user's request: the neuron is drawn complete
from the first frame and stays put. A 3.4 s growth-in delayed every visit to a
scene the child will open dozens of times, and the parts are named by their
labels and the side panel whether or not they were watched arriving. The reveal
plumbing (`ASSEMBLY_MS`, `PART_WINDOW`, `partReveal`, `ASSEMBLY_ORDER`, the
`assembly` field on `SceneState`, and the reveal fraction threaded through the
four part drawers) was deleted rather than pinned to 1 — it had been earmarked
for the myelin toggle (N20), but keeping dead plumbing threaded through six call
sites against a speculative future use costs more than rewriting a reveal for
myelin when myelin actually exists.

Note against the spec: N01's animation column reads "parts assemble into a
complete neuron". What is delivered is the complete neuron; the assembling is
not animated.

The panel was reworked earlier in the same round: each species gets a **mirrored
gradient bar** (outside grows left of the membrane, inside grows right) so the
lopsidedness is legible as a shape rather than two numbers to compare; "would go
in / would go out / nowhere to go" replaces a bare arrow; steppers disable at
their limits; the real concentrations are on hover; and a footnote states the
one-ball-≈-10-mM convention.

### Step 6 — the pump and the leaks

**The first proteins in the membrane.** A sodium-potassium pump and two
potassium leak channels sit embedded in each membrane patch, drawn at their real
widths (6 nm and 5 nm against a 5 nm membrane) — and the lipids are *interrupted*
where they sit, so they read as built into the bilayer rather than pasted on top
of it.

**The pump cycle is countable, and the count is tested.** Seven seconds per
cycle: three sodium leave the cytoplasm and settle in the cavity, both mouths
shut, ATP is spent (a green spark), the three sodium are released outside, two
potassium enter, the protein shifts back, the two potassium are let into the
cell. `pumpStateAt(ms)` is a pure function of the clock, so the tests check the
same thing a kid counts on screen: exactly three sodium and two potassium, never
both species at once, energy spent exactly once per cycle and only while both
mouths are shut, and never both sides open together — which would make it a hole
rather than a pump.

**Active versus passive is the point of the step.** The pump has a cycle, a
closed state, and a visible energy cost; the leak channel is a hole that is
simply always open, and potassium wanders out through it because that is the way
its gradient points. The text says outright that the channel does not push —
the gradient does.

**Both can be switched off**, because the way to see what something does is to
see what goes missing without it. The honest consequence is stated rather than
faked: with the pump stopped the gradients would run down *over minutes*, which
is why the piles do not visibly shrink; with the leaks shut the membrane stops
being selectively permeable, which is what the resting voltage depends on. And
the reason the piles hold steady while both are busy is the real one — at rest
the pump exactly replaces what the leaks let go.

**Guardrail kept:** the pump moves one net positive charge out per cycle, so it
does nudge the inside negative — and the text says so *while* stating this is
not where most of the voltage comes from (checkpoint A: the resting potential is
never attributed to the pump alone).

Two defects found while verifying: during the ATP phase all three sodium sat at
identical positions and read as a single ion, destroying the count (they are now
spread across the protein's width, with a test asserting held ions occupy
distinct places).

**Feedback round — ions travelled through the protein, not the pore.** Spreading
the three sodium sideways to make them countable had pushed them outside the
channel: a pore is barely wider than one ion, so anything offset across it moves
through solid protein. Ions are now spaced **along** the channel instead,
queueing one behind another — which is also how a real pump holds them, at
distinct sites at different depths. The sideways component is gone from the type
entirely rather than merely set to zero, so it cannot come back, and a test
asserts a carried ion has no field but its species and its depth. The pore's
waist was widened a little so a single ion clears the walls.

The two fixes together are a lesson worth keeping: making something *countable*
and keeping it *inside its channel* pull against each other, and the resolution
is to separate along the direction of travel rather than across it.

**Feedback round — the pump's inner opening looked blocked.** The pore ran only
to the end of the barrel, but the pump's body continues past that into its
cytoplasmic head, so a slab of protein sat below the opening. Fixed at the root
by giving the protein's extent a single definition — `PROTEIN_OUT`,
`PROTEIN_BARREL_IN` and `proteinIn(kind)` in `stage/proteins.ts` — from which the
body outline, both pore mouths *and* the point at which a carried ion is clear of
the protein all derive. The same mismatch was quietly affecting released ions,
which stopped inside the head rather than beyond it; ion travel is now asymmetric
because the pump reaches further into the cell than out of it. Open mouths also
flare slightly, so "open" is unmistakable. Two tests pin the geometry: a released
ion must clear the head rather than the barrel, and the pump must reach further
in than out.

### Step 7 — channels, and what opens them

**One component, four channels.** `core/channels.ts` describes a channel as
data — what opens it, what it passes, how fast, how wide — and the membrane now
holds a potassium leak, a voltage-gated sodium channel, a voltage-gated
potassium channel and a ligand-gated channel, all rendered by the same code.
Each is named on the canvas with its state beneath it.

**Every gate answers to its own cause, and nothing else.** `gateOf()` is a pure
function of the channel and its surroundings: the leak is always open; the two
voltage-gated channels watch the membrane voltage, sodium snapping open at once
and **potassium only after a 700 ms lag**; the ligand-gated channel watches for a
messenger and ignores voltage entirely. Tests assert exactly that distinctness —
including that potassium is still shut at the instant sodium opens (N14), and
that the ligand channel stays shut however long the membrane is depolarized
(N15).

**There is deliberately no button that opens a channel.** N13 suggests clicking
one open, but a universal open/close switch would teach that channels are
manual — the opposite of "different channel types have different gating rules".
The controls are the *causes* instead: depolarize the membrane, or release a
messenger. This is the same rule as "signals never appear without a cause" from
Milestone 1, applied one level down.

**The rule is written on the body, not just in the text.** A voltage-gated
channel carries its voltage sensor as red charge marks on its wall (red is
charge in the shared palette); the ligand-gated one has a binding cup on its
outer face, and the messenger is visible sitting in it when bound. Structure
carries function, so the types are tellable apart before reading a word.

**Flow follows the gradient, never the channel.** `channelIonsAt()` takes the
ion counts the kid has set and moves each species whichever way *its own*
gradient points, at a rate set by the channel's conductance. Flatten a gradient
with the sliders and its ion stops moving through a wide-open door; reverse the
gradient and the flow reverses — without the channel being told anything. Tests
cover flat, normal and reversed gradients, plus selectivity (a sodium channel
never passes potassium).

One flaw found, in a test rather than the code: I first checked conductance by
measuring what fraction of the time a channel was busy, which is identical for
every channel because each crossing is shorter as well as more frequent. The
test now counts crossings, which is what actually differs.

### Step 8 — the voltage, worked out rather than asserted

**Milestone 2's payoff: the gradients, the pump and the channels now produce a
number.** `core/voltage.ts` uses two real equations at a level whose *shape* a
child can follow — Nernst for the voltage each ion would be content at, and the
chord-conductance equation for where the membrane actually settles: the average
of those, weighted by how easily each ion can currently cross.

The numbers come out at textbook values without being tuned to them:
E_K ≈ −89 mV, E_Na ≈ +61 mV, E_Cl ≈ −64 mV, and a resting membrane at
**−72 mV**. A small background permeability for ions whose channels are not
drawn is stated in the code, because without it the cell would sit exactly at
the potassium voltage instead of a few millivolts above it.

**The meter is live, and everything already built feeds it.** Open the
voltage-gated sodium channels and it swings to about **+24 mV**; let potassium
follow a beat later and it is dragged back to about **−6 mV** — the rise and fall
of an action potential, out of two proteins with different timing, before
Milestone 3 has started. A messenger on the ligand-gated channel gives about
**+15 mV**: an EPSP. Flatten a gradient with the step-5 sliders and the voltage
follows.

**Checkpoint A falls out as an experiment rather than a claim.** Switch the leak
channels off and the meter climbs from −72 to about −41 with the gradients
completely untouched — permeability, not the pile, is what makes the voltage.
Switch the *pump* off and the meter barely moves. That contrast is the whole of
"the resting potential is not the pump's doing", and it is something the kid
does rather than reads. The pump is not even an argument to
`membraneVoltageMv()`, so it cannot be credited by accident; a test asserts the
function's arity to keep it that way.

**The voltage is visible on the membrane, not only in the gauge.** A thin skin
of excess charge hugs each face — red plus marks and blue minus marks, in the
palette's charge colours — and it flips when the voltage crosses zero: minus
inside at rest, minus outside at the sodium peak. Its density follows |Vm|, so it
thins to nothing as the voltage approaches zero. The panel says why the two ion
crowds never visibly change while this happens: only a vanishing number of ions
are involved.

**It settles rather than snapping**, with a ~320 ms time constant, because a real
membrane takes a moment to move charge on and off itself.

One fix while verifying: the meter's lower half overlapped the membrane band, so
it now sits in the extracellular space above it.

**Feedback round — transported ions blinked in and out at the channel mouth.**
The same "nothing appears from nowhere" rule as Milestone 1, one level down: an
ion that materialises beside a channel and vanishes past it teaches that channels
manufacture ions. Every transported ion — through a channel or carried by the
pump — now makes the whole journey: it comes **out of** the crowd on one side,
crosses the pore at full strength, and recedes **into** the crowd on the other.
It carries an opacity that fades only while far out among the other ions, where
one more or one fewer cannot be told apart, so the cycle's wrap is invisible.
The crossing itself gets a slow quarter of the trip, because that is the part
worth watching, and the gap between crossings now falls where the ion is already
transparent — so a channel's rate still reads as how often it is crossed. Tests
assert that anything drawn near a channel is at full strength (it must have
travelled there) and that the far ends of the journey are transparent.

### Step 9 — change one thing, be told what followed

**Milestone 2 closes with the pattern the whole app is built around.** Every
change now answers in three parts, in a sticky panel at the top of the column:
what you did, what it did to the membrane immediately, and what follows from
that.

**The consequences are computed, never written down.** `core/consequences.ts`
takes the state before and after and works the wording out from the actual
numbers — so it cannot claim something the simulation did not do. Shut the leak
channels and it says: *"The voltage climbed from −72 mV to −41 mV. Look at the
ion sliders: the gradients are untouched. The voltage came from potassium being
ABLE to cross, not from the pile being there."* Stop the pump and it notices the
voltage barely moved, says outright that the pump is not what makes it, and is
honest that the collapse would come over minutes rather than seconds.

**One funnel for every change.** `state/experiment.ts` snapshots, mutates,
snapshots again and records the consequence — so no control can forget to
explain itself. A fresh depolarization is judged with potassium still shut,
because that is genuinely the state for the next several hundred milliseconds,
which is what lets the panel predict the fall before it happens.

**The panel sits above the controls**, not below them: a consequence below the
fold is a consequence nobody reads. It is sticky, staying until the next change
so it can be read at leisure.

Two layout fixes came with it. The voltage meter on the membrane view now lives
in its own bordered panel — reading, scale and reference marks together — because
floating straight over the scene it merged into the ion crowd behind it, and a
reading needs a frame to be read against. Its scale also gained a little headroom
above sodium's own voltage, so the sodium mark reads as a mark rather than as the
edge of the meter. The panel is short and anchored to the bottom-left corner:
parked at the top it reached down into the membrane band and covered a channel,
and the corner below the membrane is the one part of a patch with nothing in it
that needs explaining. (The hillock indicator on the whole-neuron view was boxed
first, wrongly: out there the scene behind it is mostly empty and the counter-
scaled indicator was already legible, so it was restored.) And the left column
now scrolls as a single unit: with the protein and ion panels
both present at a membrane patch there is more content than fits, and the
explanation was being squeezed out of existence.

**Milestone 2 complete** — N08–N15, N10 and X01 all delivered. The membrane now
has ions with real gradients, a pump, four kinds of channel with their own
gating rules, a voltage derived from all of it, and a running commentary on
every change.

### How a step is handed over

Every feature ends with a hand-over for manual testing, because the tests check the
model and most of what goes wrong in this app is in the PICTURE — the three
sign-error myelin bugs, the invisible node flashes and the frozen gate ring were all
green the whole time. So each finished feature comes with:

1. **what was built**, in a few plain lines; and
2. **how to check it** — numbered steps saying where to click and *what should be
   seen at each one*, including what should NOT happen where a bug was just fixed,
   and naming whatever only a person can judge: timing, whether a shape reads,
   whether a colour carries.

A step that lands with nothing visible yet says so and gives no steps, rather than
inventing some.

## Milestone 3 — Action potential (N16–N22)

| Step | Features | Scope | Status |
| --- | --- | --- | --- |
| 10 | N16 | Action-potential state machine. Rest → threshold → depolarization → peak → repolarization → hyperpolarization → recovery. | done (2026-08-27) |
| 11 | N17 | Voltage-vs-time graph synchronized to membrane animation. Timeline scrubber should work in paused mode. | done (2026-08-27) |
| 12 | N18 | Threshold experiment. Variable stimulus strength; subthreshold vs threshold response. | rebuilt in step 16 as the spike-train bench — done (2026-08-27) |
| 13 | N19 | Propagation along axon. Explicitly model local regeneration rather than moving one persistent AP particle end-to-end. | done (2026-08-25) |
| 14 | N20–N21 | Myelinated/unmyelinated comparison. Nodes of Ranvier and relative conduction-speed demonstration. | done (2026-08-27) |
| 15 | N22 | Refractory period. Absolute vs relative refractory states; repeated-stimulation experiment. | rebuilt in step 16 as the spike-train bench — done (2026-08-27) |
| 16 | N18 + N22 (rebuild) | Spike-train bench: fire repeatedly, or weakly, on a live voltage graph. Replaces the on-canvas weak stimulus and the paired-pulse slider. Permanent "you are here" map of the whole cell. | done (2026-08-27) |
| 17 | C05 (spec: "N58") | Signature signal-tracing mode: follow the same AP from membrane to whole neuron. | done (2026-08-27) |

## The replan of 2026-08-27 — the deep-dive brainstorm

Milestones 4–9 below **replace** the original planning tables (synapse →
transmitter examples → circuits → brain → plasticity → polish). All step
records above and below this section stand unchanged. What changed and why:

- **One placement law governs every feature**: a part of the neuron is a place
  reached by zooming; an abstract concept is a drawer triggered from the view
  it extends ([03-architecture.md](03-architecture.md) → *Where a concept
  lives*). The drawer exhibits got spec IDs of their own (D01–D11, S12–S14,
  N23, P03–P05) in [01-feature-spec.md](01-feature-spec.md) → *2026-08-27
  revision*.
- **Synaptic transmission becomes a three-leg journey** at the outgoing-synapse
  zoom, drawing the models kept from steps 18–19 rather than new numbers, with
  three drawers of its own.
- **Consistency is a stated deliverable**: one biology, one drawing — the
  bilayer, channels and receptors reuse one code path everywhere they appear;
  structure exhibits keep the scene's schematic as a ghost and carry a locator.
- **Science corrections adopted from the brainstorm** (marked ⚠ in the spec;
  **confirmed by the user 2026-08-27** — if a later request contradicts one,
  the contradiction must be raised before building):
  1. LTP's growing receptor count is **AMPA's** — repeated stimulation does not
     create new NMDA receptors; NMDA supplies the calcium trigger.
  2. **One synapse's EPSP does not generate an AP.** Journey leg 2 ends by
     handing the EPSP to whole-cell summation — milestone 1's own lesson.
  3. Channel families are **voltage- / ligand- / mechanically-gated**;
     "ion-gated" is not a class.
  4. Glutamate clearance is mostly **astrocytic**; presynaptic-only reuptake is
     itself a misconception.
  5. Benzodiazepines raise GABA-A opening **frequency**, and do nothing
     without GABA present.
- **Circuits, brain and the learning layer are kept, not cut** — moved behind
  the deep-dive milestones as milestone 10, to be re-planned in detail when
  milestone 8 closes.

### Curriculum cross-check (2026-08-27)

A Parts I–VII topic sequence supplied by the user was checked against the plan.
Most of it was already covered (Parts I–II by the tested milestones 1–3 plus
the D01–D05 drawers; Parts III–V by milestones 4, 6, 7, 8). What it added:

- **D12 membrane capacitor** and **D13 patch clamp** (new spec rows) — into
  milestone 5. D13 is a *methods* exhibit: it shows where the app's own numbers
  come from, and D04's open-probability bench is drawn as its rig.
- **E/I balance and temporal summation** promoted from milestone 1's noted
  follow-ups into a real step (milestone 6, step 36).
- **Dendritic spine growth** folded into P04's spec row.
- Serotonin named in the transmitter selector (M01 already listed it).
- Milestone 10 scope enriched: interneurons vs projection neurons and
  feedforward vs feedback inhibition (Part VI); neural coding, the dopamine &
  reward system (with the M04 guardrail: never a "pleasure chemical"), and
  population activity / calcium imaging (Part VII).
- **The sequence itself**: the curriculum puts membrane & channel depth before
  synapses, and inhibition + integration right after excitation.

**Adopted order: M5 → M4 → M6 → M7 → M8 → M9 → M10.** The membrane deep dives
come first — they extend views that are already built and tested, and they are
where the curriculum starts; the synapse journey follows on a richer footing.

## Milestone 4 — The synapse journey (S12–S14, S05–S06, D06–D08)

One zoom target — the outgoing synapse — one scene, three legs, three drawers.
The scene is planned anatomy-first ([03-architecture.md](03-architecture.md) →
*Drawing a scene*), drawing the kept `core/synapse.ts` / `core/cleft.ts`
models. Each leg has its own transport control and hand-over; legs share one
consistent picture, so leg 1's scene is designed with legs 2–3 already on the
drawing board (postsynaptic spine, astrocyte process, receptor positions).

| Step | Features | Scope | Status |
| --- | --- | --- | --- |
| 18 | S01–S03 | Presynaptic terminal, Ca²⁺ channels, vesicle fusion — **model kept with its 33 tests**; view deleted for redesign (record below). | model done; view superseded by step 20 |
| 19 | S04–S05 | Cleft concentration and AMPA-type binding — **model kept**; view deleted for redesign. | model done; view superseded by step 20 |
| 20 | S12 (S01–S04) | Leg 1, arrival → binding: AP reaches the bouton, active-zone Ca²⁺ doors open, the four-site sensor fills, fusion, the cleft fills as a concentration, two glutamates bind per receptor. Ends at binding. | done (2026-09-04) |
| 21 | D06 | Drawer, vesicle life cycle & SNARE: dock → prime → zipper → fuse → retrieve → refill. The vesicle is a ring of the scene's own bilayer; the sensor is the scene's own sensor. | done (2026-09-04) |
| 21b | D17 | Drawer, reuptake & the glutamine round-trip: the tripartite synapse in section; astrocytic EAATs catch the drifting glutamate (the neuron a minor route), glutamine synthetase converts, SNAT doors ship it home, glutaminase converts back, the terminal's stock fills — the pool D06's refill rains from. Plan below. | todo (planned 2026-09-04) |
| 22 | S13 (S05–S06 excitatory) | Leg 2, receptors → hillock: AMPA opens (EPSP), depolarization pops NMDA's Mg²⁺ plug, Ca²⁺ enters the spine, the EPSP is handed to the whole-cell view where summation fires the hillock. ⚠ never one synapse = one AP. | todo |
| 23 | D07 | Drawer, AMPA & NMDA structure: clamshell binding, gates, the Mg²⁺ plug; receptors arrive by lateral diffusion and PSD capture, ⚠ not attraction through space. Ghost schematic + locator. | todo |
| 24 | S14 (S10) | Leg 3, clearance & recycling: astrocytic + presynaptic transporters empty the cleft ⚠ (astrocytes do most of it, or declare), endocytosis, V-ATPase re-acidification, VGLUT refill. | todo |
| 25 | D08 | Drawer, receptor kinetics bench: AMPA vs NMDA time courses side by side; coincidence detection (transmitter alone / depolarization alone / both). | todo |

## Milestone 5 — Membrane deep dives (D01–D05, D12–D13) — **first up**

Seven drawers hung on views that already exist and are manually tested.
Didactic order below follows the curriculum: structure → permeability → the
capacitor → channel structure → how we measure → gating → the cable.

| Step | Features | Scope | Status |
| --- | --- | --- | --- |
| 26 | D01, F04 | Bilayer structure drawer: one phospholipid's anatomy, amphipathy, self-assembly, the vesicle, term voice, real photographs. Same bilayer code as the scene — no second drawing. | done (2026-08-27, through corrections rounds 26a–26g) |
| 27 | D02 | Permeability bench: containers to fire at a bare wall — O₂/CO₂ through, water a trickle, ions and glucose never; toggleable aquaporin; measured coefficients in the info block. Charge, not size. | done (2026-08-28, through rounds 27a–27c) |
| 28 | D12 | Membrane charge: the step-8 charge skin quantified — Q = C·V on the scene's own 20 µm soma (12.6 pF) gives 5.6 million charges at −72 mV against 353 billion K⁺ inside, 1 in 63,000. Derived and pinned, never asserted; plus the charging delay. | done (2026-08-28, through rounds 28a–28f) |
| 29 | D03 | Channel structure: side & top views, four subunits, S4 sensor charges (the schematic's red marks, explained), selectivity filter — ⚠ K⁺'s filter excludes the *smaller* Na⁺ by paying for K⁺'s water shell exactly. | done (2026-08-28) |
| 30 | D15 | Inside the selectivity filter: two lanes, one clock, the energy ledger drawn at true proportion, the shortfall derived from the selectivity. | done (2026-08-30) |
| 31 | D13 | Patch clamp — how we know: a pipette seals on, one channel's current is square picoamp steps (seeded flicker); whole-cell is the sum of thousands. Methods exhibit: measure-never-assert, made visible. | done (2026-08-30) |
| 32 | D04 | Gating families & open-probability bench: ⚠ voltage-/ligand-/mechanically-gated, three lanes with three independent dials; Pₒ MEASURED off each record as a filling bar, and the curve those readings land on. | done (2026-08-30) |
| 33 | D05 | Leaky pipe: axial vs membrane resistance, length constant, what myelin does to the ratio. Draws `core/cable.ts`. | todo |
| 34 | D05 | **The leaky pipe** — how far a signal reaches. λ = √(d·Rm/4·Ra) drawn from `core/cable.ts`; the axon IS the hose; the child changes the WALL (leak doors, myelin) and λ answers. | done (2026-09-04) |
| 32b | D14 | Membrane constructor: drag channels and pumps from a tray into a bare bilayer; the built membrane's voltage is derived, not scripted. Spec row added 2026-08-27; scope to be planned when its turn comes. | todo (documented only) |

## Milestone 6 — Inhibition & integration (M03, S06–S07, D09–D10)

| Step | Features | Scope | Status |
| --- | --- | --- | --- |
| 34 | M03, S06 | The GABA synapse: the same synapse scene with a different cast — GABA-A passes Cl⁻, the meter shows an IPSP/shunting, the target's firing gets harder. The effect is the receptor's ion, not the molecule. | todo |
| 35 | D09 | Drawer, glutamate vs GABA side by side: two molecules one enzyme apart, their receptors, one logic. | todo |
| 36 | D10 | Drawer, benzodiazepine bench: allosteric modulation — nothing alone, more frequent openings with GABA. ⚠ frequency, not duration; X03 guardrail (mechanism only). | todo |
| 37 | S06–S07 (whole cell) | Inhibition and integration meet on the whole-cell scene (curriculum cross-check): an inhibitory input landing at the soma / axon initial segment where they really do; an E/I balance experiment (excite and inhibit together, watch the hillock meter); temporal summation (the same input twice, quickly). Promoted from milestone 1's noted follow-ups. | todo |

## Milestone 7 — Slow signals: metabotropic receptors & neuromodulators (M04, M06–M08, S09)

Kept **separate** from the ionotropic journey deliberately: the timescale
contrast *is* the lesson, and it needs the fast pathway finished and familiar
first. Same place — the synapse zoom — presented the way N21 presents myelin:
a **three-way switch on the view — ⚡ Transmitter / 🐌 Modulator / 🏁 Race
them** (decided 2026-08-27). The race is on the canvas rather than in a drawer
because both lanes are real synapses doing the real thing, which is the
canvas/drawer criterion; N21's race is the precedent and its fairness rules
carry over: both lanes share ONE window and one plain rate, nothing trimmed to
its own clock, and the clock may hurry only once the fast lane is finished —
which here it must, because the honest gap is not 2× but ~1000×, and that gap
leading the describer (ratio first, raw times beside it) is the whole lesson.

| Step | Features | Scope | Status |
| --- | --- | --- | --- |
| 38 | M04, M07 | The Modulator cast (GPCR) in the synapse view: transmitter binds, **nothing conducts through the receptor itself** — G protein → second messenger → a channel elsewhere changes its behaviour. Modulation drawn as changed open probability, never new current from nowhere. | todo |
| 39 | S09, M08 | The switch and the race: ⚡/🐌/🏁 modes on the synapse view, N21's pattern. Race describer leads with the speed ratio; the fast lane's done-ness stays on screen while the slow cascade completes. | todo |
| 40 | M01, M06 | Transmitter selector across the curated examples — glutamate, GABA, dopamine, acetylcholine, serotonin; neuromodulation as a state change across the whole scene rather than a point-to-point message. | todo |

(M05 acetylcholine → nicotinic and S11 enzymatic breakdown remain in the spec;
they slot naturally after milestone 7 as the enzymatic-termination example, or
drop to V2 — user's call.)

## Milestone 8 — Plasticity (P01–P05, P02)

| Step | Features | Scope | Status |
| --- | --- | --- | --- |
| 41 | P03 | Post-tetanic potentiation: residual presynaptic Ca²⁺ after a burst leaves release elevated — **derived** from the kept release model's calcium and fourth-power sensor, not scripted. | todo |
| 42 | P04, P01 | LTP: NMDA calcium → CaMKII → more AMPA receptors captured → bigger EPSP, on a strength meter (P01); the spine visibly enlarges with it (structural plasticity — narrated as accompaniment, not mechanism). ⚠ the count that grows is AMPA's. Extends D07/D08. | todo |
| 43 | P05 | LTD: low-frequency → modest sustained Ca²⁺ → phosphatases → AMPA removal. Same messenger, opposite outcome — the point. | todo |
| 44 | P02 | Learning challenge: train the pathway, watch the response change. | todo |

## Milestone 9 — Synapse diversity & dendrites (D11, N23)

| Step | Features | Scope | Status |
| --- | --- | --- | --- |
| 45 | D11 | Drawer, synapse gallery: the calyx of Held beside axodendritic/axosomatic/axoaxonic contacts, en passant boutons, electrical synapses and their no-delay contrast. | todo |
| 46 | N23 | Dendritic spikes at a dendrite zoom (advanced; may move to V2). Must revise milestone 1's "dendrites never generate signals of their own" text in the same step. | todo |

## Milestone 10 — Circuits, brain, learning layer (kept, deferred)

C01–C06, B01–B07, F01–F03, X02–X03 and the polish pass are unchanged in
content — their spec rows still govern — and deferred behind the deep-dive
milestones. Re-plan in detail when milestone 8 closes.

| Step | Features | Scope | Status |
| --- | --- | --- | --- |
| 46+ | C01–C06 | Circuits: two-neuron, chains, inhibition, feedback, tracing, "make B fire". Enriched by the cross-check: interneurons vs projection neurons; feedforward vs feedback inhibition as distinct circuit motifs. | deferred |
| — | B01–B07 | Brain structure & pathways. Enriched by the cross-check: neural coding in the sensory pathway (stimulus intensity → firing rate — the spike-train bench's lesson, one scale up); the dopamine & reward system (VTA/SNc, basal ganglia, ⚠ M04 guardrail: never a "pleasure chemical"); population activity & calcium imaging as the methods bookend to D13. | deferred |
| — | X02–X03 | Comparison mode; conceptual blockers (D10 is the first blocker-adjacent exhibit). | deferred |
| — | F01–F03, polish | Explanation depth levels, accessibility, touch, responsive, performance. | deferred |

## Scientific validation checkpoints

After each mechanism milestone, manually validate both the animation and
the underlying rule.

### Checkpoint A — membrane

- Na⁺ and K⁺ have correct charge signs.
- Pump direction is 3 Na⁺ out / 2 K⁺ in.
- Channels are passive pathways; pump consumes energy.
- Resting potential is not attributed to the pump alone.

### Checkpoint B — action potential

- Threshold is not "a fixed amount of Na⁺".
- Na⁺ channel activation precedes K⁺ channel-mediated repolarization.
- Action potential propagation is regenerative.
- Refractory period follows channel-state dynamics.

### Checkpoint C — synapse

- AP arrival opens voltage-gated Ca²⁺ channels.
- Ca²⁺ entry triggers vesicle release.
- Neurotransmitter crosses the cleft and binds receptors.
- Postsynaptic effect depends on receptor/channel mechanism.
- Signal termination is represented.

### Checkpoint D — network

- EPSP/IPSP inputs can combine.
- A neuron can receive multiple simultaneous inputs.
- Inhibition can suppress downstream firing.
- A neurotransmitter is not treated as having one universal behavioral
  meaning.

## Architecture guidance

Prefer pure, unit-testable functions in `core/` for:

- membrane-state transitions
- ion movement/driving-force calculations
- action-potential state machine
- channel gating state
- synaptic release state
- receptor effects
- circuit propagation
- curated neurotransmitter/receptor recipes
- brain-region metadata

Keep rendering/animation state separate from scientific state wherever
possible.

A useful high-level separation is:

``` text
core/
  ions.ts
  membrane.ts
  channels.ts
  actionPotential.ts
  synapse.ts
  receptors.ts
  neurotransmitters.ts
  circuits.ts
  brainRegions.ts

state/
  neuronStore.ts
  simulationStore.ts
  viewStore.ts

components/
  NeuronStage
  MembraneView
  ChannelView
  ActionPotentialGraph
  SynapseView
  CircuitView
  BrainView
  InfoPanel
  SideDrawer
```

The scientific model should remain usable without the canvas so that
tests can verify mechanism independently of animation.

As built (step 1): `core/` holds `ions.ts` + `neuron.ts`; `state/` holds
`pageStore.ts` + `neuronStore.ts` (selection and replay signals only);
`stage/` holds `layout.ts` (geometry), `motion.ts` (pure motion model),
`drawNeuron.ts` (canvas painting), `particleStyle.ts` and `NeuronStage.tsx`
(Konva wiring, hit shapes, the single animation loop); `ui/` holds the
panels. Per-frame values live in refs, never in the store.

## Animation rules

Animations must be long enough to reveal causality.

Do not optimize every biological event for maximum speed.

Important learning beats should have deliberate pacing:

1. stimulus
2. channel opening
3. ion movement
4. voltage change
5. next channel state
6. signal propagation
7. Ca²⁺ entry
8. vesicle fusion
9. transmitter diffusion
10. receptor activation
11. postsynaptic response

Where possible, allow:

- play
- pause
- replay
- slow motion
- timeline scrub

## Version 2 — explicitly deferred

- detailed Hodgkin-Huxley parameter editing
- voltage clamp
- detailed ion-channel kinetics
- detailed GPCR pathways
- STDP
- realistic dendritic computation
- large recurrent neural networks
- detailed cortical microcircuits
- 3D brain pathways
- richer comparative neuroanatomy
- additional neurotransmitters and receptor subtypes

The V1 application should remain a **mechanistic playground**, not a
general-purpose neuroscience simulator.

### Step 10 — the action potential, and a reorganization (N16, part of N17)

Brought forward by a five-part review: an aura for de- and hyperpolarization, a
prominent action-potential button on the canvas replacing the "Open the gates"
section, the ion gradients kept in view during a spike, focus-instead-of-hide on
the ion species, and the explanatory panels merged into one block.

**The spike is derived, not drawn.** `core/actionPotential.ts` describes only two
things — how wide the sodium door is at each moment, and how wide the potassium
one is — and the voltage comes out of `membraneVoltageFrom()`, the same
chord-conductance equation that gives the resting potential. Rest −72 mV, peak
+40 mV, undershoot −87 mV, back to rest: none of those numbers is written down
anywhere. They are consequences of two proteins with different timing, which is
exactly what an action potential IS.

The payoff is that failure is derived too. Flatten sodium's gradient with the
step-5 sliders and the doors still open on schedule, but the voltage only climbs
to about −15 mV and stops short of zero — because sodium's balance point is now
zero and the membrane cannot outrun it. The app says "that is a depolarization,
but it is not a spike" without any special case having been written for it. A
test asserts this.

**A shut gate has to be shut.** The first version had the gates as plain
S-curves, and an S-curve never quite reaches zero. 2.5 % of the sodium peak
sounds like nothing, but the sodium peak is 24 leak-channels' worth of
conductance, so the leftover was a quarter of the leak — and it dragged the
resting voltage from −72 mV to −39 before the spike had even started. The gate
now subtracts its own value at u = 0. Worth remembering whenever a smooth curve
stands in for something that is genuinely off.

**One authority for the gates.** `gateOf()` no longer asks "is the membrane
depolarized" — there is no such state any more, because a real membrane cannot be
held depolarized. It asks each channel how wide its own door is, reading the
spike's conductance envelopes. So what is drawn open is exactly what the voltage
was computed from, and the sodium channel closing itself mid-spike (inactivation)
is visible rather than asserted. `K_DELAY_MS` is gone: the potassium lag is now
measured off the model with `potassiumLagMs()`.

**Pushback on the live gradients, and what was built instead.** The request was
for the ion sliders to move during a spike to show the concentrations changing.
They must not, and the app's own units are what settle it. One ball is 1 mM. A
whole action potential moves **0.005 mM** of sodium — derived in `spikeCost()`
from specific membrane capacitance (1 µF/cm², the same for every cell), the
model's own voltage swing, the soma's 20 µm diameter and Faraday's constant. That
is **one two-hundredth of a single ball**: it would take about 192 spikes in a row
to shift one. Animating the sliders would overstate the effect by that factor,
and it would contradict text already in the app ("the two piles never visibly
change while the voltage swings about").

So the section stays in view and the sliders lock, but what moves is the FLUX:
each of sodium and potassium shows which way it is crossing and how much has
added up, in mM, to three decimal places. The bars holding still is the lesson,
and it is stated as such — the gradients are a huge battery and a spike is one
sip, which is also why the pump can keep up while working slowly. If motion is
wanted later, the honest form is an explicitly labelled exaggeration, not a quiet
one.

**The aura** shows the difference from REST rather than the absolute polarity. A
cell at rest is already polarized, so an absolute aura would be permanently blue
and the small hyperpolarizing dip would be invisible against it;
difference-from-rest is also literally what the words depolarized and
hyperpolarized mean. It tints the cytoplasm — the voltage is the inside measured
against the outside — strongest against the membrane and fading inward, since the
charge sits in a thin skin there. Red for positive-going, sky for negative-going,
the same colours the charge marks use, and the absolute polarity stays with those
marks. The intensity is a square root: the spike overshoots rest by 112 mV and
undershoots it by 15, so a linear ramp would make the undershoot a seventh of
nothing. Square root keeps the ordering honest while leaving the small one
visible.

**"Open the gates" is gone.** It held a "hold the membrane depolarized" toggle,
which was never a thing a membrane can do, and a messenger release. The action
potential replaces the first outright. What is left is one prominent button on the
canvas — the cause, on the surface where its consequences are visible — and the
rule that no button opens a channel survives intact: the two voltage-gated
channels answer only to the spike.

**One explanation block.** "What just changed" and "What is in this membrane"
moved inside the info panel. The parts list is now NAVIGATION rather than a
control board: tapping a name opens that protein's explanation, and whatever
intervention it actually allows (stop the pump, block the leaks, drop in a
messenger) sits with the words that explain it. The two voltage-gated rows get a
sentence saying they have no button and pointing at the spike instead. Voltage-
gated rows also report open/shut live from the running spike, so the list and the
picture cannot disagree.

**Focus replaced hide.** The 👁 toggle greyed one species out; 🔍 now brings one
INTO focus and dims the rest, several at a time, with nothing focused meaning
everything in colour. The old control needed remembering to switch back; a
spotlight does not.

### Does the rest of Milestone 3 still fit? Mostly — one step does not

Reviewed after step 10 landed.

**Fits unchanged.** N19 propagation, N20–N21 myelin and C05 signal-tracing are all
about the axon rather than this patch, and none of them touches how the spike is
generated.

**Got easier.** N17's voltage-vs-time graph is nearly free: the spike is a pure
function of `u`, so plotting it is sampling a function, and a timeline scrubber is
just choosing `u` instead of reading it off the clock. N22's refractory period is
already half-built without meaning to be — sodium inactivation and the potassium
undershoot ARE the refractory mechanism, and both are in the model.

**Does not fit: N18, threshold.** The button fires a spike unconditionally, so
there is no stimulus and nothing to be sub-threshold about. The deeper problem is
not the button, though — it is that **threshold cannot be derived from a
clock-driven envelope at all.** Threshold is the voltage where sodium entry starts
outrunning potassium exit, so the sodium doors open faster because the membrane
depolarized, which depolarizes it further. It is a feedback property, and the
current model is open-loop: the gates follow the clock, not the voltage.

Two ways forward, and only one of them is consistent with the rest of the app:

1. **Script it** — check the stimulus against a threshold constant and play the
   existing spike if it passes. Cheap, and a direct violation of "derive the
   headline number, never assert it". Threshold would be a number we typed in.
2. **Close the loop** — integrate `dV/dt` from the currents and let the gates
   follow voltage instead of time. Then a stimulus either runs away into a spike
   or decays, threshold is wherever that changeover happens, and the refractory
   period, accommodation and the all-or-nothing law all come out of the same few
   lines. This is Hodgkin–Huxley in miniature.

**Decided (user, 2026-08-23): the UI is split by SCENARIO, not by parameter.**
Rather than a stimulus-strength control the kid has to tune until they happen to
land on a mechanism, N18 becomes a small set of named things to watch — "a nudge
that fizzles", "a nudge that fires" — and "fire an action potential and see what
happens" is the model for all of them. A kid tuning a slider cannot interpret
where the interesting boundary was anyway.

This changes the controls, NOT the model, and the two compose well: with a
closed-loop model each scenario is the same integrator handed a different opening
stimulus, so the difference between fizzling and firing is something the mechanism
does rather than two animations we drew. Scenario buttons on top of a scripted
threshold would be the worst of both — the kid would be pressing a button that
plays a cartoon. So option 2 below still stands; it is what makes a scenario
honest. Apply the same principle to later milestones: name the scenarios, let the
mechanism decide the outcome.

Option 2 is the one to take, and it is worth naming its cost: it breaks the
"mechanisms are pure functions of the clock" rule for this one mechanism, because
a feedback system genuinely has state. The rule survives everywhere else, and the
compensation is that N18 and N22 stop needing to be built at all — they become
things you can already do. Do it as the first half of step 12.

### On splitting the membrane view into AP-mode and interactive mode

Proposed, and the recommendation is **not to** — with the reasoning, since it is a
close call.

Against: "spatial navigation instead of pages" is a rule this app already paid for
once, when the page switcher was deleted in the Milestone 1 rebuild; a mode
switcher brings it back in a new costume. More importantly, the single most
valuable thing in the current build is that the two are the SAME view — flatten
sodium's gradient with the sliders, fire, and watch the spike fail to reach zero.
That experiment does not exist if the demonstration lives behind its own mode. It
is also, precisely, checkpoint-style learning: the kid breaks the mechanism and
the app tells them the truth about what they broke.

For: someone meeting an action potential for the first time should not be fiddling
with four sliders, and a screen with one obvious thing to press is kinder.

What already answers the "for" case without a switcher: during a spike the sliders
lock and the panel says so, which IS a presentational mode — it simply lasts three
seconds instead of forever. N17's play/pause/scrub will extend that: while the
timeline is in charge, the view is observational; when it is not, the view is a
laboratory. **The timeline is the mode.** If watching still feels too busy after
N17 lands, the cheap fix is collapsing the ion section by default at a fresh
visit, not a second copy of the view.

### Corrections after step 10

- **The live concentration readings are out of the ion section.** They were the
  wrong home for them: what a spike does to the gradients belongs with the spike
  (N17), not tucked into the resting-state controls. `spikeCost()` and the derived
  0.005 mM / 192-spikes numbers stay in `core/`, tested, waiting for N17's graph
  to display them properly. All that happens in the ion section during a spike now
  is that the sliders lock — for a mechanical reason worth stating: the spike is
  computed FROM those counts, so letting them change mid-spike would rewrite the
  shape of a spike already half over.
- **Sections scroll individually; the column does not.** Each panel keeps its
  border and heading still and moves its own contents. The explanation block takes
  whatever height is left and scrolls inside it, which is the same problem the
  whole-column scroll was solving — a section squeezed to nothing — solved without
  the headings sliding away.
- **The pump runs right through a spike**, and takes no part in it. It is not an
  argument to the voltage equation, so switching it off leaves the spike identical;
  its job is the clean-up afterwards, and one spike moves so little that it has all
  the time it needs. Now said outright in `AP_FACTS`, since a kid watching a spike
  with the pump cycling away in the middle of the picture will reasonably wonder.

### Step 11 — the trace, and the timeline (N17)

**A spike is a position, not an elapsed time.** The one change that made this step
small: `apStore` holds `u` (0→1 through the event) and whether it is advancing,
and the animation loop advances that number instead of stamping a start time. So
pausing is "stop adding to it", scrubbing is "set it", and there is nothing to
rewind, because the spike was never accumulating state — every reading is
`apStateAt(u)`. Both are asserted: the same position gives the same reading, and
the sequence read backwards equals the sequence read forwards, reversed.

The payoff is that the WHOLE scene scrubs, not just a graph. Drag to 1.2 ms and
the gates, the aura, the charge marks, the voltmeter and the graph marker are all
at 1.2 ms together, because they were always reading the same number. Stopping on
the peak and looking at which channels are open is the thing a still picture in a
textbook cannot do.

**The trace is drawn whether or not a spike is running.** It is a pure function of
the gradients, so it is not a recording of something that happened — it is the
shape a spike WOULD have from here. Idle it is faint and titled "what a spike
would do"; while one runs the travelled part is bright gold with a marker and a
playhead, titled "this spike". This turns out to be the strongest thing in the
step: drag sodium's gradient flat and the curve visibly collapses below zero
*before anything is fired*. The spike stops looking like an animation the app
plays and starts looking like a consequence of the piles of ions.

It shares the voltage meter's scale (VM_MIN/VM_MAX) and its E_Na / E_K reference
marks, plus a dotted resting line — the undershoot only means something measured
against where it started. A test asserts the whole trace fits inside that scale,
so the two instruments cannot silently disagree.

**Transport controls** sit where the fire button was: play/pause, a scrubber, a
real-time readout in ms, and ✕ back to rest. Deliberately NOT routed through
`applyChange` — moving about inside a spike is a change to where you are looking,
not to the membrane, and scrubbing back and forth should not fill the consequence
panel.

Two smaller things this step needed:

- **The keep-out list became a list.** Two instruments now hold corners, so
  labels check every declared rect and push away from whichever edge is nearer —
  which makes the rule work for a right-hand instrument as well as a left-hand
  one.
- **Narrow store selectors.** The live reading changes every frame; subscribing a
  React panel to the whole object re-renders it sixty times a second to print the
  same two words. The info panel takes `live?.phase`, the parts list takes two
  booleans, the ion panel takes `u !== null`.

### Sodium and potassium come forward during a spike

Suggested and agreed: with four species crowding the patch, dimming the two that
are not the story makes the gold-in / violet-out reading much clearer. It also
already had a vocabulary — grey out, never hide — so nothing new had to be
invented. Three details were worth getting right.

**The kid's own focus wins.** The obvious implementation writes the focus set when
a spike starts and restores it after, which means an event silently rewriting a
control someone set — indistinguishable from a bug, and it would rob anyone who
had deliberately focused chloride. Instead the spike only decides the emphasis
when nobody has said otherwise, and nothing is written to the store at all, so
there is no setting to put back. `inColour(focused, kind, spiking)` is the single
definition, used by the canvas and the panel alike, and the precedence is
asserted: focus chloride, fire, and chloride stays lit.

**The set is derived, not listed.** `SPIKE_IONS` in `core/channels.ts` is whatever
the voltage-gated channels carry. Today that is sodium and potassium; if a
voltage-gated calcium channel arrives with the synapse milestone, calcium comes
forward on its own rather than waiting for someone to remember a second list.

**Dim must not read as absent.** Chloride is genuinely crossing throughout — it
has a real background permeability, it keeps pulling the average toward its own
voltage, and it is part of why the peak stops short of where sodium alone would
take it. Calcium is quiet for an entirely different reason: there is no doorway
for it in this patch. Both are now said in `AP_FACTS`, because the picture cannot
carry the difference and the dimming would otherwise teach that neither matters.

### The focus switch, and why the leak channel is not dimmed with the pump

Proposed: dim the pump and the potassium leak channel during a spike too, behind
a focus toggle. Half of that is right, and the other half would have taught
something false.

**The pump is fair game.** It genuinely takes no part — it is not in the voltage
equation, and switching it off leaves the spike identical.

**The leak channel is not.** It is not a bystander in any sense: it sets the
voltage the spike starts and ends at (turn it off and rest moves from −72 mV to
−41 mV, so the whole event becomes a different event), it is a quarter of the
potassium conductance even at the peak, and during the recovery it is the thing
bringing the membrane home — the narration for that phase says so in as many
words. A fixed dim on it would have the app contradicting its own sentence.

**So the emphasis is derived rather than listed: each protein's share of the
current actually crossing right now.** No favourites, no phase table — the
question "which one is doing the work?" has a different answer at each moment, and
this is that answer:

| moment | Na⁺ gated | K⁺ gated | K⁺ leak |
| --- | --- | --- | --- |
| at rest | — | — | 0.65 |
| peak | **0.86** | 0.06 | 0.05 |
| falling | 0.28 | **0.61** | 0.07 |
| undershoot | — | **0.87** | 0.09 |
| recovering | — | 0.23 | **0.49** |

So the spotlight hands over from sodium's channel to potassium's to the plain
leak, in exactly the order the narration describes, because it is reading the same
mechanism the narration is describing. The pump has no share at all and stays
context throughout. Background permeabilities count in the total, so a membrane
with every channel shut cannot report a share of 1 for whatever is left.

Brightness never reaches zero (`SPOTLIGHT_MIN` 0.32), for the rule established
one round earlier: dim has to read as "not the story here", never "gone". A test
asserts the floor.

**The switch** sits in the transport bar, where it applies, and governs both kinds
of emphasis — proteins and ions — so "focus" means one thing. Default on. Pausing
mid-spike and switching it off to see the whole membrane, then back on, is a good
way to use it, which is why it lives beside the pause button.

**Dimming alone was not enough**, and the fix was to give the design a positive
half. A bronze shape at a third opacity still reads as bronze — the eye keeps
finding it — so the emphasis is now four states rather than one fade:

| state | what it looks like |
| --- | --- |
| `starring` | white halo behind it, lit white outline, white-ringed label plate |
| `ordinary` | the normal drawing |
| `drained` | the copper taken OUT as well as fainter — a grey-slate body |
| `none` | no spotlight running: nothing highlighted, nothing dimmed |

Draining the colour is what made the difference: hue separates the states, and the
fade can then be gentle enough that a drained protein is still plainly *there*.
The spotlight is deliberately WHITE — gold would be read as sodium and violet as
potassium, and it has to mean "look here", not "this species". The pump's ATP
flash is held right back while drained too; a bright green pulse on a grey protein
out-shouts the thing being pointed at.

`spotlightState()` lives in `core/` rather than the renderer, because getting it
wrong is invisible in a type check and obvious in a test.

**A bug that only a screenshot catches.** `none` and fully-lit were the same value
at first — no emphasis meant "return 1", and 1 is above the starring threshold. So
the RESTING membrane ringed all five proteins at once, each one announcing itself
as the important one. They are genuinely different states and the type now says so
(`number | null`), with a test on exactly that pair.

**Another bug worth recording.** The first version computed the shares inside a
zustand selector. A selector that builds a fresh object every call fails the equality
check every time, so the component re-rendered forever and the page went blank —
6 KB of nothing in a screenshot. The fix is the pattern already used for the live
reading: the stage computes it and PUBLISHES it, coarsely rounded, so a panel
re-renders when the brightness visibly changes rather than sixty times a second.
Never derive a fresh object in a selector.

### Channels wear the colour of what they pass, and the spike can be slowed down

**Colour-coding the channels** makes selectivity visible instead of only stated —
N13's "they are picky about who gets through" was previously a sentence in the
panel and nothing on the drawing. Sodium's two channels are gold, potassium's two
are violet, from the species palette.

The tint is blended INTO the protein bronze rather than replacing it, and the
strength matters: at 0.44 the violet channels stopped looking like protein and
started looking like lilac plastic, so it sits at 0.38. The palette rule it has to
respect is that proteins, lipids and ions are three different kinds of thing —
a channel drawn in flat sodium gold would read as being made of sodium.

The one part painted at FULL species strength is the **selectivity filter**: the
narrow waist of the pore, which is the part that actually does the choosing. That
is not decoration, it is where "only potassium fits" physically happens.

**The pump keeps its copper.** It carries both ions, so a single species colour
would be a lie — and staying uncoloured turns out to be the visible half of "a
machine, not a hole", which is the lesson it exists to teach. On the resting
membrane the pump is now unmistakably a different KIND of thing from the four
channels, which it was not before.

**Slow motion** because the upstroke is over in about a third of a second at full
speed, which is not long enough to watch a gate open. The button steps 1× → ½× →
¼×, putting the whole event at up to twelve seconds. It slows the position, not
the model — everything still reads off `u`, so pausing and scrubbing work exactly
as before.

One consequence worth naming: `AP_FACTS` became `apFacts(speed)`. One of those
paragraphs owns up to how much the animation is slowed down, and a figure the app
quotes about ITSELF has to stay true when the speed changes — 375× at full speed,
1,500× at a quarter. Tested at both. The graph's caption is derived the same way.

### Step 11b — staging the spike so a child can follow it

Feedback: the potassium door opening AFTER sodium's — the one fact the whole thing
turns on — could not be seen; there was too much visual noise; the voltage meter
was ink without much payload; depolarized and hyperpolarized were never named.
All fair. What changed:

**The spike is now told in seven numbered moments, and playback stops on each.**
`core/apSteps.ts` holds them, and every position is MEASURED off the model — the
step called "now the potassium door opens" sits at the u where the potassium gate
actually crosses its threshold, and the lag it quotes (0.7 ms) is computed, not
typed. A banner on the canvas names the moment and says what to look at. Pauses
run 1.4–2.6 s, longest on the potassium beat.

Note what this changes and what it does not: the PACING is now uneven, the physics
is not. Every reading is still `apStateAt(u)`.

**A gate flashes at the instant it changes.** A gate that is merely in a different
state is far harder to notice than one you watched change, and the change is the
lesson. It is derived from position — "how far past the opening are we" — rather
than detected between frames, so it also fires when the timeline is dragged
backwards through the moment.

**The bar meter is gone**, replaced by a number and a WORD: `+41 mV /
DEPOLARIZED / the inside has gone POSITIVE`, in the direction's colour with a
matching stripe down the panel edge. The bar had become redundant — the trace
carries the scale, the ion voltages and the resting line, all of it better — and
"depolarized" and "hyperpolarized" were nowhere on the screen despite being the
words the lesson turns on.

#### Three real errors this round, all caught by looking

**1. The story was in the wrong order, and the model said so.** With `open`
defined as an absolute conductance — half a leak channel's worth — the potassium
gate crossed it at four per cent of its own maximum, at u = 0.063, BEFORE the peak
at 0.108. So the step "now potassium opens" came before the peak, and the caption
at the peak claiming potassium was still shut was simply false. The threshold was
the bug: one drawn channel stands for a population, so "open" has to mean that
population is carrying something worth seeing — a fraction of its OWN widest
(`OPEN_FRACTION` 0.25), not an absolute figure that means different things to
channels of different sizes. With that fixed the order is sodium opens (0.059) →
peak (0.108) → potassium opens (0.151) → sodium shuts itself (0.240) → dip
(0.364), the lag is 0.74 ms — the textbook figure — and every caption is true. A
test now asserts the steps are in ascending order, which is what would have caught
it: hand-written captions and measured positions can disagree, so something has to
compare them.

**2. Draining a protein made a hole in the membrane.** Pushed further on
"dim harder", the drained greys went dark enough to sit near the background — and
because the lipid clearance around a protein is a little wider than the protein,
each drained one read as a GAP in the bilayer. That is a worse lie than a
distracting protein: "ions cannot cross except at a channel" is the reason the
bilayer is drawn at all. Drained now takes the colour out and leaves the substance
— grey as light as the lipids, alpha barely reduced. The drama comes from the
starring protein being LIT, not from the others dissolving.

**3. The flash pre-announced the event.** The window was centred on the change, so
at the top of the spike the potassium channel was glowing while the caption beside
it said "potassium is still shut". It is one-sided now, and tested.

**And one conflict worth recording, because both sides were right.** At the moment
potassium's door opens, sodium is still carrying most of the current — so the
share-based spotlight lit sodium while the banner announced potassium. Both facts
are true. A protein is now lit for EITHER reason: it is doing the work, or it has
just changed. On that beat both channels are lit side by side, in their own
colours, which is a better picture than either rule alone would have given.

### The charge field cools instead of switching

The red/blue tint over the cytoplasm changed hue abruptly. Two causes, both mine:

- **It flipped.** Red for above rest, sky for below, chosen by the sign — so at the
  crossing it went red, off, blue. A switch, not a change.
- **The curve was steepest exactly where it mattered.** The strength was
  `sqrt(|dev|)`, and a square root's slope is infinite at zero. It lurched out of
  neutral the instant the voltage moved.

It is now ONE ramp with a neutral middle: cold sky → the membrane's own slate at
rest → warm red, interpolated continuously, so there is no value of the voltage at
which the colour jumps. The field never quite switches off either — a field that
blinks out and returns in the other hue reads as a flicker, while one that is
always present and changing colour reads as something warming and cooling, which
is what it is. The shaping exponent went from 0.5 to 0.85, which is gentle near
rest and still lifts the small end.

**The scale is now derived rather than fudged.** Each direction is measured
against how far it COULD go: toward sodium's own voltage going up, toward
potassium's coming down. That is the honest question for this picture — "how far
toward whichever ion is pulling hardest" — and it happens to solve the asymmetry
that the square root was papering over, since 110 mV up and 15 mV down are each
most of the way to their own limit. The exact millivolts are on the readout; the
colour is the mood. `polarizationT()` lives in `core/` with tests on the thing
that actually matters: that it is continuous through rest, monotonic within each
direction's reach, and exactly ±1 at the two ion voltages.

### One voltage instrument, not two

Asked whether the membrane-potential readout and the spike graph should be
combined. They should, and the reason is stronger than saving space: they were
showing the SAME quantity in two corners — a number in one, and a marker sitting
at exactly that number in the other. Two instruments for one reading is not just
clutter, it hides a relationship.

Merged, in the bottom right: the number and its word are the panel's headline,
the trace is its body, and the marker on the curve is drawn in the direction's
colour so the eye can see that the dot and the number are one thing.

**Which way round mattered.** The number is the subject and the trace the body,
not the reverse. The reading is always true; the curve is a prediction until a
spike is running. Folding the number into the graph would have filed the resting
voltage inside a panel captioned "what a spike would do", which is a claim about a
hypothetical. As it stands the panel is "the membrane voltage", and the caption
line — "what a spike would do" or "this spike" — describes only the plot.

The bottom-left corner is now empty, which is worth as much as the merge: it is
the corner where the leftmost channel's label kept colliding with chrome, and
there is one fewer keep-out rect to reason about.

### The speed control is gone — and it was hiding a bug

Removed at the user's request, and rightly: once playback stops on each moment,
a speed multiplier is a second mechanism for the same job, and a control the child
has to find in order to see the thing properly is a control that has already
failed. The pauses are the pacing now.

Two consequences, both improvements:

**The motion is slower by default.** `AP_MS` went from 3000 to 4200. With no
slow-motion button to reach for, the single default has to be calm enough on its
own — particularly through the stretch where the voltage crosses zero, which is
the fastest part of the whole event and the one that had the colour field changing
quickly.

**The teaching note now owns up to the right thing.** It used to be a function of
the playback speed; it is now a function of the PAUSES, which is what actually
determines how long the demonstration runs: the movement is stretched to 4 s
(≈525× slower than life), and with the stops the whole thing takes about 16 s.
Both figures are computed. The graph caption dropped "N seconds shown" entirely —
ambiguous once playback pauses — and says the one unambiguous thing instead: the
curve is 8 milliseconds of real time.

#### A bug the removal uncovered

`potassiumLagMs()` was scaled by `AP_MS`, so it reported the lag in ANIMATION
time. The consequence panel said "the potassium doors answered 276 ms later" while
the banner three inches away said "0.7 ms late" — the same event, two numbers, and
the big one reads as a fact about neurons. It returns real milliseconds now, both
places quote it, and the consequence keeps one decimal because rounding 0.7 to a
whole number was the other half of the same mistake.

The rule: anything quoted as a duration OF THE BIOLOGY has to be in the biology's
units. Screen time may only ever be described as screen time.

### The mirrored ion sliders were wrong, and not only about direction

Reported as confusing, and agreed. The two halves sat back to back around a
central membrane with the outside one mirrored, so both fills grew outward. It
read well and controlled badly.

The fault is sharper than "one slider runs backwards". **The two sliders for the
same ion answered the same gesture in opposite directions**: drag right on the
inside bar for more, drag right on the outside bar for less. Adjacent controls,
one hand movement, two meanings. This is the failure mode of "the clearest readout
should BE the control" — that principle holds only while the direction that reads
best and the direction that drags best are the same one, and a mirrored bar is
exactly the case where they part company.

**It was also claiming a correspondence it did not have.** The panel put outside
LEFT and inside RIGHT, while the picture beside it puts outside ABOVE the membrane
and inside BELOW. The comment in the code said the mirroring put the two piles
"back to back the way the cell has them", and the cell as drawn does not have them
that way.

Now: one row each, stacked as the canvas stacks them, outside above a membrane
rule and inside below it, both growing rightward from a shared left baseline. The
control direction is the same everywhere, the spatial claim is now true, and it
costs no height because each number moved onto its own row instead of sitting
under both.

A side gain worth noting: a shared baseline is also how quantities get compared.
Back-to-back bars show asymmetry handsomely but make two lengths running in
opposite directions genuinely hard to judge against each other — the potassium
reversal now reads instantly against sodium, which it did not before.

### One control bar, whose play button is the fire button

The fire button and the transport were two panels that swapped places. Two
problems with that, beyond the obvious duplication:

- **The primary action vanished the moment it was used.** Nothing on screen still
  said what the thing you had just pressed was called.
- **What replaced it opened with a bare ▶.** To someone who has not started
  anything, a play icon means "resume" — of what? The transport's first state was
  answering a question nobody had asked yet.

Now there is one bar, always present at a membrane patch, and its button IS the
fire button: `⚡ Fire an action potential` at rest, then `⏸ Pause`, `▶ Play`,
`↻ Again`. Every state has a word beside its icon — ⏸ and ↻ alone are guesswork
at this age — and the button keeps a fixed width so the bar does not jump when the
label changes. The ✕ holds its place invisibly rather than appearing, for the same
reason: nothing to come back from until something has happened.

The scrubber is live at rest too, which falls out of the design rather than being
added: the spike is a position, so dragging from rest simply lands you inside it,
paused. There is no "not started" state to guard against.

### When it's over, it's over

The `↻ Again` state and the `✕` were both removed. A finished spike used to stop
dead at the end and sit there waiting to be dismissed, which is two controls for
"I have finished looking at this". Now the last moment is held like any other and
then the spike simply ends: the membrane is back at rest, and the button says
`⚡ Fire an action potential` again — which is the same thing `↻ Again` did, in the
words the child already knows.

Two things fell out of it:

**The final beat is now read.** Its pause was 0, so "7/7 Back to resting" flashed
past while playback halted at the end. It gets 1.8 s like everything else.

**The opening pause was dead config and now works.** `stepCrossed` only fires on a
moment strictly AFTER where you are, so the first moment — which sits at the start
— was never crossed and its 1.4 s hold never happened. A spike now opens by
holding on "1/7 Resting, and nothing is happening", which is the before picture the
rest is compared against. A whole run is about 18 s: 4.2 s of movement and 13.8 s
of pauses.

One trade-off to be aware of: with the ✕ gone, a spike dragged to the middle and
left there is exited by pressing Play and letting it finish. That is the intended
reading of "we fire it, and when it's over it's over" — but if it turns out to
matter, the fix is for the button to offer starting over rather than bringing back
a dismiss control.

#### And a lesson about verifying

None of this sequencing can be checked from a screenshot. A headless browser
reports a frame delta of ZERO, so playback never advances — the first attempt sat
on moment 1 of 7 at seventeen seconds of virtual time, looking exactly like a
hung demo. So the advance rule moved out of the animation loop into `core/` as a
pure function of (steps, position, pause remaining, frame delta), and a test plays
a whole spike frame by frame at four different frame rates, asserting that every
moment is visited in order, that the run ends exactly once, and that it takes the
movement plus the pauses. Sequencing is logic; logic has to be testable without a
screen.

### Crowd ions were landing inside the proteins

Spotted: a potassium ion overlapping the sodium-potassium pump. Not intentional —
`ionCloud()` laid the crowd out on a jittered grid across the whole patch with no
knowledge of where the proteins were, so ions simply landed on top of them. The
ions drawn INSIDE the pump's cavity are a different thing and are intentional:
those are the ones it is carrying.

Worth more than tidiness, for a specific reason. A protein is solid matter, so an
ion inside one is wrong anywhere — but on the pump it lands among the ions being
carried, and "count them: three sodium out, two potassium in" is the entire lesson
that protein exists to teach. A stray violet ball beside the two real ones makes
the count read as three. The drawing was corrupting a number the child is being
asked to take from it.

`proteinFootprints(side)` now publishes what each protein occupies on each side of
the membrane — position, half-width, and how far it reaches out of the bilayer,
which is further into the cell for the pump than out of it — and the crowd layout
steps around them.

Sideways rather than deeper, deliberately: how close an ion sits to the membrane
is carrying the charge-skin idea, while a small shift along the membrane means
nothing at all. The nudge depends only on the ion's own grid position and the
fixed protein layout, so it keeps the rule that cost a debugging round earlier —
a particle's position is a pure function of its own identity, never of the total
count, or the whole crowd reshuffles on every edit.

The depth test is deliberately generous (three radii past the protein's reach)
because the thermal jiggle moves an ion by up to about twice its radius: one left
alone at layout time must not be able to wander into solid protein afterwards.

### The camera turns to face the membrane

Reported: at a membrane zoom the membrane looks angled, and the ion crowd does not
fill the canvas, so it reads as though ions only exist near the membrane. The
diagnosis in the report was right — the angle is the cause, not the coverage.

There are two membrane targets and their angles could hardly be more different:

| target | membrane angle |
| --- | --- |
| `axon-membrane` | 1.3° — level by luck |
| `dendrite-membrane` | **132°** — nearly diagonal |

Every screenshot taken during Milestones 2 and 3 was of the axon patch, which is
why this went unseen for so long. A patch inherits the angle of the wall it sits
on, and so does everything drawn in its frame. On the dendrite that produced four
separate faults at once:

- the crowd's rectangle is sized to cover the SCREEN, so rotated 132° it leaves
  the corners empty — the reported symptom;
- the protein labels, offset in screen pixels, hang across the bilayer;
- inside is up-and-right rather than down, so nothing matches the ion panel's
  out-above / in-below stacking;
- and a **"+" charge mark rotated 132° reads as a multiplication sign.** Dozens of
  them. That one is not a matter of taste.

So the camera now turns as it arrives, and the membrane lies flat with the
cytoplasm below it. That fixes all four at once and makes the two membrane views
comparable with each other, which they were not.

**The turn happens LATE**, mirroring the pan finishing early: spinning the whole
neuron while it is still recognisable is disorienting, whereas once the
surroundings are gone the same turn reads only as the membrane levelling out.

**The angle is not simply minus the wall's angle.** The renderer mirrors the Y
axis when a patch's inward normal falls on the other side of its tangent, and a
mirrored frame needs the other half-turn or the cell comes out upside down. The
dendrite patch is one of those: its wall runs at 132° and the camera turns +48°.
`patchLevelAngle()` mirrors that decision, and two tests hold them together — that
along-the-membrane lands horizontal, and that inward lands pointing DOWN, for every
framed target.

#### What rotation broke, and what that taught

Two assumptions were buried in code that had only ever seen an unrotated camera:

- **`m.a` is not the scale.** The screen-space text and geometry helpers recovered
  the device pixel ratio as `m.a / cameraScale`, which under rotation is
  `scale·cos θ / scale` — so every label would have been misplaced by that factor.
  It is `hypot(m.a, m.b)` now: the magnitude of the column, not one component.
- **The view rect is no longer the screen.** Under rotation the visible region is
  a tilted rectangle, so `viewRect` returns a bounding box — correct for its two
  jobs, culling and sizing the backdrop, and WRONG for anything pinned to a corner
  of the canvas. The voltage panel's numbers and the magnification readout were
  anchored to `view.left/top` as a stand-in for "the screen's corner", and both
  were flung off-canvas the moment the camera could turn. Screen labels now take a
  `screen` flag and are given canvas coordinates directly, which is what they
  should always have had: chrome pinned to the canvas belongs in canvas
  coordinates.

### The tilt is capped, not removed

Levelling the membrane completely was the wrong call. The angle a patch inherits
from the wall it sits on is worth keeping: arriving somewhere plainly slanted says
you have come to a particular place on a particular branch, not to a diagram. The
two patches looking different from each other is information.

So `patchTurnAngle()` now turns only far enough to bring the tilt within
`MAX_PATCH_TILT` (20°), keeping its direction. The axon patch is 1.3° and the
camera does not move at all; the dendrite patch is 48° of slope and the camera
turns 28°, leaving 20°.

**What sets 20°:** a "+" charge mark rotated 20° is unmistakably a plus, and one
rotated 45° is a multiplication sign. That is the binding constraint, so it is the
one the number is chosen against — and the charge marks are drawn in the patch
frame, so they wear whatever tilt the patch has.

**The crowd's extent is derived from the same constant.** The rectangle the ion
cloud occupies is now the screen's own rectangle turned by MAX_PATCH_TILT, so it
fills the canvas at any tilt a patch is allowed to keep. Two constants that have
to agree, expressed once. The crowd is about a third sparser as a result, which
costs nothing pedagogically: the COUNT is the concentration ("one ball per mM"),
and the area it is spread over is arbitrary as long as both sides share it.

Three tests hold the shape of this: every patch is within the cap; a patch that
was already gentle is left exactly as it was, tilt and all; and the steep one is
still tilted rather than flattened.

**If more tilt is wanted, the way to get it is to stop rotating the glyphs.** A
"+" means positive charge and its orientation carries no information, so charge
marks and voltage-sensor marks could be drawn upright in screen space regardless
of the patch. Then the cap would be about label placement and crowd coverage only,
and could be considerably looser. Not done, since 20° is comfortably legible — but
that is the lever.

### The magnifying glass has no box

Every canvas label gets a dark plate by default, and the 🔎 inside each zoom
marker was getting one too — a dark square sitting inside a dashed circle, reading
as a second, squarer marker fighting the round one. It opts out with
`plate: false`. Words over the scene keep their plates; a glyph that already has a
ring around it does not need one.

### Step 12, first half — the model closes the loop

Milestone 3 is not finished: steps 12–16 are open, and two of them (propagation
and myelin) are among the most striking things the app will ever show. So this
continues in Milestone 3.

**The spike is now integrated, not described.** `core/spikeModel.ts` solves

    dV/dt = −( I_Na + I_K + I_leak − I_stimulus ) / C

with Hodgkin and Huxley's m³h and n⁴, in their units. Before, the two
conductances were written down as envelopes in TIME, which gave an honest shape
but could not give threshold — threshold is not a shape, it is what happens when
sodium entry starts outrunning potassium exit so that a little more
depolarization opens a little more sodium. That needs feedback.

**And now threshold is measured.** `thresholdStimulus()` bisects on the model.
28.7 µA/cm² at real gradients — and it MOVES: flatten sodium and it rises to 86,
block the potassium leaks and it falls to 17. Nothing about it is typed in.

Three things fell out for free, all of which had to be faked or omitted before:

- **The all-or-nothing law.** Double the stimulus and the peak is the same
  (+59.3 vs +58.7). Latency shortens, amplitude does not.
- **A spike that fails for a reason.** The fire button injects a FIXED 60 µA/cm²,
  so with sodium's gradient flattened threshold rises past it and there is no
  spike — rather than the app quietly turning the stimulus up to keep working.
- **The cost of a spike is now an integral**, not a back-calculation. It used to
  be derived from Q = C·ΔV times a measured overlap ratio; it is now
  ∫I_Na dt in real units. 0.040 mM of sodium per spike, so about 25 spikes to
  shift one drawn ball. (It was 192 before — that estimate was low, because the
  capacitive minimum understates what sodium actually carries. The overlap is now
  reported as a consequence: sodium brings about ten times the bare minimum.)

**What had to be preserved, and how.** All of N17 — pause, scrub, the trace drawn
before anything is fired — rests on a spike being a POSITION rather than an
accumulated state, and an integrator is nothing but accumulated state. The
resolution: integrate ONCE into a table indexed by position, memoised on
everything it depends on. Every reader downstream is unchanged and still pure.
Not scripted — the numbers come out of the equations again whenever the gradients
move.

#### The one place this nearly broke an older lesson

Started from the model's own relaxed steady state, blocking the potassium leaks no
longer sends the voltage UP to −41 mV as checkpoint A demonstrates. It climbs, the
delayed rectifier notices −41 mV and opens, and the membrane is dragged down to
−88. That is real physics, and a different lesson from the one Milestone 2 teaches
— and two different resting voltages on screen would be worse than either.

So the integration starts where the chord-conductance equation says the membrane
sits, and the leak's target is solved so that voltage is a true equilibrium of the
model. Rest is −72.1 mV with leaks on and −41.4 with them off, exactly as before.
The offset in the leak's target stands for what the model leaves out: the pump's
small electrogenic pull, and every channel not drawn.

#### What is left of step 12, and one thing to watch

**Not built: the scenarios themselves.** Per the decision to split by scenario
rather than by parameter, N18 wants a named subthreshold case — "a nudge that
fizzles" beside "a nudge that fires" — which means threading a chosen stimulus
through the run and giving the failing case its own captions. The model supports
it; the UI does not exist.

**Worth watching:** the model's window is 20 ms, because potassium's gate is slow
to shut and the undershoot needs that long to come back. The spike itself is over
in 4 ms, so the first six moments are crowded into the first fifth of the trace
and the last stretch is a long slow drift. Honest — real figures look like this —
but it wastes plot width and screen time. If it grates, the fix is to let playback
run non-uniformly (fast through the tail) while the graph's axis stays linear in
real milliseconds.

### Is it realistic to change the concentrations and then fire?

Asked, and measured rather than reasoned about. It is — and better than expected,
because the channel gating depends on VOLTAGE (those midpoints are properties of
the protein) while the Nernst voltages depend on the concentrations, so changing
the piles changes the driving forces and leaves the gates alone. Which is right.

| what the kid sets | rest | threshold | fires? |
| --- | --- | --- | --- |
| real | −72 | 29 | yes, peak +59 |
| K⁺ outside 5 → 25 | −44 | never | **no** |
| K⁺ outside 5 → 80 | −24 | never | no |
| sodium flattened | −76 | 85 | no (the button gives 60) |
| sodium reversed | −80 | never | no |
| everything flat | 0 | never | no |

The second row is the prize. Raise extracellular potassium and the cell rests at
−44 mV, and it can no longer fire AT ANY STIMULUS — because sodium's inactivation
gate is shut at −44. That is depolarization block, and it is why hyperkalemia
stops a heart. Nobody wrote it; it falls out of m³h.

One thing had to be fixed for those answers to be trustworthy. `fired` was
"overshoots zero", and with every gradient flattened the membrane rests AT zero,
so the faintest wobble read as a spike. It is now "overshoots zero AND ends up far
above where it started". (A regeneration test — did the voltage keep climbing
after the push stopped? — was tried and abandoned: a large enough stimulus reaches
its peak DURING the pulse, so the test failed at high amplitudes and made the
threshold bisection non-monotonic.)

### The membrane view now holds two demos

Agreed with, and the reasoning is worth keeping. The two questions a membrane
patch can answer are not the same question. "What happens, in order, when a spike
runs?" wants a timeline, a play button, and everything else held still. "What
makes an ion move, and which way?" wants the concentrations and the voltage in the
kid's hands and no clock at all. That the ion sliders had to be LOCKED during a
spike was a symptom of trying to serve both at once.

This is not the AP-mode/interactive-mode split that was argued against earlier.
That was one view in two modes. This is two exhibits, each with its own question —
and it is the same principle as choosing scenarios over parameters, applied one
level up.

**What does not change with the demo: the cell.** The concentrations, the pump and
the leak channels are the membrane's own state, so flattening sodium in the
gradients demo and then firing a spike still works and still fails for the right
reason. The spike demo shows the concentrations read-only and says where to go to
change them. Switching exhibits changes what you are shown and what you can reach,
never what the cell is — which is what keeps the experiment the earlier argument
was protecting.

`DEMOS` is a list, not a pair, because the refractory period and the synapse
milestones will both want their own.

#### The gradients demo needed a correction first, and it was a real error

The new exhibit is a **voltage clamp**: hold the membrane anywhere and watch which
way each ion is pushed. Building it exposed something wrong in what was already
there. Flow direction through an open channel came from the CONCENTRATION gradient
alone — crowded outside, so it comes in. That is half the truth, and the missing
half is the half worth teaching: an ion is pushed by its crowding AND by the
voltage, and where the two cancel it does not move at all, however wide the door.

It was visibly wrong in one place already: at the top of a spike the membrane sits
within a couple of millivolts of sodium's own voltage, so sodium has all but
stopped — and the picture showed it still pouring in, making the peak look like the
moment of greatest inflow when it is the moment inflow ENDS.

`core/driving.ts` now answers "which way, and how hard" from the driving force,
`V − E`, with the ion's charge deciding the sign (at a voltage above its own,
chloride moves IN while the current it carries flows out). The crossing rate scales
with it too, so a channel visibly slows as the voltage approaches the point where
its ion stops caring. And the ion panel's "would go in" tag — concentration-only,
and therefore the same misconception in words — now reports the real answer.

A test that encoded the misconception had to be rewritten: "stops entirely when the
gradient is flat" is false. With the crowding even, an ion stops at ZERO volts, and
at any other voltage it moves, driven by voltage alone. It now also asserts the
knife edge that matters: at exactly E_K, potassium does not budge even though it is
crowded inside.

### Step 12, second half — the two pushes

Two named things to watch, not a dial: **👆 Give it a small nudge** (20 µA/cm²)
and **⚡ Fire an action potential** (60). Both amplitudes are FIXED, and that is
the whole honesty of the exhibit. Scaled to whatever threshold currently is, the
one called "fires" would keep firing however badly the gradients were wrecked, and
the app would be quietly protecting its own story. Fixed, the outcome belongs to
the mechanism:

- at real gradients threshold is about 29, so 20 fizzles and 60 fires;
- flatten sodium and threshold climbs past both — neither fires;
- block the potassium leaks and threshold falls to about 17, so **both** fire.
  Worth meeting: it is what leak channels are for.

**A fizzle gets its own story**, three moments long, because it cannot borrow the
spike's — with nothing ever opening, "the sodium door flies open" would sit at the
very END of the run. It reads: resting → "it lifted a little, and that is all;
look at the doors, not one of them opened" → "and it simply leaked back down. No
spike. Not a small one — none."

And the consequence panel says the same thing in the form that matters: *that is
not a small spike, it is NO spike*, followed by the voltage a push has to reach —
read off the model as the highest a just-too-small push manages, not named as a
constant — and then the point: past that, the size of the push stops mattering.
All or nothing.

#### Two definitions had to change, and both were latent bugs

**"How far open is this door" now means "of its own full width", not "of what this
run reached".** During a small nudge the potassium conductance reaches two
leak-channels' worth, which is almost nothing — but that was most of THAT run's
maximum, so the channel was drawn wide open in a demonstration whose entire point
is that nothing happened. Measuring against the ceiling fixes it.

**And that reordered the story again — for the better.** With the stricter
threshold, sodium falls below a quarter of its width at 1.7 ms while potassium does
not reach a quarter of its own until 2.6 ms. So the honest order is now: sodium
opens → peak → **sodium shuts ITSELF** → potassium opens, 1.9 ms late → undershoot.
Sodium's stop now visibly precedes potassium's opening, which makes it plainly
self-inflicted rather than something potassium did to it — a better telling than
the one written by hand. The ordering test caught this for the second time; it has
now paid for itself twice.

**Milestone 3 remains open**: N19 propagation, N20–N21 myelin, N22 refractory (much
of which the closed-loop model now supplies for free) and C05 tracing.

### Two zaps, and no spoilers

**The size of the lightning is the label.** The two pushes were "👆 Give it a
small nudge" and "⚡ Fire an action potential" — a sentence to read and a term
nobody has met yet. They are now a small bolt beside "a small zap" and a big bolt
beside "a big zap", same button shape, and the difference needs no reading at all.
The proper name is still on the demo heading above them and in every sentence about
what happened, which is where a word is worth learning rather than worth
deciphering.

**The faint preview of the curve is gone.** The whole trace used to be drawn
underneath as the shape a spike WOULD take, and that gave the answer away: a child
seeing this for the first time should be able to wonder what happens next and be
surprised by the dip below where it started. The graph now draws only what has
already happened, like an instrument.

What that costs is worth naming, because it was argued FOR earlier in this
milestone: you can no longer reshape the curve with the gradient sliders before
firing and watch it collapse. Spoiling the first encounter is the worse of the two,
and the consequence panel already makes the same point in words. The reference
lines stay — sodium's and potassium's own voltages, zero, and resting are
properties of the gradients rather than of the spike, and they are the scale the
curve will be read against.

### Demo ② spec — "Balance an ion" (agreed design, not yet built)

Replaces "What makes ions move", whose flaw was structural: two controls on
coupled quantities, and no sight of the one idea the topic exists to teach — that
an ion is pushed by TWO things, its crowding and the charge, and the Nernst
voltage is nothing but where they cancel.

**Four chambers, one battery.** Four visually separate test patches, one per
species, each a small membrane fragment with ONE selective channel — deliberately
NOT four regions of a single membrane, which a child would read as ions
segregating into groups along it (a real misconception, worth designing against).
Each chamber shows its own species in colour and the other three as blurred grey
ghosts: present, not the story — the existing "dim is never absent" rule applied
per chamber. ONE battery is drawn at the top with wires branching to all four, so
the shared voltage has a visible agent and a visible reason to be shared; one
slider drives it.

**It lives in a DRAWER, not on the canvas** (decided after the spec was first
written, superseding the honesty-note-only plan). The canvas never stops being
the neuron: the lab bench slides in as a full-height drawer over a dimmed
backdrop — atomic-playground's `SideDrawer` pattern, ported — and the scene stays
visibly underneath, untouched. The drawer's grammar carries the claim "an aside,
not a place" structurally; one plain framing line inside ("a lab bench — four
separate patches, not a picture of your neuron") seals it. The demo menu entry
for this exhibit OPENS the drawer rather than swapping what the canvas claims to
be; the spike demo stays on-canvas because it is the actual membrane doing the
actual thing. Rule recorded in 03-architecture.md: the scene is the world; a
drawer is thinking about the world.

**Controls.** Per chamber: the concentration rows (both sides) and a channel
open/shut toggle. Shared: the battery slider. With a channel SHUT, voltage and
concentrations are genuinely independent, so the two controls are honest — and
the battery is required for the game to be a game at all: left free, a membrane
with one open channel drifts to that ion's balance voltage by itself.

**The two pushes are always drawn; the net is not.** Each chamber's focal ion
gets a crowd-push arrow and a charge-push arrow, to scale — the tug-of-war. While
the channel is shut the NET is hidden (the no-spoilers rule): the kid judges
which push wins, then opens the door to find out.

**Flow, not a hero ion.** Streams through the open channel, rate and direction
from `core/driving.ts` (flowOf / flowStrength / FLOW_DEADBAND — this demo is that
module's exhibit). At balance the traffic does NOT stop: equal streams cross both
ways. Dynamic equilibrium is the truth; "movement stops" is the misconception a
single jiggling ion would have taught.

**Success is demonstrated, not claimed:** channel OPEN and the voltage within the
deadband of that ion's balance → calm two-way traffic plus a restrained
celebration. Balanced behind a closed door is an untested claim and earns
nothing.

**Start state:** real concentrations, battery at the resting potential, every
channel shut. Potassium first is the natural reveal — it is nearly balanced at
rest, which is the resting-potential hook.

**Why four columns are four lessons:** K⁺ the baseline; Na⁺ the big push; Cl⁻ the
sign flip (attraction and repulsion reverse); Ca²⁺ the valence (charge 2 balances
the same ratio at half the voltage).

**The capstone is emergent:** no single battery setting balances all four — open
two channels and something always flows. That impossibility is why the resting
membrane is a compromise and why the pump must exist, and it is discovered
through play. The panel says so when two or more channels are open and one of
them is balanced.

**Calcium's floor: accepted, with a note.** One ball = 1 mM cannot draw the real
inside calcium (about a ten-thousandth of a ball), so the demo's Ca²⁺ balance
point shows ≈ +19 mV where the real figure is about +130 mV. The note states
both numbers and the reason — the scarcity itself is the teaching point.

**Concentrations do not drift while flowing** — same vast-reservoir argument as
the spike's cost.

### Demo ② built — "Balance an ion"

In a drawer, per the rule: the canvas keeps being the neuron and the bench slides
over it. Four visibly separate chambers, one battery wired to all of them, ghost
ions for the three species a chamber is not about, both pushes drawn and never
their sum, the door as a toggle, and success only when balance is DEMONSTRATED
with the door open.

`core/balance.ts` computes nothing new. It splits the driving force `core/driving.ts`
already knows into the TWO pushes it is made of — crowding and charge — so they
can be drawn arguing. That split is the whole exhibit: the Nernst voltage stops
being a number on a label and becomes the place where two arrows are the same
length.

**Verified end to end**: at −89 mV with potassium's door open the chamber goes
green, says "balanced", and shows ions still crossing BOTH ways — equilibrium as
equal traffic, not stillness. With sodium's door also open, "You have found the
problem" appears on its own: no battery setting pleases two ions that are content
at different voltages, which is why a real membrane is a compromise and why the
pump has a job. That ending is emergent, from `couldBalanceAll` comparing their
actual voltages — a contrived pair that happened to agree would be reported as
balanceable, and a test checks exactly that.

**The old clamp demo is retired**, not patched. Its flaw was structural: two knobs
on quantities the app teaches are coupled, and no sight of the idea that matters.
Its voltage slider survives as the bench's battery, where one supply wired to four
patches is a picture rather than unexplained magic.

#### A sign error, and the test that should have caught it

Both pushes came out inverted: the arrows showed a negative interior REPELLING
sodium. The reason it survived the first test run is worth recording — the test
asserted that the two pushes summed to the driving-force FORMULA, and the formula
was inverted in the same way, so it agreed with itself. It only showed up in a
screenshot.

The test now asserts the DIRECTION against `flowOf` — does the net push point the
way the ion actually moves — across seven voltages and all four ions, plus two
spelled-out cases (a negative interior pulls sodium in and pushes chloride out;
crowding sends an ion away from where it is crowded). **Two formulas agreeing is
not a check. Check against the thing that moves.**

#### One palette overload, fixed

The charge arrow was coloured by which way it pushed — red inward, sky outward.
But red and sky mean charge SIGN everywhere in this app, on every ± mark on a
membrane face. The arrow is now coloured by the sign of the membrane (sky for a
negative interior, red for a positive one) and its arrowhead carries the
direction, so nothing has two meanings.

### The bench chambers, drawn properly

The first pass was a scaffold: coloured dots, grey bars, a wall of explanatory
text. It worked and it looked like a slide. Rebuilt:

**Each chamber is now a canvas drawing the same membrane the neuron view draws** —
a phospholipid bilayer with shaded heads and splayed tails, close-packed with small
irregular gaps, interrupted (never overdrawn) by a channel tinted with the species
it passes, its pore flared when open and pinched when shut, with the selectivity
filter at full species strength. Glossy ions from the shared `ionGradient`, sized
by their real hydrated ratios. A child who has been inside the axon recognises
where they are.

**And the crossing ions come from somewhere.** The first version animated separate
dots in from off-frame, which breaks a rule this app has held since Milestone 1: a
particle that crosses a membrane must arrive out of the crowd and leave into it.
Here the crowds are small enough to count, so the scene's answer (emerge from deep
anonymity) is not enough — a traveller is now a member of the crowd that sits still
at a real slot, leaves it, funnels to the pore, crosses, and settles into a real
slot on the far side. Source and destination come from the same function that
places the static ions, so a traveller is visibly one of them. The only thing
hidden is the reset from arrival back to departure, and that happens while it is
stationary among identical neighbours.

**Taller blocks, smaller notes.** 250 × 330 per chamber, and the two caveats
(calcium's floor, and the resting-potential hint) folded into a collapsed
"Two notes". The chambers are the teaching; footnotes should look like footnotes.

Two things went wrong on the way, both worth recording:

- **A canvas blur filter froze the page.** Ghost ions were drawn with
  `ctx.filter = 'blur(1.6px)'` — thirty filtered arcs per chamber per frame, four
  chambers, sixty times a second. `ctx.filter` is enormously expensive; the tab
  stopped responding and a screenshot timed out rather than returning a bad
  picture. Soft edges come from a radial gradient now, and the chambers redraw at
  30 fps rather than 60. **Never use `ctx.filter` per-object in a loop.**
- **The push arrows sat across the lipids.** Centred on the membrane, which is
  semantically where they belong, they overlapped the bilayer and their labels ran
  over the channel — making the one thing the exhibit is about the least legible
  part of it. They live on a small plate down in the cytoplasm corner instead: a
  legend rather than an in-situ annotation, and readable.

### Balls are conserved, and the bench settles by itself

Reported twice: ions appeared and disappeared from thin air. Both earlier attempts
deserved it — the first animated extra dots in from off-frame, the second animated
crowd members that faded in at the reset. Fixed properly, by making the balls
conserved objects and letting the physics move them.

**The exhibit's question turned round, and improved.** It used to be "hunt for the
voltage at which this ion stops caring", with the concentrations frozen. Now:
arrange the piles, set the battery, open a door — and the ions redistribute until
that ion's own voltage matches the battery. Same Nernst relation, solved for the
other unknown, and the system finds its own answer instead of the kid hunting for
a number. `equilibriumSplit()` solves it exactly so the settling can be driven
toward the answer without ever overshooting and wobbling.

This is honest *because the bench is a bench*: two chambers with a membrane
between them, both finite, both changing. A cell has a whole body of fluid outside
it and a pump holding the piles in place, which is why concentrations stay frozen
everywhere else in this app.

**How much crosses is now the measure of how far off the battery was.** At −72 mV
potassium needs less than one ball to move — the resting-potential hook, visible as
almost nothing happening. At 0 mV about seven of sixteen balls have to cross, which
is unmistakable. Nobody has to read a number to see the relationship.

**A crossing is a real event.** When the count of balls on a side changes, THAT
ball is the one drawn making the journey — leaving its actual place, funnelling
through the pore, arriving at an actual place. Nothing fades anywhere, because
there is nothing to hide. And at equilibrium the balls still swap, one each way, so
neither pile changes: net flow stops, motion does not.

**One knob live at a time.** The concentration sliders arrange the piles while the
door is shut and become read-only *readouts* once it is open — you watch them move
as the balls cross. The two-knobs-on-coupled-quantities problem that killed the
previous demo cannot recur.

**The ending inverted, and is better for it.** It used to be "no single voltage can
please every ion, so a membrane is a compromise". With the ions free to move, every
door CAN settle — so the ending is now: leave them open and everything drains to
equilibrium, and *a cell that got there would be dead*. What a neuron does is stay
away from here and pay to do it. Same conclusion about the pump, arrived at by
watching it happen rather than by being told it cannot.

#### `nernstMv`'s floor was too coarse, and it showed

Counts were floored at half a ball to keep the logarithm finite. That floor was
doing real damage: it put calcium's balance point at +19 mV when the true figure is
around +130 purely by arithmetic, and on the bench it stopped calcium ever reaching
equilibrium at all, because equilibrium sat *below* the floor — the settling ran
into the guard rail and stalled 4 mV short, so the chamber could never go green.
A twentieth of a ball is still a guard against infinity and is nowhere near any
answer the app shows. Calcium's number is now less wrong as a side effect.

**And a note on verifying this:** the settling is time-based, so it cannot be
checked from a screenshot — headless reports frame deltas that do not advance, the
same trap as the spike's playback. It is covered by tests instead (conservation
holds to six decimal places over four hundred steps; every species arrives at the
split where its own voltage equals the battery and stops there). The screenshots
verify the static states: mid-settle, settled, and the ending.

### The swap at equilibrium was spawning balls too

Reported again: balls appearing from nowhere once the main flow finished. Correct,
and the cause was in the part added to fix the previous version of the same
complaint — the equilibrium swap drew TWO EXTRA balls on top of the crowd, cycling,
so a pair popped into existence and vanished every few seconds. Everything else was
conserved; this one piece was not, and it only showed up after the flow stopped,
which is precisely when the eye has nothing else to follow.

**The swap is now made of real balls on round trips.** One ball from each side is
taken out of the static pass while it travels, goes over, and comes back to where
it set off. So the loop has no seam, neither pile ever changes, and the population
is constant at every instant — verified by sampling the same chamber at three
moments and finding the same balls in slightly different places rather than a
different number of them.

Two things this makes explicit, both now written into the architecture notes:

- **Anything drawn in addition to the population will eventually look like
  spawning.** The only safe form is: the travellers ARE population members,
  excluded from the static pass while away.
- **A looping animation must return to where it started**, or the wrap is a
  teleport — which is the same defect wearing a different coat.

#### And a real routing bug found on the way

`journey()` took the two channel mouths as "outer" and "inner" with a direction
flag deciding which came first — and that same flag also swapped source for
destination. So every OUTWARD crossing set off from the far side, dived to the
inner mouth, came back out through the outer one, and finished at the side it
should have started from. Every outward crossing in the exhibit was drawn
backwards. It takes the mouths in the order they are passed through now, and the
direction flag is gone: two callers, each naming its own order, and nothing to get
inverted.

### The bench fills the page, and the flow looks like flow

Three changes, and the middle one turned out to be a correction rather than a
preference.

**Full width.** The drawer takes the whole page, the heading and notes are no
longer capped at a reading measure, and the four chambers share the row equally —
each canvas measures itself with a `ResizeObserver` in both directions rather than
being a fixed card, so the bench fills whatever it is given.

**Nothing crosses once it has settled — and the arithmetic agrees.** The
round-tripping ball at equilibrium was confusing, and it was also WRONG, which is
the better reason to remove it. One ball here stands for a couple of millimolar. At
equilibrium the net movement is zero, so no ball has any business changing sides;
the individual ions really do keep swapping, but far too few of them to shift a
single ball. That is the same rule the spike already follows — below the resolution
of the drawing, show the state and say why the reading does not move — and it was
being broken here. The crowd jostles in place instead: motion, no transport, and
the wiggle is deliberately smaller than the margin each side is laid out with, so
no amount of it can carry a ball through the membrane.

Both earlier attempts at this were wrong in opposite directions: two extra balls
cycling (which spawned them), then one real ball round-tripping (which conserved
everything and looked like a ball bouncing off the membrane — a stranger idea than
either of the ones it was trying to convey).

**Sixty balls, and a push you can see.** Sixteen balls meant one stood for about
nine millimolar and a crossing was a lurch; sixty means about two and a half, and
opening a door produces a stream. Half of each ball's journey is now the APPROACH,
and every path ends at the same mouth, so the balls visibly converge on the opening
the way sand does — with the crossing itself brief. And the trip is timed by the
driving force: roughly 550 ms when the push is fierce, 1.6 s when it is barely
there. A violent gradient and a gentle one no longer look identical apart from
how many balls go.

One thing that needed saying, in the notes: each chamber spreads its OWN ion over
the same sixty balls, so the piles show a RATIO rather than how much of that ion
there is. Otherwise calcium's chamber — nearly all of it outside — looks as
crowded as sodium's, which would make the scarcest ion in the cell look abundant.

Also: a gradient is now built once per chamber per frame instead of once per ball.
Sixty balls, four chambers, thirty frames a second was seven thousand throwaway
gradients a second, and a canvas gradient is defined about the origin and painted
through whatever transform is in force — so one of them serves every ball.

### The charge is visible on the bench too

Each chamber's cytoplasm now carries the same red/blue field the neuron view uses,
and the battery wears it as well: its border, its slider and its reading all take
the colour of the charge it is imposing, with a plain word beside the number —
"inside negative — polarized", "no charge across it", "inside positive — reversed".
So which way the dial is going registers before anything is read, and the link
between the dial and the picture is not something to remember: you push the slider
bluewards and the insides go blue.

> **Superseded, 2026-08-25.** The colouring of the battery and the words beside its
> number were both removed, and the field it was meant to explain turned out never
> to have worked at all. See *"The dial had never moved the picture"* below. The
> paragraph above describes an intention, not the app.

The ramp itself moved into `stage/particleStyle.ts` as `chargeRamp`, so both
exhibits are literally the same colours rather than two sets that happen to look
alike.

**One nuance worth being honest about:** the two auras mean subtly different
things. Over the neuron it shows how far the membrane is from RESTING, because a
resting cell is already polarized and an absolute field there would be permanently
blue with the small hyperpolarizing dip invisible against it. On the bench there is
no resting voltage to be relative to — a battery is imposing one — so it shows the
polarity itself. What was supposed to make that safe rather than confusing was
the cause being on screen in the same colour: the battery right there, coloured to
match, so the field would read as "this is what the dial is doing" rather than as a
measurement needing a baseline. That is no longer how the debt is paid — see below.

As on the neuron, it tints the INSIDE only — a voltage across a membrane is the
inside measured against the outside — and it is strongest against the membrane and
fades away from it, because the charge a voltage IS sits in a thin skin there
rather than filling the cell.

### The dial had never moved the picture (2026-08-25)

A session that began as a colour question and turned into a bug, a physics
argument, and a layout rebuild. In order, because the order is the reasoning.

**A colour on a control is a promise about consequence.** The battery's tinting
came off. The intent had been good — turn the dial bluewards, watch the insides go
blue — but a colour on the thing you are holding reads as a cue to what will
HAPPEN, and a voltage cannot make that promise. Which way an ion moves is the sign
of (Vm − E_ion) times its charge, per species. One number cannot say it for four
ions, so the dial now states the voltage and claims nothing further.

The same argument settles a question that came up twice: whether the readings
should be absolute or relative to rest. Neither reference predicts flux. At rest
the deviation is zero while sodium is under about 130 mV of driving force and
potassium about 20 — they cancel in net current, not per ion. And 0 mV is not
special for any ion either; nothing changes about sodium as the membrane crosses
it. **The only reference that predicts a direction is that ion's own Nernst
voltage**, which is what `drivingMv` has always used and what each chamber's
balance mark and push arrows already show. So: absolute on the bench because a
battery imposes the voltage and there is no rest to be relative to, deviation from
rest over the neuron because that is what depolarized and hyperpolarized mean, and
neither of them pretending to answer a question about flux.

**Hue is spoken for; only lightness is free.** The cytoplasm was painted slate-900
against a near-black bath — two dark colours chosen to tell the compartments apart,
and slate-900 is a navy. Blue is this app's colour for a negative interior, so the
inside claimed a negative charge at every setting of the dial, +75 mV included. The
compartments are now told apart by LIGHTNESS of one grey, and the grey is the
charge ramp's own neutral, so an uncharged membrane genuinely looks uncharged. The
neuron view never had this problem: its cytoplasm was already the ramp's neutral.

**The dial had never moved the picture.** With the base repainted the inside was
STILL blue at +75 mV, and the reason was not a colour decision. `vm` was read
straight from the store and used inside the chamber's `requestAnimationFrame`
closure, whose dependency list is `[kind]` — so every chamber painted its charge
for `BENCH_START_MV` = −72 mV forever, whatever the battery said. The words came
from React and updated; the canvas did not. Two halves of one screen reading
different voltages.

The file's own comment said *"the drawing reads refs, so a frame never renders a
stale chamber"* — `chamber` and `counts` both had refs, and `vm` was the one value
that skipped it. **A value used inside a frame loop belongs in a ref even when it
arrives as ordinary reactive state**, and a store read that looks like any other
line of the component is exactly how it gets missed.

**What the dial does, made countable.** Kids cannot read −70, and positive/negative
tells them nothing, so dragging the slider carried no information. The answer was
the thing the voltage physically IS: ± marks hugging both faces of every membrane.
The COUNT carries the size, the SIDE carries the sign, and crossing zero empties
both rows and brings them back swapped — the one event in the whole sweep that
cannot be missed.

Count rather than opacity, for two reasons. A count is something you watch change
one mark at a time while dragging, where a fade is only noticeable against a memory
of a moment ago. And it is the honest encoding rather than a convenient one: a
membrane is a capacitor, Q = C·V, so twice the voltage really is twice the charge
held apart. The row is proportional because the physics is proportional, and there
is a test asserting exactly that rather than mere monotonicity.

The balls are untouched by all of this. The charge is a vanishing skin against the
faces; the crowds are the concentrations. A dial that visibly moved the piles would
teach that voltage and concentration are one quantity, which is the misconception
the bench exists to take apart.

**The field, drawn where it is.** Arrows across the oily core, pointing from the
positive face to the negative one — the direction the field shoves a POSITIVE ion.
Strength is thickness, brightness and count; never length. The field spans the
membrane and nothing else: E = V/d with d fixed, so a stronger field is a heavier
arrow across the same gap, and an arrow growing into the cytoplasm would be
claiming a force out there where there is none. Its colour is a neutral of its own,
because red and sky already mean "charge of this sign" and a field is neither.

Fewer arrows than marks, deliberately: every separated pair contributes, but one
arrow per pair turns the membrane into a picket fence and buries the channel, which
is what the exhibit is about.

`fieldDirection` is exported purely so it can be checked rather than eyeballed, and
the test asserts it against the sign of `pushesOn(...).charge` for every cation at
nine settings. `core/balance.ts` records that this exact inversion shipped once
before — the arithmetic added up, a test passed, and the picture showed a negative
interior repelling sodium. One further test pins the anion case: chloride at −72 mV
is pushed outward by the very field pulling potassium in, which is why the arrow is
drawn for a cation and the per-ion push arrows carry the rest.

**The outside stays untinted, and that was a decision.** Asked whether colouring
the bath would show the pulling and repelling forces more correctly. It would not.
The extracellular side IS the zero — Vm is inside-minus-outside with the outside as
reference — so +75 mV does not mean the bath is negative, it means the bath is zero
and the inside is 75 above it. An untinted outside is not a gap in the picture; it
is the convention made visible. Tinting it would also state two facts where there
is one: "the inside is positive AND the outside is negative" instead of "there is
75 mV across this, inside high". And the charge separation is already drawn
symmetrically — the ± marks are on BOTH faces, which is the field doing the
pulling, in the place it exists.

**The describer, and the floating panel that was wrong.** The prose was stacked
above and below the chambers, so the only part that is an experiment got whatever
height was left. First attempt was a draggable, toggleable overlay. It was the
wrong shape, and the reason is worth keeping: **because it could be shut, the live
half — the part that says what the dial just did — was only there for someone who
already knew to ask.**

Replaced with the house-style block the rest of the app and the sibling's periodic
table both use: one bordered column, `Right now` / `What am I seeing?` / `Tips`,
scrolling inside its own border. `Section` is now exported from `InfoPanel.tsx` and
shared, so it is literally the same component rather than a second thing that
resembles it. `Right now` is read off the same numbers the canvas draws from — the
setting, which face the minuses are on, which way the field points, and per open
door what is crossing and how far off that ion's balance the battery is — so the
words and the picture cannot come apart.

**The drawer is the periodic table's drawer.** Same size, same grid, same column
width: `w-[min(100vw,86rem)]` moved into `SideDrawer` as the default so the two
apps cannot drift, and `grid-cols-[16rem_minmax(0,1fr)]` with
`grid-rows-[auto_minmax(0,1fr)]`. Heading and standfirst removed — four membranes
and a battery announce themselves, and the framing line the architecture rules ask
for now opens `What am I seeing?` instead of sitting over the exhibit.

The chambers take the whole fractional row; the height clamp that used to leave a
band of dead drawer under them is gone. `minmax(0,1fr)` rather than a bare `1fr` is
the difference between fitting and a horizontal scrollbar: a plain `1fr` is
`minmax(auto,1fr)`, whose floor is the column's min-content, and each canvas is
given an explicit pixel width measured from its own box — so a wider canvas raised
the column's min-content, which widened the column, which widened the canvas. A
ratchet. The canvas is also absolutely positioned now, so it contributes nothing to
intrinsic width at all, which kills the loop at its source.

**The chambers stopped talking.** Every sentence is out of them — the settled note,
the crossing commentary, the would-be-content reading — and out of the battery row
too, including the polarity words, whose vocabulary moved into the first line of
`Right now`. What is left in the exhibit is controls and readouts: symbol and
charge, the balanced badge, the drawing, the door, the two sliders and their counts,
the two push arrows. One place to read, one place to touch.

### Step 13 — propagation, and the scale problem underneath it

N19 asks for local regeneration rather than a travelling packet. The model was the
easy half. The hard half was **where it could honestly be shown at all**, and the
answer turned out to rule out both of the obvious places.

#### Neither the patch nor the stage can hold it

Two candidates were considered and both are wrong, for the same reason measured off
the app's own constants:

- **A row of patches at the membrane zoom.** One length constant is
  `√(d·Rm / 4·Ra)` = **342 µm** for this 1.4 µm axon. At `MEMBRANE_ZOOM` (×3100)
  the canvas covers **78 nm** of axon — about **λ/4400**. Every patch on that
  screen depolarizes within tens of nanoseconds of every other one. Drawing a
  visible sequence there would be a three-order-of-magnitude lie told inside the
  one view whose entire authority is that its scale is real.
- **Pulling the camera back on the stage.** `pathLength(AXON_POLYLINE) / PX_PER_UM`
  is about **93 µm** — a quarter of one length constant, crossed in about **0.1 ms**
  against a 2 ms spike. Rendered truthfully the whole drawn axon lights up at once,
  and no magnification changes that: **a camera changes magnification, not the
  specimen.**

So propagation got its own view, with its own stated scale — millimetres of real
axon — and the drawn axon appears **on its ruler**, as the amber tick it honestly
is. That turns the scale break from a cheat into the lesson: the axon's
`simplification` has always confessed that real axons are hundreds to thousands of
times longer relative to the soma, and this is the first place that confession is
*shown*. `axonRibbon.test.ts` asserts the tick fits inside one drawn stripe, so the
two views cannot drift apart without a test failing.

It is a drawer, like the bench, and for one shared reason and one opposite one. The
shared one: the canvas underneath never stops being this neuron at one honest scale.
The opposite one: **the bench must not touch the cell, and this one must.** It reads
`ionStore` and `membraneStore` directly, so flattening sodium at the patch kills the
wave here too. Two views of one membrane must not tell two stories.

#### One cable, not N spike engines

The expensive-looking option — N copies of `trajectory()`, one per patch — is not
merely expensive, it is the wrong physics: each copy needs its own stimulus, and the
coupling between them would be something *written*. The honest coupling is one extra
term in the loop `spikeModel` already runs:

```
C·dV/dt = −(I_Na + I_K + I_leak) + (d / 4·Ra)·∂²V/∂x²
```

Charge spreads sideways because cytoplasm is a conductor. That is the only new idea
in `core/cable.ts`; the gates, the constants and the resting frame are `spikeModel`'s
own, now exported (`restingFrame` was pulled out of `integrate` so one patch and a
whole cable begin at the same voltage **by construction**).

The architecture survived intact because the bargain did: **integrate once into a
table indexed by position, then be a pure function of it.** A cable is that table
with a second index. Pause, scrub and drag-backwards are free for exactly the reason
they were free at the patch — there is no accumulated state, only a number to set.
`sampleCable` interpolates in both axes, so the drawing samples the physics rather
than the physics being pinned to a pixel count: **88 modelled compartments, 24 drawn
stripes**, and a test asserts the stripes are the coarser of the two.

**Two mistakes were made and caught by construction.** Patches are stepped from the
*old* voltages into a scratch array — updating in place lets the wave outrun the
physics by one patch per step, which reads as a conduction speed and is really loop
order. And the ends are **sealed** (a missing neighbour is a copy of the patch
itself); anything else drains the boundary and makes the model's own edge look like
a failure to propagate.

#### What it measures, none of it typed in

- **Speed: 0.61 m/s**, fitted as the slope of when each patch crossed zero, over the
  middle half only — the stimulated end is still being pushed and the sealed far end
  piles charge up with nowhere to go, and neither is conduction. Right ballpark for a
  thin unmyelinated fibre, and slower than walking, which is the whole reason
  vertebrates bothered with myelin.
- **Decrement: −0.0 %.** All-or-nothing stops being a claim and becomes a
  measurement.
- **Grid-independence.** Halving Δx moves the speed by 2 %, halving DT by 0.2 %. This
  was the one real scientific risk in the step — a "measured" velocity that is
  actually an artefact of how coarsely the axon was chopped up — and it now has a
  test.
- **Failure.** Flatten sodium and nothing propagates at all, with nothing written for
  the case.
- **No going back.** The refractory tail is not asserted; it is what the model does,
  and it is why the wave has a direction. N22 will get to *name* something that is
  already on screen.
- **A push in the middle leaves in both directions at once**, symmetrically to within
  the sampling interval. This is the demonstration that settles the argument, because
  nothing that travels can go two ways, and it is offered as a control on the toolbar
  rather than buried.

The stimulated stretch is **400 µm**, not a point, and that is a real fact rather
than a fudge: current put into one patch drains sideways into its neighbours, so a
push that fires an isolated patch may not fire a cable. At 200 µm the same push still
fires the sealed end, where current can only drain one way, but **no longer fires the
middle**, where it drains into both.

#### Three instruments, one instant

The tube coloured by distance from rest (the same `polarizationT` ramp the patch view
tints its cytoplasm with, so red means the same thing in both places); a sodium door
and a potassium door on **each wall** of every stripe, open by exactly as much as that
patch's gates are; and **voltage against DISTANCE** underneath — the other axis from
N17's graph, and what makes "it does not fade" something you can see. Arrows through
open pores rather than drawn ions: what crosses is a current, and a ball would be a
claim about one ion's path the model does not make.

There is no sprite anywhere in it. The test that matters is `does not care what order
the stripes were drawn in` — two frames at the same moment must produce identical
calls, because nothing on the ribbon is positioned from a clock. `frontAt` exists
only for the ruler and the readout; delete it and the picture is unchanged.

**The integration is warmed on idle while the drawer is still shut.** A tenth of a
second is nothing once and forever, but spent inside a render it is a stutter in the
middle of the drawer sliding open — the one moment it would be noticed.

**A gate lookup table** (0.05 mV grid, linear) replaced five `exp` calls per
patch-step: 409 ms → 67 ms for five million evaluations. It is an optimisation and
must be invisible, so `tabulatedGates` is exported and checked against the exact
functions on a grid deliberately offset from its own.

#### Left for the follow-up, deliberately

`chain.ts` still carries `axonHead: number | null` — **one travelling packet, on the
default view**, which is the misconception in code. The axon part's `simplification`
still calls the travelling glow "a preview", which remains true and should stop being
true. Replacing it with a run of discrete patch flashes is the next thing this
milestone owes, and it was kept out of this step to keep the diff readable.

#### Step 13b — the way in, and the membrane meeting the house standard

Two changes after the first pass, both from the same observation: **the word
"axon" names nothing for a child who has not met one.** The exhibit was reached
from a list at the axon-membrane patch, which meant reaching it required already
knowing where to go and reading a word to find out what was there.

**The entry point is now a magnifying glass on the axon itself**, on the whole-
neuron view, beside the ones that lead to the membrane and the synapses. A ring in
the right place answers "which part of the neuron is this" in the only way that
works for a beginner: by pointing. `ZoomTarget` grew one optional field, `opens`,
and there is exactly one target that uses it — because a marker that does not fly
the camera is a claim that needs justifying, and this one is justified by
arithmetic rather than by taste. The drawn axon is 93 µm; propagation needs
millimetres; no magnification of this stage will ever contain it. A test asserts
the marker sits on the axon polyline and that no opening marker carries a
membrane `frame` (a frame means "this is a patch of wall", and the charge field,
the lipids and the ion crowds all key off it).

The exhibit came off the `This membrane can show` list entirely. A demo there
answers "what else can this patch show me", and the answer here is about a length
of axon rather than about that patch.

**The drawer opens with a locator**: the whole cell drawn small, the axon lit, and
the dashed ring where the marker was pressed. Built from the same `layout.ts`
geometry the main canvas uses, so it cannot slowly stop being a picture of that
neuron.

##### One bilayer, and where it can honestly be drawn

The ribbon's membrane was two plain white lines, which is not how this app draws a
membrane anywhere else. Fixing that properly meant confronting a scale problem
rather than restyling a stroke.

**`stage/bilayer.ts` now holds the schematic bilayer** — heads, tails, oily core,
and the gated channel with its flaring pore and selectivity filter — moved
unchanged out of `benchScene.ts`, which was the second place a bilayer had been
drawn and the second set of numbers for how big a lipid head is. The bench and the
axon view now call the same code. The whole-neuron canvas deliberately does not:
out there the membrane derives its size from `core/membrane.ts` and resolves into
real lipids only past ×500, and the schematic and the honest bilayer must not be
confused for each other.

**But lipids cannot go on the ribbon.** Its x axis is six millimetres of real axon;
a phospholipid head is one nanometre, which is a millionth of a pixel there. Drawn
anyway they would imply molecules spaced 80 µm apart. So the ribbon's walls are a
BAND — the oily core between two head-coloured faces, in the bilayer's own palette,
so it reads as the same membrane seen from too far away to make out the lipids,
which is exactly what it is.

**The molecules went into a callout instead**, magnifying one stripe until its
lipids and its two voltage-gated doors show, drawn with the shared module. Click
any stripe on the ribbon and the magnifier moves there. Both real lengths are on
screen at once — millimetres on the ruler, **about 58 nm** in the panel — and that
pairing is the teaching rather than a caveat.

Its magnification is stated **against the ribbon (×38,000), not against life.**
Magnification against life depends on how big a pixel happens to be on the screen
it is read on, which is not a fact about the drawing; the ratio between two
drawings on the same screen is. Both numbers are derived from the bilayer's own
proportions — a membrane is 5 nm thick and the module knows how many pixels that
is — so `calloutNm` and `calloutMagnification` are measurements of the picture and
the caption cannot drift away from it. A test asserts the callout shows less than a
thousandth of the stripe it magnifies, so "inside one stripe" can never quietly
start reading as "here is that stripe".

**The doors along the ribbon stayed, with their compromise stated.** One sodium and
one potassium door per stripe, where a real stripe holds millions. They carry the
one lesson nothing else can — three different door states visible at one instant,
which no single travelling object could ever have — and the panel now says outright
that they are one drawn sample each, and that what is honest about them is how far
open they are.

The default stripe is not the one under the electrode. A stripe at the electrode
teaches the spike; a stripe most of the way along spends most of the run doing
nothing at all and is then woken by its neighbour, which is the idea.

#### Step 13c — onto the canvas, and a magnifying glass

The drawer is gone. The propagation view is a **zoom target like any other**: the
camera really flies to a marker on the axon, at ×14 — which is not a chosen number
but whatever it takes to draw this axon's own 1.4 µm at a width you can see into —
and turns just far enough to bring that stretch of axon level, because a ruler in
millimetres and a graph of voltage against distance both have to be square to the
screen.

It is drawn on a **second Konva layer with no camera transform**, which is the
whole reason this was cheap: the camera lives on the layer, so an untransformed
sibling layer is screen space for free and `drawScene` was not touched. The main
layer's opacity falls to zero as the view arrives — without that, the scene's own
straight tube fringes out around the wobbling one drawn over it, and two axons at
slightly different widths is one axon too many. The run is clocked in the stage's
existing animation loop, the same way the spike is, and `axonStore` no longer holds
an `open` flag: whether the view is showing is which zoom target the camera is on,
and the neuron store already knows that. Two places holding one fact is two places
to disagree.

##### Thickness true, length squashed — and it says which

The scale problem is still there and is now stated as one number rather than
argued about. The axon's **thickness** is drawn at the camera's own honest scale —
86 px is this axon's real 1.4 µm at ×14. Its **length** cannot be: a spike lasts
about 2 ms and moves at about half a metre a second, so the lit stretch is a
millimetre or two, and the drawn axon is 93 µm end to end. So the length axis is
squashed, by a factor `lengthSquash` derives from the drawing itself — the ratio of
micrometres-per-pixel along to micrometres-per-pixel across — and reported under
the graph as **length squashed ~390×**. A long garden hose drawn short but just as
thick. A test asserts the tube's drawn half-width really is the honest one, so the
factor cannot quietly become a fudge.

##### A playful axon

The tube meanders, thickens and thins and beads, because a real axon does and
because a rectangle is not a thing a child recognises as alive. The wobble is a sum
of three sines of x — no clock, no randomness — which matters for more than
tidiness: a shimmering tube would look alive in a way nothing about it is, and
would break the same-inputs-same-picture test the whole view rests on. It is kept
**inside the honest envelope**: meander plus swell never exceed the axon's true
half-width, so the widest the tube ever gets is its real width. Tested. Both ends
are rounded rather than running off the frame, because the model's ends are sealed
and a tube vanishing off the edge would promise axon the model does not have.

##### The magnifier is two circles

The rectangular callout is replaced by a magnifying glass: a small ring sitting on
the membrane at the chosen stripe, a big lens above showing that spot enlarged, and
a dashed cone joining them. A shape a child already knows how to read — and it
makes the relationship between the two scales spatial, rather than something to be
worked out by comparing two captions.

The lens is clipped to a circle and drawn with `stage/bilayer.ts`: the same lipids
and the same gated channel the balance bench uses, with sodium crowded outside and
potassium inside, and the two doors open by exactly as much as that patch's gates
are. It reports **~32 nm across** and how many times bigger it draws a nanometre
than the axon beside it — against the picture, not against life, since
magnification against life depends on how big a pixel is on the screen it is read
on. Click any stripe to move the glass.

No lipids on the axon itself, and that is deliberate rather than a shortcut: over
six millimetres a phospholipid head is a millionth of a pixel, and drawing
molecules there would put them 80 µm apart. The membrane along the axon is the band
it looks like from that far away — the oily middle between two paler faces, in the
bilayer's own palette — so it is recognisably the same membrane, just too far off
to see the molecules. Which is what the glass is for.

#### Step 13d — three small corrections

**Lipids pack against a protein, so the drawing does too.** `drawLipids` used to
step along at a fixed spacing from the left, which left a gap of up to a whole
lipid's width wherever a protein happened to fall — a moat around the channel, and
a channel with a hole in the membrane either side of it is a picture of a leak.
Each bare stretch between proteins is now filled edge to edge, with the spacing
inside it flexing by a few per cent so the ends come out even. Shared code, so the
balance bench gets the same tightening.

**One push along the axon, not two.** Whether a stimulus is over the line is the
membrane patch's lesson and it is taught there, with both pushes and a threshold to
be found. Out on the axon the question is what happens to the NEXT patch once this
one has fired, and a push that never fires anything has nothing to say about it.

**The zaps are gone, and the real term is back.** "A small zap" and "a big zap" are
now **Weak stimulus** and **Fire an action potential**. The playground words were a
deliberate trade — the size of the lightning was doing the explaining and "action
potential" was a term nobody had met yet — and that trade is off: a child who has
been through the membrane patch has met it, and a made-up word for a real thing has
to be unlearned later. The bolt beside the label still carries the size at a
glance, and the buttons now grow to fit their words rather than clipping them.

Worth being explicit about one consequence: "fire an action potential" is a label
that can fail. Press it with sodium's gradient flattened and nothing happens. That
is the lesson rather than a loophole — the spike is the membrane's to produce, not
the button's — but it is the kind of promise the app is careful about elsewhere, so
it is written down here on purpose.

#### Step 13e — one push, one button, and the picture on the floor

**The mid-axon electrode is gone.** It was a lovely argument — a push in the
middle leaves in BOTH directions at once, which nothing that travels can do — but
it is not something a neuron does to itself. Action potentials start at the axon
initial segment, where sodium-channel density is tens of times the soma's; a spike
beginning halfway along an axon is an electrode, a nerve stimulator, or an injured
nerve firing ectopically. Real, and worth building one day with the words to go
with it, but not worth a toggle in a view where every other control is something
the cell does. **The physics was not what got cut**: `stimAtUm` is still in the
model, and the test that a mid-cable push leaves symmetrically in both directions
still runs.

**No repeat button.** A finished run is not a state to be dismissed. `propagating`
now means "this run has somewhere left to go", so when the wave reaches the end the
cause button comes back — the same grammar the membrane patch already uses, where
the play button IS the fire button.

**The picture sits on the floor.** `ribbonGeometry` lays out from the bottom up
rather than centring the axon: the graph and the ruler take exactly what they need
and rest on the bottom edge, the axon sits above them, and the magnifier takes
everything left between the axon and the strip the controls occupy — which is most
of the height, and is why the lens is now the biggest thing on screen. It should
be: it is the only place the molecules can honestly be drawn.

One cost, written down rather than discovered later: the scene's own axon, which
the camera flies to, is centred on the stage, so during the hand-over the tube
fading in sits a little below the tube fading out. The scene is nearly gone by then
— its layer's opacity is tied to the same fade — so it reads as the axon settling
rather than as two axons. Filling the canvas is worth that.

#### Step 13g — the little neuron, in its own block, running

The locator moved out of the describer into a panel of its own above it. "Which
part of the neuron is this?" is a question a picture answers, and it should not
have to be scrolled to.

**And it runs.** Its axon is cut into eighteen segments, each tinted by
`patchHeat` — now exported from `axonRibbon` and used by BOTH pictures, reading the
same cable at the same position. That is what makes "in sync" structural rather
than two drawings that happen to agree today: red and blue cannot come to mean
different things in the two views, because there is one function that decides.
Tested from both ends — neutral everywhere on a resting axon, and hot at the front
with a cold tail behind it at one instant.

**Nothing travels across it.** Segments take their turn, exactly as the stripes do
on the canvas. A glowing dot sliding along a thumbnail axon would have undone in
80 pixels what the whole milestone is for — and it would have been the easy thing
to write, which is why it is worth writing down that it was refused.

**Nothing outside the axon lights up.** No soma, no dendrites, no terminals: the
model has none of them, and a cell body that glowed here would be an invention. The
caption says so, which is cheaper than being asked.

Two smaller decisions. The position is read **bucketed** — 150 steps across the
run — so a thumbnail is not re-rendered sixty times a second to move a colour by a
hundredth of a shade; the bucket only changes about thirty times a second and
Zustand's equality check drops the rest. And the segments have **butt caps** rather
than round ones: each stroke is one stretch of membrane at one voltage, and a round
cap paints it over its neighbour's. A resting cable is drawn underneath so a
hairline between two segments reads as axon rather than as a gap in it.

The one thing this drawing does not claim is length. Its axon stands for the six
millimetres being modelled, drawn to the neuron's shape rather than to scale. The
canvas is where lengths are stated, and it has a ruler for it.

#### Step 13h — the whole cell fires, and the pores carry traffic

**The map lights the whole neuron, not just the axon.** The first version swept a
crest along the little axon and left the rest of the cell grey. Both were wrong,
and wrong in the direction this milestone exists to correct.

This cell is tiny. Its axon is 93 µm, its dendrites reach about 30 µm, and one
length constant is over 300 µm — so the entire drawn neuron is a fraction of the
distance a voltage spreads. Sweeping a crest along that axon claimed a delay a
thousand times smaller than the one drawn, and leaving the soma grey claimed that
a cell body wired to a firing axon somehow stays at rest.

So all of it lights, from the same run: the soma and dendrites take the cable's
near end, the terminals its far end, and the drawn axon's twelve pieces are mapped
into the first 93 µm of the model, which is where the stage's axon actually sits.
They come out one colour — and that is the point, made visible rather than
asserted. `lengthConstantUm` now takes a diameter, so the dendrites attenuate by
their own λ, worked out from their own width: about 15 % over the length they are
drawn at. Real, and small, and worth seeing.

The colour means what the ramp always means here — **how far from rest**, not "is
firing". The dendrites are not firing; nothing in this app lets them. They are
being dragged along by a soma that is, which is what being one continuous bag of
salty water does, and the caption says so.

**Ions cross the open pores in the lens**, and their positions come from `carried`
— how much charge that ion has actually put through that patch by now. Not a
clock. They set off when the door opens, hurry at the peak of the current, stop
dead when it shuts, and never drift backwards through a membrane.

That took two goes and the second one is the interesting one. `carried` first
returned a SHARE of its own run, which the tests immediately caught: with sodium's
gradient flattened the share still climbs to one, so exactly as many ions would
have been drawn pouring through a membrane where no spike happened. It now returns
an AMOUNT, in C/cm², and the drawing converts it at a stated rate — so half the
charge is half the crossings, and a failed run visibly puts fewer through. (It puts
some through, which is itself worth seeing: with E_Na at zero, sodium really does
pour in. It simply cannot take the membrane past zero, so there is nothing to hand
on.)

The rate itself is admitted as a drawing rate. A real spike moves millions of ions
through a square micrometre, so no honest number of balls can go on a screen; what
is honest is everything relative, and that is what the constant preserves.

#### Step 13i — one signal language, and a cause for the spike

**The outside stopped carrying charge.** Both the axon and the lens tinted the
fluid outside with the charge ramp run backwards, on the reasoning that charge is
separated rather than created. True, and still the wrong picture: **the outside is
the reference.** −72 mV does not mean the bath is positive, it means the bath is
zero by definition and the inside is 72 below it. Colouring it states two facts
where there is one. The balance bench settled this long ago and for exactly this
reason; this view had quietly gone its own way.

**`stage/signal.ts`** now holds `SIGNAL_RGB`, `SIGNAL_CORE` and `softGlow`, moved
out of `drawScene`. That was fine while the whole-neuron canvas was the only place
a signal appeared; it is now used by three views, and three private copies of a
colour is how a visual language stops being one.

**The axon carries the yellow flash, on the crest.** It is worth being exact about
what it is, because a yellow blob sweeping along a cable is the very picture this
milestone exists to dismantle. It is not a thing drawn at a position — it is a
per-stripe brightness (`patchSignal`, exported and shared) computed from that
stripe's own voltage: above zero it lights, brightest at its peak, dark once it has
fallen back. Neighbouring stripes each doing that is what a sweep looks like, and
drawing them in a random order changes nothing. Two colours doing two jobs on
purpose: the ramp answers "how far from rest", the yellow answers "is the signal
here". A test asserts the yellow is never lit where the ramp is not hot, so the two
cannot start telling different stories about the same stripe.

**The little cell is in the same language**, and the red/blue is gone from it —
that question belongs on the canvas, where there is room to read it.

**And the run has a lead-in.** A spike with no cause is half a lesson. Pressing ⚡
now starts a signal where signals always start: a ripple at the dendrites,
spreading in and fading as it goes (graded, which is the contrast the axon exists
to break), the soma filling up, the hillock letting go — and **the arrival is what
starts the run on the canvas.** `LEAD_MS` is choreography and says so, the same way
`chain.ts` does; what it buys is that the button is no longer the cause.

The hand-over is a fade rather than a switch: the lead-in's glows die over the
first moment of the run while the axon's own light comes up, which was worth
getting right — left alone, a soma lit at the end of the lead-in went on glowing
for the whole run.

#### Step 13j — the little axon gets a route again

The all-at-once flash was intended and it was the wrong call, which is worth
separating. The claim behind it is true — 93 µm of axon against a length constant
over 300 µm, so in life the whole of it fires within a fraction of a millisecond —
but the panel's JOB is to say *where*, and lighting everything at once gave the eye
nothing to follow and left the dashed ring looking arbitrary.

So the signal travels: dendrites, soma, hillock, and off down the axon — and
**reaching the ring is what starts the run on the canvas.** From that point its
position follows the model's own front, remapped onto what is left of the drawing.
No attempt is made to match speeds; this panel is a route and the canvas is the
measurement, which is stated in the caption and in the module's own header.

The honest counterweight is next door and unchanged: the canvas is millimetres,
with a ruler, and the amber tick on that ruler is this entire axon. The describer
still says a spike crosses the whole drawn axon in about a tenth of a millisecond.
A route map is allowed to be a route map while the measurement is on the table
beside it.

**It is not a travelling dot.** Every stretch the signal has passed stays lit and
settles behind it over about a fifth of the axon — because that is what happened to
it, each piece firing in its turn. A lone moving blob is the one picture this
milestone exists to prevent, and a wake is both truer and easier to read.

The backpropagation glow into the dendrites went with the all-at-once flash. It was
a real effect drawn at the right strength, but it belonged to a picture of the
whole cell doing one thing at one moment, and it has nothing to say in a picture of
a signal on its way somewhere.


#### Step 13k — the route map was overstating a delay, and five smaller fixes

**Step 13j is reverted, and it was right to ask.** Drawing the signal setting off
down the little axon read well and overstated a delay. The numbers: the drawn axon
is 93 µm, a spike crosses the whole of it in about **153 millionths of a second**
at the speed this model measures, and one patch takes about **2 thousandths** to
rise and fall. The journey along that axon is a few per cent of one spike.

It was not false in the abstract — the panel had been declared as standing for the
modelled 6 mm rather than for its own 93 µm, which makes the timing honest and only
the length schematic. But the picture is the neuron's own shape, so it will be read
as this neuron's axon, and what it then says is that this cell has a head-to-tail
delay you can watch. That is the exact misconception the milestone exists to
prevent, and a declaration in a caption does not undo a picture.

**So the split now follows the physics.** The signal travels on the way IN and not
on the way out. In the dendrites it genuinely travels — a graded potential spreads
inward over milliseconds and fades as it goes, which is the contrast the axon
exists to break — so the ripple is drawn travelling and weakening. Along the axon
it cannot, at this size, so the axon, the terminals and the soma light **together**,
which is what they really do.

What the moving light was buying — something for the eye to follow, and a reason
for the ring to be where it is — is paid for in words instead: a line in `Right now`
pointing at the all-at-once flash so it is not read as a bug, and a note in
`What this leaves out` giving both numbers, derived from the run rather than typed.

##### Five smaller fixes from looking at it

- **The action potential reaches the endings.** The boutons were being left dark:
  they were lit only through a wake function that needed the front at exactly 1, and
  the terminal branches were never lit at all. They now light with the axon —
  branches, glow and bouton — which is the point of the whole journey.
- **The yellow aura sits BEHIND the axon.** It was drawn over the tube and washed
  the red out; two colours mixed into an orange smear is two readings lost rather
  than one gained. Drawn before the tube, the opaque body masks it and what survives
  is a halo standing out around the cable. Its radius nearly doubled.
- **The red flare is visible again**, helped by the above and by the stripe tint
  going from `0.18 + 0.6·|t|` to `0.24 + 0.74·|t|`.
- **The magnifier's cone is wider**: 1 px hairline to 2.6 px, with a longer dash.
- **The little cell stops glowing when the signal is over.** The old wake stayed lit
  behind the front for ever, because it was a function of position only. The whole
  cell's brightness is now `patchSignal` read at the drawn axon's own stretch of the
  model — so it comes up when the axon fires and goes out when the axon repolarizes,
  by construction rather than by a timer.


#### Step 13l — the magnifier's small circle

The ring on the membrane was a fixed 13 px against a lens of 121 — a dot beside a
disc, which read as "look here" rather than as "this piece, enlarged". It is now
tied to the lens (`spotRadius`, a quarter of it, about 32 px), filled with a wash as
well as outlined so it takes an area rather than marking a point, and its rim
matches the widened cone. Small circle, big circle, the second being the first
enlarged: a shape anyone can read without being told.

**And it is a cheat, so it says so.** The piece of membrane in the lens is 43 nm
across, which down on the axon is **about a 148th of a pixel** — unmarkable. A ring
drawn at its true size would be invisible, and a marker you cannot see marks
nothing. So the ring is drawn big enough to see and to pair with the lens, and the
describer now owns up to it in the same breath as the magnification: everything
inside the lens is to scale, the ring is a signpost. `spotTruePx` derives that
number from the drawing, so the sentence cannot drift, and a test asserts it stays
tiny — if the spot ever stopped being a fraction of a pixel the confession would
have to go.

This is the same bargain the synaptic cleft has had since the first milestone: an
exaggeration that has to exist, stated rather than hidden.


#### Step 13m — the canvas stopped talking

Right-aligned labels in an 84 px gutter were running off the left edge, and the fix
was not a wider gutter. Widening it pays twice for the wrong thing: less axon on
screen, and a caption still competing with the panel that already said it better.

So every word came off the canvas. **The bench settled this principle three
milestones ago** — "one place to read, one place to touch", with everything that
INTERPRETS a number living in the describer — and this view had quietly drifted from
it, ending up with side labels, a plot title, an amber ruler note, a caption on the
front marker and a three-part readout row along the bottom. All of it is now in
`What am I seeing?`, in sentences, where there is room to say what a thing means
rather than only what it is called.

Two exceptions stay, and the distinction is worth keeping: **the millimetre ticks
and the graph's two guide values.** They are not labels for the picture — they are
the numbers on a scale, and a graph whose axis has no numbers is a shape. The guide
values moved from the gutter to just inside the plot, sitting on their own lines,
which is where they should have been anyway.

The gutter is now 30 px instead of 84, so the axon is 54 px longer.

**And the spot ring came back down.** 13 px read as a dot beside a 121 px lens;
32 px was too much the other way. It is 16 % of the lens now — about 19 px — which
pairs with it without competing. The describer's confession about the ring being
far bigger than the speck it marks is unaffected: `spotTruePx` measures the spot,
not the ring.


#### Step 13n — "the axon fires all at once" was a sentence that could not stand alone

Caught by the obvious next question: if an axon fires all at once, what would
myelin be for? Nothing — and step 14 is N20–N21, the myelin comparison. The
sentence would have poisoned it before it was built.

The claim itself is true and stays. This cell's axon is 93 µm; a spike is done with
the whole of it in about 150 millionths of a second, so lighting it in one go is
what actually happens. What was wrong was the **scope**. "The axon fires all at
once, right out to the endings" reads as a fact about axons, and a child has no way
to know it is a fact about a 93 µm one that has also been drawn far shorter than
real axons are.

Two changes, both about saying the second half in the same breath as the first:

- The map's caption now leads with the reason — *this little axon lights all at
  once because it is only 93 µm long, drawn far shorter than a real one* — and adds
  the line that closes the hole: **it is not that axons have no delay, it is that
  there is no room for one here.**
- `cableFacts` gained **`whyMyelin`**, which does the arithmetic out loud: at the
  speed this run measured, a nerve reaching a metre down your leg would need about
  **1.7 seconds**, and you would fall over before you felt the floor. Derived from
  `traj.speedMs`, silent when nothing propagated, and it hands straight over to the
  next step.

A test now asserts the two halves cannot be separated: wherever the facts mention
93 µm they must also mention myelin and quote the journey time worked out from the
measured speed. If somebody trims that paragraph, the suite fails.

Length turns out to be the through-line of this whole milestone, and it is now
stated the same way three times: the drawn axon is too short to show a delay, the
canvas is millimetres so that it can, and a real nerve is so long that the delay is
the only thing that matters.


#### Step 13o — gradual propagation on the map, and why the last correction over-swung

Step 13k lit the little axon all at once, on the grounds that a 93 µm axon has a
0.15 ms delay and drawing it as a journey overstates one. Accurate, and the wrong
trade: **a picture of an axon lighting as a unit teaches that an axon fires as a
unit**, which is the misconception the whole milestone exists to dismantle. Accuracy
to seven per cent bought at the price of the central idea is a bad bargain, and no
caption undoes a picture.

Two things I had lost sight of:

- **The delay is real.** It is 0.15 ms, not zero. Drawing it slowly is
  time-stretching, which this app does everywhere — the spike is stretched about
  210×, the whole-neuron chain between 450× and 6,000× — and not an invention. The
  objection I had raised was about the axon leg being stretched ~20× more than its
  neighbours, which is an argument about CONSISTENCY, and I mistook it for an
  argument about honesty.
- **The little axon does not have to be the drawn 93 µm.** It is now a map of the
  modelled stretch: the same six millimetres the canvas shows, drawn along the
  cell's outline instead of along a ruler, with the ring marking where the canvas is
  looking. Under that reading nothing is exaggerated at all — the same compression
  the canvas already declares (length squashed ~390×), just more of it.

**It lights piece by piece**, and each piece lights from `patchSignal` read at its
own place in the model — the same function the canvas lights its stripes with, so
the two are one picture at two zooms rather than two animations that agree by luck.
Drawn in a random order it would look the same, which is the test that matters.

The lead-in still carries the signal from the hillock to the ring on its own clock,
because there is no model before the run starts; the two overlap for a moment at the
hand-over so neither blinks.

The describer now says what the map is — same stretch, drawn along the neuron — and
keeps the 93 µm figure where it belongs, attached to the amber bar on the canvas
ruler. `whyMyelin` from the previous step is untouched and still does the work of
stopping "no delay worth seeing" turning into "axons have no delay".

**The home view needs the same treatment**, and my earlier recommendation there was
wrong for the same reason: shortening `AXON_AP_MS` to 200 ms would have made the
axon leg invisible. The fix is to keep visible travel and draw it as successive
patch flashes rather than as one glow with a position — consistency of stretch, and
regeneration rather than a packet.


#### Step 13p — a block flash hiding where the model ran out

Spotted on screen: something flashed on the little cell just before the dashed
ring, right as the run began.

It was the seam. The modelled stretch starts AT the ring — that is what the
hand-over means — so the piece of axon between the soma and the ring has no model
behind it. `litAt` had been handing that piece the model's reading at `p = 0`,
because something had to be put there. The effect was that the whole stretch from
soma to ring lit as one block the instant the near end of the cable fired: a third
of the axon flashing as a unit, which is the exact picture this panel exists to
avoid, tucked into the corner where the model ran out.

Fixed by admitting the seam rather than papering it: before the ring the light
belongs to the lead-in, which has already passed through and now settles and goes
out; from the ring on it belongs to the model. Nothing is invented for the gap
because there is nothing there to invent.

Worth noting what found this. Not a test — the suite was green throughout, because
every test asserts about the model and this was a drawing choice made where the
model does not reach. It took looking at it.


#### Step 13q — the map keeps only the picture

Heading and caption both gone. A drawing of a neuron with one part lit announces
itself; the bench made the same call three milestones ago and for the same reason.
The paragraph that explained the yellow moved into `What am I seeing?` alongside
the one that says what the little cell stands for, so the two sit together instead
of one being stranded under a thumbnail.

That leaves the panel as a bordered picture and nothing else, and the whole view now
keeps its words in one column: **one place to read, one place to look.** The canvas
lost its labels in step 13m for the same reason; this finishes the job.


#### Step 13r — the arrival was the one moment not drawn

On the whole-neuron view the action potential ran the length of the axon and then
simply stopped. The glow reached the last branch point, `axonHead` went to null,
and the boutons sat dark for another half second until a release glow appeared. The
arrival — the entire point of the journey — was the one thing not on screen.

`ChainState` gained **`terminalAP`**, its own signal, deliberately separate from
`terminalRelease`. They are two events and the gap between them is a lesson: the
spike gets to the terminals, and THEN calcium and vesicles do something about it.
One glow doing both jobs would have merged a cause into its consequence, which is
also the shape the synapse milestone will need kept apart (S02 is exactly "AP
arrives → Ca²⁺ enters").

It rises over the last 14 % of the axon leg rather than switching on at the phase
boundary, because the branches ARE the axon and the spike arrives in them; it fades
over the first half of the terminal phase as the release comes up. `drawScene`
lights the branches and haloes the boutons, under the bouton itself so vesicles and
release stay on top — this is the membrane going, not the release happening.

Two tests: the arbor lights before any release, and it never lights at all on a run
that does not reach threshold.


## Step 14 — N20–N21, myelin

### The model first, because it decided the rest

`cable.ts` cannot do myelin, and the reason is arithmetic rather than effort. A
node of Ranvier is about 1 µm long, so the grid has to resolve 1 µm; an explicit
step on the axial term needs `dt < C / 2k` with `k` growing as 1/Δx²; and myelin
then divides C by the number of wraps. The limit lands at **6 × 10⁻⁷ ms — 3,500
times smaller than the step we take now.** Twenty milliseconds of that is
thirty-five million steps.

So `core/fibre.ts` is a second solver, and both of its differences are the standard
answers rather than inventions:

- **A non-uniform grid.** A node is one short compartment, an internode a handful
  of long ones — which is how myelinated fibre is actually modelled and cuts the
  compartment count twentyfold against resolving everything at 1 µm.
- **An implicit axial step** (backward Euler, solved as a tridiagonal system by
  Thomas's algorithm). Unconditionally stable, so the step is set by how fast the
  gates move rather than by how finely the axon is chopped.

Everything is in absolute units — a compartment's area, its capacitance in µF, the
axial resistance between neighbours in ohms — because with compartments of
different lengths there is no common area to divide by.

**It is cross-checked against the model it does not replace.** On a bare axon the
two share almost no code — even grid versus uneven, explicit versus implicit — and
agree to within a few per cent: `cable.ts` says 0.606 m/s, `fibre.ts` says 0.626,
converging to 0.629 as the grid refines. That agreement is evidence rather than a
tautology, and it is a test.

### What it measures

| | bare | myelinated |
| --- | --- | --- |
| conduction speed | **0.63 m/s** | **3.12 m/s** |
| 2 mm crossing | 3.2 ms | 0.64 ms |

**×5.0, measured** — off the same push, the same gradients, the same solver. Real
myelin on a 1.4 µm fibre buys more like ×10–20; ours understates because the gates
throughout are Hodgkin and Huxley's squid kinetics at 6.3 °C, which are slow for
both fibres. N21's guardrail asks for relative speed rather than exact scale, and
relative is what this is.

Every number in the sheath is derived: internode = 100 × diameter (140 µm), wraps
from the g-ratio and a 15 nm lamella (25), and the sheathed length constant grows
as √wraps to **1,708 µm** — which is the whole mechanism, and why one node can
reach the next.

### Three wrong assertions of mine, caught by the tests

Worth recording, because each was a real misconception and two are ones the app
could easily have drawn.

1. **Node channel density is half of what myelination is.** The first model gave
   nodes ordinary squid density and got only ×2.9 — each node too weak to drive the
   next. Real nodes carry 1,000–2,000 sodium channels per µm² against roughly 100
   in bare axon. `NODE_DENSITY` is set to 12, the cautious end of that range, and a
   test asserts that removing the clustering measurably slows the fibre.
2. **Membrane under the sheath swings nearly as far as a node does.** I had
   asserted the opposite, and the test failed. The internode is a good cable and the
   axoplasm in it goes where its neighbours go. What the sheath holds back is
   CURRENT, not voltage — and now that is the assertion.
3. **The spike does not hop.** "Saltatory" means leaping and every textbook draws
   a spike jumping over dark internodes, so I wrote a test for a staircase. The
   model gave a tread and a riser of the same size — a smooth run. It is right: a
   140 µm internode against a 1,708 µm length constant leaves nothing to leap over,
   and most of the capacitance to charge is under the sheath rather than at the
   nodes. What is genuinely nodal is REGENERATION, which is exactly what the spec's
   own guardrail asks for — "current spreads under myelin and APs regenerate at
   nodes" — and is a different claim from hopping. **`saltation` now asserts the
   ratio stays near 1**, so the app cannot quietly start drawing a hopping spike.

Also fixed on the way: a dead fibre was reporting half a metre per second. Crossing
zero was being taken as firing, and under a sheath a voltage spreads well over a
millimetre — so with sodium's gradient flattened the electrode alone dragged distant
membrane across the line. Firing now means an overshoot a quarter of the way to
sodium's own voltage, which is unreachable when there is no gradient to overshoot
into.

### N20 — the toggle

One button on the axon view: **🧈 Bare axon / Myelinated**. Pressing it wraps this
axon in fat and runs the same push down it.

The important part is what is held identical. Both states come from `viewFibre()`,
one function, so they differ in the sheath and in nothing else — same length, same
window, same electrode, same gradients, same solver. That is what makes the speed
underneath a comparison rather than a coincidence, and a test asserts the two runs
match in length and window.

**The whole view moved onto `fibre.ts`.** It had been running on `cable.ts`, and
keeping the bare state there while myelin came from the new solver would have
folded a 3.5 % solver difference into the middle of the measurement. `cable.ts`
stays as the reference model and the cross-check test; nothing draws from it now.
The seam that made this affordable is that the ribbon only ever asked five things
of a trajectory, so `sampleFibre` could answer them for an uneven grid.

**What is drawn.** Pale sleeves along the wall with a bare gap at each node, 43 of
them across 6 mm — and the doors move to where the model put them, at the nodes and
nowhere else, because that placement IS the feature. The magnifier **snaps to a
node** when the sheath is on: a node is 1 µm of a 141 µm repeat, so left free the
glass would show sleeved membrane essentially every time and a child could never
once look at the place where anything happens.

**Two exaggerations, both stated in the describer.** The node gaps are drawn wide
enough to see (a node is about a seventh of a pixel here), and the sheath is drawn
as a thickening of the wall rather than at its real bulk, which would hide the axon
inside it. How MANY sleeves there are is not exaggerated — that comes from the
axon's own diameter — and the difference between those two kinds of licence is
worth the sentence it takes.

The panel's `Wrapped in myelin` section quotes both measured speeds against each
other, and refuses the hopping picture in the same breath as the word every book
uses for it. Guardrail tests hold it to that.

#### Why there are 43 sleeves and not four

Asked on seeing it, and the honest answer is that **the demo is right and the
textbook is not.** A book draws three or four long sleeves with big gaps. This shows
43, because it is showing 6 mm of a real 1.4 µm axon and a node really does come
every 140 µm. The book is drawing a far shorter piece of axon — and drawing the gaps
enormous, when a real gap is a hundred-and-fortieth of a sleeve.

Ours were drawn too wide as well, just far less so, and that has been halved: the
node gap went from 5 px to 2.5. At 5 px the sleeves and gaps read 3.7 : 1 against a
real 140 : 1; at 2.5 they read 8.4 : 1 — still nothing like right, but twice as
close, and the sleeves now look like sleeves rather than dashes. A true gap here
would be a sixth of a pixel.

What made the narrower gap affordable is that the nodes no longer have to be found
by looking for a hole.

#### The flashes, which are the whole point

On a sheathed fibre the yellow now comes on **at the nodes, one after another, and
nowhere in between.**

It is driven by a different reading from the bare axon's aura, deliberately. Out
there the yellow follows the VOLTAGE, which is fair on bare axon because every patch
regenerates. Under a sheath that would be misleading and would also show nothing:
the voltage between the nodes swings nearly as far as at them, because the internode
is a good cable, so a voltage-driven glow would light the sleeves end to end.

So the flash follows the SODIUM DOORS — where the spike is being rebuilt, which is
the one thing that happens only at nodes. The sleeves stay dark not because nothing
is happening in them but because nothing is being MADE there, and the describer says
that rather than leaving the darkness to be misread.

Three tests hold it up: no sodium door ever opens under a sleeve; the nodes open in
order and are genuinely separated in time rather than flashing at once; and the bare
axon lights between its stripes too, so the contrast is real rather than an artefact
of where the two drawings happen to sample.

#### Step 14b — the sheath was inside the axon

Asked on looking at it, and the answer is that it was **wrong**. Myelin is another
cell wrapped ROUND an axon: it belongs between the axon's own membrane and the
outside world. The drawing had a sign the wrong way up and put it in the cytoplasm,
where nothing but axoplasm belongs.

Invisible in the arithmetic, obvious the moment a person looked at the picture — so
`sheathOuterY` is now exported and there is a test asserting the sheath's outer edge
is further from the middle of the axon than the wall is. Nobody would think to check
that unless it had once been wrong.

**And the sleeves are barrels now**, fattest in the middle and tapering to nothing
at each node. That is how every textbook draws them, and it is not merely a
convention: the wraps end in loops at the paranode, so a real sheath does thin
towards the gap.

#### Step 14c — flashes that stay separate, at a pace that can be watched

**Small and round.** A soft halo the width of the axon at each of forty-three nodes
ran them all together into one bright stripe — the travelling-blob picture arriving
by the back door, and it hid the very thing the flashes exist to show: that they come
on one at a time, in separate places. They are now a tight glow and a small core.

**Three times slower**, and the same slowing for both fibres, which is the part that
matters: slowing only the sheathed one would have made it watchable by taking away
the thing it is there to show. The sheathed fibre crosses six millimetres in 1.9 ms
of model time against the bare one's 9.5, so at the membrane patch's pace it was over
in four tenths of a second with forty-three nodes firing inside it. `PLAY_MS` is now
12.6 s for the 20 ms window — a second and a bit for the sheathed crossing, plainly
still the quick one and now quick enough to watch rather than quick enough to miss.

#### Step 14d — three fixes, one of them invisible for a good reason

**The node flashes were being drawn and could not be seen.** Two steps earlier the
aura was moved BEHIND the tube so it would stop washing out the red. The flashes were
written as a variant of the aura, inherited that position, and were drawn faithfully
every frame underneath an opaque body. They are now drawn last, on top of the sheath
— and placed ON THE GAPS, at both walls, because that is where a node is: a ring of
bare membrane between two sleeves. The middle of the axon is cytoplasm and nothing
fires there.

**The barrels were spindles.** The thickness profile was a sine curve to a power,
which tapers the whole way along, so each sleeve came to a point and the row read as
spikes. It is now a plateau: full thickness from an eighth of the way in to an
eighth from the end, with the taper squeezed into what is left. Flat on top, rounded
at the ends — what a real sleeve is, uniform wraps with the lamellae closing in loops
at the paranode. The test asserts flatness across the middle now, not merely a fat
middle.

**The sheathed run was seven eighths nothing.** Both fibres shared a 20 ms window,
and the sheathed one crosses six millimetres in 1.9 ms — so eleven of its twelve
seconds were a recovered axon sitting still, and the fibre that is meant to feel
quick felt like the slow one.

Each run is now trimmed to the last moment anything was still above zero, plus three
milliseconds to watch the far end fall back. **What is held fixed is the RATE, not
the duration:** `PLAY_MS` buys `VIEW_MS` of model time either way, so a run finishing
in a third of the model time takes a third of the screen time. Bare: 14.6 ms → 9.2 s,
crossing in 6.1. Sheathed: 6.8 ms → 4.3 s, crossing in 1.2. Fixing the screen
duration instead would have made the quick fibre look as slow as the other one, which
is the single thing this view must not do — and there is now a test saying so.

#### Step 14e — the sleeve took three shapes to get right

Worth recording all three, because each looked reasonable in the code and only one
looks right on the screen.

1. **A sine curve to a power.** Tapers the whole way along, so every sleeve was a
   spindle and the row was a line of spikes.
2. **A linear plateau** — flat in the middle, chamfered over an eighth of its length
   at each end. Flat on top, but the ends are straight cuts: a trapezium, and it
   looks like one.
3. **A rounded rectangle.** Uniform along its length, ends squared off where the
   lamellae stop, corners turned by a 5 px radius. Which is what a wrapped sleeve
   actually presents, and nothing biological has a right angle in it.

The height came down with it, from half the axon's half-width to 0.28 of it — 12 px
instead of 21. A sheath that overpowers the axon it is wrapped around is drawing
attention to the wrong object.

The profile is now: 12 px along the flat, dropping to 7 px at the very end of a
sleeve — **a corner, not a point.** A test asserts all three properties separately,
because the two earlier shapes would each have passed a looser one: flat past the
corner; still standing well off the membrane at the end (a spindle would be at zero);
and the corner higher at its midpoint than a straight chamfer would put it.

The mutable module-level variable that the first version of this used to pass the
thickness into the height function is gone — it was hidden state in a pure drawing
path, and the function takes the thickness as an argument instead.

#### Step 14f — the sheathed run slows down after all, and the flashes ease

Step 14d held one playback rate for both fibres, on the grounds that the rate is
what makes them comparable. That reasoning has been revised, on the user's call and
rightly: **nobody compares two animations by eye against a stopwatch.** The
comparison this view makes is carried by the measured speeds in the describer and
by N21's race when it arrives; what the single-fibre animation has to do is be
watchable, and at the shared rate forty-three nodes fired in about a second — the
exact thing the view exists to show, over too fast to see.

So the sheathed run gets a further 2.2× of slow-motion (`MYELIN_SLOWDOWN`, with the
reasoning in a comment where it will be found). The on-screen clock stays honest —
it shows model milliseconds, which now simply pass more slowly — and the qualitative
story survives: the sheathed crossing takes 2.6 s of screen time against the bare
fibre's 6.1, so it still plainly wins; the exact ratio is the describer's job.

**The flashes are bigger, and they ease.** Smoothstep on the door's own opening, so
a flash swells in, holds, and dies away instead of snapping — still a pure function
of the model at that position, because the easing reshapes the brightness curve
rather than adding a clock. Glow radius roughly doubled.

#### Is the myelin scientifically right now? — an audit

Checked deliberately, item by item, after the run of corrections:

- **Placement**: outside the axolemma, between membrane and world. Right, tested.
- **Shape**: rounded-rectangle sleeves, flat along the length, corners turned —
  uniform wraps with paranodal loops. Right.
- **Thickness**: the honest g-ratio thickness would be ~0.54 of the axon's
  half-width per side; drawn at 0.28, about half of true, so the axon stays the
  subject. Understated rather than overstated, and the describer's confession
  covers it.
- **Count and spacing**: 43 sleeves per 6 mm, one node per 140 µm, derived from the
  axon's own diameter. Right, and more honest than the textbook's three sleeves.
- **Node gaps**: drawn ~17× too wide (a true gap is a sixth of a pixel). Confessed.
- **Channels**: only at nodes, at clustered density. Right, tested.
- **Conduction**: sequential nodal regeneration, no hopping, ×5 measured. Right.
- **Not modelled**: Schwann-cell bodies and nuclei on the sleeves, paranodal axon
  narrowing, and mammalian-rate kinetics (squid gates throughout, stated).

#### Step 14g — flashes as a strobe, and why the sleeves cannot get longer

**The flashes changed what they mark.** They had followed each node's sodium door —
honest, and wrong for the job: a door stays open most of a millisecond while the
wave steps to the next node in a twentieth of one, so at any instant a dozen doors
were open at once and the flashes ran together into a band. True, but the red
stripes already show that. What the flashes are FOR is the sequence, so each is now
an event pulse on `crossedAt` — the same grammar as the hillock flash on the
whole-neuron canvas — with the pulse width derived from the run itself: 85 % of the
median node-to-node interval, so a flash is always over before its neighbour's
begins. On screen: one flash every 63 ms, lit for 53, dark for 9 — a strobe running
down the axon, each pulse an eased bell (swell, peak, die), roughly twice the
previous size. Still a pure function of `u`; scrubbing backwards replays it exactly.

**Why the sleeves cannot be made longer** (asked, and the refusal needs its
numbers). The sleeves already cover 89 % of the drawn axis — they tile everything
except forty-three 2.5 px gaps. Honest coverage is 99.3 %, so the very most that
lengthening could recover is ten per cent, and only by shrinking gaps that are
already at the floor of visibility. Making the sleeves LOOK longer would mean fewer
of them, and the node count is not a style: 43 nodes in 6 mm comes from the axon's
own diameter, the model fires at exactly those positions, and the flashes land on
them. Draw 10 long sleeves over a 43-node model and the strobe runs through the
middle of the drawn fat.

The only honest way to textbook proportions is a shorter stretch: a 140 : 1 ratio at
a visible gap needs ~350 px per repeat, i.e. a 400 µm view — on which the sheathed
fibre's lit stretch (3.12 m/s × 2 ms ≈ 6 mm) would light everything at once, which
is the axon view's founding scale problem all over again. The gap width stays the
one confessed exaggeration; the sleeve lengths are already true.

#### Step 14h — the internodes stretch, and the strobe becomes watchable

Step 14g refused to lengthen the sleeves on honesty grounds. The user overruled it —
legibility of point-to-point propagation is what the demo is FOR — and the refusal
had also misdiagnosed the flash problem: 43 nodes firing 45 µs apart is a 63 ms
flicker per node on screen, at the edge of frame rate, invisible almost regardless
of size. Both problems were the same number: too many nodes.

**The fix is one exaggeration, in the model rather than painted on.** The view's
fibre now has 500 µm internodes (`VIEW_INTERNODE_UM`) against the real 140 — so 12
nodes instead of 43, sleeves 81 px long instead of 21, and a hop every 266 ms of
screen time with a 226 ms eased flash: stepping you can watch. Because the
exaggeration is in the model, everything stays consistent by construction — the run
really has 12 nodes, the physics really crosses those internodes, the flashes land
on them, and the speed quoted is measured on the fibre drawn.

**And the exaggeration costs something real, which is itself a lesson.** The
internode sweep (140 → 900 µm) shows the measured speed FALLING as the sleeves
stretch: ×5.1 at true anatomy, ×4.2 at 500 µm, ×3.3 at 900. Overstretched internodes
conduct worse — which is exactly why real fibres keep their sleeves near a hundred
diameters. The describer's confession says so and quotes the stretched fibre's own
measured speed, not the ideal one's; `myelinFacts` branches on drawn-versus-real
spacing so the honest sentence returns automatically if the anatomy ever does.

Crossing is now 3.2 s of screen time against the bare fibre's 6.1 — still plainly
the quick one, and now legible node by node.

#### Step 14i — bigger auras, a node in the lens, and the map gets its own clock

**The flash auras nearly doubled again** (glow radius 26 + 38·lit). At twelve nodes
there is room for them.

**The lens now shows what the ring sits on.** On a myelinated fibre the ring snaps
to a node, but the lens went on showing generic membrane with two distant doors —
the two circles disagreed about what was being magnified. The lens now draws the
node as a node: doors crowded into the middle, and the stepped ends of the two
sleeves closing in from either edge, each wrap ending a step short of the one
beneath it, the way lamellae really do end in a staircase of paranodal loops.
Schematic, and confessed in the describer: a real node is a micrometre wide —
twenty of these lenses — so the sleeve ends are pulled into frame to show what the
ring sits between.

**The map runs on its own clock past the ring.** It had echoed the canvas's
slow-motion, so the thumbnail crawled for nine seconds — a thumbnail replaying the
main picture slower than a thumbnail should do anything. The two are now coupled at
exactly ONE point, per the user's call: the canvas run starts the instant the map's
signal reaches the ring, and from there each tells the story at the pace its own
size wants (`MAP_SWEEP_MS`, 1.1 s from ring to terminals, wake settling behind,
endings lighting on arrival). The map is choreography, as the whole-neuron chain
is; the canvas is the measurement. One clock still drives both — the map reshapes
the canvas's position into its own sweep, so pause and scrub replay it exactly.

#### Step 14j — the crawl and the sprint

Asked: does an axon carry a signal faster than a dendrite, and can the little
neuron show it? Yes, and yes — and the fact has two halves that belong together. A
dendrite's graded potential spreads PASSIVELY, the way charge soaks along a thin
wet cable: it has no fixed speed at all, it gets slower as well as fainter with
distance, and there is nothing in the membrane to remake it. The axon's spike is
regenerated at every step, so it runs fast and arrives full-size. (Effective
dendritic spread is a fraction of the bare axon's 0.6 m/s, and an order of
magnitude below the sheathed fibre's — the map does not quote numbers because it
is choreography, but the direction is emphatic.)

The map now shows the contrast in its pacing. The lead-in grew to 2.4 s and most of
the extra went to the dendrite: the ripple crawls at ~110 px/s for over half the
lead-in, then the spike covers ten times the distance at ~640 px/s — six times the
pace, a sprint against a crawl. The paces meet exactly at the ring (0.63 vs 0.64
fractions of the axon per second either side of it), so the sprint reads as one
continuous motion and the only slow thing on the cell is the dendrite. A new 🐢
paragraph in the describer says why, ahead of the axon taking over.

#### Step 14k — the near half of the axon un-fired itself

At the end of the map's run only the last stretch of the little axon was lit. The
seam again, from the other side: the stretch before the ring was still owned by the
lead-in's fast fade, so it went dark while the sweep was still sprinting — and the
finish showed an axon whose near half had somehow un-fired.

Once the run is going, one front now owns the whole axon. Everything behind it
holds a settled glow (it fired; it is recovering, not gone), the front is bright,
nothing ahead of it lights — and when the sweep reaches the terminals the whole
cable is lit and fades out together, because the whole cable fired.

#### Step 14l — the axon that stayed blue

Asked: the AP is over but the cytoplasm stays very blue — is that correct? Half
correct, which is the worst kind. The blue is the after-dip and the physics is
right: potassium doors are slow to shut, so freshly fired membrane sits below rest
for some milliseconds. But step 14d's trim cut every run three milliseconds after
the last spike — so the animation FROZE there, 12 mV below rest, forever. Honest as
an instant, misleading as an ending: a held final frame reads as "this is the
axon's new state", not "this is a moment three milliseconds after a spike".

Two changes, working together:

- **The tail grew to 10 ms** (`TAIL_MS`), enough for the membrane to come back
  within a couple of millivolts of rest, so the run ends on an axon that is nearly
  itself again with the last blue draining out — the true story.
- **The clock fast-forwards through it** (`TAIL_HASTE`, ×5, from the moment the
  last patch has fired). The drama plays at full slow-motion; the tidying-up is
  skimmed. This keeps 14d's fix — the dead time the longer tail would have brought
  back does not come back: bare is 8.0 s of screen (was 9.2), sheathed 7.7. The
  on-screen clock stays honest; model milliseconds simply pass faster once nothing
  is left to fire.

End states now: sheathed −2 mV everywhere and fading; bare −5 mV at the far end
(it fired last and the window caps at 20 ms), which is a faint blue the describer
now explains: the 🌑 paragraph says the blue is the after-dip, recovering, not
stuck — watch it drain to grey.

#### Step 14m — the lens's sleeves ended in mid-air

The sleeve ends in the lens angled OUTWARD — an overhanging wedge — while the
sleeves on the axon end in a blunt turned-down corner. Chasing the inconsistency
found the real error: each lamella in the lens simply stopped where it stopped,
floating. A wrap does not stop — at the paranode it DIVES to the membrane and
closes in a loop on the axolemma, outermost lamella touching down nearest the node,
innermost farthest, a row of loops on the membrane.

Drawn that way, the outer contour stays at full height and turns down at the end —
and the silhouette agreement with the main view comes for free, because the shape
of a sleeve's end IS its outermost wrap turning down. The two pictures now agree
because they both follow the anatomy, not because one was styled to match the
other. Layers are drawn innermost-first so each dive crosses the wraps beneath it,
the way the outermost loop really does.

#### Step 14n — what the tape is made of

Asked: do myelin layers relate to phospholipid heads? They ARE phospholipid
bilayer — the wrapping cell's own plasma membrane, wound a few dozen turns and
compacted, each lamella showing the same heads-tails-heads structure under EM with
a ~12–15 nm period (the figure `lamellae()` already uses per wrap). The recipe is
what is special: ~three quarters lipid by dry weight against half for an ordinary
membrane, which is why it insulates and why white matter is white.

The lens had a quiet inconsistency at its own magnification: the axon's membrane
drawn as heads and tails, the sleeves — the same stuff — as featureless lines.
Drawing each wrap honestly is impossible in frame (one bilayer at lens scale is
28 px; a single wrap would fill it), so the connection is made in words: the 🧈
fact now says the tape is the wrapping cell's own membrane, "the same
two-rows-of-heads bilayer you can see in the magnifying glass", in an extra-fatty
recipe.

#### Step 14o — the bare axon looked the more channel-rich of the two

Asked to match the bare view to the sheathed one, and the audit found the drawing
saying the opposite of the model. The bare axon drew 24 door-pairs per wall against
the sheathed fibre's 12 single marks — bare membrane looking four times the more
channel-rich, when a node carries about **twelve times** bare membrane's density.
Two accidents behind it: the door count was tied to the colour stripes (24) rather
than to anything anatomical, and the node marks had been merged into one back when
43 nodes sat 23 px apart. At 12 nodes and 84 px that merge was long obsolete.

Now: **the same doors in the same places in both states.** `DOOR_SPACING_UM` is one
repeat of the sheathed fibre's own anatomy, so the bare axon is marked exactly where
the other one has nodes — same count, same positions, both drawing a sodium door and
a potassium door. What differs is only what lies BETWEEN them, sleeves or bare
membrane, which is the comparison the eye should be making. Tested.

The one deliberate difference kept: the pair is drawn **tighter at a node** (±4.5 px
against ±9), because a node really is crowded. Nothing like twelvefold — these are
symbols, not a census — but it points the right way where the old drawing pointed
the wrong one, and it agrees with the lens, which already draws the node's doors
closer together than the bare axon's.

Checked and left alone as already identical: the view's length and magnification,
the tube's thickness, the membrane band's width, the colour-stripe count, and the
lens's bilayer. The wall LOOKS thicker with the sheath on because myelin genuinely
is thicker — that one is not a mismatch.

#### Step 14p — myelin inside the cell again, in the lens this time

The same sign error as step 14b, in the other picture. `drawLensSleeves` looped over
both sides of the membrane, so half the wraps were drawn in the cytoplasm.

The mistake was copied in from the ribbon, and that is the part worth remembering:
out there the axon is a tube seen from the side, so it has TWO walls and each has
sheath outside it, and looping over both sides is right. The lens is one patch of
ONE wall — outside above, cytoplasm below — so there is only one side for a sheath
to be on. A pattern that was correct in the place it came from, wrong the moment it
moved.

Both drawings now put myelin outside the axolemma and nothing but axoplasm inside
it. The ribbon's version has had a test since 14b; the lens's is a fixed direction
in a clipped circle with no geometry to assert against, so it carries the reasoning
in a comment instead.

#### Step 14q — 14o was wrong, and wrong about the point of the feature

Step 14o spread the bare axon's doors out to sit exactly where the sheathed fibre
has nodes, so both pictures showed doors half a millimetre apart. The user caught
what that costs: **with the same distance from channel to channel in both, there is
no reason left for myelin to exist.**

The error was conflating two facts that point in opposite directions:

- **Density per unit membrane** — a node carries ~12× bare membrane's channels.
  True, and what 14o reasoned from.
- **Spacing of REGENERATION** — continuous along a bare axon, once per internode on
  a sheathed one. That is the feature, and 14o erased it.

Rebuilding is the slow part; doing it every 500 µm instead of continuously is why
myelin is quicker. So the spacing has to be the loudest thing on the screen.

Now: the bare axon is studded every 250 µm along its whole length (24 pairs, 42 px
apart — "everywhere"); the sheathed one has doors at its 12 nodes and nowhere else
(84 px apart, with 68 px of empty sleeve between). Both facts are carried: the node's
pair is drawn tighter and smaller, so the few places that do have channels read as
crowded with them. The test now asserts the bare axon is marked at least half again
as often, with the reasoning attached so the next pass does not undo it.

**The node gap went 2.5 → 15 px**, which reverses step 14g and is worth stating.
The earlier passes had nothing to fit in a node, because its two doors were merged
into a single mark — a leftover from when 43 nodes sat 23 px apart. With 12 nodes
and a proper pair at each, the gap has contents, and a gap too small to hold its own
contents is the worse lie.

A new 📏 fact spells the whole thing out: switch the sheath off and on and watch the
doors, because that is the whole of it.

#### Step 14r — uneven channels, sparks on both fibres, and the case for myelin

Three asks, and the first is better science than it looks.

**The bare axon's channels are scattered unevenly now.** Not a stylistic
roughening: sodium channels in bare membrane sit essentially at random at whatever
density the cell maintains, while a node's are held in an ORDERED ARRAY by a
protein scaffold. So the honest contrast is not merely many against few — it is a
random scatter against an organised cluster, and drawing the bare axon on a perfect
250 µm grid was claiming a regularity it does not have. (The same reasoning the
bilayer's lipids already carry: a perfectly even row reads as manufactured.) The
pair separation jitters too. Tested, both ways: bare gaps vary by more than 1.5×,
node gaps by less than 1.05×.

**Both fibres spark now**, by the same rule, from the same list of places —
`doorPlaces` is shared by the doors and the sparks, so what fires is always what has
channels. Bare: two dozen sparks, all the way down. Sheathed: twelve, only at the
gaps. Same distance covered, half the rebuilds, and it arrives in a third of the
time.

The bare axon keeps a dimmed aura as well, and the difference between the two
pictures is itself the lesson: on bare membrane the activity really IS continuous —
every patch between the drawn sparks is rebuilding too — while under a sleeve
nothing happens at all. One fibre glows along its whole lit stretch; the other is
dark between its nodes.

One honest caveat about the cadence: at the current `MYELIN_SLOWDOWN` of 2.2, sparks
arrive about 260 ms apart in BOTH fibres. What differs is how many (24 against 12)
and how long the crossing takes (6.1 s against 3.2). Sparks-per-second is not the
comparison and cannot be — the sheathed fibre covers ground faster, so in model time
its sparks are more frequent, not less. Sparks per millimetre, and total time, are
the honest measures.

**A "Why wrap an axon in fat?" section**, shown in BOTH states — because on a bare
axon the question is "what would wrapping this do?" and the answer needs the same
numbers. Four beats: rebuilding is the slow part; wrapping lets you do it less
often; the measured result (crossing times and the ratio, off these two runs); and
that it is cheaper as well as quicker — fewer rebuilds means less sodium to pump
back and fewer channels to build, which is why long nerves are wrapped and why
losing the wrapping matters.

#### Step 14s — the myelin control becomes a two-way switch

It was one button that renamed itself — 🧈 Bare axon / 🧈 Myelinated — and a
button labelled with its own state cannot say whether the label is where you ARE
or where pressing takes you. It is now a segmented switch: both fibres named side
by side, the one on screen lit, so which state you are in and what the other one is
are the same glance. `role="radiogroup"` with two radios, which is what it is.

The store gained `setMyelin(on)` in place of `toggleMyelin()`, and the difference
matters beyond tidiness: picking the state you are already in now does nothing,
where a toggle would have thrown away a run for a press that changed nothing.
Changing it still starts over, because wrapping or unwrapping an axon is a
different axon and the wave cannot carry on at a speed the fibre no longer has.

#### Step 14t — the little neuron shows its sheath too

The map went on drawing a bare axon whichever fibre the canvas held, so the panel
that exists to say WHERE this is happening was showing a different cell from the one
beside it.

It now draws twelve sleeves — the same twelve the canvas has, so the two pictures
are countably the same fibre. Schematic by necessity: the little axon is about
126 px long on screen, so a sleeve is ten of them. What that size can carry is the
SHAPE of the thing — a beaded line instead of a smooth one, pale segments over a
thinned axon so the gaps read as bare axon rather than as breaks in it — which is
enough for "that is the wrapped one" at a glance.

**And it lights only at the gaps**, exactly as the canvas does: twelve sparks with
nothing between them, against the bare axon's continuous run. That contrast is the
reason to show the sheath here at all — the panel is not decoration, it is the same
demonstration at thumbnail size. The describer's 🟡 paragraph names which state it
is looking at, and the picture's aria-label does too.

#### Step 14u — stepped sleeves, and a staircase that pointed the wrong way

Asked for the textbook stepped sleeve on the small neuron. Building it settled a
question the lens had got wrong, so the fix landed in two places.

**The anatomy first.** A sheath THINS towards a node: the lamellae terminate one
after another at the paranode, and for the sheath to taper the outer ones must stop
FURTHER from the gap, leaving the inner ones reaching closest to it. The lens had it
inverted — outermost reaching nearest the node — which draws a shell standing off the
axon with nothing beneath it. Its staircase now descends the right way.

**Then the map — tried, and reverted.** Each sleeve was drawn in three tiers,
widest shortest, so every gap had a staircase down to the axon. On screen that is
steps of about 1.5 px, and the arithmetic said as much before it was built: the
little axon is 126 px long and holds twelve sleeves because the canvas holds twelve,
so a sleeve is ten pixels. At that size a staircase does not read as a staircase,
only as noise, and the beads were plainer and clearer without it. Back to one flat
bead each.

The lesson is about where detail belongs rather than whether it is right. The
stepped ending is real and worth showing — and it IS shown, in the magnifying glass
on the canvas, where a node fills a circle 240 px across and the lamellae can end
one at a time. Adding it again at a twelfth of that size gained nothing and cost
legibility. The comment on `sleevePoints` says so, so it is not tried a third
time.

### "The real thing" — photographs, after the sibling app's P10

A new block in the left column: photographs of the actual tissue the simulation is
drawing. The sibling app's pipeline, reused — Openverse API (keyless,
licence-filtered to CC0/CC BY), normalised to 900 px JPEG in `public/real/{id}.jpg`,
`core/realPhotos.ts` as the manifest with attribution transcribed from the API
records rather than retyped. Five images, 1.2 MB.

**They are coupled to the view, which is the point.** `photosFor({ zoom, myelin })`
returns what is on screen right now, so wrapping the axon brings out the sheath's
own pictures — a TEM of the wraps and expansion microscopy of a real node — and
unwrapping puts them away. A gallery that sat there regardless would be a picture
book bolted to the side of a simulation. Where there is nothing on screen worth a
photograph, the block does not appear: better absent than showing a micrograph of
something a child cannot point to.

**Two honesty rules this block needs and the drawings do not**, both tested:

- **Say what kind of picture it is.** An electron micrograph is grey because
  electrons have no colour; a fluorescence image is coloured by whatever dye
  somebody chose. Either passed off as "what it looks like" would be exactly the
  claim this app refuses everywhere else. Every entry carries its `kind`, the panel
  prints it, and a note says why these look strange.
- **Credit, licence and link, every time.** Not a credits screen — the condition of
  use, next to the image.

The picks are good ones: the TEM shows the stacked lamellae the model counts wraps
of; the node image is a stain for potassium channels sitting exactly in the gap
between two sleeves; and one shows myelinated and unmyelinated fibres side by side
in the same nerve, which is the toggle above made real.

**Institutions and Wikimedia Commons only.** The first pass took two of the five
from Flickr, where the licence was fine and the provenance was a stranger's
caption — and in a science app for children a photograph is a factual claim, so
"somebody on a photo site said this was a nerve" is not a source. Both were
replaced from trusted collections, which improved them as pictures too: a Wellcome
TEM of myelinated nerves cut across (dark rings, sheath by sheath) and Commons's
Golgi-stained neuron, the method that first showed anyone what a neuron looks like.

`TRUSTED_ORIGINS` now makes that a rule the tests enforce rather than a habit
anyone has to remember: Wikimedia Commons, Wellcome Collection, Science Museum. Two
tests — every photo's origin is on the list, and every photo's link points at the
host it claims to come from, so the label cannot be decoration. Commons files carry
a page with their own provenance and a community that corrects it; the institutions
catalogue theirs.

Still not reviewed by anyone who knows the tissue: titles matching what is visible
is a good sign and not a citation. But the sources can now be checked.

**Stacked and scrolled**, the way the sibling app's molecule photos are. A first
version showed one at a time behind a row of buttons, which is fewer pixels and
worse — the pictures are a SET (the wraps, a node, both kinds of fibre, a whole
cell) and their point is partly in seeing them together. Nobody clicks through a
tab strip to find that out. The panel is capped at 42vh with its own scroll, so
five figures cannot push the explanation below it off the screen.

### N21 — the race

The switch is three-way now: **〰️ Bare / 🧈 Myelinated / 🏁 Race them**. The third
is a different kind of thing from the other two — not one fibre with or without a
sheath, but both at once, stacked, over the same six millimetres, from one push,
against one clock. "Myelin is faster" stops being a sentence in a panel and becomes
something the viewer waits for.

**What it took to be a fair race.** Three mechanisms that exist for the
single-fibre views had to be switched OFF here, and each would have been a thumb on
the scale:

- **Trimming.** Each single run is cut to its own finishing time, which is right
  there and fatal here: two runs trimmed to their own clocks cannot be raced.
  `trim: false` and a shared 14 ms window, so `u` means the same millisecond in
  both. Tested.
- **`MYELIN_SLOWDOWN`.** Slowing the sheathed fibre so it can be watched is
  reasonable when it is alone on screen and indefensible when it is racing.
- **`TAIL_HASTE`.** Skipping the recovery would skip it for one fibre before the
  other.

So the race runs at one plain rate: the sheathed axon is home at **1.4 s** of screen
time, the bare one at **6.1 s**, over 8.8 s in all. A test asserts the bare fibre has
covered less than 45 % of the distance at the moment the wrapped one arrives —
because if that ever came out close, the picture would have nothing to show.

**Reuse rather than a second drawing.** `atMid(geo, y)` hands the existing
tube/sheath/doors/spark functions a geometry with the axon somewhere else, so the
second lane is the same code — no parallel implementation to drift out of step with
the first. The race drops the lens and the voltage graph (no room beside two axons,
and they belong to looking at one fibre closely) and owes three things instead: a
clock in milliseconds of the real event, a dashed finish line straight through both
lanes so "same distance" is visible rather than claimed, and a per-lane label with
its measured arrival time — read off `crossedAt`, so the time shown is measured and
not counted by the animation.

**The spec's guardrail, taken literally.** "Use relative speed, not misleading exact
scale": the ratio leads in `raceFacts` and the raw milliseconds are given as this
model's own — squid gates at 6.3 °C, slow for both fibres, with a real nerve at body
temperature beating both. Two tests hold that: the ratio must appear, and so must
the warning that the absolute times do not survive the difference.

Also done this pass: the node photograph leads the sheathed view's set, since it is
the one image that shows the feature itself — real channels crowded into a real gap.

**Milestone 3 remains open**: step 15 (N22, refractory period — much of which the
cable model already supplies) and step 16 (C05, signal tracing).


### Two bug reports

**An empty chamber filled its cytoplasm.** Set both sides of a balance-bench
chamber to zero and sixty balls appeared inside it. `ballsOf` always reported a full
set, and the drawing renders the split as "the first N are outside, the rest are
inside" — so zero outside meant all of them inside. Something out of nothing, in the
one exhibit whose stated promise is that balls are conserved.

Fixed at the source rather than in the drawing: `ballsOf` reports no balls when there
is nothing to divide, and `drawChamber` draws the count it is given instead of
assuming `DOTS`. Zero is the only case that has to be special, because the balls are
a RATIO — always the same number, each worth a share of whatever is there — and zero
has no ratio. Three tests, including that a full set still appears for any nonzero
amount.

**A static circle round the gates during the spike.** Two features on a collision
course by construction. A gate that changes gets an expanding, fading ring, written
as a pure function of position and fading over the 5 % of the run after the change.
The beats stop the position EXACTLY at each change, because those are the moments
worth stopping on — `steps` take their `at` straight from `gateMoments`. So the ring
froze at full strength and its tightest radius for the whole dwell: a hard circle
sitting on the channel for a second or more, which is not a flash and was reported
as a bug, correctly.

Suppressed while playback holds, rather than made time-based. The ring stays a pure
function of position — so scrubbing still reproduces exactly, which is the property
the whole view rests on — and it plays properly the moment the position starts
moving again. The duplicate reading of the same dwell flag a few lines below it is
gone with it.


## Step 15 — N22, the refractory period

### The model half (the view is not built yet)

Nothing here adds a rule, and that is the point. The mechanism has been in the model
since Milestone 3 opened: sodium's h gate shuts at the top of a spike and is slow to
reopen, and potassium's n gate stays open for milliseconds after. Push again while
those are true and the sodium current you can raise is smaller and the potassium
current fighting it is bigger. So the two refractory periods are not constants to
look up — they are FOUND, by firing twice at different gaps and asking what
happened.

`spikeModel.integrate` gained an optional second push (`SecondPush`), and nothing
else changed: the gates carry on from wherever the first spike left them. A paired
run needs a longer window, so `Trajectory` now carries its own `windowMs` and
nothing downstream may assume `SPIKE_MS`.

**Measured, at real gradients:**

| | |
| --- | --- |
| absolute refractory | **2.6 ms** — no push works, however hard |
| relative refractory | **2.6 → 8.3 ms** — a stronger push works, an ordinary one does not |
| push needed at 4 ms | **9.5×** the resting threshold |
| at 6 / 8 / 10 / 20 ms | 3.5× / 2.2× / 1.6× / 1.0× |

Longer than a mammal's for the reason everything in this model is slow — squid gates
at 6.3 °C — and the ORDER is the lesson, which the tests assert rather than the
numbers.

### The measurement was wrong first, in a way worth recording

The first `secondSpike` asked for the highest voltage after the second push landed.
At a 1 ms gap that is the top of the FIRST spike — the membrane was on its way up
anyway — so it reported a fine second spike and the absolute refractory period came
out as **zero**. The tail of one event read as another event.

A paired-pulse experiment has to measure the DIFFERENCE. The run is now compared
against the same run with a second push of NOTHING — same gates, same window, same
sample grid, differing in nothing but the push — and a second spike is a departure
from what the membrane was going to do anyway. The two clauses are the ones the
model already uses for "fired": overshoots zero, and swings at least 40 mV further
than it otherwise would have. A test fires a push of zero at seven different gaps
and requires that none of them ever looks like a spike.

### The view

**⚡⚡ Fire twice**, at the membrane patch, with a gap in milliseconds — a gap rather
than a switch, because the gap IS the experiment: the same two pushes at 2 ms and at
12 ms are two different answers and the membrane decides which.

`again` is threaded through the nine signatures in `actionPotential.ts` and through
`apSteps`, and **no new drawing was needed at all**. Every drawing at that patch was
already reading the trajectory, so a paired one puts both spikes on the voltage
trace, both openings in the doors, both flows in the ion crowds — and when the
membrane refuses the second push, all of them show the refusal together. That is the
dividend of the single-integration bargain the milestone opened with, collected two
steps later.

One thing the threading turned up: `potassiumLagMs` divided by the constant
`AP_REAL_MS`, which is wrong the moment a run can be longer than the standard one. It
uses the run's own `windowMs` now.

The describer grows a **Firing twice** section while a gap is set, and only then —
the paragraphs say "push it again", and showing them with no second push on would be
describing a control that is not there.

### Two fixes reported from the browser

**The static circle round the channel was not the ring I suppressed last time.** The
starring highlight drew TWO concentric glows, a wide one and a tight one, to
brighten the middle — and stacking radial gradients is how you draw a circle by
accident: the inner one stops dead at its own radius, so their sum has an edge
there, and that edge read as a hard ring for as long as the protein was the one
carrying the current. One gradient now, which has nowhere to put a seam. (The
change-ring fix from last time stands; it was a real bug, just not this one.)

**The race sat too high with a bank of empty canvas below it.** Fixed fractions of
the height put the clock under the toolbar and left the lower axon a long way from
the ruler. `raceLayout` now measures the block the race actually needs — two axons
with their bands, the gap between them, the shared ruler — and centres it below the
controls, so the space above and below comes out equal at any stage height (107 px
each at 660, 207 at 860).

---

## Step 16 — the spike-train bench, and a permanent map

Two exhibits were **removed** in this step and one was built to replace both. The
removals came from the user, watching the app as a child would, and the reasoning
is worth keeping because it generalises: *a model can be right and still be
unreadable, and the view is where that is decided.*

### What was wrong with what was there

**The weak stimulus, on the membrane patch.** Correct in every respect. Press it
and the model does exactly what it should: the voltage lifts a few millivolts and
slides back. The problem is that the patch's entire vocabulary is doors opening,
crowds moving and a spotlight following the current — and a push that fails has
nothing to say in any of it. So "not enough" and "the button is broken" looked
identical, and the whole point of a threshold is the difference between those two.

**The paired-pulse slider (N22).** A toggle and a range reading `6.0 ms`. It asked
a child to hold two runs in memory and compare them: press, watch, change a number
they have no feel for, press, remember what was different. And the view it sat on
only ever draws one instant, so the two pushes it was about were never on screen
together. The refractory period is a fact about a **sequence**, and a picture of a
moment is the wrong instrument for it however good the model behind it is.

Both failures are the same failure. A graph does not have it: a flat stretch after
a press is drawn in the same ink as a spike, on the same axis, with the press
marked underneath it, and two presses are visible at once.

### What the bench is

`Fire it again`, a drawer exhibit off the membrane patch, beside `Balance an ion`
and for the same structural reason — the canvas is the neuron, and this is an
instrument wheeled up to it.

A scrolling voltage trace, newest at the right, and three buttons. Press whenever
you like. Every press is marked on the axis and labelled with what it did —
**spike** or **nothing** — and after the first spike the graph shades the two
recovery windows behind the line.

**The model is not new, and that is the point.** `core/spikeTrain.ts` carries the
same four numbers (V, m, h, n) forward with the same rate constants imported from
`spikeModel.ts`. Nothing in it knows what a refractory period is. The second push
fails because sodium's h gate is still shut — the same gate that shut at the top of
the first spike, reopening on its own schedule. Delete every mention of
refractoriness from the app and the bench would still refuse the push.

The difference from `integrate` is only *when* the arithmetic happens. The canvas
tabulates a whole run in advance, because pause and scrub need a spike to be a
position rather than an accumulated state. Here the pushes arrive when a child
presses them, so there is no run to tabulate and the state is carried forward.

### Three buttons, and why the third is not padding

Measured, then chosen. Peak of the **second** spike, in mV, "—" for no spike:

| gap → | 3 ms | 4 ms | 5 ms | 6 ms | 8 ms | 10 ms |
| --- | --- | --- | --- | --- | --- | --- |
| 20 µA/cm² (weak) | — | — | — | — | — | — |
| 60 µA/cm² (fire) | — | — | — | — | — | +58 |
| 200 µA/cm² (hard) | — | — | +34 | +53 | +61 | +63 |
| 400 µA/cm² | — | +21 | +48 | +60 | +67 | +68 |

Three findings a child can reach by pressing buttons: **nothing works in the first
few milliseconds however hard you push** (absolute); **after that a hard push works
where an ordinary one still does not** (relative); and **the spike you buy that way
is a smaller one**. With two amplitudes the middle row does not exist and the
relative period is invisible. 200 is where that row is widest — 400 fires almost as
soon as the absolute period ends and blurs the two ideas back together.

### A wrong turn worth recording: the button that held the current on

The first version let a press restart a pulse that was still running. Drum on the
weak button and the 0.6 ms pulse stretched to as long as you liked — and **a weak
current held on for long enough fires any cell**: 20 µA/cm² against a 0.3 mS/cm²
leak settles some 60 mV above rest. Real physics, arrived at by accident, and it
made a button labelled *not enough* fire the membrane whenever a child fidgeted.

A test caught it. The fix is that one press delivers one fixed pulse and a press
during a live pulse is ignored — a fact about the **button**, the way a real
stimulator behaves, not a claim about the membrane.

What is **not** suppressed is summation between separate pulses. Weak pushes about
a millisecond apart do add up and will fire the cell, because the membrane's time
constant is ~3 ms and the second push lands on what the first left behind. That is
temporal summation; it is the same effect milestone 1 teaches with two inputs
firing together; and hiding it to keep the sentence "the weak one never works"
true would be teaching a tidier cell than the real one. The describer says it out
loud instead, and a test pins it.

### A second wrong turn: asking the question in the present tense

`recoveryNow` reported which band the membrane is in **at this instant**, and the
narration used it — so every refused push was described as having landed on a
rested membrane. By the time there is anything to say about a push, the membrane
has recovered. The question is where the **press** landed, not where the membrane
is now: `recoveryAt(state, atMs, …)`.

### And a unit bug, fixed by the measurement that exposed it

`trainAdvance` clamped its argument to "at most one frame's worth" — but its
argument is *model* milliseconds and the clamp was in *real* ones. It silently
refused to advance more than 0.3 ms, so every gap in the experiment produced an
identical result. The clamp belongs at the caller, which is the only place that
knows about real time. **The table above is what caught it**: results that do not
change when the input changes are the shape of a broken parameter.

### The permanent "you are here" map

`AxonMapPanel` → `NeuronMapPanel`, moved to the **top of the column and shown for
every view**. It was the axon story's own thumbnail, which left the app's most
disorienting moments unanswered: a membrane patch fills the screen with a wall of
fat and two ions, and nothing on the page said which part of which cell that wall
was cut from. A child who has zoomed in ×140 has lost the thread the first
milestone spent its whole length establishing.

It answers two questions:

- **Where** — a dashed ring on the zoom target's own `center`, the very point the
  camera flies to. Nothing to keep in sync: one number, read twice. Absent when
  zoomed out, where a ring round the whole cell would be marking nothing.
- **Whether a spike is running, and where** — each view lights the map from the run
  it actually has: the chain across the whole neuron, one patch's own trajectory,
  or the propagating wave out on the axon. What they share is the yellow, which
  everywhere in this app means *a signal is here*.

The view box is now **computed from the geometry** — every drawn element plus every
zoom-target centre. The hand-picked box it replaces was cropped to the axon's story
and cut the left edge off at the soma, so the incoming synapse's ring would have
been drawn outside the picture.

### It also lands closer to the written spec than what it replaced

Worth noting, because the removals were driven by usability rather than by the
requirements doc, and they happened to move *towards* it:

- **N22** asks for *"stimulate repeatedly"* with *"channel states + voltage graph"*,
  and *"immediate second stimulus fails **or needs stronger input**"*. The
  paired-pulse slider did the first half of that clause and had no way to express
  the second — there was one amplitude. The bench does both, and the hard push is
  what makes *"needs stronger input"* something a child can perform rather than
  read.
- **N18** asks for *"adjust stimulus"* against a *"voltage + threshold line"*. Two
  fixed named pushes on a view with no time axis was the compromise available at
  the time. Three pushes against a live trace is nearer the intent, and the app's
  standing rule still holds: the **amplitudes are fixed and the outcome is the
  mechanism's to decide**, never scaled to keep the story working.

The feature-spec table is unchanged. It described this better than the
implementation did.

### Step 16a — the bench loses its words and gains a cell

**No labels on the three buttons.** They differ in exactly one way that matters —
how hard the push is — and a size is something a picture says better than a phrase.
One small bolt, one big one, two big ones: the ordering is handed over at a glance,
where *"Weak push / Fire / Hard push"* is three comparisons in prose to arrive at
the same ranking. The names are still the `title` and the `aria-label`, so a hover
and a screen reader both keep the word; it is only off the face.

**A small neuron in the corner, lighting when the patch fires.** The drawer covers
the column's permanent map, so while the bench is open the child loses the only
thing on the page saying which part of which cell this trace belongs to — and a
line going up has no visible reason to be about a neuron at all. The inset carries
the same dashed "you are here" ring and lights by the same rule as everything else
in the app: above zero it lights, brightest at the peak, measured against what a
full spike on *this* membrane reaches.

Two decisions inside that:

- **Canvas, not SVG.** Its brightness is a per-frame value, and per-frame values do
  not go through React here. Painted in the loop that was drawing anyway.
- **Its own panel, not a corner of the graph.** The first version put it top-left of
  the trace, which is empty almost always — resting voltage is −72 mV on a scale
  running to +75, so the line lives low. But **every spike scrolls**: a few seconds
  after being drawn it passes straight through that corner, and an opaque inset
  would have hidden it. A panel of its own occludes nothing.

**`NEURON_MAP_BOX` moved into `layout.ts`.** There are two miniatures of the same
cell now — the column's map and the bench's inset — and two hand-computed view
boxes are two pictures that can drift apart. One box, one set of region anchors
(`regionPoints`, `regionOfZoom`), tested to contain every zoom target so a "you are
here" ring can never be drawn off the edge of either.

---

## Step 17 — C05, trace one signal

The spec calls this the app's **signature interaction**: *"one causal chain links
molecular to circuit scales."* Everything it needs was already built and was being
shown as three unrelated exhibits — a patch of membrane with doors, a stretch of
axon with a wave, a whole cell with a chain running across it. A child could visit
all three and never learn the thing that matters most, which is that **they are the
same event at three magnifications**.

### The claim is measured, not narrated

This is the part that decided whether the step was buildable honestly. If the three
views were three animations that merely agreed in spirit, a tour saying "this is
the same spike" would be the app's first asserted-rather-than-derived statement.

They are not. The same gradients, the same push and the same Hodgkin–Huxley
equations drive all three, and `scaleAgreement` measures the result on the runs
actually on screen:

| | one patch alone | a patch mid-axon |
| --- | --- | --- |
| resting | −72.1 mV | −72.1 mV |
| peak | **+59.2 mV** | **+58.7 mV** |
| trough | −88.2 mV | −88.0 mV |
| time above zero | **1.95 ms** | **1.95 ms** |

A test pins `gapMv < 2` — and a second test pins `gapMv > 0`, because **the
difference is the interesting half**. A patch in a cable loses a little current
sideways to its neighbours; a patch on its own has no neighbours to lose it to.
That leak is exactly what wakes the next patch up. *The discrepancy between the two
scales is the mechanism that joins them*, and rounding it away in the prose would
have deleted the connection the whole feature exists to draw.

### Outwards, not inwards

Three stops: **one patch → the whole axon → the whole neuron**, which is the spec's
own order and the opposite of how the rest of the app is explored. Every other
route zooms IN, because zooming in is how you answer *"what is really happening"*.
By the time a child reaches C05 that question has been answered. The one left over
is *"what was all that for"*, and it is answered by pulling out: the doors you
watched opening are the doors that make a foot move. A test asserts the stops
strictly decrease in magnification, so the route cannot be reordered by accident.

### It drives the engines rather than owning one

Each stop flies the camera somewhere and presses what a child would have pressed by
hand at that view — `apStore.fire`, `axonStore.fire`, `neuronStore.fire`. So what
plays during the tour is exactly what plays without it, and there is no fourth
animation to keep true. `tourStore` holds one number: which stop, or null.

Timing comes from `cameraDuration`, the same function the stage animates the camera
with, so a stop's animation starts on arrival rather than while the scene is still
flying past. A number copied here would have drifted the first time an easing
changed.

Two small rules that matter more than they look:

- **The axon stop forces the plain fibre**, never the race. A tour follows ONE
  signal; two axons against a clock is a different question asked at the same place.
- **Steering beats the tour.** If the child navigates away themselves, the tour
  stops rather than yanking the camera back at the next stop.

### Where it stops, and saying so

At the whole cell — which *does* reach the next neuron, since the chain animation
ends on the target cell responding. What is **not** built is the synapse's
machinery: calcium entry, vesicles fusing, transmitter crossing a cleft, receptors
catching it. The last stop says that outright, and a test requires it to. An app
that has spent four milestones refusing to assert unmeasured numbers must not
finish on a promise dressed as a demonstration.

### One deliberate exception to "one place to read"

The tour's paragraphs live in the tour panel, not in the describer. The rule exists
to stop a child's eyes ping-ponging between two blocks of prose — and reading stop
2 at the bottom of a long describer while the **Next** button sits at the top *is*
that ping-ponging, not an instance of avoiding it. A guided route is read a
sentence at a time beside the control that advances it. The panel is capped at
`40vh` and scrolls internally, so it can never starve the describer, which is the
concrete harm the rule was protecting against.

---

## Step 18 — S01–S03, the end of the wire

The first place in the app where the signal **leaves the cell**. Everything before
it is one membrane doing arithmetic with its own gradients; here a cell has to say
something to a different cell, across a gap that charge cannot cross.

The spec is emphatic that the calcium step must not be skipped, and it is right.
Without it, *"an action potential arrives and the terminal releases transmitter"*
is a rule with no mechanism — exactly what this app refuses everywhere else.

### The derived chain

Nothing here is scripted. The whole thing is:

> the **same** spike the membrane view draws → a voltage-gated calcium channel
> opening on that voltage → calcium entering against a gradient of twenty thousand
> to one → the concentration rising → the chance of a vesicle fusing, as the
> **fourth power** of that concentration → vesicles fusing, at times that fall out
> of the accumulated hazard rather than from a cue.

The fourth power is Dodge and Rahamimoff's (1967), and it is why a synapse is a
switch rather than a dimmer: doubling calcium multiplies release by sixteen.

### The finding: three different moments

The calcium channel is deliberately slower than sodium's and opens at a more
depolarized voltage. Neither number was picked for effect — both are what these
channels are like. What falls out, measured:

| | when |
| --- | --- |
| voltage peaks | 0.77 ms — and calcium's door is only **18% open** |
| calcium **current** peaks | 2.80 ms — the voltage is already falling |
| calcium **concentration** peaks | 3.33 ms |

Two reasons, and both are real. The door is several times slower than sodium's, so
it is still opening as the spike comes down. And the pull on calcium is *weakest*
at the top of the spike, because up there the inside has gone nearly positive
enough to push calcium back out. A view that flashed everything at the peak would
teach the opposite of what happens.

### Three mistakes, all caught by measurement

**Calcium's Nernst voltage came out at 49 mV instead of 132.** The drawn ion piles
are one ball per millimole, and free calcium inside a cell is 0.0001 mM — ten
thousand times below the smallest thing that scheme can represent, so the count
read zero and the clamp took over. Fixed by using calcium's real interior figure
and saying, on the page, which of the two numbers is not a drawn one. The
**outside** pile stays real and movable, which is what makes the classic
low-calcium experiment work.

**One action potential raised free calcium to 25 µM,** about fifty times what is
measured in a small bouton. Terminals are packed with proteins that grab calcium
the instant it arrives and only about one ion in fifty stays free. `BUFFER_RATIO`
is not a fudge factor; leaving it out was the error.

**Every vesicle fired, every time, long after the spike.** The sensor was being fed
the terminal's *average* calcium — which stays high for tens of milliseconds. Real
release happens inside about a millisecond and then stops dead. The reason is
geometry: a vesicle's sensor sits a few tens of nanometres from a channel, and what
it sees is a steep local spike that exists only *while current is flowing*. Modelling
that local signal as proportional to the current is the standard treatment and puts
release back in the millisecond where it belongs. **Both** numbers are now kept and
both are shown: the average is what fills the terminal, the local one is what pulls
the trigger.

### And one that only a test would have caught: `g·(V − E)` is wrong for calcium

Sodium and potassium use Hodgkin and Huxley's ohmic form, which is a good
approximation when a gradient is ten-to-one and the I–V curve is nearly straight.
Calcium's gradient is twenty **thousand** to one and that curve is not remotely
straight. Almost every calcium ion crossing came from outside, so the current
follows the outside concentration nearly *proportionally* — while the Nernst
voltage in the ohmic form follows only its **logarithm**.

The symptom: quartering external calcium — the very experiment the fourth power was
discovered with — changed the calcium current by **thirteen per cent**, and the
terminal went on releasing as though nothing had happened. A test asserting that
release collapses caught it.

`ghkCa` uses Goldman, Hodgkin and Katz's constant-field equation, which is the
standard treatment for exactly this case. Measured after the change:

| [Ca²⁺] outside | E_Ca | peak I_Ca | local peak | released |
| --- | --- | --- | --- | --- |
| 2 mM | +132 mV | −164 µA/cm² | 22 µM | 2 of 5 |
| 1 mM | +123 mV | −82 µA/cm² | 11 µM | 0 of 5 |
| ~0 | +31 mV | ~0 | — | 0 of 5 |

Sodium and potassium keep the ohmic form, which is correct for them and is what the
rest of the app rests on.

### Release is probabilistic, and stays a pure function

Two vesicles of five go, at 2.66 and 2.72 ms. Not all five — quantal release is one
of the most important facts about a synapse, and a terminal that emptied its pool
every time would teach the opposite.

But the app's whole architecture rests on a run being a pure function of its inputs,
and `Math.random` would break pausing, scrubbing and memoisation at once. So each
vesicle draws from a **hash** of its index: the same run always plays the same way,
and the five behave like five independent draws. Fusion times then fall out of an
accumulated hazard — an inhomogeneous Poisson process, which is what release is —
rather than being fired at a chosen moment.

### The drawing

The vertical order is the causal order, top to bottom: calcium comes in through the
terminal's roof, vesicles sit on its floor, and what they spill goes down into the
cleft. So the eye travels the way the signal does.

- A fused vesicle does **not** vanish. It flattens *into* the membrane and becomes
  part of it, and the lipid run is interrupted where it did — that is what
  exocytosis is, and a vesicle that popped out of existence would teach that the
  terminal loses a bag every time it speaks.
- The calcium shower's density follows the **current**, not the concentration, so it
  stops dead when the doors shut.
- The far membrane is drawn plain and empty. Receptors are S04–S05 and drawing a
  door that does nothing would be a promise.
- The cleft is exaggerated, and `synapseScaleNote` states by how much in the same
  breath as the real 20 nm.

### A claim that had already rotted

The signal tour's closing paragraph said the synapse was not built at all. It was
true when written and false the moment this step landed. It now names what IS built
and what is not, and **a test enforces both halves** — a sentence describing what
the app contains is exactly the kind that goes stale quietly.

### Step 18a — the zoom-out that was not a zoom-out

Reported from the browser: moving from the tour's first stop to its second did not
read as magnification coming down. Expected — correctly — that the membrane on
screen should shrink, and the axon's *second* membrane should come into view.

The scene was already drawing exactly that. `drawScene` gates its detail on camera
scale alone, so on the way out from ×3100 it draws the bilayer down to ×500, then
the axon as a **tube with two walls** below that. The transition the report asked
for was there and was being covered up.

**Two faults, both in the hand-over.**

`arrival` was `(scale / viewScale - 0.5) / 0.5` — a ramp from half a view's
magnification up to it. Approaching from below that is right. Approaching from
*above* it saturates: flying out from ×3100 towards the axon's ×14 it read **1.00
for the entire 2292 ms**, so the axon view was painted at full strength over a
camera still at ×2300.

Worse, the scene layer's own opacity used the *raw* want, with no arrival gate at
all — so it faded to nothing in 240 ms while the view replacing it was still
invisible. That gap is what made it read as a cross-fade rather than a flight.

`arrivalAt(scale, viewScale)` now measures in **decades**, and from either side.
Decades because that is how the camera actually moves — `interpolate` advances
scale geometrically — so a fixed number of decades is a fixed portion of the flight
in both directions and at any distance. `ARRIVE_DECADES` is 0.3, a factor of two,
which reproduces the old inbound ramp exactly. Both the overlay and the scene's
opacity now read the same gated number, so the scene gives way exactly as fast as
something takes over from it and never sooner.

What the flight out now shows, checked against the scale thresholds the scene draws
by:

| through the flight | camera | on screen | axon view |
| --- | --- | --- | --- |
| 0 – 40% | ×3100 → ×550 | the bilayer, shrinking | 0% |
| 50 – 70% | ×208 → ×37 | the axon as a **tube — both walls** | 0% |
| 80 – 100% | ×22 → ×14 | hands over | 37% → 100% |

The synapse view had no arrival gate at all and would have had the same fault the
first time anyone zoomed out of it; it is on the same gate now.

---

## Step 18b — three reported failures, and a rule

### The rule, first

Now in `CLAUDE.md`, because it kept being rediscovered a view at a time:

> **The canvas carries no explanation; the info block carries all of it.** On the
> canvas the only text allowed is **names** (a part, a protein, a state) and
> **readings on a scale** (millimetres, mV, ms, ×140). A sentence explaining what
> a reading *means* goes in the describer.
>
> **Every button has an explicit label saying what it does.** Icons rank and
> decorate; they do not name.

The button half **reverses** an earlier round that stripped the spike bench's three
push buttons down to bare lightning bolts. The argument for that was sound as far as
it went — a size is something a picture says better than a phrase, and the ordering
did read at a glance. But a control whose meaning has to be inferred is a puzzle,
and a child should not have to solve the interface before starting on the biology.
The bolts stay and still carry the ranking; the words say what each one is.

First application: the on-canvas voltage panel painted a sentence under its reading
("inside negative, as it always is", "the inside has gone POSITIVE"). The number and
its NAME stay — a reading with no name is not a reading — and the sentence moved to
`voltageNote` in the describer.

### 1. Two shapes on one layer, one of them wiping the other

**"Send a spike to the terminal — no visual change happens."**

The model was right and the scene drawing was right; a recorder test showed
`drawSynapse` emitting ~5,700 calls and changing with `u`. The fault was in the
wiring, and it is a good one to remember: the terminal's `Shape` and the axon
ribbon's `Shape` share one Konva layer, and the axon's `sceneFunc` began

```
if (fade <= 0.002) { ctx.clearRect(0, 0, STAGE_W, STAGE_H); return }
```

At the terminal the axon's fade is zero — so every frame, immediately after the
terminal finished drawing, its sibling cleared the entire canvas. Konva clears a
layer before drawing its children anyway, so the `clearRect` was never doing
anything useful; it was only ever able to do harm, and it could not do harm until a
second view moved onto the layer.

### 2. The zoom-out, again — and this time the camera was wrong too

Two further faults behind *"the top membrane should always stay in the view"*.

**The pan ran at the wrong end of the flight.** `PAN_PORTION` put the sideways move
in the first 55% of the journey, with a comment explaining that the pan must finish
early because a scene pixel of error is invisible at ×1 and half a screen at ×2400.
Correct — for flying *in*. Flying *out* it is exactly backwards: it swept sideways
while still at ×3000, which threw the very membrane being left behind off the canvas
within a few frames. The rule is **pan while wide**, and which end is wide depends on
the direction. Now it climbs first and pans once there is room. The turn is mirrored
the same way.

**The molecular bilayer popped.** `scale >= BILAYER_SCALE` was a hard switch: lipids
above it, a plain stroked line below, nothing between — so a wall made of molecules
vanished in one frame. Magnification does not work like that; things get smaller
until you cannot see them. `bilayerBlend` now smoothsteps it out between ×500 and
×200.

That change surfaced a third fault that had been on screen all along. The molecular
run is capped at 460 lipids a side, and measurement showed **the cap already bites at
bilayer magnification itself** — 575 wanted at ×500. Because the plain wall was the
`else` of the molecular one, the remaining fifth of the visible wall had *no membrane
drawn on it at all*, ending at a hard edge mid-membrane. Two fixes: the plain wall is
now drawn **always**, with molecules over the top of it, and the lipid run fades out
over its own last stretch so detail runs out instead of stopping.

### 3. One event, one picture of it

**"Step 1 and step 2 should display the same part highlighted. The AP should look
identical for all 3 steps."**

*The highlight.* It ringed the zoom target's exact centre — which sounds more precise
and is in fact less true. The axon membrane patch is at t=0.55 along the axon and the
propagation view is centred at t=0.30, so the mark jumped a hundred scene units
between the tour's first two stops. At this size they are the same place: the map
already compresses six millimetres of modelled axon into ninety micrometres of
drawing. Precision the picture cannot carry is precision that misleads. The mark now
follows the **region** — dashed along the whole axon for both axon views — and only
falls back to a ring where a target has no region.

(Co-locating the two zoom targets was the other option and was rejected: their
canvas markers would have overlapped and become hard to click.)

*The action potential.* It was drawn three different ways — a travelling sweep out on
the axon, a uniform glow at a membrane patch, and a third thing during the whole-cell
chain. Three pictures of one event, which is the exact opposite of what a map beside
a guided trace is for. Worse, one of the three was the misconception this milestone
exists to dismantle: an axon lighting as a unit is precisely what saltatory conduction
is **not**.

There is now one sweep, fed by whichever clock is running — the fibre run on the axon,
the patch's own `u` at a membrane patch, and a local clock for the chain (its
positions live in a ref on the stage and only the phase reaches the store, so there
was nothing to read).

Honest at a membrane patch? More honest than the glow it replaces. The tour measures
the claim: one patch alone and one patch mid-axon give the same spike to within half a
millivolt, and a patch of a real axon that fires propagates. The map is a picture of
the whole cell, not of the isolated patch on the canvas.

### Step 18c — descriptions out of active elements

The rule tightened after a first pass was too loose: **a button carries a label
and/or an icon and nothing else.** It may also carry a one- or two-word *state
reading* on the thing it controls ("working", "open now") — that is a reading, not a
description. What it may not carry is a sentence.

Five were found and moved. A regex sweep over every `<button>` in the app caught
four; the fifth hid behind a `{note}` expression and only turned up on a second pass
looking for the small-text idiom rather than for literal prose.

| where | what was inside the button | where it went |
| --- | --- | --- |
| `DemoPanel` | the question each exhibit asks, plus "🔬 opens a lab bench" | the describer (`demoQuestion`); the 🔬/⚡ distinction became the icon |
| `ControlPanel` | what each part of the neuron does | already in the describer on selection — simply deleted |
| `SignalTour` | what the tour does, two lines | a hint under the button |
| `MembraneParts` → `ProteinControl` | a full sentence, sometimes with live numbers | a paragraph under the button |
| `SpikeTrainBench` | (the reverse case) bolts with no names at all | names restored beside the bolts |

Every removed sentence went into `title=` as well, so hovering and screen readers
keep it.

The last row is the one worth remembering: the same rule that says *don't put a
paragraph in a button* also says *don't leave a button unnamed*. Both failures are
the button not being a name.

### Step 18d — the column stops explaining the canvas

Six reports, five of them the same idea arriving from different directions: **the
canvas already says this.**

**The grey line under the bilayer** was mine, from the previous fix. Guaranteeing a
continuous membrane at every magnification by drawing the plain wall
*unconditionally* was the obvious move and the wrong one: at the membrane patch a
grey stroke then sat under the molecular bilayer, showing through the gaps between
lipids and along a tilted wall. A schematic and a molecular drawing of one wall are
two drawings of one thing and must not both be on screen. The plain stroke now fades
out on `1 − blend`, so at bilayer magnification it is not drawn at all and the
hand-over is still continuous.

**The little neuron had a yellow axon.** Marking the region by laying a thick dashed
amber stroke *along* the axon was a straight collision with the app's own colour
language, where yellow means one thing everywhere: a signal is here. A place and an
event cannot share a colour. The mark is now a dashed **box round** the region — it
draws on nothing, a rectangle reads as a marquee, and it is sky rather than amber.

**Four removals, one rule.**

| gone | why |
| --- | --- |
| `This membrane can show` heading, and its group box | a heading over two items costs a row to say what the two items say |
| the `⚡ Fire an action potential` row | it was a list entry duplicating a canvas button — and the canvas one is the real affordance, in front of the membrane it acts on |
| the whole `Parts of this neuron` list | the parts are labelled on the canvas and clicking one selects it; a list beside a labelled drawing is a second index |
| three hint sentences | each explained an affordance that is visible and obvious out there |

The two remaining exhibits are now standalone buttons in the sibling app's grammar
(🧪 Periodic table, 🌡️ States of matter), which also states something true: both are
drawers, neither is a mode, so neither needs a selected state.

Nothing was lost with the parts list — selecting a part still fills the describer
exactly as before. `ControlPanel` is down to the one control that genuinely is not on
the canvas: *fire two inputs TOGETHER* is a choice about a set, and there is nothing
out there to click that means it.

### Step 18e — the marker says what is on screen; a clock belongs to its event

**The blue box round the whole axon was wrong, and the reason generalises.** It
replaced the ring on the argument that a patch of axon membrane and the stretch you
watch a signal cross are the same place at map scale. That argument ignored the
marker's actual job: **the canvas was showing a small piece of axon, and a mark round
the entire axon says the canvas is showing all of it.** A location marker reports what
is on screen; it follows the camera, because the camera is the only thing that knows.

Back to one dashed amber ring on the zoom target's own `center`. Amber is safe here
and was not safe as a stroke along the axon, and the distinction is worth keeping:
**a thin dashed outline is never read as a glow; a thick stroke laid along a
structure is a lit structure however you dash it.** Shape carries the difference,
not colour alone.

**Three firings for one action potential.** The miniature's chain sweep was keyed on
the chain's phase — and the phase changes three times while the signal is on its way
out (axon → terminal → target). Each change tore the effect down and rebuilt it with
a fresh start time. The rule: **a clock belongs to the event it is timing, not to
whatever happens to be re-rendering.** Arm it on the event, remember it by run id so
it cannot be armed twice, and keep the frame handle in a ref so the sweep survives
the re-renders that used to kill it.

**The stop-start sweep at a membrane patch** was the map following the demo's own
position — and that demo deliberately *stops* at each gate moment so a child can read
what opened. So the little axon crawled and halted half a dozen times on its way
past: a true picture of the demo's pacing and a false picture of the neuron, which a
spike crosses in a seventh of a millisecond, stopping nowhere.

The map now runs at its own speed, in two legs, and pauses in exactly one place — the
ring. Which is honest about a different thing: **the pause is not the signal waiting,
it is us waiting, at the spot we chose to look at.**

### Documentation pass

`CLAUDE.md` is now a rules **index** — each entry one line, pointing at the section
of [03-architecture.md](03-architecture.md) that carries the reasoning and the bug it
came from. The architecture document gained eight sections built from this
milestone's corrections: *Where words go*, *Handing the scene over to a view of its
own*, *Level of detail must dissolve, never switch*, *The whole-cell miniature*,
*Clocks belong to events, not to renders*, *Model patterns*, *Scientific honesty
rules*, and *When a view is judged unreadable*.

This roadmap gained **What the corrections taught**, at the top, where a plan can be
checked against it before being written — including the three diagnostics that
actually found bugs (sweep a parameter and print a table; measure agreement *and*
pin that the difference is not zero; draw into a recording context and count the
calls) and the seven-step sequence a feature should follow.

The reason for splitting them that way: a rule with its reasoning attached is
persuasive but too long to scan, and a rule without it gets argued with next time.
The index is for scanning; the architecture document is for the argument.

---

## Step 19 — S04–S05, across the gap

The terminal built in step 18 stopped at release: packets were spilled into the
cleft and went no further, because nothing was there to catch them. This is what
catches them.

### The fact this step exists for

A child who has just watched the terminal has seen a delay of about **2.7 ms**
between the spike arriving and a vesicle going. The obvious explanation — and the
wrong one — is that the chemical takes time to cross the gap.

It does not. Einstein's relation on the gap's own width and glutamate's own
diffusion coefficient gives:

| | |
| --- | --- |
| crossing 20 nm | **0.61 microseconds** |
| delay before the first vesicle went | **2.7 milliseconds** |
| ratio | **~4,400×** |

So the synaptic delay is almost entirely the **release** step — calcium's slow doors
and the sensor waiting to catch four ions. The crossing is free. That is worth a
whole feature, because *"the message has to travel across the gap"* is exactly the
picture a child will otherwise build, and nothing else in the app contradicts it.

A test pins the ratio above 1000, from two independently measured numbers.

### What is modelled

> vesicles fusing (read from the terminal's own run) → transmitter as a
> concentration in the gap → receptors binding it, **two molecules before anything
> opens** → a gate opening → and, quickly, **desensitizing** — shutting while the
> transmitter is still there.

Every rate is a real one for an AMPA-type receptor, and the shape of the response is
a consequence rather than a schedule. Measured:

| | |
| --- | --- |
| one vesicle in the gap | 2.64 mM |
| peak (two vesicles landed together) | 4.83 mM |
| transmitter above a tenth of peak | **0.87 ms** |
| receptors open, at most | **73%**, 0.47 ms after the packet lands |
| response above a tenth of peak | 5.9 ms |
| still desensitized at 12 ms | ~29% |

Three teachable consequences fall out and none was arranged:

- **The gap empties faster than the answer to it.** Transmitter is not left lying
  about — it spreads sideways and is pumped back in — because a synapse has to be
  able to say the next thing.
- **The lock takes two keys**, so the response follows the *square* of the dose at
  low concentrations. A test doses the receptors with one vesicle instead of two and
  requires far less than half the opening.
- **Some receptors shut while still holding transmitter**, and are slow to reopen.
  That is why a synapse shouted at repeatedly has less to give each time.

### Drawing rule: do not animate a journey that does not happen

The cloud's molecule count follows the **concentration**, and the molecules appear
*already spread through the gap* and simply thin out. Drawing a leisurely drift from
the terminal down to the receptors would have been the natural thing to animate and
would have taught the exact misconception the step exists to correct.

The per-vesicle spill from step 18 was **deleted** rather than kept alongside: with a
concentration in the model, drawing transmitter twice — once per vesicle and once
from the gap — would be two accounts of one thing.

### The claim rotted again — twice pinned now

`synapseFacts` ended with *"the transmitter crossing the gap and being caught on the
other side is the next step"*, and `tourFacts` said the far side was not built. Both
were true when written and false the moment this step landed. This is the second
time that sentence has gone stale (the first was when the terminal itself landed),
so both are now checked **in both directions**: the test requires the sentence to
name what the far side does *and* requires it not to claim as unbuilt anything that
is built.

Also applied here, from the canvas-text rule: the readout's `3 of 5 released` — a
statement about what happened — became `3/5 vesicles`, a bare labelled reading. The
describer says the rest.

### Step 19a — the clock, not the drawing

Three reports, and two of them were one bug: *no transmitter is displayed*, *after
exocytosis nothing happens*, *there is no way to restart*.

**The transmitter was displayed.** A recorder test proved it — the arc count jumps by
exactly the cloud's worth at the moment a packet lands. It was displayed **for half a
second, one second after pressing, at the same moment the vesicles were fusing and
taking the eye.** That is not displayed. And after four seconds the whole event was
over, leaving twenty seconds of calcium quietly draining.

Both are the same fault: **one flat rate for an event that is not evenly
interesting.** The whole of release, crossing and binding lives in about four
milliseconds of a sixty-millisecond run — 7% of it — so a flat clock spends 93% of
the watching time on the least interesting part.

`SYNAPSE_LEGS` splits the run into three, each with its own share of screen time:

| model | what happens | screen |
| --- | --- | --- |
| 0 – 1.5 ms | the spike arrives, calcium's doors begin to open | 2 s |
| 1.5 – 6 ms | calcium peaks, vesicles go, the gap fills and empties, gates open | **8 s** |
| 6 – 60 ms | settling — receptors closing, calcium draining | 4 s |

Four and a half milliseconds of model time gets more than half the watching. Result:
the run is 14 s instead of 24, vesicles go at 4.1 s, and the transmitter is on screen
for **2.37 s** instead of 0.55.

**What is deliberately not done:** the transmitter transient is not stretched
relative to what surrounds it. It is genuinely the briefest thing on the page and it
still looks the briefest — slowing a whole leg keeps every duration in proportion to
every other. **Slow the leg, never the item.**

> **Rule.** A run's clock must follow the interest, not the model's own even time.
> If a step's payload occupies a small fraction of its window, split the window into
> legs and give the payload most of the screen time — and check the result by walking
> the clock in a test and reporting when each moment lands.

**The restart.** At the end, ▶ did nothing: resuming a run already at its last frame
advances it to its last frame. A finished run now offers **↺ Fire again**. Worth
generalising — *every transport that can reach an end needs a control that says start
over, and it must say so rather than looking like resume.*

Also fixed: `drawCloud` **assigned** `globalAlpha` instead of multiplying it, so the
cloud ignored the view's arrival fade and painted at full strength while the rest of
the scene was still coming up.

### Step 19b — the scene rebuilt around the active zone

Seven faults reported, and **five of them were anatomical rather than aesthetic**.
The scene had been drawn as a *layout* — a top, a middle and a bottom — before anyone
asked where the parts of a real terminal actually are.

| reported | what was wrong | fixed |
| --- | --- | --- |
| calcium doors on the opposite side of the cell | **a science error.** Voltage-gated Ca²⁺ channels at a synapse are clustered *in the active zone*, in the very membrane the vesicles are docked on | doors moved into the active zone, interleaved with the vesicles; calcium enters going **up**, into the terminal, beside a waiting sensor |
| the bouton's far edge is drawn but is not in view | **an invented surface.** A bouton is ~1 µm across; at ×160 its far wall is off the top of the frame | the roof is gone; the cytoplasm fades out at the top of the picture |
| vesicles are circles | **the material was the point.** A vesicle is a sphere of the *same* bilayer | drawn as a bilayer ring — two leaflets of heads round an oily middle — which is why it can fuse at all |
| the membrane is a ruled line | a membrane is a liquid | `waveAt`/`slopeAt` on `LipidRun`; the two walls wander with different phases so they are not parallel, and molecules stand square to the surface |
| the bouton's edge is vertical and curved, the view horizontal and straight | **a 90° mismatch.** In the scene this synapse lies along x, so its real cleft is vertical; the view draws it horizontal | `turn: π/2` on the zoom target — the camera performs the rotation itself, visibly, on the way in |
| no binding shown | the two coupling steps the spec insists on were invisible | a **calcium sensor** on each vesicle with four sites that fill as calcium arrives, and **two transmitter molecules** in each receptor's mouth |
| control panel overlaps the channels | chrome collision | terminal starts at y=96; the readout moved to the bottom of the frame |

**The contradiction worth recording.** The channels-on-the-far-wall error was not
just anatomically wrong — it argued against this app's own model. Step 18 models the
sensor as reading a **microdomain at the mouth of a channel**, a claim that makes no
sense if the channel is a micrometre away across the cytoplasm. *If two parts of a
model are coupled by proximity, the drawing must show them as neighbours or it is
arguing against itself.*

**Improvements not on the list**, from reviewing the whole thing:

- **Desensitization made visible.** It was a number in a describer and nothing on
  the canvas. With three receptors drawn, each standing for a third of the
  population, one can be shown **shut while still holding its transmitter** — grey
  gate, two green molecules still in its mouth. States are allocated by *threshold,
  not rounding*, so a receptor does not flicker as a fraction crosses a boundary.
- **The bound molecules persist and the cloud does not.** Drawn separately and drawn
  last, so a child watching the gap empty can see the message has not emptied with
  it — which is the finding.
- **The vesicle's own exaggeration declared.** A vesicle is 40 nm, *twice* the width
  of the gap it empties into; drawn, it is smaller than the gap. Both cannot be
  honest on one page, so `synapseScaleNote` now says which way the trade went.
- **Two fragile alpha manipulations fixed** — `globalAlpha *= a … /= a` is exact only
  by luck, and a view that leaks a hundredth per lipid draws the next thing wrong.

The rules distilled from this are in
[03-architecture.md](03-architecture.md) → *Drawing a scene: plan the anatomy before
the picture*.

### Step 19c — one bad colour, three symptoms

Reported: the bouton appears rotated at the top of the canvas, nothing is drawn but a
grey curved area, and the release button does nothing.

Three symptoms, **one cause**, and it was not where any of them pointed.

`mix` read hexadecimal colours only — slicing characters and calling `parseInt` — and
returned `rgb(NaN, NaN, NaN)` for anything else. It had been doing that for a long
time harmlessly, because its result only ever became a `fillStyle`, and **an
unparseable fillStyle is silently ignored by the spec**. The scene rebuild fed it
`rgba(30, 41, 59, 1)` and passed the result to `addColorStop`, which **throws**.

The throw escaped the Konva `sceneFunc` and killed the **animation loop**. Hence:
the camera froze part-way through its turn (bouton rotated, off-centre), the layer
never drew (grey scene showing through), and the clock never advanced (dead button).
None of that resembles a colour-parsing bug.

**The test that existed could not have caught it.** The permissive canvas mock's
`addColorStop` was a noop. So the fix came with `strictCanvas()`, which checks what a
browser checks: every colour parses, and no radius or coordinate is negative or
non-finite.

> **Rule.** A test stand-in must fail where the real thing fails. A mock that accepts
> everything cannot catch the class of bug it exists to catch.

> **Rule.** Silent NaN is the fault, not the throw. Pin *"never returns NaN"* with a
> test rather than relying on every consumer being forgiving.

> **Rule.** After writing a regression test, break the code again and watch it fail.
> Done here: reverting `mix` makes both new tests fail, one of them reporting the
> browser's exact error.

Also: `mix` existed **twice**, privately, in two drawing modules — with the same bug
in both. The duplicate was deleted rather than repaired, because a second copy of a
fixed bug is a bug that comes back.

---

## Steps 18–19 — the view removed; the models kept

The neurotransmitter view is **deleted**, to be redesigned from the picture up. Four
rounds of correction against it were mostly *anatomical* — doors on the wrong wall, a
surface invented off the page, a vesicle drawn as a bubble, a ninety-degree
orientation mismatch — which is the signature of a scene that was laid out before
anyone asked where the parts of a real terminal are. Patching that further would be
patching a plan.

**What went:** `stage/synapseScene.ts`, `state/synapseStore.ts`,
`ui/SynapseInfoPanel.tsx`, the stage's shape, clock, fade and transport control, and
the `presents`/`turn`/×160 on the `outgoing-synapse` zoom target — which is a marker
with a promise on it again.

**What stayed, deliberately:**

- **`core/synapse.ts` and `core/cleft.ts`, with their 33 tests.** The science was
  never what was wrong. It is measured, cross-checked, and cost several rounds to get
  right: Goldman–Hodgkin–Katz for calcium (the ohmic form is wrong at a
  twenty-thousand-to-one gradient), buffering at one part in fifty, a microdomain the
  sensor reads rather than the terminal average, Dodge and Rahamimoff's fourth power,
  seeded quantal release, and AMPA-type binding with desensitization. The new picture
  should draw *these*, not a fresh set of numbers.
- **`waveAt` / `slopeAt` on `LipidRun`** — a membrane is a liquid, and the next scene
  will need it.
- **`strictCanvas()`**, retargeted at the axon ribbon so the tool stays exercised.
  An unused strict stand-in rots, and the bug class it catches is not specific to any
  one view.
- **`mix`, fixed and de-duplicated.**

### One sentence for the frontier

The claim about what the app contains went stale **three times** — when the terminal
landed, when the far side of the gap landed, and now when both were removed. Each
describer carried its own wording, so every change quietly falsified two or three
paragraphs at once.

`FRONTIER` in `core/neuron.ts` is now the single sentence naming what the app does
not yet do, and every describer that reaches the edge interpolates it. Tests pin that
they do.

> **Rule.** A claim about what the app contains must exist in exactly ONE place. A
> test can pin that a sentence mentions the frontier; it cannot know whether the
> sentence is true. The only fix that works is having one sentence to keep true.

---

## Step 26 — D01, the lipid lab

The first D-exhibit, and the first step through the new process: its drawing
spec was written into [05-visual-language.md](05-visual-language.md) before the
drawing (→ *Spec: D01*), and three scope questions were put to the user rather
than guessed — answers: full ambition (structure + self-assembly + a draggable
lipid), **real names with kid sentences**, and drawer exhibits open from a
**button in the left column** (the demo menu), which is now the trigger pattern
for all of D01–D13.

### What was built

- **One molecule, magnified ×~9,000 and named.** `drawLipid` was extracted from
  `drawLipids` in `stage/bilayer.ts` (byte-identical for existing callers) so
  every molecule anywhere — the big labelled one, the sixty in the tank, the
  benches' walls — is one drawing. It gained an optional `kink` (default 0):
  the unsaturated tail's bend, resolving with magnification. The head wears its
  charges in the charge colours: red + outermost, sky − at the phosphate.
- **The tank.** Sixty lipids with three stable states — wall, scattered, and
  the two transports between them — all pure functions of (state, clock) in
  `stage/lipidLabScene.ts`. Scatter is a seeded jittered-grid bijection; wall
  slots spread edge to edge with flexing spacing; settling is 6 s of staggered
  swimming that ends *exactly* in the slots; the oily core's presence follows
  how assembled the wall is. The magnifications in the describer are derived
  (`WALL_MAG`, `MOLECULE_MAG`), not typed in.
- **The drag.** In the wall phase a molecule can be pulled out by its head; its
  own leaflet re-spreads over the same span in 280 ms (the wall closes — the
  lesson), the other leaflet does not move, and on release it swims home.
  Nothing ever teleports and sixty stays sixty, both pinned by tests.
- **Words.** Framing line first ("a lab bench — not a picture of your neuron"),
  live "Right now" per phase (the drag narration names the finding: a liquid),
  the molecule's parts in real names with kid sentences, and four honesty notes
  — choreographed + sped up, the flat patch that would really curl into a
  bubble (naming vesicles and the cell as closed bags of this wall), the
  missing cholesterol/proteins, and the real sizes with both magnifications.
- **Wiring.** `state/lipidStore.ts` (semantic state only; transports stamp
  their own clock), a `lipid` entry in the demo menu, `<LipidLab />` in App.

17 new tests (561 total): slots even and inside the wall; heads face the water
on both leaflets; both transports land exactly and never move a lipid more than
a bounded step per 40 ms; a seed change rearranges the scatter (a result that
does not change when the input changes is a broken parameter); the closed wall's
spacing; conservation in every phase; grabbing only works on wall heads;
strictCanvas passes for every phase incl. mid-drag; the describer names the
real parts and declares every exaggeration, magnification numbers included.

### Step 26a — corrections round

Three reports, plus process feedback now codified (CLAUDE.md: open every step
and corrections round with alignment questions; "implement as you see fit, I'll
verify and correct" is a standing answer).

- **A released molecule swam back to its OLD place, however far away it was let
  go.** Expected: the shortest path back to the membrane. The wall's arrangement
  is now state (`slots` — lipid → slot-in-leaflet): on release the molecule
  takes the slot nearest to where it was dropped, the bystanders shift by at
  most one with their relative order preserved — which is exactly what keeps
  the release moment seamless, pinned by a test that compares every lipid's
  pose across the release boundary. A scatter resets the arrangement, at the
  moment nothing is drawn from it. The fix was broken deliberately and the
  nearest-slot test watched failing before it was trusted.
- **"Horizontal grey lines behind the membrane" in Balance an ion.** The prime
  suspect was the day's `drawLipid` extraction; a recording-probe test replayed
  the ORIGINAL pre-refactor `drawLipids` and the current one into an
  argument-recording context and proved them operation-identical (flat and wavy
  runs). Nothing else touched that view's drawing. Awaiting the user's
  pinpointing (asked with options) before touching the bench.
- **Kids do not read labels.** New rule, 03-architecture → *Where words go →
  Who reads what*: icons and the picture carry meaning for the kid; a view
  derives from the context it was entered from; buttons address the adult; the
  info block is written to be read aloud (kid sentences, real names kept).
### Step 26b — corrections round: the vesicle, the solid wall, the quiet bench

Opened with alignment questions per the working agreement; three rulings came
back and two science checks were made.

- **The vesicle panel (user proposal, adopted).** A second small tank under the
  big molecule: thirty of the same molecules that, on the same press and the
  same clock as the wall, curl into a closed bilayer bag — the "small patches
  close into bubbles" honesty note made visible. Its inside is a **soft
  translucent rose** (the user's body-association idea) — chosen over full pink
  through the conflict protocol, because saturated pink is Ca²⁺'s ball colour
  and a pink-filled bag would read as a bag of calcium. The rose lumen and the
  oily ring fade in with assembly: **an inside is something a closed membrane
  makes.** The bag is drawn ~15 nm and declared (~40 nm is the real minimum).
  The transport choreography was extracted into one shared `travel()` — the
  wall and the vesicle are one weather, never two copies.
- **The wall is now solid to the hand.** A held molecule cannot be dragged
  through the membrane (`clampHeldY`): the user asked for the *feeling* of
  impermeability and the science agrees — a charged head cannot cross the oily
  middle, and leaflet flip-flop is a once-in-hours event. Pinned by a test.
- **The wall runs edge to edge** — the frame is a window on a wall that keeps
  going (66 lipids; the forced spacing is within 2% of HEAD_GAP; pinned).
- **The bench's field arrows are REMOVED.** The user's premise was verified
  correct before agreeing: the cytoplasm already wears a polarity tint that
  follows the dial (`polarityT`/`chargeRamp`), and the ± marks carry the
  amount — the arrows were a third, redundant voice in the same grey, same
  direction and same length as the lipid tails beside them. Direction survives
  in the describer (`fieldDirection`) and in every real crossing.
- **Science question answered, no change needed:** the single phospholipid
  showing both + and − on its head is correct — a phosphatidylcholine-type head
  is a **zwitterion**: phosphate (−) with choline (+) right beside it, net
  neutral but strongly polar, which is exactly why water clings to it.
- **F04 term voice** (new spec row): the atomic `SpeakButton` ported verbatim;
  a "Say it" list in the lab's describer speaks *phospholipid, phosphate head,
  fatty acid, bilayer, vesicle*. Future shorthand: "add voice to term A".
- Conventions recorded in CLAUDE.md: **"tests pass"** flips every awaiting
  status except items explicitly corrected in the same message (applied: step
  26 round-1 scope marked done).

570 tests green; new pins: vesicle ring radii and head orientations (outer
heads outward, inner into the lumen), transports landing exactly on the ring,
the drag clamp, edge-to-edge slots, the declared vesicle size interpolated into
the honesty note, and strictCanvas over the vesicle in every phase.
### Step 26c — the molecule becomes atoms

The user asked to trace the line back to the Atomic Playground: show what the
phospholipid is made of. Their ball-and-stick handover was reconciled in
[05-visual-language.md](05-visual-language.md) (→ *Reconciliation record —
ball-and-stick handover*) and, at their own invitation, replaced with a
**space-filling model**: every atom a glossy sphere in the house style,
overlapping where bonds are. Alignment answers: invent non-reserved colours
(muted earth family — no red, no blue, those mean charge), the schematic lipid
in the panel corner under an amber ring with the realistic view magnified out
of it, tails truncated and declared (9/10 drawn of 16/18 real).

Built: `buildPhospholipid()` — a pure, countable truncated phosphatidylcholine
(1 P, 1 N, 8 O, 29 C, 56 H): choline with three methyls, the phosphate
tetrahedron, glycerol, two ester C=O links, and two zigzag tails whose cis
double bond IS the schematic's kink. The + and − sit at the real places
(choline N, phosphate O) in the charge inks. Magnification (~×14,000) derives
from giving the real 0.154 nm C–C bond its 9.5 px step. The molecule vibrates
sub-pixel from the shared clock. Five leader names: choline, phosphate,
glycerol, kink, fatty-acid tails; `choline` and `glycerol` joined the voice
terms. New tests pin the atom census, the size ordering P > O = N > C > H, the
kink's bend, panel bounds, and the declared truncation. 575 tests green.
### Step 26d — corrections round: the room, the relations, the voice

Five user requests, all applied; 576 tests green.

- **The drawer fills the screen.** The lab measures itself against the viewport
  once at module load (the `stage/layout.ts` pattern): row 1 — the atomic
  molecule and the vesicle, side by side, given ~62% of the height; row 2 —
  the wall tank, shorter, given the full width. The wall's lipid count, the
  vesicle's scale and the molecule's scale all derive from the viewport, and
  every declared magnification derives with them (the scatter grid's bijection
  multiplier is now computed coprime to the derived count).
- **Relation markers are rounded rectangles.** The amber circle read as a zoom
  ring; the wall's marked lipid, the corner schematic and — new — a frame
  around the whole atomic view are now dashed amber rounded rects, the corner
  one joined to the big frame by two WIDE dashed amber lines. Rule recorded:
  rounded rects + dashed connectors say "this small thing is that big thing";
  the dashed circle stays the camera's "you are here" (03 → *Who reads what*).
- **The voice moved onto the labels.** The Say-it list is gone; every canvas
  name (phospholipid, choline, phosphate, glycerol, kink, fatty-acid tails,
  bilayer, vesicle) carries an amber 🔊 glyph and speaks on tap. Label hit
  boxes are pure exported functions, and a test pins that the spoken-term list
  and the on-canvas labels are exactly the same set — the list and the picture
  cannot drift apart. (Was it hard? No — the labels' positions were already
  pure functions; hit-testing them cost ~30 lines.)
- **Exhibit launchers renamed to the concepts they demo**, each with its own
  icon: ⚖️ Equilibrium potential, 📈 Spike trains & refractory period,
  🫧 Phospholipid bilayer, 🧭 Signal propagation. Rule recorded in 03.
### Step 26e — corrections round: the jiggle, the water, the rose

Five requests, four applied, one documented for later; 576 tests green.

- **Wall lipids jostle visibly now** (amplitude 0.4 → 0.9, tilt 0.035 → 0.07):
  a bilayer is a liquid crowd, and the parked-looking wall undersold it.
- **The vesicle got its water back.** "Wrong scale" was the container, not the
  bag: the vesicle is now drawn at the WALL's own magnification (same bilayer,
  same scale, same ×N — the cross-view consistency rule), floating small in a
  panel that grew to take its full share of row 1. Both row-1 panels now split
  the drawer's width edge to edge, the molecule centring itself in its share.
- **The rose lumen fades at its edge** — a radial falloff to nothing at the
  inner leaflet: a tint of a space, not a painted disc.
- **The wall's amber marker is gone** at the user's request; the
  schematic↔atoms relation is carried entirely inside the molecule panel
  (corner inset ↔ frame, wide dashed connectors).
- **D14 membrane constructor documented, not implemented** (new spec row):
  drag channels and pumps into a bare bilayer; the built membrane's resting
  voltage must be derived from chord conductance over what was actually
  plugged in. Parked in milestone 5 as step 32b.
### Step 26f — the vesicle's lipids are draggable too

Same grammar as the wall, on a ring: pull a molecule out of the bag by its
head; its leaflet re-spreads round the full circle in CLOSE_MS; release it and
it swims to the NEAREST place on the ring (the shortest-path rule, angular).
The bag's wall is not crossable, and that carries a finding the flat wall
cannot show: **an inner-leaflet molecule can be slid around the lumen but can
never leave the bag** — crossing would drag its charged head through the oily
middle, which is why real membranes keep flippase enzymes to move a lipid
between leaflets on purpose. A new 🔁 paragraph says so; the holding narration
was generalised from "the wall" to "its membrane". New pins: nearest-slot
reinsertion is an angular permutation with the other leaflet untouched; the
outer clamp keeps a held molecule outside the ring and the inner clamp traps
it in the lumen; grabbing works on bag heads only in the wall phase; the ring
closes evenly while the inner leaflet stays put. 580 tests green.
### Step 26g — the real thing, in the drawer

"Tests pass" received — step 26 and all its correction rounds marked done.

The lab gained a **photographs section**, and the user's assumption that no
real photos exist turned out pleasantly wrong: real electron micrographs of
membrane bags are on Wikimedia Commons under free licences, so no diagram
fallback was needed. Two were added through the established pipeline
(normalized to 900 px JPEG in `public/real/`, entries in `core/realPhotos.ts`,
covered automatically by the existing manifest/origin/licence tests):

- **`vesicle-pellet`** (CC0, Gallo et al., PLoS ONE via Commons) — purified
  membrane bags in negative stain, ~100 nm, leading the set because they are
  the lab's lone bubble for real. The `look` line declares the cup-shaped
  dents as a drying artefact, not the bags' shape in water.
- **`exosomes`** (CC BY 4.0, James R. Edgar via Commons) — a real cell shedding
  crowds of membrane bags at its own membrane, the researchers' labels and
  500 nm bar left in place.

Both images were viewed and their captions written against what is actually
visible (measure, never assert). The photo block itself was extracted into a
shared `RealPhotoBlock` (used by the zoom-driven panel and the drawer — never
a second copy), with `photosForLipidLab()` as the drawer's source. The source
rules that lived only in `core/realPhotos.ts` comments are now doctrine:
03-architecture → *Real photographs: the source rules* — trusted origins only,
CC0/CC BY only (official visualizations are the declared fallback when no real
photo exists), credit+licence+link beside every image, kind stated, and a
photo must be OF something on screen. 581 tests green.

---

## Step 27 — D02, the permeability bench

Opened with alignment questions; answers: live wall + log ladder, the lever is
**containers the kid fires** (click a beaker, a squirt of its substance is
released at the wall) with a loud ↺ Reset, and a **toggleable aquaporin**.

### The fact this step exists for

The wall is not a sieve. A sodium ion is SMALLER than a water molecule and
still crosses a bare bilayer about **30 billion times less often** (derived
from the coefficient table, interpolated into the describer, pinned by a
test): what decides is CHARGE, because charge cannot enter oil. The honest
span — oxygen to potassium — is sixteen decades, which no animation of a
moment can show. So the bench is two instruments on one number set: the tank
shows the ORDER with declared-compressed odds, and the **log ladder** carries
the truth, one printed order-of-magnitude coefficient per rung, every rung ×10.

### What was built

- `core/permeability.ts`: the traveller table (O₂ 20, CO₂ 0.35, H₂O 10⁻³,
  glucose 10⁻⁷, Na⁺ 10⁻¹³ cm/s; ladder-only Cl⁻ 10⁻¹¹, K⁺ 5×10⁻¹⁴), each with
  its one-clause verdict; derived ratios; facts and honesty notes (compression
  declared, numbers declared order-of-magnitude, "a cell cannot run on almost
  never — the sodium that matters travels through channels").
- `stage/permeaScene.ts`: viewport-fitted tank at the lab's own bilayer
  magnification; five beakers, each holding a drawn sample of itself
  (travellers drawn from the molecular inset palette; Na⁺ as the glossy gold
  ion wearing its red +); motes conserved, deterministic per id, each
  wall-knock rolling its own die; crossings soak slowly through the oil; the
  aquaporin (`drawGatedChannel`, narrow, gateless — fixed part-open) boosts
  water ~×10 near its mouth and nothing else; the ladder with speakable names,
  live "crossed n" counts, and an amber ×10 arrow when the aquaporin is in.
- Speakable-label helpers extracted to `stage/spokenLabels.ts` and the glossy
  sphere to `particleStyle.glossySphere` (second users arrived; no copies).
- Wiring: `state/permeaStore.ts` (semantic only; motes live in view refs, the
  balance chambers' precedent), demo-menu entry 🫗 Membrane permeability.
- **Photos: the "nothing to photograph" exception**, recorded per the new
  real-photo rule — a bench of pure lipid patches has no tissue to show.

16 new tests (597 total): the table's ordering; the derived ratios above 10¹⁰
and 10¹³ and interpolated into the words; tank odds ordered like the truth;
gases mostly cross in 20 s, water trickles, glucose and sodium NEVER; the
aquaporin raises water and leaves sodium at zero (and does nothing away from
its mouth); conservation and bounds over 20 s runs; no mote parked inside the
oil; clickable containers where drawn; ladder rung order, reading formats
(20, 0.35, 10⁻³, 10⁻¹³), stacked-row nudging; spoken labels hit where drawn;
strictCanvas over tank, ladder and every traveller.
### Step 27a — corrections round: the words in a frame, the squeeze, the coat

Five reports, all applied; 597 tests green.

- **Drawer describers were bare columns.** Both drawers' info blocks now use
  the house container (bordered, rounded, scrolling inside its own frame —
  `BenchInfoPanel`/atomic grammar), recorded as a rule in 03-architecture, with
  the photo block keeping the sibling app's image proportions inside it.
- **The log ladder panel is removed** at the user's request and the tank takes
  the full width. Its truth did not leave: the measured coefficients are now
  printed readings in "Keep in mind" (every traveller's number, pinned by a
  test), and the crossed counts collect at the tank's foot as glyph+×n.
- **Size made visible — the squeeze.** A crossing traveller narrows mid-oil
  (never at entry or exit) while the wall visibly bows around it, because the
  oil has no holes, only jostling tails that can be pushed apart for a moment.
  Small squeezes through; glucose, big and dressed in water-loving groups,
  never gets taken in. A new 🤏 fact says exactly that.
- **Why ions can't pass — the water coat**, the suggestion chosen (over an
  energy-hill inset or a charge-repulsion flash): the sodium ion is drawn
  wearing five faint clinging waters, in its beaker and in flight. Water
  clings to charge and cannot be taken off; coat and all, the ion arrives at
  the oil permanently dressed for water. The ⚡ fact and sodium's verdict line
  now teach through the coat.
- **The aquaporin's control moved onto the wall it changes** — a chip sitting
  just above the bilayer, toggling in place (pinned to sit within a bilayer's
  height of the wall). Its catchment was widened for the full-width tank, with
  the honesty note that one drawn aquaporin stands for the many a real
  membrane carries.
### Step 27b — corrections round: the atomic grammar, read properly this time

The third request to match the atomic playground's info block was the charm —
the sources were finally read line by line and the findings are now BINDING
DOCUMENTATION in 05-visual-language → *The info block, verbatim from the
atomic playground*: the one-container rule (scroll inside the frame),
border-top section separators (never nested boxes), icon-led bullet rows, and
photographs as plain `figure.mb-4` children in the flow. The anti-pattern —
a panel inside a panel — is named there, with the twice-made mistake on
record. Applied:

- **Photos in the lipid lab** are now bare figures in the describer's flow
  (`PhotoFigures`; the bordered `RealPhotoBlock` remains only as the main
  column's standalone panel, where it sits between siblings).
- **"How easily it crosses" moved into the info block** as its own section of
  icon-led bullets — one traveller per row (🌬️💨💧🍬🧂), measured number plus
  the one-clause reason, sorted by permeability; the honesty section now
  points at it.
- **Containers are the atom builder's distributor trays**: flat rounded boxes
  (124×52 css, `#1e293b`/`#334155`, corner 12) with the sample perched on the
  rim and the speakable name inside the tray.
- **The aquaporin moved to one side** (80% of the width) — the middle stays
  the bare wall the bench is about — and **water's tray moved to the rightmost
  slot, directly above it**: its own door under its own container. Pinned: the
  chip sits past 65% of the width.
- **Long molecules turn to squeeze**: O₂ and CO₂ rotate 90° mid-crossing —
  a plank through a slot — and turn back on arrival, on the same envelope as
  the squeeze.
- **Sodium's water coat reverted** (too confusing for a kid); the coat lives
  in the words (⚡ fact), the drawing is the familiar gold ion again.

597 tests green.
### Step 27c — corrections round: the sibling ruling, and one squirt each

- **THE PHOTO BLOCK IS A SIBLING OF THE INFO BLOCK — never its child.** Fixed
  on the fourth ask (built nested twice, then in-flow once — all three wrong
  readings mine). The lipid lab's left column is now two sibling panels, the
  main column's own arrangement: the info container, and `RealPhotoBlock`
  standing beside it. The ruling is written in capitals in 05-visual-language
  → *The info block…*, with the note that atomic's in-flow element-card photos
  do not transfer (that whole card is one panel).
- **One squirt per container.** A substance already in the tank cannot be
  fired again until ↺ Reset — derived from the motes themselves
  (`firedSpecies`), so the control can never disagree with the picture. A
  spent tray dims to an empty box; Reset visibly refills all five. The
  dead "tank is full" note went with it. 598 tests green.

---

## Step 28 — D12, the membrane charge bench

Alignment answers: form left to me, **charge-and-count language only** (no
"capacitance" in the child-facing words), and **include the delay**.

### Measured before drawing

Everything derives from three numbers the app already commits to — a 20 µm
soma, a 5 nm membrane, 140 mM internal potassium — times ~1 µF/cm² and two
constants of nature. The probe table, before any pixel was drawn:

| | |
| --- | --- |
| soma area / volume | 1.257×10⁻⁵ cm² · 4.19×10⁻¹² L |
| whole-cell charge-holding | **12.6 pF** |
| K⁺ dissolved inside | **353 billion** |
| charges held at −72 mV | **5.6 million** |
| the lesson | **1 ion in 63,000** |

A test sweeps the derivation rather than trusting one figure: proportionality
(twice the voltage, twice the charge), zero at zero, sign-independence, and
that area and crowd track `SOMA_DIAMETER_UM` and `IONS.k.insideMM` rather than
a typed-in number.

### What was built

**Two crowds and one skin, on one canvas.** The cytoplasm's potassium is drawn
in bulk — 420 jostling ions that NEVER change — while the charge skin on the
two faces is drawn mark by mark and follows the dial: thickening with voltage,
vanishing at zero, flipping faces when the sign crosses. Beside it a counter
draws the two numbers to the same scale, where the skin's bar is a hairline
against the crowd's full-width bar (floored at one pixel so "vanishingly
small" never becomes "absent"). The bulk is a pure function of the clock with
no voltage argument at all — the coupling that would break the lesson cannot
be written by accident, and a test pins the count and positions across time.

**The delay, as a lesson.** The dial asks; the membrane's own voltage chases
it with `VM_SETTLE_MS` (the app's own 320 ms), the reading says "catching
up…", and the describer explains that charge must be carried onto the faces
before the voltage is there — the same delay that gives a spike its curve.

**Words at two levels, per the ruling.** The child-facing text says the
membrane holds charge on its faces like two sheets of stickers; a test asserts
the words "capacitance", "farad" and "Q = C·V" appear ONLY in the honesty
note, where the adult reading aloud finds the 12.6 pF and the formula. Other
declarations: each mark stands for a crowd (~217,000 charges at rest, printed
live), the crowd is counted as potassium alone so the true ratio is even
larger, and the settling figure shows that the delay exists rather than how
long it lasts.

**No photo block:** a charge skin has never been photographed — the
"nothing to photograph" exception, recorded per the real-photo rule.

17 new tests (614 total).
### Step 28a — corrections round: two broken instruments and a sideways drawer

Three reports; the second and third were one fault — **I built instruments
that cannot show what they measure.**

- **The drawer scrolled sideways.** The counter panel was placed BESIDE a
  canvas whose width had already claimed the whole content column. The patch
  canvas now subtracts the counter's panel from its own width, and all three
  drawers gained `overflow-hidden` on the grid with `min-w-0` on both columns
  — a fixed-width canvas in a `1fr` column raises the column's min-content and
  pushes the drawer wider, every time.
- **The potassium crowd ignored the dial.** True to the arithmetic (the skin
  is 1 ion in 63,000) and false as teaching: a control that changes nothing
  visible reads as broken. The crowd now **leans**: potassium is a cation, so
  a negative interior pushes it back from the inner face — which is exactly
  what leaves the negative skin behind — and a positive interior pulls it
  against the wall. The warp is monotone and endpoint-preserving, so the count
  is identical at every setting, no ion overtakes another, and none can enter
  the wall or leave the cytoplasm (all pinned). The exaggeration is declared
  beside the real number: the direction is honest, the amount is not.
  **A sign error was caught by the new test, not by eye:** the first warp made
  a negative interior gather cations AGAINST the face — the opposite of the
  physics.
- **The counter's bars never moved.** The skin's bar was drawn linearly
  against the crowd's — 1/63,000 of the width, floored to one pixel, visually
  constant. Replaced by two instruments that can each do their job: a LINEAR
  bar of "held now, of the most this dial can hold" (which swings widely), and
  a POWERS-OF-TEN axis carrying both populations with the gap between them
  labelled "1 in N". The lesson kept the honest number; the picture got an
  instrument with range.

> **Rule (restated, third time paid for).** A result that does not change when
> the input changes is a broken parameter — and an instrument whose reading
> cannot change is a broken instrument, however honest its arithmetic. Check
> the RANGE of an instrument against the range of the thing it measures before
> drawing it.

617 tests green.
### Step 28b — corrections round: charge you can see, and a panel worth nothing

- **Ions now wear their charge.** `drawChargeAura` in `stage/particleStyle.ts`
  finally builds what that file's own header promised at step 0 ("charge will
  be shown by glow and ± badges"): a crisp hollow ring just outside the body,
  red for +, sky for −, at a FIXED radius so its size means exactly one thing,
  with only brightness and width carrying how much (Ca²⁺ will read as more
  than K⁺). Applied to the charge bench's potassium, which is where it was
  load-bearing: the whole explanation of the lean rests on the child knowing
  those violet balls are positive, and a violet ball says nothing about
  charge. The ions were also enlarged (2.4 → 3.4) so a ring fits, count eased
  340 to keep the crowd legible.
  **Note for the user:** the ⚖️ Equilibrium potential bench does NOT currently
  draw auras — its ions are plain glossy balls, and its charge language is the
  ± marks on the faces plus the polarity tint over the cytoplasm. Rolling
  auras out there is a live question, not an oversight; asked at hand-over.
- **The right-hand counter panel is removed.** Correctly judged worthless to a
  child: it used the word "faces" the picture never showed, and compared two
  populations in bars with no story. What replaced it:
  - **the faces are named on the picture**, beside their own marks — "outside
    face" and "inside face", both speakable;
  - **each count is a reading next to the thing it counts** — "5.6 million
    charges stuck here" by the skin, "353 billion potassium ions in here" by
    the crowd — so *what is held, and against what* is answered where the eye
    already is;
  - **the ratio became a sentence with a crowd a kid knows**:
    `crowdComparison()` picks the nearest everyday count in powers of ten, so
    1 in 63,000 reads as *"one person in a packed football stadium"* — and it
    CHANGES with the dial (a classroom, a school, a town, a city), because a
    derived comparison must move when the number moves.
  - The patch takes the full column, which also removes the sideways-scroll
    risk at its source.
  Division of labour now matches the rule: the canvas carries names and
  readings, the column carries the meaning, and a test pins that the block
  does NOT repeat the two raw counts.

619 tests green.
### Step 28c — one way to draw an ion's charge

Two corrections, both about consistency.

- **"Charge aura" meant the COMPARTMENT tint**, not a halo on a particle — my
  misreading. The charge bench's cytoplasm now wears the same
  `chargeRamp`/`polarityT` wash the equilibrium bench uses, strongest against
  the membrane and fading inward, because the charge a voltage *is* sits in a
  thin skin at the wall. Recorded in 03-architecture so the term cannot drift
  again.
- **Three conventions for one property, unified.** An ion's charge was drawn
  as a dark mark stamped INSIDE the ball (membrane view / AP demo), a large
  red plus floating well above it (permeability bench), and — for exactly one
  round — a hollow ring (charge bench). `drawIonCharge` in
  `stage/particleStyle.ts` is now the only way: a **± badge just off the
  ball's top-right shoulder, close in**, red for + and sky for −, vector
  strokes over a dark backing so it reads over gold, violet or green. All
  three call sites now route through it, including `drawScene.chargeMark`,
  which is a one-line delegate. New tests pin the badge's position (up and to
  the right, within half a radius of the edge — the old floating plus was two
  radii out), that it scales with its ion, that + is a cross and − a single
  bar, and that neutral draws nothing.

623 tests green.
### Step 28d — the day the app went solid red

Two reports, one of them a serious regression I shipped in 28c.

- **"The screen is fully red or fully blue."** The new charge badge used pixel
  floors — `Math.max(2.2, radius * 0.55)` for its stroke, `Math.max(1.6, …)`
  for its arm — which is only sane in screen space. `drawScene.chargeMark`
  calls it INSIDE a membrane patch's own transform, scaled by up to ×3100: a
  2-unit line there is a stroke wider than the whole canvas, so every ion
  painted the screen. **Every constant in the badge is now proportional to the
  ion's own radius**, with no floors at all.
  The existing tests all passed through this — they only ever called the badge
  at screen sizes. A new test now draws it at radius 0.001 and requires the
  arm, the offset and the line width to shrink with it; reintroducing the
  floor makes that test fail (checked, per the break-it-again rule).
  > **Rule.** A drawing helper called from inside a scaled context may contain
  > no absolute pixel constant. Sizes are proportional to the thing drawn, or
  > the caller passes them in screen space explicitly.
- **The cytoplasm wash reached into the membrane.** It began at the wall's
  MIDDLE, so it tinted the lower leaflet and showed through the gaps between
  lipids — making the wall itself look charged instead of the water beside it.
  It now starts below the wall's full thickness.

624 tests green.
### Step 28e — the switch, the soft edge, the friendlier glyph

- **The aquaporin's control no longer sits on top of its pore.** A control
  stacked above the thing it changes hides it. The pore is back in the MIDDLE
  of the wall (with water's own tray directly above it — its door under its
  container), and the control moved to the right-hand end. Pinned: the switch
  starts well right of the pore and stays inside the tank.
- **It is a switch now, not a text chip** — a track with a knob that slides,
  ochre and bright when the channel is in, slate and dim when it is out, with
  the name beside it. A child reads on/off from the shape without reading a
  word (the *icons and pictures for the kid* rule).
- **The charge wash no longer cuts a hard line along the membrane.** One
  shared `chargeWash` now serves all three views that have one (charge bench,
  equilibrium bench, membrane view): it ramps up from nothing over the first
  sliver, peaks just inside the water, and fades with depth. The peak stays
  near the wall, which is where the charge really is; only the last pixels
  against it are softened. Three separate hand-rolled gradients became one
  call — the third time in this app that a device drifted into three copies.
- **The ± badge's outline is a deep version of its own ink** (dark red behind
  a plus, dark blue behind a minus) instead of black: the same contrast
  without the printed look black gave at crowd sizes.

624 tests green.
### Step 28f — the badge, ported properly

- **The ± badge is now the sibling app's charge-playground badge**, read from
  `ChargePlayground.drawIon` rather than approximated: a small FILLED disc in
  the ion's top-right corner at the same proportions (centre at 0.85 r,
  radius 0.34 r), red `#ef4444` for + and sky `#0ea5e9` for −, with a white
  glyph inside it.
  One deliberate departure, recorded because it will look like a deviation:
  the glyph is drawn as **vector strokes, not `fillText`**. This app draws
  ions inside contexts magnified by thousands, where a font size is either
  unreadable or refused outright by the canvas — the same failure that once
  made every label vanish at ×2400. Everything in the badge stays proportional
  to its ion for the same reason.
- **The aquaporin switch is sky-500 when on** (`#0ea5e9`), the sibling app's
  switch colour.

Step 28 and rounds 28a–28f marked done on the user's "tests pass".
625 tests green.
### Step 28g — one phospholipid, one badge rule

- **The phospholipid is unified.** The whole-neuron scene had quietly grown
  its own molecule — curved tails, a wider splay, a different gap at the
  midplane — beside the benches' straight, kinked, splayed one. The bench
  drawing (the phospholipid-bilayer drawer) is now the source of truth:
  `bilayer.drawLipidAt` draws it, every proportion expressed as a fraction of
  the head's radius, and both callers pass their own size — the benches their
  comfortable one, the scene its honest magnification-derived one. The scene
  keeps its cached per-leaflet gradients through the shared `leafletPaint`,
  so nothing was given up on the performance side.
- **The midplane, checked rather than eyeballed.** Asked whether the tails
  should overlap or leave a gap: the leaflets DO meet — there is no empty
  channel down the middle — but the terminal methyls are the most disordered,
  lowest-density part of the whole wall, and a real bilayer's electron-density
  profile shows a distinct trough exactly at the midplane. So the tips now
  stop just short of it (`MID_SEAM` = 0.15 head radii), leaving a faint seam
  the oily core shows through. The bench drawing had been overshooting the
  midplane by a fifth of a head radius, which read as the two layers stitching
  into each other; the scene had a gap more than twice as wide as this one.
- **The ± badges are bigger, and there is now a rule for how big.**
  `BADGE_FRACTION` 0.46 of the ball's radius, nudgeable by a view only between
  `BADGE_MIN` 0.34 and `BADGE_MAX` 0.6 — bounds as FRACTIONS, never pixels,
  for the reason 28d cost an afternoon. Pinned by tests: same fraction at
  every size, clamping at both ends, and still proportional at radius 0.001.

628 tests green.
### Step 28h — the charge bench's badge is the floor

The user set the ± badge as it appears in 🧲 Membrane charge as the MINIMUM
apparent size, everywhere, unless a view is explicitly told otherwise.

Implemented without breaking the scaled-context rule that cost an afternoon:
`BADGE_MIN_SCREEN_PX` (3.13 — the charge bench's own badge, ION_R × 0.46 ×
its ×2) is a SCREEN-space number, so the drawing helper never applies it.
Each caller converts it with `badgeMinR(scale)` and passes the result in its
own units: the benches with their ×2, the membrane view with the camera's
live magnification. The floor overrides the fraction, as a floor should, but
may never grow a badge past the ball it belongs to.

A test pins `BADGE_MIN_SCREEN_PX` against the charge bench's actual badge, so
the reference cannot silently drift from the view that defines it.

632 tests green.
### Step 28i — the lipid's proportions, measured

The user's eye said the heads were too big and the tails too short. Measured
against a fluid phosphatidylcholine bilayer (hydrocarbon core ~14.6 Å per
leaflet, headgroup region ~9 Å, area per lipid ~65 Å²), the verdict:

| | real | drawn (bench) |
| --- | --- | --- |
| head as a share of a leaflet | 38% | **73%** (×1.9 too big) |
| tails : head | **1.62 : 1** | 0.37 : 1 |
| lateral spacing | 8.1 Å | 18.9 Å (×2.4 too sparse) |

Correct on every count. Fixed at the root rather than by taste: `HALF_MEM`
stays the one chosen length (it is what the declared 5 nm is worth in this
drawing, so no magnification claim moves), and everything else now DERIVES
from a measured number — `HEAD_R` from the app's own `LIPID_HEAD_NM`,
`HEAD_GAP` from a new `LIPID_SPACING_NM` (√0.65 nm² ≈ 0.81 nm, with its
provenance in the comment), `TAIL_LEN` as the rest of the leaflet. The bench
molecule is now 40% head against the real 38%, its tails are the longer half,
and the wall packs two and a half times denser — shoulder to shoulder, which
is also why a real membrane has no persistent gaps.

Knock-ons handled: the vesicle's ring counts are now derived FROM its radius
at the real spacing (52 outer + 21 inner, bag still ~15 nm) rather than fixed
counts that collapsed the bag when packing tightened; the lab's framing and
narration quote derived counts instead of stale typed ones; and the vesicle
ring-gap test's tolerance now accounts for the fact that a fixed pixel jiggle
is a bigger ANGULAR share on a denser ring.

The whole-neuron scene needed no proportional change — it was already deriving
its head from `LIPID_HEAD_NM` and its thickness from `MEMBRANE_PX`, so it was
close to right all along; it inherits the shared shape and the new seam.

A new `bilayer.test.ts` pins all of it to the biology: head share 30–45% of a
leaflet, tails the longer half, spacing less than a head is wide and equal to
the declared value, every length derived, and the midplane seam under a tenth
of a leaflet.

636 tests green.
### Step 28j — a key for ions too small to label

The equilibrium bench draws its ions at their honest scale, which is about
3 px of body radius — far below anything that can carry a badge or a name.
Each of the four chambers now shows a **specimen ion in its header**, drawn
big (9 px radius) and wearing the charge badge the crowd below cannot show,
beside the species symbol in the species colour (`ui/IonKey`).

> **Rule.** Below `ION_LABEL_MIN_PX` (5 screen px of body radius — the charge
> bench's ion, the smallest size judged readable) an ion cannot carry its own
> badge or name. The view owes the reader a KEY: one specimen at readable size
> in the view's own chrome. Never shrink a label to fit, and never put the
> legend over the stage — the stage keeps the honest scale and carries no
> explanation. `needsIonKey(radiusPx)` answers the question in code.

A test pins that this bench's ions really are below the floor at every
chamber width, so the key cannot be mistaken for decoration and deleted.

Caught while adding it: a duplicate import made `benchScene.test.ts` fail to
*load*, and the runner reported that file as "PASS (0) FAIL (0)" rather than
as a failure — only the total count dropping from 636 to 624 gave it away.
Worth remembering: **watch the total, not just the word PASS.**

637 tests green.
### Step 28k — the travellers were the ones out of scale

The user suspected the ions looked gigantic beside the corrected lipids, and
that the permeability bench's "squeeze" had stopped making sense. Measured:

| | real | drawn | |
| --- | --- | --- | --- |
| O₂ | 0.35 nm | 2.0 nm | ×5.8 |
| CO₂ | 0.33 nm | 3.0 nm | **×9.1** |
| water | 0.27 nm | 1.7 nm | ×6.4 |
| glucose | 0.86 nm | 3.0 nm | ×3.5 |
| Na⁺ (bare) | 0.20 nm | 1.1 nm | ×5.5 |

The membrane was not the problem — it had just been corrected. The travellers
had always been oversized and had merely *looked* right beside lipids that
were oversized too. Two wrongs cancelling is exactly why nobody noticed.

**Fix: one scale for the whole tank.** Every traveller now carries its real
size (`sizeNm` — kinetic diameters for the gases and water, van der Waals for
glucose, the BARE ionic diameter for sodium) and is drawn against a wall drawn
to its own. Each molecule is defined in unit space, so the drawing cannot
drift from the number. The bench's magnification doubled (×2 → ×4) so the
smallest traveller is still ~5 px across; the declared ×N follows
automatically, and the trays — chrome — now show magnified KEYS, per the rule
established one round earlier for ions too small to label. Sodium's badge is
drawn only where it could be read: on the stage it is a 4.6 px ion, so its key
carries the charge instead.

**⚠ Science correction, and it removes a feature the user asked for in 27a.**
The squeeze-and-rotate is gone. At honest sizes CO₂ is a third of a nanometre
against lipid heads spaced eight tenths apart — it has nothing to squeeze
past — and a molecule visibly wriggling through a gap teaches SIEVING, which
is the misconception this bench exists to kill. The proof is now visible on
the bench itself: glucose is smaller than a lipid head and never crosses,
while a bare sodium ion is the smallest thing in the tank and never crosses
either. Fitting is not the test; dissolving is. The 🤏 fact became a 📏 fact
saying exactly that, and the wall still stirs around a crosser, because the
tails really do part around one.

Four new tests pin the sizes to the biology, the ordering (Na⁺ < water < CO₂ <
glucose), that the gases are smaller than the gap between heads, that the
magnification keeps the smallest visible, and that the trays' keys are
declared. One older test hardcoded the bench's old ×2 and broke — now derived.

641 tests green.
### Step 28l — the voice, and a wall that opens instead of closing

**"Speaking is not working."** Every way the Web Speech API fails is SILENT —
no error, no exception — which is why this survived being "shipped". Three
quirks, all handled in `speakAloud` now, all pinned by tests against a fake
synthesiser:

1. **Voices load asynchronously.** In Chrome `getVoices()` is empty for the
   first moments of a page's life and speaking then does nothing at all. We
   wait for `voiceschanged`, with a timeout, because Safari populates voices
   synchronously and never fires the event.
2. **A paused queue stays paused.** `resume()` before every utterance clears a
   queue an earlier interruption left stuck.
3. **Safari wants `speak()` inside the gesture**, so the normal path is
   synchronous — no timer between the tap and the speaking. Only the
   voices-not-ready path defers, and a gesture's activation is still sticky by
   then. (A first attempt deferred everything by a tick to dodge a Chrome
   cancel-then-speak bug; that would have broken Safari, so it was reverted
   before it went anywhere.)

Also widened every spoken label's tap target by 8 px on each axis: a name is
11 px of ink and a child's finger is not, and a tap that misses is
indistinguishable from a voice that does not work.

**The permeability wall now OPENS.** It bowed its midline around a crosser,
which stands each neighbour square to a dented surface — tilting them toward
each other, so the wall appeared to close over the traveller rather than part
for it. `LipidRun.pushAt` shoves molecules aside ALONG the membrane instead,
swelling as the traveller enters and closing behind it. The reasoning is in
the field's own comment so the bow does not come back.

648 tests green.
### Step 28m — atoms, one exaggeration, and a wall that opens just enough

Three reports, one of them an error I introduced two rounds earlier.

- **⚠ The same element was drawn at different sizes.** Each molecule had been
  normalised to a unit span and then scaled by its own size, so the carbon in
  glucose came out **1.85× the carbon in carbon dioxide**. A carbon is a
  carbon. Molecules are now built from REAL ATOMS at real bond lengths in
  nanometres (O=O 0.121, C=O 0.116, O–H 0.096 at 104.5°, C–C 0.153) with one
  van der Waals radius per element (H 0.110, C 0.170, N 0.155, O 0.152, Na⁺
  ionic 0.102). Sizes now EMERGE from the atoms instead of being asserted, so
  the inconsistency cannot come back.
- **They were too small to tell apart.** One shared exaggeration —
  `TRAVELLER_MAG` = 2, applied to every traveller alike and declared in the
  honesty note. Relative sizes therefore stay true (sodium still the smallest
  thing in the tank, glucose still the bulkiest), and the membrane stays the
  one honest ruler on the canvas.
- **The squeeze is back, with a real justification.** It was removed last
  round for teaching sieving; drawing from atoms restores the reason it was
  right: a molecule is not a ball. Carbon dioxide is a ROD — half a nanometre
  long, three tenths wide — and what has to fit through a gap is its narrow
  face, which is exactly why chemists quote a *kinetic diameter* rather than a
  length. So a rod turning side-on to cross is real physics; only molecules
  with a genuinely slim axis turn (`narrowNm` decides, so sodium does not).
  The squeeze itself is gentle (15%) and stands for the give in both molecule
  and tails.
- **The gap no longer invites the sieve question.** The parting is now sized
  by the crosser (`openFor`) rather than fixed, so the widest gap a child ever
  sees is the size of a gas — and a test pins that even the widest stays
  NARROWER than glucose's own narrow face. Glucose never crosses, so the wall
  is never seen opening for it at all.

Four new tests: same element same size everywhere, which molecules are rods,
the gap ceiling against glucose, and that every traveller shares one declared
magnification.

652 tests green.
### Step 28n — a door that visibly does something, and buckets that fit

- **The aquaporin looked inert**, and measurement agreed: with one pore in a
  wide wall, almost no molecule ever knocked near it. Water now **drifts
  toward the pore** as it nears the wall, and a molecule that crosses there is
  put on the pore's own centre line, so it files down the channel in single
  file — which is how an aquaporin actually passes water. Measured: 12/12
  water across in 20 s with the door in, against 3/12 without; 4/12 vs 0/12 in
  the first 5 s. Sodium is untouched by the drift and still never crosses.
  **The exaggeration is declared:** no real pore reaches out and pulls, but a
  real membrane carries millions of them, so a water molecule is always beside
  one. The drift stands in for the pores this bench cannot draw. Only water is
  gathered, only water crosses there, and it goes through single file.
- **The tray samples are the size of what they fire** (`TRAY_KEY_MAG` 4 → 1)
  and the trays shrank to suit. The magnified key existed because the
  travellers were specks; now that they are legible, a magnified sample
  promised a different creature from the one that came out.

Test note worth keeping: the first version of the funnel test measured one
water mote's velocity after a single frame and read 0.35 instead of ~5.4 —
because the thermal jostle is a hash of the mote's id, and mote 0 at epoch 0
draws the maximally negative kick, which cancelled the pull almost exactly.
The test now measures water AGAINST SODIUM, which draws the identical kick, so
the difference is the funnel and nothing else. **When a deterministic system
has to be measured, difference two runs that share the seed.**

653 tests green.
### Step 28o — the little cell moves to where it lives everywhere else

The spike-train bench kept its whole-cell picture in the corner of the
controls row, 140×64. It is now the FIRST thing in the drawer's left column,
in the map panel's own clothes (`rounded-xl border … p-2`, 136 px tall, full
column width) — the same panel, the same size, the same place as the
permanent map every other view carries. A drawer covers that permanent map,
and this bench without it is a graph of nothing in particular.

**And it fires with the buttons now.** It was lit by `v > 0`, i.e. only during
the sliver of overshoot above zero millivolts, which is why it looked as if
nothing happened when a spike ran. Brightness is now measured from THIS
membrane's own resting voltage to its own peak and squared, so:

- a real spike lights the cell through its whole upstroke and fall;
- a weak push, which barely leaves rest, still lights nothing at all —
  because nothing happened, which is that button's entire lesson.

Both ends pinned by a test against the model (bright at the peak, >0.25 at
0 mV, under the inset's 0.02 draw threshold for a failed push, exactly 0 at
rest), so the rule cannot drift back to the overshoot-only version.

654 tests green.
### Step 28p — the door, the buttons and the empty buckets

Four fixes to the permeability bench, all reported from watching it.

- **Water teleported into the pore.** The door's catchment was a fifth of the
  tank wide, so a molecule "crossing at the pore" was snapped sideways into
  the channel. The mouth is narrow now (`PORE_HALF × 1.6` — the funnel is what
  brings water to it), and a crosser EASES onto its lane instead of jumping.
  Pinned: over eight seconds of crossings, no molecule moves further in one
  frame than its own width.
- **Reset moved onto the canvas**, in amber in the top-left corner, and the
  DOM button above the tank is gone — the drawer has no room to spare, and a
  control belongs with the thing it controls. A test pins that Reset, the
  aquaporin switch and every bucket occupy separate places.
- **The buckets sit lower and no longer share a hit area with their own
  names.** Tapping a name fired the bucket and tapping the bucket could speak
  the name; the name now lives BELOW the tray, outside it. Pinned in both
  directions.
- **A spent bucket keeps a ghost** of what it held rather than emptying to a
  blank box: once several have been fired, the child can still see which
  substance each bucket was.

657 tests green.
### Step 28q — the press becomes something ARRIVING

The user's diagnosis of the spike-train miniature: the axon fires with nothing
having arrived, which teaches that an axon can fire by itself — the exact
misconception milestone 1 exists to dismantle, and a rule already written down
here ("signals never appear without a cause"). Their proposed fix — bind the
button press to a dendritic input, gentle and going nowhere for a weak push,
carrying through for a strong one — is right, and is now built.

**Validated, with one caveat recorded.** The bench's model is a current
injected into ONE patch, the way a real electrode does it; it does not
integrate synaptic input. So the dendrite glow is a *framing*, not a
computation: it says "something arrived", while the graph says what this
membrane did about it. That framing is truer to the biology than a bare axon
flash, and it is the story the rest of the app tells, so it stands — with the
describer saying plainly that the press stands for signals arriving.

The timing worry the user raised solves itself. The ripple runs in
`INPUT_RIPPLE_MS` = 1.4 model ms, and the bench is slowed 200×, so it is about
a quarter-second on screen: the arrival visibly precedes the spike, because
the spike's own upstroke takes time too. Cause before effect, for free, with
no lag added to the graph.

**And the weak push now teaches instead of just failing.** `inputRipple`
carries a strong input all the way to the soma and lets a weak one FADE OUT
along the branches — which is what dendritic decay does, and the honest reason
a small input fires nothing: not that the cell ignored it, but that little of
it was left on arrival. Pinned: strong travels past 0.9 of the way, weak stops
under 0.7, and the ripple is over within a few milliseconds rather than being
a state the cell sits in.

Also this round: the pore's pull reaches much further up the tank (a molecule
anywhere near the door leans toward it, not only one already grazing the
wall), and each bucket's molecule now sits ON its tray, overlapping the middle,
rather than balanced on the rim where it read as a separate object.

660 tests green.
### Step 28r — the cause becomes an electrode

The user watched the dendrite version and reported what it actually did: small
sparks on the branches, nothing reaching the soma, no propagation — and asked
whether it teaches the right physics. Two findings.

**A defect:** the ripple walked the dendrite PATHS, and the soma is not on
those paths, so the glow reached the last branch point and stopped. It never
handed over to anything.

**And the better design, theirs:** show the signal source as what it is —
something from outside the cell's own biology. Adopted, and the dendrite
version removed entirely. What this bench computes is a current injected into
ONE patch, the way a real electrode does it, so an electrode is what it draws:
a thin probe touching the ringed patch, flashing on every press, brighter for
a harder push, fading within about a fifth of a second on screen. Quiet on
purpose — the neuron stays the subject of its own picture — and named in the
column, because a child cannot work out from a thin line that it is apparatus:
*"a scientist's wire, not part of the neuron … real neurons are pushed by
other neurons instead, at their dendrites, which is what the whole-cell view
shows."*

Why this beats the prettier version: the dendrite glow depicted synaptic input
the model never integrates, so the picture and the model disagreed. The
electrode is honest to the computation, still supplies the visible cause that
keeps "axons fire by themselves" off the screen, and introduces the apparatus
that **D13 (patch clamp — how we know)** will explain. Rule recorded in
03-architecture: *draw the cause the model has, not the cause the story wants.*

661 tests green.

---

## Step 29 — D03, the ion channel opened up

Alignment answers: anatomise the **voltage-gated potassium channel** (the one
object carrying both the S4 sensor and the selectivity filter); the filter
interactive and the two views side by side were left to me.

### The fact this step exists for

The app's own ion table already contains the paradox, and nothing had ever
pointed at it:

| | Na⁺ | K⁺ |
| --- | --- | --- |
| bare | **0.20 nm** | 0.28 nm |
| wearing its water | 0.72 nm | **0.66 nm** |

Sodium is the smaller ion and the bigger traveller, because a smaller charge
in a smaller ball grips water harder. A sieve would pass sodium. This filter
passes potassium, about a thousand times more readily — and the reason is that
**the filter is too wide for sodium to be paid for, not too narrow for sodium
to enter.** Its carbonyl oxygens sit exactly where potassium's water molecules
sat, so potassium swaps one for the other and loses nothing; sodium is too
small for those oxygens to reach, the payment falls short, the coat stays on,
and the coat will not fit.

### What was built

**Two pictures of one object.** The side view cuts the channel open in its
membrane — two of the four subunits, the pore's water between them, the four
stacked oxygen sites of the filter at the outer end, the gate where the
subunits cross at the inner end, and the S4 helices carrying the same red
charge marks the schematic channel wears everywhere else in the app (now on
the helix that actually has them). Beside it, the top view looks straight down
the pore: four subunits in a ring, the way through in the middle. The app's
own marker grammar joins them — a dashed amber box round the filter, and the
top view is what you see through it.

**And an ion you can send.** Press K⁺ or Na⁺ and watch: both set off
identically — the difference has to be earned — then potassium trades its
water coat for the filter's oxygens and files through, while sodium presses,
keeps its coat and is turned back. The coats are drawn at their real hydrated
diameters against a 0.3 nm filter, so a coat visibly cannot fit.

12 new tests (673 total), and the ones that matter pin the science rather than
the drawing: sodium smaller bare and bigger dressed; the BIGGER ion is the one
that passes; both bare ions fit and neither coat does, so size is not what
decides; the words say "too wide for sodium to be paid for, not too narrow";
both ions start identically; and nothing teleports.
### Step 29a — corrections round: a frozen exhibit and a fair question

- **The bench froze after one attempt.** The ion buttons were disabled on "is
  the run still going?", computed during render from the animation clock —
  which the render never saw advance again, so once an ion had gone through,
  nothing re-rendered and nothing re-enabled. The loop now clears a finished
  attempt (that clearing IS the re-render), the ion buttons are never
  disabled — pressing again simply restarts — and there is an explicit
  **↺ Reset**. Rule recorded: a control's enabled-ness may never depend on a
  value only the animation loop can advance.
- **The ion now also appears in the top view**, end-on in the middle of the
  pore, exactly while the side view has it at the filter — two pictures, one
  event. Pinned by a test that the top view draws more when the ion is at the
  filter plane than when it is nowhere near it.
- **⚠ "The channel is marked +, and potassium is + — why is it not repelled?"**
  A fair question, and the drawing was inviting it. The answer was already
  true and simply not drawn:
  - the sensor charges live in **separate parts at the edges** of the protein,
    nowhere near the passage — the sensors are now drawn as their own bodies
    outside the pore wall in the side view, and as a ring of four out at the
    rim in the top view, where the separation is unmistakable;
  - the passage itself is lined with **oxygens turning a little NEGATIVE
    inward** — now marked in the charge ink (sky) in both views — and that is
    what pulls a cation in and makes shedding a water coat worth it.
  Two new facts say it in words, including the question itself. Rule
  recorded: *if a drawing raises a question, the drawing must answer it.*

675 tests green.
### Step 29b — labels off the drawing, charge in one picture, an ion that leaves

- **Names collided with the structure.** They now sit out at the canvas
  margins on the plain background, each with a thin leader reaching in to the
  part it names — and the **pore** got a name of its own, since that is the
  part the "why is a + ion not repelled" question is really about. Rule
  recorded: a name goes on the background, with a line reaching in.
- **The minus marks were invisible**, and were a second vocabulary besides.
  `drawChargeDot` now draws every charge in the app's ONE picture — the same
  filled disc with a white glyph an ion wears — and `drawIonCharge` is a thin
  wrapper over it. The sensor's four pluses and the filter's four minuses use
  it in both views, in screen space, so a 5 px badge is 5 px whatever the view
  is scaled by.
- **The ion now leaves.** Seen from above it used to sit in the doorway once
  it was through. It now rises OUT of the pore toward the viewer — swelling as
  it comes, the way anything does when it comes at you — and drifts off past
  the frame into the water outside. Pinned: only the ion that gets through
  ever emerges, the swelling never goes backwards, and it makes it all the way
  out.

679 tests green.
### Step 29c — a realistic channel beside the schematic one

The user supplied two published figures and asked for a realistic view
alongside the schematic gate, in the lipid lab's layout. Both were fetched and
LOOKED AT rather than guessed from: the MPINAT KcsA figure (a teepee of pale
ribbon helices, the selectivity filter drawn as sticks, four K⁺ stacked in it,
a sodium turned back below with its water shell) and RCSB PDB-101's Molecule
of the Month 38 (names out on the black background with leader lines, and an
inset looking down the pore at four helices in a pinwheel).

Built: the side panel now draws the real structure — four coiled ribbon
helices leaning into a teepee, the water-filled cavity behind them, the
filter's own carbon and oxygen atoms turning inward, and the tried ion inside
a water shell of real water molecules. The schematic gate sits in a small
amber box in the corner with wide dashed connectors, exactly as the lipid
lab's molecule panel carries its schematic. The top view is now a view of the
MEMBRANE: a field of lipid heads with the channel set into it, its subunits a
pinwheel of helices seen end-on around the pore.

**Departure from both references, ruled by the user before building:** their
atoms are CPK — red oxygens, blue nitrogens — which would put red and sky on
things that are not charges, in the one drawer whose argument is about charge.
Ours keep the app's molecular earth palette. The ion colours needed no such
ruling: the figures' purple K⁺ and yellow Na⁺ are already this app's violet
and gold.

682 tests green.
### Step 29d — the coat named, the labels legible, the protein solid

Three reports, one of which asked for pushback and got it.

- **"Dots around both ions — what do they mean?"** Fair, and the deeper point
  was right: a decoration round an ion referred to nothing the child had ever
  seen, so it lost its logical reference. **Pushed back on removing it**,
  though — the water coat is not decoration, it is the mechanism this whole
  exhibit turns on (the filter's job is to PAY for taking the coat off; with
  no coat there is nothing to pay for and no reason sodium fails). What was
  wrong was that it was anonymous. The coat is now drawn as WATER — the same
  `drawTraveller` molecule the permeability bench fires at a bare wall, at
  true size — inside a dashed outline, with a spoken **"water coat"** name and
  a sentence tying it back to that other drawer. Also recorded: this is the
  second time a hydration shell has been drawn and questioned (the first was
  reverted in 27b), and the lesson both times is the same — **a new visual
  idea must be built from something the child already knows, and named.**
- **Labels invisible, badges too small.** Every spoken label everywhere now
  sits on a dark rounded plate (they were white text over white lipid heads),
  and the top view's charge badges are drawn larger than a lipid head, since
  they are what the "why is a + ion not repelled" question turns on.
- **"So much empty space around the helices — why squeeze through the little
  hole?"** A real misconception the drawing was inviting, and the cause was a
  drawing artefact rather than physics: helices drawn alone leave gaps that
  read as ways through. **Pushed back on the suggested fix** (an electric
  field or aura): that would explain the wrong thing — nothing is repelled
  from the protein, there is simply no space, because a channel is a packed
  mass of protein whose only water is the thread down the pore. So the fix is
  a filled body under the helices — no see-through gaps at all — and lipids
  crowding right up to its edge. An aura would have taught a force that is
  not there; a solid protein teaches the fact that is.
- The view also went from ×4 to ×6, so a true-size ion and its true-size
  waters are legible without any private exaggeration.

684 tests green.
### Step 29e — legibility, and one badge instead of four

- **The protein body fades at its edges** now, in BOTH views. It read as a
  solid disc with a rim; a protein has no rim, it meets the lipids. The side
  view gained the same body behind its helices, for the reason the top view
  did: the gaps BETWEEN helices read as ways through.
- **Charge badges are bigger** on the side view, and **the filter's four
  minuses became one per wall.** The user asked for pushback and got
  agreement instead: what a filter lining carries is a partial negative
  smeared along it — δ− on every carbonyl oxygen — not four discrete charges.
  Four badges implied four countable things; one says "this surface is
  negative", which is both the true claim and the readable one.
- **The right-hand names were cropped, and the test found the cause I had
  missed:** a right-aligned name puts its speaker glyph to the RIGHT of its
  anchor, so a margin measured to the anchor still overflows by the glyph's
  width. Both right-hand names now sit a glyph's width further in, one high
  and one low so they cannot collide, and a test pins every label inside the
  canvas on all four sides.
- **The sentence beside the buttons moved into the info block**, where every
  sentence in this app lives — the buttons carry an icon and a name and
  nothing else.

685 tests green.
### Step 29f — three small corrections that were each a rule

- **The coil's shadow side vanished into the body**, both being the same
  bronze. Fixed by VALUE, not by inventing a second hue: the body is now far
  darker than the darkest turn of a helix, and the shaded side lifted a
  little. Protein stays protein-coloured, which the palette requires.
- **The ion arrived underneath its own charge badges** in the top view. The
  badges are now drawn BEFORE it and moved off the way through, so the ion
  passes over them rather than under.
- **Frames, both ways.** The top view lost its amber frame — an amber dashed
  box claims "this small thing is that big thing", and this panel is a
  different VIEW of the same object, not a magnified piece of one. The side
  view gained the frame it was missing: the little schematic box had a frame
  and the realistic structure had none, so the relation was drawn half-way.
  Rule recorded, and a test pins it in both directions: the side view draws at
  least two frames, the top view draws none beyond its label plates.

687 tests green.
### Step 29g — the realistic channel is a potassium channel too

- **The body is violet now.** The user's question was the right one: this app
  tints every channel with the species it passes, and the realistic structure
  was plain bronze while its own schematic sat beside it in violet — so the
  two registers did not obviously show the same object. The protein's body
  carries the potassium tint, the helices keep protein bronze (so the tint
  reads as "potassium channel", not "made of potassium"), and a test pins both
  that the body is violet and that every helix tone stays lighter than it —
  the value separation that stops a coil's shadow side disappearing.
- **The big frame is bigger**, and the two connectors now run **corner to
  corner** — the inset's two nearest corners to the frame's matching ones, the
  two lines of a magnifier's cone. They used to end at arbitrary points near
  the frame and read as crossed wires.

689 tests green.
### Step 29h — the coat's fate, the exchange, and a story that stays

- **The purple body fades in every direction now.** A linear wash across a
  polygon still ends in hard edges top and bottom; it is a radial fade on an
  ellipse.
- **The account of an attempt is STICKY.** It was rendered only while the
  animation played, so it vanished at the instant a child began reading it —
  the sibling app has had "What just happened" for exactly this reason. The
  verdict is written when the attempt starts and stays until the next attempt
  overwrites it or Reset clears it.
- **The shed waters go somewhere.** They were stripped at the filter and
  disappeared, which breaks this app's oldest rule. They now fall back down
  the way the ion came and rejoin the water in the cell, fading only once they
  are far enough down to be lost among the rest.
- **The exchange is drawn.** The words promised the filter pays for the coat
  and the picture showed nothing being paid; the filter's oxygens now close in
  and brighten as the coat comes off, taking the water's place. The verdict
  text points at it.
- **⚠ Pushback: the water coat stays.** Asked whether it could be removed
  since a child might find it unrelated to what they know. It cannot: the
  filter's selectivity IS the exchange of water for carbonyl oxygens, and
  without the coat the exhibit collapses into "the hole is picky" — the sieve
  misconception this whole drawer exists to kill, and the one the D02 bench
  spent three rounds dismantling. Sodium's failure would have no stated cause
  at all. What was wrong was never the coat's presence but its treatment:
  unnamed, unexplained, vanishing, and trading for nothing visible. All four
  are now fixed, and the coat is drawn as the very water molecule the child
  fires at a wall in the permeability bench.

690 tests green.

### Step 29i — the plus that looked pulled onto a plus, and the string

Four corrections, all from the user's eye.

- **🧲 Membrane charge: the inside face's marks are gone while it is positive.**
  The ions crowding the wall collided with the ± strokes drawn there, which
  read as a plus attracting a plus. It is not a drawing bug so much as a
  duplication: at a positive interior the potassium pressed against the wall
  ARE the plus skin, drawn in the round, and the marks were an abstract second
  copy of the same charge. The inner face is now marked only while it is
  NEGATIVE — charge this picture never draws otherwise. The outer face keeps
  its marks always. `skinFaces()` + test; the describer now says which face is
  drawn which way and why.
- **🚪 Ion channel: the body's purple is back as it was, with a washed edge.**
  Holding it near-solid to the rim flattened the mass round the helices and it
  stopped reading as an aura behind them. Old fall restored, extra shallow
  stops at the rim only, and the violet pushed a little more purple.
- **The helices are strung together.** A subunit is one polypeptide, so it is
  drawn as one: a cytoplasmic linker joining the sensor helix's foot to the
  pore helix's, and — the one that matters — the PORE LOOP arching out of the
  membrane and diving back in to become the filter. Named and voiced in the
  side view, drawn in the top view too. New info paragraph: "the pickiest part
  of the whole machine is just a fold in the string."
- **Sodium is finally visibly the smaller ion.** It always was drawn smaller
  (0.20 nm against 0.28) — at 3.4 px against 4.8, under a charge badge bigger
  than both, in two separate runs. New `IonSizeKey` beside the buttons: both
  ions, bare and coated, true ratio, ×13,889, magnification declared. The
  crossover the exhibit turns on — smaller bare, BIGGER coated — is now a
  thing you can look at rather than a sentence.

691 tests green, typecheck and build clean.

### Step 30 (next) — D15, inside the selectivity filter

Agreed with the user 2026-08-28 (four alignment questions, all recommendations
taken):

- **Its own drawer**, opened by tapping the filter in the channel view —
  spatial navigation, not a page, and it needs a whole canvas.
- **Both ions at once, in two lanes.** "Sodium is smaller yet fails" only
  reads with both present. One swaps its water coat for the filter's carbonyl
  oxygens and goes; the other cannot pay and backs out wearing its coat.
- Carries the energetics the main view can only assert: what the coat costs,
  what the oxygens give back, and why a filter that fits potassium exactly is
  a worse fit for something smaller.

### Step 29j — making the channel view fit, and magnifying the water

All from the user, after 29i put a size key above the panels and pushed them
off the bottom of the drawer.

- **The panels fit again.** `KEY_H` is now subtracted from `CH_H`, and the
  invariant is a test on the SUM rather than on the symptom (see the rule: a
  label-inside-the-canvas test cannot fail on this bug, because a taller
  canvas has more room for labels). Broke it deliberately and watched the new
  guard fail at 858 ≤ 756.
- **Fewer lipids in the top view**, drawn sparser and thinning out with
  distance instead of packed to the frame — the field was spending the panel
  on background and leaving the channel small.
- **The size key is a full-width strip now**, its four specimens spread out
  instead of touching. Numbers and column headings gone at the user's
  instruction; the ×13,889 declaration stays, because a magnification nobody
  writes down is a lie about size. What separates the columns is that one of
  them is wearing water.
- **The water is magnified again inside the key**, in the app's two-frame
  grammar: a small amber frame round one molecule of the coat, a big frame
  beside it, dashed connectors between, and a voiced name — "H2O water". The
  coat's molecules were unexplained decoration until something said what they
  were.
- **The three controls are on the canvas**, as an amber pill floating over the
  side panel — the ⚡ button's grammar from the membrane patch. `WALL_Y`
  carries a band so the drawing starts below them, pinned by a test.

694 tests green, typecheck and build clean.

### Step 29k — the key in one row, and the water big enough to read

- **The size key is one row in two groups**: the two ions on their own, side
  by side — then a gap — then the same two wearing their water, side by side.
  The comparison the exhibit turns on is left-to-right, and a grid hid it.
  Each specimen carries its symbol underneath.
- **The magnified water is big** (×18 on top of the key's own scale) and its
  spoken name is just "water" — the "H2O" was dropped at the user's
  instruction.
- **Both panels fill the drawer.** `CONTENT_H` was measured 56 px more
  cautiously than the drawer's real chrome; it now comes from what the chrome
  actually is, with an 8 px margin.
- **The lipid heads are solid again.** Thinning them out with alpha made them
  look not-quite-there; the density stays reduced, the opacity does not.

694 tests green, typecheck and build clean.

### Step 30 — D15, inside the selectivity filter (built 2026-08-28)

The close-up agreed in 29i's alignment questions. Reached by tapping a
magnifier **on the filter** in D03 — spatial navigation, not a list.

**Both ions at once, in two lanes.** The channel bench can only show them in
sequence, and "the smaller ion is the one that fails" asks a child to hold the
first run in their head while watching the second. Here they run on one clock,
at one ruler, side by side: potassium's coat comes off rung by rung and the
oxygens close in and take the water's place; sodium keeps most of its coat,
the oxygens reach and fall short, and it drops back down and re-dresses.
Nothing is destroyed in either lane — the shed waters fall back the way the
ion came.

**The mechanism is a ledger, not a sieve.** Under each lane, two bars: what the
water coat costs to take off, and what the filter pays back. Real measured
hydration free energies (Na⁺ 365, K⁺ 295 kJ/mol) — note which way round those
are: the SMALLER ion is the expensive one, which is the whole reason the
smaller ion is the one that cannot get through.

**The shortfall is derived, never asserted.** A channel that prefers K⁺ S to
one differs in barrier by exactly RT·ln S — about 18 kJ/mol at body
temperature. `selectivityKJ()` computes it from `SELECTIVITY`, so changing the
selectivity changes the picture, and a test changes the input to prove the
output moves. Drawn at TRUE proportion: the shortfall is a notch of about 5%,
and the exhibit's point is that a notch is a thousandfold.

**Two routes, one verdict.** `paysItsWay()` reaches the same answer from the
ledger that `filterVerdict()` reaches from the fit, and a test pins that they
agree — if they ever diverge, one of the two stories is wrong.

Honesty declared in the block: the "ring is too wide for sodium" account is
most of the truth but not all of it (real filters flex; coordination number and
wobble matter), and the run is about 10⁸× slower than life.

Also this round, at the user's instruction: **Reset removed** from the channel
bench (each button is the way to start over; a control whose only job is to
clear a sentence is furniture), and the channel body's violet replaced with
violet-700 — reasoning the tint out of the schematic gave a plum that read
brown under bronze helices, three times running.

Latent bug fixed while measuring the new canvas: both benches sized their
panels against the raw viewport, but the drawer is capped at 86rem, so on a
wide screen the panels were wider than what holds them.

712 tests green, typecheck and build clean.


### Step 30a — the aura, settled

The colour went bronze-plum → pushed violet → violet-700 across three rounds
of "it is not purple", and the fix was never the hue. Two things, on the
user's ruling:

- **The potassium-derived plum is restored**, `rgb(68, 40, 104)` — the mix of
  the channel's bronze with potassium's blue. Its provenance is the point:
  this app tints every channel with the species it passes, and a purer violet
  reads more obviously as purple while saying less.
- **The same colour AND the same falloff in both views.** The side body faded
  a third of the way out while the top held to two thirds, which is why one
  panel read plum and the other read washed with identical colour. The side
  view now uses the top view's stops exactly. That is what "more purple on the
  left" actually needed.

712 tests green.

### Step 30b — a regression, a magnification, and three things removed

- **⚠ REGRESSION FIXED: sodium had no charge anywhere in the permeability
  bench.** The flying ions are ~4.6 px across, under the badge-legibility
  floor, so the guard correctly silenced their badges — but the TRAY specimen
  is drawn at the same size, so it was silenced there too, and the view never
  said sodium was positive. `drawTraveller` gained `isKey`; a key wears its
  charge whatever its size. Pinned by a test, with a companion test that an
  uncharged traveller gains nothing from being a key.
- **The permeability tank fills the drawer**, measured against the drawer's
  real chrome and its 86 rem cap rather than a cautious viewport estimate —
  the same correction the channel bench got.
- **The lipid's head wears its schematic circle** in the atomic view: a soft
  disc in the head's own colour behind exactly the atoms the schematic circle
  stands for. Derived as the smallest circle holding those atoms, and pinned
  by a test that it holds all of them and none of the tails. Soft-edged and
  head-coloured deliberately — a crisp ring would read as the water coat D03
  and D15 just taught.
- **Removed:** the "how the app draws it" caption under the channel inset (the
  frames and connectors already say it); the amber box around the on-canvas
  buttons in both benches (the buttons carry their own plates now).
- **Removed, with a caveat: the filter close-up's energy bars.** The lanes
  took the height back. See the note below — the numbers are still in the
  describer, but the "a notch is a thousandfold" point is now words only.

715 tests green, typecheck and build clean.

### Step 30c — D15 rebuilt round the gap (⚠ science correction)

The user asked whether the close-up could show the mechanism better, and
suggested bigger ions, a wider channel and charges on the walls. All three
were right. The reason they were right turned out to be a mistake of mine.

**⚠ The first cut put the difference in the wrong place.** The oxygens were
animated to reach further for potassium than for sodium. That is a picture of
a protein that can tell two ions apart and decide — and it cannot. It does
exactly the same thing to both. The cage now closes identically in both lanes
(`CAGE_NM` = potassium's radius plus an oxygen's, one constant, both lanes),
and the difference is what is left over: potassium touches, sodium sits in the
middle with daylight all round it. Two tests pin this — one that the reach is
equal at every moment, one that the gap is zero for potassium and
(r_K − r_Na) for sodium.

**⚠ And the staging said sodium keeps its water.** It does not — it has to
undress to try the site at all; that is exactly why failing is expensive. Both
ions now strip bare, and sodium re-dresses on the way back down. The old test
asserting `coat > 0.4` throughout was encoding the wrong mechanism and has
been replaced with its opposite, with the reasoning written into it.

**The scale is derived from the thing the view exists to show.** The gap is
0.04 nm; at the eyeballed 78 px/nm it was three pixels. `FZ_PX_PER_NM` is now
the largest scale that still fits five rungs vertically and a lane's
half-width horizontally — 300 px/nm in practice, so the gap is 12 px. One
ruler for heights and widths. The test pins the outcome (> 8 px), not the
constant.

**Rung spacing is real** (0.33 nm), the oxygen radius comes from the app's one
atom table (`ATOM_R_NM`, now exported rather than copied), and the pose asks
`siteT(0)` where the first rung is instead of guessing 0.32 — which had been
parking the ion between two sites, held by nothing.

**Part charges on the oxygens**, drawn with the app's one charge badge at
small size, plus a new describer paragraph: why a ring of minus holds a plus,
that it is a PART charge and not a whole one, and that almost-touching is not
good enough — which is sodium's entire problem.

718 tests green, typecheck and build clean.

### Step 30d — two bugs found by looking, and D15 restaged

**⚠ The channel aura: the colour was never being drawn.** Three rounds of "it
is not purple" all changed the hue, and the hue was never the problem. The
body's radial gradient was created around the body's centre and the context
was THEN translated to that centre and squashed before the fill — and a canvas
gradient resolves in user space AT FILL TIME, so its origin ended up twice as
far out as the shape. The ellipse was painted entirely from the transparent
tail. It is one function now (`paintChannelBody`, used by both views) with a
test on the call order. Lesson recorded: when two or three attempts at a
visual fix change nothing, stop changing the value and check the thing is
being drawn at all.

**⚠ The equilibrium bench drew a ratio and called it a count.** Sixty balls
always, split by proportion — so emptying the inside and dropping the outside
to a trace still drew a chamber packed with sixty balls, because "all of it
outside" is the same ratio whether there is a lot or almost none (the user's
report, exactly). One ball is now a fixed 5 mM; a trace gets one ball rather
than none, because nothing may vanish. The old test asserting the set is
always the same size encoded the bug and has been replaced.

  *Noted honestly:* an over-broad edit briefly deleted `radiusOf`, `Crossing`,
  `crossingMs`, `CROSSING_MAX_MS` and `ChamberView` along with the function
  being replaced. They were restored, and `crossingMs`'s real coefficients
  (1600 − 1050·strength) were recovered from the previous production bundle
  rather than left as a reconstruction.

**⚠ D15's mechanism, corrected — the third time and, I believe, right.** The
user asked why the water comes off one ion and not the other if both dressed
ions are the same size. Two things were wrong, one in their reading and one in
mine:

- They are NOT the same size. **Sodium's dressed size is the BIGGER one**
  (0.72 nm against 0.66) even though bare sodium is the smaller ion — a
  smaller ball with the same charge holds more water, harder.
- And my previous fix had over-corrected. Taking the coat off is an
  **EXCHANGE**, not a stripping: a water leaves only when an oxygen arrives
  where that water was. The oxygens close identically in both lanes (that part
  was right). For potassium they arrive at its surface — trade, and through.
  For sodium they stop short, nothing worth trading for arrives, **the coat
  never comes off**, and dressed it cannot enter. So sodium keeps its water,
  for a stated reason rather than by fiat. `swapHappens()` is read by both the
  drawing and the words, so they cannot disagree.

**And the view was restaged to show it.** "I didn't mean to scale things up":
the panel now shows the whole passage — mouth, four rungs, exit — with the ion
small enough to read as something travelling through it. The gap is 7 px at
that scale, so the point is carried by a per-lane **inset**: the app's
two-frame magnification, ×4.2, cropped to the two SURFACES with the daylight
straddling the middle. Touching in one lane, 32 px of daylight in the other.
Two panels, two containers, side by side — the equilibrium bench's layout.

721 tests green, typecheck and build clean.

### Step 30e — the hole removed, three buttons, and the explanation rewritten

- **The pore's dark cavity is gone from the side view.** An attempt to make it
  read as a recess (depth gradient, feathered mouth, a lit near lip) made it
  worse, and the user's call was to remove it outright — rightly. A hole big
  enough to see is a hole big enough to raise "so why is it picky?", which is
  the misconception this drawer exists to dismantle. The body just continues;
  the way through is marked by the filter's atoms and the ion between them.
- **Three buttons, in their own row above the panels:** Send potassium, Send
  sodium, Send both at once. The lanes run independently now (`startedMs` is
  per lane), the panels lost the height the row needed, and a test guards the
  sum — the same lesson the channel bench's size key taught. The "What just
  happened" section describes only the lanes actually watched.
- **The explanation is rewritten for a child, with the mechanism in the
  analogy rather than around it.** MONKEY BARS: you only let go of one bar
  when your other hand has hold of the next, and nobody lets go into thin air
  — which is exactly why the water comes off only when an oxygen has already
  taken hold, and exactly why the swap fails when the next bar is out of
  reach. And a PRICE for the numbers: potassium's coat costs 295 to take off
  and the oxygens hand back 295, even, deal done; sodium's costs 365 and the
  oxygens, not quite reaching, can only hand back 347. An ion makes the swap
  only if it comes out even.

723 tests green, typecheck and build clean.

### Step 30f — ⚠ the channel had the wrong number of helices, and the wrong names

The user checked our cross-section against a textbook and found two helices a
side where the standard figure shows three. Verified: they are right, and it
was worse than a miscount.

**What was wrong.** The classic cross-section cuts through the pore module and
shows, per subunit: the OUTER helix (S5), the short PORE HELIX (P) behind it,
and the INNER helix (S6) lining the way through. We drew two — and named them
wrongly on top: the outer was labelled the voltage sensor (S4, which belongs
to a separate four-helix sensing domain) and the inner was labelled the pore
helix (it is S6).

**Why the missing one matters.** The pore helix is the only one that does NOT
cross the membrane: it runs half way in from the outside and stops, pointing
its C-terminal end at the middle of the pore. That end is slightly negative,
and it is what makes the middle of a greasy wall a place a positive ion can
sit for a moment. Without it there is no account of the water-filled cavity at
all — a mechanism left out of the lesson, not a decoration left off a picture.

**What was done.** Four ribbons a side now: the sensor furthest out, the outer
helix, the pore helix tucked behind and drawn shorter and dimmer because that
is where it is, and the inner helix leaning to the axis. The chain runs
through all of them in the right order — sensor → cytoplasmic linker → outer →
over the top → pore helix → back up as the FILTER → inner → out into the cell.
The top view gets three per subunit too. `HALF_W` widened 3 → 3.7 nm to make
room, which is the more honest number anyway.

**Declared.** A new honesty paragraph says four of the seven segments are
drawn and that the sensor stands in for the whole sensing bundle — S1, S2 and
S3 are not drawn. `HELICES_IN_SECTION = 3` and `PORE_HELIX` are in the model,
with tests pinning the count, the pore-helix teaching, and the declaration.

726 tests green, typecheck and build clean.

### Step 30g — ⚠ the clamped dendrite was the one branch that never lit

Reported by the user: zoom the magnifier into a dendrite, open the spike-train
bench, and the little neuron correctly shows the electrode on that dendrite —
but firing an action potential lights every dendrite except that one.

**Cause, and it is exact.** The electrode is drawn at the ZOOM TARGET's own
point; the glow was drawn at `regionPoints(region)`. Two sets, computed
independently, that never met. The dendrite patch is `DENDRITE_TRUNKS[1]` at
t = 0.3; `regionPoints('dendrites')` is trunks 2, 3 and 4 at t = 0.45. So the
clamped branch was, of all of them, the one guaranteed to stay dark.

**Fix.** `litPoints(region, clampedAt)` derives one set from the other: the
clamped spot goes first, deduplicated against the region's own points, and it
is drawn a shade brighter — it is where the current goes in and where the
trace beside the picture is recorded from. It lights even where the zoom is
not a firing region at all, because the trace is still a recording of that
spot. Four tests; broke it and watched two of them fail.

730 tests green, typecheck and build clean.

### Step 31 — D13, the patch clamp (built 2026-08-28)

Alignment questions first; all four recommendations taken.

**Reached by tapping the electrode.** The probe has been sitting on the little
neuron in the spike-train bench since step 29a with nothing explaining it. It
now carries a small magnifier and opens this drawer — the app answering a
question it raised itself, rather than adding a row to a list.

**What the child does.** Three preset voltages — rest, 0 mV, +40 mV — and
three views: one channel, four with their total, all 5,000. The discovery is
what does NOT change: the step height. Voltage moves how OFTEN the channel is
open, not how big an opening is, and no smooth curve anywhere else in the app
can show that. The test pins the distinction rather than asserting it: the
open probability changes by a much larger factor than the unitary step does
across the same voltage range.

**Numbers, and where they come from.** 12 pS single-channel conductance (real
delayed rectifiers run 10–20); openings averaging 5 ms; the SHUT time derived
from those two and Po rather than invented; the driving force measured against
the cell's own potassium voltage via `nernstMv` (−89 mV). Dwell times are
exponential from a seeded uniform, never `Math.random`.

**The sum is a real sum.** The temptation was to draw the whole-cell line as
N·Po·i with noise sprinkled on — it would have been far cheaper. But the one
claim this exhibit makes is that the smooth line IS thousands of blips added
up, so faking it there would be faking the demonstration. `openTrace` walks
5,000 separately seeded records once per voltage and bins them, memoised. Two
tests hold it honest: the average lands on N·Po·i to within 15%, and a
four-channel trace matches the four records added by hand.

**Also fixed on the way:** `restingCounts()` moved from inside `ionStore` into
`core/ions.ts`, because core code needed the potassium voltage and the only
copy was private to the store. One copy, not two.

751 tests green, typecheck and build clean.

### Step 31a — ⚠ one input, three dendrites

Reported by the user: on the whole-cell view, firing ONE input makes all the
dendrites flash in the little neuron.

**Cause.** Both the incoming ripple and the dendrite glow in `NeuronMapPanel`
iterated over `SYNAPSE_TRUNKS` — every synapse-bearing branch — with no
reference to which inputs the run actually carried. The main canvas already
read `run.inputs` (it is passed to the scene at NeuronStage:989); the
miniature was the one reader that did not.

**Why it matters beyond tidiness.** It is the axon rule one structure earlier
— a fan lighting as a unit says every input arrives whenever any input does.
And it fails a second time: the child had just been offered a choice of one,
two or three inputs, and the picture ignored the choice they made.

**Fix.** `litTrunks(firedInputs)` in `layout.ts`, read by the miniature and
available to the canvas — one function, so the two pictures cannot disagree.
`null` means there is no run to ask about (a dendrite zoom), and then the
whole fan lights, which is honest: that view is about a patch of membrane, not
about which branch was chosen. Five tests; broke it and watched two fail.

756 tests green, typecheck and build clean.

### Step 32 — the contents rail: a second door onto everything

Asked for by the user after step 31: "we have entry points which can only be
discovered by accident". True — the filter's magnifier and the spike bench's
probe are good doors that nobody would find unaided.

**⚠ Conflict raised and ruled, not resolved silently.** `CLAUDE.md` says
*"Spatial navigation, not pages"*, and a table of contents is what that rule
forbids. Put to the user with both sides quoted; the ruling is that picking an
entry **flies the camera to the place first** and opens the exhibit when it
lands. The menu is an index into the world rather than a way around it, so
both rules survive. A test pins the ordering — if a drawer ever opened before
the camera moved, the menu would silently have become a page switcher.

**The registry** (`core/contents.ts`) is the user's lecture course, Parts I–VII,
ENRICHED with what the app teaches that the syllabus does not name (the whole
cell as a place, the guided signal trace), flagged `extra`. Fourteen entries
across Parts I and II; Parts III–VII carry one honest line interpolating
`FRONTIER_SHORT`, because a claim about what the app contains lives in exactly
one place and a menu of greyed-out promises is a second one.

**The rail** (`ui/ContentsRail.tsx`) is the user's own design: a slim
icon-only strip down the left edge, one icon per Part, opening on hover or
click and folding away on release. Open, it lies OVER the column beside it
rather than squeezing it. Each row carries the adult's concept name and the
kid's question underneath — words have audiences, and a menu row is read by
both.

**The route** (`state/contentsNav.ts`) is planned as data (`planFor`) so a test
can check it without a camera or a timer, then run: move, wait `TRAVEL_MS`,
open. Arriving where you already are skips the wait rather than stalling on an
empty flight.

**Caught by a test rather than by eye:** "Change one thing" had a row whose
destination was identical to the resting-potential row's — two ways to do
exactly the same thing. Removed: a menu names places, not gestures.

**Door audit.** Every built exhibit now has at least two entry points: the six
membrane drawers have their column buttons plus the rail; the filter has its
magnifier plus the rail; the patch clamp has the probe plus the rail; the
places and modes have their canvas affordances plus the rail. What is NOT yet
done — and is the honest remainder of this step — is anchoring the six
membrane drawers' second door ON the structure each is about (a magnifier on
the lipids, on the charge skin, on a channel) rather than in a column list.
That is a design change to the membrane canvas and wants its own alignment
round; it is the next thing.

768 tests green, typecheck and build clean.

### Step 32a — one magnifier, one channel, and ions you can watch

- **One magnifier everywhere.** Round, dark plate, amber ring, a lens inside.
  It was a rounded box on the filter and a bare lens on the probe; both now
  call `drawMagnifier`, which is the only copy.
- **⚠ Pushback taken: the pipette is not tinted.** Asked to colour its inside
  red or blue, the honest answer is that a pipette holds neutral salt water,
  and red/blue means CHARGE in this app. The charged compartment in that
  picture is the cytoplasm below the wall, so it gets the membrane-charge
  drawer's own wash — blue at rest, red at +40 mV. Stepping the voltage now
  recolours the cell and speeds the flicker in one move. Ruled with the user.
- **One channel, displayed and reported.** The four-channel and five-thousand
  modes are gone, and with them `openTrace`/`openCount`/`wholeCellPa`. A
  summed trace is a graph about a graph. The "thousands of these add up to the
  smooth curve" idea survives as a sentence in the describer, which is the
  honest form for a claim nothing on screen draws.
- **Ions you can actually watch.** While the door is open, potassium goes
  through it and up the pipette — which is not a metaphor: that is where a
  real recording collects the current. Pure in (voltage, time), seeded, and
  tied to the SAME dwell record the trace is drawn from, with a test pinning
  that every ion in flight left the pore while the door was open. (The first
  version of that test asserted the door was open NOW, which is wrong: an ion
  half way up the pipette left up to a flight-time ago and the door may have
  shut behind it — as it should.)
- **The rig got the room, the trace got a corner.** The trace is kept and kept
  small, explicitly for the adult reading along.
- **Declared:** a drawn ion stands for millions — one opening at +40 mV really
  carries about 9 million potassium ions a second. What is honest about the
  drawn ones is that they move only while the door is open, always go the same
  way, and end up where a real recording collects them.

768 tests green, typecheck and build clean.

### Step 32b — the rail grows instead of spawning a panel

- **One container, animated.** It was a slim rail with a separate panel
  appearing beside it, which read as two things. It is now ONE box whose width
  animates 44 → 320 px: same border, same background, same corners, more of
  it. The thing you hovered is the thing that opened.
- **It floats over the column rather than pushing it.** Left in the flow,
  growing would shove the column and the whole stage sideways every time a
  pointer crossed the edge. The rail keeps its slim width in the layout and
  the growing box is absolutely positioned over it — which is also what the
  user asked for: it covers the column beside it.
- **The icon column is a set of jump links.** Clicking a Part's icon opens the
  menu and scrolls that Part into view — after the growth finishes, or the
  scroll would be measured against a box that is still the wrong width.
- The list's inner width is fixed, so text does not rewrap while the box is
  moving; rewrapping mid-slide reads as jitter.

768 tests green, typecheck and build clean.

### Step 32c — ⚠ the menu's animation was reflowing its own text

Reported by the user: the contents animation causes layout shift, mostly from
text wrapping.

**Cause.** The list had `flex-1` alongside an inline `width`. `flex-1` is
`flex: 1 1 0%`, and it wins — so the list was not a fixed-width panel being
revealed, it was a panel genuinely being resized on every frame of the width
animation, with every paragraph rewrapping as it went. The comment above it
claimed the width was fixed, which it was not.

**Fix, and the general rule.** Animate the container; never let the contents
resize with it. The list is `shrink-0` at a fixed width, the inner flex row
carries the full open width explicitly, and the animating box's
`overflow-hidden` does the revealing. Nothing inside ever changes width, so
nothing inside can reflow. `scrollbar-gutter: stable` closes the same hole one
level down.

768 tests green, typecheck and build clean.

### Step 32d — ⚠ two bugs behind "the steppers don't show the right amount"

Measured first. **The amounts themselves are right**: at rest K⁺ draws 1 ball
outside and 28 inside, Na⁺ 29 and 3, Cl⁻ 22 and 2, and one stepper press
(10 particles) moves exactly two balls. So the counting was fine — what the
eye was seeing was the picture churning around them. Two causes, both
introduced when one ball became a fixed amount in step 32d's predecessor.

**⚠ A shared index space.** Balls were numbered once, outside first: index `i`
was outside if `i < outsideBalls`. Coherent while the set was a fixed sixty
split by ratio; wrong once the count was absolute. Raising the OUTSIDE count
re-labelled which balls were inside — two that had been sitting in the
cytoplasm jumped out through the wall, and two appeared inside from nowhere,
for a change the child made to the outside only. Each side has its own ranks
now, and a test pins that a change to one compartment moves nothing in the
other.

**⚠ Crossings inferred from the wrong thing.** The bench pushed a crossing
whenever `outsideBalls` changed — which, once the child could add ions, meant
it animated balls swimming through the channel that nothing had moved. The app
inventing transport is precisely what this exhibit exists not to do. A
transfer CONSERVES THE TOTAL; if the total moved, the child moved it and
nothing crossed. `Crossing` now carries the rank it left and the rank it
arrives at, so a transfer closes the crowd it left and grows the one it joins.

771 tests green, typecheck and build clean.

### Step 32e — the doors go on the picture

The other half of step 32, agreed with the user: four of the six membrane
exhibits now open from the structure they are about, and the column keeps only
the two that are not places.

- **🫧 bilayer** on the widest stretch of bare wall, **🫗 permeability** on the
  bare stretch furthest from it (so two doors about the same wall are not side
  by side saying different things about the same centimetre of it),
  **🚪 channel structure** on the voltage-gated potassium channel, **🧲 membrane
  charge** below the wall, on the cytoplasm side, where the skin it counts
  actually sits.
- **Positions are derived, never typed.** `patchDoors()` reads the protein
  layout and the camera's magnification, so a magnifier cannot drift off what
  it opens. Tests pin that the bare-wall doors are clear of every protein,
  that the channel door is exactly on a channel, that the charge door is on
  the inside, and that no two doors overlap.
- **⚖️ equilibrium potential and 📈 spike trains stay in the column.** They are
  about a balance and about time; a magnifier on the wall for either would be
  pointing at nothing. The contents rail is their second door.
- **The doors and the menu rows call the same navigator**, so a door and a
  contents row cannot come to mean different things.
- A test now pins the rule the whole exercise was for: **every canvas door has
  a matching entry in the contents.** Two doors each, never one.

778 tests green, typecheck and build clean.

### Step 32f — the doors become a shelf, and the split dissolves

- **The scattered magnifiers are gone.** Pinning each door to the structure it
  opens was the right idea and looked wrong — four markers dotted over a
  picture read as clutter on the picture rather than as a set of things you
  can do with it. They are now ONE ROW in ONE CONTAINER at the bottom left of
  the canvas.
- **All six are in it.** ⚖️ equilibrium potential and 📈 spike trains had been
  held back because they are not places, so a pin for them would have pointed
  at nothing. That argument was entirely about being pinned; a shelf in a
  corner points at nothing by design. The exception was inherited from a
  design that no longer existed, so it went. The column's exhibit list — and
  `DemoPanel` with it — is deleted.
- **Icons and full names come from the one registry** (`DEMOS`), so a door and
  its drawer cannot come to disagree about what a thing is called. The row's
  labels are short (six abreast) but never absent: icons rank, they do not
  name.

776 tests green, typecheck and build clean.

### Step 32i — ⚠ reverted the axon move; the SWITCH was the thing to change

**The axon drawer was wrong and is reverted.** The control the user was unhappy
with was not bare/myelinated/race — that pill is restored exactly as it was,
with its transport, its scrubber and its readout. `AxonBench`,
`axonBenchLayout`, the axon drawer state and the contents routing through it
are all gone; the two contents entries point at the place again.

**What they meant was 🧭 "Signal propagation"** — the three-stepped button in
the column that started a guided tour through a patch, the whole axon and the
whole cell.

**It is a three-view switch on the canvas now.** The destinations were never
the problem; the corridor was. Three sizes of one thing want a knob, not a
route with back, next and auto-advance. Picking a size flies the camera there
and presses what a child would have pressed on arrival — the same code the
tour used, driving the engines that already exist.

- **Lit by the camera, not by memory.** `scaleOfZoom()` reads which of the
  three the camera is actually at, so steering away with any other control
  un-lights it. A remembered "current stop" always eventually claims you are
  somewhere you are not. Three tests.
- **On the canvas, in its own corner.** It moves the camera, and the camera is
  out there — and it is the only control present at every view, so it does not
  belong on a shelf that only exists at a membrane patch.
- **Its words did not follow it.** `scaleAgreement` MEASURES that the three
  sizes describe one event; that section moved into the info block, shown only
  at the three sizes it is about. A measured agreement with no reader is a
  measurement nobody makes.
- `SignalTour` and the tour store's next/back/goTo are deleted.

779 tests green, typecheck and build clean.

### Step 32j — ⚠ white page on the axon: a hook below an early return

Reported by the user: "the whole axon" and the magnifier on the axon turn the
page white.

**Cause.** Step 32i moved the guided tour's measured science into `InfoPanel`,
and the two `useMemo` calls landed BELOW `if (target?.presents === 'axon')
return <AxonInfoPanel />`. Arriving at the axon returned before those hooks
ran, React saw fewer hooks than the previous render, and the tree came down.
White page, on that one view — which is exactly the shape of the report.

**Fix.** The hooks moved above every return, with the reason written beside
them.

**And a guard, because nothing in this project could have caught it.** The
typechecker is happy, the build is happy, and there is no ESLint here.
`src/ui/__hooks.test.ts` reads every component's source through Vite and fails
on a hook call below an early return. Deliberately crude — a real
`react-hooks/rules-of-hooks` pass would be better — but it costs nothing and
catches the shape that actually bit. Broke `InfoPanel` again on purpose and
watched the guard fail before restoring it.

782 tests green, typecheck and build clean.

### Step 32k — one signal, three sizes, as a self-contained exhibit

Third shape for this idea, and the first one that holds together. The user
expected a drawer and got a switch on the start screen; the confusion was
fair, and tracing it back found the real fault.

**The flaw all three shapes shared.** As a guided tour it flew the main camera
and pressed things on arrival. As a canvas switch it did the same driving. In
both, the thing was a REMOTE CONTROL for the scene — which is exactly why it
could not be put in a drawer: a drawer would cover what it was controlling.

**So it stopped being a remote control.** `ScalesBench` draws all three views
itself, from one clock, and never touches the main scene. The "a drawer covers
the world" objection does not arise, because there is nothing behind it that
needs seeing. The main canvas has no switch on it at all.

- **The patch** is drawn from the same lipids, the same gate and the same
  charge wash every membrane view uses, with the sodium and potassium gates
  opening off the real trajectory and the voltage read out above them.
- **The axon** is `drawRibbon` — literally the propagation view's own picture.
- **The whole cell** is `drawNeuronInset` — the same little neuron the spike
  bench and the column's map draw.
- **Switching size does not restart the run.** The clock is kept, because the
  claim is that these are one event seen three ways; a switch that reset it
  would be saying they are three.
- `scaleAgreement`'s measured agreement lives in the exhibit's own describer,
  where it belongs.
- `ScaleSwitch`, the InfoPanel section it needed, `scaleOfZoom` and the
  navigator's `tour` side-effect are all deleted. The contents row is now an
  ordinary drawer route.

786 tests green, typecheck and build clean.

### Step 32l — the right edge, properly this time

**⚠ The fix reported in 32h never landed.** Two of its three edits were
string replacements that did not match and failed silently — the page's
`max-w`/padding and the rail's width were both untouched, so nothing about the
overflow had actually changed. Reported as done, and it was not. Every edit
here now carries an assert.

**And the fix itself was wrong anyway.** `max-w-[1440px]` with a right padding
looks like it guarantees a gap and does not: every child in that row is
`shrink-0`, so once the viewport is a little under the cap they overflow
straight through the padding rather than being held back by it. Padding does
not defend a row of unshrinkable things.

**What it is now:** the row is `w-fit` and centred rather than capped, so above
its natural width it sits between two real margins. The terms were trimmed to
keep that width low — rail 44 → 40, column 300 → 264, gaps 12 → 8 — and the
sum is written beside the layout: 12 + 40 + 8 + 264 + 8 + 1062 + 20 = 1414.

Below 1414 css px a fixed 1060 px canvas plus a column cannot fit, and no
padding can change that; it is a property of the canvas. If narrow screens
matter, the stage's fixed width is the thing to revisit.

786 tests green, typecheck and build clean.

### Step 32m — the three sizes use the app's own pictures

The user: "do not re-invent 'trace one signal', use existing visualisations."
Right, and the fault was exactly the one the rules already name — the exhibit
had hand-composed a membrane out of lipids and gates, and used the little
column map for the whole cell. Two fresh drawings of things this app already
draws.

- **The close view is the axon-membrane zoom** and **the wide view is the home
  screen**, both by calling `drawScene` at the real camera for that target.
  The axon keeps `drawRibbon`, which is what the propagation view puts there —
  that one was already right and is untouched.
- **The camera moved into `stage/camera.ts`** (`FIT`, `cameraFor`, `viewRect`,
  `Camera`), lifted out of `NeuronStage` because a second caller appeared and
  a second copy of that arithmetic would be a second thing to keep true.
- **Drawn at the scene's own 1060×STAGE_H and scaled down by CSS**, so each of
  the three is literally that view's picture rather than a smaller redraw of
  it. The exhibit adds no names of its own: the scene names its own parts.
- **⚠ `strictCanvas` had no `getTransform`**, so the real scene function threw
  on a stand-in where a browser is perfectly happy — a stand-in must fail
  where the real thing fails, and a missing method is not strictness. It
  tracks a transform now, following scale and rotation, which is what
  `drawScene` reads it for.

788 tests green, typecheck and build clean.

### Step 33 — D04, the gating families (built 2026-08-28)

Alignment questions first; all three recommendations taken — three families,
Pₒ as both a live bar and an accumulating curve, and one dial per family.

**The lesson is the deafness.** The app has been saying "voltage-gated" and
"ligand-gated" since milestone 1 as if the words explained themselves. Three
doors side by side, each with its OWN dial, and turning one leaves the other
two completely unmoved — that is what "gated" means, and no single channel can
show it. `respondsTo()` states it and a test pins it, because a bench where
every lane quietly answered every dial would look fine and teach the opposite.

**Three real laws.** A Boltzmann in voltage (half open at +10 mV), a Hill curve
in messenger with TWO molecules needed (half open at 50 µM — a nicotinic
receptor's figure, and the 2 is why the curve hangs back and then goes), and a
Boltzmann in membrane push (half open near 30 mmHg, a Piezo channel's
ballpark). A test checks each step of each dial actually moves the odds — a
result that does not change when the input changes is a broken parameter.

**Pₒ is measured, never read off the law.** The bar under each door fills as
the run goes, gold for time open and dark for time shut, from that record's own
dwells. It lands a few points away from the curve, and that disagreement is
kept: it is what tells a child the number is a measurement. Each completed run
drops a dot on the family's own curve, so the classic sigmoid gets built from
readings rather than drawn as a claim.

**One flicker generator, not four.** `dwellsFor(seed, po, tau, window)` was
lifted out of the patch clamp — a channel is a two-state door whatever opens
it, and the families differ only in what sets the odds.

Reached from the membrane shelf (🎛️ What opens it) and from the contents,
Part II lecture 3.

**⚠ And a process failure, fixed.** Two earlier rounds this session reported
work that had silently no-opped: the page-width fix and the whole patch-clamp
shelf-door round were written with unasserted string replacements that did not
match. Both are now actually applied, every edit in this step asserted on its
match and verified by reading the file back, and the lesson is in the rules.

809 tests green, typecheck and build clean.

### Step 33a — D04 rebuilt, and two layout fixes

**⚠ The gating bench was not kid-friendly and has been redone entirely** (user,
2026-08-28, with a reference figure). What was wrong was not the science but
the shape: three lanes of dials, records, bars and curves — an instrument
panel, when what the lesson needs is four doors and something visibly opening
them.

- **Four containers side by side**, the equilibrium bench's grammar and the
  reference figure's: leak, voltage-gated, ligand-gated, mechanically-gated.
- **The leak is new and it is the point.** No gate, no button, no dial — the
  control case the other three are read against, and the reason the word
  "gated" means anything.
- **Colour-coded.** Each family wears an ion colour the app already uses, so
  four doors are told apart at a glance rather than by reading four labels.
- **The causes are applied PHYSICALLY**, which was the heart of the note: the
  charge flashes across the wall with the ± marks flaring on both faces; a
  messenger molecule flies in and lands in the receptor's mouth and glows
  while it is bound; a finger presses the wall and the bilayer DIMPLES under
  it. Ions cross only while a door is open — always, for the leak.
- **A poke is a moment, not a setting**: the cause arrives, works and leaves,
  and everything drawn is a pure function of how long ago it began.

**Two layout fixes:**
- The exhibit shelf had reached eight chips and was running under the voltage
  panel at the bottom right of the membrane view. It is two columns now,
  bottom left, clear of it.
- The three-sizes exhibit was cropped at the bottom: it scaled the scene to
  the available WIDTH alone, and once the control row has taken its share the
  height is the binding constraint. Fit is the smaller of the two ratios.

809 tests green, typecheck and build clean.

### Step 33b — the reference figure, actually read

**⚠ First, a correction.** Step 33a's comments said the four panels followed
"the reference figure". They did not: the URL was never fetched (it returns
403), and the layout was inferred from the filename and from textbook figures
in general. The user supplied the image directly, and two things came out of
actually looking at it.

- **⚠ Colour means SPECIES, not family.** The figure colours its channels by
  ION — magenta for potassium, blue for sodium — so its two sodium channels
  share a colour and are told apart by their CAUSE. That is exactly this app's
  own standing rule, which step 33a had broken by giving each family its own
  tint. Fixed: leak wears potassium's colour, voltage-gated and ligand-gated
  both wear sodium's, and the mechanical one wears calcium's. A test pins that
  the two sodium doors match.
- **The shapes were already right.** `drawGatedChannel` is the figure's
  silhouette — one body with a concave waist, flared at both faces, with a
  pore that opens down the middle. Nothing to copy, and nothing worth
  diverging for.
- **What WAS worth copying:** the ± marks on the two faces, drawn on every
  panel (a membrane is charged whether or not anybody is pushing on it) and
  swapping over only where the voltage cause is applied; the extracellular and
  intracellular labels; and the arrow through the pore showing which way the
  ion goes — up for potassium leaving, down for sodium and calcium coming in.
  The drawn ions now follow that direction too, which they did not before.
- **Renamed** to **Ion channel types**, from "What opens a door".

**⚠ Noted for the user:** the figure's fourth type is SIGNAL-GATED — an
intracellular messenger binding from the cytoplasmic side — not the
mechanically-gated channel this bench has. Mechanical was what was asked for
earlier and it is what explains touch and hearing, so it stays; signal-gated
is a fifth panel if wanted.

Also this round: the action potential is colour-coded in the voltage graph,
shaded between the trace and the resting line — red where the inside has gone
positive, blue where it dips below — using the same translucent reds the
spike-train bench bands with.

809 tests green, typecheck and build clean.

### Step 33c — the channel silhouette, actually copied

**⚠ The shapes were not close, and the user was right.** Ours was ONE outline
with a slot cut in it; the figure's is TWO facing lobed subunits with a real
gap between them. That is not a cosmetic difference — a channel really is
several separate protein subunits standing in a ring, and the gap between them
really is the way through. A bead with a hole drilled in it teaches the wrong
object.

Rebuilt in `drawGatedChannel`, so EVERY channel in the app changes together —
one biology, one drawing:

- **Two closed bezier paths**, mirrored. Each subunit is wide at both mouths,
  pinched at the waist where the membrane's greasy middle squeezes it, with
  rounded caps (stroked in its own paint with a round join).
- **Opening widens the GAP.** The subunits never move apart: the protein does
  not fly apart, only its pore changes. A test pins that the shape's structure
  is identical open and shut.
- **A ball on a chain**, optional and off by default, hanging into the
  cytoplasm — the piece that swings up and plugs the channel's own pore, which
  is inactivation. Switched on for the voltage-gated panel only, because only
  some channels have one and drawing it on all of them would be a lie about
  the rest.

**⚠ And it exposed a second canvas stand-in.** `axonRibbon.test.ts` carried its
own permissive recorder with no `bezierCurveTo`, so those tests threw the
moment the silhouette used beziers — on a context a browser is perfectly happy
with, while `strictCanvas` had supported them all along. Exactly the cost the
"one stand-in, and it must fail where the real thing fails" rule names. The
local recorder is deleted.

812 tests green, typecheck and build clean.

### Step 33d — mechanics only, and a plug that plugs

- **The open-probability bar is gone**, and the stochastic flicker with it. The
  patch clamp is the exhibit about how OFTEN; two exhibits answering the same
  question is one too many. This one is now purely mechanics: cause applied →
  door opens → holds open → shuts → ready to be applied again, on a
  deterministic clock, with a test that it never jumps between shut and open.
- **The inactivation ball plugs the pore.** It hung in the cytoplasm looking
  decorative while the gate shut on its own — a picture of nothing. It swings
  up and SEATS in the intracellular mouth now, with a rim where it meets the
  pore, and it arrives BEFORE the gate is shut, because the plug is what does
  the shutting. Pinned by a test.
- **Binding is a puzzle.** A socket is cut into the ligand-gated channel's
  extracellular mouth, and the messenger is the piece that fits it — drawn at
  the socket's own coordinates, so the piece cannot land beside its hole.
- **The four containers stretch to the bottom of the page**, their heights
  measured from the drawer's own height rather than fixed.

815 tests green, typecheck and build clean.

### Step 33e — the sensor is the cause, and the messenger stays put

The user supplied a full handover for the reference figure, and reading it
corrected a mistake of mine.

**⚠ The ball on the stalk is the VOLTAGE SENSOR, not an inactivation ball.**
The handover lists the voltage-gated column as having two separate features: a
GATE (a hook-like intracellular flap across the pore) and a VOLTAGE SENSOR (a
small circular domain on a stalk below). I had taken the ball for a plug and
animated it blocking the pore. It is S4 — it carries the four positive charges
this app already draws on every voltage-gated channel — and it moves with the
field, which is exactly the mechanic the user asked for: *"the ball gets pulled
in by the opposite charge; when the charge changes it is no longer attracted
and falls down."* That request was more correct than what I had built.

- The sensor now carries the app's own **plus badge**, is held down against a
  negative inside, is pushed up when the inside goes positive, and **its rising
  is what swings the gate** — a separate hook that lies across the pore when
  shut and folds clear when open. The sensor LEADS the gate in both
  directions; a test pins that it is fully up while the gate has barely moved,
  and fully down while the gate is still closing.
- **The messenger stays seated** for as long as the door is open and leaves
  only once it has shut behind it. A ligand that faded mid-run would be saying
  the door is held open by nothing.
- The charge badge is placed by the CALLER: `particleStyle` imports from
  `bilayer`, so the drawing cannot reach for the badge without an import cycle,
  and a second copy would break the one-way-to-draw-charge rule. `sensorAt()`
  returns the position.

**Taken from the handover:** the gate-and-sensor split, the sensor on its
stalk, the region labels, the transport arrow reaching well beyond the
membrane, and the animate-by-morphing note (which is what the exhibit already
does — its own closing line sanctions animating rather than drawing twin
states).

**Not taken, and why:** the membrane's pixel dimensions (ours are derived from
measured biology and must stay so); the four-column static closed→arrow→open
layout (we animate, which the handover itself prefers); per-column silhouettes
(one channel drawing, everywhere — the differences the handover draws are
smaller than the rule is worth); and the SIGNAL-GATED fourth column, since the
user asked earlier for mechanically-gated and its push animation. Signal-gated
remains available as a fifth panel.

817 tests green, typecheck and build clean.

### Step 33f — running with no internet

Asked for by the user. Checked first, and the app was already most of the way
there: nothing reaches the network at runtime. The photographs are bundled in
`public/real/`, Tailwind is compiled into the bundle, there are no web fonts
and no CDN scripts. The `https://` links in `core/realPhotos.ts` are CREDITS —
required by the licences — not sources anything loads from.

**What actually blocked it was the build's base path.** It built with an
absolute `/neuro-playground/`, the one path GitHub Pages serves it from, so a
copy of `dist/` anywhere else 404s on every script, stylesheet and photograph.
It is `./` now: assets resolve against `index.html` itself, so one build works
on Pages, in a folder, and behind any local server.

- `npm run offline` builds and serves at 127.0.0.1:4173, using only packages
  already in `node_modules`. Verified by serving the build and fetching the
  page, the bundle and a photograph — all 200.
- `src/__offline.test.ts` fails if a `fetch`, an `XMLHttpRequest` or a
  remotely-loaded asset ever appears in the source, and knows the difference
  between citing a URL and loading one. Broke it on purpose and watched it
  fail.
- README gained a section on taking it somewhere with no connection, including
  the one thing that will NOT work — double-clicking `dist/index.html`, because
  browsers block ES modules over `file://` — and the caveat that some browsers'
  extra speech voices are cloud-based while installed ones are not.

821 tests green, typecheck and build clean.

### Step 33g — the leak channel, traced

The user supplied an SVG of a leak channel and asked for its shape, in the
app's colours.

**⚠ And it settles something.** Drawing a leak and a voltage-gated channel with
one silhouette was making the app say they are the same object with different
labels. They are not: a leak has no gate, no sensor and no binding site, and
the drawing shows it — three subunits shoulder to shoulder, the back one
visible between the two in front, and a way through that is simply always
there. That refines the "one biology, one drawing" rule rather than breaking
it: ONE drawing per THING, not one drawing for a category. Two proteins that
differ may look different; the same protein in two views may not.

- **`svgPath.ts`** turns path data into canvas calls — M/m, L/l, H/h, V/v,
  C/c, Z/z — and THROWS on anything else, because a path that quietly loses a
  curve looks almost right, which is the worst failure a copy can have. Pure,
  so a test walks it: the shorthand where a minus sign is the separator, the
  extra pairs after a move that are LINES rather than moves, and returning to
  the subpath start after a close.
- **`leakChannel.ts`** holds the three traced paths, parses them once, and
  fits them by HEIGHT so the shape straddles whatever wall it is put in — its
  width then being whatever the drawing says rather than something chosen. The
  back subunit is painted darker, which is what makes it read as behind rather
  than as a third post in a row.
- **Colours follow the app's convention**: the body is the channel bronze
  mixed toward the ION IT PASSES, so the leak wears potassium's violet, with
  the species colour as its rim.
- The bilayer's gap is now cut to fit the protein going into it, since the
  traced shape is wider than the drawn gate and a fixed gap left lipids
  standing inside it.

833 tests green, typecheck and build clean.

### Step 33h — the ligand-gated channel, traced in three states

The user supplied an SVG showing it CLOSED, OPEN and INACTIVE, and asked for
the moving parts to be recreated for smooth animation — "do not teleport".

**The parts move; they are not swapped.** The source gives each moving part
twice, in its end positions, and swapping one path for another is a cut rather
than a movement. Measured off the two drawn positions instead:

- **The flap** is the same traced shape at two angles — 168° from its hinge
  when closed, 102° when open — so it ROTATES through 66° and reaches every
  position between.
- **The ball** rides an arc from where it hangs to where it seats, both read
  off the drawing, bowing OUT AND ROUND because a straight line between them
  would cut through the channel's own foot. The **chain is redrawn every
  frame** to follow it, so it is attached at both ends the whole way — which a
  swapped pair of drawn chains cannot promise.
- Two tests pin it: no fiftieth of the journey may be a leap, and the arc must
  pass outside the straight line.

**The third state is the third leg of the poke:** the ball swings in WHILE THE
DOOR IS STILL OPEN, holds, and leaves before the next go — so it reads as the
cause of the door stopping rather than as a decoration that follows it.

**⚠ The parser threw, and that was the design working.** The flap's path
contains a `q`, which `svgPath` did not support, so it refused rather than
skipping the command — and the suite total dropped from 833 to 820 while still
reporting FAIL 0, which is exactly why the total is what gets watched. Quadratic
support added; back to 833, then 837 with the new tests.

**⚠ Science note, recorded not buried:** a ball on a tether plugging its own
pore is VOLTAGE-gated behaviour. A ligand-gated receptor stops conducting by
desensitising — the protein settling into a non-conducting shape while the
messenger is still bound. The three states are right either way; it is the
tethered ball that belongs to the other family. Drawn as supplied, and it can
move to the voltage panel on a word.

837 tests green, typecheck and build clean.

### Step 33i — ⚠ the traced channel is VOLTAGE-gated, and the ball is an inactivation ball

The user corrected the label: the SVG traced in 33h is the voltage-gated
channel, not the ligand-gated one. That is the same way round as the science
note filed with it — a tethered ball plugging its own pore is voltage-gated
behaviour — so the artwork simply moved to the panel it belongs to.

**And it corrects something bigger.** Two rounds earlier this app read a
ball-on-a-stalk in a different figure as the S4 VOLTAGE SENSOR and animated it
being pushed by the field. The traced drawing settles it: in the third state
the ball has moved INTO THE PORE, and a sensor does not plug the channel it
senses for. The lesson recorded: **when two sources disagree about what a part
is, the one that shows the part MOVING wins — behaviour identifies a part, a
label does not.**

- The traced protein, flap and ball are the VOLTAGE panel's now; the
  ligand-gated panel goes back to the drawn gate with its binding socket and
  its puzzle-piece messenger.
- **The invented sensor is gone** — `sensorUpAt`, `sensorAt`, and the
  `sensor`/`sensorUp`/`gate` options on the shared `drawGatedChannel`. Dead
  options on a shared drawing are worse than dead code, because the next
  caller reaches for them. A test asserts that asking for them draws nothing.
- **A real Nav channel has both a sensor and a ball**, and this drawing shows
  only the ball. So the honesty note now declares the missing sensor rather
  than the app inventing one, and the cause on screen is the charge itself
  flipping across the wall — which is what a sensor would be answering to.
- The describer names INACTIVATION, and says what it is for: why a nerve fires
  a quick spike instead of staying on.

836 tests green (49 files), typecheck and build clean.

### Step 33j — the ligand-gated channel, traced: the subunits come apart

The user replaced the file with the real ligand-gated drawing — two states this
time, closed and open.

**Its mechanism is a different one, and that is why it earns a second traced
drawing.** Nothing swings and nothing plugs: the SUBUNITS THEMSELVES MOVE
APART. Measured off the two states rather than eyeballed — the front subunits
separate by exactly 8 units and the back one stretches by the same 8 to stay
behind the gap they leave. A single silhouette with a single animation would
have said the four doors differ only in which button you press, which is the
opposite of what the bench is for.

**⚠ One deliberate departure, recorded.** The artist anchored the RIGHT subunit
and moved the left one 8 units away. Animated literally, the whole protein
appears to slide leftwards across the membrane. The same 8 units are split
either side here, so the pore opens about its own axis; the end geometry is the
drawing's up to a rigid shift.

- **The binding socket is cut into a subunit that SLIDES**, so it travels as
  the channel opens — and the messenger asks the channel where its seat is
  rather than computing it a second time. A messenger that stayed put while its
  own site slid out from under it would be the same fault as landing beside the
  hole. Three tests: the socket moves outward, it moves smoothly, and the
  separation is the measured 8.
- **The generic gate's `socket` option is gone**, as `sensor`/`gate` went
  before it. Dead options on a shared drawing are worse than dead code: the
  next caller reaches for them.
- The describer now says how this one opens, in a child's words: "the pieces of
  the door itself lean apart and leave a gap."

839 tests green (49 files), typecheck and build clean.

### Step 33k — the mechanically-gated channel, traced, and a wall that bends

The user supplied `mechanically-gated.svg` and asked for the push to be
visualised **with slight membrane curving**.

**The drawing's motion turned out to be the ligand channel's motion.** Measured
off its two states, not assumed: the front subunits separate by the same 8
units, and the back one stretches by the same 8. But its **silhouette is its
own** — flared shoulders and splayed feet where the ligand-gated one has a
notch and a straight foot.

- **So the motion was lifted out, not copied.** `separatingChannel.ts` holds the
  arithmetic once — the split-either-side separation, the back subunit's
  stretch, the fitting, the paint — and `ligandChannel.ts` and the new
  `mechanicalChannel.ts` are now thin sets of outlines over it. A third private
  copy of that arithmetic would have been a third thing to keep true, and the
  first to drift would have been the one nobody was looking at. Two doors that
  open alike can still be two different doors: a test asserts the two
  silhouettes are *not* interchangeable.
- **⚠ A push bends a sheet; it does not move it.** The old mechanical panel slid
  the whole wall down by a `dimple` — a membrane on a lift, which says nothing
  about why the door opens. `membraneBend(strength)` now returns a raised-cosine
  sag: full depth under the finger, dead flat where it meets the undisturbed
  wall, and no crease at the join. The lipids ride it through `drawLipids`'
  existing `waveAt`/`slopeAt`, so each molecule stands square to a sagging
  surface. What opens the channel is now visible in the picture: the sheet is
  **stretched**, and the stretch pulls the subunits apart.
- **The fingertip and the surface are read off the same bend**, so the finger
  never presses on air, and the ± face charges sag with the faces they are on.
- **`strictCanvas` now records path vertices in DEVICE coordinates** (`points`).
  A list of method names cannot answer "did it move or did it jump", and a part
  that moves by having the context translated under it looks perfectly still in
  its own local frame. Broke the slide into `Math.round(open)` and watched the
  no-teleport test fail before restoring it.
- The bend's slope is checked against its **own difference quotient** rather than
  asserted — a slope that had drifted from the curve would tilt every lipid on a
  surface that still looked right, which is the kind of fault nobody finds by
  looking. Its steepest point is measured across the whole bend, not sampled at
  a lucky x.

850 tests green (50 files), typecheck and build clean.

### Step 33l — four colours honestly, and the chain that opens a spike door

A corrections round on **Ion channel types**, two items of which contradicted
standing rules and were put back to the user before anything was written.

**⚠ Conflict 1 — colour.** The user asked for the ligand- and voltage-gated
doors to be different colours. The standing rule, from the user's own
2026-08-28 correction, is *colour means SPECIES, never category* — and both
were sodium, so both were yellow. The messenger arriving to open the ligand one
was **also** a sodium ion, so three things on that panel were one yellow.
Resolved without bending the rule: **the ligand panel's EXEMPLAR changed.**
"Ligand-gated" is a family, not a channel, and its members pass different ions.
It is now a **GABA-A receptor**, which really does pass chloride — so it is
green *because of what goes through it*, exactly like the other three. The four
doors are now purple (K⁺), yellow (Na⁺), green (Cl⁻) and pink (Ca²⁺): all
different, no rule bent. The calibrated Hill figures moved with the exemplar
(50 µM nicotinic → 10 µM GABA-A); swapping the receptor without swapping its
numbers would have left the app quoting one receptor under another's name.

**⚠ Conflict 2 — the ball.** The user asked to validate whether the ball and
plug react to the charge change, having earlier asked for "the ball gets pulled
into the channel by the opposite charge". They do not. The inactivation ball is
Nav's hydrophobic IFM motif; it carries no useful charge and its receptor site
is buried until the gate opens. Inactivation borrows its entire voltage
dependence from activation. Put to the user, who chose the real mechanism — so
the panel now draws the **missing middle step**, which is also the only
charge-driven one:

> charge flips → the **S4 sensor**, covered in plus charges, is *repelled*
> outward → the sensor drags the gate open → **only now** does a seat exist →
> the ball drops into it

The sensor is not in the traced drawing and was added deliberately: leaving it
out was not neutrality, it left the flap swinging for no visible reason and
invited the wrong answer. `gateOpennessAt` was pushed later so a visible pause
separates sensor from gate — overlapping, they read as one event. `seatOpenAt`
draws the landing site appearing, so *why the ball waits* is on the screen.

- **The flash is white-hot at its core, yellow at its rim.** Pure yellow, as
  asked, is sodium's colour on a sodium door.
- **The messenger is no longer drawn as an ion**, because it is not one — GABA
  is a small organic molecule. Its own colour (orange, belonging to no species
  in this app), a lumpy three-lobed outline, and no charge badge.
- **The hole in the wall is gone.** The two separating channels cut their
  *fully-open* width out of the bilayer and then sat shut inside it. They now
  cut the **shut** width and shove the neighbouring lipids aside as they widen,
  with the shove spread over three molecule spacings — measured, because a
  one-spacing reach moves the first molecule 2 px and its neighbour not at all,
  piling two heads together.
- **Every word is off the canvas.** The `open`/`shut` caption went (the picture
  already says it) and the three spoken labels moved into the heading, where a
  `SpeakButton` now sits in front of each panel's title.
- **⚠ A test that passed on the bug.** The first hole test only asked whether
  any lipid vertex fell in the band that used to be bare — and passed with the
  bug restored, because the band caught the first molecule beyond the too-wide
  gap. The fault was in *which number gets cut*, so `wallGapAt` was exported and
  the number pinned. Reverted the fix again and watched it fail properly.

858 tests green (50 files), typecheck and build clean.

### Step 33m — one channel language, everywhere

The traced drawings had reached the gating bench and nowhere else, so the app
was showing two visual languages for one object. This finished the sweep.

**The flash is a flash, not a picture of one.** The voltage panel's cause was a
lightning-bolt zig-zag — a *symbol* for electricity drawn on the canvas. The
app already has exactly one way of saying "the signal is here": the yellow
bloom the axon views use (`SIGNAL_RGB`, near-white core). It now uses that,
arriving at the **top of the panel** and washing down onto the wall, so the
signal reads as having come from somewhere else rather than being made here by
the button. *Noted for the user: a real depolarisation arrives sideways along
the wall from the neighbouring patch, not from the extracellular side — the top
entry is the requested symbolic reading.*

**The plug wears the body's outline.** It was the only piece of that protein
drawn without the species rim, which made it read as a separate object that had
drifted up against the pore.

**Every generic channel replaced, and four judgement calls put to the user
first** — three of which were mistakes to convert as asked:

| site | was | now |
| --- | --- | --- |
| permeability bench | generic shape, `open: 0.45` | **its own aquaporin** |
| channel view inset | generic shape | traced leak, K⁺ purple |
| patch clamp | generic shape | traced voltage-gated, purple, **no ball** |
| whole axon (8 px) | generic shape | traced, Na⁺ with ball, K⁺ without |
| axon close-up | generic shape | traced, same rule |
| balance bench | generic gated door | traced **leak**, present only when open |

- **⚠ The aquaporin was not an ion channel and was being drawn as one**, held
  permanently half-open. It now has its own protein: an **hourglass with a
  waist**, no gate, and the two half-helices that meet at the constriction. The
  pinch *is* the selectivity — it is why water crosses in single file and why a
  hydrated sodium ion cannot follow. A parallel-sided pore deleted the
  mechanism.
- **⚠ Not every voltage-gated channel inactivates.** The patch clamp's own
  model is two-state with no inactivation anywhere in it, and an axonal delayed
  rectifier repolarises the spike precisely by *staying* open. A ball on those
  would be a mechanism the record directly underneath visibly never performs.
  `ball` is now an option on the traced drawing, and the seat goes with it.
- **⚠ The balance bench's door had no cause**, and the app's own rule is that
  no button opens a channel directly. What its toggle actually varies is
  whether the membrane is *permeable* to that ion — so it is a leak channel,
  drawn only when the ion has one, and the wall is cut only where something is
  standing in it. **Its button still reads "open the door" / "close the door"
  and probably wants to say "add a channel" / "take it out"** — left for the
  user to decide.
- **The generic drawing is deleted.** Once every caller had moved, it was left
  with no user but its own test — and a shared drawing that accepts anything is
  what the next caller reaches for. Its three tests went with it rather than
  standing guard over a shape nothing renders.

864 tests green (51 files), typecheck and build clean.

### Step 33n — a run slow enough to have a chain in it

The voltage panel had still not answered the child's question, asked twice:
*what makes the ball swing?*

**The honest answer, and the two halves of it.** The **flap** — the "leg" on the
right of the body — *is* the charge's doing: the ⊕-marked sensor is shoved
outward by the positive inside and drags it open. The **ball** is not. It is
the IFM motif, three greasy amino acids with no useful charge, and it can only
stick once the flap opens and uncovers a pocket shaped to hold it.

- **⚠ The ball now JOSTLES on its tether from the very first frame**, before
  the flash, before anything — and goes still the moment it seats. Drawn still,
  its sudden move looked *caused*, and the only cause on the panel is the
  charge, so the charge is what a child concluded. Jostling, the picture
  answers the question itself: it was bumping around the whole time and there
  was nowhere to hold on. No charge label on it — that would have made ⊕ mean
  two different things on one panel.
- **The flap wears the body's yellow outline** (this is what the previous round
  got wrong — it was put on the ball). It had been stroked deep-dark as a piece
  drawn *behind* the protein, which made the one part that actually swings the
  hardest thing on the panel to see moving.
- **`POKE_MS` 3.6 s → 6 s, with measured pauses.** Flash and depolarisation
  share one ramp — the flash *is* the depolarisation arriving, and a gap
  between them would invent a delay. Every other link gets a real gap, pinned
  in **milliseconds** rather than fractions: a fraction of a run whose length
  changes is not a pause anybody can see. The ligand messenger now travels for
  the whole of its arrival instead of covering the distance in the first third
  and hovering by the socket.
- **The flash is round, like a torch shone on the door.** A band across the top
  lit everything equally and so pointed at nothing.
- **⚠ The ± marks are on the voltage panel only**, reversing an earlier
  decision of mine. The reason for that decision is still true — every membrane
  is charged — so the point it gives up is now made in words: the info block
  says outright that all four walls are charged and only one door cares. Both
  halves are tested.
- **The leak's line was a sentence you had to unpick backwards** ("Opens when
  never — it has no gate, so it is always open"). `opensLine` now replaces the
  whole sentence where the template fights the meaning, instead of contorting a
  phrase to slot into it.
- **The selectivity filter's buttons draw sodium smaller than potassium**,
  scaled by real **bare** radii — the one exhibit where ion size *is* the
  subject, and its whole answer is that bare sodium is the smaller one and
  still cannot get through. Everywhere else a key stays a same-size specimen,
  because hydrated the order reverses and the two must never be muddled.

872 tests green (51 files), typecheck and build clean.

### Step 33o — red where the charge is positive, and a flap you can see

**1. The patch clamp's red.** The user expected red for a positive inside and
was only seeing blue for a negative one. **The expectation is right and the app
already agreed with it** — `chargeRamp` has been red-for-positive since it was
written, and the neuron scene and the spike graph both read off it. What was
wrong was the STRENGTH. This clamp's steps are −72, 0 and +40 mV, and the
wash's alpha is proportional to how far from zero the membrane is, so at rest
it came out at 0.39 and at the top step at 0.24 — the blue was two-thirds
louder than the red, and the red barely registered. The whole ramp is turned up
(`WASH_PEAK = 0.78`); the **proportion between them is kept**, because red at
+40 mV genuinely is a smaller push than blue at rest and the picture should go
on saying so. Zero still shows nothing at all: the membrane has no polarity
there, and a colour would be a claim the physics does not make.

**2. The flap is painted over the body.** It used to go down first, so the
protein's dark middle was painted across the end of it: shut, the flap appeared
to stop halfway and vanish into the shadow. Behind the body was the
anatomically tidier choice and the less legible one, and hiding the door is the
worst thing this panel can do.

**3. The two outlines, judged under the user's "unless it's required" clause.**

- **The ball's yellow rim is gone.** That outline was meant for the flap; put on
  both, two things shouted at once. The ball has a quiet dark rim now.
- **The ring that appeared when the ball seated is gone.** It said in outline
  what the ball now says by going still — which is the mechanism rather than an
  annotation of it.
- **The seat itself is KEPT, but redrawn.** It is the whole answer to why the
  ball waits, so removing it would remove the mechanic. A yellow dashed halo was
  drawing an *annotation of* the socket; it is now a dark recess opening in the
  mouth, which is the socket. Nothing on the channel is dashed any more, and a
  test asserts `setLineDash` is never reached.

The paint order is pinned by fingerprinting each traced path's segment count in
the drawing calls — reordering the flap fails it immediately.

877 tests green (52 files), typecheck and build clean.

### Step 33p — four walls at one height, and a way into the structure

**1. The membranes line up again.** Rewriting the leak's sentence shorter lifted
its whole picture: the description line was the one thing above the canvases
whose height depended on what it said, so a caption was moving a membrane. It is
a fixed block now — sized for **three** lines rather than the two these
sentences take on a wide screen, because the panels narrow with the window and a
height that fits exactly today's longest sentence clips it on a smaller display,
which trades a moving membrane for a truncated one. `PANEL_HEAD` pays for the
extra height so nothing overflows.

**2. The ligand collar waits a beat.** Drawn the instant the ion arrived, it was
part of the *arriving* — one event, so the landing and the catching read as the
same thing. It now comes in on its own clock about half a second later, and
**lands with the door opening**, which is what says the binding is what did it.
Thicker and pure white: at this size a hairline round a small shape is a smudge.

**3. The structure drawer has a discovery entry.** A 🔍 button on the **leak
panel** opens it — and it is on that panel for a reason. The structure exhibit
takes apart one fixed channel: a potassium channel with a selectivity filter and
no gate. That is precisely the door the leak panel draws, and a magnifier's job
is to say what is on the other side of it, so four of them all opening the same
potassium channel would have been three lies. It also fills the slot that read
"No button — it has no gate to open", which the panel's own line now says better.

- **⚠ MOUNT ORDER IS Z-ORDER.** Every drawer is `fixed z-50`, so among equals
  the one written later in `App.tsx` paints on top. `ChannelBench` was mounted
  *before* `GatingBench`, so the new button would have opened it **behind** the
  drawer that opened it — a dead button, with nothing in the code to say why.
  The list is an ordering, not a bag; it is now types → structure → filter, and
  says so.

880 tests green (52 files), typecheck and build clean.

### Step 33q — the last generic channel, and one row where there were two

**1. The neuron scene's proteins are traced now.** This was the last place in
the app drawing a channel as a generic pinched barrel — and it is the view the
app opens on, so it was the one place teaching that every door is the same
object with a different tint while every drawer said otherwise. It reaches
'Resting membrane potential' and 'Trace one signal' because both are `drawScene`
at a camera.

- **The pump keeps its barrel.** It is not a channel: domed cytoplasmic head,
  only ever open on one side, spends energy. Same reasoning that kept the
  aquaporin out of the sweep.
- **⚠ FITTED BY HEIGHT, and the membrane gap follows the drawing.** Fitting them
  all to one width was tried and *measured* first: the ligand-gated channel is
  much narrower for its height than the leak, so a shared width made it stand
  **61% taller** than its neighbours — a protein sticking out of a membrane
  because of an arithmetic convenience. Every one of these straddles the same
  wall, which is what is actually true of them; their widths differ, which is
  also true. `channelHalf` now asks the drawing, so the gap and the picture in
  it are one number.
- **The scene's private sensor marks and binding cup are gone.** Three little
  plus signs and a cup with a dot were this view's own way of writing what opens
  a channel; the traced proteins carry both properly — a sensor that *moves* and
  a socket cut into a subunit that slides.
- `widthNm` no longer sets anything and now says so where it is declared.
- The sliver guard in `proteins.test.ts` was pinned at exactly one membrane
  thickness and is now 0.7 of one, with the **measured** table beside it
  (leak 1.02, voltage 0.95, pump 1.20, ligand 0.75). The ligand-gated channel is
  genuinely the slimmest in the drawing it was traced from, and the drawing is
  the better source.

**2. Two menu rows merged into one.** 'Axonal conduction' and 'Myelin &
saltatory conduction' landed on the same camera with the same drawer; all that
separated them was that one started the race on arrival. That is not two places,
and a menu names places — the same reasoning that removed "Change one thing".
The merged row keeps the race, because the race *is* the comparison.

**3. ⚠ The equilibrium bench's channels are back, always drawn.** A previous
round drew the channel only while the door was open, reasoning that what the
bench varies is *permeability*. True of the physics and wrong on the screen: a
chamber with nothing in its wall reads as one that has lost its channel, not as
one that never had a way through. The wall is cut and the protein stands in it
whatever the door is doing; what open and shut change is the traffic.

883 tests green (52 files), typecheck and build clean.

### Step 33r — the messenger is a molecule, and RMP gets a view of its own

**1. The brown thing was the messenger, not the channel.** The ligand channel's
body is green (`#6eb976`); what was being read as a brown chloride ion was the
neurotransmitter, which a previous round painted a spare orange on the reasoning
that a colour belonging to no species says "not one of the four". **Too subtle to
survive contact.** A single glossy ball IS what this app means by "ion", whatever
colour it wears — so a spare colour just made a fifth ion, and it was taken for
the chloride the channel passes.

It is drawn from bonded **atoms** now, in the element colours the water molecules
in the permeability bench already use — a difference of KIND rather than of
shade. Ions here are lone spheres wearing a ± badge; nothing else in the app is a
cluster of bonded atoms. The `TRANSMITTER` colour is deleted.

**2. D16 — where the resting potential comes from.** 'Resting membrane potential'
and 'The action potential' both landed on a bare membrane patch, so RMP had no
view of its own.

**⚠ The proposed mechanic was declined, and why.** "Membrane, ion soup, no
channels, switcher makes ions get attracted/repelled" is wrong twice if the ions
cross — ions cannot cross a bare bilayer at all, and the resting potential is not
electrostatic attraction across a wall. If they only gather at the two faces it
is correct, but that is D12 "Membrane charge & capacitance" already.

What the app genuinely lacked: ⚖️ shows one ion's equilibrium, ⚡ shows the charge
at the faces, and **nothing showed the resting potential as a weighted
compromise**. So D16 is the tug-of-war:

> Every ion has a voltage it would be content at. The membrane settles at the
> average of those, **weighted by how easily each one can actually cross**. The
> doors are the votes.

- The user's three buttons survive **as causes, not settings**: each changes the
  DOORS in the wall, and the voltage is read off them. No button sets a voltage.
- **The corroboration this rests on**: one potassium door against the app's own
  declared background leak, on its own declared concentrations, through the same
  chord-conductance function the action potential uses, comes out at **−72.1 mV**
  — the resting voltage the rest of the app already commits to. Measured, not
  arranged, and pinned by a test against `REST_MV`.
- The needle **eases** toward its answer with the membrane's own time constant
  rather than jumping, because that is what a capacitor does.
- The honesty note says plainly that **the pump is not in this equation** — it
  built the crowds Nernst reads, and switching it off moves nothing until the
  crowds themselves run down.

902 tests green (54 files), typecheck and build clean.

### Step 33s — build the wall, read the answer

**1. The stretch-gated door opens with the push.** It was sharing
`gateOpennessAt` with the other two, which holds a deliberate pause before the
door moves — right for them, because they wait on something (a sensor, a
messenger finishing its landing), and wrong here: **this door waits for
nothing**, the bending of the sheet *is* the opening. `stretchOpenAt` now starts
while the finger is still coming down, so push and open overlap into one
movement. **⚠ Nothing guarded this** — deliberately reintroducing the pause left
all 39 tests green — and while writing the guard, a sloppy restore silently
dropped the fix and the new test caught it within the minute.

**2. The ball wears the species outline again**, now that the flap is painted
over the body and clearly the thing that swings. The extra ring that used to
appear as it seated does not come back: the ball says that by going still.

**3. ⚠ A plugged pore carries nothing.** Traffic was drawn on openness alone, so
ions streamed past a ball sitting in the mouth. Not cosmetic — stopping the
current is the entire function of inactivation, and drawing it still flowing
said the ball does nothing.

**4. Menu order is types → structure → filter**, which is also the order the app
drills in: the types bench's magnifier opens the structure, and the structure's
opens the filter.

**5. D16 rebuilt as a construction bench.** The headline over the canvas is gone
(the reading printed large on the picture says what it is better than a title
repeating the menu row), and the three preset buttons are gone with it — **a
button that sets up a wall for you does the interesting part on the child's
behalf**, and here that part is the lesson. Drag doors from the tray into the
membrane, drag them out again. This is D14's own grammar, specified 2026-08-27.

- **⚠ Chloride now earns its share.** It had 29% of the vote and nothing on the
  board to explain it. Its Nernst voltage is a mark on the scale between the
  other two, and — the real answer — pull every potassium door out and
  chloride's share jumps to **82%**, holding the membrane at −41 mV. What
  chloride was quietly doing all along becomes something the child can cause.
- **⚠ The state words are anchored to a real neuron.** "Hyperpolarised" and
  "depolarised" are defined relative to a cell's own resting potential and
  describe a cell *moved off* it — so used bare they would teach that a wall you
  built is a broken cell, when you have actually changed what rest means. The
  words stay; what they are measured against is always printed with them, and a
  real cell is marked on the scale.
- **A test claim that was simply false**, caught by writing it: "stripping the
  potassium doors moves the answer toward E_Cl". It does not — a real wall
  already sits within 8 mV of chloride's −64, and the stripped one lands 23 mV
  away at −41. The true and better statement is that chloride is what holds the
  membrane anywhere near negative once potassium loses its voice.

909 tests green (54 files), typecheck and build clean.

### Step 33t — ⚠ the axon membrane view, broken and fixed

The user reported the axon-membrane view — the one the action potential is
demonstrated in — as **completely broken**: no membrane, no channels, a flat
yellow wash. Their guess ("a yellow channel got very big and covered
everything") was right, and the arithmetic says exactly why.

**The traced proteins are authored in pixels; the scene is not.** Every bench
draws a channel in a space where one unit is about one screen pixel: line widths
near 1.1, and a charge badge with a floor of `Math.max(2.4, …)` so it never
disappears. Step 33q handed those drawings a `halfHeight` in the scene's WORLD
units, where **the entire membrane is 0.022 units across**. The floors stopped
being floors and became the largest things on the canvas. Measured before
touching anything: **the ink reached 1.33 world units — 60× the width of the
membrane**, and one sensor badge covered the view.

**The fix**: the protein is drawn at bench size inside a context scaled by
`DRAW_UNIT = PROTEIN_OUT / HALF_MEM`, exactly as a magnified frame would be. The
traced modules need to know nothing about it and every constant inside them
keeps the proportion it was chosen for.

**⚠ Two attempts at the regression test were worse than none, and both were
caught by breaking the code again.**

1. The first called the traced drawing **directly** and **passed with the bug
   put back** — because the fault was never in the drawing, it was in what the
   scene handed it.
2. The second bounded **all** of the scene's ink at a real camera. That fails
   honestly: at membrane magnification a full-bleed path really does map
   688,994 px out, and that is not a bug. It reported the same number with and
   without the fix, which is what gave it away.

So the scene's channel drawing was lifted into `sceneProtein.ts` with one
exported function, `drawSceneChannel` — **the scene now has no other way to draw
a channel**, so a test can reach the actual call site. The measurement that means
something is the ink of ONE channel against the membrane it must sit in. Broke it
a third time to watch it fail properly: 1.328 against a bound of 0.044.

916 tests green (55 files), typecheck and build clean.

### Step 33u — the resting bench, corrected

1. **It no longer talks on its own.** The reading spoke every time it changed —
   which is every door dropped, so the bench talked over the child at the moment
   they were looking hardest. The word is now a **prominent label on the canvas
   with its own speaker glyph**, and that button is the only way it is ever said.

2. **The trays are the permeability bench's trays**: a flat rounded box with the
   door drawn ON it rather than perched above its rim, and the name spoken from
   underneath — the tray and the name deliberately not sharing a hit area, so a
   child never hears a word when they meant to pick something up.

3. **Renamed to "What sets the membrane voltage".** The row named one state and
   the exhibit behind it now covers all three: build a wall of sodium doors and
   there is nothing resting about the answer.

4. **The duplicated reading under the canvas is gone** — the canvas says it, and
   the app has a rule against the column repeating what the canvas already says.
   Only the reset is left.

5. **⚠ "Depolarised" was being mispronounced**, and the cause is that the voice
   is `en-US` while the app is written in British English. `sayAs` hands the
   synthesiser an American spelling for the `-ise` family; nothing on screen
   changes, because what the child HEARS is the point.

6. **⚠ Why Cl⁻ was in the equation with no chloride channel**, answered twice
   over. It is real: every membrane is slightly permeable to everything through
   doors too many and too varied to draw, and for chloride that background is
   large — 0.45 of a door's worth against sodium's 0.1, which is most of
   chloride's 29% at rest. So (a) the **paler part of each bar** is now leak with
   no door drawn, with a legend saying so, and (b) there is a **chloride door in
   the tray**, so the child can give it a way through of its own and watch the
   solid part of its bar grow while the pale part shrinks.

**⚠ And a test that passed on the bug, for the third time in this app.** The
pronunciation guard tested `sayAs` directly, so it passed happily with
`speakAloud` no longer calling it. Rewritten to stub the synthesiser and go
through `speakAloud` — the function the buttons actually call — then broken
again to watch it fail.

925 tests green (56 files), typecheck and build clean.

### Step 33v — the gaps, and the resting bench's furniture

**1. ⚠ `CHANNEL_HALF = 21` is deleted, and with it a gap in every bench.** It
was the half-width of the ONE generic channel drawing, and every view cut its
hole in the bilayer to it. That drawing is gone and each channel is now its own
traced protein — the leak is **13.1** half-wide against that 21 — so the
constant went on cutting holes eight pixels too wide *either side* wherever it
was still used, which the user saw as "visual gaps between channels and lipids"
in the equilibrium bench. The axon lens had the same gap for the same reason.

There is **no replacement constant**, on purpose: a shared width is exactly the
mistake. Each view derives its gap from its own drawing, and one new test file
(`wallGaps.test.ts`) guards *all* of them at once — including a test that no two
traced proteins are the same width, which is why a single number can never fit
again.

**2. The resting bench's furniture.**

- The **↺ back to a real cell** button is on the canvas beside the reading it
  undoes. Under the canvas it was the only thing left in a row of its own — a
  control marooned away from everything it acts on, spending a whole strip of
  height.
- The **trays are centred**. They used to start at a fixed left margin with a
  sentence filling the space beside them; with the sentence gone the row hung
  off one side of a wide canvas.
- **"drag a door into the wall" is gone.** A tray with a door on it beside a
  wall with doors in it is a sentence already, and the canvas carries no
  explanation. The hover `title` still says it.
- **The percentages are gone from the share bar.** The bar's LENGTH is the
  weight in the equation — that is the whole reason it is a bar — and a number
  printed on top says the same thing again in a form needing arithmetic. The
  symbol stays, because a colour needs a name.

**3. `strictCanvas` now records the text a canvas WRITES.** This app has more
rules about what a canvas may say than about almost anything else, and none of
them could be tested: a list of method names does not include the words. The
removals above are now pinned by asserting the canvas writes no "drag" and no
"%".

932 tests green (57 files), typecheck and build clean.

### Step 33w — the resting bench, furniture and space

**1. ⚠ The share bar is removed entirely.** Last round "remove percentage
indicator" was read as *the numbers*; it meant the graph. The user is right and
the reason is one the app already has a rule for: **the doors in the wall ARE
each ion's weight in the equation, in the same colours** — a bar of the same
lengths underneath was the canvas repeating itself, which is the same fault as
the column repeating the canvas.

*Named, because it was an answer to an earlier question:* the paler half of each
bar was the explanation for "why is chloride in the sum with no chloride
channel". That answer now lives only in words — "Right now" and the honesty note
— and in the chloride tray, which lets a child give it a door and watch it
matter. If the question comes back, this is where the picture of it used to be.

**2. The canvas fills the drawer.** Nothing sits under it any more, so
everything left belongs to the picture, and the wall re-centres into the third
of the height the bar used to take.

**3. The buckets.**
- **Centred** on the canvas.
- Each door **perched on its bucket's rim**, overlapping the top border, so the
  bucket reads as holding a supply with the next one ready to be picked off.
  *⚠ The permeability bench does the opposite deliberately (2026-08-28) — sample
  overlapping the middle, because there a sample on the edge read as a separate
  object nearby. These hold something you drag OFF rather than something you
  fire, so the two benches now differ on purpose.*
- Each **spoken name centred under its own bucket**. A spoken label's ink runs
  from 18 px left of its anchor — the speaker glyph — to the end of the word, so
  anchoring at the tray's centre put the pair noticeably right of it.

**⚠ Two guards written this round did not bite, and both were caught by breaking
the code.** The rim test first asked only that the door's ink *cross* the rim —
which a door sitting squarely inside also does, grazing it from below. Rewritten
to measure the door's top edge, it then caught the membrane's own lipids, which
run the full width of the canvas: it was measuring from the wall down and
passing whatever the tray did. It needed a window in **y** as well as x.

936 tests green (57 files), typecheck and build clean.

### Step 33x — a current, not a trickle; and one tray for two benches

**1. ⚠ Ions now cross as a CURRENT, and the answer to the user's question is
that a stream is not merely permissible — one ball was the misleading picture.**

A single open sodium channel carries about 1.2 pA. That is **7.5 million ions a
second** — some 7,500 during one millisecond of opening. There is no moment when
a conducting pore contains one ion. The old drawing was not a cautious
simplification; it was three orders of magnitude the wrong way, and it taught
that a current is a trickle of individuals.

- The queue's **length follows conductance and driving force**, exactly as the
  rate already did — so the spike's channel visibly streams where a resting leak
  dribbles, which the code comment has promised since it was written and could
  not deliver with one ball.
- **The leak still dribbles**, and empties between crossings. A stream everywhere
  would lose the difference the exhibit is for.
- `STREAM_MAX = 5` is a **cap, not a measurement** — the pore is barely wider
  than an ion so they queue along it, and a longer queue is a solid bar rather
  than a countable stream. Declared as an understatement rather than hidden;
  there is no honest number of balls.
- **The old test counted 0 → something transitions**, which a continuous stream
  never makes. Its claim was right and its measurement was not: throughput is
  occupancy × speed, so both halves are now measured — the second by comparing
  the sorted queue positions between two close frames, since the whole train
  translates together.

**2 & 3. One tray, two benches.** The resting bench's buckets are now the
permeability bench's to the pixel — 112 × 26, 6 px radius, the same slate box
and rim — and spread the same way, evenly across the width with each centred in
its own slot. And the permeability bench's molecules moved onto their rims.

**⚠ That reverses a 2026-08-28 decision** recorded in `permeaScene`, which said a
sample balanced on the edge reads as a separate object that happens to be
nearby. What settles it the other way is the resting bench, whose buckets you
*drag things off*: there, sitting on the rim is what says "there are more of
these, take one". The two benches were drawn differently for a round, the user
saw both, and chose this one for both.

**⚠ Three bad measurements in one test, each caught by breaking the code.** The
new tray guard first asserted `c.y < c.y + c.h / 2` — true of every tray ever
drawn. Measured properly it found nothing, because `drawPermea` works in logical
units inside a scaled context while `containers()` does not. Converted to device
space it then failed *both* ways, because `strictCanvas` records an `arc` by its
centre rather than its extent, so "highest ink" sat on the tray's top edge
whichever way the sample was drawn. Measuring where the atoms are **centred**
discriminates — but the window then caught the **speaker glyph** below the tray,
nine points against the sample's two, dragging the mean 33 px down. Confined to
the tray's own band, it finally bites.

942 tests green (58 files), typecheck and build clean.

### Step 33y — one reset, one stream, and a magnifier out of the wrong slot

**0. ⚠ THE AP DEMO STILL LOOKED THE SAME, and the reason is the rule this app
already has.** The ion current from step 33x reached the membrane scenes and not
the axon lens, because "ions crossing a channel" existed **twice**: once in
`channelIonsAt`, and once in the lens's own `drawTraffic` with a hardcoded
`IN_FLIGHT = 3`. The lens is what the action-potential demo shows, so nothing
the user could see had changed. *A second copy of a fixed bug is a bug that
comes back* — the second time that rule has been earned here.

`streamCount(drive)` is the one rule now, and both callers ask it.

**⚠ And the first guard for it did not reach the second copy either** — putting
the lens back to `3` left every new test green, because they all measured
`streamCount` and `channelIonsAt`. The failure is structural (somebody writing
the number down again), so the guard is too: no file outside `proteins.ts` may
set a stream length to a bare number, and the lens must be seen asking.

**1. One reset for the whole app.** There were five: an amber chip on the
permeability canvas, two grey text links reading "↺ start again", a big amber
pill saying "↺ Back to rest", and a tiny "↺ real". The permeability bench is the
source of truth, so its geometry and colours moved to `stage/resetChip` and
everything now draws or renders from there — canvas benches through
`drawResetChip`, DOM benches through a `ResetButton` that reads its own label
from the same place. **What each reset puts back moved into `title`**: the face
of the control reads the same everywhere, because a control that does the same
thing in every exhibit has to look the same in every exhibit. The permeability
describer interpolates the label rather than spelling it. A structural test
allows the glyph in exactly one file.

**2. The magnifier is off the button row.** "How it is built" sat in the slot
the other three panels use for their CAUSE — a control that navigates elsewhere
wearing the costume of one that acts on the panel, right beside three buttons
keeping that promise. It is a **magnifier chip on the canvas** now, this app's
own grammar for "there is more to see here", on the potassium channel the
structure exhibit takes apart. The slot keeps its height as an empty spacer, or
the four membranes stop lining up.

950 tests green (60 files), typecheck and build clean.

### Step 33z — the spike never opens all the way

**1. Voicing labels lost the outline on their plate.** The plate is there for
legibility — these sit on lipid heads and bright proteins, and a name that
disappears into its background is a name nobody can tap. A **rim** round it made
the word look like a button, which it is not: the speaker beside it is the
control. It also put a ruled rectangle on drawings this app takes trouble to
keep unruled.

**2. ⚠ The AP demo still showed 1–3 ions, and this time it was arithmetic, not a
missed copy.** The rule multiplied a drive by a constant and assumed a firing
channel reaches openness 1. **It does not.** Sodium's conductance is m³h, and h
is already falling as m rises, so a real spike peaks at **0.517** — the busiest
instant the whole app draws came out as three balls, and potassium's 0.327 as
one. Exactly what the user reported.

`streamCount` now takes a **fraction of the busiest**, and the lens scales
against what the run actually reaches — measured per run and remembered, not
typed in. Sodium's peak is now the cap (5) and potassium's is 2: both measured
against the *same* busiest thing, so the sodium–potassium contrast survives
rather than each hitting its own ceiling.

**⚠ FOUR GUARDS IN A ROW FAILED TO CATCH THIS CLASS OF BUG, every one of them
because it did not go through the call site.** They fed `streamCount` a drive by
hand; the rule was never wrong, what the caller handed it was. Reverting the
lens left all ten green. The lens's decision is now an exported function
(`ionsInPore`) and the test calls *that* — the same fix as `drawSceneChannel`
two steps ago, for the same reason. Both breaks were re-run afterwards and both
now fail.

956 tests green (61 files), typecheck and build clean.

### Step 34a — a real current, and a bucket that is actually the same shape

Action list for 2026-08-30 (the new working agreement's first use).

**A1 — "AP does not work still. Remove current ion flow implementation. Replace
it with a new current view, which looks as the flow seen in 'Patch clamp
recording'."** Done.

The old drawing was *n evenly spaced balls*, and three rounds of tuning `n` did
not fix it — because a handful of evenly spaced balls reads as a **queue of
individuals** however many of them there are. The patch clamp had had the right
drawing all along: one ion emitted every 2 ms while the door is open, each
flying for 70 ms — about **35 in the air at once**, fanning out and fading as
they leave. That reads as a current.

- `core/ionFlow.ts` is that model, shared. The lens uses it.
- **Its clock is CHARGE, not wall time** — one ion per unit of charge actually
  delivered — so the stream is tied to the thing it is a picture of.
- **Each ion keeps the emission index it was born with**, so the queue slides
  forward as the rate changes instead of reshuffling; pinned by a no-teleport
  test and by one that checks a seed survives its whole journey.
- Openness is still measured against **what the run actually reaches**, both
  species against the same busiest thing, so sodium runs at full density and
  potassium visibly thinner.
- **Still true and still declared**: these are drawing rates. One open sodium
  channel carries 7.5 million ions a second.

*Not changed, and reported rather than hidden:* the membrane close-ups
(`channelIonsAt`) still use the older drawing, because there an ion threads a
large protein rather than leaving a pore in a plume, and that view was not what
was reported. It can be converted on request.

**A2 — "buckets look incorrect. They should look identical to those in membrane
permeability."** Done, and the reason it was wrong twice is worth recording.

**The sizes matched all along.** What did not was the shape: the permeability
bench draws inside a **×4 context**, so its literal `roundRect(…, 6)` and
`lineWidth = 1` land as **24 px and 4 px on screen** — and a 24 px radius on a
26 px-tall box is clamped by canvas to half the height, making a **pill with a
thick rim**. Copying its raw numbers gave a gently-rounded rectangle with a
hairline.

**⚠ And the test compared width and height only**, which is exactly why it
passed twice while the buckets looked wrong. It now pins radius and rim against
the reference's own exported constants, scale applied.

963 tests green (61 files), typecheck and build clean.

### Step 34b — ⚠ three rounds spent fixing a screen the user was not looking at

Action list for 2026-08-30:

**A1 — "remove the 1-3 balls animation. Let channels open and close with no
flow."** Done. But the reason it was needed is the record worth keeping.

**The action-potential view is `drawScene`, not the axon lens.** `drawRibbon`
runs only at the `axon-signal` camera; the menu's "The action potential" row
goes to **`axon-membrane`**, which `drawScene` draws. Three consecutive rounds of
work — the stream count, the shared rule, the whole patch-clamp flow port — all
went into `axonRibbon`'s `drawTraffic`, **which that view never renders**. Every
guard written for them was green throughout and not one was watching the screen
being reported.

The "1-3 balls" were `channelIonsAt` called from `drawProtein`; the "short
flash" after them is the gate-flash ring, which fires when a gate changes state.

- Channels now carry nothing in that scene. The **pump keeps its cargo** — it
  was not what was reported, and it is the one protein there that visibly
  spends something.
- The decision moved into an exported `cargoOf`, so the guard is on the function
  `drawProtein` actually calls. `apFlow.test.ts` cites A1 by name.

**⚠ THE LESSON, and it is not the one already written down.** "Test through the
call site" was recorded two steps ago and *followed* — `ionsInPore` was exported
and tested. It did not help, because the call site itself was in the wrong file.
The missing question is one step earlier: **which function draws the thing on
the user's screen?** Answer that first, from the route the user takes to get
there, and only then look at what it does.

966 tests green (62 files), typecheck and build clean.

### Step 34c — the current, in the view that actually draws it

Action list for 2026-08-30:

**A1 — "tests pass".** Three rows flipped from `awaiting manual test` to `done`
(steps 30, 31, 32 — D15, D13, D04).

**A2 — "continue".** Step two of the action-potential debug: the flow is back,
in `drawScene` this time, on the app's one flow model.

Measured through `cargoOf` — the function `drawProtein` actually calls when
drawing `axon-membrane` — at mid-spike:

| channel | ions in the pore | before |
| --- | --- | --- |
| voltage-Na⁺ | **14** | 1–3 |
| ligand | 11 | 1–3 |
| voltage-K⁺ | 6 | 1–3 |
| K⁺ leak | 3 | 1 |

- **The density is derived, not chosen.** `roomFor(ion)` divides the journey
  (`CROWD_REACH` either side of the wall) by the ion's own hydrated size at a
  1.4-diameter spacing: about **21 fit** for sodium, which is a current with
  gaps you can still pick individual balls out of. `flowAt` takes that as its
  in-flight limit, so the lens's longer journey keeps the full 35 and the
  scene's shorter one is not asked to draw a bar.
- **Speed still comes from conductance × driving force**, so a channel visibly
  slows as its ion stops caring; density comes from how busy it is against the
  busiest thing the app draws. Both move with the model.
- **The leak no longer empties between crossings**, and that is deliberate: a
  real leak carries a thin continuous current. The contrast is density — 3
  against 14 — rather than gaps.

**Four tests were stale rather than wrong**, all measuring a flow that used to
stop: three counted `0 → something` transitions, which a continuous current
never makes, and one compared against the retired constant. Rewritten to measure
occupancy × speed, and to compare the leak's density with the spike's.

970 tests green (62 files), typecheck and build clean.

### Step 34 — D05, the leaky pipe

Action list for 2026-08-30, after three alignment questions:

**A1 — what the child changes.** Leak doors and myelin: both act on **Rm**, the
half of the ratio myelin actually changes. Diameter was the alternative and
would have left myelin out of the exhibit that exists to explain it.

**A2 — the hose.** The **axon is the hose**; the analogy lives in the words. A
second drawn picture of one idea has cost this app repeatedly.

**A3 — where.** A drawer, with a second entry on the patch's shelf.

**λ is `core/cable.ts`'s own answer, scaled — never re-derived.** The spec
demanded that and a test pins it: a bare wall's λ must equal `lengthConstantUm()`
exactly. Measured:

| wall | Rm × | λ | reach |
| --- | --- | --- | --- |
| bare | 1 | **342 µm** | 1023 µm |
| 6 leak doors | 0.25 | **171 µm** | 512 µm |
| myelinated | 51 | **2439 µm** | 7307 µm |
| myelinated + 6 doors | 12.75 | 1220 µm | 3654 µm |

- **The square-root law is the surprise the exhibit is built on**: four times the
  leak only *halves* the reach. Pinned.
- **Myelin's factor is counted, not asserted** — `lamellae()` gives 25 wraps from
  the g-ratio the app already declares, two membranes per wrap in series, so 51
  walls to cross.
- **A wrapped fibre with holes punched in it** sits between the two, which is
  what makes λ read as a *ratio* rather than a property.
- **One drawn door is a declared teaching unit** standing for a population, as
  every door in this app does. The direction and the law are what is honest.
- The escaping arrows are drawn from `leakRateAt`, so a wrapped fibre visibly
  stops losing charge rather than being *said* to.

**Both new benches now have their second way in**: `resting` and `leaky` are on
the patch shelf as well as in the menu. The shelf-order test that asserted
`train` was last was updated — it was pinning a fixed end rather than the order
the course meets things in.

990 tests green (64 files), typecheck and build clean.

### Step 34d — the AP view: plume, density, flash, colour

Action list for 2026-08-30:

**A1 — "we've discussed that the ion flow will look like on 'patch clamp'
recording bench. It looks different currently. Or did I misunderstand?"** No
misunderstanding — it had the patch clamp's **density model** and not its
**look**. `flowAt` was shared; the plume was not. There the stream fans out and
fades as it leaves the pore; here every ion ran dead straight down one line.

It fans now — and **only once an ion is clear of the protein**. The standing rule
that a carried ion has no sideways component is about the PORE ("barely wider
than a single ion, so anything offset travels through solid protein"), and that
reason stops applying out in the crowd. Inside, they still queue single file. The
test that enforced the rule by forbidding the field outright was rewritten to
enforce its *reason*.

**A2 — "if this visualisation is scientifically correct, I would prefer a bigger
current."** It is, and a bigger one is a *less wrong* picture, not a more
generous one: one open sodium channel carries 7.5 million ions a second, so every
count this app can draw understates it. Spacing went from 1.4 diameters to
shoulder-to-shoulder — **19 ions** at mid-spike, against 14 before and 1–3 when
this began.

**A3 — "remove flash before the channel closes."** The ring fired on opening AND
shutting. A door closing is already visible twice over — the flap swings back
and the flow stops — so flashing it interrupted exactly the moment worth
watching. The decision moved out of the React component into `gateFlashAt`,
because inline in a component no test could reach it.

**A4 — "K⁺ channel does not look purple enough. Fix, check other channels."**
⚠ **A double tint.** The scene muted a channel toward its ion by 0.38, and the
traced drawing then muted it again by 0.55 — tinting a protein with what it
passes is the drawing's own job. Two mixes in series washed all three back to
bronze:

| | scene showed | should be |
| --- | --- | --- |
| potassium | `#9d8b88` brownish grey | `#a18bb9` |
| sodium | `#ae9958` muddy olive | `#cfaf3b` |
| chloride | `#8a9d6e` olive | `#6eb976` |

The scene hands over the ion's own colour now and lets the drawing do its single
mix, so it matches the benches exactly.

**`strictCanvas` records every colour painted (`styles`).** This app has a great
many rules about colour and none of them were testable — a list of method names
does not include the colours. It caught the double tint on the day it was added,
and the guard compares the scene's OUTPUT with the bench's rather than their
inputs: the same protein has to look the same wherever it is drawn.

996 tests green (65 files), typecheck and build clean.

### Step 34e — the ring, and why the AP view draws fewer ions than the clamp

Action list for 2026-08-30:

**A1 — "I still can see a ring, shortly before the channel closes."** Fixed, and
the previous round's fix was not wrong, just incomplete.

The ring already fired on **opening only**. What was left is that the sodium door
is open from `u = 0.032` to `u = 0.085` — a window of **0.053** — and the flash
lasted **0.05** of the run. So the *opening* flare was still fading at 0.078,
seven thousandths before the door shut, and read as belonging to the closing.

`FLASH_WINDOW` is now **0.018**, measured against the briefest opening it has to
mark rather than chosen: the sodium ring is bright 0.032 → 0.049 and dark for the
last two-thirds of the opening. **A flash that outlasts the state it announces
has stopped being an event marker and become a highlight on the state.**

Two existing tests used offsets of 0.02 and 0.03, picked when the window was
0.05, and broke for a reason unrelated to what they check. They take their offset
from `FLASH_WINDOW` now.

**A2 — "patch clamp has much more ions going through the channel compared to AP
demo. Either make more or push back and explain why."** Pushing back, with
measurements — and there is one thing worth offering.

The AP view **already reaches its geometric maximum**: at the voltage where
sodium is driven hardest it draws **29 ions**, which is exactly how many fit end
to end along the journey. It shows 19 mid-spike because the driving force
genuinely is lower there.

Two reasons the clamp looks busier, neither of them a limitation to fix:

1. **Geometry.** The clamp magnifies ONE channel and gives its ions a whole
   pipette to spread along, so they are small against a long span and 35 fit.
   The AP view draws ions at their true hydrated size against the membrane's own
   thickness, and ~29 fit end to end. Drawing more means overlapping them into a
   bar.
2. **Physics, and it is the lesson.** The clamp holds a FIXED voltage step, so
   the driving force never changes and the stream runs flat out the whole time
   the door is open. In a real spike the voltage is climbing toward sodium's own
   equilibrium, so the current genuinely falls as the spike peaks — which is the
   reversal potential made visible, and the thing this app deliberately teaches.

The real currents are comparable (~1.2 pA against ~1.5 pA) and both drawings are
understatements of 7.5 million ions a second.

998 tests green (65 files), typecheck and build clean.

### Step 34f — D05 rebuilt on the race view's pipe

Action list for 2026-08-30:

**A1 — "review menu items naming. We've agreed to use more precise terms."**
`How far a signal reaches` → **`Passive spread & the length constant`**. Every
other row names the thing itself — *Equilibrium potential*, *Patch clamp
recording*, *Membrane charge & capacitance* — and a menu that mixes named
concepts with descriptions of them teaches that some of these have names and
some do not.

*Two other rows are still descriptions rather than terms and were left alone,
because both were named that way deliberately:* `Trace one signal` and `What
sets the membrane voltage` (renamed at the user's own request on 2026-08-30,
when `Resting membrane potential` stopped covering what the bench does). Raised
rather than changed.

**A2 — "it has to look like a pipe… less schematic, more irregular and playful.
See 'race' view… Use this view, do not reinvent."** Rebuilt on it.

`ribbonGeometry` + `raceLayout` + `atMid` + `drawOutside` + `drawTube` are now
exported from `axonRibbon` and D05 draws with them, so the wobbling outline, the
rounded sealed ends and the bath either side come for free and **cannot drift
from the fibre the rest of the app draws**. `drawTube` takes a HEAT function,
which is exactly why it drops in: where the race feeds it a spike's voltage,
this feeds it the decay, so the pipe's own colour field IS the fading.

- **Two pipes, always both** — bare above, wrapped below, the same holes in
  each. ⚠ The myelin toggle went with it: *a comparison you have to press a
  button to see is a comparison you have to remember*, and this one is the whole
  point of the exhibit.
- **The holes are holes**, on both walls, drawn with the same leak channel the
  benches use — so a child who has met one in the membrane view meets it again.
- **Axial resistance is drawn**, as what it is: a row of kinks down the middle
  of the pipe that the push has to fight past, because the inside is a poor wire.
- One geometry serves the drawing **and** the hit tests, so a hole can be taken
  out where it is drawn — on either pipe.

**The guard for "do not reinvent" is structural**: a wobbling outline is sixty-odd
line segments, two rounded ends and a clip; a schematic tube is four corners.
Replacing `drawTube` with a `fillRect` fails it.

1000 tests green (65 files), typecheck and build clean.

### Step 34g — the leak's rate: the science was right, the clock was not

Action list for 2026-08-30:

**A1 — "in AP demo, leak channel lets out large amount of K⁺ ions. This happens
on inconsistent rate. Check if it is correct scientifically."** Two answers,
because there are two questions in it.

**The large amount is CORRECT.** E_K is −89 mV. At rest the membrane sits at
−72, so the driving force on potassium is **17 mV** — a trickle, which is what a
resting leak is. At the peak of a spike the membrane is at +40, so the driving
force is **129 mV, 7.6× larger**, and still outward. A K⁺ leak channel really
does pour potassium out hard while the cell is depolarised, and that outward
leak is part of what repolarises it.

**The inconsistent rate was a real bug.** The clock was `ms / period` — that is,
`ms × rate` — which silently assumes the rate has ALWAYS been whatever it is
now. Every time the driving force moved, the whole accumulated phase moved with
it, and the error grew with the clock. Measured before the fix: at a two-minute
clock, a change in vm of **a tenth of a millivolt jumped every ion 0.377 of the
way down the pore in a single frame**. During a spike, where vm moves every
frame, that is a stutter rather than a flow.

The honest phase is ∫rate·dt, and this is a pure function of (state, clock) with
no history to integrate. So **the rate moved to the one place that needs no
memory: density.** Current is density × speed either way; with the journey time
fixed, a channel pours harder by carrying more rather than by carrying the same
few faster. Measured after: a 0.1 mV change now moves ions **0.0332**, exactly
what a steady frame moves them, and the leak's density goes **1 → 8** across a
spike, matching the 7.6× physics.

It is also the better drawing at the reversal potential: as the push fell to
nothing the old model's period went to infinity and left ions **frozen mid-pore
for ever**; the pore simply empties now, which is what a current of zero is.

**Confirmed for the user, with evidence rather than assertion:** `leakyScene`
calls `ribbonGeometry`, `raceLayout`, `atMid`, `drawOutside` and `drawTube` —
the same five functions in the same order that `drawRace` itself uses. It is not
a copy of the race view's pipe; it is that pipe.

1004 tests green (65 files), typecheck and build clean.

### Step 34h — D05's myelin, its nodes, and its door size

Action list for 2026-08-30:

**A1 — "myelin is styled very much differently from 'race' view."** This bench
had grown its own pale rounded bands, which is a second myelin in the app.
`drawSheath` was split: working out WHERE the sleeves go stays with the run;
the LOOK of a sleeve became `drawSheathBands(ctx, geo, spans)` and D05 calls it.
Gradient, thickness, node gaps and all.

**A2 — "I add channels, and they appear on myelin. Expected: on nodes of
Ranvier."** Correct, and it is the app's own anatomy said in as many words by
the axon views: *under a sleeve there are no channels at all*. A hole drawn on
myelin is a hole through another cell wrapped round this one. The wrapped pipe
now wears `MAX_DOORS + 1` sleeves so there is **one node per hole**, and every
hole lands in a gap. The bare pipe still takes holes anywhere, because nothing
is wrapped round it.

**A3 — "channels in 'race' have smaller size than here."** They were three times
the size, and on a straight line through the middle of the tube rather than on
its wobbling wall. Both fixed — and the size is now **one number the axon views
own** (`DOOR_HALF_HEIGHT`), imported here rather than guessed at.

⚠ *The first guard for A3 bounded the drawn ink by `DOOR_HALF_HEIGHT × 2.4`
while that constant was the thing under test — tripling it tripled the bound and
the guard passed. With one owned number the fault is unrepresentable; what can
come back is a SECOND constant, so the guard is structural now.*

---

**⚠ AND AN ACCIDENT WORTH RECORDING.** Splitting `drawSheath` with a Python
slice, I wrote `s[:i] + header + loop` and never re-appended `s[j:]` — **deleting
the last 494 lines of `axonRibbon.ts`**, including `drawDoors`, `miniDoor`,
`drawTraffic`, `doorPlaces`, `poreBusyness` and `busiestDrive`. `tsc` caught it
in seconds.

Recovered because the file is tracked: `git show HEAD:…` gave the committed
copy, its tail was reattached, and the day's edits to that tail — the traced
`miniDoor`, the traced lens channels, `LENS_DOOR_HALF`, the shared `flowAt` —
were re-applied one at a time until the suite came back to the same 1004 it had
before. **A cut-and-splice on a whole file must reassemble every part of it**;
the safe shape is `head + new + tail` with all three named, never two.

One test began timing out as a side effect: the denser flow made a per-ion
`expect` loop run tens of thousands of assertions. It collects and asserts once
now — a test that dies of its own measurement says nothing.

1010 tests green (65 files), typecheck and build clean.

### Step 34i — D05 becomes a race, and a misconception is removed

Action list for 2026-08-30:

**A2 — "there's no situation when K⁺ channels are absent (which we can build)?
This is confusing… Validate."** ⚠ **The user is right, and the model proved it.**

A "bare" pipe with no holes drawn still had **Rm = 3333 Ω·cm²** — a perfectly
leaky membrane. λ was 342 µm *precisely because it leaks*. So the picture was
offering a state the arithmetic underneath did not have, and that a cell cannot
have either: a neuron with no potassium leak has no resting potential at all and
nothing to send. The drawing said "no channels"; the model said "the normal
amount of leak". They contradicted each other and the child was being asked to
believe the drawing.

**The holes are permanent now, the same in both fibres, and what myelin does is
COVER them** — which is also what myelin actually does. It does not take a
channel away; it wraps another cell's membrane round the fibre and leaves bare
gaps, the nodes. On the wrapped pipe the covered holes are drawn faintly, so a
child can see they are still there, under the sleeve.

**A1 — "make signals race. The signal moves across the pipe and sparkle 'leaks'
through the holes."** Built. One button sends a push down both pipes at once;
the pulse travels, and **sparks fly out of every exposed hole it passes**. That
is not a flourish — charge leaving through a hole is exactly WHY the signal
shrinks, so the sparks are the mechanism, and their brightness is `sparkAt`, the
model's own answer. On the bare pipe so much escapes that the pulse is spent
before the end (survives < 1%); on the wrapped one it arrives (> 20%).

⚠ **Both pulses travel at the same speed, declared.** A real wrapped fibre is
also faster — bigger λ and smaller capacitance both shorten the delay — but
speed is the conduction exhibit's lesson, and putting it here as well would
leave a child unable to say which of the two things they had just watched.

**⚠ A real finding, and my first test had it backwards.** A NODE leaks *harder*
than a bare fibre's hole at the same distance — more signal has survived to
reach it, and a node is ordinary bare membrane. Myelin does not make each hole
leak less; it wins by covering most of them. Two further test claims were also
wrong before being fixed: summing spark brightness at the end measures what is
LEFT, not what has leaked. The payoff is measured where it belongs — how much
arrives.

1011 tests green (65 files), typecheck and build clean.

### Step 34j — the button, and nodes that are actually nodes

Action list for 2026-08-31:

**A1 — "I see no 'Send a signal down both' button."** The canvas was sized to
fill the drawer, so the control row was pushed out of an `overflow-hidden` grid:
present in the DOM, invisible on the page, and the only thing there is to do
here. The canvas now leaves it a row.

⚠ **Two guards for this passed with the bug in place** before one bit. The first
compared against a hardcoded 860-pixel window; the second against the module's
own — and at 860 the too-tall canvas *also* fitted. The fault only shows on a
shorter screen, which a constant cannot be asked about. The sizing is a function
now (`leakyHeight(viewH)`) and is checked from 600 px to 1600 px.

**A2 — "channels on the myelinated axon are misplaced: they are at myelin, not
at the nodes of Ranvier."** Measured before touching anything: the sheath's gap
is **0.0156** of the fibre and `holeExposed`'s tolerance was **0.056** — three
and a half times too generous. Four holes counted as exposed and **not one of
them was actually inside a gap**; every one was drawn on a sleeve.

**The nodes are now derived FROM the holes** — a node *is* one of the holes, and
the sleeves are cut around them. That removes the tolerance altogether: a gap
cannot miss a hole it was cut around. Measured after: 4 exposed, 4 of them in a
gap.

⚠ Here too the obvious guard did not bite: once the nodes coincided with holes,
restoring the loose tolerance changed nothing, because with holes 0.111 apart
and a tolerance of 0.056 only the exact hole ever qualified. The guard that
works is the structural one — **every node must be one of the holes** — which is
what makes the fault unrepresentable rather than merely absent.

1014 tests green (65 files), typecheck and build clean.

### Step 34k — flashes that read as flashes

Action list for 2026-08-31:

**A1 — "give bigger margin on top and bottom of both axons."** Done, and the
layout is this bench's own now. `raceLayout` builds its lanes UP from the ruler
on the canvas floor, which is right for the race — every axon view puts its
ruler in the same place — and wrong here, where there is no ruler. Asking it for
taller lanes just pushed everything up: **331 px of nothing above the top pipe
against 121 below.** The two pipes are centred as a block now: measured
**131 above, 170 between, 131 below**, and the margin is taken FROM the flash
(`FLASH_REACH`) rather than chosen.

The canvas is capped at 540 rather than filling the drawer — two 54 px pipes
floating in 250 px of nothing above and below is not a bigger margin, it is a
bigger emptiness.

**A2 — "make leaking look like flashes coming out… these look like tiny strings
and are almost invisible."** Two separate faults, both measured:

- **The drawing.** The bench had a 20 px halo and a 1.6 px line. The axon views'
  own node flash is a **soft glow to radius 64 at alpha 0.95 with a white-hot
  core**. That drawing is now `drawFlash`, exported and called by both, so the
  numbers cannot be typed twice and drift.
- **The brightness.** A flash's size follows the voltage still there, because
  that is what sets the current escaping — and straight, that made the bare
  fibre invisible past the first hole: by mid-fibre only **1%** of the push
  survives, and 1% of a glow is nothing. Raised to a power of 0.45, the ORDER is
  untouched (0.52 → 0.14 → 0.02 along the bare fibre; 0.76 on the wrapped one)
  while the whole range stays on screen. **Declared in the honesty note**, with
  the exponent quoted — the user gave permission to exaggerate, and the amount
  is still owned up to.

The flash is an eased bell **centred on the pulse** now, so a hole glows a
little before the peak reaches it — which is not a cheat: a voltage spreads
ahead of its own peak, and that is the entire subject of this exhibit.

⚠ *The margin guard passed with the margin cut to 10*, because the outer space
is supplied by the canvas being tall whatever the lane does. The gap that
actually clips is the one **between** the two pipes, and that is what it
measures now.

1017 tests green (65 files), typecheck and build clean.

### Step 34l — ⚠ a leak is not a signal

Action list for 2026-08-31:

**A1 — "flashes have to 'move away' or somehow display leakage. At the moment it
displays a flash, which symbolizes signal across the app, which is not what we
try to describe."**

The user is right and it was a bad reuse of mine, made one step earlier. The
white-cored yellow burst is this app's **one mark for "the signal is here"** —
the race view puts it at every node to say the signal has been **rebuilt**
there. Wearing the same mark on a leak made one symbol mean two opposite
things, and at a node it meant both at once: *rebuilt here* and *lost here*.

Leaking is charge **leaving**, and the app already draws that — the ion current
that crosses a channel in the membrane views. So a leaking hole now emits the
app's own glossy potassium ions, through the same `flowAt` model, **aimed
outward and fading into the bath**. It says the one thing a stationary burst
never could: the charge is going away and not coming back. The colour is
potassium's, so it also says *what* is leaving.

The margins are taken from how far an escaping ion gets (`LEAK_REACH`) rather
than from a flash's radius, and the describers now speak of charge streaming out
rather than of sparks.

⚠ **The first guard for this banned the signal's colours from the file
outright** — and forbade the one honest use of them: the push going IN at the
left end genuinely is the signal. The rule is that a LEAK must not wear them,
not that the file may not mention them.

1018 tests green (65 files), typecheck and build clean.

### Step 34m — the signal, and the signal leaving

Action list for 2026-08-31:

**A1 — "we display a very bright signal, as you see it in 'Axonal conduction and
myelin'."** The axon views' aura is a glow **five times the tube's half-height**;
this bench had been drawing its own at two and a half — a dimmer thing wearing
the same colour, which is how a visual language stops being one. `signalAura` is
exported now and both call it.

**A2 — "a better relation visually between the signal and the leaking signal…
for a kid it's not clear why the signal is fading out while ions are leaving."**

Drawn as purple potassium, the leak and the signal were **two unrelated
pictures**: a yellow glow going one way and purple balls going another, with
nothing to say one caused the other. What escapes IS the signal — the charge
that was carrying it — so it now leaves **wearing the signal's own light**, out
of a blob that visibly shrinks as it goes. The blob's brightness and the holes'
leak both read off `survivesAt`, so they are one fact drawn twice: a hole cannot
leak hard where the signal is faint, and the signal cannot stay bright where it
has been leaking.

⚠ **This looks like a reversal of the previous step and is not.** The forbidden
mark was never the colour — it was the axon views' **stationary burst**, which
the race uses at a node to say the signal has been REBUILT there. A bright thing
sitting on the wall meant the opposite of what was intended; bright things
*moving away* mean exactly it. The guard now says which part carried the wrong
meaning, so the two corrections stop looking contradictory.

The colour choice is declared: what is leaving is potassium, and the doors stay
potassium-purple to say so. What the signal's light reports is not which ion it
is, but that this is the signal draining away.

1020 tests green (65 files), typecheck and build clean.

### Step 34n — nothing glows at rest, and a sleeve actually covers

Action list for 2026-08-31:

**A1 — "at the start, there are static yellow lights. Remove them."** Each pipe
wore a pulsing glow at its left end whether or not a signal was on its way. This
app had just settled, one step earlier, that a bright thing **sitting still**
means *the signal is here* — which at an idle inlet is untrue, and was the exact
fault we had removed from the leaks. Gone: the signal arriving IS the signal
starting at the left, and nothing needs to mark the spot in advance. Measured at
rest: **zero glows on the canvas**.

**A2 — "on myelinated axons, there are ghost channels 'under' myelin layers."**
⚠ **They were not under anything.** They were drawn AFTER the sheath at 28%
opacity — painted *on top of* the myelin — which is precisely what a ghost is.

The fix is **order, not deletion**. The holes go down first and the sleeve
occludes them the way a real sheath occludes a real channel: no alpha trick,
nothing hovering, and the anatomy still true — a covered channel is still there,
it simply cannot be seen or leak. The escaping light stays on top of everything,
because it has to cross the sleeve's own thickness to reach the water.

*That also settles a rule I had written and the user was overruling* — "draw the
covered ones faintly, or a sleeve reads as a different membrane". Correct
z-order keeps what that rule was protecting without the ghosts it caused.

1022 tests green (65 files), typecheck and build clean.

### Step 34o — the passive-spread view, laid out like the axon views

Action list for 2026-08-31, numbered as sent:

**A1 — remove the caption, put Race on top of the canvas.** Both done. The
sentence is gone from the markup as well as the screen, and the control now sits
above the picture, which is where the axon views put their clock: the thing you
press and the thing it starts read top to bottom.

**A2 — use the layout of *Axonal conduction & myelin*.** The one piece of that
layout this bench was missing is the **ruler on the floor**. `drawRuler` was
private and welded to `VIEW_LENGTH_UM`; it is now split into a shared
`drawScaleRuler` (how a ruler looks) and its caller's marks (where they fall), so
D05 gets 0–3 mm in half-millimetres without a second ruler existing.

**A3 — stretch the canvas vertically.** The 540 px cap is gone; the height is the
drawer's budget less the control's row, checked at four window heights rather
than at this one.

**A4 — verify the λ placement.** ⚠ **It was already right, and the complaint was
still right.** Measured: λ on the bare fibre falls at 11.4 % along, where
survival is 0.381 — 1/e to three places; wrapped, 81 % along at 0.369. What was
wrong is that the mark sat on an axis with no numbers on it, and on the bare
fibre the whole decay is crammed into the left ninth of 3 mm, so *nothing visibly
changes* at the mark. The ruler from A2 is the fix: λ now lands at a readable
distance instead of at a place with no name.

**A5 — "length constant" off the axon body.** It is above the λ reading now, and
centred on the dashed mark rather than anchored beside it — the glyph hangs 18 px
left of the anchor, so the anchor is not the middle.

**A6 — unify the fibre's thickness.** It was 54 px against the race's 86.
`TUBE_PX` is now `AXON_W * AXON_VIEW_SCALE` — the axon views' own number, so if
that fibre changes this one follows rather than drifting.

**A7 — the apparent conflict between the two views.** Answered in the reply, not
built: they are not in conflict, and the answer is the exhibit's whole point.

**A8 — a small axon top-left.** The app's own miniature, with the ring on the
axon zoom target's own centre and **no pipette** — which needed `drawNeuronInset`
to stop meaning two things by one argument.

1029 tests green (65 files), typecheck and build clean. Every new guard was
broken and watched to fail.

### Step 34p — passive spread becomes a place on the cell

Action list for 2026-08-31:

**A1 — "small neuron is placed on the canvas. Should be placed in the same
location as across the app."** Removed from the canvas entirely. It only existed
because a drawer covers the column; the column's permanent miniature is back and
its dashed ring sits on this view's own zoom target, which is the app's rule
rather than a second drawing of the same cell.

**A2 — "buttons should be placed on the canvas… look at what the buttons look
like on it."** 🏁 Race and ↺ Reset now sit in the axon view's own floating pill —
same corner, same plate, same 38 px chips. `ResetButton` grew a height so the one
reset can stand in a 38 px row without becoming a second-looking reset.

**A3 — "let's follow 'Axonal conduction and myelin' pattern, and add another
entry point: magnifying glass on the 'big neuron'."** D05 is a **place** now:

- a new zoom target `axon-passive` at `AXON_PASSIVE_T = 0.82`, further down the
  axon than conduction at 0.3 — measured so the two markers cannot overlap
  (x ≈ 589 and 800 against a marker radius of 14), which is now pinned by a test
  over *every* pair of markers;
- the marker is the app's own dashed ring with a 🔎 in it, which is what a zoom
  marker already wears — the "magnifying glass on the big neuron" was already the
  house style, so nothing new had to be invented;
- drawn on a layer of its own, untransformed, gated on arrival in decades from
  either side, with the scene given the same number as its opacity;
- the drawer, its store's `open` flag, its sidebar and its canvas reset chip are
  all gone; the words moved to `LeakyInfoPanel` in the column beside every other
  view's;
- off the membrane patch's shelf — it is not about that patch — and the contents
  row flies to the marker instead of opening a drawer. Two doors still, both of
  them somewhere a child can see what they point at.

⚠ **Two bugs caught on the way, neither of them visible in a test that existed.**
The Race button stamped `performance.now()` while the frame reads Konva's
`frame.time` — milliseconds since the animation started — so the run position
would have come out negative from the first press. And `drawLeaky` opened with a
`clearRect`, which on a Konva layer erases whatever sibling drew before it; it
owns its layer and clears nothing now.

⚠ **A rule was rewritten rather than worked around.** *Where a concept lives*
sent "comparisons" to drawers, which would have made this exhibit a drawer
forever. The app already contradicted it — the conduction view compares two
fibres and is a place — so the rule now says what decides is what the exhibit is
OF, not how many of them it shows.

1025 tests green (65 files), typecheck and build clean. Every new guard was
broken and watched to fail.

### Step 34q — the ghost axon, and a menu of what is coming

Action list for 2026-08-31:

**A1 — "I can see a ghost axon behind the visualisation, on both 'passive
spread' and 'Axonal conduction and myelin'."** ⚠ **A real bug, and an
instructive one.** The scene layer was being faded with `layer.opacity()`, which
Konva implements by setting `globalAlpha` before calling the shape's
`sceneFunc` — and `drawScene` **assigns** `globalAlpha` in eighteen places. An
assignment overwrites; so from the first one onward the layer's fade was gone
and those parts painted at full strength however far out the camera had flown.

Measured, not guessed: the ease was checked first and reaches 0.0002 within two
seconds, which ruled out the obvious suspect and pointed at the ink.

Three fixes, in order of how much they buy:

1. The scene now fades by the **CSS opacity of its layer's canvas element**, so
   nothing a drawing does can escape it — and an invisible layer stops listening,
   so a faded-out cell is not still clickable underneath its replacement.
2. `drawLeaky` had three of the same assignments. Measured: at a fade of 0.05,
   three of 436 ink calls painted at up to 0.54 — the passive view would have
   popped in rather than arrived. They multiply now, and a test asks the question
   directly at three fades.
3. `strictCanvas` gained `alphas` (the alpha in force at every ink call) and a
   `save`/`restore` that puts the **drawing state** back, not only the transform.
   ⚠ It had been *more forgiving than a browser* — the direction that hides
   faults — and two particle-style tests were reading colours off the context
   after the drawing had finished, which only worked because of that leak. They
   read `styles` now.

**A2 — "fill in the app menu sub-items. Make them inactive."** Put to the user as
a conflict first, because `core/contents.ts` carried the opposite rule with a
stated reason. The user ruled: *"List what you can, it is still subject to
change… make it look as similar to active chapters as the plan allows, but make
it inactive."*

31 planned rows from `docs/01-feature-spec.md`, each carrying its spec ID,
interleaved by lecture among the built ones so a Part reads as one list. Parts
III–VII go from a single "not built yet" line to 7, 6, 4, 5 and 6 rows. The rule
was rewritten rather than worked around — see 03-architecture.

1033 tests green (65 files), typecheck and build clean. Every new guard was
broken and watched to fail.

### Steps 20 and 21 — the synapse, and the machinery inside it

The user asked for both in one round ("scene first then drawer"), handed over
`presynaptic-bouton.svg`, and ruled two questions before anything was drawn.

**Ruling 1 — the handover wins on composition.** This document's earlier spec
had the terminal "fading out at the frame, no invented far surface", 42 / 6 / 42.
The SVG draws the whole bouton, stalk and all, and the user chose it. Recorded
in 05-visual-language with the reasoning: the earlier ruling described a
*close-up of the cleft*, where the far side is off the page and drawing it would
be invention; this is a wider view in which the whole terminal fits, so its
boundary is observed. The rule is unchanged for close-ups.

**Ruling 2 — validate the lower shape against the transmitter.** ⚠ **Pushed
back on the fallback.** The user said "if it makes no difference scientifically,
make it a shaft". It makes a difference: **glutamate synapses land on dendritic
spines** (Gray's type I; inhibitory GABAergic contacts are the ones on shafts
and somata), and the app's own plan already depends on it — S13 has "Ca²⁺ enters
the spine", P04 has the spine enlarging with LTP. A shaft would have been
redrawn as a spine two steps later. So the reference's lower shape became the
dendritic **shaft**, with a spine rising out of it to meet the bouton. Its wander
is kept; only the hollow beneath the terminal is altered.

**Step 20, the scene.** The outgoing synapse is a **place** again — its own
layer, its own arrival gate, a quarter turn on the way in because this synapse
lies along the x axis on the cell while the drawing puts the cleft across the
middle. Both kept models drive it (`core/synapse.ts`, `core/cleft.ts`, 33 tests
between them, untouched): the calcium gate, the calcium the sensor sees, which
of the five vesicles went, the transmitter concentration, the receptors' state.
Nothing in the drawing decides anything.

⚠ **Level of detail cut the other way for the first time.** At ~440 px per
micrometre the membrane is 2 px and a lipid head is a third of a pixel, so this
scene draws the wall as a two-leaflet BAND. The molecules go in D06, where one
vesicle fills the frame — and the paver is one shared function, extracted from
the whole-neuron scene (`bilayer.paveMembrane`) rather than copied.

**Step 21, the drawer.** `core/vesicleCycle.ts` owns the sequence: tether → dock
→ prime → trigger → zipper → pore → collapse → retrieve → refill, with the
clock following the interest (the trigger and the zip get a fifth of the window
each; refill gets a twentieth). The zip **stops at half and waits** — that pause
is the mechanism, and a complex winding smoothly from nought to one would be a
picture of fusion with no trigger in it. The sensor's site count is the scene's
own `HILL_N`, so the drawer's sensor is the scene's sensor. Two doors: the
magnifier beside the active zone, and the contents row.

⚠ **The model says which numbers are measured.** The four calcium sites are
(Dodge–Rahamimoff); the pace is not — SNARE zippering energetics are an open
question, so the info block says the order and cast are settled science and the
stopwatch is not.

⚠ **Four guards passed with the code deliberately broken**, all the same way:
they counted ink instead of asking the decision. Written up as a rule in
03-architecture (*Ask the DECISION, not the ink*). `transmitterCloud`,
`vesicleRing` and `snareLens` exist as exported functions because a test needed
to reach the real call site.

⚠ **And one of my own tests was wrong about the biology**: it demanded the four
calcium sites hold still, when the sensor rides on the vesicle and travels with
it. The real claim is that they do not REARRANGE, and that is what it checks now.

1061 tests green (68 files), typecheck and build clean. Every new guard was
broken and watched to fail.

### Step 20a — the synapse redrawn: the active end

Corrections after manual testing, 2026-08-31.

**A1 — "shorten the 'neck'."** Both of them: the bouton's stalk is cropped at
the top edge (182 px → 44 px) rather than squashed, and the spine's neck is a
fifth of the head's width rather than nearly half.

**A2 — "make the active area 2× larger."** ⚠ **Measured, and it is 1.96×, not
2×.** A literal doubling of both structures does not fit 660 px of frame, so the
scale is now SOLVED from a budget the scene declares and what it reaches is
reported: active zone ×1.96, spine head ×1.74, bulb ×1.32. The active zone is a
fraction of the bulb's half-width now — it was a fraction of the canvas, which
is exactly why the first version left it unchanged however much room the bouton
had. The spine head became an ellipse to pay for it.

**A3 — "exocytosis should visually tear the membrane."** `tearsAt` is a named
decision: no gap before the model says a vesicle went, a gap opening over 9 ms
after, one per fused vesicle, at that vesicle's own place, never wider than the
vesicle that made it. The wall is clipped rather than painted over — this view
shares a Konva layer, and a shape that erases pixels erases its neighbours.

**A4 — "vesicles as circles, inner colour the same as extracellular space."**
⚠ **This reverses the user's own ruling of 2026-08-27** ("clean hollow-circle
vesicles → overridden: a vesicle is a bilayer ring"). Recorded as
Reconciliation #10 with the reason it is an improvement rather than a
regression: **a vesicle's lumen is topologically outside the cell**, so painting
it in the bath's ink teaches the topology that makes exocytosis possible. It is
the SAME CONSTANT, not a match — and the bath had to become opaque for that to
be a fact rather than a thing you check by eye.

**A5 — "the area that overlaps with the membrane loses outline."** `mergeBand`,
also a named decision. It carries what #4 used to: an outline that stops where
the two walls meet says *same material* more directly than a ring did.

⚠ **The tests caught a portability fault on their first run**: the tear used
`Path2D`, which does not exist in every environment this drawing runs in.
Replaced with `beginPath` + `clip('evenodd')`.

⚠ **And one of my own tests was wrong again** — it asserted "the first tear
belongs to the first vesicle", when by that moment a second had fused and the
list comes back in slot order. It checks every tear against its owner now.

1068 tests green (68 files), typecheck and build clean. All six new guards were
broken and watched to fail.

### Step 20b — "the animation looks broken"

Five points, 2026-09-01. Each was measured before it was touched.

**B1 — "push the whole image down: bouton two thirds, postsynaptic one third."**
The scale is solved so the foot lands on the two-thirds line. Measured: 0.652,
checked at four frame sizes.

**B2 — "the opening vesicles are placed outside of the presynaptic bouton."**
⚠ **A real bug, and worse than it looked.** The active zone was a straight row
at the outline's LOWEST point; a bouton's foot is a curve. Measured before the
fix: the wall under the five docked vesicles is at y = 394, 426, 431, 413 and
353, while all five were drawn at y = 297 — the outer two floating 47 and 88 px
outside the cell. The reserve pool had the same fault.

The fix is to let the traced outline be ASKED where its floor is
(`svgPath.flattenPath` → `boutonShape.boutonFloorAt`), and to have everything on
the wall read it: docked vesicles, the pool, the calcium doors, the tear, the
merge band, and the transmitter's ceiling. Measured after: every vesicle sits
exactly one membrane-thickness inside the wall at its own x.

**B3 — "no neurotransmitters are visibly released."** ⚠ **True, and the model
was right.** Measured: the packet is in the gap for 0.87 ms of a 60 ms window —
u = 0.045 to 0.090, **4.6% of the run**. A linear clock cannot show that however
slow it is, and slowing it slows the empty 95% too.

So the run has legs now, which is this app's own rule (*a run's clock follows
the interest*): 20% of the screen for the arrival, **58% for fusion, filling and
binding**, 22% for the tail. On screen the transmitter is visible for **27%** of
the run against 4.6%. Inside a leg the map is linear — slow the leg, never the
item — and a test walks it.

**B4 — "neurotransmitters are not visible inside the vesicles."** `cargoIn`
places seven particles per bubble, in the SAME ink as the transmitter in the
gap, emptying as the bubble opens. A vesicle drawn empty is a bag of nothing.

**B5 — "slow down."** 7.8 s → 15 s, on top of the legs.

⚠ **The postsynaptic face stopped being an ellipse.** It could not stay one: an
ellipse hung off the foot's height while the presynaptic wall is a curve gives a
cleft that opens out at both ends. Its membrane now follows the bouton's own
wall one cleft below, so the gap is a constant 26 px — measured at 21 points
across the zone.

1072 tests green (68 files), typecheck and build clean. All five new guards were
broken and watched to fail.

### Step 20c — the omega rework: "the cut does not repeat the curve"

Two points, 2026-09-01. *"The cut on the vesicles does not repeat the curve of
the presynaptic bouton... it looks unrelated. Reconsider the animation so that
the activated vesicles visually merge with the membrane."* User chose: true
omega figure, flattening fully into the wall afterwards, and fix the ordering.

**A1 — the merge follows the bouton's own curve.** The fused vesicle was a full
circle clipped by a HORIZONTAL band over a tear of chosen width — two shapes
solved separately, meeting only where the wall happened to be flat. Now one
geometry owns the joint: `fusedShape` sinks the circle through the wall on a
declared schedule, `pocketAt` finds the two points where it crosses the traced
outline (bracketed, then bisected against the curve), the arc is drawn between
those feet, and the tear runs exactly between the same two points (`Tear.xL/xR`)
— so the torn wall's ink runs into the pocket's arc without a joint, in the
wall's own two strokes, because after fusion it IS the wall. The docked
outline-skip follows the curve too (`wallStrip`), not a flat band. Afterwards
the pocket flattens into the wall (`FLATTEN_FROM_MS + FLATTEN_MS`) and the tear
heals: the run ends on a whole membrane.

⚠ **The rework surfaced a real placement bug**: a docked circle set `r + MEM_PX`
above the wall *at its own x* was already through the outline SIDEWAYS on the
sloped slots — pocketAt reported a 10 px tear at the instant of fusion, before
anything had opened. `dockedY` now raises the centre until the whole circle
clears the curve.

**A2 — cause before effect.** The model puts the dose in the gap AT the fusion
instant, but the drawing's `FUSE_MS = 9` was longer than the whole fusion leg,
so the cloud came and went while the vesicles were still "slowly merging".
Replaced by a schedule: mouth open in `PORE_OPEN_MS = 1.1` (√-eased so it is
open by the first drawn moment), cargo drains over `CARGO_DRAIN_MS = 2.6`
(roughly the transmitter's stay), flattening is the slow part and comes after
the payload. A test walks the legged clock and requires a moment with the cloud
out AND the mouth fully open.

Folded into 03-architecture as *An opening in a shape is ON the outline too*
and *Cause on screen no later than effect*. 1077 tests green, typecheck clean.
The feet-on-the-curve guard was broken (pocketAt flattened to a horizontal
solve) and watched to fail with a foot 4.7 px off the wall.

### Step 20d — six corrections, 2026-09-01 (round 3)

*"The vesicle merge looks good"* — the omega stands. Then six points.

**C1 — "release also the vesicle in the middle."** The chance draw fired the
two OUTERMOST slots (indices 0 and 4). User chose: three release. ⚠ **The seed
is curated and declared** (`core/synapse.ts`): the xor constant was searched so
this run's draws fall {0, 2, 4} under the run's own release probability —
`totalHazard` 0.188 → p ≈ 0.17 per vesicle, and 3-of-5 is an ordinary outcome
of that chance (~18%). Nothing else moved: the times still fall out of the
hazard (2.57 / 2.78 / 2.88 ms — the middle goes first), and the quartered-
calcium run still releases nothing. `totalHazard` became a field of the run so
the seed can be held against it. ⚠ One model test was passing by luck: "the
transmitter peaks the instant a vesicle goes" compared the peak to the FIRST
fusion, and with three staggered doses the peak sits on whichever dose tops the
stack. It now checks the NEAREST fusion — the real claim, since a journey would
land the peak after all of them.

**C2 — "vesicle outlines like the membrane."** Same material, same band: every
bubble wears the leaflet stroke WITH the oily core through it.

**C3 — "neurotransmitters not white, add gradient."** ⚠ Reconciled with the
2026-08-30 ruling ("a single glossy ball IS what this app means by 'ion'"),
which was quoted to the user before choosing: the dot is SHADED, not glossy —
light centre, dark rim, no sparkle, no glow — and TEAL, which no ion wears.
`transmitterDot` is the one door: cargo, cloud, D06's cargo and the whole-cell
view's crossing messengers all go through it or its `TRANSMITTER_INK`, and the
cleft facts' "green molecules" became teal with it. strictCanvas learned to
record gradient stops as ink, or every colour-counting test would have gone
blind the moment the dots became gradients.

**C4 — "docked vesicles' membrane closed."** Not a reversal of "the area that
overlaps the membrane while moving loses outline" (2026-08-31): since
`dockedY` a resting vesicle overlaps nothing, so the skip now applies exactly
where that ruling says — while a fusing vesicle is sinking through the wall.

**C5 — "Ca channels get covered at the start."** ⚠ A z-order bug: the
spike-arrival membrane repaint was painted LAST, over every channel in the
wall. A repaint of a surface draws when the surface draws — it sits with the
membrane band now, under the doors, and honours the same tears.

**C6 — "the postsynaptic specialization looks misshaped, has angles."** The
spine's flanks were a straight diagonal plus a vertical hop — two corners a
side. Each flank is one cubic now, leaving the neck vertically and arriving at
the face's end vertically (the face curve's own tangent there), so neck, flank
and face meet without a corner. The face itself — the apposition — is
untouched.

1082 tests green, typecheck and build clean. The C5 guard was broken (repaint
disabled) and the C1 guard was broken (seed reverted); both watched to fail.

### Step 20e — four corrections, 2026-09-01 (round 4)

**D1 — "released neurotransmitters disappear; they should stay and bind"
(science check requested).** Half confirmed, half corrected, and the split IS
the lesson: FREE glutamate honestly vanishes in under a millisecond — the info
block teaches exactly that, so the cloud's fade stays — but molecules CAUGHT BY
RECEPTORS persist for many milliseconds, desensitized receptors longest of all.
The model always computed `bound`; the picture never drew it, even though the
cleft facts promised "two teal molecules still sitting in its mouth". Now
`seatedTransmitter` puts two molecules in each bound receptor's mouth — two,
because the receptor takes two keys — gated per receptor by the same threshold
the open/socket states use. At the window's end the gap is empty and the
mouths are still occupied.

**D2 — "the vesicle in the middle does not move."** ⚠ It moved — FIRST, at
2.57 ms, before the transmitter cloud gave the eye any reason to be on the
zone, so its whole opening played unwatched. The curated seed now makes the
middle fuse LAST (2.75 ms), when the gap already carries ~78% of a packet and
the user is looking. The sink was also deepened (OPEN_DEPTH 0.55 → 0.4, growth
0.15 → 0.25) so it travels ~0.7 r instead of ~0.55 r.

**D3 — "calcium should stay next to the docked vesicles."** Honest version
drawn: the LOCAL nanodomain collapses when the current stops (that is why
release stops dead — the door-mouth burst still shows it), while the terminal's
AVERAGE free calcium clears on the measured ~30 ms clock. `terminalCalcium`
scatters seeded ions across the active zone among the docked row, allocated by
threshold off `caUm` — a crowd at the peak, thinning to a couple by the
window's end. Still there at u = 1; never a permanent decoration.

**D4 — "the postsynaptic specialization is very nonsymmetrical, completely
weird — redraw."** ⚠ The fault had a mechanism: beyond the active zone,
`faceAt` kept tracking `wallAt(x) + drop`, and past the zone's edge the bouton
curves steeply UP — so each shoulder rose into its own hump before falling,
a different hump each side. Apposition is a fact about the active zone, not
the neighbourhood: beyond the edge the face now drops from its own edge's
height on one shared quarter-ellipse, so the shoulders are congruent by
construction and monotone. Proportions rebalanced with it (FACE_OF_BELOW
0.5 → 0.6, FACE_OVER 0.34 → 0.22, flank bulge 0.8 → 0.6): the head was a slab
4.6× wider than tall, now ~3.3×.

⚠ The reseed exposed a model test passing by luck a second way: none this
round — but the cleft "peaks at the nearest fusion" guard from 20d carried the
new times without change, which is what it was rewritten for.

1086 tests green, typecheck clean. D4 was broken (freeze reverted → hump
returned) and D3 was broken (threshold ignored); both watched to fail.

### Step 20f — the storyboard round, 2026-09-01 (round 5)

The user storyboarded the whole sequence — flash, red depolarization tint,
calcium at the docked vesicles, transmitter spreading and escaping, receptors
opening, ions entering, the spine depolarizing and passing it on — and asked
for a science check with pushback. Verdicts, and what was built:

**E1 — the depolarization "red tint".** The user pointed at the voltage-gated
bench as precedent, and that resolved the colour question: the app already
owns a charge-aura grammar (`chargeWash`: red = inside positive, blue =
negative). Both interiors now wear it. ⚠ AND THE ASYMMETRY IS THE LESSON: the
bouton's spike genuinely overshoots past zero, so its aura really goes red and
comes back; the spine's EPSP climbs from −70 to about −58 mV and NEVER goes
positive, so its aura warms toward neutral and never reaches red. A test
sweeps the whole run and pins "the spine's aura is never positive". Timing
pushback also applied: the tint follows the membrane VOLTAGE (which opens the
calcium doors), not the calcium's arrival.

**E2/D3 — calcium at the docked vesicles.** Confirmed science (synaptotagmin
waits at the vesicle–wall junction). `terminalCalcium` ions are now anchored
each to a docked slot, low at its feet, and constrained OUTSIDE the bubble's
circle — an ion over the lumen read as cargo.

**E3 — transmitter "floats away".** Confirmed science (lateral diffusion out
of the gap plus uptake — the info block always said it; now ten seeded
molecules are watched leaving at the gap's two ends during the decay, on a
declared `ESCAPE_LIFE_MS` schedule). ⚠ The crossing is still never a journey:
they leave ALONG the gap, not across it, and a guard pins the outward drift.

**E5/E1 — the postsynaptic answer.** ⚠ THE ONE REAL PUSHBACK: the storyboard's
"another yellow flash that propagates down the dendrite" would draw an action
potential, and a single synapse's EPSP is not one — it is graded, decays with
distance, and whether the CELL fires is decided at the soma after summation.
Built instead: an honest RC-with-conductance-synapse spine model in
`core/cleft.ts` (`vmPost`, τ = 12 ms, g-ratio 1.5, AMPA reversal 0 mV — the
drive DECLARED as typical, not measured), drawn as sodium dripping through
every open receptor (`postsynEntry`, per-receptor gated), the charge aura
warming, and a gold signal-glow that swells with the EPSP — head-bright,
already faint at the shaft, brightening everywhere at once, because passive
spread at this scale is effectively instantaneous and decays with distance.
The cleft facts' "nothing is coming through them yet" died with this round;
its guard now pins the new claims (NOT MEASURED declared, soma named, "not an
action potential" said).

1091 tests green, typecheck and build clean. The EPSP was broken past its
reversal (conductance form replaced with a hard pull to +40 mV) and both the
model guard (E5) and the view guard (E1, "the spine never reads red") watched
to fail. Notably, milder breaks — reversal moved to +40 in the conductance
form — did NOT fail: the short transient keeps the peak negative anyway,
which is the physics doing the guarding.

### Step 20g — the pacing round, 2026-09-01 (round 6)

**F1 — "the AP coming, as a yellow flash on top of the presynaptic axon."**
`arrivalFlash`: a knot of the signal's own gold entering at the frame's top
edge (`neckTop`, measured off the traced outline's own top corners) and
running down the stalk while the terminal charges. Its alpha IS the wall
highlight's `hot`, so the flash and the depolarization cannot disagree about
when the spike happens.

**F2 — "a clear chain, with a small pause between events."** ⚠ The real
couplings are sub-millisecond — that IS the physics, and the model keeps it —
but the clock can hold its breath: CLOCK_LEGS went from 3 legs to 10, three of
which are BEATS — legs whose model span is ≤0.15 ms given ~0.75 s of screen,
so the picture stands still after each cause and before its effect
(depolarized → beat → doors open and calcium seats → beat → exocytosis → beat
→ the gap). A beat is the limit case of "slow the leg, never the item", and a
guard checks no fusion ever lands inside one. `synapseClock` learned to snap
u = 1 exactly (ten shares of floating dust) and the last leg absorbs the
remainder.

**F3 — "some transmitter should stay in the cleft."** Science held again —
free glutamate clears in under a millisecond and the exhibit teaches exactly
that — but two legibility faults were real: the cloud's LINEAR alpha made the
exponential's tail invisible long before it was gone (now γ = 0.55, visible
for the full decay the model computes, no longer), and the seated pairs in the
receptor mouths — the molecules that really do stay, IN the cleft — were drawn
at 2.4 px (now the cargo's own 3.2 px).

**F4 — "the postsynaptic aura has a linear cut."** ⚠ Mechanism found: the
wash's gradient began at the FACE'S CENTRE height, and a linear gradient
clamps to its first stop — alpha zero — above that line, so wherever the
curved face rose past the centre's level the aura ended along a ruler edge.
`spineAuraTop` starts the wash above the face's highest point, leaving the
clip — the shape itself — as the aura's only boundary. Guard: the aura's top
is above every sampled point of the face.

1094 tests green, typecheck clean. F3's guard was broken (aura top back to the
centre height → the cut returned, 14 px deep at x = 324) and F1's was broken
(the knot pinned in place → "an arrival, not a lamp" failed); both watched.

### Step 20h — the soup round, 2026-09-01 (round 7)

**G1 — "calcium ions just teleport into the bouton."** True: the burst drew
ions above the doors, inside, drifting up — born on the wrong side of the
wall. `calciumEntry`: each open door now runs a drip from the CLEFT below —
calcium's outside is the gap — up through the channel into the terminal, for
exactly as long as current flows (`lit` is the model's own local calcium).
Endpoints sine-faded so an ion melts out of the outside soup and into the
standing pool instead of popping.

**G2 — "large and bright, as if a big electric current just flashed."**
`FLASH_R = 150`: a hot core inside a wide halo, wider than the stalk it runs
down.

**G3 — "ion soup in pre, post and extracellular space; ions should not appear
from nowhere."** `ionSoup`: seeded loose ions in all three compartments
carrying the real asymmetries — potassium-rich inside BOTH cells, sodium and
chloride outside, calcium waiting in the cleft for the doors. The sodium the
receptors admit joins the spine's crowd one ion at a time (threshold-allocated
off the EPSP). ⚠ THE COUNTS ARE A MOOD, NOT A CENSUS, declared beside the
other exaggerations (`SOUP_NOTE`): drawn true, 145 mM of sodium would be solid
ink; the handful carries the ratios. A gentle thermal wobble rides the model's
own clock, so the soup holds its breath during the beats too. ⚠ The soup broke
an ink-anchored test: a calcium soup ion's gradient stops land on screen
before anything else, so C5's raw `ca.mid` anchor now matches the soup — the
anchor became the door's white-lit species stroke, an ink only the channel
drawing mixes.

**G4 — "remove reset button; after the animation, reset to new."** ⚠
Reconciled with "every transport that can reach an end needs a control that
says start over" rather than traded against it: a run that PLAYS to its end
now holds for `SYNAPSE_END_HOLD_MS` (2.2 s — clearing at the instant it ends
would wipe the last thing it teaches) and then puts itself back to rest, so
the transport can never strand at an end, and the start-over control is the ⚡
button the reset hands back. The stamp is set only by playing to the end,
never by scrubbing — a user parked at u = 1 by the slider is not yanked back
under their thumb.

1098 tests green, typecheck clean. G1 was broken (drip born inside → "starts
in the cleft" failed) and G3 was broken (pre-soup pushed below the wall →
containment failed); both watched.

### Step 20i — nothing teleports, 2026-09-01 (round 8)

Three asks, two of them against pinned rules — both conflicts were quoted to
the user, who chose the reconciliations.

**H1 — "the AP flash should be fast."** The spike's leg went 13% → 6% of the
screen; the freed time went to the beat after it, so the jolt is quick and the
red it leaves is what gets dwelt on.

**H2/H3/D1 — "neurotransmitters should not teleport — come out of vesicles,
move around, some bind."** ⚠ Head-on against *the transmitter appears already
spread — never a journey* (the crossing is 0.61 µs; drawing it as a trip is
wrong ×4000). User chose the honest middle, EMERGE–WANDER–BIND, which
animates only the millisecond-scale events: `emergingCargo` (each dot slips
out through the open mouth and dissolves into the cloud), a bounded THERMAL
wander on the cloud (time-driven only — a guard pins that concentration still
cannot move a particle, so the no-journey rule survives), and
`seatedTransmitter` rebuilt on the model's own `bound` series: a pair is
CAPTURED (settles the last pixels out of the cloud onto the seat), HELD, and
LET GO (drifts up, fading into the same clearance) — no dot pops into or out
of existence anywhere.

**H5 — "a postsynaptic flash like the presynaptic one, moving off the
canvas."** ⚠ Against the round-5 pushback (an EPSP is not a spike). User chose
TRAVELS BUT DECAYS: `departingFlash` — the arrival's grammar, the opposite
truth — launches when the model's own `vmPost` reaches 60% of its swing, runs
down the dendrite and off the bottom edge in 2.8 model ms (cable spread toward
the soma really is millisecond-scale), SHRINKING AND DIMMING the whole way.
The decrement is the science; a guard pins alpha falling below half before it
leaves.

1101 tests green, typecheck clean. H2 was broken (dots never left the bubble)
and H5 was broken (constant-brightness knot — a drawn dendritic spike); both
watched to fail.

### Step 20j — the continuity round, 2026-09-01 (round 9)

Two concerns, both verified as DRAWING artifacts (no science conflict), both
fixed.

**I1 — "entering ions look half transparent, as if born inside the
channels."** Confirmed: the drip's sine envelope faded ions IN on the
approach, so full strength arrived only in the pore. An entering ion is a
fully real soup ion the whole trip — `entryAlpha` now ramps up quickly OUT
AMONG THE SOUP (so nothing pops), holds full opacity through the channel, and
melts only at the far end into the interior crowd. Both drips (calcium at the
doors, sodium at the receptors) share it, and both start deeper on the outside
so the approach begins where the soup lives. Guard: every ion within the
membrane's own band is at ≥ 0.95 alpha.

**I2 — "no neurotransmitters materialize in the cleft; those which leave the
vesicles bind."** Confirmed: emitted cargo dissolved while a separate cloud
faded in — two populations, no identity. Now, with the run in hand, every
cloud particle is BORN AT A FUSED VESICLE'S MOUTH — exactly where the emitted
cargo dissolves — and puffs to its seeded standing place in `DISPERSE_MS`
(0.06 model ms, ⚠ declared in `CLEFT_NOTE`: still ~100× slower than the real
0.61 µs crossing, and a blink on screen, because anything slower would draw
the one journey this exhibit exists to deny). The captures then pull pairs
from that same cloud, closing the chain of identity: bag → mouth → cloud →
seat. Side profit: a run with nothing yet released now shows an EMPTY gap,
killing the sampling slop that let a whisper of cloud precede the first
fusion. The no-journey guards survive intact: concentration still cannot move
a particle, and the settled cloud is byte-identical to the run-less one.

1103 tests green, typecheck clean. I1 was broken (sine envelope restored →
0.89 in the pore) and I2 was broken (births skipped → particles materialized
mid-gap); both watched to fail.

### Step 20k — the identity round, 2026-09-01 (round 10)

The user's ruling, ending three rounds of piecemeal anti-teleport fixes: "all
ions and all neurotransmitter balls have identity; they live in the soup,
visible from the very beginning; each has its own travel trajectory; none
fades, none materializes, none teleports."

**Built: `stage/synapseCast.ts`** — three fixed-size casts replacing every
particle *effect* (the cycling drips, the concentration-faded cloud, the
threshold-popping crowds, the popping seats):

- **Transmitter (35 balls, 7 per vesicle).** In its bubble → out through its
  own mouth → a blink of a puff to a standing place NEAR that mouth (spread
  across the zone comes from the mouths being spread) → thermal wander → its
  fate: captured onto a receptor's seat (two per receptor that binds, released
  when it lets go) or out an end of the gap into the bath, where it rests.
- **Calcium (14 ions).** Waiting in the cleft from frame one; ion i enters
  when the model's own INTEGRATED CURRENT crosses its rung; through the
  nearest door to a vesicle's feet; leaves the zone when the clearing average
  falls below that same rung — buffered deeper into the terminal, never
  dimmed.
- **Sodium (2 per receptor).** Waiting above its receptor; crosses when the
  model's `open` crosses that receptor's rung; settles in the spine. A
  receptor that never opens keeps its pair waiting — the honest shut door.

Deleted as superseded: `transmitterCloud`, `emergingCargo`,
`escapedTransmitter`, `seatedTransmitter`, `calciumEntry`, `postsynEntry`,
`terminalCalcium`, and the soup's overlap species (one population per
substance, never two). Conservation became a test: the cast's length never
changes, and the teal ink at rest EQUALS the teal ink mid-release.

⚠ **The new teleport guard (J1) walks SCREEN time** — `synapseClock`, every
cast, every step, per-ball movement bounded — and caught two real faults on
its first run: the puff outran the screen step in a fast leg (stands moved
local to their mouths), and a path plunged 114 px where the bulb's flank turns
steep (travel through the gap now interpolates (x, wall-fraction) and asks the
membranes for y at every step; stands, waits and exits keep to the apposed
region; bath rest-spots moved to the pocket the gap actually opens into).
Folded into 03-architecture as *Loose matter has identity*.

Performance made it honest to run: crossings, calcium times, `activeZone` and
`dockedY` are memoised per run/geometry (pure, so the caches cannot go
stale) — the guard evaluates ~70,000 cast frames in under a second.

1101 tests green, typecheck and build clean. J1 was broken (near-instant puff
→ "ball 0 jumped 78 px") and conservation was broken (escaped balls dropped →
conservation, departure and continuity all failed); both watched.

### Step 20l — eight corrections, 2026-09-01 (round 11)

**K1 — "vesicles should only start merging when calcium is visibly bound."**
Right science, wrong schedule: fusions at 2.59–2.75 ms could precede the drawn
ions' arrival. The two earliest ions anchored to each FUSING slot now have
their entries clamped to land at its feet before its fusion instant — a
declared curation, and the more honest one: the charge those ions carry
genuinely came in first. Guard: at every fusion instant, an ion already rests
at that slot's feet.

**K-2 — "released transmitter should stay in the cleft for reuptake."**
Correct science for this window (transporters work on a slower clock), so a
ball a receptor lets go now lifts off and LINGERS in the cleft, wandering,
to the end of the run. The gap at the end holds exactly the released balls;
the payload-share guard now counts the release FLOOD above that baseline.

**K-3 — calcium after entry, verified.** No change: buffering (the model's own
`BUFFER_RATIO`) dominates this 60 ms window, which is what "carried deeper and
held" draws; pump extrusion is slower and drawing ions exiting through an
undrawn pump would violate the machinery rule.

**K-4 — "the zoom does not correspond to the perspective it lands on."** ⚠ A
real sign error: Konva's positive rotation is clockwise on a y-down canvas, so
`turn: −π/2` landed the world with the TARGET ABOVE and the axon below —
180° against the view that then faded in. Now +π/2; the place-guard updated.

**K-5 — vesicles of different sizes.** ⚠ With the REAL spread: synaptic
vesicles are famously uniform (±10% in diameter), so `vesicleScale` stays
inside that — a bigger spread would be less realistic, not more. Threaded
through docking (each slot solved for its own radius), fusion, cargo rings and
the calcium feet offsets; declared in `VESICLE_NOTE`.

**K-6 — "unrelated pieces of SVG in the bottom corners."** The traced shaft's
END-CURLS: the reference's lower shape curls up at both ends, and stretched
across the frame those towers peeked into the corners. `easeShaftY` blends the
profile to a level baseline near the frame's edges; the dendrite continues out
of frame LEVEL, and the spine's root in the middle is untouched.

**K-7 — "ions jiggle at the end but not before."** True, and not scientific:
the wobble rode the MODEL clock, which crawls early and races in the tail.
Thermal motion never pauses — the jiggle now rides an ambient screen-time
clock (`SynapseView.jiggle`, fed by the stage's frame time), so the soup
trembles at rest, through the beats, and at one pace. Tests keep the
deterministic default.

**K-8 — D06: lipid identity and floating calcium.** The drawer's fusing ring
DELETED its mouth molecules and then the whole ring. Now it is THE OMEGA,
UNROLLED: every phospholipid keeps its ring angle for ever; the part of the
circle past the wall lies unrolled along it — arclength onto the line, exact
material conservation — until the whole ring IS wall, and stays drawn as
such. The original wall's molecules are pushed outward to make the room
(never skipped), the oily core stops at the omega's feet, and the retrieval
runs the same morph backwards. ⚠ Found on the guard's first run: a sphere's
waterline sweeps at INFINITE rate at first contact (the √-ramp), flicking the
first-submerged lipids 36 px in a step — the sink is now driven by the
waterline's ANGLE at constant rate, which bounds every lipid's speed and eases
both contacts (the depth follows a sine). And the four calcium ions each FLOAT
IN from beyond the frame, seat on their own sites at the exact moments the
model fills them, ride the vesicle, and float out at the collapse — one
trajectory each, walked by a continuity guard.

1105 tests green, typecheck and build clean. K1 was broken (deadline clamp
removed → no ion at vesicle 4's feet at 2.64 ms) and K2 was broken (unrolled
lipids offset → waterline jump); both watched to fail.

### Step 20m — two corrections from a screenshot, 2026-09-01 (round 12)

**L1 — "place active vesicles closer to the postsynaptic area."** Docked
means TOUCHING: the docking clearance dropped from a full membrane thickness
of daylight (`r + MEM_PX`) to contact (`r + MEM_PX·0.4`) — the bubble's
outline now meets the wall's ink. Side effect, absorbed: the sinking window
before the mouth opens shrank to ~0.02 model ms (contact is 2 px from
crossing), so the outline-skip guard samples inside that sliver and the D2
sink-motion bound is the mouth's own opening (~half the vesicle's radius).

**L2 — "remove the lines at the bottom that do not belong."** Found: the
dendritic shaft's membrane was stroked on its CLOSED path, which inked the
off-canvas closing edges — two lines running to (±40, height+40) that cut
across the visible bottom corners. `shaftSurfacePath` traces only the open
surface run; the closed `shaftPath` remains for fills and clips. Guard: the
surface trace never touches the closing edges' row (their exact y is pinned,
because the wander's own curve controls legitimately dip deeper than any
blanket bound).

1106 tests green, typecheck clean.

### Step 20n — the cluster round, 2026-09-01 (round 13)

**M1 — "is it correct that most released transmitter goes into extracellular
space?"** YES, emphatically: a packet is ~4,000 molecules against fewer than a
couple of hundred postsynaptic binding sites, so only a few per cent are ever
caught; the rest diffuses out of the cleft within a fraction of a millisecond
into the astrocyte transporters that ring every synapse (outside this frame).
The drawing's 10-of-21 caught actually OVERSTATES capture so catching is
visible at all — now declared beside the other exaggerations
(`CAPTURE_NOTE`).

**M2 — "by 'active' I meant those which will fuse — place them closer to each
other; revert the hover if that is more correct."** Re-seeded so the fusing
trio is the ADJACENT cluster {slots 2, 3, 4} (2.59 / 2.67 / 2.78 ms, the
middle still last, on camera, with the cloud at 71% of peak; the weak run
still fires nothing). Every generic guard — middle-last, trigger-before-
fusion, conservation, continuity — carried the new cluster without a line
changed, and C1 now pins contiguity. The hover is NOT reverted, on science:
docked is defined morphologically as membrane CONTACT (the SNARE/RIM
machinery holds the vesicle against the plasma membrane); it is the TETHERED
reserve pool that hovers, and it already does.

1106 tests green, typecheck clean.

### Step 20o — the shaft, measured at last, 2026-09-01 (round 14)

**"The bottom of the canvas still contains elements."** Round three of the
same corner debris, and this time it was MEASURED instead of patched: at the
bouton's scale the reference shaft's 20-unit relief maps to ~280 px, so the
surface's whole midsection ran a hundred pixels BELOW the canvas — the only
visible parts were the two eased edge pieces, stranded in the corners like
debris, plus their dives toward the submerged middle. ⚠ THE WANDER IS A
TEXTURE, NOT A DISTANCE: `SHAFT_RELIEF = 0.25` compresses the vertical
mapping only (the horizontal is untouched), so the entire surface now lives
on screen — level at the edges, a gentle 40 px dip mid-frame, the spine
rooting ON it instead of below the frame. Guard extended: every point of the
surface trace is on-canvas.

1106 tests green, typecheck clean.

### Step 20p — astrocytes on the list, and three more lines, 2026-09-01 (round 15)

**Astrocytes are a feature now.** They were only a caveat inside S14; the user
asked for them on the list, so **S15 — the astrocyte, the synapse's third
cell** — is specified: a process wrapping the synapse whose EAAT transporters
take up the escaped glutamate S12 already shows drifting out of the cleft,
with the glutamate–glutamine cycle handing material back. Not yet built; the
spec row says where it must sit (where the escaped balls already come to
rest, so the two views tell one story).

**"Keep working on the lines."** Three more offenders, fixed structurally:
the shaft FILL's closing edges ran to x = ±40 — inside the canvas
horizontally — so the translucent fill's boundary cut a visible diagonal
across the bottom (now closed by vertical drops beyond ±1.1× the width, every
closing edge off screen); the spine's membrane stroked its own CLOSING edge —
a notch hanging under the shaft's surface (the band now strokes an OPEN
outline); and the shaft's surface line ran straight across the neck's mouth,
walling the spine off from its own dendrite (now punched out over the
opening, with the same even-odd punch the tears use).

1106 tests green, typecheck clean.

### Step 20q — the shaft rebuilt, 2026-09-01 (round 16)

**"The lines look fine, but the fill is now outside."** The sixth appearance
(superseded one round later by 20r, which removed the shaft entirely)
of the same family of fault, and the last: the traced reference wander —
20 units of relief, self-disagreeing once eased — had now failed in every way
a path can fail (corner curls, closing-edge diagonals, a submerged midsection,
and finally a fill escaping its own stroke). ⚠ A RIGHT SOURCE CAN STILL BE AN
UNREADABLE VIEW — REBUILD THE VIEW: the shaft's profile is SYNTHETIC now.
`shaftLineY` is one pure function — a level line with a gentle sag under the
synapse (a dendrite bows where a bouton presses on its spine) — and the
stroke, the fill, and the spine-root sampler all read the SAME function, so
they cannot disagree again. The reference trace stays in the file for the
record; the bouton, which is the exhibit's subject, keeps the user's drawing
untouched.

1106 tests green, typecheck clean.

### Step 20r — the postsynaptic side matches the wide view, 2026-09-01 (round 17)

**"The shape is in general wrong in comparison to the area in the big-neuron
view."** True, and structural: out on the whole cell, our bouton synapses
onto the TIP of the target's dendrite branch, which (after the landing
quarter-turn) runs DOWN toward the target's soma — while the close-up drew a
spine on a horizontal dendrite crossing the whole frame, a shape the wide view
never shows. The postsynaptic side is now that same object magnified: spine
head at the cleft, narrow neck, and the dendrite WIDENING DOWNWARD out of the
frame toward the soma — one open outline, head to trunk, every joint a cubic.
The spine-on-dendrite science (S13's "Ca²⁺ enters the spine") is untouched.

Side effect, welcome: the horizontal shaft — six rounds of bottom-of-canvas
debris — is gone from the drawing entirely. Its draw functions were deleted
(a guard for an undrawn line is a claim that rots); the reference trace and
`SHAFT_BOX` stay in `boutonShape` for the record. The EPSP's departing knot
now visibly travels INSIDE the dendrite it leaves through.

1105 tests green, typecheck clean.

### Step 20s — the wide view grows the demo's anatomy, 2026-09-01 (round 18)

**"Improve the zoomed-in big image with the demo synapse."** The wide scene's
outgoing synapse was a blob for the bouton and a bare line for the target's
dendrite — fine at ×1, nonsense at ×100, and nothing like the picture the
zoom lands on. Now, on the way down (`outgoingDetailAt`): the stand-ins
dissolve OUT between ×8 and ×16, and between ×16 and ×40 the demo's own
shapes dissolve IN — the user's traced bouton outline with its docked
vesicles, and the target dendrite's tip as the demo's spine head, neck and
widening trunk — seated in scene coordinates and oriented along the actual
stub, so the landing quarter-turn brings the picture into register with the
view that then fades in. ⚠ The two ramps DO NOT OVERLAP (level of detail
dissolves, and the two representations are never both on screen) — pinned by
the scene's first test file (`drawScene.test.ts`, M1).

1106 tests green, typecheck and build clean.


### Step 20t — labels adjusted, and the active zone becomes a PLACE, 2026-09-01 (round 19)

**"Adjust labels places."** The 'active zone' caption hung centred over the
docked row and landed ON the vesicles once docking became touching-contact.
`activeZoneLabelAt` seats it just outside the zone's right end, hugging the
membrane it names, stacked above 'synaptic cleft'; the 'vesicle' label nudged
clear. Guard: the caption keeps its distance from every bubble.

**"Create the same demo, but at the scale in the image."** The user chose the
DEEPER PLACE: `active-zone` is a new zoom target at ×4 the synapse view's
magnification. Not a new view — the synapse view itself keeps running and the
camera continues INTO it, scaling the layer about the zone's centre; labels,
captions and lens doors dissolve on the dive (`SynapseView.chrome`), because
words and doors would be giant. Same run, same balls, same clock — watched
closer. Doors: a second magnifier ON the zone beside its caption (`zoneLens`),
and a marker on the whole cell offset a diameter from the synapse's own (two
doors at one place, two icons). ⚠ `arrivalAt` is a single-scale band and would
have BLINKED the view out midway between the two places — `arrivalSpan` holds
it home across the whole range, pinned by a guard.

1108 tests green, typecheck and build clean.

### Step 20u — six things the close frame revealed, 2026-09-01 (round 20)

**P1 — "the postsynaptic flash highlights the dark fill of fusing vesicles."**
Found: the departing flash's glow was painted BEFORE the pockets, whose opaque
lumen fill then cut dark holes in the light. Both travelling flashes are now
painted last of all the physics — the glow washes bath and lumen alike, and
since they are the same ink they now LOOK the same, which is the topology's
own claim.

**P2 — "we need to display the SNARE complex — Ca ions bind to nothing."**
`snareMini`: each docked vesicle carries a miniature of D06's cast — the
three-strand rope (D06's own strand colours) between base and wall, and a
synaptotagmin knob on each side, placed exactly where the calcium cast's ions
come to rest (the rest band was pulled onto the knobs). Guard: every calcium
ball resting in the zone at the run's end sits within a vesicle-radius of a
knob. The machinery disassembles with fusion.

**P3 — camera down at the zone place: the dive anchor moved below the foot so
the receptors sit fully in frame.**

**P4 — "ligand-gated channels are upside-down."** A real bug: a leftover
rotate(π) put the binding seat INSIDE the spine. The traced channel's seat is
on its extracellular mouth at local −y — already toward the cleft — so the
rotation is gone.

**P5 — "neurotransmitters should move slower."** Every travel leg got more
model time (emerge 0.9→1.5 ms, capture 0.9, release 1.3, exit 1.5, bath glide
5.5). The DISPERSE blink stays a blink: that one is the no-journey rule's.

**P6 — "make the bilayer look like made out of phospholipids."**
`membraneLipids`: at the zone's depth the bands resolve into rows of heads —
drawn by the app's ONE membrane paver, dissolving in exactly as the chrome
dissolves out, and skipping torn spans (a torn wall has no molecules left
there to show). At the synapse's own magnification the band remains the
honest drawing, per this file's founding LOD note.

1110 tests green, typecheck clean. O1 was broken (knob displaced two radii →
"calcium rests on the knobs" failed at 59 px); watched.

### Step 20v — four things the bilayer depth revealed, 2026-09-01 (round 21)

**Q1 — "phospholipids should look like a bilayer; not overlap channels;
vesicles made of them too."** The depth-lipids got smaller heads and wider
leaflet separation so the two rows read as two rows; `membraneLipids` skips
the spans under every door and receptor (a channel REPLACES the lipids it
displaced); and at depth every intact bubble resolves into a ring of the same
molecules (`vesicleLipids`), paved by the same paver.

**Q2 — "postsynaptic channels open before neurotransmitters got bound."**
True: the model's open-crossing could precede the drawn pair's landing.
`receptorSeatWindow` (built on the same fate assignment the cast animates —
extracted, shared, so they cannot disagree) gates every receptor's drawn
socket AND open state on its pair being visibly seated; and pairs hold a
declared `RELEASE_HOLD_MS = 5` past the model's unbinding, so users have time
to read cause before effect. Guard: at seatedAt + ε the pair is on its seats,
just before it is not, and drawn-open is structurally impossible earlier.

**Q3 — "ions strictly through the middle of the channel."** The sodium pair
crossed at ±4 px; both balls now cross at the channel's own centre — the
stagger is in TIME, never in x. (Calcium already crossed centred.)

**Q4 — "make the cleft wider so the ball-on-rope clears the postsynaptic
membrane."** CLEFT_PX 26 → 34, still declared beside the real 20 nm; the
falls-away guard re-anchored to the face's own edge (the bulb's flank out
there rises too steeply to be the reference).

1111 tests green, typecheck and build clean. Q1's window was broken (seat time
collapsed to the bind crossing) and watched to fail.

### Step 20w — the causal chain, timed for reading, 2026-09-01 (round 22)

**S1 — "phospholipids as in the bilayer bench."** The zone-depth lipids adopt
the bench's own proportions (HALF_MEM/HEAD_R = 5): small heads, LONG tails,
two clearly separate leaflets.

**S2 — "is it correct that docked vesicles touch or overlap the bilayer?"**
Near-contact yes, overlap no — and the PRIMED state is the picture worth
drawing: half-zippered SNAREs hold the vesicle a few nanometres off the
membrane. Docking clearance became a small visible gap (r + 1.6·MEM_PX),
spanned by the rope, which is also what lets the rope's PULL be seen.

**S3 — "Ca ions bind on the placeholders, hold ~1 s, then fusion."** The
calcium cast's rest positions now ARE the synaptotagmin knobs (taken from the
same `snareMini` the drawing places; knobs re-anchored to the wall at their
own x after the sloped outer slot caught one 4 px inside the membrane), and
the arrival deadline gained margin so, on the legged clock, every trigger ion
sits on its knob for well over a second of screen time before its vesicle
goes. Guard R2 measures that hold through CLOCK_LEGS.

**S4 — "Na ions penetrate before the transmitter is bound."** The whole
postsynaptic chain is now built on the shared seat windows: pair seats → holds
`BIND_HOLD_MS` (~1 s on screen) → the channel opens (`receptorOpenWindow`;
null for a receptor whose gate the model never opened — it catches and stays
shut, the honest minority) → `NA_PAUSE_MS` → the sodium crosses → a beat →
`departingFlash` launches only after the FIRST pair has flowed in. Guard R1
walks the order end to end; broken (pause removed → sodium in the spine
early), it failed at receptor 0 and was restored.

1113 tests green, typecheck and build clean.

### Step 20x — slower still, and lipids inside the contour, 2026-09-01 (round 23)

**T1 — "balls still move jerkily; replace with slow movement."** Diagnosed by
leg: the TAIL leg compresses 51 model-ms into ~2.4 s of screen, so anything
millisecond-scale there flicks (release lifts, buffered-calcium drifts); the
sodium legs were 0.25–0.5 ms (~0.1–0.2 s); the puff was a deliberate blink.
Every travel leg got more model time (release 4 ms, buffer drift 8, exits
3.5, bath glide 7, Na legs 0.7/1.2/1.0, stagger 0.8) and the puff eased to
0.18 ms — still ~300× faster than any journey-reading, its guard bound moved
with it. One guard refinement followed: an ion the buffers are mid-carrying
at the window's end is exempt from the on-its-knob claim — it left by travel.

**T2 — "scale lipids ~2× down; display phospholipids during fusion."** Heads
0.6 px (bilayer now fits INSIDE the drawn band), packing tightened to the
bench's own density — and the FUSING vesicle keeps its molecules: the
standing omega arc is paved (the submerged rest have become wall, whose own
rows part at the tear), so fusion at depth reads as molecules joining a
molecular wall.

1113 tests green, typecheck and build clean.

### Step 20y — constant speed, and the ghost band, 2026-09-01 (round 24)

**U1 — "green balls speed up without a reason after release."** True and
measured: the emerge leg ran at ~25 px/model-ms while the spread leg ran at
~640 — a ball lurched the instant it cleared the mouth. Both legs now take
their DURATIONS from one speed (`NT_SPEED = 30 px/ms`, per ball: distance
over speed), shared verbatim by the seat-window arithmetic so the chain's
clocks moved with it. Knock-ons absorbed: a receptor whose pair seats after
the model's population already unbound now holds a guaranteed readable beat
(`max(tDown + hold, seated + 2.5)`), and the payload-share bounds moved with
the wider flood window.

**U2 — "the vesicle membrane visually breaks before fusing — a ghost
outline."** Found: the sinking vesicle's outline was clipped against the
wall's strip from fusion's first frame, cutting its bottom arc while the
bubble was still clear of the wall. The skip now engages only once the circle
actually TOUCHES the membrane band, with a tighter pad; the outline stays
whole until contact, then merges.

1113 tests green, typecheck and build clean.

### Step 20z — the pink rush, 2026-09-01 (round 25)

**"Pink balls still rush at high speed at the end."** The buffered calcium
drift (knob → deep interior) took 8 model-ms — a third of a screen-second in
the compressed tail leg, over hundreds of pixels. `CA_BUFFERED_TRAVEL_MS`
8 → 26: a buffered ion now glides away over more than a second wherever in
the run it clears. The two feet-guards (E4, O1) filter to RESTING ions — one
mid-carry at the window's end has left its knob by travel, which is the
design, not a fault.

1113 tests green, typecheck clean.

### Step 20aa — the calcium's pace, leg by leg, 2026-09-01 (round 26)

Three "rush" reports, each pinned by its timer reading: the early/4 ms rushes
were the entry legs (0.3/0.3/0.4 model-ms — fine in the slow-motion early
legs, a blur at gap-leg pace for the charge-paced late entries) → now
1.0/0.6/0.7, inherited by the fusion-deadline clamp with a t = 0.15 floor so
no ion starts before the run; the 11 ms "rushing around" was the buffered
drifts clustering their starts in the tail → 26 → 45 ms, a calm glide at
tail compression. R2's on-knob hold survives at ~0.95 s for the earliest
fusion (the beat carries it).

1113 tests green, typecheck clean.

### Step 20ab — calcium stays put, the flash goes under, 2026-09-01 (round 27)

**V1 — "at 4 ms Ca ions rush to the sides."** An ion's entry door (nearest
its RANDOM wait spot) and its destination knob (fixed slot assignment) could
sit at opposite ends of the zone, so its settle leg dashed across. Each ion
now WAITS BESIDE ITS OWN ANCHOR: it enters through an adjacent door and
settles a few pixels — in the vicinity for its whole life.

**V2 — "at 9 ms Ca ions rush up."** The buffered clearance carried ions
100–200 px deep into the terminal. The science prefers the user's
expectation: buffer proteins are everywhere, so a grabbed ion stops WHERE IT
IS. Buffered ions now slip a short way off their knobs into the nearby
cytoplasm (≤ ~2.6 r) and rest there — clearance still thins the knobs on the
model's caUm clock, by a calm local drift.

**V3 — "display the postsynaptic flash below the bottom screen edge."** The
departing nudge now emerges UNDER the canvas and recedes further; what shows
is its glow bleeding up over the bottom edge, dimming as the signal leaves
for the soma — no knot materialising beside the cleft.

1113 tests green, typecheck clean.

### Step 20ac — the synapse's chrome joins the app's patterns, 2026-09-01 (round 28)

**W1 — "instead of a magnifying glass, a scale switch, top right."** The two
framings (whole synapse / active zone) are now a two-way switch in the top
right corner — the axon views' own radiogroup pattern: both named, the one
you are in lit, each press a `zoomTo` so the camera still performs the dive.

**W2 — "replace the magnifying glass with a shortcut button, as on 'The AP',
bottom left, both views."** The way into D06 is the membrane patch's own
shelf pattern: one labelled button (🫧 Vesicles & the SNARE machinery),
bottom-left of both framings. The on-canvas magnifiers and their hit circles
are deleted; the old "door ON the thing" test now pins what remains pinnable
(the drawer's home gates which chrome advertises it) and records the user's
override of the magnifier grammar for this view.

1113 tests green, typecheck and build clean.

### Step 20ad — the chain gets its own leg, and binding gets its snap, 2026-09-01 (round 29)

**X1/X2/X5 — "at 9.6 ms Na rushes; at ~10 the animation speeds up; increase
the general duration."** One root: the tail leg squeezed 51 model-ms into a
sixth of the screen, so everything after ~9 ms fell off a pacing cliff. The
run is 20 s now (ratio guard 300 → 400), and the postsynaptic chain
(9→18 ms: opens, pauses, sodium, the departing nudge) has a LEG OF ITS OWN;
only the true clearing (18→60 ms) remains compressed — and nothing
millisecond-scale plays there any more. Na legs also eased (0.9/1.5/1.2).

**X3 — "emphasize binding, as in the ligand demo: white aura, snap into
place."** `bindPulses`: a brief white `softGlow` — the bench's own white-hot
idiom — at the instant of every seating: calcium onto its knob, transmitter
into its cup. Computed from the same arrival arithmetic the casts move by,
so a pulse can never fire beside an empty seat.

**X4 — "at 4.6 ms a Ca ion from the right channel rushes."** Addressed by the
global slowdown (the gap leg's pace eased with the 20 s total); the entry
legs themselves were left alone because the fusion-deadline clamp needs them —
an ion must still beat its vesicle to the knob.

1113 tests green, typecheck clean.

### Step 20ae — four adjustments and an inherited aura, 2026-09-01 (round 30)

**Y1 — "make the presynaptic flash 5 ms duration."** `FLASH_LIFE_MS = 5`: the
jolt still arrives fast (travel done by the spike's peak) and then dies away
slowly to the 5 ms mark instead of vanishing when the voltage drops.

**Y2 — "Ca ions sparkle twice — what does the second sparkle mean?"**
Answered, not changed: the ~5.5 ms sparkles are the LATER calcium cohort —
the ions paced by the real charge influx rather than a fusion deadline —
binding the spectator vesicles' sensors and stacking third ions onto occupied
knobs. Same event, later arrivals; honest, kept.

**Y3 — "keep Na ions fixated at the channels."** The waiting pair now sits at
its channel's mouth, near-still (quarter wobble), until the gate's own
moment; the crossing is its only journey.

**Y4 — "left vesicle's NTs go left, right one's right, middle spreads among
the channels."** `standXOf`: one shared stand-position rule (outer fused
vesicles spread strictly outward; the middle across the receptor row) used by
the cast, the fates, the seat windows and the pulses alike, so nothing can
disagree. The payload-share guard recalibrated: the release now occupies a
real slice of model time (~11%), so the legs' advantage is smaller but still
required.

**Y5 (mid-turn) — "Ca keeps its aura longer; let Na inherit it."** Sodium
arrivals in the spine now fire the same white snap, with a longer MODEL pulse
(`NA_BIND_PULSE_MS = 5`) so it reads as long on screen as calcium's does —
calcium binds in the slow early legs, sodium settles in the quicker chain
leg.

1113 tests green, typecheck and build clean.

### Step 20af — the timeline tool, 2026-09-01 · done

**A1 — the tool.** `src/ui/Timeline.tsx` + `src/ui/timelineMath.ts`: one wide
bar per run — track, filled portion, a dot per main event, a named chip under
each dot with its own 🔊 (the F04 speaker speaks the name; the rest of the
chip rewinds). Chips stagger onto a second row where neighbours would collide
(`labelRows`, tested).

**A2 — rewind, never teleport.** Pressing a label, a dot, or the bare track
GLIDES the run to that moment — ease-in-out, ~0.35 s + 1.1 s per full bar,
driving the store through every intermediate position on the glide's own rAF
clock. Works in both directions (user chose: forward glides too). A run that
was playing when pressed resumes on arrival (tape-player, user's choice); a
paused one stays put. Continuity and monotonicity pinned in
`timelineMath.test.ts`.

**A3 — the drag control.** The thumb drags (pointer capture); a track press
that turns into movement converts from glide to live scrub.

**A4 — the action button stays.** All three sites keep their ⚡ / ▶ pair
beside the tool; the bare `<input type=range>` sliders are gone.

**A5 — three sites.**
- *The AP* (membrane patch pill): dots at `apSteps`' own measured moments,
  named via the new `STEP_NAMES` (speakable words — "sodium opens", not
  "Na⁺"); the beat banner moved down to clear the taller pill.
- *The synapse* (both framings): `synapseEvents(run, cleft)` dates the dots
  off the run itself — the spike (0.4 ms), calcium in (1.75), first fusion,
  first seating, first opening, the nudge's launch (via the new
  `nudgeLaunchMs`, ONE copy shared with `departingFlash`), clearing (18) — and
  the new `screenOfModel` (inverse of the legged clock, roundtrip-tested)
  places them on the transport's own bar. A weak run drops the events that
  never happen.
- *Vesicles & the SNARE machinery*: the stage-chip row and slider REPLACED by
  the timeline (user's choice); dots at each stage's own start so the lit chip
  always agrees with the "Right now" caption.

1122 tests green (9 new, citing A1/A2/A5), typecheck clean.

### Step 20ag — stillness, the kept aura, reflection pauses, seats that fit, 2026-09-01 · done

**A1 — bound ions are STILL.** Seated calcium (on a knob), buffered calcium
(grabbed deeper in) and settled sodium lose the soup wobble entirely; ions
still free — waiting in the cleft, or the surplus calcium — keep the thermal
jiggle, so motion itself says free-vs-bound. Declared exaggeration: cytosolic
sodium is really still free and jostling; the stillness marks "arrived and
done", same as its aura.

**A2 — sodium keeps its white aura** at full strength from arrival until its
OWN receptor's `closeAt` (user chose: the glow and the open door end
together), then fades over `NA_BIND_PULSE_MS`.

**A3/A4 — the reflection pauses (~1 s each, user's choice).** `NA_PAUSE_MS`
0.5 → 2.5 (open → flow); the nudge's lag 0.8 → 3.5 ms (ions settled → signal
departs); `RECEPTOR_OPEN_MS` 3.5 → 10.4, so the door now outlives both
crossings plus a ~1 s hold — it used to close while the second ion was still
mid-pore. The chain leg stretched 9→18 to 9→21 model ms (share 0.13 → 0.17,
taken from the clearing) so the launch (~17.7 ms) and the closes (18.1–21 ms)
play at the leg's ~0.28 s/ms instead of falling off into the compressed tail;
the 'clearing' timeline dot moved to 21 ms with it.

**A5 — every seat fits.** The invented "tier" stacking is gone: two knobs per
vesicle = ten seats, and each of the first ten ions gets its OWN knob, dead
centre. The four surplus ions never pretend to bind — they settle nearby as
free calcium (the honest picture: calcium beyond the sensors' capacity stays
free until buffered) and fire no binding pulse.

Guards: seated-still vs waiting-jiggles (Na and Ca), aura full-until-close,
clock-walked ≥0.7 s pauses, knob-exactness + surplus-never-on-a-knob — each
broken deliberately once and watched fail (the old O1 guard tolerated the
tier offsets; the new A5 one does not). 1127 tests green, typecheck clean.

### Step 20ah — full-width timeline; the plugged pair serves the whole transaction, 2026-09-01 · done

**A1 — the timeline is the canvas's own width, action button in front.** All
three sites became one row: ⚡/▶, then the bar (the `Timeline` now fills its
container and measures itself for the label stagger), then the readings. On
the synapse the top-right scale switch rides the same plate's right end —
a full-width bar leaves no separate corner; the AP beat banner moved back up
to clear the now single-row pill.

**A2 — the receptor's transaction, in order.** The plugged transmitter pair
now stays for the WHOLE transaction: capture → hold → the channel eases open
over `OPEN_EASE_MS` with the pair riding the drawn socket (`ntSeatAt` reads
`ligandSeat`, the socket that slides with its subunit; k = 1 mirrored) →
sodium flows → ~1 s reflection with the door open → every white glow (NT and
Na together) fades over `GLOW_FADE_MS` → the pair lifts off
(`NT_DEPART_LEAD_MS` before the close) → the door eases shut. Release is
owned by ONE function (`receptorSeatWindow`, scheduled off the door's own
`closeAt`; a receptor that never opens falls back to the model's unbinding),
and the cast's private copy of that arithmetic is gone. Plugged means
plugged: the seat wobble is removed. `RECEPTOR_OPEN_MS` grew to 12.6 to hold
the tail; the chain leg stretched to 9→24.5 ms and the whole run to 22 s so
nothing new falls into the compressed clearing.

Recalibrations, each a real consequence: the flood threshold rose to ≥11
(all TEN captured balls now linger for reuptake, none stays plugged at the
end); D1's end-state flipped to "nothing seated, every captured ball
lingering"; the seat-slide guard checks tracking, not amplitude (the drawn
socket's own slide is ~1.9 px). New guards: glow-holds/dies-together,
seat-tracking (ball exactly on the moving socket), beats-in-order walked on
the screen clock — broken once (early release) and watched fail. 1129 tests
green, typecheck clean.

### Step 20ai — timeline ends, slim row, obvious events, 2026-09-02 · done

**A1 — clickable ends.** Two larger points (14 px vs the events' 9 px) sit at
the very start and end of every timeline; pressing one glides there. An event
that sits at an end (the AP's "resting"/"back to rest") is represented by the
end point itself — its chip stays, its small dot does not stack on the big one.

**A2 — timer rightmost, slim row.** Every transport row now reads: action
button (+ that view's own switch — 🔆 on the patch, 🕸/🔍 on the synapse),
then the bar, then the ms timer at the right end. The element slimmed: 38 px
buttons on the AP pill (was 46), tighter track and label rows (~46 px total,
was ~56), thinner padding; the beat banner moved back up to 84 px.

**A3 — "what is 'the nudge'?"** Answered: the departing EPSP flash, drawn
BELOW the bottom canvas edge (the user's own earlier ruling), dim and
decaying — a dot pointing at almost nothing. Replaced by **"sodium in"**, the
first gold pair visibly crossing its pore (`opens + NA_PAUSE_MS`). The flash
itself stays in the animation; the drawing⇄launch-time guard stays too.

1129 tests green, typecheck clean.

### Step 20aj — a clean timeline row, connectors to the names, 2026-09-02 · done

**A1 — nothing in the row but action, bar, timer.** The 🔆 emphasis switch
(AP) and the 🕸/🔍 scale switch (synapse) moved out to their own plates under
the bar's right end — the scale switch back in the top-right corner it owned
before the bar went full-width. The SNARE drawer's ↺ Reset was removed
outright: the bar's own start point and ▶-at-end cover "start over", the
same grammar as the synapse's auto-reset (flagged in the hand-over for veto).

**A2 — connectors.** A thin vertical line runs from every event dot down to
its own chip — with two staggered label rows, which name belonged to which
dot was a guess; the reached event's line is amber like its dot.

1129 tests green, typecheck clean.

### Step 20ak — no aura on crossed sodium, 2026-09-02 · done

**A1.** The sodium arrival pulses are gone from `bindPulses`: the white snap
is the ligand bench's BINDING idiom, and an ion that has crossed into the
spine is not bound to anything — it is simply inside. (Supersedes 20ad's
"let Na inherit the aura".) Only the plugged transmitter glows now, holding
while plugged and dying before the pair flies. Guard flipped to "no pulse
ever sits on a settled sodium ion, at any moment" — broken once (a re-added
pulse) and watched fail.

### Step 20al — the action button leaves the container, 2026-09-02 · done

**A1.** The ⚡→▶ swap was resizing the transport row and shifting the bar
(user: "creates layout shift"). The action button now floats on its own plate
under the bar's LEFT end — mirroring the 🔆/scale plates on the right — in
both the AP and synapse views, and the timeline owns the container's full
width (only the timer shares the row). ⏸/▶ keeps one fixed width so the
frequent pause↔play swap moves nothing; the once-per-run ⚡→▶ change resizes
only its own floating plate. The AP beat banner moved below the new plate
row (120 px). The SNARE drawer's Play is width-stable and never morphs, so
it stays inline.

### Step 20am — the fusion finishes before the binding, 2026-09-02 · done

**A1.** "Vesicle fusion pauses in the middle, at 5.2 ms" — measured and
confirmed: sink+open ended at age 1.1, the cargo drained to age 2.6 (= 5.2 ms
for the first fusions), then the shape FROZE until a flatten that began at
age 6 and crawled for 18 ms. Now `FLATTEN_FROM_MS = CARGO_DRAIN_MS` (the
pocket flows straight from emptying into merging, no dead zone) and
`FLATTEN_MS = 1.0`, chosen so the LAST fusing vesicle is one smooth wall by
~6.4 ms — before the first transmitter seats (6.5 ms). Fuse → release → bind
is now a strict on-screen sequence. Declared drawing exaggeration: real
full-collapse takes tens of ms; the model's dose timing is untouched. The
clearing leg/dot no longer claim "pockets flattened". Guard: every fused
pocket returns null from `fusedShape` at the first seat instant, plus
no-dead-zone on the schedule — broken once (FLATTEN_MS back to 18) and
watched fail. 1130 tests green, typecheck clean.

### Step 20an — the propagation flash, in the cell, 10 ms each side, 2026-09-02 · done

**A1.** The postsynaptic flash now IGNITES INSIDE THE SPINE HEAD — where the
sodium that caused it just settled — and runs down the neck and trunk off the
bottom edge over `POST_FLASH_MS = 10`. Supersedes the below-the-frame start
of 2026-09-01, whose real target was "never in the synaptic cleft": it still
never touches the cleft, and still shrinks and dims as it travels (an EPSP
decays; never a spike). Guard: ignition point inside the spine head, on
canvas — broken once (start moved back below the frame) and watched fail.

**A2.** `FLASH_LIFE_MS` 5 → 10: the presynaptic arrival still lands fast (by
the spike's peak) and now afterglows to the 10 ms mark, matching the
postsynaptic flash's length. 1130 tests green, typecheck clean.

### Step 20ao — the afterglow moves to the screen clock, 2026-09-02 · done

**A1.** "The yellow ball keeps hanging on the top of the page for multiple
seconds" — confirmed and explained: 20an sized the afterglow in MODEL ms
(10), and the clock crawls through the early legs, so those 10 ms were ~13
real seconds; the postsynaptic flash's same 10 ms play in a fast leg and last
~2 s. A clock belongs to the event it is timing: the fade is now defined in
SCREEN ms (`FLASH_FADE_SCREEN_MS = 1800`, via `screenOfModel`, still a pure
function of position so scrubbing replays it), sized to read like the
postsynaptic flash. Guard pins the absolute budget (≤ 2.5 s) — the first
guard sampled only at fractions of the constant and PASSED at 13 s when
broken; the pinned version was then broken and watched fail. 1131 tests
green, typecheck clean.

### Step 20ap — the spine's charge tint, paced by the drawn ions, 2026-09-02 · done

**A1 — no glow before the ions.** The gold "current arriving" spine glows
followed the model's vmPost, which rises at ~5.5 ms — long before the drawn
(slowed, curated) ions cross at ~10–17 ms. "The sodium didn't even penetrate
the cell, but the yellow aura is already there" — confirmed; the glows are
deleted.

**A2 — red/blue charge tint instead.** New `spineTint`: the spine's interior
wash on the app's own charge ramp, RELATIVE TO REST (red = depolarized, blue
= hyperpolarized), rising with each drawn ion's own crossing and cooling on
the model's membrane clock (`SPINE_TAU_MS`) after the last one settles. Pace
curated to the drawn schedule, size normalised to the run's own peak.
Declared science: the spine's absolute polarity never goes positive (the
`synapseAuras.post` pin stays), so red means "pushed off rest", not "inside
positive"; and blue never shows in THIS run — an AMPA synapse only
depolarizes. The 20an ignition flash is untouched (user: "the post-synaptic
flash is updated correctly"). E1 rewritten around the tint: zero before the
first drawn pore entry (walked), full at last settle, τ-cooling, never
negative — broken once (tint keyed to the gate instead of the ion) and
watched fail. 1131 tests green, typecheck clean.

### Step 20aq — the AP bar follows the interest; rows solved from real widths, 2026-09-02 · done

**A1.** "The timeline labels overlap much" — root cause was not the rows: the
spike's five middle moments live inside a fifth of the MODEL window, so a bar
linear in u stacked five names into ~100 px no row count could untangle
(measured: the 3-row solver still collided at every tested width). Two fixes,
inside and out:
- `apBar` (core/apSteps.ts): the AP transport's bar is now DWELL-WEIGHTED —
  each stretch between moments gets its movement time plus the arrived
  moment's dwell, the same follow-the-interest reallocation as the synapse's
  legged clock, piecewise linear and exactly invertible (thumb, dots and
  scrub all convert through it; the ms timer still reads model time). Dots
  now sit 12–18% apart. Guards: every adjacent pair > 0.1 apart on the bar;
  roundtrip inversion — the no-overlap guard was watched fail against the
  old linear placement.
- The label row solver now judges collisions from each chip's OWN estimated
  width (`chipWidth`) instead of a fixed 88 px guess, and staggers across up
  to THREE rows (user's cap), taking the roomiest only when all are blocked;
  the label area's height follows the rows actually used. Guard: the AP's
  own points, row-solved at three widths, with zero same-row collisions.

1134 tests green, typecheck clean.

### Step 20ar — edge chips slide inward, 2026-09-02 · done

**A1.** The first and last labels, centred on dots at u = 0 and u = 1, hung
half outside the bar — into the pill's border on the left and the ms timer on
the right. `chipCenter` clamps a chip's centre so the whole chip stays inside
[0, width]; mid-bar chips are untouched, the row solver judges collisions
from the same clamped positions the component draws, and the dot's own x
always remains within the shifted chip's span, so the connector line still
lands on its chip. Guarded at both ends. 1135 tests green, typecheck clean.

### Step 20as — one gap everywhere, and a slimmer bar, 2026-09-02 · done

**A1 — consistent gap.** The bar's label area grew with the rows each view
happened to use, so the pill's height — and the gap to the fixed-position
⚡/▶ plate below — differed across views and could jump when a run's points
changed. The label area now reserves its full three-row height CONSTANTLY,
and every floating plate (⚡/▶, 🔆, scale switch) sits at one shared offset
(86 px): identical gap in every view.

**A2 (mid-turn: "reduce timeline height").** The reserve was then compacted:
row pitch 16 → 14 px, chips py-0 with leading-none — three rows in 42 px
instead of 49, the whole element ~7 px slimmer, plates and the AP beat banner
moved up to match. 1135 tests green, typecheck clean.

### Step 20at — one TransportBar, flowing chrome, dynamic height, 2026-09-02 · done

**A1 — the representative component.** `TransportBar` (ui/Timeline.tsx): the
amber plate, the bar filling its width, the timer at the right end — owned
once, used in all three sites. The SNARE drawer's bar (previously bare in the
drawer row — "looks wrong") now wears the same plate; it passes no timer,
because the cycle is a schematic sequence, not a clocked run.

**A2 (mid-turn: "no need to reserve space for additional rows").** The label
area is dynamic again — only the rows actually used — superseding the same
day's constant three-row reserve. The gap consistency that reserve bought is
now had BY CONSTRUCTION: on both canvas views the ⚡/▶ plate, the 🔆/scale
plates and the AP beat banner FLOW in a pointer-transparent column under the
bar with a fixed margin, instead of sitting at hardcoded offsets that a
taller bar could collide with. 1135 tests green, typecheck clean.

### Step 20au — D06 rebuilt around its own complaints, 2026-09-02 · done

**A1 — button under the bar.** The drawer's row became the canvas views' own
flowing column: TransportBar on top, ▶ Play beneath it.

**A2 — the sensor TOUCHES the thing it controls.** Synaptotagmin was four
floating dots; now it is a body — a stalk anchored in the vesicle's own
membrane, a head carrying the four sites, and a visible GRIP on the
half-wound rope through docking, priming and the whole calcium count (the
famous pause IS the grip). When the fourth ion lands the head lets go, swings
down onto the wall, and a go-flash runs from its grip point along the rope —
cause travelling to effect, and only then does the zip finish. Guard: head
within its own radius of the rope's midpoint at dock/prime/trigger, off the
rope and at the wall by the zipper's end — broken once (grip offset) and
watched fail.

**A3 — callouts.** Each canvas name (vesicle, SNARE complex, synaptotagmin)
now carries a connector line to the part it names, and the whole layer fades
out over the run's first 4% (`LABEL_FADE_U`) — invisible labels also stop
being clickable (`snareLabels` returns none). Guard: three callouts whose
lines leave their boxes; labels empty past the fade.

**A4 — the run belongs to the button.** `openBench` no longer auto-plays
(supersedes the 2026-08-31 auto-start): the drawer opens on the labelled
still. Guarded in `snareStore.test.ts`.

**A5 — retrieval is the fusion, backwards, at the same spot.** The old
"Taken back" grew a SECOND enclosed omega at cx − 1.9r over an intact wall.
Now `fusedCentreY` runs the sink's angle-sweep backwards on the same centre
line: the wall opens again, the ONE bubble stands back up open-mouthed
(continuous with the membrane until the pinch), the wall's molecules slide
home (`wallShift` returns to 0), and the reformed vesicle lifts to the exact
height and spot the cycle began. The released transmitter cloud below stays
put throughout (`poreAt` holds 1). The retrieve leg's share grew 0.07 → 0.09
(paid by tether/dock) so the reversal keeps the sink's own pace under the
K2 continuity walk. Ring/wall-shift/conservation guards rewritten to the
round-trip story. 1138 tests green, typecheck clean.

### Step 20av — the drawer's controls sit on the canvas, 2026-09-02 · done

**A1.** The SNARE drawer's TransportBar and ▶ button moved from a stack above
the canvas onto the canvas itself — the AP/synapse views' own overlay
grammar: a pointer-transparent column at the top (bar, then ▶ under its left
end), so the picture beneath the empty middle stays clickable for the spoken
labels. The stage-name reading moved to the canvas bottom beside the calcium
counter, out from under the new plate. 1138 tests green, typecheck clean.

### Step 20aw — D06 extended upstream: the machinery that catches a vesicle, 2026-09-03 · done

The user's redo of the vesicle & SNARE demo: start BEFORE tethering, with an
undocked vesicle at the top of a stretched canvas, and draw the catching cast
(t-SNARE, GTP, Rab effector, "etc."). Alignment answers: full active-zone cast
(Munc18, Munc13, complexin included); the GTP story animated (badge dims,
Rab released); room made by rescaling inside the viewport-sized canvas, no
scrolling; ONE new `approach` stage.

**A1 — the canvas stretched down.** The wall moved from 0.72 to 0.85 of the
height and the vesicle shrank (r: 0.16w/0.24h → 0.14w/0.17h), so the top
two-thirds of the frame is free water. Guard: `wallY/SN_H > 0.8`, start
position wholly in the top half.

**A2 — the run opens undocked at the top.** New first stage `approach`
(share 0.08, paid for by tether/dock/prime/trigger/zipper/pore/collapse/
retrieve trims; refill grew 0.05 → 0.06 to keep the longer lift-off inside
the K2 continuity walk). `vesicleCentre` descends `highY → freeY` on an eased
`descentAt`; the refill lift now returns all the way to `highY`, so the loop
closes at the very height it opened. The v-SNARE is on the bubble from the
first frame (see A3's stubs).

**A3 — the catching cast, drawn and named.**
- **Rab-GTP** (`rabAt`): an orange body riding the vesicle's upper-left
  shoulder wearing a lit yellow GTP badge (glow). The badge dims to GDP
  across docking (`gtpAt`), and the spent Rab is extracted across priming —
  drifts off and fades (`rabGoneAt`).
- **Tether / Rab effector** (`tetherAt`): a violet arm standing on the wall
  left of the landing site; its waves pay out as it rises to meet the
  descending bubble (`tetherHoldAt` ramps over the WHOLE approach — a
  half-leg reach made the tip the fastest thing on screen and the walk
  caught it), tip = the Rab's shoulder through tether+dock, released home
  across priming. The hand-over from tether to SNAREs is the picture.
- **Separate SNAREs before the rope** (`snareStubs`): synaptobrevin hanging
  from the vesicle, syntaxin standing folded shut on the wall, SNAP-25 lying
  along it — the same three strand colours as the rope, now owned once
  (`SNARE_STRANDS` in synapseScene, shared with the snareMini; the second
  private copy deleted). Tips converge on the meeting point across docking
  and the function returns null the moment they join: stubs and rope are
  never both on screen.
- **Munc18/Munc13** (`munc18At`/`munc13At`): the slate minder clasping
  syntaxin's folded tip; the teal arm lying on the wall stands up at docking
  to open it (`syntaxinOpenAt`); minder slides aside; both fade across
  priming.
- **Complexin** (`complexinAt`): an amber rod that floats in from beyond the
  left edge over priming's last quarter (`clampArriveAt`, owned in core so
  model and flight read one window), lies across the half-wound rope through
  the whole count, and is flicked off over the zip's first strokes —
  `CLAMP_OFF`, the SAME window as the sensor's release swing, so the two
  hands visibly open together.
- **The sensor rides first**: before the rope exists `sensorHead` sits just
  off the vesicle's lower-right shoulder (it lives in that membrane), and
  steps onto the rope as docking joins the strands; the grip band draws only
  once there IS a rope.
- **Callouts**: the still now names the upstream cast — vesicle, Rab-GTP,
  synaptotagmin, tether, Munc13, Munc18, v-SNARE, t-SNARE (8; "SNARE
  complex" dropped — at u=0 there is no complex). All boxes guarded inside
  the frame and below the transport plate. New SAY_AS entries so the en-US
  voice says "munk eighteen", "vee snare", "rab, G T P".
- **Info block**: three new WHAT paragraphs (the badge-and-tether catch, the
  minders, the two hands on the drawn bow) and one new honesty paragraph:
  the one drawn tether stands for the Rab-effector family (RIM among them),
  and WHEN Rab spends its GTP is drawn at docking but not settled science.
- **Stage watch texts** updated for approach/tether/dock/prime/refill.

Guards for every claim above (core: descent monotone, badge lit→spent order,
clamp holds the zip at PRIMED_ZIP through the count; scene: tether catch is a
travel — tip and Rab walked at 400 samples — stubs/rope exclusivity and tip
convergence, minder-on-tip contact, complexin seat/flick window, sensor
riding-then-gripping). Exclusivity and tether-hold guards broken on purpose
and watched fail. 1146 tests green, typecheck clean.

### Step 20ax — D06 corrections round: the ring, the beats, the seams, 2026-09-03 · done

Five corrections from the first manual look at 20aw, plus alignment answers:
~20 s clock, and the mirror covers EVERYTHING (full symmetric pairs).

**A1 — a second copy of the whole cast, mirrored on the left.** Every
geometry function gained a `side: 1 | -1` (computed right-handed, reflected
across the centre line — one geometry, two copies), and the drawing loops
both sides: tether+Rab, Munc18/13, stubs/rope, complexin, sensor — and a
second set of calcium ions that floats in from beyond the LEFT edge onto the
left sensor. The info block explains it as a slice through a RING (pulls
straight down, the hole opens in the middle) whose per-protein count is
declared not settled. Labels stay on the right copy only. Guard: reflection
identities across five stages; left ions off the left edge, seated on the
left sensor's own sites.

**A2 — slower, with beats.** `SNARE_SCREEN_MS` 13 s → 20 s, and stages
gained a `hold`: dock 0.25, prime 0.25, trigger 0.22, zipper 0.2, pore 0.15 —
`through` completes its ramp in the first (1 − hold) of the leg and the
picture RESTS for the remainder, so each event lands before the next starts.
`uAtThrough` (the ramp's inverse, owned in core) keeps the calcium flights
landing at the exact model moments the sites fill — a hold cannot desync an
ion from its site. Guard: every held leg finishes early and sits still;
un-held legs unchanged.

**A3 — canvas stretched to the page bottom.** The old SN_H reserved 120 px;
the drawer's real vertical chrome measures 66 (SideDrawer p-5 ×2 = 40, bench
grid pt-2 = 8, canvas plate border+p-2 = 18) — the missing 54 was the
pre-20av below-canvas controls row, now reclaimed. Only the person at the
browser can confirm the fit.

**A4 — one paint for lumen and bath.** `LUMEN` is now literally `OUTSIDE`
(the same string, as the synapse scene already does), not a hex that
approximated its composite. The lumen arc never reaches below the wall line,
so the two washes never stack. Guard: `LUMEN === OUTSIDE`.

**A5 — the rope rides its membranes (the hanging-rope complaint).** Both of
`ropeEnds`' ends now obey the membranes they live in: the syntaxin end is
pushed outward with `wallShift` like every other wall molecule, and the
synaptobrevin end sits at a fixed ring angle and follows the omega's
unrolling — the identical rule the lipids obey. After fusion the rope
therefore lies FLAT in the one wall (a cis-SNARE complex — real) and travels
outward with the membrane flow; the machinery layer then fades over the
collapse (`machineFade`) instead of popping off at pore = 0.5. The rope's
afterlife is named in the info block: NSF prises the flat complex apart for
reuse — declared, not drawn. Guards: flat at collapse's end, travelled
outward, NOT stretched (length < 0.6 r), both ends walked at 800 samples;
broken (ves end re-pinned to hang) and watched fail. 1150 tests green,
typecheck clean.

### Step 20ay — D06: the mirrored copies pushed clear of the centre, 2026-09-03 · done

**A1 — "place SNARE complex and Ca binding areas further away from the
center, as currently they collide."** The collision was the v-SNARE's ring
anchor: at ~87° it sat ±0.05 r from the centre line, so the two mirrored
ropes met tip-to-tip and the clamps and site clusters tangled between them.
The anchor moved to 1.1 rad (±0.45 r), syntaxin's stand to ±0.81 r —
`WALL_ANCHOR` is now DERIVED as cos(anchor) + `CIS_LEN`, so the flat
cis-complex still lands with zero jump — Munc13's base rides the wall anchor
instead of being marooned at the centre, and the tethers moved out to
±1.85 r (at ±1.55 r the mirrored tether stood exactly on the other copy's
SNAP-25). During the flow phase the joined complex now rides the unrolled
v-SNARE molecule as one flat object, wall end one cis-length beyond. Guard:
every piece of one copy's machinery (rope ends, stubs, sensor sites, clamp)
stays ≥ 0.3 r clear of the centre at five stages — the mirror identity turns
that into a ≥ 0.6 r channel between the copies; broken (anchor back at the
bottom) and watched fail. 1151 tests green, typecheck clean. (Full-suite runs
on this machine intermittently time out heavyweight walking tests in
UNTOUCHED files — cable, ions, synapse — under parallel load; each passes
alone and the suite settles clean on re-run.)

### Step 20az — D06: the bubble returns empty, and the lumen seam is closed, 2026-09-03 · done

**A1 — "now the vesicle returns refilled, is this correct? If not — return
empty."** It is not correct: a retrieved vesicle leaves the wall as bare
membrane, and refilling — re-acidification, then tens of seconds of
transmitter pumping — happens later, up in the pool. `cargoAt` lost its
refill term: the bubble now lifts back to the crowd EMPTY, the stage was
retitled 'Back to the crowd' ("It lifts back up still EMPTY. Pumps will fill
it again up in the crowd — slowly, before its next turn."), and the ♻️ info
paragraph explains that the full bubble each run begins with was filled the
same way, off-stage, between turns. Guard: cargo is exactly 0 from the
collapse's end to the run's end (supersedes the "full again at the end"
assertion, which pinned the compression).

**A2 — "a gap or an overlap is occurring between bg of vesicle and outside
the cell space."** Found and measured: the lumen wash's closing chord was
solved on the RING's radius but painted on the lumen's (r − halfMem/2), so
its edge missed the wall line by halfMem/2·sin(mouth) — a bright unpainted
strip while the mouth was above centre (~8 px at worst), a double-painted
dark band once the centre passed below the wall, and a stray arc even after
the lumen was wholly submerged. The mouth angle is now a named decision,
`lumenArc`, solved by asin on the radius that is actually painted — chord
exactly ON the wall line, 'none' once submerged. Guard: an 800-sample walk
pins both endpoints to wallY to 1e-6 whenever the mouth is open and forbids
painting after submersion; broken (angle back on the ring's radius) and
watched fail at the measured 8.16 px. 1152 tests green, typecheck clean.

### Step 20ba — D06: the transmitter gets identity, and flows away, 2026-09-03 · done

Reuptake itself was moved OUT of this drawer at the user's direction (after
scientific pushback: this app's synapse is glutamatergic and glutamate is
cleared mostly by astrocytes, so the classic presynaptic-reuptake picture
belongs to a view that can say so properly). A dedicated reuptake view is
planned, TBD; the "machinery reset for the next round" idea is deferred to
that round. Recorded in auto-memory (`reuptake-view-planned`). Per the
frontier rule, no in-app text promises the future view.

**A1 — identity.** The cargo was the last cast member still teleporting: two
unrelated seeded dot sets (22 inside, 26 in the gap) crossfaded by alpha. Now
`transmitterAt` follows ONE fixed set of `NT_COUNT` molecules — a seeded seat
riding the sinking bubble, an exit moment each on the very ramp `cargoAt`
empties on (`uAtThrough('pore', (i+0.5)/N)`, so picture and model cannot
disagree), a quadratic flight pinched through the pore's mouth that leaves
with the drift's own velocity (no kink), then a seeded outward drift. Nothing
fades, nothing swaps; pure function of u. `NT_COUNT` moved to core so the
honesty text interpolates the same number the drawing uses ("the 22 dots
stand for the few THOUSAND a real vesicle holds").

**A2 — restored bubble stays unfilled** (already the model since 20az); now
also pinned in the picture: no dot is ever 'inside' again after the collapse.

**A3 — the transmitter flows AWAY.** Drift velocities are scaled from the
frame (the slowest molecule still crosses the gap in the run's remaining
fifth), so every molecule is off the page by u = 1 on any viewport — it
leaves the scene by travelling, "collected by machinery outside this
picture" (the honesty text's words). Guards: fixed count and continuity at
800 samples, inside-count tracks cargoAt within one molecule, all off-frame
and none inside at the end; the flight was cut on purpose and the walk caught
the 210 px teleport. 1154 tests green, typecheck clean.

### Step 20bb — D06: nothing leaves a sealed bag, 2026-09-03 · done

**A1 — "NTs start leaving the vesicle too early (visually fly through the
membrane)."** The exit schedule was keyed to the pore stage's whole ramp, but
that ramp's first `SINK_TOUCH` (0.15) is the approach to CONTACT — the bubble
is still sealed, so the first third of the exits crossed an intact bilayer.
The moment-a-mouth-exists is now a named core decision: `SINK_TOUCH` moved
from the scene into core (one copy, read by the sink geometry, the cargo and
the schedule), `mouthOpenAt` is 0 until the membranes have fused and 1 when
the release window closes, `uAtMouthOpen` is its inverse, and BOTH the
molecules' exits and `cargoAt` read it — so the bag stays visibly and
numerically full until fusion, then pours. Guards: cargo exactly full up to
`uAtMouthOpen(0)`; schedule/state agreement (`mouthOpenAt(uAtMouthOpen(f)) =
f`); and a 1600-sample walk of the scene pinning that every molecule crossing
the wall line does so INSIDE the ring's open chord — through the hole, never
the wall. Broken (schedule back on the raw ramp) and watched fail. 1156 tests
green, typecheck clean.

### Step 20bc — D06: the reuse pipeline on stage, 2026-09-03 · done

The deferred "cell prepared for the next round", picked up with alignment
answers: proton pump drawn on the lift; a new 'Taken apart' leg; and the
clathrin coat DRAWN (the user chose the bigger option).

**A1 — nothing vanishes any more.** The machinery-wide collapse fade is gone;
every part manages its own ink. The spent cis-rope stays lying in the wall —
`ropeEnds` freezes at retrieval's start (the reforming bud must not drag a
wound rope back up) and the flow-ride is capped at 1.6 r so the recycling
happens on stage, not at the frame's edge. `zipAt`'s unwind moved from
retrieve to recycle: a rope loosens because NSF takes it apart, not on its
own. The sensor's stalk re-anchors by phase — vesicle while riding, wall
after the swing (its membrane became wall), vesicle again once sorted home.

**A2 — the readiness pipeline.** New stage `recycle` ('Taken apart', share
0.06, hold 0.2; paid by tether/trigger/zipper/pore/collapse trims — retrieve
kept at 0.08 for the sweep's continuity budget). On stage: the CLATHRIN COAT
(cyan studs on the bud's cytosolic face, assembling across retrieval — the
shape-maker — shed radially across the taking-apart); NSF (red barrel with a
bore) dropping onto the flat rope; the three strands WALKING HOME as the
rope unwinds — synaptobrevin to the bubble (and riding it up), syntaxin and
SNAP-25 to their stands, where Munc13 lies back down and Munc18 fades in to
re-clasp the re-folded syntaxin; synaptotagmin sorted back to its shoulder;
and on the lift a PROTON PUMP (indigo, two bars through the bilayer) with
the first three H⁺ entering and seating inside — sour, empty, ready, ending
exactly where NT pumping would begin (off-stage, as decided). The end still
IS the start still (minus the Rab badge, declared re-armed off-stage). New
info paragraphs (🧺 coat, 🔋 battery; 🪢 rewritten — the prising-apart IS
drawn now) and the pace honesty names the squeezed recycling timeline.

**A5 (mid-turn) — wall proteins ride the membrane.** `wallRideX`: the tether
and the stands slide outward with `wallShift` exactly as the wall's lipids do
(off the frame's edge and back, by travel), and home again with retrieval —
except the rope's own wall end, which is governed by its v-SNARE side once
fusing (adding shift there opened a measured 119 px branch jump; the
continuity walk caught it and the comment records it).

**Fixed en route:** the sensor's ride and the stalk were anchored on
`vesicleCentre`, which parks at the touch position for ever — the walked-home
sensor would have stayed at the wall while the bubble lifted. Both now ride
`fusedCentreY` (identical pre-fusion). Caught by the new closure guard.

Guards: end-still == start-still (strands, sensor shoulder at the LIFTED
bubble, minder re-clasped); rope frozen through retrieval; walk-home
continuity at 200 samples; NSF on the rope's middle and off-duty either
side; coat present only retrieve→recycle, every stud above the wall; pump on
the risen bubble with every proton inside at the end; tether base rides
wallShift out and home, mirrored. Walk-home broken (half-way homes) and
watched fail. 1160 tests green, typecheck clean.

### Step 20bd — D06: the rope and the sensor bolted to their lipid, 2026-09-04 · done

**A1 — "Ca binder and snare helices do not follow membrane all the time."**
Two of step 20bc's own devices were the cause: the 1.6 r CAP parked the rope
mid-collapse while the wall material streamed past it, and the FREEZE from
retrieval parked it while the membrane slid home beneath it — the sensor
inherited both through the rope. Both removed (superseding 20bc's freeze/cap):
`ropeEnds`' v-SNARE end now obeys the lipids' own material rule at EVERY u —
unrolled out with the flow (it stays inside the frame: the full unroll ends at
~3.44 r < the half-width), rolled home with the retrieval, up onto the
reforming bud, which is made of the very patch that flattened. NSF then takes
the rope apart there, so the recycle walk-homes got shorter, and the closure
still holds. Guard — the strongest form of the claim: the rope's v-SNARE end
stays within 1.5 lipid spacings of the SAME ring molecule (by identity, index
i*, not proximity to whatever membrane is near) across 800 samples of the
whole run; and the sensor's head keeps a CONSTANT offset from the rope from
the swing's end to the walk-home's start — it moves exactly as much as the
membrane it sits in. Broken (cap reintroduced) and watched fail at 11 px.
1161 tests green, typecheck clean.

### Step 20be — D06: labelled checkpoints, 2026-09-04 · done

Prompted by "what are the yellow balls?" (the protons — named in the info
block, unnamed on the canvas): the transient cast had no chance to be
labelled, because labels lived only on the opening still.

**A1 — the player pauses to name things.** While playing, the run now stops
at labelled checkpoints (`LABEL_STOPS`), shows the labels with connectors for
`LABEL_HOLD_MS` (3 s), then continues. The hold clock lives in the bench's
own refs (the clock belongs to the event); a stop is spent when crossed and
re-armed by any travel backwards past it (replay, scrub back).

**A2 — two mid-run stops**, because NSF and the coat do not exist while
calcium and complexin are on stage: the RELEASE stop at the instant the
fourth calcium seats (labels: SNARE complex, calcium, transmitter,
complexin) and the RECYCLING stop early in 'Taken apart' (labels: NSF,
clathrin). `snareCallouts` is now context-aware — four label sets by region.

**A3 — the closing still is labelled.** At u = 1 the labels re-appear for
every visible element: vesicle, v-SNARE, t-SNARE, synaptotagmin, Munc18,
Munc13, tether, proton pump, protons — nine, from the same resting-cast list
as the opening still (Rab dropped when faded, pump and protons added when
present, the bubble's centre read from `fusedCentreY` so the end labels ride
the lifted bubble).

**A4 — spoken labels work at every still**: `snareLabels` gains a `held`
flag (the bench passes its hold state to the hit-test), labels are clickable
at rest, at the end and during holds — never while the picture moves — and
"NSF" is pronounced N-S-F (SAY_AS).

Guards: all four sets — exact term lists, connectors that leave their boxes,
every label in-frame below the transport plate, and a no-overlap check (each
label's centre hits its OWN box via the real hit-tester); visibility gating
(empty while running, populated when held, nine at the end). The held gate
was broken on purpose and watched fail. 1161 tests green, typecheck clean.

### Step 20bf — D06: red protons, the trade, and a closed loop, 2026-09-04 · done

**A1 — the atomic playground's proton ink.** Found in its particleStyle.ts:
protons are GLOSSY RED (light #ffd4d0, mid #f87171, dark #dc2626, glow
248,113,113) — red being the + charge colour both apps reserve, and a proton
being a bare + charge. Adopted verbatim: `GLOSSY_COLORS.h` (a `GlossyKind`,
not an `IonKind` — protons carry no concentration model here), drawn with the
ions' own glossy painter. NSF moved off red to fuchsia #c026d3 so the
reserved meaning stays unshared.

**A2 — protons much smaller.** Radius 2 glossy balls (transmitter dots are 3,
calcium 5.5) — a proton is the smallest thing on stage and now looks it.

**A3 — the proton→transmitter EXCHANGE, on stage.** New final stage `load`
('Refilled', share 0.06, hold 0.15; paid by dock/prime/trigger/zipper/pore
trims). A TRANSPORTER (the pump family's indigo, a visibly different shape:
one wide barrel with a bore, at the bubble's upper-left) fades in and trades:
the three seated protons leave through it one by one and drift off the
frame's top, while generation-2 transmitter — NEW molecules, made up in the
crowd — rains in from beyond the top edge through the transporter, each dot
to the SAME seeded seat its predecessor held. Booked on the load ramp
(`uAtThrough`), the very ramp `cargoAt` now refills on. A third label stop
mid-trade names transmitter, transporter, proton pump, protons.

**A4 — the closing frame IS the opening frame** (supersedes 20az's "returns
empty and stays empty", which was right only while refilling was off-stage):
cargo back to full at the same 22 seats; the Rab returns re-armed (`gtpAt`
and `rabGoneAt` close over the load leg — the re-arming was declared to
happen up in the crowd, and the closing frame now IS up in the crowd); pump
and transporter fade once their work is done (declared residents, drawn only
while working — the 🔋 paragraph says so); the closing label set is exactly
the opening eight, Rab-GTP included.

**Fixed en route:** `rabAt` anchored on `vesicleCentre` — the same
parked-centre bug the sensor had (20bc) — so the returning Rab missed the
lifted bubble by 300 px; caught by the new closure guard, moved to
`fusedCentreY`. The gen-2 inbound flight got its own longer window (0.05)
after the continuity walk caught a 29 px step.

Guards: cargo empty exactly until the load leg and full at 1; badge lit and
Rab home at 1 (position-identical to u=0); gen-1 gone by travel, gen-2
dot-for-dot on gen-1's opening seats; both machines null at 1 and the
transporter on the bubble mid-trade; every proton off the top by the end;
2N-dot continuity walk; closing label set == opening label set. The seat
identity was broken (offset seats) and watched fail. 1161 tests green,
typecheck clean.

### Step 20bg — D06: timeline marks, the door, the slower tail, the labels switch, 2026-09-04 · done

**A1 — the checkpoints are ON the bar.** The shared Timeline gained an
optional `marks` prop — small amber DIAMONDS, distinct from the event dots —
rendered at `LABEL_STOPS`. Pressing one glides there (the bar's own rewind
verb), and the bench now shows labels whenever the run is PARKED exactly on
a checkpoint (diamond press or a scrub that lands there), not only during
the automatic holds.

**A2 — "NTs enter the vesicle through membrane."** The inbound quadratic
could cut the ring anywhere near its control point. Reworked: each gen-2
molecule rains from beyond the top DURING THE LIFT into a waiting QUEUE on
the transporter's outside (an arc of seeded spots riding the bubble), and
passes inside only through the door — two segments pinned to
`transporterSpot`, on `uAtLoadFill`, a new core ramp (`loadFillAt`, the
load's second half) that the cargo ledger also reads, so no dot is ever
booked before the door exists. Guard: a 1600-sample walk — any gen-2
molecule inside the membrane's band must be within 0.6 r of the door, with
20+ crossings witnessed. (Breaking the queue wide was caught first by the
continuity walk — the guards overlap, and both bite.)

**A3 — the tail slowed, with beats.** After 'Taken apart': recycle
0.06→0.07, refill 0.06→0.08 (hold 0.2), load 0.06→0.10 (hold 0.2) — paid by
approach/dock/prime/trigger/zipper/pore trims (retrieve kept at 0.08: the
reverse sweep's continuity budget). The holds test now covers the tail legs
too.

**A4 — the Labels switch.** `labelsOn` in the store (default on), a
🏷 Labels on/off button beside ▶ (label + state reading, sentence in
title=). Off: no checkpoint ever pauses the run, no label is drawn anywhere
(rest and end stills included), the canvas hit-test goes quiet, and the
diamonds leave the bar. 1162 tests green, typecheck clean.

### Step 20bh — D06: the proton keeps its name, and the switch becomes a switch, 2026-09-04 · done

**A1 — "I see no label for proton."** The proton exits were scheduled from
0.1 of the load leg, so by the exchange stop (0.7) the protons were mostly
off the frame's top — the 'protons' entry (gated on an on-frame proton) could
vanish, viewport-dependently. Exits rescheduled to run WITH the filling
(0.45 + k·0.14, each 0.16 long, last gone by 0.89): at the stop the trade is
mid-swap, at least one proton still seated — guarded — and the callout now
prefers a SEATED proton over one mid-flight. Broken (exits back at 0.05) and
watched fail exactly as the complaint: the 'protons' name dropped from the
exchange still.

**A2 — the Labels control is a track-and-knob SWITCH**, the aquaporin
toggle's own grammar (permeaScene): sky-500 track when on, slate when off, a
sliding white knob — on/off readable without reading — with '🏷 labels'
as its name, `role="switch"`, and the sentence in title=. 1162 tests green,
typecheck clean.

### Step 20bi — D06: the trade threads the bore, 2026-09-04 · done

**A1 — "give neurotransmitters identity"**: already in place since steps
20ba/20bf (both generations individual, walked at 800 samples) — nothing new
built, recorded so the point is answered rather than dropped.

**A2 — "let them penetrate the vesicle through the channel if that's
scientifically the case."** It is: transmitter is loaded by the vesicular
transporter (VGLUT for glutamate — a carrier, this app's indigo barrel). The
INTENT was already the transporter, but the door pass was a quadratic with
the barrel as its control point, and a quadratic only passes NEAR its
control — dots could visibly cross the membrane beside the barrel, inside
the old guard's lax 0.6 r tolerance. The pass is now piecewise through the
barrel's OUTER and INNER mouths — every molecule crosses the membrane inside
the bore — and the guard tightened to 0.2 r (the barrel's own footprint).
Broken (bore bypassed mid-pass) and watched fail twice over: the door guard
at 42 px off-door and the identity walk at a 76 px jump. 1162 tests green,
typecheck clean.

### Step 21b — PLAN: D17, the reuptake drawer, 2026-09-04 · built in step 21b-2 below

The intermediate step between D06 and leg 2, requested 2026-09-04: "the
drawer where neurotransmitters get reuptaken". D06 now ends its release with
the cargo drifting off-frame, "collected by machinery outside this picture";
D17 IS that machinery, and it closes the transmitter's loop the way D06
closed the membrane's and the proteins'. (S14, the scene-level clearance leg,
stays in the plan — it will reference this drawer's cast rather than redraw
it, exactly as S12 references D06's.)

**Why an astrocyte, not presynaptic suction** (the 2026-09-03 pushback,
recorded in auto-memory `reuptake-view-planned`): this app's synapse is
glutamatergic, and glutamate is cleared mostly by astrocytic EAAT
transporters (~80–90% in cortex) feeding the glutamine cycle — the classic
"terminal sucks its own transmitter back" picture belongs to GABA and the
monoamines. So the drawer's star is the THIRD cell.

**Anatomy plan** (03 → *Plan the anatomy before the picture*): the tripartite
synapse in section, at D06's molecule-resolvable register. Presynaptic bouton
wall across the top (inside above — D06's established orientation), the
postsynaptic face across the bottom, the cleft between, and an ASTROCYTE
process wrapping in from one side — its own bilayer, paved by the same
`paveMembrane`, fading out at the frame's edge (never invent an off-page
surface). Camera: the same side-on section as D06; every membrane a liquid.

**Cast and choreography** (identity throughout, one continuous path per dot):
1. The aftermath: glutamate dots (D06's own `transmitterDot` ink) drifting in
   the cleft — the picture D06's release ends on.
2. EAAT transporters: several barrels on the astrocyte face (the workhorses),
   ONE on the neuronal face (the minor route, drawn honestly smaller in
   number, said in words). Every capture threads a bore — the shared door
   grammar; extract D06's door-pass path helper and barrel drawing into a
   shared stage module rather than copying them (never two private copies).
3. The fare, shown on at least one labelled event: 3 Na⁺ + 1 H⁺ ride in with
   each glutamate, 1 K⁺ steps out — the app's own glossy ions — with the
   honesty line that the Na⁺ gradient (the pump's work, the membrane
   milestone's own story) is the fuel.
4. Inside the astrocyte: glutamine synthetase (an enzyme blob) converts each
   dot — a visible CHANGE OF KIND (glutamine wears its own ink, chosen at the
   05 reconciliation) — identity kept through the conversion.
5. The round trip: glutamine out through a SNAT door, across the gap, in
   through the terminal's SNAT door, glutaminase converts it back, and the
   restored glutamate joins the terminal's STOCK — visually the staged pool
   D06's generation-2 refill rains from, so the two drawers hand the same
   material to each other.
6. Transport bar stages (order settled, stopwatch declared):
   Released → Caught → Converted → Shipped home → Converted back → Stocked,
   with the D06 grammar throughout: shares + holds, label stops as bar
   diamonds, the 🏷 labels switch, spoken labels at every still.

**Model** (`core/reuptake.ts`, a sequence like `vesicleCycle`): staged spans
with holds; seeded per-dot assignments (which dot → which transporter, on
which ramp) as named decisions; counts that tests read (caught-by-astrocyte
vs caught-by-neuron ratio pinned to the declared split; every dot accounted
for at the end — conservation). Honesty block: the % astrocytic, the EAAT
stoichiometry (settled), the squeezed timescales (uptake ~ms, the glutamine
cycle seconds–minutes), dots and doors standing for thousands.

**Home and entry**: a drawer off the SYNAPSE view (home: 'synapse'), beside
D06 on the same shelf — a second labelled button (e.g. ♻️ "Where the
transmitter goes"). Two doors at one place need two icons, spaced by a
marker's own diameter (03). D06's info block may mention the sibling in
words; navigation stays on the view's chrome.

**Reuse inventory** (no second copies): `transmitterDot`, `GLOSSY_COLORS`
(na/k/h), `paveMembrane`, the barrel + bore-threading door (extracted from
snareScene), `spoken`/`drawSpoken`, `TransportBar` + `marks`, the bench hold
machinery (consider extracting the checkpoint-hold logic from SnareBench
into a shared hook before building).

**Open questions for the implementation round's alignment** (to ask, not
guess): (a) one static frame with all three cells vs a camera that follows
one dot — recommend static, dots travel; (b) the Na⁺/K⁺/H⁺ fare on every
capture vs once with a label — recommend once; (c) glutamine's ink — needs a
hue free of the existing cast, reconciled in 05 before drawing; (d) how many
dots — D06's NT_COUNT or the cleft cloud's own count; (e) whether the closing
frame visually echoes D06's staged pool or says the hand-over in words.

**Refinement, 2026-09-04 — ONE FEATURE AT THREE REGISTERS** (user: "implement
it in three places"). Reuptake is one biology shown at three magnifications,
the way fusion already is (scene band-scale → D06 molecules). Confirmed by
alignment: place 3 is D17, the sibling drawer — the 2026-09-03 "not in D06"
ruling stands — and the close-up gets the drain, not a third cell.

- **21b-1 — the whole-synapse framing (`outgoing-synapse`): who and where.**
  The astrocyte process enters the picture as ANATOMY: a slim glial finger
  wrapping one flank of the cleft, drawn at the scene's own band register
  (level of detail cuts both ways — no molecules here), its body fading at
  the frame's edge. The existing cloud decay (the model's own clearance) gets
  visible ATTRIBUTION: a modest set of identity dots drifts to the astrocyte
  flank and enters at small transporter ticks — most there, one or two into
  the presynaptic face (the minor route, the declared split). An 'astrocyte'
  spoken label joins the scene's names; the run's clock rules apply to the
  clearance tail (slow the leg, never the item). The shelf gains D17's
  labelled button beside D06's — two doors, two icons, a marker's diameter
  apart — on BOTH framings.
- **21b-2 — the active-zone framing: the effect, not the cell.** Decided with
  the user (2026-09-04): the astrocyte's processes live at the rim this
  framing crops away, so no third cell is drawn — the transmitter visibly
  DRAINS toward the lateral edges (leaving by travel, toward collectors that
  are off-frame), and the info block names where it goes.
- **21b-3 — the D17 drawer: the machinery.** The full molecular plan above,
  unchanged — the third register, where the transporters become barrels, the
  fare is paid in drawn ions, and the glutamine round-trip runs to the stock
  D06 refills from. The astrocyte here IS the cell place 1 introduced.

Build order: 21b-1 → 21b-2 → 21b-3, each with its own hand-over; the drawer
lands last so the wide view has already introduced the cell it magnifies.

### Step 21b-1 — the astrocyte enters the synapse scene, 2026-09-04 · awaiting manual test

Register one of D17 (plan above), built with alignment answers: TWO glial
fingers (both flanks), collected balls VISIBLE inside them, and the D17 shelf
button added now but DISABLED ("soon").

**A1 — the third cell, as anatomy.** `astrocyteFinger(g, side)`: a capsule
per flank at the scene's band register — tip beside the cleft's mouth, body
running outward and down, faded toward the frame's edge by gradient (never an
invented boundary; the fade lives in the fill/stroke gradients so globalAlpha
stays multiplied-only). Its membrane wears the scene's own LEAFLET/CORE band
inks; its cytoplasm is the neurons' wash greened a step. Two indigo
transporter TICKS on each tip (D06's transporter colour at tick size). An
'astrocyte' spoken label joins the scene's names. The active-zone framing —
the same scene, 4× closer — crops the fingers away by construction, which IS
the agreed close-up treatment: the drain shows, the cell stays at the rim.

**A2 — the cloud's decay, attributed.** The escapees' journey now ENDS
somewhere: `escapePos` routes each ball out of its nearest gap end, to a tick
on its own side's finger, and to a seeded rest INSIDE the capsule
(`astroRest` — solved from the capsule, cannot land outside); a seeded few
(`NEURON_UPTAKE_FRAC` 0.15) take the spine's own transporter instead — the
declared minor route. Measured with the app's seeds: 10 glial to 1 neuronal
(91%, the declared "up to nine parts in ten"), 10 released balls lingering in
the gap per the standing 2026-09-01 ruling (the transporters that reclaim
THOSE work on a slower clock than this run — kept). The old open-bath rest
spot is gone; 'bath' is a travelling phase now, never a place to end up. A
new 🧤 info paragraph names the astrocyte, the split, and the sodium-gradient
fare. `ntSettledBy` covers the new legs.

**A3 — the reserved door.** The synapse shelf carries D06's button plus a
disabled "♻️ Where the transmitter goes · soon" (user's choice) — the drawer
itself is step 21b-3.

Guards: E3+J rewritten to the collection contract — escapees end 'glia' or
'spine', none resting 'bath', every glial ball held by the capsule's own
decision (`astrocyteHolds`), ≥70% astrocytic with the minor route really
shown (≥1), and the books still balance ball-for-ball; broken (rest spot
pushed outside the finger) and watched fail at the capsule test. The chain
continuity walk passes over the new legs unchanged. 1162 tests green,
typecheck clean.

### Step 21b-1a — scene callouts and the fingers re-seated, 2026-09-04 · awaiting manual test

**A1 — "labels on whole synapse framing are misplaced, add connector
lines."** The scene's names now use D06's callout grammar: `synapseCallouts`
ties each label to a point ON its object (vesicle → the leftmost docked
bubble; dendritic spine → its face; synaptic cleft → the gap's mouth;
astrocyte → the right finger's tip), a 1 px connector drawn with the chrome.
Positions were MEASURED into open water, not nudged: the old 'synaptic
cleft' sat on the spine's shoulder and 'vesicle' had a corner on the bulb;
both were caught by the new guard, which requires every label box inside the
frame, off the bouton's floor, and outside both glial capsules, with
connectors that leave their boxes and no two boxes overlapping.

**A2 — "the fingers read as a second postsynaptic specialization; place
them slightly further away or more towards the synaptic cleft."** Both, per
the instruction's either/or: each finger's tip now hovers AT THE GAP'S OWN
HEIGHT (wallAt(edge) + half the cleft — the mouth it drains), and further
out (activeHalf + 105 from the centre). The bulb is asymmetric, so the two
tips ride at their own wall's height (measured: 370 right, 411 left).
Guarded: no membrane point of the spine's face or the bouton's floor lies
inside either capsule, and the tips sit clear beyond the zone's mouth. The
collection routes follow the ticks automatically. 1164 tests green,
typecheck clean.

### Step 21b-1b — the labels switch on the synapse, and the astrocytes on both neurons, 2026-09-04 · awaiting manual test

**A1 — the 🏷 labels switch, D06's own.** The track-and-knob affordance was
EXTRACTED into `ui/LabelsSwitch.tsx` the moment a second view needed it (one
drawing of the affordance, never two); SnareBench now uses the shared
component, and the synapse view carries one beside its ⚡/▶ plate. Off: no
callout is drawn (`SynapseView.labelsOn`) and none is clickable (the hit
rectangles unmount) — on either framing.

**A2 — the astrocytes on the big and the small neuron.** Built rather than
SVG'd (offered; the app's own ink keeps one visual language and testable
geometry). `ASTROCYTES` in layout: two cells at the outgoing synapse — one
above, one below, because the landing quarter-turn maps the scene's
above/below to the landed view's left/right flanks, so these ARE the two
fingers' owners. Each is a lobed star (seeded lobes, five short wavy
processes) with ONE long process reaching to its own mouth of the synapse,
in the glial greened wash at the scene's register; bodies sit toward the
frame edge and may crop, as the user allowed. On the DIVE they dissolve out
with the bouton stand-in while the seated anatomy's own mouth-fingers
(drawn into `outgoingAnatomy`, proportioned in the view's own
active-half units) dissolve in — level of detail dissolves, never both on
screen. The MINIATURE (NeuronMapPanel's SVG) shows the two cells only on
the synapse framings (`mapShowsAstrocytes`), bodies cropped by the map's own
frame.

Guards: two cells, opposite flanks, each a neighbour (60–160 px off the
synapse) reaching within 16 px of it on its own side; the map predicate true
only for the two synapse views; broken (both cells one side) and watched
fail. 1166 tests green, typecheck clean.

### Step 21b-1c — the shelf's corner freed, and the paired mini-ropes, 2026-09-04 · awaiting manual test

**A1 — "bottom left label is covered by buttons container."** The 'dendritic
spine' callout (parked bottom-left one round earlier to dodge the left
finger) sat under the D06/D17 shelf plate. Moved to measured open water
bottom-RIGHT (clear of the right finger, above the cleft label's box),
pointing at the face's right flank — and the label guard now RESERVES the
shelf's corner (x < 560, y > H − 130, generous for stacked or side-by-side
buttons), so no future label can land there; broken (label back bottom-left)
and watched fail.

**A2 — "add another snare complex to each vesicle, to stay consistent
between presentations."** `snareMini` now returns a mirrored PAIR of ropes
per docked vesicle (`ropes`, replacing the single ropeFrom/ropeTo), the same
section-through-a-ring D06 presents; the drawing loops both, in the shared
strand colours, on both framings. Knobs unchanged (already the pair). 1166
tests green, typecheck clean.

### Step 21b-1d — the astrocytes reshaped to the user's design, 2026-09-04 · awaiting manual test

An illustration handover (~/Downloads/astrocyte.svg), reconciled in 05 before
drawing (see 05 → Reconciliation — astrocyte.svg): a five-point star soma
with concave valleys, each arm a wavy main process with one short
side-branch, outline-first. Adopted whole; changed with written reasons: the
ink stays the glial green (the SVG's #be5757 is a red, and red is the
reserved + charge colour), one process per cell is elongated into the reach
that ends exactly at its synapse mouth (direction changes allowed by the
user), and a faint fill keeps the body legible over the dark bath.

**The one-glyph rule, for kids who don't read.** `astroShape` (layout.ts) is
ONE seeded geometry in scene coordinates returning the soma polygon and
twelve process polylines; the canvas scene strokes it and the miniature's
SVG paths THE SAME shape — recognition by silhouette, not caption. On the
map the true scene spots sit half off the sheet, so `MAP_ASTROCYTES` pulls
each cell inboard (above and below the synapse) — a star the kid cannot see
teaches nothing — declared in the reconciliation.

Guards: five contiguous point-groups (broken to four and watched fail), star
proportions (max > 0.95 r, valleys < 0.55 r), the reach's last point equal
to the fingertip to 1e-6, twelve polylines (the paired-branch grammar), and
the map cells' bodies wholly inside NEURON_MAP_BOX, still reaching their own
mouths. 1168 tests green, typecheck clean.

### Step 21b-1e — the astrocytes re-created as the SVG's own trace, 2026-09-04 · awaiting manual test

**A1 — "re-create astrocytes based on astrocyte.svg."** 21b-1d had
approximated the handover procedurally (a cos⁵ five-point star with
generated wavy arms) — and misread it: the drawing is a SIX-point star with
six main+side-branch processes. `astroShape` is now the trace itself: the
SVG's thirteen paths machine-extracted into absolute cubics (`ASTRO_TRACE`,
layout.ts), flattened at draw time; centre, tip radius and the reach arm's
as-drawn direction are MEASURED off the data at load (`ASTRO_FRAME`), never
asserted. The top arm as drawn becomes the reach: the glyph turns to face
its synapse mouth and a similarity about the arm's soma-side end lands its
tip exactly on the fingertip, the side-branch riding the same map. The seed
parameter is gone — a trace has nothing to randomise. Standing
reconciliation decisions kept: glial green ink (the SVG's #be5757 is a red,
reserved for + charge), faint fill, one glyph for both registers.

**A2/A3 — the two places.** Both consumers draw the traced glyph through the
one shared `astroShape`: the big canvas scene (`drawAstrocyteCell`,
drawScene.ts) and the whole-cell miniature (NeuronMapPanel's SVG), unchanged
ink and placement (`ASTROCYTES` / `MAP_ASTROCYTES`).

Guards (updated to the trace, citing A1): SIX contiguous point-groups
(broken to five by dropping a point's cubics and watched fail — "expected 5
to be 6"), measured proportions (tips scale to r, valleys between 0.5 r and
0.65 r), twelve polylines, the reach's last point on the fingertip to 1e-6,
its root on the soma, and the side-branch inside the stretched arm's span.
1168 tests green, typecheck clean.

**Corrections round (2026-09-04).** A1 — outline thickened at the scene's
register (1.5 → 2.5 px). A2 — the body FILLED on both views (scene wash
0.10 → 0.40, map 0.22 → 0.45): the faint wash read as hollow. A3 was a
science question, answered with the scene's own numbers, no redraw: an
astrocyte much smaller than the whole neuron is CORRECT (a rodent
protoplasmic astrocyte's territory is ~40–60 µm across against a dendrite-
to-terminal span of hundreds of µm), but measured at PX_PER_UM the drawn
glyph spans ~27 µm — a touch small against the real 40–60 µm territory,
declared rather than fixed; the miniature's cells are symbols, not to
scale, like the map itself.

### Step 21b-1g — the neurons re-drawn from the user's neuron (1).svg, 2026-09-04 · awaiting manual test

An illustration handover (~/Downloads/neuron (1).svg), reconciled in 05
before drawing (see 05 → Reconciliation — neuron (1).svg). Alignment answers
(2026-09-04): the trace becomes the LAYOUT, not just the ink; rotated a
quarter-turn to the scene's left→right flow; neighbours are the same species
reduced.

**A1 — reconciliation first.** Written in 05 with the measured facts of the
trace: a seven-point star soma (hillock cone drawn into it), seventeen
dendrite strokes (eleven rooted, six twigs, sketch gaps kept), one arcing
axon, an arbor of eight branch strokes and seven teardrop boutons whose
chains were derived by measured endpoint affinity (every join < 3.1 units).

**A2 — the big neuron IS the trace.** `NEURON_TRACE` (layout.ts) holds the
machine-extracted cubics; scale and place are SOLVED from the stage budget
(the cell spans px 190→950, between the input column and the target's
reach). Measured, not chosen: NEURON_K = 3.20, SOMA at (356.8, 0.46 H),
SOMA_R = 59 px, so PX_PER_UM = 5.9 and everything derived re-derives —
MEMBRANE_ZOOM ×2300, AXON_VIEW_SCALE ×10, SYNAPSE_VIEW_SCALE ×75,
DRAWN_AXON_UM 86.4 µm (still under a tenth of a millimetre, as the ribbon
view requires). The soma is drawn from `SOMA_OUTLINE` (no more circle), the
axon polyline is the traced arc (the membrane patch moved to its gentle
tail, AXON_MEMBRANE_T 0.55 → 0.86, and the passive door to 0.62 — the
marker-separation guard re-measures every pair), the eleven trunks keep the
`segs`/`path` contract (paths soma → tip), and the seven terminals carry
`path` (the traced route from the axon tip) and `outline` (the teardrop);
`TERMINAL_BRANCHES` is the drawn arbor ink. Terminal lighting, hit regions
and both miniatures follow the routes — never a chord across the arbor.

**A3 — the neighbours, same species reduced.** `partnerSoma` now draws the
traced star (`neuronSomaOutline`) turned so its cone faces where that cell's
axon leaves; the three input cells' straight stubs became reduced traced
trunk strokes fading at the far end (`partnerStubs`, `fadingPath`); the
target keeps its solved synapse stubs and off-stage axon.

**A4 — the small neuron.** The miniature and the spike-train inset draw
`SOMA_OUTLINE` and the traced arbor from the same layout exports; boutons
stay discs at those sizes (a teardrop three pixels wide is a disc — level of
detail cuts both ways).

**A5 — the attached elements re-anchored.** Zoom markers and the dashed ring
re-derive (measured spots: hillock 400,385; conduction 499,479; passive
636,393; membrane 747,347; outgoing synapse 953,311). SYNAPSE_TRUNKS is
SOLVED per input row (nearest input-facing tip, each used once → trunks
3/6/8); the target's stubs are SOLVED onto the three boutons nearest its
soma with the NEAREST at index 1 — the app-wide literal for the outgoing
synapse — so OUTGOING, the astrocytes and the whole synapse view re-anchor
themselves. Labels re-seated to the new anatomy (axon label under the arc's
dip; terminals label under the arbor) — positions await the eye, not a test.

Corrections the trace forced, measured first: the camera's axon turn now
reads the STRETCH (±1% of cable) because the traced arc curves where the
old quadratic did not; the membrane-exit probe in the handover test moved
0.3 → 0.2 (the solved scale shortened the patch→axon flight to fewer
decades); the ion-size test's hardcoded `0.001 × 4.4` became
`0.001 × PX_PER_UM` (a stale literal of the old scale).

Guards (citing their points): star soma with the axon rooted on its drawn
cone, valleys < 0.75 r and cone > 1.3 r (A2); seven terminals, each path
starting at the axon tip, ending on its bouton, continuous (no step > 2.2
boutons — this guard caught the extraction decimating across junctions,
which was then fixed in the data) (A2); eleven trunks rooted on the outline,
paths soma → tip (A2); three distinct synapse trunks, tips input-facing,
top-to-bottom (A5); the outgoing synapse on the bouton nearest the target,
three distinct stubs (A5 — broken by inverting the solve to the farthest
three and watched fail, taking the map-astrocyte guard down with it, which
is the coupling working). 1173 tests green, typecheck clean.

### Step 21b-1h — the arbor invaded, not switched on, 2026-09-04 · awaiting manual test

User: "improve signal transport animation at axon ends in all instances:
currently the whole thing lights up at once… Push back if there's a
scientific reason." No pushback — the opposite: the spike actively propagates
into the terminal arborization, forking at each branch point and reaching
the near boutons first, so the simultaneous flash was the axon's
lights-as-a-unit misconception replayed at the last fork. Declared
exaggeration where the durations live: a real arbor is invaded in tens of
microseconds; every leg of this chain is choreography.

**A1 — the big scene (and the scales exhibit through it).** The chain gains a
measured leg: `ARBOR_MS` (chain.ts) is the axon leg's own px-per-ms carried
through the forks (ARBOR_MAX_LEN / axon length × AXON_AP_MS ≈ 570 ms), and
`terminalHead` walks 0→1 across it, taking over at the tip the frame the
axon head lands there. The per-route coverage is ONE named decision —
`terminalReach(head, ti)` in layout.ts, with `terminalArrival` for the
bouton's own last-fifth glow and `partialPath` for the covered prefix — so
the renderer strokes exactly the travelled portion of each terminal's traced
route and each bouton lights only when the wave reaches IT. Release still
begins only after every bouton is reached (the arrive-then-release lesson,
now walked by the clock).

**A2 — the miniature.** The map's own sweep clock no longer freezes at the
axon's end: the overshoot is the wave's time in the branches
(`MAP_ARBOR_MS` = the same fraction of the sweep the model gives the arbor),
each route covered through the shared `terminalReach`, and the cable HOLDS
its settled glow while the arbor is invaded so everything lets go together.
`region.terminals` (the phase-driven all-at-once glow) is deleted — the
terminals are not a region any more, they are the end of the journey.

**A3 — other instances.** The scales exhibit renders through `drawScene` and
inherits A1. The spike-train bench's inset has NO arrival animation to fix —
it lights a static you-are-here region pulsing with the bench's own patch
spike — so nothing there pretends the arbor fires as a unit.

**A4 — declarations and rules.** The exaggeration is declared beside
`ARBOR_MS`; 03 → "Whether a signal is running, and where" now carries the
rule: THE TERMINAL ARBORIZATION IS PART OF THE AXON — it is invaded, never
switched on, and both pictures ask the same `terminalReach`.

Guards (citing points): the wave is walked by the clock — many sampled
moments mid-transit, monotonic, a real leg > 200 ms (A1; broken by pinning
terminalHead to 1 in the arbor window and watched fail); every bouton
reached before any release (A1); `terminalReach` covers the shortest route
while the longest is still short of its arrival window, nothing lights with
no wave (A1/A2); `partialPath` returns exactly the covered prefix, endpoints
pinned (A1/A2). 1177 tests green, typecheck clean.

### Step 21b-1i — the neighbours become whole neurons, and synapses get spines, 2026-09-04 · awaiting manual test

Alignment answers (2026-09-04): neighbours = "full traced neuron, reduced";
thickenings = "at the synapse-bearing tips only".

**A1 — "neighbour neurons... look like astrocytes."** They did, and the
diagnosis is not detail but POLARITY: a star soma with three stubs radiating
evenly IS the astrocyte glyph, whereas an astrocyte is radially symmetric
with no axon and a neuron has its whole fan on one side and one axon on the
other. So `partnerParts` builds every neighbour as the WHOLE traced cell,
reduced and turned about the axis soma → axon tip — which is also a fix:
`NEURON_FACING` had been the hillock cone's direction, turning every
partner's fan by the 53° between the cone and the axon's exit.

Each input cell now carries its complete 17-stroke fan (far ends fading at
the frame), a soma with a nucleus, and an arbor. Its axon is built by
SOLVING, not aiming: the terminal that contacts us is the one FARTHEST along
its arbor, so the cell's other six endings trail back along its axon instead
of sprawling across our dendrite; the arbor's hub falls where that puts it,
and the traced axon is stretched (`reachTransform`, fixed at the soma cone)
to reach it. The result is one continuous path — soma cone → hub → the
traced arbor route → the bouton — so the presynaptic spike travels the route
it really takes and lands exactly on the cleft (measured: 0.0000 px error).
Its other six boutons are drawn small and faint: that axon contacts other
cells too.

The target is the same cell turned to project onward off the right edge,
which puts its own fan back toward our boutons. Which of its dendrites
receives which bouton is SOLVED (nearest unused traced stroke per
postsynaptic point), then that stroke is STRETCHED to land exactly on the
point — the drawing is never nudged, the transform is (measured: 0.0000 px).
Its remaining 14 strokes are drawn where the frame lets them be seen.

`reachTransform` was EXTRACTED for this: the astrocyte's reach, an input's
axon and a target's dendrite are all the same move, and the astrocyte had a
private copy of it.

**A2 — "let dendrites start with thickenings."** `spineHead` + `drawSpine`:
a mushroom head on a narrow neck at every postsynaptic site — the three tips
of our fan that receive an input, and the target's three dendrites that
receive our boutons. Only there: a thickening is a claim, and drawing one on
all eleven tips would say every tip is a synapse. The head is seated BEHIND
the apposed face so it never grows across the cleft it faces, and it clears
the presynaptic bouton by 5.5 px. Not on the miniature or the bench inset —
two pixels at those registers, and level of detail cuts both ways.

Correction found while guarding A2: the neck's direction was taken from the
neighbouring path sample, and since the traced strokes are sampled every few
pixels the head could sit PAST that sample — the tangent then pointed back
into the cleft. It now walks a real arc distance (4 × head radius) back down
the dendrite.

Measured, for the record: input somata (58, 112/330/548) with fans cropping
4–11 px past the left edge as intended; axon lengths 124–266 px; the nearest
of an input's other boutons passes 10 px from one of our dendrites (drawn
faint and small — an axon passing a dendrite without synapsing on it is a
real thing); the target's fan reaches x = 961 against boutons at ~941, its
axon exits at x = 1255.

Guards (citing their points): each input has all 17 fan strokes plus an
arbor, and is POLARIZED — the fan's centre of mass and the cell it talks to
are on opposite sides of the soma (cosine < −0.4; a radially even glyph
scores ~0) (A1, broken by turning the fan toward the synapse and watched
fail, taking the target's off-frame-axon guard with it); an input's axon
leaves its own soma, is continuous, and ends exactly on its bouton (A1); the
target's dendrites are rooted on its soma, reach back toward us and land
exactly on the postsynaptic points (A1); a spine head sits behind the face,
clears the bouton by a real gap, and its neck runs inward not into the gap
(A2, broken by seating the head across the cleft and watched fail).
1181 tests green, typecheck clean.

### Step 21b-1j — the arbor's signal in the cable's own language, glia among the dendrites, spines re-seated, 2026-09-04 · awaiting manual test

**A1 — "improve signal in axon arborization: a yellow glowing dot with white
tail moves along the lines (same as on axon body)."** The previous round lit
a growing PREFIX of each terminal route — progressive, and still a different
animal from the signal on the cable it continues. It is now the same
`travellingSignal` the axon uses, at the axon's own tail length
(`ARBOR_TAIL_PX` = 0.11 of the cable = 56 px; route lengths 109–167 px, so
0.34–0.51 of each). Rule folded into 03: when one structure continues
another, the signal on it is drawn by the same function.

⚠ **Fronts are DEDUPED, not drawn per route** (`arborFronts`). Seven routes
share their first stretches and every route is covered at one speed, so the
heads on a shared stretch are the SAME POINT: one signal per route would
stack seven glows into a flare on the shared limb — brightest exactly where
the picture is least interesting. Measured over a run, the count goes
1, 1, 2, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, then falls back as routes
arrive and their boutons take over: one dot leaves the axon and BECOMES many
at the forks, which is the thing the picture is for.

**A2 — "draw more astrocytes next to main neuron dendritic arborization."**
Scientifically the right correction, and recorded as such in 05: glia are
not a decoration of one synapse. Four `DENDRITE_ASTROCYTES`, spots SOLVED
(grid over the fan's bounding box; clear of every dendrite, the soma, the
axon, every zoom marker and the input cells' axons; roomiest first, spaced a
cell's width apart), each reaching the nearest point on a branch. Measured:
(260,120), (484,141), (484,351), (176,260), each ~44 px clear of the nearest
dendrite at r = 21.

**A3 — the spines re-seated.** The head was offset along the line to the
partner's bouton, a direction the dendrite knows nothing about, so it sat
beside the end of its own branch. Centred on the tip now; clearance made by
standing the BOUTON off at `CLEFT + SPINE_HEAD_R`, which leaves the drawn
gap exactly as it was (5.5 px in, 7.8 px on the target's side).

Guards: fronts start at one and become many, never coincident, none after
arrival (A1 — broken by removing the dedupe and watched fail, 7 where 1 was
expected); the tail is the axon's own and is a real fraction of every route
(A1); astrocytes clear of the branches yet among them, on the sheet, clear
of soma and every door, reach landing ON a dendrite, and not piled on each
other (A2 — broken by dropping the clearance filter and taking the tightest
spots, watched fail at 0.43 px from a branch); the head is centred on the
tip, the neck runs inward and stays on the branch, and both sides keep a
real gap (A3 — broken by seating the head across the cleft, watched fail).
1185 tests green, typecheck clean.

### Step 21b-1k — the dendrite patch found its own membrane, 2026-09-04 · awaiting manual test

**A1 — "dendrite membrane zoomed in view is missing lipids."** Not a missing
drawing: a missing MEASUREMENT. The dendrite tapers since the trace landed,
and the patch frame was still cut with `segs[0].w` — the width at the soma
end — while the drawing puts a thinner seg at the patch's own t. The frame's
wall and the drawn wall were 0.48 scene pixels apart: nothing at ×1, and
**1104 screen pixels at the membrane view's ×2300**, so the camera arrived
on empty water with the bilayer off-screen. `trunkHalfWidthAt` now cuts the
frame with the width the drawing uses there (1.94 against the soma end's
2.42), and the patch centre lands on the drawn wall to 0.002 scene px.

⚠ **The guard that let it through** only ever checked the axon, whose width
is uniform — so it could not fail. It now covers EVERY framed target and
asserts the list of framed targets is exactly the list it checks, so a new
patch cannot be added without being measured. Broken back to the soma-end
width and watched fail.

**A2 — "it also requires 'back to the whole picture'."** Verified rather
than built: the control exists (`NeuronStage`, gated on `zoom !== null`,
`z-10` over an unlayered Stage) and does render at this view. It was A1 that
made the view look like a dead end — an empty canvas with nothing on it to
come back from. No second copy of the affordance was added; one drawing of a
control, never two.

**A3 — thickenings filled.** `SPINE_FILL` (0.62) and `SPINE_FILL_PARTNER`
(0.70) in place of the 0.12 cytoplasm wash, which reads as nothing at a
six-pixel bulb — the shape was a ring, not a swelling.

**A4 — "make astrocytes on the left side slightly transparent."**
`DENDRITE_GLIA_ALPHA` = 0.5. The two at the synapse stay at full strength:
that synapse is a place the app teaches, the dendritic field's glia are the
neighbourhood the branches run through.

**A5 — "unify labels across the app. Source of truth: vesicle view."**

Alignment answers (2026-09-04): scope = "also connectors + 🏷 switch
everywhere"; voice stays **per term** (the standing shorthand governs, not the
vesicle view's speakers); the resting bench's speaking state word is kept as a
recorded exception.

⚠ **The conflict was raised before any code was written.** Unifying on a view
whose every label speaks would have given ~40 terms an F04 button nobody
asked for, against the standing rule "add voice to term A = give term A a
speaker wherever it is taught". The user ruled: unified covers the LOOK, not
which terms speak. Recorded in 03 → *Where words go*.

*One style.* `spokenLabels.ts` now owns `LABEL_PLATE`, `LABEL_INK`,
`LABEL_PX`/`labelFont()` and `drawConnector()`, plus `drawName`/`named` — a
name without the glyph, hit-boxed for a word that has no glyph in front of it.
The whole-neuron scene stopped running its own system (13px `ui-sans-serif`,
slate plate, ink `#64748b`) and imports the same four things.

*One leader.* `channelScene` and `lipidLabScene` had their own ink and started
at the label's ink EDGE; both now call `drawConnector` (box centre, one ink).
On the whole-neuron scene the leader is drawn AFTER the keep-out nudge — drawn
from the queued anchor it would miss its own plate whenever a panel pushed the
name aside. Leaders were added where a name points at a discrete thing (the
input and target cells' names → their somata; the soma's own name; a
protein's name → the protein) and deliberately withheld where the survey
showed one would lie: extended structures, half-planes, and views that already
tie small-to-big with amber magnifier frames.

*One switch.* `state/labelsStore.ts` — a single app-wide flag replacing
`snareStore.labelsOn` and `synapseStore.labelsOn` before a third copy could be
written. Wired into ChannelBench, FilterBench, CapacitorBench, PermeaBench,
RestingBench, PatchBench, LipidLab and the whole-neuron stage (top-right of
the picture it acts on; inside a zoom it drops under the back button, clear of
the axon views' scale plate). Every bench scene gained a trailing
`labelsOn = true` parameter, so existing callers and tests keep working. It
hides NAMES only — readings on a scale are untouched.

*Four leaks closed*, all found by the survey: `'active zone'` (synapse view)
was a bare 12px `fillText` outside the switch guard, beside three names inside
it; `'aquaporin'` (permeability bench) the same; the filter bench printed
`ion.name` as a lane title directly above the spoken name for the same ion —
the canvas saying one thing twice in two styles, now deleted.

Guards (`labelStyle.test.ts`, citing A5): a spoken name and a silent one share
plate, font and ink and differ ONLY by the glyph (broken with a second plate
and watched fail); the plate is never stroked; the font is the app's one font;
a silent name is not padded for a glyph it lacks; a leader runs box-centre →
target (broken to start at the ink edge and watched fail); and the switch
leaves readings alone — the capacitor's `×N` and the patch clamp's mV/ms ticks
are identical with labels on and off (broken by gating a reading and watched
fail). 1193 tests green, typecheck clean.

### Step 21b-1m — the synapse stands the way the release view draws it, 2026-09-04 · awaiting manual test

**A1 — "turn 'focus' into a switch toggle, same as 'labels'."** 🔆 focus was a
press-to-light chip while 🏷 labels beside it was a track-and-knob switch: two
controls that both turn one thing on and off, looking like two different kinds
of control. The affordance was EXTRACTED (`ui/ToggleSwitch.tsx`, icon + word +
knob); `LabelsSwitch` is now a thin wrapper on it and focus uses it directly —
one drawing of the affordance, never three.

**A2 — the circle inside a soma.** Answered, not built: it is the NUCLEUS, and
it is what makes a cell BODY read as a body rather than a blob where processes
meet. Neurons already carry one (focus cell and every partner). Astrocytes do
not — recommended and offered, awaiting the user.

**A3 — "the vesicle release view is horizontally aligned, whereas the acting
connection on the whole neuron view is vertical."** The scene's synapse lay
along x and the camera turned a quarter on the way in to meet the release
view's across-the-frame cleft. The scene now STANDS that way and the turn is
gone (see 03 → *A view and the scene it is reached from must AGREE*).

Solved, not placed: the target listens to the arbor's three LOWEST endings
(terminals 6/5/3), ordered left→right so its dendrites never cross; its
postsynaptic points are straight DOWN from each bouton across one cleft; and
it stands under them at exactly its own traced fan's reach, so its dendrites
arrive stretched 52–110 px rather than hauled out of scale. Measured: bouton
(855, 491) → tip (855, 515), soma (874, 597), bottom edge 625 against a
660 stage. The two astrocytes moved to flank LEFT and right of the cleft
(773, 555) and (941, 549) — the same two cells, read without the rotation.
Both synapse framings now have `turn: 0`, and the active-zone marker offsets
along the synapse's own axis.

The miniature gained the postsynaptic neuron (dimmer, drawn first so the
subject sits on top), and `NEURON_MAP_BOX` had to stop cropping: it took its
width from the x extent alone and derived height from MAP_ASPECT, which cut
the target off the sheet the moment it moved down. The box is now solved to
CONTAIN its content at that aspect.

**A4 — "vesicle release view is missing 'back to the whole image' button."**
It was a bare ✕ — and that is the app's own stated failure: icons rank, they
do not name. Fixed in `SideDrawer`, so EVERY drawer gained the same named way
out, in the stage's own words. In the flow rather than floating: every drawer
already puts something in its top-right corner (this one's transport bar runs
across the canvas there), and a pill laid over that is chrome sitting on the
exhibit.

Guards (citing A3): the cleft is vertical to within a pixel and exactly one
cleft deep, the target stands under the whole arbor and on the stage (broken
back to a horizontal cleft and watched fail); neither framing turns the camera
(broken back to π/2 and watched fail); the target listens to the lowest three
with index 1 nearest and no dendrite wildly out of scale; the postsynaptic
cell and its tips are inside the miniature's box (broken by letting the box
crop again and watched fail). 1197 tests green, typecheck clean.

### Step 21b-1n — the escape hatch dug out from under the chrome, 2026-09-04 · awaiting manual test

**A1/A2 — "'outgoing synapse' is missing 'back to the whole picture' button,
add, and verify other zoom-in areas."** It was never missing — it was
underneath. Two views lay a full-width control column across the same top
band at the same `z-10`, later in the DOM: the synapse framings (`atSynapse`)
and a membrane patch during the spike demo (`atMembrane && showSpike`). The
axon views (`atAxon`, `atPassive`) use a CENTRED plate, which is the only
reason they never showed the fault — the rule held by accident in three views
and failed in two.

Verified across every zoom-in area: incoming synapse, dendrite membrane,
hillock, axon membrane, along the axon, passive spread, outgoing synapse,
active zone. The hatch is now positioned from shared numbers
(`ui/stageChrome.ts`) and sits above every column by z rather than by DOM
order; both full-width columns start below its band. The standalone 🏷 switch,
which had been parked at `left-3 top-14` inside a zoom, moved to the
bottom-right — the top band belongs to the hatch, and the bottom-LEFT already
belongs to the patch doors' shelf. No second button was added: a duplicate
would have "fixed" it while leaving two escape hatches to keep in step.

**A3 — "drawers do not need such."** Last round's `SideDrawer` change is
reverted; drawers keep their ✕. Recorded in 03 as a distinction rather than a
preference: a zoom is somewhere you went and the camera brings you back; a
drawer is something you opened over where you already are, and closing it is
the whole of the return.

**A4 — "draw nucleus in astrocytes too."** `astroNucleus` — one decision, at
0.3 of the soma radius, asked by the canvas and by the miniature so the two
cannot drift, in the glial green taken darker (a nucleus is denser than the
cytoplasm, and reading as a different SUBSTANCE from the neurons' slate is
what the green is for). Measured: nucleus 7.8 px against a valley of 15.7 on
the r = 26 cell, 6.9 against 13.89 on the r = 23 one.

⚠ **Formatting drift repaired.** An earlier `npx prettier --write` in this
session ran with no repo config and reformatted `drawScene.ts` to prettier's
DEFAULTS — 907 semicolon-terminated lines against 1 in every sibling. The
repo's actual style was recovered by testing an untouched file
(`--no-semi --single-quote --print-width 90` matches `core/ions.ts` exactly)
and every file touched this session was brought back to it.

Guards: a view's column starts below the hatch with real air, and the hatch
outranks every column by z (both broken and watched fail); the button is a
real target, not a hairline; an astrocyte's nucleus is centred, a real
proportion of the body, and fits inside the star's VALLEYS rather than merely
inside its points (broken to 0.65 r and watched fail — 16.9 against a 11.7
valley). 1201 tests green, typecheck clean, formatting clean.

### Step 21b-1p — the way out moved onto the map, 2026-09-04 · awaiting manual test

**A1/A2/A3 — "modify 'back to the whole picture' into a minimalistic button,
and place it inside the 'map neuron' container, in the left bottom corner, for
all occurrences."** Done, and it SUPERSEDES the previous step's fix rather
than adding to it. `ui/stageChrome.ts` and its test are deleted: the band
arithmetic existed only to stop a stage-level overlay burying a stage-level
button, and there is no longer a stage-level button. The two full-width chrome
columns went back to `top-3 z-10`, giving the picture back the 36 px the
workaround had cost.

The control is now one small pill in the miniature's bottom-left corner
(`⤢ back`, the sentence moved to `title`), shown only when there is somewhere
to come back from. Structurally this makes the burial class of bug impossible:
the button is no longer a sibling of the things that were covering it, the
panel is permanent and unconditionally mounted (App.tsx, first in the column),
and the picture it sits on IS the destination. Verified: exactly ONE such
control now exists in the app.

**A4 — "place 'labels' on 'AP' demo, on the left from 'focus' toggle."** The
two switches now sit together in one row on the spike demo's plate, 🏷 before
🔆 — names are what the picture SAYS, focus is how hard it says it. They are
the same kind of control and now read as one. The standalone 🏷 switch stands
down wherever a view carries its own, so no view shows two: the gate is now
`!atSynapse && !(atMembrane && showSpike)`.

No new guards: this round is chrome PLACEMENT, which only an eye can judge,
and the three `stageChrome` tests were deleted with the constants they pinned.
1198 tests green, typecheck clean, formatting clean.

### Step 21b-1q — the zoom markers made findable again, 2026-09-04 · awaiting manual test

**A1/A2 — "magnifying glass areas are not visible on the big neuron, as
things got more cluttered."** The markers were calibrated against a nearly
empty scene: a slate ring at 0.75 alpha over grey anatomy. Since then the
scene gained the traced fan with its twigs, seven boutons, four whole partner
cells and six astrocytes, and the doors stopped standing out. Nothing failed,
because nothing measured whether a marker separates from what is behind it.

`markerStyle(hot)` now returns the appearance as numbers rather than drawing
it inline, so the decision can be asked directly. RESTING takes the
prominence hover used to carry — ring and icon at full strength — on a dark
BACKING DISC, which is what actually makes it survive clutter (the same answer
the app already uses for a name that would vanish into what it lies on; more
brightness would just compete with a bright scene). Its ink moved off the
cell's own slate to near-white, so it reads as chrome rather than anatomy. No
label at rest.

HOVER now means exactly one thing: the yellow glow, and the name. Reserving
the yellow for hover makes "which door is under my pointer" answerable by
colour rather than by a difference in strength nobody can see.

Guards (citing their points): resting ring and icon are at full strength and
equal to the hovered ones — hover is not how you find a door (A1); resting
carries no label and hover does (A1/A2); the glow is hover's alone and is the
app's one signal yellow, which the resting ink is not (A2); both states darken
what is behind them (A1). Broken twice and watched fail — back to a faint
ringless marker, and again with the label and the yellow moved to rest.
1202 tests green, typecheck clean, formatting clean.

### Step 21b-1r — the fan drawn once, the parts given voices, navigation in yellow, 2026-09-04 · awaiting manual test

**A1 — "dendrites… have visible dots on the places where its pieces collide."**
Not a geometry fault: a COMPOSITING one. The fan is modelled as segments and
the scene stroked them one at a time with round caps, under the fan's own
`globalAlpha` — so each join's two overlapping caps painted 1 − (1 − α)²
instead of α (0.98 against 0.85), a bright dot at each of ~30 joins per
branch, on ~170 segments. Invisible at full opacity, which is why nothing
caught it.

`DENDRITE_STROKES` now exports the branches as whole polylines with their
taper, and `DENDRITE_SEGS` is DERIVED from them so the two cannot drift. The
scene draws each branch as one tapered ribbon (walked up one side, round at
the tip, back down the other) and fills it once. Rule folded into 03 in its
general form: any translucent drawing made of overlapping pieces shows its
seams, and it hides at α = 1.

**A2 — "add voice on the labels, which name neuron parts (not navigation)."**
`sceneTermSpeaks` — ONE predicate, consulted by the part names AND by the zoom
markers, so a door cannot acquire a voice by being handed a `speak` field.
The four part names (dendrites, soma, axon, axon terminals) now carry the F04
glyph and say themselves; marker labels do not. The hit box is recorded by the
drawing at the label's FINAL position — after the camera and after the
keep-out nudge — and the stage hit-tests that, so the target is exactly where
the word ended up. A tap on a name claims the click, so saying a part's name
does not also clear the selection under it.

**A3 — "make nav dashed circles yellow."** This revises last step's choice
(near-white at rest, yellow held for hover) and improves it: the miniature's
"you are here" ring was already amber, so a yellow dashed circle now means one
thing on both pictures — a place you can go, or the place you are. Hover is
still unmistakable: it adds the glow and the name. The 03 rule written last
step was corrected rather than left to contradict this.

Guards: 17 whole branches against 170 segments, with the segments derived from
the strokes (broken by truncating the derivation and watched fail); the taper
agrees end to end with the segments' widths; every part name passes the voice
predicate and every marker label fails it (broken by letting the predicate say
yes to everything and watched fail); navigation is the signal yellow in both
states and the glow is hover's alone. 1209 tests green, typecheck clean,
formatting clean.

### Step 21b-1s — chrome placement, and a rule for it, 2026-09-04 · awaiting manual test

**A1 — "'Trace the whole signal' canvas has padding on the right."** Not
padding: the scales exhibit draws at the scene's own size and is fitted by the
SMALLER of the two ratios, and height is the binding one — so the canvas is
narrower than its box, and the box's own border left a band of empty panel
beside it. `w-fit` makes the border the picture's edge.

**A2 — "place 'labels' in 'myelin' section, to the top, as it overlaps with
the graph."** It sat bottom-right inside a zoom, which on the axon views is
where the voltage-against-distance plot is — an instrument, and the thing that
view exists to be read. Moved to the top-LEFT, the one corner free everywhere
it appears: those views' plates are CENTRED at the top, the ×N reading is
top-right, and the escape hatch has left the canvas for the map panel. (The
stale comment in `drawMagnification` about the button that used to overlay the
top left was corrected at the same time.)

**A3 — "place 'back' button also in drawers, so everywhere where 'map neuron'
is present."** The spike-train bench carries an inset of the whole cell and now
carries the control with it, in the same corner and the same words. Its drawer
✕ is NOT the same act: the bench opens at the axon-membrane zoom, so closing
it leaves you inside a patch — the control does both steps, close then pull
out. Recorded in 03 as the earlier ruling HOLDING rather than bending: a
drawer with no map still only closes. What earns the way out is the map.

**A4 — the filter and the bilayer lab** put their switch outside the picture,
above it and right-aligned: those canvases are dense edge to edge and any
corner covers something.

**A5 — permeability and capacitance lose the switch** and always show their
names. They are the two exhibits the rule below says do not earn one.

**A6 — the SNARE row** puts ▶ left and 🏷 right, under the timeline: two
different kinds of control at opposite ends, the middle of the bar free.

**A7 — the rule, from the facts.** Counted across the exhibits (names on
canvas, canvases, whether anything runs) and written into 03 → *Where a 🏷
switch goes, and whether it is earned at all*. A switch is earned by DENSITY
(≈6+ names) or by MOTION ACROSS the names, and by nothing else; placement
takes the first that applies of: an existing control row → a genuinely free
canvas corner → outside the picture. Never over an instrument.

### Step 21b-2 — D17, where the transmitter goes, 2026-09-04 · awaiting manual test

The next step, built to the 21b plan after its four open questions were put to
the user (framing, the ion fare, glutamine's ink, the dot count).

**The science, and why this drawer exists.** This synapse is glutamatergic,
and glutamate is cleared mostly by ASTROCYTIC EAATs feeding the glutamine
cycle — the tidy "terminal sucks its own transmitter back" picture belongs to
GABA and the monoamines. So the star is the third cell.

⚠ **An honesty finding the tests forced.** The plan declared an 80% astrocytic
split; with seven whole molecules the only available splits are 6:1 (86%) and
5:2 (71%), so asserting 0.8 while drawing 6:1 would have claimed a precision
the picture does not have. The literature gives a RANGE, so the model now
declares the range (`ASTROCYTE_SHARE_RANGE`, 80–90%) and the test requires the
DRAWN ratio to land inside it. A redraw that wanders out is caught.

**Model** (`core/reuptake.ts`): six staged legs with holds, the catch given the
most screen time because it is the payload; seeded per-dot assignments; one
continuous path per molecule; `cleftLoad` and `stockedCount` for conservation.
A dot is glutamine ONLY between the two enzymes — the same dot throughout,
never swapped for a fresh one, which is the point: transmitter is recovered,
not consumed.

**Scene** (`stage/reuptakeScene.ts`): the tripartite synapse in section —
terminal wall across the top with its inside above, postsynaptic face across
the bottom, the astrocyte wrapping in from the right and fading at the frame
rather than inventing a surface off the page. Every wall paved by the shared
`paveMembrane` at D06's own register; transmitter drawn by D06's own
`transmitterDot`; the fare in the app's own glossy ions. Camera fixed, so the
round trip reads as a loop.

**Glutamine is ORANGE** `#fb923c`, reconciled in 05 with its two rejected
rivals recorded: pale teal reads as FADED glutamate at dot size ("this one is
running out" is the one thing it must not say), and rose was refused because
red is the reserved + charge colour.

**Entry**: the ♻️ door on the synapse view's shelf, reserved and disabled since
2026-09-04, is now open beside 🫧 — two doors at one place, two icons. A
contents row was added with it.

Guards: conservation (every molecule stocked at the end, broken by dropping
one and watched fail); the gap empties monotonically and only by catching; the
drawn split inside the declared band (broken to 50/50 and watched fail); one
spell as glutamine and only between the enzymes; glutamine never in the cleft;
the neuronal route never converts; monotone progress; the fare drawn once
inside the catching leg; the labels switch hides names and nothing else; and
the whole scene draws through `strictCanvas` at six moments with no
unparseable colour or non-finite number. 1233 tests green, typecheck clean,
formatting clean.

⚠ **Not verifiable without eyes**: this exhibit has never been looked at. The
tests pin its decisions and its arithmetic; whether the picture READS — whether
the loop is legible, whether orange against teal says "changed" — is exactly
what the tests cannot tell you.

### Step 21b-3 — D17 rebuilt on the synapse view's own picture, 2026-09-04 · awaiting manual test

**A1 — the labels switch in 'Spike trains': SKIPPED, by the user's ruling.**
Measured first: that bench draws no names at all, only readings (mV ticks,
`spike`/`nothing`), and readings are never hidden by the 🏷 switch — so a
switch there would have controlled nothing. Offered three ways (name its parts
first, add it anyway, skip); the user chose skip. Recorded in 03 → *A switch
with nothing to switch is not a control*, so the gap reads as deliberate.

**A2 — "not kids-friendly, torn out of context… re-build from scratch."** The
first D17 invented its own composition and was a diagram of a PROCESS rather
than a picture of a PLACE. Deleted and rebuilt on the synapse view's own
geometry: same `synapseGeometry`, same bouton, same cleft, same spine, and the
same two green glial fingers drawn by `drawAstroFinger` — which was EXPORTED
for the purpose, along with `spinePath`, `membraneBand` and `CYTOPLASM`,
rather than copied. Two drawings of one astrocyte at one synapse would be two
astrocytes.

What the drawer adds is now only its own subject: the transporters ON those
fingers (the child can see what they belong to), the terminal's single door on
its own wall, the enzyme inside the finger, and the journey. The transmitter
starts in the gap it was released into, is taken through a door at either
mouth, converts inside the astrocyte, comes home and is stocked.

⚠ **The orientation question is answered in the picture, at every moment**:
`astrocyte`, `axon terminal` and `dendritic spine` are drawn throughout the
run, not only on the opening still — which is what "where is the astrocyte?"
actually asked for.

Guards: it is the synapse view's own geometry, not a second one (broken by
scaling the width and watched fail); every transporter passes
`astrocyteHolds` on the finger it sits on (broken by floating them off and
watched fail); both enzymes are inside a cell; all three cells are named at
every moment (broken by renaming the terminal and watched fail); the journey
starts in the cleft and ends in the store; glutamine never appears in the gap;
nothing teleports; the fare is drawn once inside the catching leg; the labels
switch hides names and leaves the picture. 1237 tests green, typecheck clean,
formatting clean.

⚠ **Still not verifiable without eyes.** The tests pin that this is the same
synapse and that everything sits on the thing it belongs to. Whether the loop
now READS as a loop, and whether orange against teal says "changed", remains
the part only a person can judge.

### Step 21b-4 — the switch to the top right, the exhibit to the full width, 2026-09-04 · awaiting manual test

**A1 — "make sure 'labels' are in the top right corner, unless space is
already taken. Align horizontally with other buttons, if any."** Audited all
nine places. Already right: the channel (top-right, level with its Send row at
`top-3`), the resting bench (top-right, no neighbours), SNARE and D17 (in the
control row, right-aligned opposite ▶), the whole-neuron stage (top-right),
and inside a zoom top-LEFT — because the ×N reading takes the top-right there,
which is the "unless taken" case.

Changed: the selectivity filter, the phospholipid bilayer and the patch clamp
all had a row of controls ALREADY and the switch either floated over the
picture or sat in a strip of its own above it. It now joins the existing row
at its right end (`ml-auto`), horizontally aligned with the buttons beside it.
This supersedes the previous round's "outside the picture, in a row of its
own" for the first two — the rule in 03 was rewritten rather than left to
contradict itself.

**A2 — "Trace one signal: stretch canvas to take all available space
horizontally."** ⚠ This ran straight into a recorded correction: fitting by
width alone "cropped the bottom off" (2026-08-28), which is why the exhibit
fits by both sides. Measured before choosing: on a tall window the scene grows
with the viewport while the drawer's room does not, so the fit is height-bound
and leaves ~70 px unused at the right; filling the width needs ~57 px of
vertical trim.

Both instructions can hold at once, because the 2026-08-28 fault was not the
fitting — it was that nothing measured where the scene's ink ENDED, so the
crop ate the cell rather than the water. `SCENE_INK_Y` (layout) measures it
from the cell, its partners, the glia and the labels; `fitScene` fills the
width by trimming margin symmetrically and only while the trim provably stays
inside that margin, falling back to the both-sides fit when it would not. The
old behaviour is now the fallback, not the rule.

⚠ **A guard that could not reach its branch.** The first version of this was a
module-level constant, and breaking it changed nothing: in a test environment
the window is short, the scene is short, width already binds, and the crop
branch never ran. It was made a parameterised decision (`fitScene(roomW,
roomH, sceneW, sceneH, ink)`) and asked at shapes this machine does not have.
Then both branches broke and were watched fail — cropping without measuring
the ink (73 px taken where 0 was allowed), and reverting to both-sides-only
(869 where 728 was the room). 1244 tests green, typecheck clean, formatting
clean.

### Step 21b-5 — the transmitter named, and the claim that depends on it qualified, 2026-09-04 · awaiting manual test

User: *"what makes us think that neurotransmitter, displayed in 'the synapse'
demo is glutamate?"* — asked as a question, answered as an assessment, then
implemented at the user's word.

**The finding.** Nothing in the picture PROVED it; the app had chosen glutamate
and committed to it in every number — AMPA-type receptor rates, a 0 mV
reversal, glutamate's own diffusion coefficient (3.3e-6 cm²/s), 4,000
molecules a vesicle, a 20 nm cleft, and a synapse landing on a spine (which
`boutonShape` records as the reason the illustration handover was altered).
The choice is well founded. It was simply never stated: `core/synapse.ts` said
"transmitter" seventeen times and "glutamate" none, and all the reasoning lived
in code comments.

⚠ **Why it mattered beyond tidiness.** D17 teaches that the astrocyte does most
of the clearing — true of glutamate, FALSE of GABA and the monoamines, which
the neuron largely recovers itself. Unqualified beside an unnamed synapse, that
reads as a fact about transmitters in general: the app was one unstated
assumption away from teaching the very misconception the 2026-09-03 pushback
existed to prevent.

**A1 — the synapse view names it, and shows its working.** A new paragraph in
`synapseFacts`: the chemical is glutamate, and you can tell from the picture —
it excites rather than quietens, it lands on a spine (where excitatory synapses
go and almost nowhere else), and the doors it opens are AMPA receptors, which
only glutamate fits. It closes by saying other synapses use other chemicals and
some work quite differently, so naming this one does not teach that every
synapse is like it.

**A2 — D17's claim carries its qualifier.** The astrocyte paragraph is followed
by one saying the claim is about THIS chemical, that other transmitters do it
differently — several the tidy way everyone expects — and that this is the rule
for the commonest synapse, not for every synapse. The MEASURED honesty line now
reads "MEASURED, AND ABOUT GLUTAMATE SPECIFICALLY", and ends: "the same number
for a different transmitter would be a different number."

Guards (on the words, as the generic channel's are): the synapse view names
glutamate, gives all three tells, and admits other synapses differ; D17 names
the transmitter its story is about, says other transmitters differ, and states
its measured split as being about glutamate. Broken and watched fail — the
naming claim replaced with an anonymous sentence (3 guards down), and D17's
two qualifiers removed together (3 guards down; removing only one correctly
left the guard passing, since the property survived in the other place).
1250 tests green, typecheck clean, formatting clean.

⚠ **A process note.** The first attempt at breaking these guards used a greedy
regex that deleted ~280 lines of `reuptake.ts` and two paragraphs of
`synapse.ts`. Both were recovered from the saved chunks and verified against
HEAD (the only diff in `synapse.ts` is the new paragraph plus two prettier
reformats). The lesson is the obvious one: a break must be surgical, and a
break that deletes a region is not a break, it is damage.
