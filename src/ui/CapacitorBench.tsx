import { ResetButton } from './ResetButton'
import { useEffect, useRef, useState } from 'react'
import { useCapacitorStore } from '../state/capacitorStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { speakAloud } from './SpeakButton'
import { spokenTermAt } from '../stage/spokenLabels'
import {
  CAP_W,
  CAP_H,
  CAP_SCALE,
  CAP_MIN_MV,
  CAP_MAX_MV,
  drawCapacitor,
  capacitorLabels,
} from '../stage/capacitorScene'
import {
  REST_MV,
  capacitorRightNow,
  capacitorHonesty,
  CAPACITOR_FACTS,
} from '../core/capacitor'
import { VM_SETTLE_MS } from '../core/voltage'

// D12 — the membrane as a charge-holder. A dial asks for a voltage; the
// membrane's own voltage follows a moment later, because charge has to be
// carried onto the faces first. That lag is a lesson, not a lack of polish.

const FRAMING = [
  {
    icon: '🧪',
    text: 'A lab bench — one patch of membrane with a dial wired across it, not a picture of your neuron. The crowd below is the cell’s own potassium, drawn to the same scale so you can compare it with the sliver that makes the voltage.',
  },
]

export function CapacitorBench() {
  const open = useCapacitorStore((s) => s.open)
  const closeBench = useCapacitorStore((s) => s.closeBench)
  const dialMv = useCapacitorStore((s) => s.dialMv)
  const setDial = useCapacitorStore((s) => s.setDial)
  const reset = useCapacitorStore((s) => s.reset)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const vmRef = useRef(REST_MV)
  const dialRef = useRef(dialMv)
  dialRef.current = dialMv
  // Only what the WORDS need crosses into React: the settled reading, and
  // whether the membrane is still catching up.
  const [shown, setShown] = useState(REST_MV)
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = CAP_W * CAP_SCALE * dpr
    canvas.height = CAP_H * CAP_SCALE * dpr
    let frame = 0
    let last = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      const dt = last === 0 ? 16 : Math.min(50, ms - last)
      last = ms
      // The membrane chases the dial with the app's own settling constant —
      // charge takes time to arrive.
      const gap = dialRef.current - vmRef.current
      vmRef.current += gap * (1 - Math.exp(-dt / VM_SETTLE_MS))
      const busy = Math.abs(gap) > 0.5
      setSettling((was) => (was === busy ? was : busy))
      setShown((was) =>
        Math.abs(was - vmRef.current) > 0.5 ? Math.round(vmRef.current) : was,
      )
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, CAP_W * CAP_SCALE, CAP_H * CAP_SCALE)
      drawCapacitor(ctx, vmRef.current, ms, true)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open])

  const onCanvasDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const term = spokenTermAt(
      capacitorLabels(),
      e.clientX - rect.left,
      e.clientY - rect.top,
    )
    if (term) speakAloud(term)
  }

  const fmtMv = (mv: number) => `${mv < 0 ? '−' : '+'}${Math.abs(Math.round(mv))} mV`

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="Membrane charge">
      {/* min-w-0 on both columns and overflow-hidden on the grid: a fixed-width
          canvas inside a 1fr column raises the column's min-content and pushes
          the drawer sideways. The drawer must never scroll horizontally. */}
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
            <Section title="What this is" paragraphs={FRAMING} />
            <Section title="Right now" paragraphs={capacitorRightNow(shown, settling)} />
            <Section title="What is happening" paragraphs={CAPACITOR_FACTS} />
            <Section title="Keep in mind" paragraphs={capacitorHonesty()} />
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-slate-200">
              <span aria-hidden className="text-lg">
                🔋
              </span>
              Dial
            </span>
            <input
              type="range"
              min={CAP_MIN_MV}
              max={CAP_MAX_MV}
              step={1}
              value={dialMv}
              onChange={(e) => setDial(Number(e.target.value))}
              aria-label="Voltage across the membrane, in millivolts"
              className="h-1.5 min-w-[240px] flex-1 cursor-pointer"
              style={{ accentColor: '#94a3b8' }}
            />
            <span className="w-40 text-right text-lg font-semibold tabular-nums text-slate-100">
              {fmtMv(shown)}
              {settling && (
                <span className="ml-2 text-xs font-normal text-amber-300">
                  catching up…
                </span>
              )}
            </span>
            <ResetButton onClick={reset} title="Back to the cell's own resting voltage" />
          </div>

          {/* The patch alone, full width. The abstract counter panel that
              stood here was removed in 28b: it answered questions a kid was
              never asked ("held against what?") in bars they could not read.
              Its numbers are readings ON the picture now, beside the things
              they count, and the ratio is a sentence in the info block. */}
          <div className="relative min-w-0 self-start rounded-xl border border-slate-700 bg-slate-950/40 p-2">
            <canvas
              ref={canvasRef}
              onPointerDown={onCanvasDown}
              style={{
                width: CAP_W * CAP_SCALE,
                height: CAP_H * CAP_SCALE,
                touchAction: 'none',
              }}
              aria-label="A membrane patch with charge on its faces and the cell's potassium crowd below"
            />
          </div>
        </div>
      </div>
    </SideDrawer>
  )
}
