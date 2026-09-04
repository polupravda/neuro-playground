# Neurobiology Playground — working notes for Claude

Sibling app of `../atomic-playground`. Before larger changes, read that repo's
`docs/how-things-work/` (especially `03-architecture.md` for the visual language
and `05-handover.md` for the methodology).

**The four documents here, and what each is for:**

| | |
| --- | --- |
| `docs/01-feature-spec.md` | the requirements. Feature IDs (N01…, S01…, C01…). Not rewritten by implementation. |
| `docs/03-architecture.md` | **the rules and patterns every step must respect**, with the reasoning and the bug each one came from. Read the relevant section before building. |
| `docs/04-roadmap.md` | the plan, step by step, plus the full record of what each step actually did and what was corrected. |
| `docs/05-visual-language.md` | one visual language at every level of detail, the palette, and per-exhibit **drawing specs**. Incoming illustration handovers are reconciled here — with a written Reconciliation section — before anything is drawn. |

## Working agreement

- **One roadmap step at a time.** The user manually tests in the browser after
  each step; **only the user flips statuses to `done`.**
- **Every feature ends with a hand-over for that testing.** Finish the reply with
  two short things, and nothing between them and the end:
  1. **What was built** — a few lines, in plain terms. What is now on screen that
     was not before, and what it is for.
  2. **How to check it** — numbered steps the user can follow without knowing the
     code: where to click, what to press, in what order — **and what they should
     see at each step.** Say the expected result, not just the action; "press ⚡
     and the far end lights about a second later" is a test, "press ⚡" is not.

  Include what should NOT happen where a bug was just fixed, and name anything
  only a person can judge (timing, whether a shape reads, whether a colour
  carries). Passing unit tests are never a substitute: they check the model, and
  most of what goes wrong here is in the picture. If a step lands with nothing
  visible yet — a model without its view — say so plainly under **What was built**
  and give no steps rather than inventing some.
- **Every message becomes a numbered ACTION LIST first** (2026-08-30). Before
  building anything, restate the user's message as numbered action points —
  `A1`, `A2`, … — so the user can see what is about to be built and correct the
  reading before the work happens. One point per thing asked for; never merge
  two asks into one point, and never silently drop one. If a point is refused,
  deferred, or turns out to be already done, it still appears in the list with
  that outcome against it.
  - **Tests cite the point they guard.** A test written for `A2` says so in its
    name or its comment, so a green suite can be read against the list.
  - **The hand-over is checked against the list**, point by point — which is
    what makes "did you actually do it?" answerable without re-reading the diff.
- **Report what you plan to implement next**, at the end of every turn.
- **When an input contradicts an established rule or an earlier decision of the
  user, stop and ask — do not guess.** Quote both sides prominently and put the
  conflict to the user as explicit questions before writing docs or code. Never
  resolve it silently, and never invent a new category that lets both sides be
  true. (Ruled 2026-08-27, after a "schematic register" was invented to
  accommodate a conflicting illustration handover.)
- **Open every implementation step and every corrections round with alignment
  questions** (AskUserQuestion) wherever the scope leaves real choices — scope,
  naming, interaction patterns that set precedents. Early alignment costs less
  than corrections. "Implement as you see fit, I'll verify and correct" is a
  standing valid answer and ends the questioning for that item. (2026-08-27)
- **Words have audiences** (see 03-architecture → *Where words go → Who reads
  what*): icons and pictures for the kid, button names for the adult, the info
  block written to be read aloud.
- **User shorthands** (2026-08-27): **"tests pass"** = flip every
  `awaiting manual test` status to `done`, except items the same message
  explicitly corrects. **"add voice to term A"** = give term A an F04 speaker
  button wherever it is taught. **"implement as you see fit, I'll verify and
  correct"** = stop asking about that item and build.
- After a round of corrections, fold the important ones back into
  `03-architecture.md` as rules. A correction that stays in a chat is a
  correction that gets made again.

## The rules, in short

Each links to the section in `docs/03-architecture.md` that gives the reasoning
and the bug it came from. **Read that section before working in the area.**

### Words

- **The canvas carries no explanation.** On the canvas: *names* and *readings on a
  scale*. Everything else is in the info block. → *Where words go*
- **A button carries a label and/or an icon, and nothing else** — plus, at most, a
  one- or two-word state reading on the thing it controls. No sentence inside an
  active element; put it in `title=` and under the button or in the info block.
  But a button with no name is the same failure: icons rank, they do not name.
  → *Where words go*
- **If the canvas already says it, the column must not repeat it.** → *Where words go*

### Navigation and the camera

- **Spatial navigation, not pages.** Other views are reached by zooming into a
  place on the neuron, so they never feel like separate apps.
- **The scene is the world; a drawer is thinking about the world.** An exhibit
  that is not a place on the cell opens over the scene and leaves it untouched.
- **Gate a view of its own on arrival, in decades, from either side**, and give
  the scene's opacity the *same* gated number. → *Handing the scene over…*
- **Pan while wide** — first portion diving in, last portion pulling out.
  → *Handing the scene over…*
- **Level of detail dissolves, never switches**, and the two representations are
  never both on screen. → *Level of detail must dissolve…*
- **Level of detail cuts both ways**: draw less than the app owns when the
  molecules would be smaller than a pixel. → *Level of detail cuts BOTH ways*
- **A drawer knows which view it extends** (`home`), and only that view's chrome
  advertises it. → *Where a concept lives*
- **Two shapes on one Konva layer must not `clearRect` the canvas.**
  → *Handing the scene over…*

### The miniature

- **One dashed ring, on the zoom target's own centre.** A marker's job is to say
  what is on screen. → *The whole-cell miniature*
- **A drawer rebuilding the app's furniture is evidence it should be a place.**
  → *The scene is the world…* / *Where a concept lives*
- **Two doors at one place need two icons, not one menu**, spaced by a marker's
  own diameter. → *Two doors at one place…*
- **A view about distance carries the axon views' ruler.** A correct marker on an
  unlabelled axis is still unreadable. → *A view about distance carries…*
- **The axon lights patch by patch in every view.** An axon lighting as a unit is
  the misconception the milestone exists to dismantle. → *The whole-cell miniature*

### Pacing

- **A run's clock follows the interest, not the model's even time.** Split the
  window into legs and give the payload most of the screen time. **Slow the leg,
  never the item.** Check it by walking the clock in a test. → *A run's clock
  follows the interest…*
- **When the payload is a few per cent of the run, the clock is the bug** —
  measure it before reaching for a slower animation. → *When the payload is 5%…*
- **Every transport that can reach an end needs a control that says start over.**
  → *A run's clock follows the interest…*

### Clocks and state

- **Per-frame values live in refs/Konva nodes**; only semantically meaningful
  values (counts, modes, selection) go through Zustand.
- **A clock belongs to the event it is timing, not to whatever is re-rendering.**
  → *Clocks belong to events…*
- **A miniature must not inherit a demo's pacing.** → *Clocks belong to events…*

### The model

- **Integrate once into a table indexed by position; then be a pure function of
  it.** → *Model patterns*
- **Seed randomness; never call `Math.random`.** → *Model patterns*
- **Carry fractional time, and clamp the frame at the caller.** → *Model patterns*

### Drawing a scene

- **A layout is solved from a budget, not chosen** — and what a request reached
  is measured and reported, never asserted. → *A layout is SOLVED from a budget*
- **Size a part off the structure it belongs to, not off the canvas.**
  → *A layout is SOLVED from a budget*
- **Where the outside is, say so with the same ink.** → *Where the outside is…*
- **Put things ON the shape, not on a line through it** — flatten the traced
  path and ask it. → *Put things ON the shape…*
- **Plan the anatomy before the picture.** For every structure ask: is it where it
  really is, made of what it is really made of, seen from a plausible direction?
  → *Drawing a scene: plan the anatomy…*
- **Never invent a surface that is off the page** — fade the cell out at the edge.
- **Machinery that works together is drawn together.** If a model couples two parts
  by proximity, the drawing must show them as neighbours.
- **Draw what a thing is made of when that is the point.**
- **Orient the camera to the structure** (`turn` on the zoom target).
- **A membrane is a liquid, not a ruled line.**
- **Make the model's hidden states visible**, allocated by threshold not rounding.

### Fades

- **Composite the layer, not its contents** — canvas `globalAlpha` is set, not
  multiplied, so a drawing that assigns its own wipes a caller's fade.
  → *A fade must be a property of the surface…*
- **Inside a drawing, `globalAlpha` is multiplied, never assigned.** Check it
  with `strictCanvas().alphas`. → *A fade must be a property of the surface…*

### Testing the drawing

- **Ask the DECISION, not the ink.** Make the choice a named exported function
  and test that; counting marks on a canvas measures whatever else was drawn.
  → *Ask the DECISION, not the ink*
- **A guard you have not broken is a guess.**
- **A test stand-in must fail where the real thing fails.** Use `strictCanvas()`,
  which rejects unparseable colours and non-finite numbers. → *A test stand-in must
  fail where the real thing fails*
- **Silent NaN is the fault, not the throw** — pin "never returns NaN" with a test.
- **After writing a regression test, break the code again and watch it fail.**
- **Never keep two private copies of a helper** — a second copy of a fixed bug is a
  bug that comes back.

### Honesty

- Curate scientifically valid scenarios; never fake a general simulation. **The
  user wants scientific pushback when an idea is physically wrong.**
- **Measure, never assert** — and keep the disagreement, because it is usually the
  mechanism. → *Scientific honesty rules*
- **A result that does not change when the input changes is a broken parameter.**
  → *Scientific honesty rules*
- **Use the right constitutive law, not the familiar one.** → *Scientific honesty rules*
- **Say which numbers are calibrated, and which are not drawn.**
  → *Scientific honesty rules*
- **Declare every exaggeration beside the real number.** → *Scientific honesty rules*
- **Never quietly protect the story.** → *Scientific honesty rules*
- **A claim about what the app contains rots.** Keep it in exactly ONE place —
  `FRONTIER` in `core/neuron.ts` — and have every describer interpolate it.
  → *Scientific honesty rules*

### When something is judged unreadable

- **A right model can still be an unreadable view. Rebuild the view; do not defend
  it with the model behind it.** → *When a view is judged unreadable*

## Hard-won technical rules (from the atomic playground)

- **react-konva:** freeze position props at mount and move nodes imperatively —
  changed x/y props re-apply at commit and cause teleports.
- Glossy particles: one extended radial gradient, NO canvas shadows
  (`src/stage/particleStyle.ts`).
- Stage sizes are viewport-measured once at module load (`src/stage/layout.ts`).

## Environment quirks (cost hours — don't relearn)

- Use `/usr/bin/grep`, `/usr/bin/sed` etc. — PATH wrappers truncate output.
  There is no `/usr/bin/cat` (use the Read tool).
- zsh doesn't word-split — write loops in bash script files.
- Python urllib SSL is broken — use curl.
- `vitest` output is filtered by a proxy; to read measurements out of a probe
  test, `throw` them in an `Error` message and grep the failure.
