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
| `docs/06-handover.md` | **where the current work stands and what comes next** — read this first in a new session. |
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
- **When a request needs a molecule drawn, change the COUNT, not the molecule.**
  If an exhibit must show what a thing is made of, its size is no longer free:
  solve it from the molecule up, put the cost (fewer of them) to the user, and
  declare what exaggeration is left. → *When a request needs a molecule drawn…*
- **A drawer knows which view it extends** (`home`), and only that view's chrome
  advertises it. → *Where a concept lives*
- **Two shapes on one Konva layer must not `clearRect` the canvas.**
  → *Handing the scene over…*

### The miniature

- **One dashed ring, on the zoom target's own centre.** A marker's job is to say
  what is on screen. → *The whole-cell miniature*
- **A drawer must be able to say what it does that the view CANNOT** — a fork, a
  comparison, a register out of reach. "The same thing, closer" is not a drawer;
  the view already has a camera. → *A drawer must be able to say what it does…*
- **A drawer rebuilding the app's furniture is evidence it should be a place.**
  → *The scene is the world…* / *Where a concept lives*
- **Two doors at one place need two icons, not one menu**, spaced by a marker's
  own diameter. → *Two doors at one place…*
- **A view about distance carries the axon views' ruler.** A correct marker on an
  unlabelled axis is still unreadable. → *A view about distance carries…*
- **The axon lights patch by patch in every view.** An axon lighting as a unit is
  the misconception the milestone exists to dismantle. → *The whole-cell miniature*

### Pacing

- **True geometry can still read as a fault — and the register decides.** Ask
  not "is it right?" but "is the thing it is right about THIS view's subject?";
  and a drawing that stops conserving must stop drawing the conserved thing —
  a gap-hunting guard cannot see ink drawn twice, so COUNT it.
  → *True geometry can still read as a fault*
- **Ink drawn UNDER something must go when that something does** — ink meant to
  be seen through a layer is meaningless without it; tie them so they leave and
  return together, and fix it at the MEANING.
  → *Ink drawn UNDER something must go…*
- **An object travels; a CONCENTRATION fades** — could you point at where it
  came from? If yes, draw the journey; if it is "from all around, a molecule at
  a time", the amount going up IS the event. → *An object travels; a
  CONCENTRATION fades*
- **When the user IS the variable, a second panel is answering nothing** — if
  the difference between A and B is a stimulus the viewer generates themselves,
  they cannot see it; use one subject and let their behaviour be the variable,
  with a refractory that belongs to the subject. → *When the user IS the
  variable…*
- **When the user IS the variable and they do nothing, the exhibit teaches
  nothing** — drive it at the "does the least" extreme; and **an interaction the
  picture cannot DRAW teaches nothing even when performed** (if the child does it
  five times, does the picture show five?). Let the run be the experiment and the
  hand be an amplifier; then the failing case can be drawn, not just claimed.
  A scripted run needs LEGS like any other. **A schedule is exact but the firing
  is QUANTISED** — clear a gate by more than a slow frame, and **count what was
  TAKEN, not what was sent**, because a refused call is silent. Chapters land on
  measured moments. And **changing an interaction is a documentation change.**
  → *When the user IS the variable and they do nothing*
- **A comparison must survive the child** — an input should TRIGGER a behaviour,
  not inject one, or the user's wrist becomes the dominant variable; drive it at
  both extremes before shipping. → *A comparison must survive the child*
- **An unguarded change is a change that may not have happened** — every action
  point needs an assertion that fails if it was not done.
  → *An unguarded change is a change…*
- **When one drawn thing stands for MANY, the rules change with it** —
  probabilities become fractions, and say what one drawn thing means.
  → *When one drawn thing stands for MANY…*
- **Some requests cannot both be met — do the arithmetic and say so**, quoting
  the simulation and the concrete alternatives with their costs; ask for the
  user's decision RULE, not just their answer. → *Some requests cannot both…*
- **A threshold's job is to reject the NEAR MISS** — a total failure is exactly
  zero, so "above zero" tests nothing; pin the line between the largest input
  that must say no and the smallest that must say yes.
  → *A threshold's job is to reject the NEAR MISS*
- **A failure must be DRAWN, or the exhibit teaches the opposite** — absence is
  not a mark; draw the consequence (the far side lighting, or not) rather than
  the mechanism's absence. Check the reading is not saturated, and that an
  answer follows its cause closely enough to be recognised as one.
  → *A failure must be drawn…*
- **Stillness is what makes motion readable** — an event moves what it happens
  to and nothing else; gaps left behind are a reading, and a place must be drawn
  for its emptiness to show. → *Stillness is what makes motion readable*
- **Draw what a thing is tied TO** — anything whose meaning is a relation needs
  both ends on the page. → *Draw what a thing is tied TO*
- **Two kinds of motion, and only one of them eases** — a change of PLACE is a
  journey and must be eased; being CARRIED by a surface is rigid. Ease the
  difference between one placing RULE and the next, with a spring not a decay.
  **A teleport does not scale with the frame** — walk two framerates and require
  the worst move to double. → *Two kinds of motion…*
- **A borrowed model keeps its own CLOCK, and the two will not agree** — a model
  stepped by a picture's clock must run at the picture's measured pace, not a
  number it picked; but the picture's full pace may be unaffordable, and **the
  LESSON is the budget** (read the info block before spending a constant). Spend
  the constant the literature pins loosest, re-derive a threshold by BISECTING
  its near miss, and remember **a wrist does not scale** — so some claims move
  whatever you do: say so, re-measure the prose, guard the CONTRAST not the
  level. → *A borrowed model keeps its own clock*
- **One ink cannot carry two readings — split them across hue and strength** —
  the palette reserves its hues by meaning, so a two-ink ramp's grey middle is
  geometry, not tuning; the only lever is WHERE a reading sits on it. Do the
  arithmetic before tuning, then let **hue say WHICH and alpha say HOW MUCH**.
  Guard the COMPOSITE, never either half — and **prose carrying a measured
  number must interpolate it**, because it rots like any other copy.
  → *One ink cannot carry two readings*
- **Slowing an animation is a CHAIN, not a number** — derive the later constants
  from the earlier ones, and when a pacing change starves the model, spend the
  constants that are artifacts of the DRAWING, never the ones that describe the
  cell. → *Slowing an animation is a CHAIN*
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
- **Two views of one law are aligned by their RANGES, not by their drawings** —
  mark where one view's reach ends on the control the child is touching, from a
  MEASURED number, and have each view's notes point at the other.
  → *Two views of one law*
- **A moment is where the INK crosses, not where the tag turns over** — bisect
  for a threshold, never sweep; ask the geometry, not the cast's bookkeeping;
  and date a timeline dot off the ink when the two differ. Guard a placement as
  ARITHMETIC, not as a string. → *A moment is where the INK crosses*
- **One control per interaction, and a pause is not one of them** — name the
  interaction first; borrow a neighbouring view's styling, never its state
  machine. → *One control per interaction*
- **A model can be REWOUND exactly when its inputs are reproducible** — hold it
  when a hand drove it (nothing un-taps a message), replay it when a schedule
  did. And **walk it in fixed steps of the run's own time, never in frames**, or
  the same moment is a different state on a slow machine.
  → *The transport puts the CELL back*
- **A transport moves the PICTURE; make it move the model too** — a view with a
  transport has one clock and everything reads it. Never backwards: a model
  cannot un-tap a message. → *A transport moves the PICTURE*
- **An unobservable drawn is an assertion you did not mean to make** — hold it
  still where it cannot be seen. Guard an ORDER as an order (each beat's first
  millisecond, in sequence), and guard the DRAWN position, not only the model's
  number. → *An unobservable drawn*
- **Two models of one event need their clocks put beside each other** — measure
  the lag before believing either; pace the reading by the DRAWN thing, take the
  lag off the cast rather than typing it, and remember a lag is a REMAINDER, not
  a constant. And match a control to the interaction, not to the neighbouring
  view's layout. → *Two models of one event*
- **The right ink in the wrong PLACE is the same as no ink** — a fill's
  geometry is as much a claim as its colour, and "is the ink there" will not see
  it; ask where it LANDS relative to the shape it is for. A gradient says one
  end is more than the other — do not draw one across something uniform.
  → *The right ink in the wrong PLACE*
- **A ramp built around NEUTRAL is the wrong instrument for something never
  neutral** — opacity must not be `|t|` for a thing that CHANGES through
  neutral, and a palette whose middle is slate will grey out a range that never
  goes there. Same inks, skip the stop. Guard against the palette, not the new
  function's own ends; test at the rate a hand can produce.
  → *A ramp built around NEUTRAL*
- **A COINCIDENCE needs a mark of its own** — if a thing's point is that two
  conditions hold together, that is a state and it needs ink; guard each half
  separately, and guard the mark's SIZE, not its presence.
  → *A COINCIDENCE needs a mark of its own*
- **A reading is of a CHANGE when the absolute never moves** — if the quantity
  never leaves one end of the scale, read the departure from rest, stretch it
  over the range actually reachable (a MEASURED number), and declare it. Test it
  on the DIFFERENCE the exhibit exists to show.
  → *A reading is of a CHANGE*
- **An inherited default is not a decision.** When one actor in a borrowed scene
  behaves differently, mark it in the DATA the scene carries, not in the
  drawing. And when asked "why did you decide X", check whether it was decided.
  → *An inherited default is not a decision*
- **A COUNT that sizes a layout must be continuous, or the layout teleports** —
  a row solved from "how many are in it" jumps the moment the integer ticks;
  count an arriving thing as the fraction of the way it has come. And **ask
  where a traveller will STAND, never re-derive it** — a glyph that lands beside
  its seat has somebody else's ligand floating next to it, which reads as "it
  doesn't work" rather than "it's in the wrong place".
  → *A receptor JOINS the density*
- **Replaying one animation for many events teleports everything in it** — a
  drawing that is a pure function of a run's clock jumps when the clock restarts.
  Give the things that must persist their own IDENTITY (a list with clocks, not
  a formula asked for a position), **quantise them from the flow that decides**,
  and fill the gap between repeats with the transition the picture skipped —
  then walk the picture HOME so the wrap changes nothing on screen.
  → *Replaying one animation for many events*
- **Two things on the same frame do not read as cause and effect** — give the
  cause time to arrive before the effect starts, and draw the signal in ink that
  is not already spoken for. → *Replaying one animation for many events*
- **Two correct drawings of one object, with nothing in between, is a
  teleport.** Ask of every pair of states: a substitution, or one thing
  changing? If it is one thing changing, the ends TRAVEL, eased, over the
  window of the event they belong to. A transition is often where the lesson is.
  Guard a direction as a DECISION — ink cannot see which way a protein faces.
  → *Two correct drawings of one object*
- **Draw a flow by QUANTISING it, never by animating beside it** — one drawn
  item per quantum of the number that actually decides, so no re-tuning and no
  second animation. Gate it on the same call the obstacle is drawn from, make
  the crossing FIT the clear hold, look ahead, and commit the way clear while it
  is occupied — but never ask the commitment where the GATE is decided, or it
  masks it. Order of events is a measurement, not a taste.
  → *Draw a flow by QUANTISING it*
- **A cast is keyed to a CAST LIST — carry it, don't re-derive it.** Put the row
  a framing actually drew onto the scene's data and give it one accessor; eleven
  functions each correctly asking for a default row will still draw nonsense.
  Guard the ink as well as the cast, by DIFFERENCE.
  → *A cast is keyed to a CAST LIST*
- **Chrome takes its room from the MAGNIFICATION, and the room is for the
  ACTORS** — size a gutter off the tallest thing that must be seen in it, not
  off the line it hangs from; solve it (the two are coupled) over the actors
  that DO something; then say which of chrome and zoom gave, and ask the zoom
  guard a legibility question instead of re-tuning it.
  → *Chrome takes its room from the MAGNIFICATION*
- **A layout has TWO frames, and only one of them is the camera** — when the
  camera cannot meet a framing request, ask whether the SUBJECT has freedom to
  move, clamp it with the anatomy, and hand the anchor DOWN rather than letting
  the drawing recompute it. Inside a shape is not the same as below its top.
  → *A layout has TWO frames*
- **One membrane, one paving rule** — two rules for one surface is a seam. One
  step (by ARC LENGTH, not in x), one tangent read off the curve, one
  inward-normal rule pointing at the structure's own interior. Guard a seam by
  asking each PART for its nearest molecule: a nearest-neighbour sweep cannot
  see a gap between two dense runs. → *One membrane, one paving rule*
- **A journey along a surface is the SURFACE's path**, not a lerp between its
  two ends — sample the outline you draw and take the orientation from the
  tangent. When the path will not fit, **the FRAME is what gives**: solve the
  camera from the path, frame the part that is acting, and re-size interior
  furniture off what it belongs to. One line, one definition.
  → *A journey along a surface is the SURFACE's path*
- **Plan the anatomy before the picture.** For every structure ask: is it where it
  really is, made of what it is really made of, seen from a plausible direction?
  → *Drawing a scene: plan the anatomy…*
- **Never invent a surface that is off the page** — fade the cell out at the edge.
- **Machinery that works together is drawn together.** If a model couples two parts
  by proximity, the drawing must show them as neighbours.
- **Draw what a thing is made of when that is the point.**
- **Orient the camera to the structure** (`turn` on the zoom target).
- **A membrane is a liquid, not a ruled line.**
- **A lipid's shape is a RATIO** (`halfMem/headR`), so scale both numbers or you
  have drawn a different molecule — and **a sampler must be told which molecule
  will pave it**, fast paths included. → *A sampler must be told which molecule…*
- **Jiggly lipids, by two rules**: a view that moves at rest jiggles; a view
  that rests as a still keeps still lipids; and wherever the bilayer is the
  main actor or subject, it jiggles regardless. Each leaflet on its own beat,
  identity = slot, screen time never model time. → *Jiggly lipids*
- **Compare things in the `SideBySide` component** ("side-by-side interactive
  comparison") — one container per thing, speaker-first headline, fixed-height
  caption, transparent canvas, action at the foot. → *The 'side-by-side
  interactive comparison' layout*
- **A reading spent on TIME is a reading nobody can integrate** — a value drawn
  as how OFTEN something happens is true and unreadable; spend it on a POSITION
  and declare the simplification. Then check what else was reading it: a
  threshold that worked against a flickering value becomes all-or-nothing
  against a steady one, and **when one drawn thing stands for many,
  probabilities become fractions of the CAST**. Watch for the same quantity
  being counted twice once it stops being a gate.
  → *The magnesium stops tossing a coin*
- **A mark that needs a key is not a reading** — if someone who knows the code
  has to ask what a glyph means, a child cannot read it; put the mark ON the
  thing it is about, or drop it. → *The magnesium stops tossing a coin*
- **A protein DISPLACES what it stands among — at the size it is NOW** — a hole
  punched at a shape's resting width leaves lipids on its shoulders the moment
  it opens; the thing standing there says how much room it needs.
  → *A receptor JOINS the density*
- **Two populations of one thing, and one of them is a still** — giving the
  moving half identity leaves the waiting half dead: the child watches one
  object and a DIFFERENT one acts. One list, one life each, and the quantum
  PICKS a waiting item rather than conjuring a new one. Size the pool against
  the busiest moment — a supply that refills only when empty starves the exhibit
  exactly where the demand is. → *The sodium gets one life each*
- **A container arrives with its contents** — filling a vessel after it has
  parked is the cargo teleporting; and when one object is drawn by two callers,
  both ask ONE layout helper so the hand-over moves nothing.
  → *Replaying one animation for many events*
- **Make the model's hidden states visible**, allocated by threshold not rounding.
- **A stronger signal is MORE, never BIGGER** — draw a count for a count, and
  take the count from the model (`'⚡'.repeat(BURST_N)`, never typed out).
  → *A stronger signal is MORE, never BIGGER*
- **Everything that opens the wall opens it for EVERYONE.** Several instances of
  one effect on a shared surface each displace the others: solve the
  displacements, then place every actor in the displaced frame — and keep the
  material frame (which side of an opening?) apart from the drawn frame (where
  do I paint it?). → *Everything that opens the wall…*
- **A machine's cargo sits where the machine has a SEAT** — the chamber the trace
  draws, found by measuring the pore, never the door's own anchor point.
  → *A machine's cargo sits where the machine has a seat*
- **One protein, one drawing — across REGISTERS too.** Same glyph, same ink, same
  behaviour in every view; only the scale differs, and it is declared.
  → *One protein, one drawing — across REGISTERS too*
- **A guard that walks a run samples in SCREEN TIME**, never in a fixed count of
  `u` — or growing a leg loosens every guard. → *A guard that walks a run…*
- **An opening is sized off the SHEET, not off what must pass through it.** A gap
  is judged against the packing around it, not against the cargo — measure it as
  a CLEAR span, in ONE leaflet, and walk every leg that opens the wall.
  → *An opening is sized off the SHEET…*
- **A transporter's gates swing BOTH ways**, and one pore carries one molecule —
  but do not invent a waiting line where the picture already has one.
  → *A transporter's gates must swing BOTH ways*

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
- **Reusing a picture means inheriting its CLOCK — keep only the legs you can
  act.** A leg whose actors you removed is screen time on an empty stage:
  declare a window in the original's model time, and derive the borrowed run's
  length from the kept legs so their pace is unchanged. Guard the window by what
  must be OUTSIDE it, never by its own constant. → *Reusing a picture means
  inheriting its CLOCK*
- **A drawing whose CLOCK never ticks is a still.** Reusing a picture means
  inheriting its clock: drive every input it animates on, not just what you
  added. Guard both halves — the ink differs across the run, AND the control
  drives every clock. → *…and a drawing whose CLOCK never ticks*
- **A drawing that is never CALLED fails nothing.** A scene test exercises what
  a view paints, never the wiring that asks it to paint — so a view can be fully
  guarded and come up blank. Guard that it is REACHED: fade declared, driven,
  consumed, layer handed to the animation. → *A drawing that is never CALLED…*
- **A guard you have not broken is a guess.**
- **Guard the MIDDLE of a transition, not only its ends** — a break measured on
  a fixture already past the moment cannot fail, and **a journey has more than
  one leg**: land a fixture on each branch. Code a break cannot reach is
  decoration, not a rule. → *Guard the MIDDLE of a transition*
- **Ask for what the budget PROMISED**, not merely for the absence of collision
  — a solved layout exports its pitch and the guard asks for that number.
  → *Guard the MIDDLE of a transition*
- **Measure the claim where the CHILD reads it.** A guard on a nearby internal
  number can be green, true, and pointing the wrong way. → *Measure the claim
  where the CHILD reads it*
- **A wobble is a FRACTION of what wobbles.** An amplitude in pixels is a
  different motion in every view — scale it by the thing that moves, calibrate
  so the view it was tuned in is unchanged, and guard the WIRING (measure the
  drawn scatter) and not only the rule. → *A wobble is a FRACTION…*
- **One number, one picture — or they will disagree.** Two drawings of one
  fraction in the same frame will contradict each other; make one of them the
  decision and have the other ask it. Guard it **per item at the moment it
  decided**, never on the aggregate — both the right and the wrong drawing
  produce the same average. → *One number, one picture*
- **Ink a guard cannot see is a claim you cannot make.** `fillRect` lays no path
  vertices — draw a rectangle you want to measure as a path. And isolate a
  colour claim by DIFFERENCE (change only the variable and diff the renders),
  never by picking the most-X mark out of a crowded palette.
  → *Ink a guard cannot see…*
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
