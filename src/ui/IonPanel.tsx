import { ResetButton } from './ResetButton'
import {
  ION_KINDS,
  IONS,
  MAX_PARTICLES,
  PARTICLE_STEP,
  chargeTag,
  type IonKind,
  type Side,
} from '../core/ions'
import { flowNote, flowOf, type Flow } from '../core/driving'
import { apRestMv } from '../core/actionPotential'
import { useMembraneStore } from '../state/membraneStore'
import { ZOOM_TARGETS } from '../stage/layout'
import { GLOSSY_COLORS } from '../stage/particleStyle'
import { inColour, useIonStore } from '../state/ionStore'
import { useApStore } from '../state/apStore'
import { resetIons, setIonCount } from '../state/experiment'
import { useNeuronStore } from '../state/neuronStore'

// N09: the gradients are the kid's to change. Only shown at a membrane patch,
// where inside and outside are both on screen.
//
// What a spike does to these concentrations is NOT shown here — it belongs with
// the action potential itself (N17), not tucked into the resting-state controls.
// All that happens here during a spike is that the sliders lock.

// Which way an ion is actually pushed, at the voltage the membrane is at.
//
// This used to read the concentration gradient alone — "crowded outside, so it
// would come in" — which is half the story and leaves out the half worth
// teaching. An ion is pushed by its crowding AND by the voltage, and where those
// two cancel it does not move at all, however wide the door.
const FLOWS: Record<Flow, { text: string; tone: string }> = {
  in: { text: '↓ pushed in', tone: 'text-amber-300' },
  out: { text: '↑ pushed out', tone: 'text-amber-300' },
  none: { text: '⏸ not pushed', tone: 'text-slate-400' },
}

/** The two piles, one row each, stacked the way the canvas stacks them: outside
 *  above the membrane, inside below it, with a membrane rule between.
 *
 *  These used to sit side by side with the outside half MIRRORED, so that both
 *  fills grew outward from a central membrane. It read well and controlled
 *  badly, and the fault was not merely that one slider ran backwards: the two
 *  sliders for the SAME ion answered the same gesture in opposite directions.
 *  Drag right on the inside bar for more, drag right on the outside bar for
 *  less. Adjacent controls, one hand movement, two meanings.
 *
 *  The mirrored version was also claiming a correspondence it did not have. It
 *  put outside to the LEFT and inside to the RIGHT, while the picture beside it
 *  puts outside ABOVE the membrane and inside BELOW. Stacking them fixes the
 *  control and earns the spatial claim at the same time — and costs no height,
 *  because each number moves onto its own row instead of sitting under both.
 *
 *  Both bars now share a left baseline, which is also how anything measurable
 *  gets compared: back-to-back bars show asymmetry nicely but make two lengths
 *  running in opposite directions genuinely hard to judge against each other. */
function ConcentrationRows({
  kind,
  colour,
  locked,
}: {
  kind: IonKind
  colour: boolean
  locked: boolean
}) {
  const outside = useIonStore((s) => s.counts[kind].outside)
  const inside = useIonStore((s) => s.counts[kind].inside)
  const color = colour ? GLOSSY_COLORS[kind].mid : '#5c6675'

  const row = (side: Side, value: number, label: string) => (
    <div className="flex items-center gap-1.5">
      <span className="w-6 shrink-0 text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={MAX_PARTICLES}
        step={PARTICLE_STEP}
        value={value}
        disabled={locked}
        onChange={(e) => setIonCount(kind, side, Number(e.target.value))}
        aria-label={`${IONS[kind].name} ${side} the cell, in millimolar`}
        className="h-1.5 w-full cursor-pointer disabled:cursor-default"
        style={{ accentColor: color }}
      />
      <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-slate-200">
        {value}
      </span>
    </div>
  )

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {row('outside', outside, 'out')}
      {/* The membrane, in the same place it is in the picture: between them. */}
      <div className="ml-7 mr-8 h-px bg-slate-500/70" />
      {row('inside', inside, 'in')}
    </div>
  )
}

export function IonPanel() {
  const zoom = useNeuronStore((s) => s.zoom)
  const counts = useIonStore((s) => s.counts)
  const leaksOn = useMembraneStore((s) => s.leaksOn)
  const liveVm = useApStore((s) => s.live?.vm ?? null)
  const focused = useIonStore((s) => s.focused)
  const focus = useIonStore((s) => s.focus)
  const clearFocus = useIonStore((s) => s.clearFocus)
  const spiking = useApStore((s) => s.u !== null)
  const focusing = useApStore((s) => s.u !== null && s.spotlight)
  const target = ZOOM_TARGETS.find((t) => t.id === zoom)
  if (!target?.frame) return null

  const anyFocused = ION_KINDS.some((k) => focused[k])
  // The voltage the flow answers are given at: whatever the spike is doing, or
  // simply where the membrane rests.
  const vm = liveVm ?? apRestMv(counts, leaksOn)
  // The cell's own concentrations, and the spike is computed from them — so they
  // are read-only while one is running. Changing them is the bench's job, on its
  // own copy, because a lab bench must not reach into the cell.
  const editable = !spiking

  return (
    <div
      className={`shrink-0 overflow-y-auto rounded-xl border p-2 transition-colors ${
        spiking ? 'border-amber-500/50 bg-amber-500/5' : 'border-slate-700 bg-slate-800/60'
      }`}
      style={{ maxHeight: '46%' }}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Ions across this membrane
        </h3>
        {spiking ? (
          // The sliders are locked for a mechanical reason: the spike is worked
          // out FROM these counts, so moving them mid-spike would rewrite the
          // shape of a spike that is already half over.
          <span className="shrink-0 text-[11px] text-amber-300">⚡ spiking — locked</span>
        ) : anyFocused ? (
          <button
            type="button"
            onClick={clearFocus}
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
          >
            show all
          </button>
        ) : (
          <ResetButton
            onClick={resetIons}
            title="Put every ion back to its real concentration"
            className="px-2 text-[11px]"
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {ION_KINDS.map((kind) => {
          const ion = IONS[kind]
          const direction = flowOf(kind, counts, vm)
          const colour = inColour(focused, kind, focusing)
          return (
            <div key={kind} className="rounded-lg bg-slate-900/40 px-2 py-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-baseline gap-1.5">
                  <button
                    type="button"
                    onClick={() => focus(kind)}
                    aria-pressed={focused[kind]}
                    title={
                      focused[kind]
                        ? `Stop singling out ${ion.name}`
                        : `Bring ${ion.name} into focus and dim the rest`
                    }
                    className="text-xs leading-none transition hover:opacity-100"
                    style={{ opacity: focused[kind] ? 1 : anyFocused ? 0.25 : 0.55 }}
                  >
                    🔍
                  </button>
                  <span
                    className="text-sm font-medium"
                    style={{ color: colour ? GLOSSY_COLORS[kind].mid : '#64748b' }}
                    title={`Really ${ion.outsideMM} mM outside, ${
                      ion.insideMM < 0.01 ? 'almost none' : `${ion.insideMM} mM`
                    } inside`}
                  >
                    {ion.symbol}{' '}
                    <span className="text-xs font-normal text-slate-400">
                      {ion.name} ({chargeTag(kind)})
                    </span>
                  </span>
                </span>
                <span
                  className={`shrink-0 text-[11px] ${FLOWS[direction].tone}`}
                  title={flowNote(kind, counts, vm)}
                >
                  {FLOWS[direction].text}
                </span>
              </div>
              <ConcentrationRows kind={kind} colour={colour} locked={!editable} />
            </div>
          )
        })}
      </div>

      <p className="mt-1.5 px-1 text-[11px] leading-snug text-slate-500">
        {editable
          ? 'Drag either row to change how much is there — one ball per mM, so these are the real concentrations. To hunt for the voltage that holds an ion still, open the lab bench.'
          : focusing
            ? 'The cell as you left it, held still while the spike runs — the spike is worked out from these numbers. Chloride and calcium are dimmed to keep sodium and potassium clear; they have not gone anywhere.'
            : 'The cell as you left it. To change it, switch to “What makes ions move”.'}
      </p>
    </div>
  )
}
