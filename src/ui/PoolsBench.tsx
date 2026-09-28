import { useEffect, useRef } from 'react'
import { usePoolsStore } from '../state/poolsStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { SideBySide } from './SideBySide'
import {
  POOL_H,
  POOL_W,
  drawPools,
  gaugeNext,
  poolsGeometry,
  responseAt,
  settlePools,
  type Drawn,
} from '../stage/poolsScene'
import {
  POOLS_HONESTY,
  POOLS_PARTS,
  TAP_REST_MS,
  poolsSpike,
  poolsStart,
  poolsStep,
  type PoolsState,
} from '../core/pools'

// D18 — THE VESICLE POOLS, AND WHAT A STRONG SIGNAL COSTS.
//
// ⚠ ONE TERMINAL, AND THE CHILD IS THE EXPERIMENT (2026-09-08).
//
// It was two terminals side by side, one fed a single message per tap and the
// other a burst. The user's own testing killed that: "kids would press the fire
// button continuously. This means this behavior might eliminate the need of
// sending five signals consequently on the right side because that's what the
// kid already does."
//
// If the child hammers, the CHILD IS THE TRAIN — so a stimulus difference
// between two panels is not merely redundant, it is invisible: a child cannot
// see that one panel is doing something their own finger is not. So there is
// one terminal, it fills the drawer, and the variable is the child's own hand:
// tap gently and every message gets through, hammer and it runs out after as
// many taps as there are bubbles to count.

/** One geometry for the panel — solved once, not once a frame. */
const GEOM = poolsGeometry()

interface Terminal {
  state: PoolsState
  /** ⚠ WHEN IT WILL ACCEPT ANOTHER MESSAGE. Its own refractory, on its own
   *  clock: an axon cannot fire again immediately, and this is what stops the
   *  child's wrist from becoming the whole model. */
  readyAt: number
  /** ⚠ WHERE ITS BUBBLES ACTUALLY ARE, by id — a per-frame value, so it lives
   *  here and not in the model, exactly as the permeability bench holds its
   *  motes. `settlePools` walks them toward their places; nothing jumps. */
  drawn: Drawn
  /** The gauge's hand — also per-frame. */
  gauge: number
}

const fresh = (): Terminal => ({
  state: poolsStart(),
  readyAt: 0,
  drawn: new Map(),
  gauge: 0,
})

function TerminalCanvas({ term }: { term: { current: Terminal } }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = POOL_W * dpr
    canvas.height = POOL_H * dpr
    let frame = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawPools(ctx, {
        state: term.current.state,
        width: POOL_W,
        height: POOL_H,
        ms,
        drawn: term.current.drawn,
        gauge: term.current.gauge,
      })
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [term])
  return (
    <canvas
      ref={ref}
      style={{ width: POOL_W, height: POOL_H, touchAction: 'none' }}
      aria-label="A nerve terminal with its parked bubbles, its store behind them, and the cell it is talking to"
    />
  )
}

export function PoolsBench() {
  const open = usePoolsStore((s) => s.open)
  const closeBench = usePoolsStore((s) => s.closeBench)

  // ⚠ THE MODEL LIVES IN A REF — it steps every frame, and a synapse's state is
  // not something React should re-render for.
  const term = useRef<Terminal>(fresh())

  useEffect(() => {
    if (!open) return
    // A rested terminal each time the drawer opens: the child arrives on a full
    // one, the way every other exhibit here opens on its still.
    term.current = fresh()
    let frame = 0
    let last: number | null = null
    let sinceBeat = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      const dt = last === null ? 0 : ms - last
      last = ms
      const t = term.current
      // ⚠ THE FRAME CLAMP LIVES HERE, not in the model: a backgrounded tab must
      // not hand the terminal a ten-second step, and the model must take
      // whatever time it is given so a test can walk it.
      const step = Math.min(100, dt)
      poolsStep(t.state, step)
      // ⚠ AFTER the model has moved, so a bubble that changed place this frame
      // is walked toward the new one rather than snapped to it.
      settlePools(GEOM, t.state, t.drawn, step)
      // The needle jumps to whatever has arrived and eases back down.
      t.gauge = gaugeNext(t.gauge, responseAt(GEOM, t.state, ms, POOL_H), dt)
      sinceBeat += dt
      if (sinceBeat > 180) {
        sinceBeat = 0
        usePoolsStore.getState().tick()
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open])

  // ⚠ ONE PRESS, ONE MESSAGE — and the terminal decides whether it is ready for
  // it. Hammering asks more often; it cannot make the terminal fire faster than
  // its own refractory, which is what a real axon does too.
  const fire = () => {
    const t = term.current
    if (t.state.now < t.readyAt) return
    t.readyAt = t.state.now + TAP_REST_MS
    poolsSpike(t.state)
  }

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="Vesicle pools and synaptic depression">
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section title="What this is" paragraphs={POOLS_PARTS} />
          <Section title="Keep in mind" paragraphs={POOLS_HONESTY} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          <SideBySide
            panels={[
              {
                key: 'terminal',
                term: 'A nerve terminal',
                icon: '🫧',
                name: 'A nerve terminal',
                canvas: <TerminalCanvas term={term} />,
                action: {
                  label: 'Send a message',
                  icon: '⚡',
                  title: 'Send one message down the terminal — tap as often as you like',
                  onClick: fire,
                },
              },
            ]}
          />
        </div>
      </div>
    </SideDrawer>
  )
}
