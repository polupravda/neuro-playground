import { useEffect, useMemo, useRef, useState } from 'react'
import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Circle, Layer, Line, Rect, Shape, Stage } from 'react-konva'
import type { NeuronPartId } from '../core/neuron'
import {
  AXON_END,
  AXON_FLAT,
  AXON_VIEW_SCALE,
  arrivalAt,
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
import { advance, apSteps, gateMoments, justChanged, stepAt } from '../core/apSteps'
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
  /** How far the propagation view has taken over from the scene, 0→1. */
  const axonFadeRef = useRef(0)
  // What each view of its own is ACTUALLY showing at this instant: how much the
  // camera wants it, times how near the camera has got to its magnification.
  //
  // Kept in refs because the scene layer's opacity and the views' own drawing both
  // have to use the same number. They did not, and that was the visible bug: the
  // scene faded out on the raw want in a quarter of a second while the view coming
  // in was still invisible, so flying out of a membrane patch went briefly to
  // nothing instead of showing the membrane shrink.
  const axonShownRef = useRef(0)
  const selected = useNeuronStore((s) => s.selected)
  const run = useNeuronStore((s) => s.run)
  const zoom = useNeuronStore((s) => s.zoom)
  const selectPart = useNeuronStore((s) => s.selectPart)
  const clearSelection = useNeuronStore((s) => s.clearSelection)
  const fire = useNeuronStore((s) => s.fire)
  const setPhase = useNeuronStore((s) => s.setPhase)
  const zoomTo = useNeuronStore((s) => s.zoomTo)
  const zoomOut = useNeuronStore((s) => s.zoomOut)

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
          ? {
              'voltage-na': Math.max(
                justChanged(ap.u, momentsRef.current.naOpens),
                justChanged(ap.u, momentsRef.current.naShuts),
              ),
              'voltage-k': Math.max(
                justChanged(ap.u, momentsRef.current.kOpens),
                justChanged(ap.u, momentsRef.current.kShuts),
              ),
            }
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

      // Two things have to be true before the propagation view is drawn: the
      // camera has to be going there, and it has to have most of the way
      // arrived. The first is eased so leaving fades out instead of popping.
      const wantAxon = axonRef.current.at ? 1 : 0
      const ease =
        frame.timeDiff > 0 ? 1 - Math.exp(-frame.timeDiff / 240) : 1
      axonFadeRef.current += (wantAxon - axonFadeRef.current) * ease

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
      layer.opacity(1 - axonShownRef.current)
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
    }, [layer, axonLayerRef.current].filter(Boolean) as Konva.Layer[])
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
      {atMembrane && showSpike && (
        <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-400/60 bg-slate-950/90 px-3 py-2 shadow-lg backdrop-blur">
          {/* One push, named in the biology's own terms. The weak one that used
              to sit beside it has moved to the bench: on this patch a push that
              does nothing leaves every instrument — doors, crowds, spotlight —
              with nothing to say, and a child cannot tell "not enough" from
              "broken". On a graph a flat line is an answer.

              The amplitude is still FIXED, so whether it fires is the mechanism's
              to decide: flatten sodium's gradient and this button does nothing at
              all, which is the lesson rather than a bug. */}
          {!spiking && (
            <button
              type="button"
              onClick={() => fireActionPotential()}
              title={STIMULI.spike.note}
              className="flex h-[46px] min-w-[122px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-400/80 bg-amber-500/30 px-3 text-amber-50 shadow-md transition hover:bg-amber-500/45"
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
              className="h-[46px] w-[122px] shrink-0 whitespace-nowrap rounded-lg border border-amber-400/50 bg-amber-500/15 text-[13px] font-semibold text-amber-100 transition hover:bg-amber-500/30"
            >
              {apPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
          )}
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
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round((apU ?? 0) * 1000)}
            onChange={(e) => scrubAp(Number(e.target.value) / 1000)}
            aria-label="Position through the action potential"
            className="w-44 cursor-pointer"
            style={{ accentColor: '#fcd34d' }}
          />
          <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
            {((apU ?? 0) * AP_REAL_MS).toFixed(1)} ms
          </span>
          {/* One switch for the whole emphasis: which proteins are carrying the
              current, and which ions are in colour. On, the picture answers "what
              is doing this?"; off, it is the membrane as it always is. */}
          <button
            type="button"
            onClick={toggleSpotlight}
            aria-pressed={spotlightOn}
            title={
              spotlightOn
                ? 'Showing everything at full strength again'
                : 'Bring forward whatever is carrying the current'
            }
            className={`shrink-0 rounded-lg px-2 py-1 text-[11px] transition ${
              spotlightOn
                ? 'bg-amber-500/20 text-amber-100 hover:bg-amber-500/35'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            🔆 focus
          </button>
        </div>
      )}
      {/* What to look at, in words, one moment at a time. Watched as a single
          smooth sweep the important part — that potassium answers LATE — went
          past too fast to catch, so playback stops on each moment and says which
          one it is. Only while something is happening: at rest the view stays
          clear, and the button above is the invitation.

          It clears the transport above it rather than tucking under it: that row
          starts at 12 px and its 46 px buttons and padding carry it to about 74,
          so anything above 74 is sitting on top of the thing it is describing. */}
      {atMembrane && showSpike && spiking && beat && (
        <div className="pointer-events-none absolute left-1/2 top-[86px] z-10 w-[min(560px,86%)] -translate-x-1/2 rounded-xl border border-slate-600/70 bg-slate-950/92 px-4 py-2.5 text-center shadow-xl backdrop-blur">
          <p className="text-[15px] font-semibold leading-tight text-slate-100">
            <span className="text-amber-300">
              {beatNumber}/{beatCount}
            </span>{' '}
            {beat.title}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-slate-400">👀 {beat.watch}</p>
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
      </Stage>
    </div>
  )
}
