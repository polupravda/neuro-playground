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
| **S12** | The synapse: the round trip (renamed 2026-09-06) | AP reaches the bouton → active-zone Ca²⁺ channels open → microdomain Ca²⁺ fills the sensor's four sites → SNARE-driven fusion → transmitter fills the cleft as a concentration → two glutamates bind per AMPA receptor. ⚠ NO LONGER ENDS AT BINDING (21c, 2026-09-04→06): the run goes on through clearance, astrocytic uptake at EAAT, the glutamate–glutamine cycle, the return to the terminal, the standing pool and VGLUT refilling the rebuilt vesicles — and the calcium is pumped back out, so the last frame IS the first frame. Renamed accordingly (user, 2026-09-06). | Keep the step-19 lesson: the crossing is ~0.61 µs against a ~2.7 ms release delay — never animate a leisurely journey across the gap. Particles conserved throughout.                                                                                                                                                                                            |
| **S13** | Journey leg 2 — receptors to the hillock | AMPA opens (EPSP on the local meter) → depolarization pops NMDA's Mg²⁺ plug → NMDA opens, Ca²⁺ enters the spine → the EPSP leaves toward the hillock.                                                                                    | **⚠ One synapse's EPSP (~0.5–1 mV at the soma) does not generate an AP.** The leg ends by handing the EPSP to the whole-cell view, where summation fires the hillock — milestone 1's own lesson, not a new claim. NMDA needs glutamate AND depolarization (coincidence detector); the glycine/D-serine co-agonist is simplified away and the info block says so. |
| **S14** | Synaptic vesicle endocytosis — A DRAWER, BUILT 2026-09-06 | ⚠ RENAMED, and the name is the point (user, 2026-09-06: "the name says clearance and recycling. But what I see is the type of vesicle merge mechanisms"). "Clearance & recycling" covers ~16 mechanisms; this exhibit shows THREE, and every clearance one is S12's job already. What it owns is the FORK a single run cannot play: retrieval as kiss-and-run (~1 s, never opens up), clathrin-mediated (~15 s, basket + dynamin collar) and ultrafast (~5 s, a dent bigger than a bubble, beside the active zone), chosen by the child. Opened over the synapse view, filed beside the SNARE bench. ⚠ Legs "the gap empties" and "the wall's ledger" were built and DELETED: measured, a zoomed, faster copy of the view's own 🔍 active-zone place. | ⚠ The retrieval debate is real and is now SHOWN rather than only declared. Still owed under the wider topic: the vesicle pools and what a burst costs (next), bulk endocytosis, EAAT3 on neurons, and the contrast with transmitters that are destroyed in the cleft (acetylcholinesterase). |
| **S15** | The astrocyte — the synapse's third cell (added 2026-09-01) | An astrocyte process wraps the synapse (the tripartite synapse): its EAAT transporters take up the escaped glutamate the S12 view already shows drifting out of the cleft's ends; glutamine is handed back to the terminal (glutamate–glutamine cycle) to refill vesicles. | Astrocytes clear **most** released glutamate — the neuron's own transporters are the minority route. Uptake is transporter-mediated (3 Na⁺/1 H⁺ in, 1 K⁺ out per glutamate — simplify the stoichiometry and say so). The process should sit where S12's escaped transmitter balls already come to rest, so the two views tell one story. |

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
| **D06**                 | Vesicle life cycle & SNARE machinery                            | synapse                  | Approach (undocked, from the top) → tether → dock → prime (SNAREs half-zippered) → Ca²⁺ on synaptotagmin → full zipper pulls the membranes together → fusion pore → collapse → retrieval → refill → back to the pool. Cast: synaptobrevin (v-SNARE) on the vesicle; syntaxin + SNAP-25 (t-SNARE) on the terminal; Rab-GTP riding the vesicle with a tether (Rab effector) on the wall — badge spent (GDP), Rab released once the SNAREs hold; Munc18 keeping syntaxin folded, Munc13 opening it at docking; complexin clamping the primed rope. *(Extended upstream at the user's direction, 2026-09-03.)* | The four-site Ca²⁺ sensor must be the same sensor the scene draws (Dodge–Rahamimoff's fourth power). The vesicle is a ring of the scene's own bilayer. The one drawn tether stands for the Rab-effector family; when Rab spends its GTP is drawn at docking and declared not-settled. The whole cast is drawn as a mirrored pair — a section through the RING the machinery stands in — with the per-protein count declared unsettled; after fusion the rope is a cis-complex that rides the membrane flow, taken apart on stage by NSF. The recycling pipeline runs to a CLOSED loop (2026-09-04): clathrin coat, NSF, V-ATPase souring, then the transporter's proton→transmitter exchange refills the vesicle — the closing frame is identical to the opening frame.                                                                                                                                                                                                             |
| **D07**                 | AMPA & NMDA structure _(built 2026-09-11, 21c-32 — the receptors and the block; the ARRIVAL half deferred)_ | synapse                  | Clamshell binding domains closing on glutamate; the gate; NMDA's Mg²⁺ plug sitting in the pore; how an AMPA receptor arrives and is held — lateral diffusion in the membrane, then capture at PSD scaffold slots.                                | **⚠ Receptors are not "attracted" through space** — they diffuse in the membrane plane and are caught. NMDA's block is voltage-dependent: the plug leaves only when the membrane depolarizes.                                                                                                                                                                      |
| **D08**                 | Receptor kinetics bench                                         | synapse                  | AMPA vs NMDA current time courses side by side (sub-ms rise/~2 ms decay vs tens-of-ms), and a coincidence-detection demo: transmitter alone, depolarization alone, both together.                                                                | **⚠ Repeated stimulation does not create new NMDA receptors.** NMDA supplies the calcium _trigger_; the _expression_ is new **AMPA** receptors captured at the synapse (P04). NMDA numbers are comparatively stable.                                                                                                                                               |
| **D09**                 | Glutamate vs GABA                                               | synapse (either cast)    | The two molecules side by side — GABA is made _from_ glutamate by one enzyme (GAD) — their ionotropic receptors, and the shared logic: the effect is the receptor's ion, not the molecule's mood.                                                | GABA-A passes Cl⁻; the IPSP follows Cl⁻'s own equilibrium, near rest — inhibition is often _shunting_, not a big downward swing. Never "GABA = calm chemical".                                                                                                                                                                                                     |
| **D10**                 | Benzodiazepine bench                                            | GABA synapse             | Allosteric modulation: the drug binds its own site (α/γ interface), opens nothing alone; with GABA present, opening **frequency** rises.                                                                                                         | **⚠ Frequency, not duration** (duration is barbiturates), and no effect without GABA. X03 guardrail applies: mechanism only, no medical/dosing claims.                                                                                                                                                                                                             |
| **D11**                 | Synapse gallery                                                 | synapse                  | The calyx of Held — a giant terminal engulfing a soma, built for fidelity at high rates in the auditory brainstem — beside axodendritic / axosomatic / axoaxonic contacts, en passant boutons, and electrical synapses (gap junctions).          | Electrical synapses conduct with essentially no delay and (mostly) both ways — the contrast with the chemical delay the child has measured is the point.                                                                                                                                                                                                           |
| **D12**                 | Membrane capacitor _(2026-08-27 curriculum cross-check)_        | membrane                 | The step-8 charge skin, quantified: the membrane as a capacitor — charge parked on its two faces, Q = C·V, and why a vanishing number of ions makes the whole voltage.                                                                           | The count is **derived from the scene's own geometry**, never asserted: ~1 µF/cm² on the declared 20 µm soma gives ≈13 pF, so −72 mV is about six million ions — against a few ×10¹¹ potassium ions inside, roughly one in sixty thousand. Pinned by a test. The ion piles must not visibly change when the voltage does — the step-8 lesson, now with its number. |
| **D13**                 | Patch clamp — how we know _(2026-08-27 curriculum cross-check)_ | membrane                 | A pipette seals onto the membrane and listens to ONE channel: its current is square steps that flicker open/shut; zooming out, the whole-cell current is the sum of thousands. The open probability D04 plots is read off this trace.            | Single-channel currents are picoamps and **step-shaped, never a smooth swell**; the flicker is stochastic and seeded. Methods exhibit — it shows where the app's own numbers come from (measure, never assert, made visible). Qualitative cousin of the V2 voltage-clamp experiment.                                                                               |

### Documented ahead, not yet planned in detail

| ID      | Feature                                                                    | What is shown                                                                                                                                                                                                                                         | Constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D16**                 | Where the resting potential comes from _(added 2026-08-30)_ | dendrite membrane | The resting potential as a WEIGHTED VOTE: each ion's Nernst voltage is a mark on a scale (K⁺, Cl⁻, Na⁺), the membrane settles at the average weighted by how easily each can cross, and the doors in the wall ARE the weights. **The child BUILDS the wall** — drag leak doors from a tray into the membrane, drag them out again — which is D14's grammar applied to this one question. A prominent, voiced reading names the state. | **⚠ Not a capacitor exhibit (that is D12) and not a single-ion equilibrium (that is D11).** The gap it fills is *why this number*. Derived from `nernstMv` + `membraneVoltageFrom` on the app's own declared concentrations; the ordinary wall must land on the app's own `REST_MV`, pinned by test. The proposed "bare membrane, no channels, ions attracted and repelled" was declined: ions cannot cross a bare bilayer, and no arrangement of attraction across a wall produces a resting potential. The pump is deliberately absent from the sum. |
| **D14** | Membrane constructor _(requested 2026-08-27; documented, not implemented)_ | A build-your-own-membrane bench: the kid drags proteins from a tray — K⁺ leak channels, voltage-gated Na⁺/K⁺ channels, ligand-gated channels, the Na⁺/K⁺ pump — and plugs them into a bare bilayer, then watches what the membrane they built can do. | The cast is the app's own proteins, drawn by their existing code (one biology, one drawing); lipids part to admit a protein, as in the membrane view. Gating stays cause-driven — plugging a channel in does not open it; the causes do. The payoff must be **derived, not scripted**: the built membrane's resting voltage comes from `core/voltage.ts` chord conductance over what was actually plugged in (no leak channels → no resting potential — discovered, not told). Kinship: PhET-style construction, the Atom Builder's drag grammar, and the bonding lab's tray. |
| **D15** | Inside the selectivity filter _(2026-08-28)_ | The filter from D03, very close up, with BOTH ions in it at the same time: four rungs of backbone carbonyl oxygens, an ion arriving in each lane wearing its coat of water. Potassium's coat comes off, the oxygens close in and take the water's place, and it goes through; sodium — the smaller ion — keeps its coat, the oxygens fall short, and it drops back. Under each lane a two-bar ledger: what the coat costs and what the filter pays back, at true proportion. | Reached by tapping a magnifier ON the filter in D03, never from a list. Selectivity is taught as an ENERGY EXCHANGE, not a sieve: the shortfall for sodium is DERIVED from D03's selectivity by RT·ln S (~18 kJ/mol) rather than typed in, and is drawn at true scale, so a child sees that a few per cent buys a thousandfold. Two independent routes to one verdict — fit (D03) and ledger (D15) — and a test that they agree. |

| **D17** | Reuptake & the glutamine round-trip _(requested 2026-09-04)_ | synapse | Where D06's released transmitter GOES: the tripartite synapse in section — presynaptic wall above, postsynaptic face below, an ASTROCYTE process wrapping in from the side. The drifting glutamate dots (identity kept, D06's own ink) are caught by EAAT transporters — most on the astrocyte, a few on the neuron — each dot threading a transporter's bore. Inside the astrocyte an enzyme (glutamine synthetase) converts each to GLUTAMINE — a visible change of kind — which is shipped out through one door (SNAT), across, and in through another into the terminal, converted back (glutaminase), and STOCKED: the very pool D06's refill rains from. The transmitter's loop closes, the way D06 closed the membrane's and the proteins'. | **⚠ Astrocytes do most of glutamate's clearance** (~80–90% in cortex — the number declared); direct presynaptic reuptake is minor for glutamate (that headline belongs to GABA/monoamines — said in words). EAAT stoichiometry is settled and shown at least once: 3 Na⁺ + 1 H⁺ in, 1 K⁺ out per glutamate — the Na⁺ gradient (the pump's work) is the fuel. Timescales (uptake ~ms; the glutamine cycle seconds–minutes) squeezed and declared. Dots stand for thousands, transporters for thousands — declared. One door grammar shared with D06 (a crossing threads a bore, never bare membrane). _(Refined 2026-09-04)_ One biology at THREE registers: the whole-synapse framing shows the astrocyte as anatomy and attributes the cloud's decay to it (band register, transporter ticks); the active-zone framing shows only the DRAIN toward its cropped-away rim (no third cell — decided with the user); ⚠ SUPERSEDED 2026-09-04 (user: "we do not need the drawer any more — its content goes into a unified loop on the main view. Delete it"): D17 is NO LONGER A DRAWER. The loop runs unified on the main synapse view at band register, and the machinery becomes a PLACE — a zoom target INSIDE the astrocyte, reached by diving on the cell. Third register kept; the drawer that carried it is gone. See roadmap step 21c. |
| **D18** | Vesicle pools & synaptic depression _(built 2026-09-06)_ | synapse | Why a synapse gets TIRED, and what is holding the spare. Two terminals side by side, both fed by ONE lightning button the child taps at their own rhythm — but a tap means one message to the left terminal and a whole BURST to the right. Each terminal shows its three pools drawn as ranks: the few bubbles docked at the wall (readily releasable), the working crowd behind them (recycling), and a bigger reserve at the back tied down with synapsin ropes. Every message lets out a puff of transmitter into the gap whose size IS the number of vesicles that went; as the burst terminal spends its docked row faster than docking can refill it, its puffs thin to nothing while the gentle one keeps going. Hammer it hard enough and the ropes are CUT — the reserve comes forward and joins the working crowd. | **⚠ Depression is not applied — it falls out of the pools.** There is no depression factor anywhere: a spike lets every DOCKED vesicle take its own seeded chance, so an empty dock releases nothing however hard the terminal is driven. Measured at a 700 ms tap: the burst terminal fails 0.67 of its messages against the gentle one's 0.33, and releases 0.45 per message against 1.00. Counts are a declared stand-in (5 docked / 6 recycling / 9 reserve against a real terminal's couple of hundred) because the SHAPE is what matters and two hundred of anything cannot be counted. Docking (620 ms) is drawn honestly; full recovery of a fused vesicle is compressed to 6.2 s from tens of seconds, and the ORDER of the two — recovery ten times slower than docking — is the part that is true, said in the info block. Mobilisation is a RATE, not a total: a slow tapper never cuts the ropes however long they keep at it. ⚠ And the reserve coming forward makes a hammered terminal hold MORE parked bubbles late in a run than a gentle one — which is real (post-tetanic potentiation's mechanism), and is why the exhibit's claim is measured on the puff, not on the dock. | _(rebuilt for a child 2026-09-06)_ Two reported failures — "not kid friendly enough… animate release, animate membrane fuse, make vesicles be filled with neurotransmitters, make vesicles have visible lipids" and "as a kid who doesn't read, I see no difference between first and second view" — reshaped the exhibit. Bubbles are now **bilayer spheres with their transmitter inside from the first frame**, big enough to see into; a release plays the **SNARE bench's own fusion** (`fusedCentreFor`, `omegaRing`) at the bubble's own parking space, the wall parting where each one merges and nowhere else; the cargo leaves through the **mouth** and drifts off the bottom of the frame. A message arrives as a **flash sweeping down the terminal** — ONE for the left panel, a **train of five** for the right — and the burst's icon is `'⚡'.repeat(BURST_N)`, so headline, button and canvas cannot disagree. A shared button keeps the comparison fair; each panel also has its own. ⚠ **Two conflicts were raised, not resolved silently.** (1) Visible lipids were arithmetically impossible at the old size — a 31 px bubble against a 32.7 px lipid, and an honest scaling would need a 0.38 px head — so the counts were cut 5/6/9 → **3/4/6** and the bubble grew 15.6 → 38.7 px, the user choosing fewer-and-bigger; the head keeps a declared ~3x exaggeration, the COUNT and the structure none. (2) A *bigger* flash for a bigger message was declined as false — spikes are **all-or-none** — and the user took five identical flashes instead. ⚠ And two parameters moved, by measurement: with three docked slots the gentle terminal fell silent on half its messages, so `RELEASE_P` 0.34 → **0.55** (a deliberately reliable synapse, declared) and `RECOVER_MS` 6200 → **3400**; shortening the docking step from 620 to 260 ms changed nothing, which is what proved supply and not docking was the constraint, so docking keeps its well-supported number. _(corrected 2026-09-07)_ Two further failures fixed: the membrane **tore** during a burst — every fusion pushes the wall aside and so pushes the OTHER fusions aside, and the bubbles were drawn at their undisplaced parking spaces (measured: a 59 px hole where no fusion was; one fusion alone was always sound) — and the whole event was too fast to follow. The fusion is now **more than twice as slow** (1.4 s → 3.0 s), which exposed a timing CHAIN, `FUSE_MS < CARGO_MS <= RECOVER_MS`, now derived rather than typed. ⚠ **The slowdown was paid for out of the drawing, not the biology.** A fusion holds its parking space, so a slower one starved the terminal; the sweep's cheapest fix was raising release probability to 0.65, which was declined as protecting the demonstration. Instead the space now frees itself at 0.85 of the fusion (real fusion clears its site in ~1 ms, so holding it for the whole animation was an artifact — the geometry dates the clearance at p = 0.812, and a guard measures it) and the docked row went 3 → **4** (more faithful: a real RRP is 5–10; costs no bubble size). Those paid well enough that `RELEASE_P` came **down** 0.55 → **0.50**. Measured after, at a one-a-second tap: gentle fails 0.21 against the burst's 0.74. _(lipids unified 2026-09-07)_ The wall and the bubbles were drawn with **different molecules** — a lipid's shape is `halfMem/headR`, and the wall's ratio was 5.0 against the bubbles' 2.5. Now one molecule for the whole panel (the app's own lipid at 0.7 scale, ratio 5.0, wall and bubbles alike). This exposed a latent fault in the shared code: the wall/ring samplers pinned their spacing to the default lipid, so no caller could pave with another — the packing rule moved to `bilayer.ts` as `lipidSpacing(geom)` and every sampler now takes it, including the resting-ring fast path, where a bubble's molecules had been visibly closing up the instant it began to merge. _(teleporting fixed 2026-09-07)_ Bubbles moved by jumping — measured at **307 px in one frame**, from four causes: a bubble's place in a pool came from its position in an array (so one departure renumbered and jumped the whole crowd); the wall **snapped back 108.7 px** the instant a merge finished; a docked bubble did not ride the wall it sits on; and easing everything made it LAG that wall instead. Now: vesicles carry a `rank` and the crowd **closes ranks** (the one behind shuffles forward); a merged bubble keeps the wall open and it relaxes over the recovery, making retrieval visible; and the two kinds of motion are told apart — changing place is eased by a critically damped spring, being carried by the membrane is rigid. Worst movement after: **13 px** in a 60 fps frame. _(made legible 2026-09-07)_ Reported unreadable — "vesicles are all the time moving around, I am not able to track which are gone" and "I don't understand what is that yellow rope". Measured: something moving in **100% of frames**, a docked bubble shoved 336 px on a 489 px panel, 3–4 bubbles pushed off the panel. Both causes were the previous round's own fixes. Now: **the wall does not slide** — it simply does not draw its own molecules where a merging bubble's membrane has taken over (conserving material inside the frame is a SNARE-bench register question; here the real membrane runs far beyond the window); **the crowd keeps its places** so a departure leaves a countable EMPTY place instead of shuffling everyone; the four **parking spaces are marked** on the wall so an empty one reads; and the ropes are tied to a drawn **actin scaffold** instead of to an invisible point. After: travel 880 → 401 px/s, bubbles off the panel 3–4 → 0, and zero frames of anything moving with nowhere to be going. ⚠ _(conclusion made visible 2026-09-07)_ Asked what the comparison was meant to show, the user read it as "no matter how intense… it manages to pass down the signal" — **the inverse of the exhibit's point**. The model was right (190 messages → 40 vesicles, 84% releasing nothing) but the failures had no ink: a failed message was a flash arriving and nothing happening, which reads as nothing to look at. **The gap now has its far side** — the receiving cell's membrane at the foot of the panel, lit by exactly how much transmitter reaches it, so a failure is a flash arriving and the far side staying DARK. Scaled against the whole parked row (0.25/0.5/0.75/1.0 for one to four bubbles, not saturating at one) and timed in absolute ms so the answer peaks 1.5 s after its message rather than 4.4 s. Answers tap by tap now read: gentle `0.25 0.5 0.25 0.25…` steady; burst `0.75 0.25 0 0.75 0.25 0…` — **five times the shouting does not get five times across.** _(gauge, receptors, debounce, full height 2026-09-07)_ A half-turn **gauge** set into each receiving cell — track, passed arc in a radial gradient, animated hand, a named threshold line and sparks past it — reading the transmitter actually on the receptors. Threshold measured, not picked: peaks fall into 0.25+ (a bubble arrived) and ≤0.09 (a dribble), so the line sits at 0.2. Two **glutamate receptors** (`drawLigandChannel`, the traced ligand-gated channel, opening by how much arrived) set into the far membrane with the lipids parting round them, and an **ion soup** of sodium and calcium adrift in the cleft. Taps **debounced** (120 ms, and `tapQueue` caps what is owed at one tap's worth) after clicking fast left signals firing long after. Canvas height 626 → **668** by counting the drawer's real chrome. ⚠ **Reported finding:** per tap both terminals clear the threshold about equally (11/14 vs 10/14), and at a higher line the burst clears it MORE — five messages 45 ms apart merge into one answer, so within-burst depression cannot be resolved by eye at a physiological rate. The honest comparison is COST (one flash vs five for the same answer), not failure. ⚠ _(rebuilt simple 2026-09-07)_ "Less busy and more quantifiable for a kid." **Five bubbles now, not thirteen** — 3 parked + 2 in storage, two ranks not five, each **twice the size** — and each stands for a large group, so the five are the whole pool near this patch of wall. Ropes and scaffold dropped. The dial moved to an opaque plate in the corner; the picture lifted (wall 0.80 → 0.55 of the frame). ⚠ **Two science violations raised and fixed:** the per-vesicle coin flip became wrong once a bubble stood for hundreds (averaging gives a steady share, not a gamble) so a message now spends exactly ONE parked bubble; and "nothing left" had to stay temporary. ⚠ **And one impossibility:** non-overlapping messages and in-tap exhaustion are arithmetically exclusive (a space frees mid-fusion and storage refills it at once — simulated `1,1,1,1,1`). Put to the user with the numbers; the running-out moved BETWEEN taps, which is starker: tap 1 `1 1 1 1 1` leaves the terminal visibly empty, tap 2 `0 0 0 0 1`, while the gentle side keeps working. ⚠ _(hammer-proofed 2026-09-07)_ The user spotted that the comparison collapsed under continuous tapping — measured, from a tap every 800 ms down the two sides were **identical** (32 messages, 20 sparks, 0.67/s, both), because both were throttled by the same per-message spacing. **A tap now TRIGGERS a pattern** rather than injecting messages, and a terminal already firing one or still resting ignores it: gentle = 1 message then 1.6 s quiet; strong = 5 messages 170 ms apart then a 4.3 s rest. Simulated at every tap speed from 3 s to 150 ms the figures do not move — gentle **100%** of messages through, strong **51%** (`***..**...***..`). The burst being real again brings the running-out back inside one tap (`1 1 1 0 0`, then `1 1 0 0 0` and empty), at the price of up to three merges at once. Also: the dial is **colour-coded** (slate below the line, yellow and sparking past it), the 'signal received' label is gone, the ion soup jiggles in place instead of drifting, and the answer glows **inside the receiving cell** rather than in the cleft. ⚠ _(one terminal 2026-09-08)_ User testing dissolved the two-panel design: "kids would press the fire button continuously… that's what the kid already does". If the child hammers, the CHILD IS THE TRAIN — so a stimulus difference between panels is not merely redundant but **invisible**, since a child cannot see that one panel is doing something their own finger is not. Now **one terminal, full width**, and the child's own tapping is the variable — the real experiment for depression (one synapse, two rates). Measured: press every 1200 ms and every message gets through for ever (`********`); press faster and it runs out (`*****.`), the first dead message always being **#6** — one more than the five bubbles on screen, at every speed. So a child can COUNT the bubbles and predict the failure. A `TAP_REST_MS` refractory (real, 250 ms) keeps hammering from making the terminal fire faster than about four a second. The burst, the patterns and the second panel are gone. _(refilling shown 2026-09-08)_ A retrieved bubble used to reappear fully stocked, as if the terminal got its transmitter for nothing. It now comes back **empty** and refills over 520 ms, its cargo balls appearing **one after another** so the reading is a count reaching five — the same event VGLUT performs molecule by molecule in the vesicles-and-SNARE bench, at a coarser register. An empty bubble cannot be parked (real, and arranged never to delay anything since `FILL_MS` < `REDOCK_MS`, so the tuned threshold does not move). ⚠ _(born empty 2026-09-08)_ Filling began on the frame a bubble arrived, so the first ball was a third of the way in before the emptiness could be seen — the refilling was implemented and invisible. A bubble now sits **visibly empty for 600 ms** while it travels to its place, then fills over 400 ms. This makes **refilling the slow step of coming back** (delay + fill = 1000 ms against a 620 ms parking clock), so a returning bubble waits on its transmitter rather than a timer — the honest order. Sustainable rate 1.04 → 0.96 messages/s; every measured property of the experiment holds, first dead message still #6. _(grey block fixed 2026-09-09)_ The docking-site mark is a tint painted UNDER the wall's molecules so it reads as a denser stretch of membrane — but during a merge the wall gives up its molecules across that stretch, leaving the tint bare: a grey block where the bubble went in. Measured: at half a merge the wall gives up 143 px either side against a 58 px mark, with zero molecules left across it. Fixed at the meaning — a space with a bubble merging out of it is not an EMPTY space, so it is not marked as one, and the mark returns in the same frame as the wall's molecules. ⚠ _(membrane continuous, bubbles shaped out of it 2026-09-09)_ Measured: there was no tear — every gap away from a fusion was the wall's own 3–4 px spacing. The gaps were the **mouth**, geometrically exact (45 px at a quarter merge, **120 px at the half**), which reads as an opening at the SNARE bench where one vesicle fills the frame, but as a BREAK in a long straight wall. The opening is now capped at a **pore** just wide enough for the transmitter (widest gap anywhere: 25.5 px), with the wall carrying on across — and the bubble drawn as its **dome only**, since `omegaRing` unrolls the sunken part along the wall and both would be two deep (66 of 85 molecules at ⅘ merge). And a returning bubble is **shaped out of the wall**: the last 700 ms of its time away is a dimple that deepens, necks and pinches off — `fusedCentreFor` run backwards, one drawing both ways — **beside** the parking spaces, where retrieval really happens and where it cannot collide with a freshly parked bubble.

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
