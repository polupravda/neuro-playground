import { useEffect, useRef } from 'react'
import { IONS, MAX_PARTICLES, PARTICLE_STEP, type IonKind } from '../core/ions'
import { IonKey } from './IonKey'
import { chamberAt } from '../core/balance'
import { GLOSSY_COLORS } from '../stage/particleStyle'
import {
  CROSSING_MAX_MS,
  ballsOf,
  drawChamber,
  type Crossing,
} from '../stage/benchScene'
import { useBenchStore } from '../state/benchStore'

// One chamber of the bench: a patch of real membrane — bilayer, heads, tails, a
// channel tinted with the species it passes — with one selective door, the two
// pushes on its ion drawn arguing, and the traffic that argument produces.
//
// Four sit side by side, VISIBLY SEPARATE. Not four regions of one membrane: a
// child reading that picture would conclude ions sort themselves into
// neighbourhoods along a membrane, which is false and hard to unlearn. Each shows
// its own species in colour and the other three as blurred ghosts, so nothing
// suggests a compartment of one pure ion either.

// Both dimensions are measured rather than assumed, so the bench fills the page
// it is given — four wide chambers rather than four cards in a corner. The height
// used to be a clamp, which left a band of dead drawer under the row on a tall
// window; it is now whatever the grid row hands over, and the ResizeObserver
// below turns that into canvas pixels.

/** One push, as an arrow. Down is inward, the direction the chamber is drawn in —
 *  outside above, inside below, as everywhere else in the app. */
function PushArrow({ mv, colour, label }: { mv: number; colour: string; label: string }) {
  const idle = Math.abs(mv) < 1.5
  const length = Math.min(34, 5 + (Math.abs(mv) / 120) * 30)
  return (
    <div className="flex w-[44px] flex-col items-center gap-0.5">
      <span
        className="block rounded-full transition-all"
        style={{ width: 4, height: length, background: colour, opacity: idle ? 0.3 : 1 }}
      />
      <span style={{ color: colour, fontSize: 10, lineHeight: 1 }}>
        {idle ? '·' : mv > 0 ? '▼' : '▲'}
      </span>
      <span className="text-[9px] uppercase leading-none tracking-wide text-slate-500">
        {label}
      </span>
    </div>
  )
}

export function BalanceChamber({ kind, ghosts: _g }: { kind: IonKind; ghosts: IonKind[] }) {
  const counts = useBenchStore((s) => s.counts)
  const vm = useBenchStore((s) => s.vm)
  const open = useBenchStore((s) => s.channels[kind])
  const won = useBenchStore((s) => s.solved[kind])
  const toggleChannel = useBenchStore((s) => s.toggleChannel)
  const setCount = useBenchStore((s) => s.setCount)
  const markSolved = useBenchStore((s) => s.markSolved)

  const chamber = chamberAt(kind, counts, vm, open)
  const ion = IONS[kind]
  const colour = GLOSSY_COLORS[kind].mid

  // A win, once earned, stays earned.
  useEffect(() => {
    if (chamber.solved && !won) markSolved(kind)
  }, [chamber.solved, won, kind, markSolved])

  // The drawing reads refs, so a frame never renders a stale chamber.
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(250)
  const heightRef = useRef(400)
  const viewRef = useRef(chamber)
  viewRef.current = chamber
  const countsRef = useRef(counts)
  countsRef.current = counts
  // The battery too, for exactly the same reason. It was read straight from the
  // store instead, and the draw loop's dependency list is [kind] — so the closure
  // captured the voltage at mount and held it. Every chamber painted its charge
  // for −72 mV no matter where the dial went, which looked like a colour bug and
  // was a staleness bug.
  const vmRef = useRef(vm)
  vmRef.current = vm
  // Balls in transit. One is started when the number of balls on a side really
  // changes — so what is drawn crossing is the ball whose side changed, and the
  // picture cannot show a crossing that did not happen.
  const crossingsRef = useRef<Crossing[]>([])
  const outsideBallsRef = useRef<number | null>(null)
  /** The last total, so a change the CHILD made can be told from a transfer. */
  const totalRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const box = boxRef.current
    if (!canvas || !box) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ratio = window.devicePixelRatio || 1
    const size = () => {
      const w = Math.max(160, Math.round(box.clientWidth))
      const h = Math.max(240, Math.round(box.clientHeight))
      widthRef.current = w
      heightRef.current = h
      canvas.width = w * ratio
      canvas.height = h * ratio
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    size()
    const observer = new ResizeObserver(size)
    observer.observe(box)
    let frame = 0
    let last = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      // ~30 fps is plenty for a diagram, and there are four of these.
      if (ms - last < 33) return
      last = ms
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      const c = viewRef.current
      const here = countsRef.current[kind]
      const { outsideBalls, insideBalls, total } = ballsOf(here.outside, here.inside)
      const was = outsideBallsRef.current
      const wasTotal = totalRef.current
      // ⚠ ONLY A REAL TRANSFER GETS A CROSSING (2026-08-28).
      //
      // This used to fire whenever `outsideBalls` changed, which was sound
      // while the drawn set was a fixed sixty: the only way a side's share
      // could change was for a ball to move. Once one ball became a fixed
      // AMOUNT, the outside count also changes when the child adds ions with
      // the stepper — and the bench answered by animating balls swimming
      // through the channel that nothing had moved. The app inventing
      // transport is exactly what this exhibit exists not to do.
      //
      // A transfer conserves the total. If the total moved, the child did it,
      // and nothing crossed.
      if (was !== null && wasTotal === total && outsideBalls !== was) {
        const inward = outsideBalls < was
        const n = Math.abs(outsideBalls - was)
        for (let k = 0; k < n; k++) {
          // It leaves from the last rank on its old side and arrives at the
          // next free rank on its new one — so the crowd it leaves closes up
          // and the crowd it joins grows by one, which is what a transfer
          // looks like.
          crossingsRef.current.push({
            fromRank: inward ? outsideBalls + k : insideBalls + k,
            toRank: inward ? insideBalls - 1 - k : outsideBalls - 1 - k,
            inward,
            startedMs: ms,
          })
        }
      }
      totalRef.current = total
      outsideBallsRef.current = outsideBalls
      crossingsRef.current = crossingsRef.current.filter(
        (x) => ms - x.startedMs < CROSSING_MAX_MS,
      )
      drawChamber(ctx, {
        kind,
        outside: here.outside,
        inside: here.inside,
        open: c.open,
        flow: c.flow,
        twoWay: c.twoWay,
        strength: c.strength,
        vm: vmRef.current,
        crossings: crossingsRef.current,
        timeMs: ms,
        width: widthRef.current,
        height: heightRef.current,
      })
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [kind])

  // Setup controls: while the door is shut you arrange the piles, and once it is
  // open the ions arrange themselves — so the sliders become readouts that move.
  // Two knobs on coupled quantities was the flaw of the demo this replaced; here
  // only one of them is ever live at a time.
  const slider = (side: 'outside' | 'inside') => (
    <input
      type="range"
      min={0}
      max={MAX_PARTICLES}
      step={PARTICLE_STEP}
      value={Math.round(counts[kind][side])}
      disabled={open}
      onChange={(e) => setCount(kind, side, Number(e.target.value))}
      aria-label={`${ion.name} ${side}, in millimolar`}
      className="h-1 w-full cursor-pointer disabled:cursor-default"
      style={{ accentColor: colour }}
    />
  )

  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border bg-slate-900/50 p-2 transition-colors ${
        chamber.solved
          ? 'border-emerald-400/70 shadow-[0_0_20px_rgba(52,211,153,0.28)]'
          : 'border-slate-700'
      }`}
    >
      <div className="mb-1 flex items-baseline justify-between gap-1 px-0.5">
        {/* A specimen ion at readable size: the crowd on the stage below is
            drawn at its honest (tiny) scale, where no badge or name would be
            legible, so the header carries the key. */}
        <IonKey kind={kind} />
        {chamber.solved ? (
          <span className="shrink-0 text-[12px] font-semibold text-emerald-300">
            ✓ balanced
          </span>
        ) : won ? (
          <span className="shrink-0 text-[11px] text-emerald-300/50">✓ once</span>
        ) : null}
      </div>

      <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden rounded-lg">
        {/* Absolute, so the canvas contributes NOTHING to intrinsic width. Its CSS
            size is set in pixels from a measurement of this box, and a laid-out
            element carrying a measured width feeds its own container's min-content
            — which is a loop that only ever grows. Out of flow, the box measures
            the space available and the canvas simply fills it. */}
        <canvas ref={canvasRef} className="absolute left-0 top-0 block" />
        <span className="pointer-events-none absolute left-1.5 top-1 text-[10px] uppercase tracking-wide text-slate-500">
          outside
        </span>
        <span className="pointer-events-none absolute bottom-1 left-1.5 text-[10px] uppercase tracking-wide text-slate-500">
          inside
        </span>
        {/* Both pushes, always — and never their sum. The kid predicts which one
            wins; opening the door is what answers.
            Down in the cytoplasm corner, on its own plate: centred on the
            membrane it sat across the lipids and its labels ran over the channel,
            which made the one thing this exhibit is about the least legible part
            of it. */}
        <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex gap-0.5 rounded-lg bg-slate-950/85 px-1.5 py-1">
          <PushArrow mv={chamber.pushes.crowd} colour={colour} label="crowd" />
          {/* Coloured by the SIGN OF THE MEMBRANE, not by which way it pushes:
              sky is a negative interior and red a positive one, the same colours
              as the ± marks on a membrane face. The arrowhead carries direction,
              so no colour has two meanings. */}
          <PushArrow
            mv={chamber.pushes.charge}
            colour={vm < 0 ? '#7dd3fc' : '#fca5a5'}
            label="charge"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => toggleChannel(kind)}
        className={`mt-1.5 rounded-lg px-2 py-1.5 text-[13px] font-semibold transition ${
          open
            ? 'bg-slate-700 text-slate-100 hover:bg-slate-600'
            : 'bg-sky-600/35 text-sky-50 hover:bg-sky-600/55'
        }`}
      >
        {open ? 'close the door' : 'open the door'}
      </button>

      <div className="mt-1.5 flex flex-col gap-0.5">
        {(['outside', 'inside'] as const).map((side) => (
          <div key={side} className="flex items-center gap-1">
            <span className="w-6 shrink-0 text-[9px] uppercase tracking-wide text-slate-500">
              {side === 'outside' ? 'out' : 'in'}
            </span>
            {slider(side)}
            <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-slate-300">
              {Math.round(counts[kind][side])}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}
