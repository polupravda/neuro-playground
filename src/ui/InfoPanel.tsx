import {
  NETWORK_CONTEXT,
  NEURON_OVERVIEW,
  type TeachingPara,
  neuronPart,
} from '../core/neuron'
import { inputsNeededToFire, reachesThreshold } from '../core/integration'
import { membraneScaleNote } from '../core/membrane'
import { gradientFrom } from '../core/ions'
import { useIonStore, type IonCounts } from '../state/ionStore'
import { ZOOM_TARGETS } from '../stage/layout'
import { DEMOS, useDemoStore } from '../state/demoStore'
import { AxonInfoPanel } from './AxonInfoPanel'
import { LeakyInfoPanel } from './LeakyInfoPanel'
import { SynapseInfoPanel } from './SynapseInfoPanel'
import type { ChainPhase } from '../stage/chain'
import { useNeuronStore } from '../state/neuronStore'
import { useMembraneStore } from '../state/membraneStore'
import { useApStore } from '../state/apStore'
import { useChangeStore } from '../state/experiment'
import { apFacts, apRestMv, voltageNote, type ApPhase } from '../core/actionPotential'
import { DWELL_TOTAL_MS } from '../core/apSteps'
import { MembraneParts, ProteinControl, proteinFacts, proteinLabel } from './MembraneParts'

// The F01/F03 explanation layer: a live describer beside the canvas in the
// shared house style. "Right now" is LIVE (it would lie if it lagged); the
// middle section follows the selection, the zoom, or the running chain.

/** Exported so the bench's own describer is literally the same component rather
 *  than a second thing that resembles it — the house style is one border, one
 *  heading treatment, one icon column, everywhere. */
export function Section({
  title,
  paragraphs,
}: {
  title: string
  paragraphs: TeachingPara[]
}) {
  return (
    <div className="border-t border-slate-700/60 pt-2 first:border-t-0 first:pt-0">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">
        {paragraphs.map((p, i) => (
          <p key={i} className="flex gap-2 text-sm text-slate-200">
            <span aria-hidden>{p.icon}</span>
            <span>{p.text}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** X01, folded into the explanation block: the answer to whatever was just
 *  pressed. Sticky — it stays until the next change, so it can be read at
 *  leisure — and first, because a consequence below the fold goes unread. */
function WhatJustChanged() {
  const change = useChangeStore((s) => s.last)
  if (!change) return null
  return (
    <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-2">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-sky-300/80">
        What just changed
      </h3>
      <div className="flex flex-col gap-1">
        {[
          { icon: '👆', text: change.what, tone: 'text-slate-100' },
          { icon: '➡️', text: change.immediate, tone: 'text-slate-200' },
          { icon: '🔗', text: change.downstream, tone: 'text-slate-300' },
        ].map((line, i) => (
          <p key={i} className={`flex gap-2 text-[13px] leading-snug ${line.tone}`}>
            <span aria-hidden>{line.icon}</span>
            <span>{line.text}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

/** Live narration of a spike, phase by phase (N16). Each one names the CAUSE of
 *  what is on screen, not just what it looks like. */
function apNarration(phase: ApPhase): TeachingPara[] {
  switch (phase) {
    case 'rising':
      return [
        {
          icon: '🚀',
          text: 'The sodium doors flew open and sodium is pouring in. Each one brings a positive charge with it, so the inside is racing upward — this is the upstroke, and it is happening because sodium was crowded outside all along.',
        },
      ]
    case 'falling':
      return [
        {
          icon: '📉',
          text: 'The sodium doors are already swinging shut — they do that on their own, even while the membrane is still depolarized. Meanwhile the slow potassium doors have finally opened, and every potassium that leaves takes positive charge back out with it. Down it comes.',
        },
      ]
    case 'undershoot':
      return [
        {
          icon: '🔽',
          text: 'Past resting, and still falling. The potassium doors are slow to shut, so for a moment more potassium can leave than usual and the inside goes MORE negative than it started. This dip is why a neuron needs a breather before it can fire again.',
        },
      ]
    case 'recovering':
      return [
        {
          icon: '↩️',
          text: 'The potassium doors are closing and the voltage is drifting back to rest. Nothing had to push it back — with only the leaks left open, resting is simply where it settles.',
        },
      ]
    default:
      return []
  }
}

/** Live narration of the causal chain — the teaching payoff of a run. */
function chainNarration(phase: ChainPhase, inputs: number): TeachingPara[] {
  const n = inputs
  const fires = reachesThreshold(n)
  switch (phase) {
    case 'input-fires':
      return [
        {
          icon: '⚡',
          text: `${n} input ${plural(n, 'neuron', 'neurons')} fired. ${plural(
            n,
            'It is sending',
            'Each is sending',
          )} an action potential down its own axon toward this neuron.`,
        },
      ]
    case 'crossing':
      return [
        {
          icon: '🫧',
          text: 'The signal reached the bouton and stops there — it cannot jump the gap. Chemical messengers carry it across instead, which is why there is a tiny delay.',
        },
      ]
    case 'dendrite':
      return [
        {
          icon: '📉',
          text: 'The messengers landed on the dendrite and started a ripple. Watch it shrink as it spreads inward: graded signals fade with distance.',
        },
      ]
    case 'summing':
      return [
        {
          icon: '➕',
          text: `The ${plural(n, 'ripple has', 'ripples have')} arrived and added up. The meter beside the axon shows the total at the hillock, with threshold marked in red.`,
        },
      ]
    case 'fizzled':
      return [
        {
          icon: '😴',
          text: 'Not enough. The total never reached threshold, so it simply leaks away — nothing is sent down the axon. The signal did not vanish; it faded, like a ripple in water.',
        },
        {
          icon: '💡',
          text: `Try firing ${inputsNeededToFire(3)} or more inputs together.`,
        },
      ]
    case 'axon':
      return [
        {
          icon: '🚀',
          text: 'Threshold crossed! The hillock launched an action potential. Notice where it began: right at the start of the axon, never partway along it.',
        },
        {
          icon: '📏',
          text: 'It is rebuilt patch by patch as it goes, so it arrives just as strong as it started — nothing like the fading ripple in the dendrite.',
        },
      ]
    case 'terminal':
      return [
        {
          icon: '🫧',
          text: 'It arrived at the boutons. Vesicles move to the membrane and spill chemical messengers into the next gap — electrical becomes chemical again.',
        },
      ]
    case 'target':
      return [
        {
          icon: '➡️',
          text: 'The target neuron received one small ripple. On its own that is not enough to fire it — it needs its own crowd of inputs, exactly like this neuron did.',
        },
      ]
    case 'done':
      return fires
        ? [
            {
              icon: '✅',
              text: `One complete chain: ${n} inputs fired, messengers crossed, ripples faded inward, the total crossed threshold, the hillock launched an action potential, and the target got a nudge.`,
            },
            {
              icon: '🔁',
              text: 'Fire a single input next, and watch what happens when the total falls short.',
            },
          ]
        : [
            {
              icon: '🔁',
              text: `Nothing was sent. Fire ${inputsNeededToFire(3)} or three inputs together to cross threshold.`,
            },
          ]
    default:
      return []
  }
}

/** Live description of the gradients the kid has actually set up. This is the
 *  payoff of being able to change them: flatten sodium and the sentence stops
 *  claiming a gradient. */
function gradientSummary(counts: IonCounts): TeachingPara {
  const na = gradientFrom(counts.na.outside, counts.na.inside)
  const k = gradientFrom(counts.k.outside, counts.k.inside)
  const way = (d: ReturnType<typeof gradientFrom>) => (d === 'inward' ? 'in' : 'out')

  if (na === 'balanced' && k === 'balanced') {
    return {
      icon: '😐',
      text: 'Both sides are even now. With no gradient there is nothing stored — even a wide-open doorway would move nothing anywhere.',
    }
  }
  if (na === 'balanced' || k === 'balanced') {
    const flat = na === 'balanced' ? 'Sodium' : 'Potassium'
    const other = na === 'balanced' ? 'potassium' : 'sodium'
    const dir = na === 'balanced' ? k : na
    return {
      icon: '⚖️',
      text: `${flat} is evenly spread, so it has nothing stored. Only ${other} still would move — ${way(
        dir,
      )}wards — if a doorway opened.`,
    }
  }
  return {
    icon: '⚖️',
    text: `As it stands, sodium would rush ${way(na)} and potassium would rush ${way(
      k,
    )} — if there were any way through. There is not, yet.`,
  }
}

export function InfoPanel() {
  const counts = useIonStore((s) => s.counts)
  const selected = useNeuronStore((s) => s.selected)
  const run = useNeuronStore((s) => s.run)
  const phase = useNeuronStore((s) => s.phase)
  const zoom = useNeuronStore((s) => s.zoom)
  const protein = useMembraneStore((s) => s.selected)
  // Narrow selectors on purpose: the live reading changes every frame, and
  // only the phase name is wanted here.
  const apPhase = useApStore((s) => s.live?.phase ?? null)
  const demo = useDemoStore((s) => s.demo)
  // Bucketed to the millivolt: this changes every frame, and the sentence it
  // feeds only changes at three boundaries.
  const liveVm = useApStore((s) => (s.live ? Math.round(s.live.vm) : null))
  const leaksForRest = useMembraneStore((s) => s.leaksOn)
  const part = selected === null ? null : neuronPart(selected)
  const target = ZOOM_TARGETS.find((t) => t.id === zoom)
  const atMembrane = target?.frame !== undefined

  // The stretch of axon has its own describer: almost nothing in this one
  // applies out there — no part is selectable, no protein is on show, and the
  // chain that runs across the whole neuron is not what is happening.

  // ⚠ TWO VIEWS PRESENT 'axon' NOW (2026-08-31), and they are about different
  // things: one follows a spike being rebuilt, the other watches a voltage
  // fade with nothing rebuilding it. Same flag, different describer — routed on
  // the target's own id rather than on what it presents.
  if (zoom === 'axon-passive') return <LeakyInfoPanel />
  // The synapse is its own kind of place — nothing in the general describer
  // applies out here either: the parts are not selectable, and what is
  // happening is one terminal's own event rather than the cell's.
  if (target?.presents === 'synapse') return <SynapseInfoPanel />
  if (target?.presents === 'axon') return <AxonInfoPanel />
  const running = run !== null && phase !== 'idle'

  const rightNow: TeachingPara[] = apPhase
    ? [
        ...apNarration(apPhase),
        // The sentence that used to be painted under the voltage reading on the
        // canvas. It belongs here: the canvas is for the picture.
        ...(liveVm === null
          ? []
          : [{ icon: '🌡️', text: voltageNote(liveVm, apRestMv(counts, leaksForRest)) } as TeachingPara]),
      ]
    : running
    ? chainNarration(phase, run.inputs.length)
    : target
      ? [
          {
            icon: '🔎',
            text: `Zoomed into the ${target.label.toLowerCase()}, magnified ×${target.scale}. Everything is the same scene — just much closer.`,
          },
          // At a membrane patch the gradients are live: change a count and this
          // sentence changes with it, before any channel exists.
          ...(target.frame ? [gradientSummary(counts)] : []),
          // What the exhibit on this patch is asking. It used to be printed under
          // the exhibit's name INSIDE its button; a button is a name you act on,
          // not a paragraph you read, so the question lives here now.
          ...(target.frame ? [demoQuestion(demo)] : []),
        ]
      : part
        ? [
            {
              icon: part.icon,
              text: `Looking at the ${part.name.toLowerCase()}: ${part.role.toLowerCase()}.`,
            },
            { icon: '🔀', text: part.flow },
          ]
        : [
            {
              icon: '😴',
              text: 'Everything is resting. Nothing moves until an input neuron fires — signals never start on their own.',
            },
          ]

  // A selected protein wins the middle section: it is the most specific thing
  // the kid has asked about.
  const middle: { title: string; paragraphs: TeachingPara[] } = protein
    ? { title: proteinLabel(protein), paragraphs: proteinFacts(protein) }
    : target
    ? {
        title: target.label,
        // A target whose view is actually built shows its content; one that is
        // still a placeholder says so plainly.
        paragraphs: target.content ?? [
          { icon: '🚧', text: target.promise },
          { icon: '🗺️', text: `Coming with the ${target.roadmap}.` },
        ],
      }
    : part
      ? { title: part.name, paragraphs: part.explanation }
      : { title: 'What am I seeing?', paragraphs: NEURON_OVERVIEW }

  const simplification: TeachingPara[] = apPhase ? apFacts(DWELL_TOTAL_MS) : running
    ? [
        {
          icon: '⏱️',
          text: 'Slowed right down: in a real neuron this whole chain takes a few thousandths of a second.',
        },
      ]
    : target
      ? [
          {
            icon: '📏',
            // A built membrane view can state the real numbers; a placeholder
            // target can only own up to the drawing's distortions.
            text: target.content
              ? membraneScaleNote(target.scale)
              : 'Sizes in this drawing are deliberately distorted — small parts like boutons and synaptic gaps are drawn far bigger than they really are, so they can be seen at all.',
          },
        ]
      : part
        ? [{ icon: '💡', text: part.simplification }]
        : NETWORK_CONTEXT

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
      <WhatJustChanged />
      <Section title="Right now" paragraphs={rightNow} />
      {/* The membrane's contents list, as navigation into the section below. */}
      {atMembrane && (
        <div className="border-t border-slate-700/60 pt-2">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            What is in this membrane
          </h3>
          <MembraneParts />
          <p className="mt-1 px-1 text-[11px] leading-snug text-slate-500">
            Tap a name to read about it. Each one answers to its own cause — there
            is no button that simply opens a channel.
          </p>
        </div>
      )}
      <Section title={middle.title} paragraphs={middle.paragraphs} />
      {protein && <ProteinControl id={protein} />}
      <Section
        title={running || target ? 'Keep in mind' : 'What this simplifies'}
        paragraphs={simplification}
      />
    </div>
  )
}

/** The question the exhibit now on this patch is asking.
 *
 *  Lives here rather than under its own button. See the note at the call site: a
 *  description inside an active element is a paragraph in a place built for a
 *  press, and this app keeps its words in one place. */
function demoQuestion(id: string): TeachingPara {
  const demo = DEMOS.find((d) => d.id === id)
  return { icon: '🎯', text: demo ? demo.asks : 'Pick something for this membrane to show.' }
}
