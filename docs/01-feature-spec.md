# Interactive Neurobiology Playground --- handover specification

> Source of truth for the feature set. Reference features by ID
> (e.g. N01, S04, C03). Implementation status lives in
> [04-roadmap.md](04-roadmap.md).

This is a functional/educational specification rather than a product
description: the data model, UI states, animations, and scientific rules
should be inferable from it.

Baseline references: PhET's _Neuron_ and _NeuroLab_ style simulations,
HH-style action-potential visualizations, and established educational
neuron/synapse diagrams. The application should go beyond static
diagrams by synchronizing molecular, membrane, neuron, circuit, and
brain-scale representations of the same event.

## Feature table

---

ID Module / feature User interaction What should be Animation / behavior Teaching concept Scientific implementation Example /
displayed / constraints reference

---

**N01** **Neuron Builder** Explore/toggle neuron Dendrites, soma, axon, Parts assemble into a Neuron structure Use a canonical neuron Standard neuron
parts axon terminals complete neuron but explain that real anatomy diagrams
neurons have diverse  
 morphologies

**N02** **Neuron Click a structure Highlight + concise Signal/pulse travels Structure relates to Do not imply every neuron ---
exploration** explanation to the selected region function has identical anatomy

**N03** **Dendrites** Click/add input Branched dendrites Inputs travel toward Dendrites receive many Dendrites can contain ---
soma synaptic inputs active channels; keep  
 first model simple

**N04** **Soma** Click soma Cell body and nucleus Incoming graded Soma is a major Avoid saying the soma ---
signals converge here integration region literally "decides"

**N05** **Axon** Trigger neuron Axon highlighted Action potential Axons carry action Distinguish propagation ---
propagates along axon potentials from synaptic  
 transmission

**N06** **Axon terminals** Zoom/click terminal Boutons and vesicles Vesicles approach Electrical activity can Simplified presynaptic ---
membrane after AP trigger chemical terminal  
 arrival release

**N07** **Membrane Zoom into membrane Lipid bilayer + Ion movement becomes Membrane separates Reuse this view ---
cross-section** inside/outside visible ionic environments throughout the app

**N08** **Ion palette** Select Na⁺, K⁺, Cl⁻, Ca²⁺ Charged ions Ions move when Neural signaling Start with Na⁺/K⁺; add ---
pathways are open depends on ions Cl⁻/Ca²⁺ as needed

**N09** **Ion gradients** Change concentrations Ion Particles move Chemical gradients Use pedagogical relative ---
counts/concentration according to gradient store potential energy concentrations rather  
 indicators when a pathway opens than claiming visual  
 scale is quantitative

**N10** **Resting membrane Observe/change conditions Voltage meter across Voltage settles toward Neurons have a voltage Explain gradients + ---
potential** membrane resting state difference across selective permeability +  
 membrane pump contribution; don't  
 imply pump alone creates  
 Vm

**N11** **Na⁺/K⁺ pump** Toggle/slow pump Membrane pump 3 Na⁺ out / 2 K⁺ in Active transport Clearly distinguish pump ---
animation per cycle maintains gradients from passive ion channels

**N12** **Leak channels** Toggle channels Open leak channels Slow ion movement Resting membrane is Include K⁺ leak as the ---
selectively permeable main teaching example

**N13** **Ion channel** Click/open/close Channel protein Conformational Channels control Different channel types ---
opening; ions pass membrane permeability must have different  
 only when open gating rules

**N14** **Voltage-gated Change voltage / trigger Voltage sensor + pore Channel opens/closes Voltage controls Na⁺ activation and ---
channel** AP as Vm changes permeability delayed K⁺ activation  
 should be distinct

**N15** **Ligand-gated Add neurotransmitter Receptor/channel Ligand binds and Chemical signals can Separate ligand-gated ---
channel** channel opens change Vm from voltage-gated  
 channels

**N16** **Action potential Press Stimulate Na⁺/K⁺ channels + ions Na⁺ channels open → AP arises from changing Use a simplified ---
--- membrane view** Na⁺ influx → permeability Hodgkin-Huxley-inspired  
 depolarization → K⁺ state machine, not a  
 channels open → K⁺ literal particle  
 efflux → recovery simulation

**N17** **Action potential Trigger AP / scrub Vm vs time graph Cursor follows the Connect molecular event Graph is synchronized Standard
--- voltage trace** timeline membrane animation to electrical waveform with the membrane view action-potential
graph

**N18** **Threshold** Adjust stimulus Voltage + threshold Subthreshold input Action potential is Graded potentials are ---
line fades; threshold input all-or-none variable; AP amplitude is
triggers AP comparatively stereotyped

**N19** **Action potential Trigger at axon hillock Full axon AP regenerates Signal propagates Explicitly teach local ---
propagation** sequentially along without one fixed regeneration  
 axon packet of ions  
 travelling end-to-end

**N20** **Myelinated axon** Toggle myelin Myelin + nodes of Activity appears Saltatory conduction Explain that current ---
Ranvier concentrated at nodes spreads under myelin and  
 APs regenerate at nodes

**N21** **Myelin comparison** Compare Two axons + timer Same distance, Myelin increases Use relative speed, not ---
myelinated/unmyelinated different propagation conduction speed misleading exact scale  
 time

**N22** **Refractory period** Stimulate repeatedly Channel states + Immediate second Neuron needs recovery Distinguish absolute and ---
voltage graph stimulus fails or time relative refractory  
 needs stronger input periods later

**S01** **Synapse** Zoom into terminal Presynaptic membrane, AP arrival triggers Electrical → chemical → Chemical synapse is the ---
cleft, postsynaptic release sequence electrical default model; electrical
membrane synapses can be future

**S02** **Ca²⁺ trigger** Trigger AP at terminal Voltage-gated Ca²⁺ Ca²⁺ rapidly enters Ca²⁺ couples AP to Essential causal step; ---
channels terminal vesicle release don't skip it

**S03** **Synaptic vesicle** Click/observe vesicle Vesicle containing Dock → fuse → release Neurotransmitters are Simplified ---
transmitter stored in vesicles SNARE/exocytosis model

**S04** **Neurotransmitter Trigger synapse Molecules in cleft Molecules diffuse to Chemical communication Use symbolic molecules, ---
release** receptors not claims of exact  
 molecular geometry

**S05** **Receptor Select receptor Receptor on Ligand binds → Effect depends on Same transmitter can have ---
interaction** postsynaptic membrane receptor state changes receptor different effects via  
 different receptors

**S06** **EPSP / IPSP** Activate Postsynaptic voltage EPSP moves Vm toward Synapses can Avoid "excitatory ---
excitatory/inhibitory meter threshold; IPSP increase/decrease neurotransmitter = always
input opposes firing firing probability excitatory"

**S07** **Synaptic Add multiple inputs Multiple Inputs sum over time Neurons integrate many Start with simple ---
integration** dendritic/somatic and location signals spatial + temporal  
 synapses summation

**S08** **Neuron firing** Adjust inputs Soma + threshold meter Combined inputs reach Input integration Avoid anthropomorphic ---
threshold → AP produces output "decision" language

**S09** **Fast vs slow Compare receptor types Ionotropic vs Fast channel opening Neural signaling occurs Keep receptor mechanisms ---
receptors** metabotropic vs slower cascade on multiple timescales explicit

**S10** **Reuptake** Trigger release Transporter proteins Transmitter removed Signals must terminate Reuptake is one ---
from cleft termination mechanism,  
 not the only one

**S11** **Enzymatic Select transmitter Enzyme in cleft Molecules broken down Some signals terminate Acetylcholine is a useful ---
breakdown** chemically example

**M01** **Neurotransmitter Select molecule Glutamate, GABA, Selected transmitter Different chemical Do not map one ---
palette** dopamine, serotonin, follows the same messengers exist transmitter to one  
 acetylcholine synapse animation emotion/function

**M02** **Glutamate → AMPA** Trigger synapse AMPA receptor + cation Fast excitatory Fast excitatory Curated canonical example ---
flow postsynaptic response transmission

**M03** **GABA → GABA Trigger synapse GABA receptor + Postsynaptic Vm moves Inhibitory transmission Receptor subtype ---
receptor** inhibitory effect away from firing determines mechanism; use
threshold a simplified canonical  
 example

**M04** **Dopamine → GPCR** Trigger synapse Dopamine receptor + Slower modulation of Neuromodulation Do not call dopamine ---
intracellular cascade channel/excitability simply a "pleasure  
 state chemical"

**M05** **Acetylcholine → Trigger synapse Ligand-gated channel Rapid channel opening Neurotransmitter can Good bridge from ---
nicotinic receptor** after ACh binding directly gate an ion transmitter → receptor →  
 channel ion flow

**M06** **Neuromodulation** Add neuromodulator to Many synapses/channels Network responsiveness Modulators alter Show modulation as ---
network affected changes over time circuit state rather parameter/state change,  
 than merely sending one not magical "brain  
 point-to-point message chemical" aura

**M07** **Second messenger Click receptor GPCR → G protein → Sequential activation Some receptors act Use generic cascade ---
cascade** second messenger → indirectly first; detailed pathways  
 target later

**M08** **Ion-channel Add modulator Channel Channel opens Neuromodulators can Keep mechanism ---
modulation** probability/state more/less readily change excitability qualitative unless  
 quantitative model is  
 added

**C01** **Two-neuron Connect neurons Neuron A → synapse → AP → release → Individual neurons form Central bridge to network ---
circuit** neuron B receptor response → circuits behavior  
 possible AP

**C02** **Excitatory Add neurons 3--5 neuron chain Activity propagates Networks process Keep network small in V1 ---
circuit** information

**C03** **Inhibitory Add inhibitory neuron Excitatory + Inhibitory input Excitation/inhibition Essential circuit concept ---
circuit** inhibitory cells suppresses downstream balance  
 firing

**C04** **Feedback circuit** Connect output to input Loop Activity amplifies or Neural circuits use Advanced V1/V2 ---
suppresses itself feedback

**C05** **Signal tracing** Click an action potential Follow signal through Camera/signal follows One causal chain links Signature interaction ---
all scales same event from molecular to circuit  
 membrane → axon → scales  
 synapse → next neuron

**C06** **Circuit challenge** "Make neuron B fire" Adjustable inputs and Child experiments Learning through causal Fixed small networks only ---
connections until target state experimentation  
 occurs

**B01** **Brain overview** Zoom out from neuron Whole human brain Camera transitions Neural activity occurs Use simplified anatomical Standard brain
neuron → circuit → within an organ model anatomy
brain

**B02** **Brain regions** Click region Cortex, cerebellum, Region highlights + Brain has specialized Avoid ---
brainstem, function structures one-region/one-function  
 hippocampus, thalamus claims  
 etc.

**B03** **Cortex Zoom into cortex Layers / cortical Brain → cortex → Brain structure is Version 2; simplified ---
organization** column neurons transition hierarchical cortical column

**B04** **Sensory pathway** Trigger sensory input Receptor → nerve → Signal travels through Nervous system receives Start with touch or ---
spinal cord → brain pathway information vision

**B05** **Motor pathway** Trigger motor command Brain → spinal cord → Signal travels to Nervous system produces Simplified pathway ---
motor neuron → muscle muscle output

**B06** **Reflex arc** Stimulate sensory input Sensory → Rapid response Some responses are Excellent first circuit ---
spinal/interneuron → processed without example  
 motor conscious cortical  
 involvement

**B07** **Comparative Select animal Human, mouse, bird, Brain forms morph Evolution produced Don't rank brains as ---
brains** fish, octopus etc. between species; different simply more/less advanced
selected regions nervous-system  
 highlight architectures

**P01** **Synaptic Repeat stimulation Synaptic strength Connection Connections can change Use as simplified ---
plasticity** meter strengthens/weakens with activity conceptual model

**P02** **Learning Repeatedly train a Trial counter + Repeated pairing Experience can change Do not imply all learning ---
challenge** pathway synapse strength changes response neural circuits is one mechanism

**X01** **Change-one-thing Modify one variable Before/after state Changed variable and Causal reasoning Central interaction ---
experiment** consequences pattern  
 highlighted

**X02** **Comparison mode** Freeze two states Side-by-side Differences Builds causal Examples: normal vs ---
neuron/network highlighted understanding blocked Na⁺ channels

**X03** **Blocker Apply a conceptual Selected Signal changes/fails Molecular targets can Educational mechanism ---
experiment** blocker channel/receptor alter neural signaling only; avoid  
 disabled medical/dosing claims

**X04** **Scale transition** Continuous zoom Ion → membrane → Smooth camera Brain function spans Signature visual ---
neuron → circuit → transition preserves many physical scales architecture  
 brain context

**F01** **Model explanation Click "What am I seeing?" Context-specific Panel follows current Prevent misconceptions Every simplified ---
layer** explanation view visualization states what
is simplified

**F02** **Difficulty levels** Select Explore / More Progressive labels and Same animation, deeper One playground can Don't force molecular ---
detail explanations detail serve different ages detail on young users

**F03** **Right now panel** Interact with any scene Live state summary Text updates with the Make invisible state Same pattern as Atom ---
simulation changes explicit Builder

---

## Recommended V1 neurotransmission scope

Do not build a universal receptor/neurotransmitter engine initially.
Curate a small set of canonical examples:

---

Example Demonstrates

---

**Glutamate → AMPA** fast excitatory transmission

**GABA → inhibitory receptor** inhibitory transmission

**Acetylcholine → nicotinic ligand-gated ion channel
receptor**

**Dopamine → GPCR** neuromodulation and slower
intracellular signaling

---

The point is to demonstrate mechanisms, not to imply that each
neurotransmitter has one universal effect.

## Recommended V1 circuit scope

Example Demonstrates

---

**Neuron A → Neuron B** basic synaptic transmission
**A → B → C** signal propagation through a circuit
**A → inhibitory B → C** inhibition
**A → B → A** feedback
**Sensory → spinal/interneuron → motor** reflex arc

## Core animation language

Use a small number of recurring visual motions throughout the
application:

1.  **Ion crosses membrane** → membrane permeability changed.
2.  **Channel opens/closes** → the gate controls ion movement.
3.  **Voltage wave travels** → action potential propagates.
4.  **Vesicle moves/fuses** → neurotransmitter is released.
5.  **Molecule binds receptor** → chemical signal becomes a cellular
    response.
6.  **Force/flow arrows** → direction of ionic movement or electrical
    effect.
7.  **Signal travels between neurons** → circuit-level information flow.
8.  **Camera zooms out/in while preserving the signal** → same
    biological event at a different scale.

The last item is the signature animation.

### Signature animation: molecule → membrane → neuron → network → brain

A single action potential should be traceable across scales:

**Na⁺ enters → membrane depolarizes → action potential begins → AP
travels down axon → Ca²⁺ enters terminal → vesicle fuses →
neurotransmitter crosses cleft → receptor opens → postsynaptic voltage
changes → second neuron fires → network activity changes.**

The user should never feel that these are separate simulations. They are
different views of the same causal event.

## Scientific guardrails

- **Resting potential:** do not teach that the Na⁺/K⁺ pump alone
  "creates" the resting potential. It maintains gradients; selective
  permeability, especially K⁺ leak, is central.
- **Action potential:** do not animate one group of Na⁺ ions
  travelling from soma to terminal. The action potential is
  regenerated along the membrane.
- **Electron-style particle visualization:** ions can be shown as
  particles, but particle counts are pedagogical and not literal
  molecular-scale concentrations.
- **Neurotransmitters:** do not assign one fixed psychological meaning
  to a neurotransmitter.
- **Excitation/inhibition:** receptor and ion conductance determine
  the effect; the transmitter name alone does not.
- **Neuromodulation:** represent modulation as changes in
  cellular/network state rather than a single signal producing one
  behavior.
- **Brain regions:** avoid one-region/one-function claims; use
  "involved in", "contributes to", or "plays an important role in".
- **Action-potential waveform:** use a scientifically recognizable
  trace but make clear that the animation is a simplified educational
  model.
- **Ion channels:** channel opening should be represented as changing
  permeability/conductance, not as a door that physically pushes ions.
- **Scale:** visual sizes are intentionally distorted; every scale
  transition should communicate what has been enlarged or simplified.

## Educational interaction principle

The central interaction pattern should be:

> **Change one thing → observe what changes next.**

Examples:

- Add Na⁺ outside → change driving force.
- Block Na⁺ channels → AP fails or changes.
- Raise threshold → harder to fire.
- Add an excitatory synapse → membrane moves toward threshold.
- Add an inhibitory synapse → firing becomes less likely.
- Remove myelin → propagation becomes slower.
- Block Ca²⁺ entry at terminal → neurotransmitter release falls
  dramatically.
- Block receptors → transmitter remains present but its postsynaptic
  effect disappears.

This is more valuable than a collection of animations because it teaches
causal mechanisms.

## V1 signature experiment

### "Can you make the neuron fire?"

Start with a neuron at rest.

Show:

- membrane
- Na⁺ and K⁺ gradients
- leak channels
- voltage-gated Na⁺/K⁺ channels
- voltage meter
- action-potential trace

The child presses **Stimulate** and sees:

**resting potential → threshold → Na⁺ channel opening → Na⁺ influx →
depolarization → K⁺ channel opening → K⁺ efflux → repolarization →
hyperpolarization → recovery**

The membrane animation and voltage graph must remain synchronized.

Then expose a few variables:

- stimulus strength
- extracellular Na⁺
- extracellular K⁺
- Na⁺ channel availability
- K⁺ channel availability
- threshold

The child can therefore discover the mechanism rather than only watch
it.

## Signature scale journey

The second flagship experiment is:

**ION** → **CHANNEL** → **MEMBRANE** → **ACTION POTENTIAL** → **NEURON**
→ **SYNAPSE** → **CIRCUIT** → **BRAIN**

A continuous zoom should preserve the current signal/event wherever
possible.

## V1 / V2 boundary

### V1 --- core

- N01--N22: neuron, membrane, ions, resting potential, action
  potential, propagation
- S01--S08: synapse and integration
- M02--M05: four curated neurotransmitter/receptor examples
- C01--C03: small neural circuits
- B01--B02: brain overview and major structures
- X01--X02: change-one-variable and comparison
- F01--F03: explanations and live state
- signature signal tracing

### V2

- N20--N22 refinements: detailed myelin/refractory modeling
- M06--M08: richer neuromodulation
- C04: feedback circuits
- B03: cortical layers/columns
- B04--B06: sensory, motor and reflex pathways
- B07: comparative brains
- P01--P02: plasticity/learning
- X03: conceptual blockers
- more receptor subtypes
- quantitative Hodgkin-Huxley-style mode

### Advanced / future

- detailed Hodgkin-Huxley dynamics
- voltage-clamp experiment
- synaptic plasticity mechanisms such as STDP
- dendritic computation
- ion-channel kinetics
- receptor signaling cascades
- large recurrent networks
- realistic 3D brain pathways
- fMRI-style brain activity visualization

The application should never require the advanced model to make the core
educational model work.

## 2026-08-27 revision — deep-dive exhibits and the synapse journey

Adopted after milestones 1–3, from a feature brainstorm. Existing IDs are
unchanged; this section only adds. The remaining plan is organized around one
placement law (reasoning in
[03-architecture.md](03-architecture.md) → _Where a concept lives_):

> **A part of the neuron is a place, reached by zooming to where it is on the
> cell. An abstract concept — a comparison, a graph, a structure exhibit, a
> thought experiment — opens as a drawer, triggered from the view it extends.**

Where a row corrects a science point from the brainstorm, the correction is
marked **⚠** and must not be silently reverted; the reasoning is recorded in
[04-roadmap.md](04-roadmap.md) → _The replan of 2026-08-27_.

### The synapse journey (regroups and extends S01–S10)

Synaptic transmission is one continuous event taught in three legs, all at the
outgoing-synapse zoom, each a feature with its own hand-over. The models from
steps 18–19 (`core/synapse.ts`, `core/cleft.ts`) are the source of every number.

| ID      | Feature                                  | What is shown                                                                                                                                                                                                                            | Science constraints                                                                                                                                                                                                                                                                                                                                              |
| ------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S12** | Journey leg 1 — arrival to binding       | AP reaches the bouton → active-zone Ca²⁺ channels open → microdomain Ca²⁺ fills the sensor's four sites → SNARE-driven fusion → transmitter fills the cleft as a concentration → two glutamates bind per AMPA receptor. Ends at binding. | Keep the step-19 lesson: the crossing is ~0.61 µs against a ~2.7 ms release delay — never animate a leisurely journey across the gap. Particles conserved throughout.                                                                                                                                                                                            |
| **S13** | Journey leg 2 — receptors to the hillock | AMPA opens (EPSP on the local meter) → depolarization pops NMDA's Mg²⁺ plug → NMDA opens, Ca²⁺ enters the spine → the EPSP leaves toward the hillock.                                                                                    | **⚠ One synapse's EPSP (~0.5–1 mV at the soma) does not generate an AP.** The leg ends by handing the EPSP to the whole-cell view, where summation fires the hillock — milestone 1's own lesson, not a new claim. NMDA needs glutamate AND depolarization (coincidence detector); the glycine/D-serine co-agonist is simplified away and the info block says so. |
| **S14** | Journey leg 3 — clearance & recycling    | Transporters clear the cleft; used vesicle membrane is retrieved (endocytosis), re-acidified (V-ATPase), refilled (VGLUT), and returns to the pool.                                                                                      | **⚠ Glutamate is cleared mostly by astrocytes** (EAATs, glutamate–glutamine cycle); presynaptic-only reuptake is itself a misconception — draw an astrocyte process, or declare the simplification in the info block. Kiss-and-run vs full-collapse retrieval is debated; pick full-collapse and say so.                                                         |

### Drawer exhibits (D-series)

Each drawer is triggered from the view named in its row, never from a global
menu. Structure exhibits keep the scene's schematic as a ghost and carry a
locator thumbnail (see 03-architecture.md → _A structure exhibit keeps its
schematic as a ghost_).

| ID                      | Exhibit                                                         | Trigger view             | What is shown                                                                                                                                                                                                                                    | Science constraints                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D01**                 | Phospholipid & bilayer structure                                | membrane                 | One phospholipid's anatomy — charged head, two oily tails, one kinked (unsaturated) — amphipathy, and why they self-assemble into two leaflets.                                                                                                  | Drawn by the same bilayer module the scene uses; a second private drawing of the bilayer is forbidden.                                                                                                                                                                                                                                                             |
| **'shot' per element'** | Membrane permeability bench                                     | membrane                 | A race at the wall: O₂/CO₂ dissolve straight through; water trickles (name aquaporins as the real fast path); ions never; glucose neither.                                                                                                       | The barrier is **charge, not size** — already the step-2 lesson; the bench must agree with it.                                                                                                                                                                                                                                                                     |
| **D03**                 | Ion channel structure                                           | membrane                 | Side and top view: four subunits round a central pore, the S4 helix with its positive charges (the red marks the schematic channel already wears), and the selectivity filter.                                                                   | **⚠ The filter is not a sieve.** The K⁺ channel excludes the _smaller_ Na⁺: the filter's carbonyl-oxygen cage replaces exactly K⁺'s water shell; Na⁺ fits too loosely to be paid for shedding its water. Sibling of the bilayer's charge-not-size lesson.                                                                                                          |
| **D04**                 | Gating families & open probability                              | membrane                 | The channel families and a live open-probability bench: Pₒ vs voltage, Pₒ vs ligand concentration, single-channel flicker (seeded) with Pₒ as fraction-of-time-open.                                                                             | **⚠ The families are voltage-gated / ligand-gated / mechanically-gated** — "ion-gated" is not a class (Ca²⁺-activated K⁺ channels are ligand-gated from the inside). Gating stays cause-driven: no button opens a channel directly.                                                                                                                                |
| **D05**                 | Leaky pipe                                                      | axon / dendrite membrane | Axial resistance vs membrane resistance as a leaky hose; the length constant λ = √(rₘ/rᵢ); why signals fade with distance and what myelin does to the ratio.                                                                                     | Draws `core/cable.ts`, which already models this — no second set of numbers.                                                                                                                                                                                                                                                                                       |
| **D06**                 | Vesicle life cycle & SNARE machinery                            | synapse                  | Dock → prime (SNAREs half-zippered) → Ca²⁺ on synaptotagmin → full zipper pulls the membranes together → fusion pore → collapse → retrieval → refill → back to the pool. Cast: synaptobrevin on the vesicle; syntaxin + SNAP-25 on the terminal. | The four-site Ca²⁺ sensor must be the same sensor the scene draws (Dodge–Rahamimoff's fourth power). The vesicle is a ring of the scene's own bilayer.                                                                                                                                                                                                             |
| **D07**                 | AMPA & NMDA structure                                           | synapse                  | Clamshell binding domains closing on glutamate; the gate; NMDA's Mg²⁺ plug sitting in the pore; how an AMPA receptor arrives and is held — lateral diffusion in the membrane, then capture at PSD scaffold slots.                                | **⚠ Receptors are not "attracted" through space** — they diffuse in the membrane plane and are caught. NMDA's block is voltage-dependent: the plug leaves only when the membrane depolarizes.                                                                                                                                                                      |
| **D08**                 | Receptor kinetics bench                                         | synapse                  | AMPA vs NMDA current time courses side by side (sub-ms rise/~2 ms decay vs tens-of-ms), and a coincidence-detection demo: transmitter alone, depolarization alone, both together.                                                                | **⚠ Repeated stimulation does not create new NMDA receptors.** NMDA supplies the calcium _trigger_; the _expression_ is new **AMPA** receptors captured at the synapse (P04). NMDA numbers are comparatively stable.                                                                                                                                               |
| **D09**                 | Glutamate vs GABA                                               | synapse (either cast)    | The two molecules side by side — GABA is made _from_ glutamate by one enzyme (GAD) — their ionotropic receptors, and the shared logic: the effect is the receptor's ion, not the molecule's mood.                                                | GABA-A passes Cl⁻; the IPSP follows Cl⁻'s own equilibrium, near rest — inhibition is often _shunting_, not a big downward swing. Never "GABA = calm chemical".                                                                                                                                                                                                     |
| **D10**                 | Benzodiazepine bench                                            | GABA synapse             | Allosteric modulation: the drug binds its own site (α/γ interface), opens nothing alone; with GABA present, opening **frequency** rises.                                                                                                         | **⚠ Frequency, not duration** (duration is barbiturates), and no effect without GABA. X03 guardrail applies: mechanism only, no medical/dosing claims.                                                                                                                                                                                                             |
| **D11**                 | Synapse gallery                                                 | synapse                  | The calyx of Held — a giant terminal engulfing a soma, built for fidelity at high rates in the auditory brainstem — beside axodendritic / axosomatic / axoaxonic contacts, en passant boutons, and electrical synapses (gap junctions).          | Electrical synapses conduct with essentially no delay and (mostly) both ways — the contrast with the chemical delay the child has measured is the point.                                                                                                                                                                                                           |
| **D12**                 | Membrane capacitor _(2026-08-27 curriculum cross-check)_        | membrane                 | The step-8 charge skin, quantified: the membrane as a capacitor — charge parked on its two faces, Q = C·V, and why a vanishing number of ions makes the whole voltage.                                                                           | The count is **derived from the scene's own geometry**, never asserted: ~1 µF/cm² on the declared 20 µm soma gives ≈13 pF, so −72 mV is about six million ions — against a few ×10¹¹ potassium ions inside, roughly one in sixty thousand. Pinned by a test. The ion piles must not visibly change when the voltage does — the step-8 lesson, now with its number. |
| **D13**                 | Patch clamp — how we know _(2026-08-27 curriculum cross-check)_ | membrane                 | A pipette seals onto the membrane and listens to ONE channel: its current is square steps that flicker open/shut; zooming out, the whole-cell current is the sum of thousands. The open probability D04 plots is read off this trace.            | Single-channel currents are picoamps and **step-shaped, never a smooth swell**; the flicker is stochastic and seeded. Methods exhibit — it shows where the app's own numbers come from (measure, never assert, made visible). Qualitative cousin of the V2 voltage-clamp experiment.                                                                               |

### Documented ahead, not yet planned in detail

| ID      | Feature                                                                    | What is shown                                                                                                                                                                                                                                         | Constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D14** | Membrane constructor _(requested 2026-08-27; documented, not implemented)_ | A build-your-own-membrane bench: the kid drags proteins from a tray — K⁺ leak channels, voltage-gated Na⁺/K⁺ channels, ligand-gated channels, the Na⁺/K⁺ pump — and plugs them into a bare bilayer, then watches what the membrane they built can do. | The cast is the app's own proteins, drawn by their existing code (one biology, one drawing); lipids part to admit a protein, as in the membrane view. Gating stays cause-driven — plugging a channel in does not open it; the causes do. The payoff must be **derived, not scripted**: the built membrane's resting voltage comes from `core/voltage.ts` chord conductance over what was actually plugged in (no leak channels → no resting potential — discovered, not told). Kinship: PhET-style construction, the Atom Builder's drag grammar, and the bonding lab's tray. |
| **D15** | Inside the selectivity filter _(2026-08-28)_ | The filter from D03, very close up, with BOTH ions in it at the same time: four rungs of backbone carbonyl oxygens, an ion arriving in each lane wearing its coat of water. Potassium's coat comes off, the oxygens close in and take the water's place, and it goes through; sodium — the smaller ion — keeps its coat, the oxygens fall short, and it drops back. Under each lane a two-bar ledger: what the coat costs and what the filter pays back, at true proportion. | Reached by tapping a magnifier ON the filter in D03, never from a list. Selectivity is taught as an ENERGY EXCHANGE, not a sieve: the shortfall for sodium is DERIVED from D03's selectivity by RT·ln S (~18 kJ/mol) rather than typed in, and is drawn at true scale, so a child sees that a few per cent buys a thousandfold. Two independent routes to one verdict — fit (D03) and ledger (D15) — and a test that they agree. |

### Learning-layer additions

| ID      | Feature    | What is shown                                                                                                                                                                                               | Constraints                                                                                                                                                                                                                    |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **F04** | Term voice | A 🔊 speaker button before a scientific term says it aloud (browser speech synthesis, the atomic-playground `SpeakButton` pattern — ported, not reimplemented). Kids meet these words by ear before by eye. | Terms only — single scientific words or short noun phrases, never sentences. Request shorthand: the user says **"add voice to term A"** and that term gets a speaker wherever it is taught. First live in the lipid lab (D01). |

### Place features and plasticity mechanisms

| ID      | Feature                   | What is shown                                                                                                                                                                                                                 | Science constraints                                                                                                                                                                     |
| ------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **N23** | Dendritic spikes          | A dendrite zoom: enough clustered input lets a thin branch fire a local NMDA/Ca²⁺ spike — dendrites are not always passive.                                                                                                   | Advanced (V2 boundary); must not contradict milestone 1's "dendrites never generate signals of their own" without _revising that text in the same step_.                                |
| **P03** | Post-tetanic potentiation | After a burst, residual presynaptic Ca²⁺ leaves release probability elevated for seconds–minutes; the next AP releases more.                                                                                                  | Presynaptic; must be **derived** from the kept release model's calcium and fourth-power sensor, not scripted.                                                                           |
| **P04** | Long-term potentiation    | Strong/paired activity → NMDA Ca²⁺ → CaMKII → more AMPA receptors captured at the synapse → bigger EPSP — and the dendritic spine itself visibly enlarges with it (structural plasticity; 2026-08-27 curriculum cross-check). | **⚠ The receptor count that grows is AMPA's.** Spine growth accompanies LTP rather than causing it — narrate as "the synapse is rebuilt bigger", not as the mechanism. Extends D07/D08. |
| **P05** | Long-term depression      | Low-frequency activity → modest, sustained Ca²⁺ → phosphatases → AMPA receptors removed → smaller EPSP.                                                                                                                       | Same messenger as LTP, opposite outcome by level and time course — that contrast is the teaching point.                                                                                 |
