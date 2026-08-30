import { useMemo } from 'react'
import type { TeachingPara } from '../core/neuron'
import { CABLE_SIMPLIFICATION, cableFacts, lengthConstantUm } from '../core/cable'
import {
  fibreRun,
  fibreWave,
  myelinFacts,
  raceFacts,
  readingOfFibre,
  whyMyelinFacts,
  type FibreRun,
} from '../core/fibre'
import { STIMULI } from '../core/scenarios'
import { AXON_VIEW_SCALE, AXON_W, DRAWN_AXON_UM, STAGE_H, STAGE_W } from '../stage/layout'
import { AXON_DIAMETER_UM } from '../core/membrane'
import { useIonStore } from '../state/ionStore'
import { useMembraneStore } from '../state/membraneStore'
import { useAxonStore } from '../state/axonStore'
import {
  PATCHES,
  PATCH_UM,
  VIEW_LENGTH_UM,
  viewFibre,
  lengthSquash,
  lensMagnification,
  lensNm,
  patchCentre,
  ribbonGeometry,
  spotTruePx,
} from '../stage/axonRibbon'
import { Section } from './InfoPanel'

// The propagation view's describer. Same shape as the bench's: what is true at
// this instant first, then what the picture is, then the footnotes.
//
// Every number in "Right now" comes out of `waveReport`, which measures the
// model. The temptation in a view like this is to narrate the story you meant to
// tell — "the wave is halfway along now" — and be wrong when a gradient has been
// changed and there is no wave at all.

const mm = (um: number): string => `${(um / 1000).toFixed(1)} mm`

function rightNow(
  traj: FibreRun,
  u: number | null,
  lead: number | null,
): TeachingPara[] {
  if (lead !== null && u === null) {
    return [
      {
        icon: '👂',
        text: 'An input neuron has just fired. Watch the little cell above: a ripple is spreading in along a dendrite, getting weaker as it goes, and the soma is adding up what arrives. That is a graded signal — it fades, and it can be small or large.',
      },
      {
        icon: '🐢',
        text: 'And notice how it CRAWLS. A dendrite has nothing that rebuilds the signal, so it spreads the slow way charge soaks along a thin wet cable — slower as well as fainter the further it goes. The moment the axon takes over you will see the difference: the spike sprints, because every patch it reaches remakes it at full strength.',
      },
      {
        icon: '📍',
        text: 'Nothing is happening on the axon yet, and nothing will until enough of that reaches the hillock. Pressing a button is not what fires a neuron; something arriving is.',
      },
      {
        icon: '👆',
        text: 'Watch the little cell when it gets there: the axon lights piece by piece, each one waking the next, and the canvas takes over as it passes the ring.',
      },
    ]
  }
  if (u === null) {
    return [
      {
        icon: '😴',
        text: `The axon is at rest. All ${PATCHES} stripes are sitting at ${traj.rest.toFixed(
          0,
        )} mV with their doors shut — every one of them the same, and none of them waiting for anything to arrive.`,
      },
      {
        icon: '⚡',
        text: 'Press ⚡ to fire an action potential. It starts at the near end, where the axon leaves the cell body — which is where a real one always starts, and the reason the signal only ever goes one way.',
      },
    ]
  }

  const r = fibreWave(traj, u)
  const out: TeachingPara[] = []

  if (r.frontUm === null) {
    out.push({
      icon: '⏳',
      text: `${r.ms.toFixed(
        1,
      )} ms in, and no patch has crossed zero yet. The push is charging the membrane where the electrode is; whether that turns into anything is up to the sodium doors there.`,
    })
    return out
  }

  out.push({
    icon: '📍',
    text: `${r.ms.toFixed(1)} ms in. The furthest patch to have fired is ${mm(
      r.frontUm,
    )} from the near end. It did not receive anything that started at the beginning — it was pushed over the line by the patch next to it, which was pushed by the one next to that.`,
  })

  out.push(
    r.activeUm > 0
      ? {
          icon: '🔥',
          text: `About ${mm(r.activeUm)} of axon is above zero right now — roughly ${Math.max(
            1,
            Math.round(r.activeUm / PATCH_UM),
          )} of the stripes. Their sodium doors are open. Everything else on screen has its sodium doors shut, for one of two quite different reasons.`,
        }
      : {
          icon: '🌑',
          text: 'No patch is above zero at this moment: the wave has passed, or it never got going. Any blue still on the axon is the after-dip — potassium doors are slow to shut, so freshly fired membrane sits below its resting voltage for a few milliseconds before drifting back. It is recovering, not stuck; watch it drain to grey.',
        },
  )

  if (r.refractoryUm > 0) {
    out.push({
      icon: '🧊',
      text: `${mm(
        r.refractoryUm,
      )} is BELOW its resting voltage — the blue tail. Those patches have just fired: their potassium doors are still open and their sodium doors are latched. That is the first reason, and it is why nothing comes back the way it came.`,
    })
  }
  if (r.untouchedUm > 0) {
    out.push({
      icon: '⬜',
      text: `${mm(
        r.untouchedUm,
      )} has not been touched at all yet — the second reason. Those doors are shut because nothing has happened to them, and they are perfectly able to open the moment their neighbour depolarizes them.`,
    })
  }
  return out
}

function seeing(
  traj: FibreRun,
  drawnAxonUm: number,
  patch: number,
): TeachingPara[] {
  const geo = ribbonGeometry(STAGE_W, STAGE_H, AXON_W * AXON_VIEW_SCALE)
  const nm = Math.round(lensNm(geo))
  const squash = Math.round(lengthSquash(geo, AXON_DIAMETER_UM))
  const bigger = Math.round(lensMagnification(geo)).toLocaleString('en-GB')
  const speck = Math.round(1 / spotTruePx(geo))
  const along = ((patchCentre(patch) * VIEW_LENGTH_UM) / 1000).toFixed(2)
  return [
    {
      icon: '🔬',
      text: `A ${(VIEW_LENGTH_UM / 1000).toFixed(
        0,
      )} mm stretch of this neuron's axon, cut open along its length: outside above and below, cytoplasm in the middle. Each stripe is ${PATCH_UM} µm of membrane.`,
    },
    {
      icon: '🪢',
      text: `How thick the tube is drawn is TRUE — that is this axon's real 1.4 µm at the magnification the camera has flown to. Its length is squashed about ${squash} times, because six millimetres will not fit on a screen otherwise. Like drawing a long garden hose short but just as thick: the amber mark on the ruler is the whole of the axon from the main picture, at the ruler's own scale.`,
    },
    {
      icon: '🎨',
      text: 'Colour means what it means at the membrane patch: red is depolarized, blue is more negative than resting, grey is resting. The yellow glow around the cable is the same yellow as the whole-neuron picture, and means the same thing there: a signal is here. It sits on the crest, right where the blue tail behind it begins.',
    },
    {
      icon: '📈',
      text: `Under the axon is a graph of the same instant: voltage down the side, distance along the bottom. The two dotted lines across it are the resting voltage, ${traj.rest.toFixed(
        0,
      )} mV, and zero. The white dashed line standing up through everything marks the furthest patch to have fired yet.`,
    },
    {
      icon: '🟡',
      text: `Yellow means a signal is here, the same as it does on the whole-neuron picture. On the little cell above it starts out at the dendrites and fades as it spreads in — that is what graded means — then goes down the axon piece by piece, each one waking the next. ${
        traj.myelinated
          ? 'Those pale beads on it are the myelin from the canvas, drawn small: the light can only come on in the gaps between them, twelve sparks with nothing in between.'
          : 'It is bare, so it lights all the way along.'
      } When it passes the ring, the canvas takes over.`,
    },
    {
      icon: '🗺️',
      text: `The little cell above is a map of this same stretch — the same six millimetres, drawn along the neuron instead of along a ruler, with the ring marking where the canvas is looking. Both are lit by the same reading of the same run, so they cannot disagree. Its axon is squashed even harder than this one: the cell as drawn has only ${Math.round(
        drawnAxonUm,
      )} µm of axon, which is the short amber bar on the ruler below.`,
    },
    {
      icon: '📐',
      text: `Along the bottom, millimetres of real axon. The short amber bar at the left end is the whole of the axon drawn on the main picture — all ${Math.round(
        drawnAxonUm,
      )} µm of it — at the same scale as the rest of the ruler.`,
    },
    traj.myelinated
      ? {
          icon: '🔎',
          text: `Click anywhere to move the magnifying glass — on this fibre it snaps to the nearest node, because the nodes are where everything happens. The lens shows what the little ring is sitting on: the bare gap, its doors crowded together, and the stepped ends of the two sleeves closing in from either side. One squeeze to own up to: a real node is about a micrometre wide — twenty of these lenses — so the sleeve ends are pulled into frame to show what the ring sits between.`,
        }
      : {
          icon: '🔎',
          text: `Each stripe of the cable is ${PATCH_UM} µm of membrane. Click any of them to move the magnifying glass. The little ring is sitting on the membrane ${along} mm along; the big lens is that same spot blown up until its molecules show — about ${nm} nanometres across, drawn ${bigger} times bigger than the axon underneath it, with the same lipids and the same doors you met inside the membrane patch. Millimetres on the ruler, nanometres in the lens: both are this axon.`,
        },
    {
      icon: '🎯',
      text: `One thing about that ring is a cheat, and worth knowing: it is far bigger than the speck it marks. The piece of membrane in the lens is only about a ${speck}th of a pixel wide down on the axon — far too small to point at — so the ring is drawn big enough to see and to match the lens it belongs to. Everything inside the lens is to scale; the ring is a signpost.`,
    },
    {
      icon: '🚪',
      text: 'The little tan shapes on the walls are doors — a sodium one and a potassium one, side by side. They are a sample, not a count: a stretch of membrane that size holds millions, far too many and far too small to draw. Two things about them are honest. How far open they are, which is read straight off that patch’s own gates. And WHERE they are: all along a bare axon, because every patch of it rebuilds the signal — and only in the gaps once the sheath is on, packed tighter, with nothing under the sleeves at all.'
    },
    cableFacts(readingOfFibre(traj), drawnAxonUm).nothingMoves,
  ]
}

export function AxonInfoPanel() {
  const counts = useIonStore((s) => s.counts)
  const leaksOn = useMembraneStore((s) => s.leaksOn)
  const u = useAxonStore((s) => s.u)
  const patch = useAxonStore((s) => s.patch)
  const lead = useAxonStore((s) => s.lead)
  const mode = useAxonStore((s) => s.mode)
  const myelin = mode !== 'bare'
  const stimulus = useAxonStore((s) => s.stimulus)
  // The same memoised integration the stage draws from — one cache, so the words
  // and the picture cannot be describing different runs.
  const traj = useMemo(
    () =>
      fibreRun(counts, leaksOn, STIMULI[stimulus].amplitude, viewFibre(myelin)),
    [counts, leaksOn, stimulus, myelin],
  )
  // The same fibre without its sheath, so the speed can be quoted against
  // something rather than asserted. Memoised, and warmed already if the toggle has
  // been used, so this costs nothing most of the time.
  // Both fibres, so the comparison can be quoted whichever one is on show.
  // Memoised, and the one you are watching is already computed, so this costs a
  // single extra run at most.
  const bare = useMemo(
    () => fibreRun(counts, leaksOn, STIMULI[stimulus].amplitude, viewFibre(false)),
    [counts, leaksOn, stimulus],
  )
  const sheathed = useMemo(
    () => fibreRun(counts, leaksOn, STIMULI[stimulus].amplitude, viewFibre(true)),
    [counts, leaksOn, stimulus],
  )
  const bareSpeed = bare.speedMs
  // The race's own pair — same window, untrimmed, which is what the canvas draws,
  // so the times quoted are the times shown.
  const raceBare = useMemo(
    () => fibreRun(counts, leaksOn, STIMULI[stimulus].amplitude, viewFibre(false, true)),
    [counts, leaksOn, stimulus],
  )
  const raceWrapped = useMemo(
    () => fibreRun(counts, leaksOn, STIMULI[stimulus].amplitude, viewFibre(true, true)),
    [counts, leaksOn, stimulus],
  )
  const drawnAxonUm = DRAWN_AXON_UM
  const facts = cableFacts(readingOfFibre(traj), drawnAxonUm)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
      {mode === 'race' && (
        <Section title="The race" paragraphs={raceFacts(raceBare, raceWrapped)} />
      )}
      <Section title="Why wrap an axon in fat?" paragraphs={whyMyelinFacts(bare, sheathed)} />
      {myelin && (
        <Section title="Wrapped in myelin" paragraphs={myelinFacts(traj, bareSpeed)} />
      )}
      <Section title="Right now" paragraphs={rightNow(traj, u, lead)} />
      <Section title="What am I seeing?" paragraphs={seeing(traj, drawnAxonUm, patch)} />
      <Section
        title="Why this view is millimetres long"
        paragraphs={[facts.saltyWater, facts.whyMillimetres]}
      />
      <Section
        title="What this run measured"
        paragraphs={[facts.measuredSpeed, facts.whyMyelin, facts.noFade, facts.noGoingBack]}
      />
      <Section
        title="What this leaves out"
        paragraphs={[
          {
            icon: '⏱️',
            text: `Why the little cell above lights all at once, and does not show the signal setting off down its axon: it cannot. That axon is ${Math.round(
              DRAWN_AXON_UM,
            )} µm long, and at the speed this run measured a spike crosses the whole of it in about ${(
              (DRAWN_AXON_UM / 1000 / Math.max(traj.speedMs, 0.01)) *
              1000
            ).toFixed(
              0,
            )} millionths of a second — while one patch takes about two thousandths of a second to rise and fall. The journey along that axon is a few per cent of one spike. Drawing it as a journey you could watch would have shown this cell having a head-to-tail delay it does not have, so it is drawn the way it happens: together.`,
          },
          { icon: '🧾', text: CABLE_SIMPLIFICATION },
          {
            icon: '📐',
            text: `One length constant here is about ${Math.round(
              lengthConstantUm(),
            )} µm, worked out from this axon's width, its leak and the resistance of its own cytoplasm. Nothing about the size of this view was chosen to look right.`,
          },
        ]}
      />
    </div>
  )
}
