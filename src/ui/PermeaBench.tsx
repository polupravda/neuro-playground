import { useEffect, useRef } from 'react'
import { usePermeaStore } from '../state/permeaStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { speakAloud } from './SpeakButton'
import { spokenTermAt } from '../stage/spokenLabels'
import {
  PT_W,
  PT_H,
  PERMEA_SCALE,
  MAX_MOTES,
  MOTES_PER_SHOT,
  containerAt,
  aquaporinChipAt,
  resetChipAt,
  shootMotes,
  stepMotes,
  firedSpecies,
  drawPermea,
  permeaLabels,
  permeaRightNow,
  type Mote,
} from '../stage/permeaScene'
import { PERMEA_FACTS, PERMEA_HONESTY, PERMEA_LADDER } from '../core/permeability'

// D02 — what crosses a bare lipid wall. A drawer over the scene: containers
// of real substances, one wall, a squirt per click — and beside it the log
// ladder that carries the truth the animation cannot.

const FRAMING = [
  {
    icon: '🧪',
    text: 'A lab bench — a bare patch of lipid wall in water, with five substances to throw at it. Not a picture of your neuron: your membrane is full of doors, and this wall has none (unless you plug one in).',
  },
]

export function PermeaBench() {
  const open = usePermeaStore((s) => s.open)
  const closeBench = usePermeaStore((s) => s.closeBench)
  const aquaporin = usePermeaStore((s) => s.aquaporin)
  const toggleAquaporin = usePermeaStore((s) => s.toggleAquaporin)
  const lastShot = usePermeaStore((s) => s.lastShot)
  const shot = usePermeaStore((s) => s.shot)
  const resetSeq = usePermeaStore((s) => s.resetSeq)
  const reset = usePermeaStore((s) => s.reset)

  const tankRef = useRef<HTMLCanvasElement>(null)
  const motesRef = useRef<Mote[]>([])
  const idRef = useRef(0)
  const aquaporinRef = useRef(aquaporin)
  aquaporinRef.current = aquaporin

  // ↺ Reset empties the tank — the one sanctioned disappearance, and the
  // clearly-visible way back to the start.
  useEffect(() => {
    motesRef.current = []
  }, [resetSeq])

  useEffect(() => {
    if (!open) return
    const tank = tankRef.current
    const tankCtx = tank?.getContext('2d')
    if (!tank || !tankCtx) return
    const dpr = window.devicePixelRatio || 1
    tank.width = PT_W * PERMEA_SCALE * dpr
    tank.height = PT_H * PERMEA_SCALE * dpr
    let frame = 0
    let last = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      const dt = last === 0 ? 16 : ms - last
      last = ms
      stepMotes(motesRef.current, dt, ms, aquaporinRef.current)
      tankCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      tankCtx.clearRect(0, 0, PT_W * PERMEA_SCALE, PT_H * PERMEA_SCALE)
      drawPermea(tankCtx, motesRef.current, aquaporinRef.current)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open])

  const onTankDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const cssX = e.clientX - rect.left
    const cssY = e.clientY - rect.top
    const term = spokenTermAt(permeaLabels(), cssX, cssY)
    if (term) {
      speakAloud(term)
      return
    }
    // Both controls live on the canvas: the aquaporin's switch on the wall it
    // changes, and Reset in the corner.
    if (aquaporinChipAt(cssX, cssY)) {
      toggleAquaporin()
      return
    }
    if (resetChipAt(cssX, cssY)) {
      reset()
      return
    }
    const sp = containerAt(cssX / PERMEA_SCALE, cssY / PERMEA_SCALE)
    if (!sp) return
    // One squirt per container — a flooded tank teaches nothing. Reset refills.
    if (firedSpecies(motesRef.current).has(sp)) return
    if (motesRef.current.length + MOTES_PER_SHOT > MAX_MOTES) return
    motesRef.current = [...motesRef.current, ...shootMotes(sp, idRef.current)]
    idRef.current += MOTES_PER_SHOT
    shot(sp)
  }
  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="Membrane permeability">
      {/* overflow-hidden + min-w-0: a fixed-width canvas must never widen the
          column and set the drawer scrolling sideways. */}
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        {/* The describer, in the house container (BenchInfoPanel's): bordered,
            rounded, scrolling INSIDE its own frame. */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section title="What this is" paragraphs={FRAMING} />
          <Section title="Right now" paragraphs={permeaRightNow(lastShot, aquaporin)} />
          <Section title="What decides" paragraphs={PERMEA_FACTS} />
          <Section title="How easily it crosses" paragraphs={PERMEA_LADDER} />
          <Section title="Keep in mind" paragraphs={PERMEA_HONESTY} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="self-start rounded-xl border border-slate-700 bg-slate-950/40 p-2">
            <canvas
              ref={tankRef}
              onPointerDown={onTankDown}
              style={{
                width: PT_W * PERMEA_SCALE,
                height: PT_H * PERMEA_SCALE,
                touchAction: 'none',
                cursor: 'pointer',
              }}
              aria-label="Five containers of substances above a bare lipid wall"
            />
          </div>
        </div>
      </div>
    </SideDrawer>
  )
}
