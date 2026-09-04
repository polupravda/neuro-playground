import { useMemo } from 'react'
import type { TeachingPara } from '../core/neuron'
import { Section } from './InfoPanel'
import { useIonStore } from '../state/ionStore'
import { useMembraneStore } from '../state/membraneStore'
import { useSynapseStore } from '../state/synapseStore'
import { synapseRun, sampleSynapse, synapseFacts, HILL_N, SYNAPSE_MS } from '../core/synapse'
import { cleftRun, sampleCleft, cleftFacts } from '../core/cleft'
import { CLOCK_LEGS, SCALE_NOTES, SYNAPSE_SCREEN_MS, synapseClock } from '../stage/synapseScene'

// S12's describer. Same shape as every other view's: what is true at THIS
// instant first, then what the picture is, then the footnotes.
//
// ⚠ EVERY NUMBER IS MEASURED OFF THE RUN, never narrated. The temptation on a
// view like this is to tell the story you meant to tell — "the vesicle goes
// now" — and be wrong when the gradients have been changed and nothing went at
// all. Release is genuinely probabilistic and a run where none of the five
// vesicles fuses is a real outcome the describer has to be able to report.

function rightNow(
  u: number | null,
  gate: number,
  caLocal: number,
  went: number,
  mM: number,
  open: number,
): TeachingPara[] {
  if (u === null) {
    return [
      {
        icon: '😴',
        text: 'The terminal is at rest. The calcium doors are shut, five vesicles are parked against the wall waiting, and the gap is empty. Nothing here happens on its own — it waits for a spike to arrive down the axon.',
      },
      {
        icon: '⚡',
        text: 'Press ⚡ to send one. Watch the order of it: the spike gets here FIRST, the doors open after it, the calcium comes in after that, and only then does anything leave. Each step waits for the one before.',
      },
    ]
  }
  const out: TeachingPara[] = []
  if (gate > 0.02) {
    out.push({
      icon: '🚪',
      text: `The calcium doors are ${Math.round(gate * 100)}% open, and calcium at their mouths is up to ${caLocal.toFixed(0)} µM — that is what the sensor on each vesicle can feel, not the average across the whole terminal.`,
    })
  }
  out.push(
    went === 0
      ? {
          icon: '🎲',
          text: `Nothing has gone yet. Each vesicle needs ${HILL_N} calcium ions on its sensor and then it is still a matter of chance — five vesicles, five separate gambles. Some spikes release nothing at all.`,
        }
      : {
          icon: '🫧',
          text: `${went} of the five vesicles ${went === 1 ? 'has' : 'have'} fused — opened into the wall and emptied into the gap.`,
        },
  )
  if (mM > 0.005) {
    out.push({
      icon: '💨',
      text: `There is ${mM.toFixed(2)} mM of transmitter in the gap and ${Math.round(open * 100)}% of the receptors opposite are open. Notice the transmitter did not have to travel — it appears already spread, because crossing 20 nm takes under a microsecond.`,
    })
  }
  return out
}

export function SynapseInfoPanel() {
  const counts = useIonStore((s) => s.counts)
  const leaksOn = useMembraneStore((s) => s.leaksOn)
  const u = useSynapseStore((s) => s.u)

  const run = useMemo(() => synapseRun(counts, leaksOn), [counts, leaksOn])
  const cleft = useMemo(() => cleftRun(run), [run])

  // The store holds the SCREEN's position; the model's is not the same number.
  const at = u === null ? 0 : synapseClock(u)
  const gate = u === null ? 0 : sampleSynapse(run, 'open', at)
  const caLocal = u === null ? 0 : sampleSynapse(run, 'caLocalUm', at)
  const mM = u === null ? 0 : sampleCleft(cleft, 'mM', at)
  const open = u === null ? 0 : sampleCleft(cleft, 'open', at)
  const went =
    u === null
      ? 0
      : run.vesicles.filter((v) => v.fusedAtMs !== null && v.fusedAtMs <= at * run.windowMs).length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
      <Section title="Right now" paragraphs={rightNow(u, gate, caLocal, went, mM, open)} />
      <Section title="What this is" paragraphs={synapseFacts(run, counts)} />
      <Section title="Across the gap" paragraphs={cleftFacts(cleft)} />
      <Section
        title="Keep in mind"
        paragraphs={[
          ...SCALE_NOTES.map((text) => ({ icon: '📏', text })),
          {
            icon: '🐢',
            text: `Slowed down about ${Math.round(SYNAPSE_SCREEN_MS / SYNAPSE_MS)}× on average — and NOT evenly. The whole event really takes ${SYNAPSE_MS} thousandths of a second, but the packet is only in the gap for about one of them, so that one thousandth gets ${Math.round(CLOCK_LEGS[1].share * 100)}% of the screen time and the long quiet tail gets the rest. Nothing inside a stretch is sped up or slowed down; only how much screen each stretch is given.`,
          },
          {
            icon: '⚠️',
            text: 'And one thing this picture cannot show on its own: ONE synapse doing this does not fire the next neuron. It moves that cell about half a millivolt. It takes many of them, arriving close together, before anything happens at the hillock.',
          },
        ]}
      />
    </div>
  )
}
