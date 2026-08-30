import { useEffect, useRef } from 'react'
import { usePatchStore } from '../state/patchStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { speakAloud } from './SpeakButton'
import { spokenTermAt } from '../stage/spokenLabels'
import { PC_W, PC_H, drawPatch, patchLabels } from '../stage/patchScene'
import {
  STEPS_MV,
  PATCH_WINDOW_MS,
  PATCH_PARTS,
  PATCH_HONESTY,
  patchRightNow,
} from '../core/patchClamp'
import { REST_MV } from '../core/capacitor'

// D13 — the patch clamp. Reached by tapping the electrode on the little
// neuron in the spike-train bench: that electrode has been sitting there
// unexplained since the bench was built, and a child who wondered what it was
// gets to find out by touching it.

const FRAMING = [
  {
    icon: '🔎',
    text: 'That thin probe you have seen touching the little neuron — this is what it is. A glass tube pulled to a tip finer than a hair, pressed onto the wall until it sticks, listening to one tiny scrap of membrane.',
  },
]

export function PatchBench() {
  const open = usePatchStore((s) => s.open)
  const closeBench = usePatchStore((s) => s.closeBench)
  const vm = usePatchStore((s) => s.vm)
  const setVm = usePatchStore((s) => s.setVm)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const vmRef = useRef(vm)
  vmRef.current = vm

  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = PC_W * dpr
    canvas.height = PC_H * dpr
    let frame = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, PC_W, PC_H)
      // The record itself does not scroll — it is a WINDOW, the way a real
      // one is printed. Only the gate in the rig moves, so a child can match
      // a door opening to a step on the paper.
      drawPatch(ctx, vmRef.current, (ms / 4) % PATCH_WINDOW_MS)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open])

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="Patch clamp">
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section title="What this is" paragraphs={FRAMING} />
          <Section title="Right now" paragraphs={patchRightNow(vm)} />
          <Section title="How we know" paragraphs={PATCH_PARTS} />
          <Section title="Keep in mind" paragraphs={PATCH_HONESTY} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {STEPS_MV.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setVm(step)}
                title={`Hold the patch at ${step} millivolts and watch what the channel does`}
                className={`h-[42px] shrink-0 whitespace-nowrap rounded-lg border px-3 text-[13px] font-semibold transition ${
                  vm === step
                    ? 'border-sky-400 bg-sky-500 text-white'
                    : 'border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {step === REST_MV ? '😴' : step > 20 ? '🔥' : '👀'}{' '}
                {step > 0 ? '+' : ''}
                {step} mV
              </button>
            ))}
          </div>

          <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/40 p-2">
            <canvas
              ref={canvasRef}
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const term = spokenTermAt(
                  patchLabels(),
                  e.clientX - rect.left,
                  e.clientY - rect.top,
                )
                if (term) speakAloud(term)
              }}
              style={{ width: PC_W, height: PC_H, touchAction: 'none', cursor: 'pointer' }}
              aria-label="A patch pipette sealed onto a membrane, and the current through one channel"
            />
          </div>
        </div>
      </div>
    </SideDrawer>
  )
}
