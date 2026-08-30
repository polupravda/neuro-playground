# Visual language — reference and drawing specs

> The home of the app's visual vocabulary and of per-exhibit **drawing specs** —
> handover-style descriptions of a single picture (composition, layers, objects,
> proportions, distribution), like the worked example at the bottom. Binding
> rules live in [03-architecture.md](03-architecture.md); this document applies
> them to concrete pictures.

## Conflict protocol — read first

**When an incoming reference or handover contradicts an established rule or an
earlier decision of the user: stop and ask.** List every conflict prominently —
the reference's words beside the standing rule — and put it to the user as
explicit questions *before* writing the spec. Never resolve a conflict
silently, and never invent a new category that lets both sides be true.

> Ruled 2026-08-27: an illustration handover proposed textbook-flat style (no
> gradients, ruled parallel membranes, hollow-circle vesicles, no organic
> unevenness). A first draft of this document accommodated it by inventing a
> separate "schematic register". The user rejected the accommodation: **the
> established language wins on all points, in every picture.** There is no
> textbook-flat register.

**Precedence**, when a spec is written:

1. Scientific correctness (03 → *Scientific honesty rules*; the spec's ⚠ rows).
2. The architecture's drawing rules (03 → *Drawing a scene*, *Visual language*,
   *One biology, one drawing*, *Alive, not drafted*).
3. This document's conventions.
4. The incoming reference — for **composition and content**, never for style.

Every spec ends with a **Reconciliation** section recording what was changed
against the reference and which rule required it — and any conflict in it must
have been put to the user before the spec was accepted.

## One language at every level of detail

The app draws in **one visual language**. A miniature, a ghost, a locator
thumbnail or a drawer figure may reduce **detail** — fewer elements, smaller,
dimmer, gentler — but never switch **style**. In every picture, at every size:

- **Membranes are liquid** (`LipidRun`'s `waveAt`/`slopeAt`), never ruled
  parallel lines. Where lipids are too small to draw, the wall still wanders.
- **Structures carry seeded organic unevenness** (03 → *Alive, not drafted*):
  lipids not aligned along the membrane's width, spacing jittered, no perfect
  symmetry. Seeded per element identity — never `Math.random`, never resampled.
- **Materials are true.** A vesicle is a **bilayer ring** drawn by the scene's
  own bilayer code — that it is the same stuff as the membrane is why it can
  fuse. Machinery that works together is drawn together.
- **Particles are the glossy house style**: one extended radial gradient, no
  canvas shadows, no 3D effects (`stage/particleStyle.ts`).
- **One biology, one drawing** (03): a structure appearing in a drawer reuses
  the code that draws it on the scene. No second private drawing of anything.
- **Conservation** in any animation: nothing appears, disappears, or teleports.
- **Honest scale, declared exaggerations** — the real number beside the drawn
  one (`synapseScaleNote` pattern).
- **Words:** names and readings on the canvas; leader lines are allowed for
  names — thin, straight, **no arrows** (arrows are reserved for force/flow) —
  and every sentence goes to the info block.

## The info block, verbatim from the atomic playground

Documented 2026-08-27 from `atomic-playground/src/ui/InfoPanel.tsx` and
`ElementCard.tsx`, after this structure was approximated wrongly twice. This
is the binding reference; deviations are bugs.

**The container** is ONE box, and everything the reader gets lives inside it:

```
<aside class="h-full w-64 overflow-y-auto rounded-xl border border-slate-700
              bg-slate-800/40 p-3 text-sm leading-relaxed text-slate-300">
```

- One rounded border, one background, `p-3`, and the SCROLL IS INSIDE the box
  (`h-full overflow-y-auto`): the frame stays put, the contents move.
- Drawer describers here use exactly this container (width from the drawer's
  grid instead of `w-64`).

**Sections** are separated by top borders on the headers, never by nested
boxes:

```
first header:  <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
later headers: <h2 class="mb-2 mt-4 border-t border-slate-700 pt-3 text-xs …same…">
```

An accented sub-headline inside a section (an event title, a view name) is
`<h3 class="mb-1.5 text-sm font-medium text-amber-300|text-sky-300">`.

**Paragraphs** are icon-led rows in a `space-y-2` flow:

```
<div class="flex items-start gap-2"><span class="shrink-0">{icon}</span><p>{text}</p></div>
```

Every fact is one such bullet; enumerations (this app's permeability readings,
atomic's tips) are lists of these, one icon each — never a single paragraph
with separators glued into it.

**Photographs are plain figures IN the flow** (`ElementCard.tsx`):

```
<figure class="mb-4">
  <img class="h-44 w-full rounded-xl border border-slate-700 object-cover" … />
  <figcaption> caption (text-sm) · attribution (text-[9px], right, linked) </figcaption>
</figure>
```

**THE PHOTO BLOCK IS A SIBLING OF THE INFO BLOCK — never its child.** Ruled by
the user on 2026-08-27 after FOUR asks (twice built as a nested sub-panel,
once as in-flow figures — all wrong). The pattern is the main column's own:
`RealPhotoBlock` stands beside the info container as its own bordered panel,
in every column and every drawer alike. Corollary: no bordered, self-scrolling
sub-panel ever goes INSIDE the info container — a panel inside a panel is the
named anti-pattern. (`PhotoFigures` — bare figures — remains only as the
shared internals of `RealPhotoBlock`; atomic's element card keeps photos
in-flow because the whole card IS one panel, which does not transfer here.)

## One phospholipid, one badge (the two things drawn everywhere)

**The molecule** (`bilayer.drawLipidAt`, source of truth = the
phospholipid-bilayer drawer): a shaded head facing the water, two tails
splaying inward from just under it, one of them kinked where a view magnifies
enough to show it. Every proportion is a fraction of the head's radius —
tails start at 0.6 r, splay 0.163 r → 0.327 r, thickness 0.288 r, kink bend
0.31 r — so the bench-sized molecule and the scene's honest,
magnification-derived one are the same creature at different sizes. The
SIZES themselves are measured, not chosen (28i): head = the declared 1 nm,
spacing = √(area per lipid) ≈ 0.81 nm, tails = the rest of the leaflet, which
puts the head at 40% of a leaflet against a real 38% and makes the tails the
longer half. A head that took most of the leaflet — the drawing until 28i —
is the classic textbook-icon error, and it also forced the molecules two and a
half times too far apart. The tips
stop `MID_SEAM` (0.15 r) short of the midplane: the leaflets meet, but the
terminal methyls are the wall's least ordered, lowest-density region and a
real bilayer's electron-density profile troughs exactly there — a faint seam,
never a crossing overlap and never a passable gap.

**When ions are too small to label**: a view drawing them below
`ION_LABEL_MIN_PX` (5 screen px body radius) shows a **key** — one specimen of
the species at readable size with its badge, in the header (`ui/IonKey`) —
rather than shrinking labels onto the stage. The stage keeps the honest scale;
the chrome carries the legend.

**The charge badge** (`drawIonCharge`): a filled disc in the ion's top-right
corner at 0.85 r, red for +, sky for −, white vector glyph inside. Its size is
`BADGE_FRACTION` 0.46 r, nudgeable by a view only between `BADGE_MIN` 0.34 r
and `BADGE_MAX` 0.6 r — and never smaller on screen than it is in the charge
bench (`BADGE_MIN_SCREEN_PX`, the user's reference size). The fractions are
the helper's; the screen floor belongs to the caller, which converts it with
`badgeMinR(scale)` because only the caller knows its own transform.

## The shared palette (canonical table)

| Ink | Meaning | Notes |
| --- | --- | --- |
| copper | protein machinery — pump | channels a cooler **bronze** |
| mint green | energy being spent (ATP) | reserved |
| gold / warm white | electrical activity; the AP's flash | gold is also Na⁺'s body colour — a depolarization *is* Na⁺ entering |
| violet | K⁺ body | |
| green | Cl⁻ body | |
| pink | Ca²⁺ body | |
| pale slate particles | chemical messengers | chemistry is discrete stuff; electricity is glow — never mix the grammars |
| red `#ef4444` | **charge +** and the threshold marker only | never an ion's body; on an ion it is a filled **± badge disc** in the top-right corner with a white glyph — the atomic charge playground's badge, ported (`drawIonCharge`, 28f) |
| sky `#0ea5e9` | **charge −**; also a switch's "on" | never an ion's body; same badge rule |
| the charge ramp | a **compartment's** polarity — the cytoplasm wash (`chargeRamp`/`polarityT`) | this, not a particle halo, is what "charge aura" means here |
| slate | membrane; highlighted membrane only slightly brighter (`#b8c4d4`) | white would swallow the signal drawn on top |
| amber | explanation, markers (the dashed ring) | thin dashed outline never reads as a glow |

Headlines: uppercase, letter-spaced, muted slate — no glow.

## Drawing-spec template

Every per-exhibit spec follows this shape (the worked example below shows it
filled in):

1. **Goal & home** — one line each; which view or drawer the picture belongs to.
2. **Reference** — where the input came from, if any.
3. **Composition** — what occupies which part of the frame, and the camera's
   relationship to the real anatomy (which way the structure actually lies;
   any `turn`).
4. **Layer order** — bottom to top.
5. **Object breakdown** — per object: shape, construction, and the *model value
   it reads* (an object on a live view reads from a run, never freelances).
6. **Proportions table** — drawn size beside **real size**, and the declared
   exaggeration where they disagree.
7. **Distribution rules** — how crowds are placed (seeded, count-independent —
   03 → the jittered-grid rule).
8. **Animation hooks** — what will move, which clock owns it, which legs.
9. **Honesty notes** — the info-block lines this picture obliges us to write.
10. **Reconciliation** — every deviation from the reference, each with its
    rule; conflicts already put to the user, with the ruling recorded.

## Spec: D01 — the lipid lab (implemented 2026-08-27)

1. **Goal & home.** What the membrane's wall is made of, and why it builds
   itself with no glue. A drawer off the membrane view, listed in the demo
   menu ("One molecule, up close").
2. **Reference.** None — house-grown.
3. **Composition** *(re-laid in the 26d round; viewport-measured at module
   load, so the drawer fills the screen)*. Describer column left (framing →
   right now → the molecule → keep in mind; the voice lives on the canvas
   labels, not in a list). Right: one button, then **row 1** — the atomic
   molecule and the vesicle tank side by side, given ~62% of the height —
   over **row 2**, the wall tank, shorter and full width. The wall spans its
   tank edge to edge at 58% height: the frame is a window on a wall that
   keeps going, never a floating plank with bare edges. Relation markers are
   dashed amber **rounded rectangles** joined by wide dashed lines — carried
   entirely inside the molecule panel (corner schematic ↔ the atomic view's
   frame; the wall's own marker was removed 26e as a competing second voice).
   Every canvas name carries a 🔊 glyph and speaks on tap (F04). The vesicle
   is drawn at the wall's own magnification — same bilayer, same scale, same
   ×N — floating small in a mostly-water panel, its rose lumen fading to
   nothing at the inner leaflet; wall lipids visibly jostle (26e).
4. **Layer order (tank).** Water tint → oily core (alpha follows how assembled
   the wall is — the hydrophobic middle only exists once tails hide together) →
   every lipid at its pose, the held one last → the dashed amber ring on the
   ringed lipid (wall phase only) → the ×N readout, screen-space, top right.
5. **Objects.** Every schematic molecule in the exhibit — the sixty-six in the
   wall tank, the thirty in the vesicle, the corner locator — is `drawLipid`
   from `stage/bilayer.ts`, the same call the benches' walls are made of,
   extracted for individual placement. The kink is the shared drawing's
   optional `kink` parameter (default 0, so every pre-existing caller is
   byte-identical); it resolves with magnification like all detail.
   **The molecule panel** *(rebuilt in the 26c round)* is a **space-filling
   atomic model**: every atom a glossy sphere in the house particle style,
   overlapping where bonds are — choline (N + three methyls + bridge),
   phosphate tetrahedron, glycerol, two ester links, two zigzag tails with
   the cis double bond as the kink, hydrogens peeking from behind. Element
   identity by **size and name**, never by hue-with-a-meaning: the *molecular
   inset palette* is a muted earth family of its own (C graphite `#6b7688`,
   H ivory `#ddd6c9`, O ochre `#c9a15a`, N olive `#93a06b`, P terracotta
   `#b4714f`), deliberately quieter than the ion balls and containing **no red
   and no blue** — those mean charge, and the real charges wear them (+ at
   choline, − at the phosphate). Five leader-line names: *choline, phosphate,
   glycerol, kink, fatty-acid tails*. The wall's schematic lipid sits in the
   panel's corner under an amber dashed ring with faint magnify-out lines —
   the locator grammar, one level further down. The molecule vibrates
   sub-pixel (seeded, clock-pure): alive, never boiling. Magnification derives
   from giving the real 0.154 nm C–C bond its drawn step.

### Reconciliation record — ball-and-stick handover (2026-08-27)

The user supplied a ball-and-stick phospholipid spec and invited a better idea
("not happy with ball-and-stick"). Ruled and recorded:

1. **Ball-and-stick → space-filling**, at the user's invitation: overlapping
   atom spheres, no rods — more natural, and no new "stick" element enters the
   language.
2. **CPK colours rejected** (O-red, N-blue collide with the reserved charge
   inks); the muted earth palette above replaces them. The atomic playground's
   own precedent is identity-by-size-and-symbol, not by hue.
3. "Avoid gradients / 3D" → **overridden by the standing 2026-08-27 ruling**
   (glossy house particle style everywhere); "no shadows" already is the rule.
4. SVG → canvas (house).
5. **Adopted from the handover**: the Y silhouette and section proportions,
   choline's four carbon branches with 3 H per methyl, the phosphate
   tetrahedron, the glycerol bridge, zigzag tails with hydrogens out,
   size-by-element ratios, tails ≈ half the height.
6. **Added beyond the handover**: the two ester C=O groups, the cis double
   bond drawn as the kink (tying the atoms to the schematic), the zwitterion's
   + and − in the charge inks, declared tail truncation (9/10 drawn of 16/18
   real), and the corner locator per the user's placement instruction.
6. **Proportions.** A phospholipid is ~2 nm across, the wall 5 nm thin. The
   tank draws at ×`WALL_MAG` and the molecule at ×`MOLECULE_MAG` relative to
   the scene at ×1 — both **derived in code** from the bilayer's px-per-nm and
   the scene's px-per-µm, interpolated by the describer, pinned by tests.
7. **Distribution.** Scatter is a seeded jittered grid (a seed-shifted
   bijection over a fixed 10×6 grid — no two lipids share a cell, same seed
   same throw). Wall slots spread edge to edge with flexing spacing, the same
   rule `drawLipids` uses — which is what lets the wall close over a missing
   molecule.
8. **Animation hooks.** Settle 6 s (staggered starts, sideways swim zero at
   both endpoints, tumble that dies on arrival); scatter 1.6 s; thermal jiggle
   a pure function of (clock, identity). One shared `travel()` choreography
   drives the wall AND the vesicle from one phase and one clock. Drag: the held
   lipid follows the pointer but **cannot cross the wall** (`clampHeldY` — the
   science agrees: heads cannot enter the oil, flip-flop takes hours); its
   leaflet re-spreads in 280 ms; release rejoins at the **nearest** slot in
   450 ms. Each transport's clock is stamped when it starts (`phaseStart`).
   Molecules are conserved in every phase; nothing teleports (pinned by a
   40 ms-step sweep test).
   **The vesicle** *(26b)*: 20 outer + 10 inner molecules on one
   membrane-middle ring, every head facing water; its lumen is a soft
   translucent rose wash — ruled through the conflict protocol, since
   saturated pink is Ca²⁺'s ball colour — and lumen + oily ring fade in with
   assembly, because an inside is something a closed membrane makes.
9. **Honesty notes** (in the drawer's "Keep in mind"): the settling is
   choreographed and hugely sped up; a flat patch this small would really curl
   into a closed bubble — which is what a vesicle and the cell itself are; a
   real membrane also carries cholesterol and proteins, not drawn here; the
   real sizes and both magnifications.
10. **Reconciliation.** No external reference; no conflicts.

## Spec: D02 — the permeability bench (implemented 2026-08-27)

1. **Goal & home.** What crosses a bare lipid wall and what decides (charge,
   not size). Drawer off the membrane view ("🫗 Membrane permeability").
   *Process note:* this spec was written alongside the build rather than
   strictly before it — recorded so the slip is visible, not repeated.
2. **Reference.** None; form and lever chosen with the user (live wall + log
   ladder; click-a-container "shoot" lever; toggleable aquaporin).
3. **Composition** *(re-laid in the 27a round)*. Describer left, in the house
   info container (bordered, rounded, scrolling inside its own frame — the
   BenchInfoPanel/atomic grammar, now the rule for all drawer describers).
   Right: a loud amber **↺ Reset**, then the tank alone at full width
   (viewport-fitted, ×2 — the lab's bilayer magnification, declared). The
   **log ladder panel was removed** at the user's request; its coefficients
   moved into "Keep in mind" as printed readings, and the crossed counts
   collect at the tank's foot. The **aquaporin's control is a chip ON the
   wall** it changes, just above the bilayer.
4. **Layer order (tank).** Water tint → beakers with a sample of their own
   substance drawn inside → the wall (`drawLipids`, parted for the aquaporin)
   → the aquaporin (`drawGatedChannel`, narrow, fixed part-open: it has no
   gate) → every mote → screen-space chrome (×N, the aquaporin's name, the
   speakable container names).
5. **Objects.** Travellers drawn as themselves from the molecular inset
   palette: O₂ two ochre spheres, CO₂ ochre–graphite–ochre, water ochre+two
   ivory, glucose a lumpy carbon ring dressed in oxygens (big, and it reads
   big), Na⁺ the app's glossy gold ion wearing its red + — and *(27a)* its
   **water coat**: five faint clinging waters, the visual answer to "why can't
   ions pass" (water clings to charge and cannot be taken off; coat and all,
   the ion is dressed for water, never for oil). One shared `glossySphere`
   does all the shading. *(27a)* A crossing traveller **squeezes**: it narrows
   mid-oil while the wall visibly bows around it — the oil has no holes, only
   jostling tails that can be pushed apart for a moment.
6. **Proportions.** The wall is the bilayer module at ×2 — the same drawn
   magnification as the lipid lab, stated in the corner. Motes are drawn at
   legible symbol size, not to scale with the wall; the ladder's coefficients
   are the quantitative truth.
7. **Distribution.** A squirt is 12 motes fanned from the container mouth,
   deterministic per mote id; thermal kicks are hashes of (id, epoch), so a
   run replays.
8. **Animation hooks.** Motes are conserved — they bounce, cross, and
   accumulate until ↺ Reset (the tank refuses new squirts when full and says
   so). Each wall-knock rolls that knock's own die at the species' odds; a
   crossing is a slow straight soak through the oil, never a teleport.
9. **Honesty notes.** The tank's odds are DECLARED compressed: it shows the
   order (gases ≫ water ≫ sugar/ions ≈ never), the ladder shows the truth —
   order-of-magnitude coefficients printed per rung, every rung ×10, the
   water-vs-sodium ratio derived from the table (~30 billion) and interpolated
   into the describer. Aquaporin boosts water ~×10 and nothing else. No photo
   block: a bench of pure lipid patches is the "nothing to photograph"
   exception, recorded per the real-photo rule.
10. **Reconciliation.** n/a (no external reference).

## Spec: D12 — the membrane charge bench (implemented 2026-08-28)

1. **Goal & home.** How few ions make the voltage, and why voltage lags.
   Drawer off the membrane view ("🧲 Membrane charge").
2. **Reference.** None; form chosen by me under "implement as you see fit".
3. **Composition.** Info block left (sibling photo block absent — nothing to
   photograph). Right: the dial row (🔋 slider, live reading with a "catching
   up…" flag, amber ↺ Back to rest), then the patch canvas with the counter
   panel beside it.
4. **Layer order.** Compartment tints (lightness only — hue is spoken for) →
   the potassium crowd → the bilayer → the ± skin on both faces → screen-space
   chrome (×N, compartment names, speakable labels). *(28a)* The patch canvas
   sizes itself with the counter panel's width already subtracted, and the
   grid carries `overflow-hidden` + `min-w-0`: a drawer must never scroll
   sideways.
5. **Objects.** The crowd is the app's glossy violet K⁺ (3.4 px, each wearing
   the shared **± charge badge** — 28c), over a cytoplasm that wears the
   polarity wash, jittered
   grid, jostling — and *(28a)* **leaning** with the dial: a monotone,
   endpoint-preserving warp, so the count never changes, nobody overtakes
   anybody, and no ion can enter the wall. The skin is the charge marks in the
   charge inks (red +, sky −), minus inside when negative, flipping together
   across zero — the same grammar as the membrane view and the balance bench.
   *(28b)* **There is no counter panel.** Two rounds of abstract bars failed a
   child; the numbers are now readings ON the picture beside what they count,
   the two faces are named where their marks are, and the ratio is a sentence
   in the column with an everyday crowd chosen by size ("one person in a
   packed football stadium"). Rule distilled: when an abstract instrument
   cannot be read, the honest move is to put its readings back on the thing
   itself and give the column the meaning.
6. **Proportions.** Bilayer at ×2 like every bench, declared. The counter's
   bars are honestly to scale (1/63,000), floored at one pixel.
7. **Distribution.** Crowd: fixed 30-column jittered grid, count-independent,
   clock-pure. Marks: evenly spread along each face, count from the voltage.
8. **Animation hooks.** The membrane voltage chases the dial with the app's
   own 320 ms constant; the crowd jostles and never responds to voltage (no
   voltage argument exists in its function).
9. **Honesty notes.** Where the numbers come from (20 µm soma, 5 nm wall,
   1 µF/cm² → 12.6 pF, and the grown-up names); one mark ≈ a crowd of charges,
   printed live; potassium-only count makes the true ratio larger; the
   settling time shows the delay exists, not its exact length; *(28a)* the
   crowd's lean is hugely exaggerated — the direction is the honest part, and
   the count is identical at every setting.
10. **Reconciliation.** n/a.

## Spec: D03 — the ion channel, opened up (implemented 2026-08-28)

1. **Goal & home.** What a channel is built out of, and how a hole can be
   pickier than a sieve. Drawer off the membrane view ("🚪 Ion channel
   structure"). The channel anatomised is the **voltage-gated potassium
   channel** — the one that carries both of the spec's stories (the S4 sensor
   and the selectivity filter) in a single object.
2. **Reference.** The measured KcsA/Kv structure; every number from
   `core/channelStructure.ts` or the app's own ion table.
3. **Composition.** Info block left. Right: a row of "send an ion" buttons
   (each an `IonKey`, so the ion you send is the ion you see), then the SIDE
   view — wide — beside the TOP view, both drawn to the membrane's own ruler
   at ×4.
4. **Layer order (side).** Compartment tints → the bilayer, parted where the
   protein sits → the teepee of coiled ribbon helices → the pore's water →
   the filter's own atoms → the ion being tried with its water shell →
   screen-space charge badges → the schematic gate's amber corner box and its
   dashed connectors → names on the background with leaders.

   *(29c)* **Two registers at once, in the lipid lab's layout** (the user's
   instruction): the REALISTIC structure fills the panel and the SCHEMATIC
   gate — the bronze door the rest of the app draws — sits in the small amber
   box, joined by wide dashed lines. References supplied: the MPINAT KcsA
   figure (ribbon teepee, stick filter, stacked K⁺, a blocked Na⁺ with its
   water shell) and RCSB PDB-101 MotM 38 (labels out on the black background
   with leaders; the pore seen down the axis as a pinwheel of helices). The
   top view sets that pinwheel in a FIELD OF LIPID HEADS — it is a view of the
   membrane, not of a protein floating in nothing.
   **Departure from both references, ruled by the user:** their atoms are CPK
   (red O, blue N). Ours keep the molecular earth palette, because red and sky
   mean charge here and nothing else.
5. **Objects.** Subunits are one closed path per side, narrowing to the filter
   and flaring into the cavity, drawn in the protein bronze tinted toward
   potassium's violet. The filter's oxygens are ochre dots facing into the
   pore, four stacked sites. The S4 charges are the same red ± marks the
   schematic channel wears everywhere else — here on the helix that actually
   carries them. The tried ion is the app's glossy ion with its badge, inside
   a blue **water coat** drawn at its real hydrated diameter.
6. **Proportions.** Filter 0.3 nm across a 5 nm wall; the ion coats at their
   real hydrated diameters — which is why a coat visibly cannot fit the gap.
7. **Distribution.** n/a (one object).
8. **Animation hooks.** One attempt, 3.2 s, pure in (state, clock): both ions
   set off identically (the difference must be earned, not given away),
   potassium sheds its coat at the filter and files through, sodium presses,
   keeps its coat and is turned back. Nothing teleports (pinned).
9. **Honesty notes.** The subunits are drawn smooth and a real one is a folded
   tangle; sizes are to scale against the membrane; the trip is slowed
   enormously (a real channel passes millions a second); and we know the shape
   because these channels have been crystallised.
10. **Reconciliation.** n/a.

## Worked example — vesicular release figure (input of 2026-08-27)

**Goal.** A cross-section of a chemical synapse: presynaptic terminal above,
cleft, postsynaptic dendrite below; one fused vesicle releasing; transmitter in
the cleft; a receptor row; a subset of transmitter particles carrying a tracer
dot.

**Home.** Candidate methods figure for journey leg 3 / S14 (see Reconciliation
#6 — the tracer is the point); the composition also informs the step-20 synapse
scene, which draws the kept models under the same language.

**Composition** (kept from the reference): landscape ~3:2 (900×600).
Presynaptic terminal ~42% of height with a gently curved upper edge fading out
at the frame (no invented far surface), cleft ~6%, postsynaptic ~42%. Fused
vesicle at horizontal centre. 8–12 free vesicles in the terminal; 35–50
transmitter particles, densest at the release site; receptors evenly spaced
beneath it, spacing jittered.

**Layer order:** presynaptic body → postsynaptic body → free vesicles → active
zone: **Ca²⁺ channels interleaved with docked vesicles (added — Reconciliation
#5)** → fused vesicle → transmitter particles → receptors → leader-line name
labels.

**Objects, in the house language:**

- **Membranes:** two leaflets from the scene's own bilayer code, walls
  wandering with different phases — never two parallel curves. Both membranes
  drawn from the same module.
- **Vesicles:** bilayer rings (not hollow circles), Ø ~28–36 px, seeded
  non-overlapping placement. The fused one opens downward, its leaflets
  continuous with the membrane's — the same-material point made visible.
- **Transmitter particles:** glossy pale slate, Ø 4–6 px, never connected by
  lines. **Tracer variant** (5–8 of them): same particle with a tiny solid
  centre dot — the only distinction, as the reference specifies.
- **Receptors:** the scene's receptor drawing (stem, binding head into the
  cleft, intracellular legs), spacing slightly uneven.
- **Ca²⁺ channels:** bronze, in the active-zone membrane beside the docked
  vesicles.
- **Labels:** thin straight leader lines carrying names only, no arrows;
  targets per the reference (vesicle, presynaptic membrane, transmitter,
  cleft, receptor, postsynaptic membrane).

**Proportions note.** At the reference's numbers the vesicle (~32 px) ≈ the
cleft (~36 px); in reality a 40 nm vesicle is *twice* the ~20 nm cleft. Either
drawing carries the declaration (`synapseScaleNote` pattern).

**Animation hooks** (if animated): fusion may be watched; the crossing may not
be — transmitter appears *already spread through the cleft* and thins out
(03 → step 19's rule; the crossing is ~4,400× faster than the release delay).
Particles originate only from the fused vesicle and are conserved.

### Reconciliation

Conflicts #1–#4 were put to the user on 2026-08-27; **ruling: the established
language wins on all points.**

1. "Avoid random membrane roughness / prefer even spacing, textbook geometry"
   → **overridden**: seeded unevenness everywhere (*Alive, not drafted*; the
   user's own standing instruction).
2. "Avoid gradients" → **overridden**: glossy particle style and lipid
   gradients are the house style. ("Avoid shadows / 3D effects" is kept — it
   already is the rule.)
3. "Membrane as two closely spaced parallel curves" → **overridden**: a
   membrane is a liquid; both walls from the bilayer module, wandering.
4. "Clean hollow-circle vesicles" → **overridden**: a vesicle is a bilayer
   ring (step 19b: "vesicles are circles" was a reported fault; the material
   is the point).
5. **⚠ Science: the reference has no Ca²⁺ channels.** Voltage-gated Ca²⁺
   channels cluster in the active zone, in the very membrane the vesicles dock
   on — their absence beside a fusing vesicle repeats the step-19b error.
   Added, interleaved with the docked vesicles.
6. **The tracer dots are adopted as content**: radiolabeled transmitter is
   *how reuptake was discovered* — this figure is the natural "how we know"
   companion for journey leg 3 / S14, sibling of D13 (patch clamp).
7. "Particles spread downward, dispersing with distance" is kept as a *static
   density gradient* only; any motion follows the appear-already-spread rule.
8. "Distributed randomly" → seeded, count-independent placement (jittered
   grid), so nothing twitches on a change.
9. Kept from the reference without conflict: the overall composition and
   proportions, layer order, fused-vesicle-at-centre, non-overlap, the
   tracer's minimal marking, leader lines with names and no arrows.


## D15 — inside the selectivity filter

**One ruler for both lanes.** The exhibit IS the comparison, so anything drawn
differently between the lanes must be a real difference. Same rung spacing,
same oxygen radius, same ion scale (`FZ_PX_PER_NM`), same clock.

**The lanes are separated, not divided.** A hairline at 14% opacity down the
middle: two pictures, one subject. A border or a panel each would say they are
two exhibits.

**Carbonyl, drawn as a carbonyl.** Every rung is a carbon on the wall and its
oxygen pointing inward, in the app's molecular palette (never CPK — red and
sky mean charge here). The oxygens are what reaches, and reaching is drawn as
motion plus a warm glow, so the exchange is legible without a caption.

**The ledger is a reading on a scale, so it may live on the canvas.** Two bars
a lane, cost in red and payback in green, at TRUE proportion against the
larger cost. The shortfall is marked where it happens — the piece of the red
bar the green one does not reach — with the number beside it. No axis, no
legend: the bar's own labels sit above it.

**Nothing vanishes, here either.** Shed waters fall back down the lane and
fade with distance; sodium re-dresses on the way down. The rule the pump's
ions follow.


## D13 — the patch clamp

**The apparatus is quiet.** A glass taper in pale blue at low opacity, the
salt water inside it fainter still. It is what makes the recording possible,
not the thing being looked at — so it never competes with the trace.

**The patch is the app's own membrane.** Same lipids, same gate, same
potassium tint as every other channel drawing. The child has taken this
channel apart atom by atom in D03 and D15; here they watch one of THOSE work.

**The record is drawn from the model's dwell list, not from samples.** A step
edge lands exactly where the model says the channel changed state, so the
picture cannot round a flicker away.

**Two levels, named where they are.** "open" and "shut" as readings beside the
trace's own two heights — not a legend, not a sentence.

**The total sits UNDER the lanes it is a total of**, sharing their left edge,
so adding-up reads downward. Its ceiling comes from the model (mean plus a few
standard deviations), so the line has room to wobble without the scale jumping
between voltages.
