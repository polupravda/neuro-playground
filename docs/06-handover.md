# Hand-over — where S13 stands, and what comes next

Written 2026-09-13, at the end of the session that built **S13, the dendritic
spine**. Read this with `CLAUDE.md`; it does not repeat the working agreement.

⚠ **Updated after 21c-70 and 21c-71.** 21c-70 re-paced the spine's model against
the picture's own clock and split the head's reading across hue and strength.
21c-71 replaced the tapping interaction with a **six-act story** that plays the
whole lesson in one run — which closed section 3's sharpest open item, the burst
that drew a single release. Both are in `04-roadmap.md`.

---

## 1. The very first thing

**Nothing in this session has been manually tested, and nothing is committed.**

- `docs/04-roadmap.md` has **122** entries marked `awaiting manual test`, of which
  steps **21c-47 … 21c-76** are this session's.
- 46 files are modified or untracked in git.
- The suite is **1550 tests green**, `tsc` silent, `npm run build` clean.

Only the user flips a status to `done` (their shorthand: *"tests pass"*). So the
new chat's first job is to hand them the check-list for whatever they ask about
next — **not** to assume any of this is settled.

---

## 2. What S13 is now

A view of its own (`zoom === 'spine'`, its own layer, its own door from the
synapse). It is a **camera on the round trip's drawing**, not a second drawing:
`stage/spineScene.ts` computes a transform and calls `drawSynapse`, and a
`spine` flag on `SynapseView` adds this view's machinery and removes the
terminal's.

The chain it teaches, in the order it plays:

1. a vesicle merges (the view's clock opens at the release — 2.56 ms — and ends
   at 30 ms, before the astrocyte loop it does not draw);
2. glutamate crosses and binds **the receptors that are actually drawn**;
3. AMPA opens, sodium crosses the wall at **14.6 model ms**, and the head reddens
   **at that moment**;
4. that depolarisation eases the magnesium block — which **lifts, and never
   opens**: 96% blocked at rest, 57% at the very best one synapse can reach;
5. NMDA, holding its glutamate and now partly unblocked, **lights** and passes a
   trickle — sodium, and calcium that travels to calmodulin;
6. calcium → calmodulin → CaMKII, latching;
7. two carriers rise from deep in the head, **merge into the wall** (the receptor
   turning from lumen-facing to outward-facing as the bubble opens), and the
   receptors slide into the density;
8. the same single message is then visibly redder and faster with three
   catchers than with one.

**The controls**: one timeline (this view's own clock and its own event dots) and
**one button** — ▶ Play, which sends a message on every press and starts the run
when nothing is running. There is deliberately no pause; the scrubber is the
pause, because a pause on that button costs the burst and the burst is the
exhibit.

---

## 3. Open items on S13 itself

In the order I would take them.

### 3a. ⚠ A burst is eight messages and one drawn release

The sharpest remaining inconsistency, and it is mine, not the user's.

The drawn release is the round trip's, clipped to 15.2 s. The model's burst is
eight taps over a few seconds. Pressing again does **not** restart the drawing
(deliberately — it would never reach the sodium), so eight messages are answered
by one drawn release's worth of transmitter and sodium.

The model is right and the picture under-counts. Options, none costed yet:

- make the cast per-pulse, so several packets share the gap (truest, largest);
- draw a second and third cloud on later taps only;
- or declare it in the info block and leave it — "one drawn release stands for
  the burst", which is the app's own *when one drawn thing stands for MANY* rule.

Put the arithmetic to the user before choosing.

### 3b. Calmodulin's seats fill from a NUMBER while ions arrive at it

`drawCalmodulin(… ca: camDrive(sp.ca))` fills the four seats from the
concentration, and the drawn calcium ions travel to calmodulin and vanish into
it. Two drawings of one fraction in one frame — exactly what *one number, one
picture* forbids. Make the arriving ions the decision and have the fill ask
them, or say plainly why not.

### 3c. The cascade's phosphatase push-back is invisible

Under slow tapping CaMKII should visibly **start to climb and slide back** — that
is the 🐢 lesson, and the reason brief weak activity leaves no trace. At the
moment slow tapping simply shows nothing, which teaches "not enough" rather than
"actively undone".

### 3d. Smaller

- The spine's **honesty notes** (`SPINE_PARTS`, `SPINE_HONESTY` in
  `core/spine.ts`) have grown to eleven. They have not been read end to end for
  length or for a child's ear since several were added. Worth one pass.
- `SPINE_PARTS`'s 🪨 note says "tap 8 times fast"; the measured figure is **7 at
  ≤300 ms**, and it is arithmetic in a template string rather than a number from
  the model.
- `spineTint` (the round trip's ion-paced tint) is still used by the round trip
  only. Fine, but check it when touching either.

---

## 4. What to build next, if the user asks

The natural follow-on is **D08, the receptor kinetics bench** — AMPA vs NMDA time
courses side by side, and a coincidence-detection demo (transmitter alone,
depolarisation alone, both together). Everything it needs now exists: D07's
shared `mgBlock`/`stoneSeated`, the spine's `nmdaLive`, and the measured
ceiling. Its guardrail is already in the spec: **repeated stimulation does not
create new NMDA receptors** — NMDA supplies the trigger, AMPA is the expression.

Also unbuilt and specified: **D09** (glutamate vs GABA), **D10** (benzodiazepine
bench), **D11** (synapse gallery), **D14** (membrane constructor), **P05** (LTD —
the same messenger as LTP, opposite outcome, and the spine's `PHOSPHATASE`
already models the arm it turns on).

Offered long ago and never done: an **astrocyte nucleus** (21b-1m, A2).

---

## 5. What this session kept teaching, in one place

Eight of the rules in `docs/03-architecture.md` were written in the last two
days, and six of them are the same fault wearing different clothes. A new
session will save hours by reading these before touching S13:

> *Reusing a picture means inheriting its CLOCK* · *A drawing whose CLOCK never
> ticks is a still* · *A cast is keyed to a CAST LIST* · *Two models of one event
> need their clocks put beside each other* · *A transport moves the PICTURE; make
> it move the model too* · *An inherited default is not a decision*

**The pattern**: S13 borrows the round trip's drawing, and every time it borrowed
something invisible with it — a clock, a row of receptors, a release schedule, a
gradient's geometry — the result was individually-correct code that drew
nonsense. When adding anything to this view, ask what schedule, what list and
what geometry came along unasked.

**And the guard pattern.** Six guards this session were green on a real bug:

- one asked `bindPulses` while the SCENE went on passing the old flag;
- one asked `neckClimbPath` while `neckSeats` stopped calling it;
- one asked the model's stone while the DRAWING multiplied it away;
- one compared a colour walk to its own endpoints (circular);
- one matched a colour the app uses elsewhere (`#7dd3fc` is the sky);
- one was a `toContain` on a branch the break left intact.

Every one of them was found by **breaking the code and watching**. Do not skip
that step in this view.

---

## 6. Practical notes

- **The test timeout is 20 s** (`vite.config.ts`), raised from 5. Nothing here is
  async; the render walks genuinely take 6–7 s under full parallel load, and two
  of them were failing intermittently on the default.
- Measurements go through a probe test that writes JSON to the scratchpad — the
  vitest output is filtered by a proxy. See `CLAUDE.md` → *Environment quirks*.
- `spineNaLagMs` **bisects**; do not turn it back into a sweep. A 240-step sweep
  is a quarter of a model millisecond at the moment that matters, and that is
  larger than the error the user could see.
