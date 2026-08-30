import { useEffect } from 'react'
import { ION_KINDS } from '../core/ions'
import { VM_MAX, VM_MIN } from '../core/voltage'
import { allSettled } from '../core/balance'
import { useBenchStore } from '../state/benchStore'
import { BalanceChamber } from './BalanceChamber'
import { SideDrawer } from './SideDrawer'
import { BenchInfoPanel } from './BenchInfoPanel'

// Demo ②: find the voltage at which each ion stops caring.
//
// In a DRAWER, not on the canvas. The canvas never stops being the neuron — that
// promise is load-bearing everywhere else — and this is four separate patches
// wired to a battery, a thought experiment ABOUT membranes. The drawer's grammar
// makes that claim structurally, before any caption says it, and the scene stays
// visible underneath, untouched, waiting.

export function BalanceBench() {
  const open = useBenchStore((s) => s.open)
  const closeBench = useBenchStore((s) => s.closeBench)
  const vm = useBenchStore((s) => s.vm)
  const setVm = useBenchStore((s) => s.setVm)
  const counts = useBenchStore((s) => s.counts)
  const channels = useBenchStore((s) => s.channels)
  const reset = useBenchStore((s) => s.reset)

  const settleOpen = useBenchStore((s) => s.settleOpen)
  const opened = ION_KINDS.filter((kind) => channels[kind])
  // The ending, and it is emergent: leave the doors open and everything drains to
  // equilibrium. A cell that got here would be dead.
  const drained = opened.length > 0 && allSettled(opened, counts, vm)

  // One clock for the whole bench: four chambers settling is one calculation, not
  // four loops.
  useEffect(() => {
    // Nothing settles while the drawer is shut: a bench nobody is looking at
    // should not quietly rearrange itself, and should not burn a frame loop.
    if (!open || opened.length === 0) return
    let frame = 0
    let last = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      if (last === 0) last = ms
      const dt = Math.min(60, ms - last)
      // ~30 Hz: every step writes to the store and re-renders four chambers, and
      // the settling is smooth enough at half the frame rate.
      if (dt < 30) return
      last = ms
      settleOpen(dt)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open, opened.length, settleOpen])

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="Balance an ion">
      {/* No heading and no standfirst: four membranes and a battery announce
          themselves, and a title over them only takes height from the one part of
          this that is an experiment. What the bench IS lives in the describer.

          The periodic table's grid, column widths and all: a 16rem describer down
          the left spanning the full height, and a right-hand column of one auto
          row for the controls over one minmax(0,1fr) row for the exhibit. The
          fractional row is what lets the chambers take every pixel that is left,
          and the min-h-0 is what stops them refusing to shrink instead.

          The exhibit column is minmax(0,1fr) and NOT plain 1fr, which is the
          difference between fitting and a horizontal scrollbar. A bare 1fr is
          minmax(auto,1fr): its floor is the column's min-content, and each canvas
          is given an explicit pixel width measured from the box it sits in — so a
          wider canvas raised the column's min-content, which widened the column,
          which widened the canvas. A ratchet, and it ran off the right-hand edge.
          A floor of zero cannot ratchet.

          The top padding clears the drawer's ✕, which the describer column would
          otherwise run under. */}
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 pt-2">
        <div className="col-start-1 row-span-2 row-start-1 flex min-h-0 flex-col">
          <BenchInfoPanel vm={vm} counts={counts} channels={channels} drained={drained} />
        </div>

        <div className="col-start-2 row-start-1">
          {/* The battery, and nothing but the battery: a label, the dial, the
              number it is set to, and the way back to the start. Every word that
              INTERPRETS that number — polarized, reversed, which way the field
              points, what is crossing — lives in the describer, so there is one
              place to read and one place to touch.

              Two things it deliberately does not do. It does not wear the charge
              it is imposing in the cytoplasm's red/blue: a colour on a control
              reads as a promise about which way ions will move, and no single
              number can make that promise — flux direction is the sign of
              (Vm − E_ion) per species. And it does not say "one battery, four
              patches" beside itself; one supply visibly wired to all four is a
              thing you can see. */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 text-sm text-slate-200">
                <span aria-hidden className="text-lg">
                  🔋
                </span>
                Battery
              </span>
              <input
                type="range"
                min={VM_MIN}
                max={VM_MAX}
                step={1}
                value={vm}
                onChange={(e) => setVm(Number(e.target.value))}
                aria-label="Battery voltage, in millivolts"
                className="h-1.5 min-w-[220px] flex-1 cursor-pointer"
                style={{ accentColor: '#94a3b8' }}
              />
              <span className="w-20 text-right text-lg font-semibold tabular-nums text-slate-100">
                {`${vm < 0 ? '−' : '+'}${Math.abs(vm)} mV`}
              </span>
              <button
                type="button"
                onClick={reset}
                className="rounded-lg px-2 py-1 text-[11px] text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              >
                ↺ start again
              </button>
            </div>
          </div>
        </div>

        {/* The exhibit, taking the whole of the remaining row. */}
        <div className="col-start-2 row-start-2 flex min-h-0 min-w-0 items-stretch gap-2.5">
          {ION_KINDS.map((kind) => (
            <BalanceChamber
              key={kind}
              kind={kind}
              ghosts={ION_KINDS.filter((other) => other !== kind)}
            />
          ))}
        </div>
      </div>
    </SideDrawer>
  )
}
