import { Section } from './InfoPanel'
import { LEAKY_HONESTY, LEAKY_PARTS, leakyRightNow } from '../core/leaky'

// D05's describer, in the column — where every other view's words live.
//
// ⚠ IT USED TO BE A DRAWER'S OWN SIDEBAR (user, 2026-08-31: "you've placed the
// bench in the drawer. Instead, let's follow 'Axonal conduction and myelin'
// pattern"). A drawer brings its own column and covers the app's; a place uses
// the app's. Same three sections, one fewer column in the app.
//
// The stretch of axon has its own describer for the same reason the conduction
// view does: almost nothing in the general one applies out here — no part is
// selectable, no protein is on show, and the chain that runs across the whole
// neuron is not what is happening.

export function LeakyInfoPanel() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
      <Section title="What this is" paragraphs={LEAKY_PARTS} />
      <Section title="Right now" paragraphs={leakyRightNow({ myelin: false })} />
      <Section title="Keep in mind" paragraphs={LEAKY_HONESTY} />
    </div>
  )
}
