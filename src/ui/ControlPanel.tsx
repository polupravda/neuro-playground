import { INPUTS, ZOOM_TARGETS, isOwnView } from '../stage/layout'
import { useNeuronStore } from '../state/neuronStore'

// One control beside the canvas: how many inputs fire together.
//
// It used to hold a list of the neuron's parts and two hint sentences as well.
// Both went the same way, for the same reason: the canvas already carries them.
// The parts are labelled out there and clicking one selects it; the zoom rings are
// dashed and marked 🔎. A panel that indexes a labelled drawing is a second index,
// and a sentence explaining a visible affordance is explanation in the one place
// this app has decided explanation does not go.
//
// What is left is genuinely not on the canvas: "fire two inputs TOGETHER" is a
// choice about a set, and there is nothing out there to click that means it.

const FIRE_OPTIONS: Array<{ count: number; label: string }> = [
  { count: 1, label: 'one' },
  { count: 2, label: 'two' },
  { count: 3, label: 'all three' },
]

export function ControlPanel() {
  const run = useNeuronStore((s) => s.run)
  const zoom = useNeuronStore((s) => s.zoom)
  const fire = useNeuronStore((s) => s.fire)
  const target = ZOOM_TARGETS.find((t) => t.id === zoom)

  // Inside a view of its own — a membrane patch, or the stretch of axon —
  // neither of these has anything to act on: no part of the neuron is visible to
  // select, and a signal fired out there would show nothing in here. Controls
  // follow the view.
  // With the parts list gone this panel is one block, so it leaves entirely rather
  // than rendering an empty box that still costs the column a gap.
  if (isOwnView(target)) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-2">
        <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Fire inputs together
        </h3>
        <div className="flex gap-1">
          {FIRE_OPTIONS.map((option) => (
            <button
              key={option.count}
              type="button"
              onClick={() => fire(INPUTS.slice(0, option.count).map((i) => i.id))}
              disabled={run !== null}
              className="flex-1 rounded-lg bg-slate-700 px-2 py-1.5 text-sm text-slate-100 transition hover:bg-sky-600 disabled:opacity-40 disabled:hover:bg-slate-700"
            >
              ⚡ {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* The list of parts used to be here: a row per part, each with what it
          does printed under its name. It has gone entirely. The parts are LABELLED
          on the canvas and clicking one there selects it — which is the same
          affordance, in the place the thing actually is, and it was always the
          better one. A list beside a labelled drawing is a second index to
          something that is already indexed.

          Nothing was lost with it: selecting a part still fills the describer with
          what that part is and does, exactly as before. */}
      {/* Zooming out lives on the canvas now, beside where you clicked to zoom
          in — so both directions are worked from the same place. */}
      {/* And the "click a dashed ring to zoom in" hint has gone too. The rings are
          on the canvas, dashed, with a 🔎 on them; a sentence in the column
          explaining a thing that is visible and obvious out there is explanation in
          the place this app has decided explanation does not go. */}
    </div>
  )
}
