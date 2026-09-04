import { useEffect, useMemo, useRef, useState } from 'react'
import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Layer, Line, Rect, Shape, Stage } from 'react-konva'
import type { NeuronPartId } from '../core/neuron'
import {
  AXON_END,
  AXON_FLAT,
  AXON_VIEW_SCALE,
  SYNAPSE_VIEW_SCALE,
  arrivalAt,
  arrivalSpan,
  AXON_W,
  DRAWN_AXON_UM,
  BOUTON_R,
  DENDRITE_TRUNKS,
  INPUTS,
  MARKER_R,
  SOMA,
  SOMA_R,
  STAGE_H,
  STAGE_W,
  TERMINALS,
  ZOOM_TARGETS,
  cameraDuration,
  clamp01,
} from './layout'
import { drawScene, nativeCtx } from './drawScene'
import { FIT, cameraFor, viewRect, type Camera } from './camera'
import {
  TAIL_HASTE,
  VIEW_MS,
  drawRace,
  drawRibbon,
  raceDurationMs,
  raceTailStartU,
  patchAtX,
  ribbonGeometry,
  screenDurationMs,
  viewFibre,
} from './axonRibbon'
import { fibreRun, tailStartU } from '../core/fibre'
import { AXON_DIAMETER_UM } from '../core/membrane'
import { IDLE, chainStateAt, runDuration } from './chain'
import { patchDoors } from './patchDoors'
import { goTo } from '../state/contentsNav'
import { useLeakyStore } from '../state/leakyStore'
import { useSynapseStore } from '../state/synapseStore'
import {
  drawSynapse,
  synapseLabels,
  synapseGeometry,
  synapseClock,
  synapseEvents,
  screenOfModel,
  SYNAPSE_SCREEN_MS,
  SYNAPSE_END_HOLD_MS,
} from './synapseScene'
import { useSnareStore } from '../state/snareStore'
import { synapseRun } from '../core/synapse'
import { cleftRun } from '../core/cleft'
import { drawLeaky, leakyLabels } from './leakyScene'
import { speakAloud } from '../ui/SpeakButton'
import { RACE_MS } from '../core/leaky'
import { ResetButton } from '../ui/ResetButton'
import { useNeuronStore } from '../state/neuronStore'
import { inColour, useIonStore } from '../state/ionStore'
import { useApStore } from '../state/apStore'
import { useDemoStore } from '../state/demoStore'
import { useAxonStore } from '../state/axonStore'
import { STIMULI } from '../core/scenarios'
import { LEAD_MS } from '../state/axonStore'
import {
  AP_MS,
  SPOTLIGHT_MIN,
  apRestMv,
  apStateAt,
  apTrace,
  channelShare,
  spotlight,
  type ApState,
} from '../core/actionPotential'
import { ION_KINDS, type IonKind } from '../core/ions'
import {
  fireActionPotential,
  pauseAp,
  resumeAp,
  scrubAp,
  toggleSpotlight,
} from '../state/experiment'
import { AP_REAL_MS } from '../core/actionPotential'
import { STEP_NAMES, advance, apBar, apSteps, gateFlashAt, gateMoments, stepAt } from '../core/apSteps'
import { TransportBar } from '../ui/Timeline'
import { useMembraneStore } from '../state/membraneStore'
import { ionCloud } from './ions'
import { membraneProteins } from './proteins'
import {
  CHANNELS,
  CHANNEL_IDS,
  TRANSMITTER_MS,
  gateOf,
  type GateEnv,
} from '../core/channels'
import { VM_SETTLE_MS, membraneVoltageMv } from '../core/voltage'

// Invisible-but-clickable: Konva's hit canvas paints shapes with an internal
// colour key, so a fully transparent stroke/fill still registers hits.
const HIT = 'rgba(0, 0, 0, 0)'

/** What the axon view can show, all three named on screen at once. */
const AXON_MODES = [
  {
    mode: 'bare' as const,
    icon: '〰️',
    label: 'Bare',
    note: 'A bare axon: channels the whole length of it, rebuilding the signal at every patch',
  },
  {
    mode: 'myelin' as const,
    icon: '🧈',
    label: 'Myelinated',
    note: 'The same axon wrapped in fat, with channels only in the gaps between the sleeves',
  },
  {
    mode: 'race' as const,
    icon: '🏁',
    label: 'Race',
    note: 'Both at once, the same push down each, so the speed difference is a comparison rather than a claim',
  },
] as const

const easeInOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - (1 - t) * (1 - t) * 2

/** Fraction of the journey spent moving sideways.
 *
 *  The rule is PAN WHILE WIDE, because a scene pixel of sideways error is
 *  invisible at ×1 and half a screen at ×2400. Which end of the journey is wide
 *  depends on which way it is going, and for a long time this only handled one of
 *  them: the pan always happened in the FIRST portion. Zooming in that is right —
 *  wide at the start, so pan, then plunge. Zooming OUT it is exactly backwards: it
 *  swept sideways while still at ×3000, which threw the very membrane being left
 *  behind off the canvas within a few frames, and what should have been a
 *  magnification coming down looked like a lurch followed by a different scene.
 *  Now it climbs first and pans once there is room. */
const PAN_PORTION = 0.55

/** Scale interpolates GEOMETRICALLY (×2 per step, not +2), so crossing three
 *  orders of magnitude looks like a steady plunge instead of an instant jump
 *  followed by a crawl. */
/** Where in the move the turn happens, as a fraction. LATE when diving in — the
 *  mirror of the pan: spinning the whole neuron while it is still recognisable is
 *  disorienting, whereas once the surroundings are gone the same turn reads only
 *  as the membrane levelling out. Pulling out, it has to be EARLY for the same
 *  reason: get the rotation done while there is nothing recognisable to spin. */
const TURN_FROM = 0.5

function interpolate(from: Camera, to: Camera, t: number): Camera {
  const scale = from.scale * Math.pow(to.scale / from.scale, t)
  // Pan while wide: at the start when diving in, at the end when pulling out.
  const out = to.scale < from.scale
  const tPan = out
    ? clamp01((t - (1 - PAN_PORTION)) / PAN_PORTION)
    : clamp01(t / PAN_PORTION)
  const tTurn = easeInOut(
    out ? clamp01(t / (1 - TURN_FROM)) : clamp01((t - TURN_FROM) / (1 - TURN_FROM)),
  )
  return {
    center: {
      x: from.center.x + (to.center.x - from.center.x) * tPan,
      y: from.center.y + (to.center.y - from.center.y) * tPan,
    },
    // The drop follows the PAN, not the plunge: it is a sideways move like any
    // other, and arriving with it half-applied would put the axon somewhere the
    // view is not expecting it.
    drop: from.drop + (to.drop - from.drop) * tPan,
    scale,
    angle: from.angle + (to.angle - from.angle) * tTurn,
  }
}

/** Visible rectangle in scene coordinates — used to cull what cannot be seen
 *  and to place screen-anchored chrome. */
/** The visible scene region, as an axis-aligned box that CONTAINS it. Under
 *  rotation the visible region is a tilted rectangle; a bounding box is the right
 *  answer for its two jobs — culling, which must never wrongly exclude, and
 *  sizing the backdrop, which is clipped anyway. Screen-space chrome must not use
 *  this: the screen is STAGE_W by STAGE_H whatever the camera is doing. */
// Note it ignores `drop`. The only camera with a drop is the propagation view's,
// and by the time that drop is fully applied the scene layer's opacity is zero —
// so a few scene pixels of error in what gets culled cannot show. Anything that
// gives another target a drop has to fix this too.
export function NeuronStage() {
  const layerRef = useRef<Konva.Layer>(null)
  const axonLayerRef = useRef<Konva.Layer>(null)
  const passiveLayerRef = useRef<Konva.Layer>(null)
  const synapseLayerRef = useRef<Konva.Layer>(null)
  /** How far the propagation view has taken over from the scene, 0→1. */
  const axonFadeRef = useRef(0)
  // D05's own view, gated exactly like the axon's — see the note on its layer.
  const passiveFadeRef = useRef(0)
  // S12's own view, gated the same way — see the note on its layer.
  const synapseFadeRef = useRef(0)
  // What each view of its own is ACTUALLY showing at this instant: how much the
  // camera wants it, times how near the camera has got to its magnification.
  //
  // Kept in refs because the scene layer's opacity and the views' own drawing both
  // have to use the same number. They did not, and that was the visible bug: the
  // scene faded out on the raw want in a quarter of a second while the view coming
  // in was still invisible, so flying out of a membrane patch went briefly to
  // nothing instead of showing the membrane shrink.
  const axonShownRef = useRef(0)
  const passiveShownRef = useRef(0)
  const synapseShownRef = useRef(0)
  const selected = useNeuronStore((s) => s.selected)
  const run = useNeuronStore((s) => s.run)
  const zoom = useNeuronStore((s) => s.zoom)
  const selectPart = useNeuronStore((s) => s.selectPart)
  const clearSelection = useNeuronStore((s) => s.clearSelection)
  const fire = useNeuronStore((s) => s.fire)
  const setPhase = useNeuronStore((s) => s.setPhase)
  const zoomTo = useNeuronStore((s) => s.zoomTo)
  const zoomOut = useNeuronStore((s) => s.zoomOut)
  const leakyStartedMs = useLeakyStore((s) => s.startedMs)
  const synU = useSynapseStore((s) => s.u)
  const synPlaying = useSynapseStore((s) => s.playing)
  const leakyRace = useLeakyStore((s) => s.race)
  const leakyReset = useLeakyStore((s) => s.reset)

  const apU = useApStore((s) => s.u)
  const apPlaying = useApStore((s) => s.playing)
  const spotlightOn = useApStore((s) => s.spotlight)
  const demo = useDemoStore((s) => s.demo)
  const beatKey = useApStore((st) => st.step)
  const stimulusId = useApStore((st) => st.stimulus)
  const push = STIMULI[stimulusId].amplitude
  // N22: a second push, some milliseconds after the first. Every drawing at this
  // patch reads the trajectory, so handing them a paired one puts both spikes on
  // the trace, in the gates and in the ion crowds with no new drawing at all —
  // and if the membrane refuses the second push, they all show the refusal.
  const spiking = apU !== null
  // Both kinds of emphasis answer to one switch, so "focus" means one thing.
  const focusing = spiking && spotlightOn
  const showSpike = demo === 'spike'
  // A spike is only meaningful where its consequences are on screen: the
  // voltage meter, the gates and the two crowds are all inside a membrane patch.
  const atMembrane = ZOOM_TARGETS.find((t) => t.id === zoom)?.frame !== undefined
  // The propagation view (N19). It is a zoom target like any other — the camera
  // really flies to this axon — and what it arrives at is drawn on a layer of its
  // own, untransformed, because a ruler in millimetres and a graph of voltage
  // against distance are instruments rather than scene geometry.
  const atAxon = zoom === 'axon-signal'
  /** ⚠ D05 IS A PLACE (user, 2026-08-31: "let's follow 'Axonal conduction and
   *  myelin' pattern"). Same machinery as the axon view above it, one target
   *  further down the same cable. */
  const atPassive = zoom === 'axon-passive'
  /** S12 leg 1 — the synapse, arrival to binding. A place like the axon views,
   *  with its own layer and its own arrival gate. */
  // The synapse view serves TWO places: the whole synapse and its active
  // zone, four times deeper — the same run, watched closer.
  const atSynapse = zoom === 'outgoing-synapse' || zoom === 'active-zone'
  const axonU = useAxonStore((s) => s.u)
  const axonLead = useAxonStore((s) => s.lead)
  const axonPlaying = useAxonStore((s) => s.playing)
  const axonPatch = useAxonStore((s) => s.patch)
  const axonMode = useAxonStore((s) => s.mode)
  const setAxonMode = useAxonStore((s) => s.setMode)
  const racing = axonMode === 'race'
  const axonStimulus = useAxonStore((s) => s.stimulus)
  const fireAxon = useAxonStore((s) => s.fire)
  const setAxonPatch = useAxonStore((s) => s.setPatch)
  // Running, in the sense the transport cares about: the ▶/⏸ pair belongs to
  // something that has somewhere left to go — the lead-in coming in, or a run
  // part way through. A finished run is not a state to be dismissed; the cause
  // button comes back, exactly as it does at the membrane patch.
  const propagating = axonLead !== null && !(axonU !== null && axonU >= 1)
  const [hovered, setHovered] = useState<NeuronPartId | null>(null)
  const [hoveredInput, setHoveredInput] = useState<number | null>(null)
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null)
  // The ion crowd is laid out only when the counts change, never per frame;
  // the jiggle is a pure function of the clock (see stage/ions.ts).
  const counts = useIonStore((s) => s.counts)
  const focused = useIonStore((s) => s.focused)
  const pumpOn = useMembraneStore((s) => s.pumpOn)
  const leaksOn = useMembraneStore((s) => s.leaksOn)

  const transmitterPulse = useMembraneStore((s) => s.transmitterPulse)
  const publishAp = useApStore((s) => s.publish)
  // Protein placement never changes, so it is computed once.
  const proteins = useMemo(() => membraneProteins(), [])
  const ions = useMemo(
    () => ({ outside: ionCloud(counts, 'outside'), inside: ionCloud(counts, 'inside') }),
    [counts],
  )

  const animRef = useRef({ chain: IDLE, camera: FIT, timeMs: 0, vm: 0 })
  const runStartRef = useRef<number | null>(null)
  const cameraRef = useRef({
    from: FIT,
    to: FIT,
    startedAt: null as number | null,
    duration: 1,
  })
  const viewRef = useRef({ selected, hovered, hoveredInput, hoveredMarker, run })
  viewRef.current = { selected, hovered, hoveredInput, hoveredMarker, run }
  // The scene function reads refs only, so it can never render a stale crowd.
  const ionsRef = useRef(ions)
  ionsRef.current = ions
  // The canvas wants "draw this species in colour?", which is a question about
  // the whole focus set, not about one species.
  const inColourNow = useMemo(
    () =>
      ION_KINDS.reduce(
        (acc, kind) => {
          acc[kind] = inColour(focused, kind, focusing)
          return acc
        },
        {} as Record<IonKind, boolean>,
      ),
    [focused, focusing],
  )
  const colourRef = useRef(inColourNow)
  colourRef.current = inColourNow
  const trace = useMemo(
    () => apTrace(counts, leaksOn, 96, push),
    [counts, leaksOn, push],
  )
  const traceRef = useRef(trace)
  traceRef.current = trace
  // The staged moments, and how long playback holds on each. Measured off the
  // model, so a caption cannot promise something the drawing is not doing.
  const steps = useMemo(() => apSteps(counts, leaksOn, push), [counts, leaksOn, push])
  // The timeline tool's event dots (user, 2026-09-01), placed through the
  // spike's own dwell-weighted bar (user, 2026-09-02: "the labels overlap
  // much") — the clustered middle moments get the width playback actually
  // spends on them, so their names have room.
  const apTimelineBar = useMemo(() => apBar(steps, AP_MS), [steps])
  const apPoints = useMemo(
    () =>
      steps.map((s) => ({
        id: s.key,
        label: STEP_NAMES[s.key],
        u: apTimelineBar.ofU(s.at),
        note: s.title,
      })),
    [steps, apTimelineBar],
  )
  const stepsRef = useRef(steps)
  stepsRef.current = steps
  // The instants the gates change, for the flash. A function of the gradients
  // now that the spike is integrated from them.
  const moments = useMemo(
    () => gateMoments(counts, leaksOn, push),
    [counts, leaksOn, push],
  )
  const momentsRef = useRef(moments)
  momentsRef.current = moments
  const beat = beatKey === null ? null : steps.find((b) => b.key === beatKey) ?? null
  const beatNumber = beat ? steps.indexOf(beat) + 1 : 0
  const beatCount = steps.length
  /** Milliseconds still to hold at the moment we stopped on. */
  const dwellRef = useRef(0)
  /** How recently each voltage-gated gate changed, as a fading 1→0. */
  const flashRef = useRef<Record<string, number> | null>(null)
  /** Last frame's position, so a spike starting can be noticed. */
  const prevURef = useRef<number | null>(null)
  const membraneRef = useRef({ pumpOn, leaksOn })
  membraneRef.current = { pumpOn, leaksOn }

  const pushRef = useRef(push)
  pushRef.current = push
  // The transmitter still runs off the clock — it is a lifetime, not a position.
  const transmitterAtRef = useRef<number | null>(null)
  const countsRef = useRef(counts)
  countsRef.current = counts
  const gateEnvRef = useRef<GateEnv>({ ap: null, transmitter: false })
  // Live spike state, mirrored to the store only when a reading the panels show
  // has actually changed — the alternative is re-rendering four rows 60 times a
  // second to show the same numbers.
  const apRef = useRef<ApState | null>(null)
  // Which protein is carrying the current, as a brightness. Recomputed per frame
  // because the answer genuinely changes through a spike.
  const emphasisRef = useRef<Record<string, number> | null>(null)
  const focusingRef = useRef(focusing)
  focusingRef.current = focusing
  const apShownRef = useRef<string>('')

  const phaseRef = useRef(useNeuronStore.getState().phase)

  // One cable integration, memoised on everything it depends on. A hundred
  // thousand patch-steps is a tenth of a second, once, and then every frame and
  // every sentence in the panel is a lookup into it.
  // One fibre for the two single-axon modes; both of them, on one clock, for the
  // race. Every run is memoised on what it depends on, and the race's pair is the
  // same two runs the describer quotes, so the picture and the numbers cannot be
  // describing different races.
  const cable = useMemo(
    () =>
      fibreRun(
        counts,
        leaksOn,
        STIMULI[axonStimulus].amplitude,
        viewFibre(axonMode === 'myelin', racing),
      ),
    [counts, leaksOn, axonStimulus, axonMode, racing],
  )
  const raceRuns = useMemo(
    () =>
      racing
        ? ([
            fibreRun(counts, leaksOn, STIMULI[axonStimulus].amplitude, viewFibre(false, true)),
            fibreRun(counts, leaksOn, STIMULI[axonStimulus].amplitude, viewFibre(true, true)),
          ] as const)
        : null,
    [racing, counts, leaksOn, axonStimulus],
  )
  const axonRef = useRef({ cable, raceRuns, u: axonU, patch: axonPatch, at: atAxon })
  axonRef.current = { cable, raceRuns, u: axonU, patch: axonPatch, at: atAxon }

  // ⚠ THE RACE'S CLOCK IS ITS OWN EVENT'S, not this component's. Only when the
  // race started goes through the store; where it has got to is read off the
  // frame's own clock, so a re-render cannot restart it.
  const passiveRef = useRef({ at: atPassive, startedMs: leakyStartedMs })
  passiveRef.current = { at: atPassive, startedMs: leakyStartedMs }

  // ⚠ THE MODELS ARE MEMOISED BY THEIR INPUTS, not recomputed per frame — both
  // `synapseRun` and `cleftRun` cache on the counts they were given, so this is
  // a lookup once the gradients stop changing.
  const synRun = useMemo(() => synapseRun(counts, leaksOn), [counts, leaksOn])
  const synCleft = useMemo(() => cleftRun(synRun), [synRun])
  // The timeline tool's event dots for S12 (user, 2026-09-01): the run's own
  // dated moments, mapped through the legged clock's INVERSE so each dot sits
  // where the scrubber will actually be when its event happens on screen.
  const synPoints = useMemo(
    () =>
      synapseEvents(synRun, synCleft).map((e) => ({
        id: e.id,
        label: e.label,
        u: screenOfModel(e.ms / synRun.windowMs),
        note: e.note,
      })),
    [synRun, synCleft],
  )
  const synapseRef = useRef({ at: atSynapse, run: synRun, cleft: synCleft, u: synU, playing: synPlaying })
  synapseRef.current = { at: atSynapse, run: synRun, cleft: synCleft, u: synU, playing: synPlaying }
  /** Stage-clock stamp of the moment the run PLAYED to its end — the
   *  auto-reset's timer, never set by scrubbing. */
  const synEndAtRef = useRef<number | null>(null)
  /** Where the active zone sits in the synapse view's own frame — the anchor
   *  the deeper place dives toward. Computed once: geometry is static. */
  const zoneAnchorRef = useRef((() => {
    const g0 = synapseGeometry()
    // Slightly BELOW the foot (user, 2026-09-01: "camera should go down so
    // the postsynaptic channels are fully in view").
    return { x: g0.foot.x, y: g0.foot.y + 8 }
  })())
  /** How much of the synapse view's chrome (labels, lenses, captions) is
   *  shown — it dissolves on the dive to the active zone. */
  const synapseChromeRef = useRef(1)
  /** The ambient thermal clock, advanced on the stage's own frame time —
   *  thermal motion never pauses, whatever the run's legs are doing. Scaled so
   *  the wobble's sines turn at a gentle real-time pace. */
  const jiggleRef = useRef(0)

  // Warmed while the camera is still somewhere else. The integration is nothing
  // once and free forever, but a tenth of a second spent inside a render is a
  // stutter in the middle of a camera flight, which is exactly when it would be
  // noticed. If the browser never gets round to it nothing is lost but the
  // stutter comes back.
  useEffect(() => {
    if (atAxon || typeof window.requestIdleCallback !== 'function') return
    const id = window.requestIdleCallback(
      () =>
        fibreRun(
          counts,
          leaksOn,
          STIMULI[axonStimulus].amplitude,
          viewFibre(axonMode === 'myelin', racing),
        ),
      { timeout: 4000 },
    )
    return () => window.cancelIdleCallback(id)
  }, [atAxon, counts, leaksOn, axonStimulus, axonMode, racing])

  // Leaving puts the axon back at rest: a run left half-finished behind a camera
  // that has flown away would be waiting mid-spike for nobody.
  useEffect(() => {
    if (!atAxon) useAxonStore.getState().stop()
  }, [atAxon])

  // ⚠ LEAVING A PLACE PUTS ITS RUN AWAY. A race left running behind a camera
  // that has flown somewhere else is a clock belonging to nothing.
  useEffect(() => {
    if (!atPassive) useLeakyStore.getState().reset()
  }, [atPassive])

  useEffect(() => {
    if (!atSynapse) useSynapseStore.getState().reset()
  }, [atSynapse])

  const synRunning = synU !== null
  const synShownU = synU ?? 0

  // One animation loop for the whole stage.
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const anim = new Konva.Animation((frame) => {
      if (!frame) return
      const now = frame.time
      animRef.current.timeMs = now

      const active = viewRef.current.run
      if (!active) {
        animRef.current.chain = IDLE
      } else {
        if (runStartRef.current === null) runStartRef.current = now
        const elapsed = now - runStartRef.current
        animRef.current.chain = chainStateAt(elapsed, active.inputs.length)
        // React only hears about discrete phase changes.
        const phase = animRef.current.chain.phase
        if (phase !== phaseRef.current) {
          phaseRef.current = phase
          setPhase(phase)
        }
      }

      if (transmitterAtRef.current === null && transmitterPulse > 0) {
        transmitterAtRef.current = now
      }

      // The spike is a POSITION, not a clock reading: the loop advances it while
      // it is playing, and leaves it alone while it is paused or being dragged.
      // Everything else — the gates, the voltage, the aura, the trace marker —
      // reads off that one number.
      let ap: ApState | null = null
      const { u, playing } = useApStore.getState()
      // A fresh spike opens with a pause on "resting, nothing is happening", so
      // there is a before picture to compare against. Applied here rather than by
      // crossing it, because the first moment sits AT the start and so is never
      // crossed.
      if (prevURef.current === null && u === 0) {
        dwellRef.current = stepsRef.current[0].dwellMs
      }
      prevURef.current = u
      if (u !== null) {
        let next = u
        let over = false
        if (playing && frame.timeDiff > 0) {
          const tick = advance(
            stepsRef.current,
            u,
            dwellRef.current,
            frame.timeDiff,
            AP_MS,
          )
          dwellRef.current = tick.dwellLeft
          next = tick.u
          over = tick.over
          // Over means over: back to rest, and the button offers another. There
          // is no finished state sitting there waiting to be dismissed.
          if (over) useApStore.getState().stop()
          else if (next !== u) useApStore.setState({ u: next })
        }
        if (!over) {
          ap = apStateAt(
            next * AP_MS,
            countsRef.current,
            membraneRef.current.leaksOn,
            pushRef.current,
          )
        }
      }
      apRef.current = ap
      // Derived from the position, not by watching for a change: the moments a
      // gate opens and shuts are known, so "how near are we to one" is a
      // function of u like everything else — and it therefore survives scrubbing
      // backwards, which change-detection would not.
      // A gate that has just changed gets an expanding, fading ring — and NOT
      // while playback is holding on a beat.
      //
      // The two were on a collision course by construction. The ring is a pure
      // function of the position, fading over the 5 % of the run after the change;
      // the beats stop the position EXACTLY at each change, because those are the
      // moments worth stopping on. So the ring froze at full strength and its
      // tightest radius for the whole dwell — a hard static circle sitting on the
      // channel for a second or more, which is not what a flash is and was read as
      // a bug, correctly.
      //
      // Suppressed while held rather than made time-based: the ring stays a pure
      // function of position, so scrubbing still reproduces exactly, and it plays
      // properly the moment the position starts moving again.
      const held = dwellRef.current > 0
      flashRef.current =
        ap && !held
          ? // ⚠ ON OPENING ONLY (user, 2026-08-30: "remove flash before the
            // channel closes"). The decision moved into `gateFlashAt` so it
            // can be tested — inline in a component, nothing could reach it.
            gateFlashAt(ap.u, momentsRef.current)
          : null

      // Which channels are open, then where the voltage is heading. Channel
      // TYPES rather than protein instances: there is one cell, so one voltage,
      // however many patches happen to be drawn.
      const env: GateEnv = {
        ap: ap && { na: ap.naOpen, k: ap.kOpen },
        transmitter:
          transmitterAtRef.current !== null && now - transmitterAtRef.current < TRANSMITTER_MS,
      }
      gateEnvRef.current = env
      // Which protein is carrying the current, as a brightness — derived, so the
      // spotlight hands over from sodium's channel to potassium's to the plain
      // leak in the same order the narration describes.
      if (ap && focusingRef.current) {
        const share = channelShare(ap, membraneRef.current.leaksOn, env.transmitter)
        const flash = flashRef.current
        emphasisRef.current = {
          // The pump has no share of the current at all — it is not in the
          // voltage equation — so during a spike it is always context.
          pump: SPOTLIGHT_MIN,
          ...Object.fromEntries(
            CHANNEL_IDS.map((id) => [
              id,
              // Lit for EITHER of two reasons: it is carrying the current, or it
              // has just changed. Share alone put the picture at odds with the
              // caption — at the moment potassium's door opens, sodium is still
              // carrying most of the current, so the beat announcing potassium
              // was spotlighting sodium. Both facts are true and both deserve
              // the light; a moment later the flash fades and the share takes
              // over again, which itself says something worth seeing.
              Math.max(spotlight(share[id]), flash?.[id] ?? 0),
            ]),
          ),
        }
      } else {
        emphasisRef.current = null
      }

      // A cheap identity for "has anything the panels display changed".
      const coarse = emphasisRef.current
        ? Object.fromEntries(
            Object.entries(emphasisRef.current).map(([k, v]) => [
              k,
              Math.round(v * 10) / 10,
            ]),
          )
        : null
      const beat = ap ? stepAt(stepsRef.current, ap.u).key : null
      const holding = held
      const shown = ap
        ? `${ap.phase}|${beat}|${holding}|${ap.vm.toFixed(1)}|${JSON.stringify(coarse)}`
        : ''
      if (shown !== apShownRef.current) {
        apShownRef.current = shown
        publishAp(ap, coarse, beat, holding)
      }
      const open = CHANNEL_IDS.map((id) => CHANNELS[id]).filter(
        (channel) =>
          (channel.gating !== 'always' || membraneRef.current.leaksOn) &&
          gateOf(channel, env) === 'open',
      )
      if (ap) {
        // During a spike the model IS the voltage — smoothing it would flatten
        // the very peak the spike is about. The model already has the membrane's
        // time constant in the shape of its gates.
        animRef.current.vm = ap.vm
      } else {
        // At rest the membrane takes a moment to charge, as a real one does.
        const target = membraneVoltageMv(countsRef.current, open)
        const step = frame.timeDiff > 0 ? 1 - Math.exp(-frame.timeDiff / VM_SETTLE_MS) : 1
        animRef.current.vm += (target - animRef.current.vm) * step
      }

      // The propagation run, clocked the same way the spike is: a POSITION that
      // the loop advances while it is playing, so pausing is not a special case
      // and dragging backwards is free. Two positions, in sequence — the signal
      // coming in to the axon, and then the axon's own run.
      {
        const { lead, u: cu, playing } = useAxonStore.getState()
        if (playing && lead !== null && frame.timeDiff > 0) {
          if (lead < 1) {
            const next = lead + frame.timeDiff / LEAD_MS
            // Arriving is what starts the spike. Nothing else does — which is the
            // point of having a lead-in at all.
            if (next >= 1) useAxonStore.setState({ lead: 1, u: 0 })
            else useAxonStore.setState({ lead: next })
          } else if (cu !== null) {
            // The axon's own pace, per fibre: the shared rate over the run's own
            // trimmed window, extra slow-motion for the sheathed fibre, and a
            // fast-forward through the recovery tail — the drama at full slow
            // motion, the tidying-up skimmed. See MYELIN_SLOWDOWN and TAIL_HASTE.
            //
            // The race gets one rate and no slow-motion — either would be a thumb
            // on the scale. It does hurry the tail, but only from the moment the
            // SECOND fibre is home: until then hurrying would be shortening one
            // axon's recovery while the other is still running.
            const run = axonRef.current.cable
            const races = axonRef.current.raceRuns
            const isRace = races !== null
            const duration = isRace ? raceDurationMs() : screenDurationMs(run)
            const tailFrom = isRace ? raceTailStartU(races) : tailStartU(run)
            const haste = cu > tailFrom ? TAIL_HASTE : 1
            const next = cu + (frame.timeDiff * haste) / duration
            // Stop AT the end rather than dropping back to rest: the last thing
            // to see is the far end of the axon coming back down, and clearing
            // the run would wipe it off the screen the instant it finished.
            if (next >= 1) useAxonStore.setState({ u: 1, playing: false })
            else useAxonStore.setState({ u: next })
          }
        }
      }

      // The synapse's run walks forward on the frame's own clock. ⚠ SLOWED,
      // and declared: `SYNAPSE_MS` of model time is stretched over
      // `SYNAPSE_SCREEN_MS` on screen, because the whole event — arrival,
      // calcium, fusion, binding — is over in sixty milliseconds and nothing in
      // it can be watched at life speed.
      jiggleRef.current = frame.time * 0.0035
      {
        const syn = synapseRef.current
        if (syn.at && syn.playing && syn.u !== null) {
          const next = syn.u + frame.timeDiff / SYNAPSE_SCREEN_MS
          // Hold AT the end first — clearing the instant the run finished
          // would wipe the last thing it teaches off the screen — and stamp
          // WHEN it ended, on the stage's own clock, so the reset below can
          // wait out the hold.
          if (next >= 1) {
            useSynapseStore.setState({ u: 1, playing: false })
            synEndAtRef.current = frame.time
          } else useSynapseStore.setState({ u: next })
        }
        // ⚠ THE RUN PUTS ITSELF BACK TO REST (user, 2026-09-01: "remove reset
        // button — after the animation is over, the state should be reset to
        // new"). Only a run that PLAYED to its end resets itself: the stamp is
        // set in the branch above, never by scrubbing, so a user parked at
        // u = 1 by the slider is not yanked back to rest under their thumb.
        if (syn.u !== 1) synEndAtRef.current = null
        else if (
          syn.at &&
          !syn.playing &&
          synEndAtRef.current !== null &&
          frame.time - synEndAtRef.current > SYNAPSE_END_HOLD_MS
        ) {
          synEndAtRef.current = null
          useSynapseStore.getState().reset()
        }
      }

      // Two things have to be true before the propagation view is drawn: the
      // camera has to be going there, and it has to have most of the way
      // arrived. The first is eased so leaving fades out instead of popping.
      const wantAxon = axonRef.current.at ? 1 : 0
      const ease =
        frame.timeDiff > 0 ? 1 - Math.exp(-frame.timeDiff / 240) : 1
      axonFadeRef.current += (wantAxon - axonFadeRef.current) * ease
      const wantPassive = passiveRef.current.at ? 1 : 0
      passiveFadeRef.current += (wantPassive - passiveFadeRef.current) * ease
      const wantSynapse = synapseRef.current.at ? 1 : 0
      synapseFadeRef.current += (wantSynapse - synapseFadeRef.current) * ease

      const cam = cameraRef.current
      if (cam.startedAt === null) cam.startedAt = now
      const t = easeInOut(clamp01((now - cam.startedAt) / cam.duration))
      const current = interpolate(cam.from, cam.to, t)
      animRef.current.camera = current
      // The scene gives way as the propagation view arrives. Without this the
      // scene's own straight tube fringes out around the wobbling one drawn over
      // it, and two axons at slightly different widths is one axon too many.
      // Both views are gated on ARRIVAL as well as on intent, so the scene gives
      // way exactly as fast as something else takes over from it — never sooner.
      // On the way out of a patch this is what keeps the bilayer on screen,
      // shrinking, until the axon's two walls have appeared under it.
      axonShownRef.current = axonFadeRef.current * arrivalAt(current.scale, AXON_VIEW_SCALE)
      // Both axon views arrive at the SAME magnification, so they share the
      // arrival ramp and differ only in which one the camera is going to. The
      // scene gives way to whichever is further in — never to their sum, which
      // would fade the cell out twice on a flight between the two.
      passiveShownRef.current =
        passiveFadeRef.current * arrivalAt(current.scale, AXON_VIEW_SCALE)
      // ⚠ A SPAN, not a band: the synapse view is home from its own scale down
      // to the active zone's (×4 deeper); a single-scale band blinked the view
      // out midway through the dive between the two places.
      synapseShownRef.current =
        synapseFadeRef.current *
        arrivalSpan(current.scale, SYNAPSE_VIEW_SCALE, SYNAPSE_VIEW_SCALE * 4)
      // The dive INTO the view: past the synapse's own magnification the
      // layer itself scales about the active zone, so the camera keeps going
      // into the same picture rather than swapping it.
      {
        const extra = Math.min(4, Math.max(1, current.scale / SYNAPSE_VIEW_SCALE))
        const az = zoneAnchorRef.current
        const sl = synapseLayerRef.current
        if (sl) {
          sl.scale({ x: extra, y: extra })
          sl.position({ x: az.x * (1 - extra), y: az.y * (1 - extra) })
        }
        synapseChromeRef.current = Math.max(0, Math.min(1, 1 - (extra - 1) / 0.6))
      }
      // ⚠ CSS OPACITY ON THE LAYER'S OWN CANVAS, not `layer.opacity()` (user,
      // 2026-08-31: "I can see a ghost axon behind the visualisation, on both
      // 'passive spread' and 'Axonal conduction and myelin'").
      //
      // Konva applies a node's opacity by SETTING `globalAlpha` on the context
      // before calling its `sceneFunc`. `drawScene` then assigns `globalAlpha`
      // itself in eighteen places — every part of the cell that has a fade of
      // its own — and an assignment overwrites rather than multiplies. So the
      // moment the drawing set an alpha, the layer's fade was gone and those
      // parts painted at full strength however far out the camera had flown:
      // a whole-cell axon standing behind the view that replaced it.
      //
      // Compositing the layer's CANVAS ELEMENT instead makes the fade a
      // property of the surface rather than of the ink, so nothing the drawing
      // does to `globalAlpha` can escape it. It is also the honest semantic:
      // "the scene gives way" is one thing happening to one picture, not a
      // thousand alphas that must each remember to be multiplied.
      const hidden = Math.max(
        axonShownRef.current,
        passiveShownRef.current,
        synapseShownRef.current,
      )
      layer.getNativeCanvasElement().style.opacity = String(1 - hidden)
      // And an invisible cell must not still be clickable underneath the view
      // that replaced it.
      layer.listening(hidden < 0.5)
      layer.scale({ x: current.scale, y: current.scale })
      layer.rotation((current.angle * 180) / Math.PI)
      // Konva applies scale, then rotation, then position — so the offset that
      // lands `center` in the middle of the stage has to be rotated too.
      const cos = Math.cos(current.angle)
      const sin = Math.sin(current.angle)
      const sx = current.center.x * current.scale
      const sy = current.center.y * current.scale
      layer.position({
        x: STAGE_W / 2 - (cos * sx - sin * sy),
        y: STAGE_H / 2 + current.drop - (sin * sx + cos * sy),
      })
    }, [
      layer,
      axonLayerRef.current,
      passiveLayerRef.current,
      synapseLayerRef.current,
    ].filter(Boolean) as Konva.Layer[])
    anim.start()
    return () => {
      anim.stop()
    }
  }, [setPhase])


  useEffect(() => {
    if (transmitterPulse > 0) transmitterAtRef.current = null
  }, [transmitterPulse])

  // A new run restarts the chain clock.
  useEffect(() => {
    runStartRef.current = null
    phaseRef.current = run ? 'input-fires' : 'idle'
  }, [run])

  // Retire a finished run so the scene returns to rest.
  useEffect(() => {
    if (!run) return
    const timer = setTimeout(
      () => useNeuronStore.setState({ run: null, phase: 'idle' }),
      runDuration(run.inputs.length) + 900,
    )
    return () => clearTimeout(timer)
  }, [run])

  // Glide the camera whenever the zoom target changes.
  useEffect(() => {
    const from = animRef.current.camera
    const to = cameraFor(zoom)
    cameraRef.current = {
      from,
      to,
      startedAt: null,
      duration: cameraDuration(from.scale, to.scale),
    }
  }, [zoom])

  const cursor = (e: KonvaEventObject<MouseEvent>, value: string) => {
    const stage = e.target.getStage()
    if (stage) stage.container().style.cursor = value
  }
  const partHover = (part: NeuronPartId) => ({
    onMouseEnter: (e: KonvaEventObject<MouseEvent>) => {
      setHovered(part)
      cursor(e, 'pointer')
    },
    onMouseLeave: (e: KonvaEventObject<MouseEvent>) => {
      setHovered(null)
      cursor(e, 'default')
    },
  })

  return (
    <div className="relative shrink-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
      {/* Zooming in happens by clicking a ring on the canvas, so coming back
          out belongs on the canvas too. It is screen-fixed chrome rather than
          part of the scene — it is not anchored to any structure — so it is a
          real button overlaying the stage rather than a Konva shape. */}
      {zoom !== null && (
        <button
          type="button"
          onClick={zoomOut}
          className="absolute left-3 top-3 z-10 rounded-lg border border-amber-500/60 bg-slate-950/85 px-2.5 py-1.5 text-xs text-amber-200 backdrop-blur transition hover:bg-amber-500/20"
        >
          ⤢ back to the whole picture
        </button>
      )}
      {/* THE DOORS ON THE PATCH — one row, its own container, bottom left.
          They were pinned to the structures they open (bilayer on bare wall,
          channel on a channel), which was the right idea and looked wrong:
          four markers scattered over a picture read as clutter ON the picture
          rather than as a set of things you can do WITH it (user,
          2026-08-28). A shelf in the corner is what a set of instruments
          looks like — and because a shelf points at nothing by design, the
          two exhibits that are not places belong on it too. */}
      {atMembrane && (
        <div className="absolute bottom-3 left-3 z-10 grid grid-cols-2 gap-x-1 gap-y-0.5 rounded-xl border border-slate-700 bg-slate-950/85 p-1.5 shadow-lg backdrop-blur">
          {patchDoors().map((door) => (
            <button
              key={door.id}
              type="button"
              onClick={() => goTo({ zoom, drawer: door.id })}
              title={door.full}
              aria-label={door.full}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-slate-200 transition hover:bg-amber-500/20"
            >
              <span aria-hidden className="text-base leading-none">
                {door.icon}
              </span>
              <span className="whitespace-nowrap">{door.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* The one thing to press at a membrane patch, and the cause of
          everything that then happens. It lives ON the canvas because what it
          does is visible there and nowhere else — and there is deliberately no
          button that opens a channel: you fire a spike, and the channels answer
          it on their own schedules. */}
      {/* ONE control, always here. The fire button and the transport used to be
          two panels that swapped places, which meant the primary action vanished
          the instant it was used and the thing that replaced it opened with a
          bare ▶ — an icon that says "resume" to someone who has not started
          anything. Now the play button IS the fire button, and it says in words
          what pressing it will do.

          The event is a position rather than an elapsed time, so it can be
          stopped anywhere and dragged back and forth, and every part of the scene
          — gates, aura, charge marks, the trace marker — follows to that moment.
          Dragging while at rest is allowed and lands you inside the spike, paused:
          the position is the only state there is. */}
      {/* ⚠ THE TIMELINE TOOL (user, 2026-09-01) replaced the bare range
          slider: the same drag, plus the run's own moments as named, spoken,
          pressable places on the bar. Pressing one REWINDS — the run glides
          through the intermediate states, never teleports — and a run that was
          playing keeps playing from where it lands. ⚠ THE BAR OWNS THE WHOLE
          CONTAINER (user, 2026-09-02: "extract the button out of the
          container" — the ⚡→▶ swap was resizing the row and shifting the
          bar): the action button floats on its own plate under the bar's
          left end, mirroring the 🔆 plate on the right, so nothing in the
          row ever changes width. */}
      {/* N22's paired-pulse control USED TO BE HERE, and it is worth saying
          why it went. It was a toggle and a slider reading "6.0 ms", and it
          asked a child to hold two runs in mind and compare them from memory:
          press, watch, change a number they cannot feel the size of, press
          again, remember what was different. Nothing on the patch showed the
          two pushes together, because the patch only ever draws one instant.
          The refractory period is a fact about a SEQUENCE, and a view of one
          moment is the wrong instrument for it however good the model behind
          it is. It lives on the spike-train bench now, where both pushes and
          both answers are on one axis at the same time. */}
      {/* ⚠ ONE FLOWING COLUMN (user, 2026-09-02: "no need to reserve space
          for additional rows of labels" — the bar's height is dynamic again,
          so the plates FLOW below it with a fixed margin instead of sitting
          at a hardcoded offset; the gap stays identical in every view by
          construction). The wrapper ignores the pointer so the canvas under
          its empty middle stays reachable. */}
      {atMembrane && showSpike && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10">
          <TransportBar
            className="pointer-events-auto"
            points={apPoints}
            value={apTimelineBar.ofU(apU ?? 0)}
            playing={apPlaying}
            onScrub={(b) => scrubAp(apTimelineBar.uOf(b))}
            onResume={resumeAp}
            ariaLabel="Position through the action potential"
            timer={`${((apU ?? 0) * AP_REAL_MS).toFixed(1)} ms`}
          />
          <div className="mt-2 flex items-start justify-between">
            {/* One push, named in the biology's own terms. The amplitude is
                FIXED, so whether it fires is the mechanism's to decide:
                flatten sodium's gradient and this button does nothing at all,
                which is the lesson rather than a bug. */}
            {!spiking && (
              <button
                type="button"
                onClick={() => fireActionPotential()}
                title={STIMULI.spike.note}
                className="pointer-events-auto flex h-[38px] min-w-[104px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-400/80 bg-amber-500/30 px-3 text-amber-50 shadow-lg backdrop-blur transition hover:bg-amber-500/45"
              >
                <span aria-hidden style={{ fontSize: STIMULI.spike.bolt, lineHeight: 1 }}>
                  ⚡
                </span>
                <span className="text-[13px] font-semibold">{STIMULI.spike.label}</span>
              </button>
            )}
            {spiking && (
              <button
                type="button"
                onClick={apPlaying ? pauseAp : resumeAp}
                // A word beside the icon: ⏸ alone is guesswork at this age.
                className="pointer-events-auto h-[38px] w-[128px] whitespace-nowrap rounded-lg border border-amber-400/50 bg-amber-500/15 text-[13px] font-semibold text-amber-100 shadow-lg backdrop-blur transition hover:bg-amber-500/30"
              >
                {apPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
            )}
            {/* ⚠ NOT IN THE TIMELINE ROW (user, 2026-09-02): the emphasis
                switch lives on its own plate under the bar's right end. */}
            <div className="pointer-events-auto rounded-lg border border-slate-700 bg-slate-950/85 p-0.5 shadow-lg backdrop-blur">
              <button
                type="button"
                onClick={toggleSpotlight}
                aria-pressed={spotlightOn}
                title={
                  spotlightOn
                    ? 'Showing everything at full strength again'
                    : 'Bring forward whatever is carrying the current'
                }
                className={`rounded-md px-2 py-1 text-[11px] transition ${
                  spotlightOn
                    ? 'bg-amber-500/20 text-amber-100 hover:bg-amber-500/35'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                🔆 focus
              </button>
            </div>
          </div>
          {/* What to look at, in words, one moment at a time. Watched as a
              single smooth sweep the important part — that potassium answers
              LATE — went past too fast to catch, so playback stops on each
              moment and says which one it is. In the flow, below the plates,
              so it can never sit on the thing it describes. */}
          {spiking && beat && (
            <div className="pointer-events-none mx-auto mt-2 w-[min(560px,86%)] rounded-xl border border-slate-600/70 bg-slate-950/92 px-4 py-2.5 text-center shadow-xl backdrop-blur">
              <p className="text-[15px] font-semibold leading-tight text-slate-100">
                <span className="text-amber-300">
                  {beatNumber}/{beatCount}
                </span>{' '}
                {beat.title}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-slate-400">👀 {beat.watch}</p>
            </div>
          )}
        </div>
      )}
      {/* The propagation view's own controls — the same grammar as the spike's,
          because it is the same kind of thing: one cause you press, and then a
          position you can stop anywhere and drag back and forth. */}
      {atAxon && (
        <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-amber-400/60 bg-slate-950/90 px-3 py-2 shadow-lg backdrop-blur">
          {/* One push, not two. Whether a stimulus is over the line is the
              membrane patch's lesson and it is taught there, with both pushes and
              a threshold to be found; out here the question is what happens to
              the NEXT patch once this one has fired, and a push that never fires
              anything has nothing to say about it. */}
          {/* N20, as a two-way switch rather than a button that renames itself.
              Both fibres named, side by side, with the one you are looking at lit
              — so which state you are in and what the other one is are the same
              glance. A single toggle labelled with its own state cannot say which
              of those it means.

              Not a setting but a specimen: picking the other one runs the SAME
              push down a different axon, with everything else held identical —
              length, window, electrode, gradients — so the speed underneath is a
              comparison rather than a coincidence. */}
          <div
            role="radiogroup"
            aria-label="Which axon"
            className="flex h-[38px] shrink-0 items-center gap-1 rounded-lg border border-slate-700 p-0.5"
          >
            {AXON_MODES.map((option) => {
              const on = axonMode === option.mode
              return (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setAxonMode(option.mode)}
                  title={option.note}
                  className={`h-full rounded-md px-2.5 text-[12px] font-semibold transition ${
                    on
                      ? 'bg-amber-500/25 text-amber-100'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {option.icon} {option.label}
                </button>
              )
            })}
          </div>

          {!propagating && (
            <button
              type="button"
              onClick={() => fireAxon('spike')}
              title={STIMULI.spike.note}
              className="flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-400/80 bg-amber-500/30 px-3 text-amber-50 transition hover:bg-amber-500/45"
            >
              <span aria-hidden style={{ fontSize: STIMULI.spike.bolt, lineHeight: 1 }}>
                ⚡
              </span>
              <span className="text-[13px] font-semibold">{STIMULI.spike.label}</span>
            </button>
          )}

          {propagating && (
            <button
              type="button"
              onClick={() =>
                axonPlaying
                  ? useAxonStore.getState().pause()
                  : useAxonStore.getState().resume()
              }
              className="h-[38px] w-[104px] shrink-0 rounded-lg border border-amber-400/50 bg-amber-500/15 text-[13px] font-semibold text-amber-100 transition hover:bg-amber-500/30"
            >
              {axonPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
          )}

          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round((axonU ?? 0) * 1000)}
            onChange={(e) =>
              useAxonStore.getState().scrubTo(Number(e.target.value) / 1000)
            }
            aria-label="Position through the run"
            className="w-40 cursor-pointer"
            style={{ accentColor: '#fcd34d' }}
          />
          <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
            {((axonU ?? 0) * (cable.t[cable.t.length - 1] ?? VIEW_MS)).toFixed(1)} ms
          </span>
        </div>
      )}
      {/* ⚠ ON THE CANVAS, IN THE AXON VIEW'S OWN PILL (user, 2026-08-31:
          "buttons should be placed on the canvas… look at what the buttons
          look like on it"). Same corner, same plate, same 38 px chips — a
          control that does the same kind of thing in two views has to look
          like the same control, or the child learns the affordance twice. */}
      {/* ⚠ THE DOOR INTO D06, as the membrane patch's own shelf pattern
          (user, 2026-09-01: "replace the magnifying glass with a shortcut
          button, as seen on 'The AP' — both views, bottom left"). */}
      {atSynapse && (
        <div className="absolute bottom-3 left-3 z-10 rounded-xl border border-slate-700 bg-slate-950/85 p-1.5 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={() => useSnareStore.getState().openBench()}
            title="How a bubble of chemical gets out of the cell, and what pulls it in."
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-slate-200 transition hover:bg-amber-500/20"
          >
            <span aria-hidden className="text-base leading-none">
              🫧
            </span>
            <span className="whitespace-nowrap">Vesicles & the SNARE machinery</span>
          </button>
        </div>
      )}
      {/* ⚠ THE TIMELINE TOOL here too (user, 2026-09-01): the run's dated
          moments — arrival, calcium, fusion, binding, opening, the nudge,
          clearing — as named, spoken, pressable dots. A press rewinds, the
          thumb drags. ⚠ THE BAR OWNS THE WHOLE CONTAINER (user, 2026-09-02:
          "extract the button out of the container" — the ⚡→▶ swap was
          resizing the row and shifting the bar): the action button floats on
          its own plate under the bar's left end, mirroring the scale switch
          on the right, so the row's layout never changes. */}
      {/* ⚠ ONE FLOWING COLUMN here too (user, 2026-09-02): the bar's height
          is dynamic, so the ⚡/▶ plate and the scale switch flow below it
          with a fixed margin — the same gap as every other view, by
          construction. The wrapper ignores the pointer so the canvas under
          its empty middle stays reachable. */}
      {atSynapse && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10">
          <TransportBar
            className="pointer-events-auto"
            points={synPoints}
            value={synShownU}
            playing={synPlaying}
            onScrub={(v) => useSynapseStore.getState().scrubTo(v)}
            onResume={() => useSynapseStore.getState().resume()}
            ariaLabel="Position through the run"
            timer={`${(synapseClock(synShownU) * synRun.windowMs).toFixed(1)} ms`}
          />
          <div className="mt-2 flex items-start justify-between">
            {/* One push, named in the biology's own terms — what this one
                fires is the spike ARRIVING at the terminal: the cause of
                everything else in the picture.
                ⚠ NO RESET BUTTON (user, 2026-09-01). A run that plays to its
                end puts itself back to rest after a short hold, so the
                transport can never strand at an end — the start-over control
                the pacing rule demands is the ⚡ button this hands back. */}
            {!synRunning && (
              <button
                type="button"
                onClick={() => useSynapseStore.getState().fire()}
                title="Send an action potential down the axon into this terminal"
                className="pointer-events-auto flex h-[38px] min-w-[104px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-400/80 bg-amber-500/30 px-3 text-amber-50 shadow-lg backdrop-blur transition hover:bg-amber-500/45"
              >
                <span aria-hidden style={{ fontSize: STIMULI.spike.bolt, lineHeight: 1 }}>
                  ⚡
                </span>
                <span className="text-[13px] font-semibold">{STIMULI.spike.label}</span>
              </button>
            )}
            {synRunning && (
              <button
                type="button"
                onClick={() =>
                  synPlaying
                    ? useSynapseStore.getState().pause()
                    : useSynapseStore.getState().resume()
                }
                className="pointer-events-auto h-[38px] w-[128px] rounded-lg border border-amber-400/50 bg-amber-500/15 text-[13px] font-semibold text-amber-100 shadow-lg backdrop-blur transition hover:bg-amber-500/30"
              >
                {synPlaying ? '⏸ Pause' : '▶ Play'}
              </button>
            )}
            {/* ⚠ THE SCALE SWITCH on its own top-right plate (user,
                2026-09-01: "top right corner"; 2026-09-02: no extra buttons
                in the timeline element) — the axon views' own two-way
                pattern: both framings named, the one you are in lit. */}
            <div
              role="radiogroup"
              aria-label="Scale"
              className="pointer-events-auto flex h-[38px] items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/85 p-0.5 shadow-lg backdrop-blur"
            >
              {[
                { id: 'outgoing-synapse', icon: '🕸', label: 'whole synapse' },
                { id: 'active-zone', icon: '🔍', label: 'active zone' },
              ].map((option) => {
                const on = zoom === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => zoomTo(option.id)}
                    className={`h-full rounded-md px-2.5 text-[12px] font-semibold transition ${
                      on
                        ? 'bg-amber-500/25 text-amber-100'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {option.icon} {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
      {atPassive && (
        <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-amber-400/60 bg-slate-950/90 px-3 py-2 shadow-lg backdrop-blur">
          <button
            type="button"
            // ⚠ THE STAGE'S OWN CLOCK, not `performance.now()`. Konva's
            // `frame.time` is milliseconds since the ANIMATION started, so a
            // race stamped with the wall clock starts hundreds of thousands of
            // milliseconds in the future and the run position comes out
            // negative. A clock belongs to the event it is timing, and both
            // ends of this one have to be read off the same clock.
            onClick={() => leakyRace(animRef.current.timeMs)}
            title="Send the same push down both stretches and watch how far each one gets"
            className="flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-400/80 bg-amber-500/30 px-3 text-amber-50 transition hover:bg-amber-500/45"
          >
            <span aria-hidden className="text-base leading-none">
              🏁
            </span>
            <span className="text-[13px] font-semibold">Race</span>
          </button>
          <ResetButton
            onClick={leakyReset}
            title="Put both stretches back to rest, with no push in either"
            height={38}
          />
        </div>
      )}
      <Stage width={STAGE_W} height={STAGE_H}>
        <Layer ref={layerRef}>
          {/* Clicking empty space lets go of the selected part. */}
          <Rect
            width={STAGE_W}
            height={STAGE_H}
            fill={HIT}
            onClick={clearSelection}
            onTap={clearSelection}
          />

          <Shape
            listening={false}
            sceneFunc={(ctx) => {
              const view = viewRef.current
              const { chain, camera, timeMs, vm } = animRef.current
              drawScene(nativeCtx(ctx), {
                selected: view.selected,
                hovered: view.hovered,
                hoveredInput: view.hoveredInput,
                hoveredMarker: view.hoveredMarker,
                firedInputs: view.run?.inputs ?? [],
                chain,
                cameraScale: camera.scale,
                showMarkers: camera.scale < 1.2,
                view: viewRect(camera),
                ions: ionsRef.current,
                highlighted: colourRef.current,
                apTrace: traceRef.current,
                apU: apRef.current === null ? null : apRef.current.u,
                gateFlash: flashRef.current,
                emphasis: emphasisRef.current,
                vmRest: apRestMv(countsRef.current, membraneRef.current.leaksOn),
                proteins,
                pumpOn: membraneRef.current.pumpOn,
                leaksOn: membraneRef.current.leaksOn,
                gateEnv: gateEnvRef.current,
                counts: countsRef.current,
                vm,
                timeMs,
              })
            }}
          />

          {/* Input neurons: clicking one fires it. */}
          {INPUTS.map((input) => (
            <Circle
              key={`in-${input.id}`}
              x={input.soma.x}
              y={input.soma.y}
              radius={input.somaR + 8}
              fill={HIT}
              onClick={() => fire([input.id])}
              onTap={() => fire([input.id])}
              onMouseEnter={(e) => {
                setHoveredInput(input.id)
                cursor(e, 'pointer')
              }}
              onMouseLeave={(e) => {
                setHoveredInput(null)
                cursor(e, 'default')
              }}
            />
          ))}

          {/* Focus-neuron parts, ordered so the soma wins over branch roots. */}
          {DENDRITE_TRUNKS.map((t, ti) =>
            t.segs.map((seg, si) => (
              <Line
                key={`d-${ti}-${si}`}
                points={[seg.x1, seg.y1, seg.x2, seg.y2]}
                stroke={HIT}
                strokeWidth={1}
                hitStrokeWidth={16}
                onClick={() => selectPart('dendrites')}
                onTap={() => selectPart('dendrites')}
                {...partHover('dendrites')}
              />
            )),
          )}
          <Line
            points={AXON_FLAT}
            stroke={HIT}
            strokeWidth={1}
            hitStrokeWidth={22}
            onClick={() => selectPart('axon')}
            onTap={() => selectPart('axon')}
            {...partHover('axon')}
          />
          {TERMINALS.map((t, i) => (
            <Line
              key={`t-${i}`}
              points={[AXON_END.x, AXON_END.y, t.end.x, t.end.y]}
              stroke={HIT}
              strokeWidth={1}
              hitStrokeWidth={18}
              onClick={() => selectPart('terminals')}
              onTap={() => selectPart('terminals')}
              {...partHover('terminals')}
            />
          ))}
          {TERMINALS.map((t, i) => (
            <Circle
              key={`b-${i}`}
              x={t.end.x}
              y={t.end.y}
              radius={BOUTON_R + 7}
              fill={HIT}
              onClick={() => selectPart('terminals')}
              onTap={() => selectPart('terminals')}
              {...partHover('terminals')}
            />
          ))}
          <Circle
            x={SOMA.x}
            y={SOMA.y}
            radius={SOMA_R}
            fill={HIT}
            onClick={() => selectPart('soma')}
            onTap={() => selectPart('soma')}
            {...partHover('soma')}
          />

          {/* Zoom markers sit on top, so they are always reachable — but only
              while they are actually drawn (at fit zoom). */}
          {ZOOM_TARGETS.map((target) => (
            <Circle
              key={target.id}
              x={target.center.x}
              y={target.center.y}
              radius={MARKER_R + 4}
              fill={HIT}
              listening={zoom === null}
              onClick={() => zoomTo(target.id)}
              onTap={() => zoomTo(target.id)}
              onMouseEnter={(e) => {
                setHoveredMarker(target.id)
                cursor(e, 'zoom-in')
              }}
              onMouseLeave={(e) => {
                setHoveredMarker(null)
                cursor(e, 'default')
              }}
            />
          ))}
        </Layer>

        {/* The propagation view (N19), on its own untransformed layer.

            On the canvas, not in a drawer — the camera flies to this axon like it
            flies anywhere else, and this is what it finds when it gets there. The
            layer carries no camera transform because what is drawn here is partly
            instrument: a ruler in real millimetres and a graph of voltage against
            distance both have to be square to the screen. The axon's THICKNESS is
            still the camera's own honest scale, so the tube that fades in is the
            same width as the tube that was there a moment ago. */}
        <Layer ref={axonLayerRef}>
          {/* The neurotransmitter view lived here too, sharing this layer. It has
              been removed entirely, back to the drawing board — see the roadmap.
              The note it leaves behind is worth keeping: two shapes on one layer
              must not clear the whole canvas, because Konva clears the layer before
              drawing its children and a shape that wipes it is erasing whatever
              sibling drew before it, not tidying up after itself. */}
          <Shape
            listening={false}
            sceneFunc={(ctx) => {
              const state = axonRef.current
              const scale = animRef.current.camera.scale
              const fade = axonShownRef.current
              // Nothing to draw, and nothing to clear either — see the note on the
              // shape above. These two views share a layer and must not reach
              // outside their own drawing.
              if (fade <= 0.002) return
              const pair = state.raceRuns
              if (pair) {
                drawRace(nativeCtx(ctx), {
                  width: STAGE_W,
                  height: STAGE_H,
                  axonPx: AXON_W * scale,
                  axonUm: AXON_DIAMETER_UM,
                  runs: pair,
                  u: state.u ?? 0,
                  counts: countsRef.current,
                  fade,
                })
                return
              }
              drawRibbon(nativeCtx(ctx), {
                width: STAGE_W,
                height: STAGE_H,
                // The honest thickness at whatever magnification the camera is
                // actually at, so the tube grows with the flight rather than
                // appearing at its final size.
                axonPx: AXON_W * scale,
                axonUm: AXON_DIAMETER_UM,
                run: state.cable,
                u: state.u ?? 0,
                counts: countsRef.current,
                patch: state.patch,
                drawnAxonUm: DRAWN_AXON_UM,
                fade,
              })
            }}
          />
          {/* Clicking a stripe puts the magnifier on it. The x axis is a real
              length, so where you click IS which piece of axon you get. */}
          <Rect
            width={STAGE_W}
            height={STAGE_H}
            fill={HIT}
            listening={atAxon}
            onClick={(e) => {
              const at = e.target.getStage()?.getPointerPosition()
              if (!at) return
              setAxonPatch(
                patchAtX(ribbonGeometry(STAGE_W, STAGE_H, AXON_W * AXON_VIEW_SCALE), at.x),
              )
            }}
          />
        </Layer>

        {/* D05, PASSIVE SPREAD — a place, on a layer of its own.

            Its own layer and not the axon's, for the reason written on that
            one: Konva clears a layer before drawing its children, so two views
            sharing a layer must each keep to their own patch of canvas. These
            two never appear together — the camera is at one axon target or the
            other — but "never together" is a claim about today's navigation,
            and a layer apiece is a claim about the drawing.

            Untransformed, like the axon view, because the ruler underneath it
            reads in millimetres and an instrument has to be square to the
            screen. */}
        <Layer ref={passiveLayerRef} listening={atPassive}>
          <Shape
            listening={false}
            sceneFunc={(ctx) => {
              const fade = passiveShownRef.current
              if (fade <= 0.002) return
              const began = passiveRef.current.startedMs
              const now = animRef.current.timeMs
              drawLeaky(
                nativeCtx(ctx),
                // Clamped at the caller, both ends — the model carries
                // fractional time and is not asked to defend itself against a
                // position outside its own run.
                began === null ? null : clamp01((now - began) / RACE_MS),
                now,
                fade,
              )
            }}
          />
          {/* ⚠ F04's speaker still has to be tappable. It was a canvas the
              drawer put a pointer handler on; out here the drawing is a Konva
              shape, so the hit box is a shape too — built from the SAME
              `leakyLabels()` the drawing used, never a second set of numbers. */}
          {leakyLabels().map((l) => (
            <Rect
              key={l.term}
              x={l.x}
              y={l.y}
              width={l.w}
              height={l.h}
              fill={HIT}
              onClick={() => speakAloud(l.term)}
              onTap={() => speakAloud(l.term)}
              onMouseEnter={(e) => cursor(e, 'pointer')}
              onMouseLeave={(e) => cursor(e, 'default')}
            />
          ))}
        </Layer>

        {/* S12 LEG 1 — THE SYNAPSE, on a layer of its own.

            Same reasoning as the two axon views above: untransformed, because
            what is drawn here is partly instrument, and a layer apiece because
            Konva clears a layer before drawing its children.

            The camera really flies to this terminal — and it TURNS a quarter of
            the way in, because this synapse lies along the x axis on the cell
            while the drawing puts the cleft across the middle. The rotation is
            the camera's, not a lie in the picture. */}
        <Layer ref={synapseLayerRef} listening={atSynapse}>
          <Shape
            listening={false}
            sceneFunc={(ctx) => {
              const state = synapseRef.current
              const fade = synapseShownRef.current
              if (fade <= 0.002) return
              drawSynapse(nativeCtx(ctx), {
                run: state.run,
                cleft: state.cleft,
                // ⚠ THE SCREEN'S POSITION IS NOT THE MODEL'S. The scrubber and
                // the clock walk evenly; the run does not — see `synapseClock`.
                u: state.u === null ? null : synapseClock(state.u),
                fade,
                // The ambient thermal clock: real screen time, so the soup and
                // the casts jiggle at rest, through the beats, and at one pace.
                jiggle: jiggleRef.current,
                // Labels and lenses dissolve on the dive to the active zone.
                chrome: synapseChromeRef.current,
              })
            }}
          />
          {synapseLabels(synapseGeometry()).map((l) => (
            <Rect
              key={l.term}
              x={l.x}
              y={l.y}
              width={l.w}
              height={l.h}
              fill={HIT}
              onClick={() => speakAloud(l.term)}
              onTap={() => speakAloud(l.term)}
              onMouseEnter={(e) => cursor(e, 'pointer')}
              onMouseLeave={(e) => cursor(e, 'default')}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
}
