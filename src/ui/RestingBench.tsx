import { useEffect, useRef, useState } from 'react'
import { useRestingStore } from '../state/restingStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { speakAloud } from './SpeakButton'
import { spokenTermAt } from '../stage/spokenLabels'
import {
  RS_W,
  RS_H,
  chipAt,
  doorAt,
  labelSpeakerAt,
  resetBoxAt,
  doorsAt,
  drawResting,
  overWall,
  restingLabels,
} from '../stage/restingScene'
import {
  RESTING_HONESTY,
  RESTING_PARTS,
  restingMvOf,
  restingRightNow,
  stateOf,
  type DoorKind,
} from '../core/resting'
import { VM_SETTLE_MS } from '../core/voltage'

// D16 — where the resting potential comes from.
//
// ⚠ THE CHILD BUILDS THE WALL (user, 2026-08-30; and it is D14's own grammar,
// specified 2026-08-27). Three preset buttons were tried first and replaced:
// a button that sets up a wall for you does the interesting part on the
// child's behalf, and here the interesting part IS the lesson. The voltage is
// never set — it is read off whatever has been plugged in.

type Drag = { kind: DoorKind; x: number; y: number; from: 'tray' | 'wall' }

export function RestingBench() {
  const open = useRestingStore((s) => s.open)
  const closeBench = useRestingStore((s) => s.closeBench)
  const doors = useRestingStore((s) => s.doors)
  const add = useRestingStore((s) => s.add)
  const remove = useRestingStore((s) => s.remove)
  const reset = useRestingStore((s) => s.reset)

  const ref = useRef<HTMLCanvasElement>(null)
  const doorsRef = useRef(doors)
  doorsRef.current = doors
  /** What is under the finger. Per-frame, so it lives in a ref — but the
   *  cursor has to change with it, so a tiny piece of it is state too. */
  const dragRef = useRef<Drag | null>(null)
  const [dragging, setDragging] = useState(false)
  /** The needle's own position: it EASES toward the answer rather than jumping,
   *  for the reason a real membrane does — it takes a moment to move charge on
   *  and off a capacitor. */
  const shownRef = useRef(restingMvOf(doors))


  useEffect(() => {
    if (!open) return
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = RS_W * dpr
    canvas.height = RS_H * dpr
    let frame = 0
    let last = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      const dt = last === 0 ? 16 : Math.min(64, ms - last)
      last = ms
      const target = restingMvOf(doorsRef.current)
      // A first-order approach, which is what a membrane's time constant IS.
      shownRef.current += (target - shownRef.current) * (1 - Math.exp(-dt / VM_SETTLE_MS))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawResting(ctx, doorsRef.current, shownRef.current, ms, dragRef.current)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open])

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - box.left, y: e.clientY - box.top }
  }

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = at(e)
    const chip = chipAt(p.x, p.y)
    if (chip) {
      dragRef.current = { kind: chip, x: p.x, y: p.y, from: 'tray' }
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    // ⚠ THE READING SPEAKS ONLY WHEN ASKED (user, 2026-08-30: "voicing should
    // not occur on its own"). It used to say the word every time it changed —
    // which is every door dropped, so the bench talked over the child at the
    // moment they were looking hardest.
    if (resetBoxAt(p.x, p.y)) {
      reset()
      return
    }
    if (labelSpeakerAt(p.x, p.y)) {
      speakAloud(stateOf(doorsRef.current).word)
      return
    }
    const i = doorAt(doorsRef.current, p.x, p.y)
    if (i !== null) {
      // Pulling one OUT: it leaves the wall the moment it is picked up, so the
      // answer moves while it is still under the finger. A door that only
      // counted once it was dropped would make the wall lie for a second.
      const kind = doorsAt(doorsRef.current)[i].kind
      remove(kind)
      dragRef.current = { kind, x: p.x, y: p.y, from: 'wall' }
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    const term = spokenTermAt(restingLabels(), p.x, p.y)
    if (term) speakAloud(term)
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return
    const p = at(e)
    dragRef.current = { ...dragRef.current, x: p.x, y: p.y }
  }

  const up = () => {
    const d = dragRef.current
    dragRef.current = null
    setDragging(false)
    if (!d) return
    // Dropped in the wall: it plugs in. One that came OUT of the wall and is
    // dropped back has to be put back, because picking it up removed it.
    if (overWall(d.y)) add(d.kind)
  }

  const st = stateOf(doors)

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="Where the resting potential comes from">
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section title="What this is" paragraphs={RESTING_PARTS} />
          <Section title="Right now" paragraphs={restingRightNow(doors)} />
          <Section title="Keep in mind" paragraphs={RESTING_HONESTY} />
        </div>

        {/* ⚠ NO HEADLINE OVER THE CANVAS (user, 2026-08-30). The drawer is
            already named, and the reading printed large ON the picture says
            what this is far better than a title repeating the menu row. The
            speaker follows the word it pronounces. */}
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/40 p-2">
            <canvas
              ref={ref}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              style={{
                width: RS_W,
                height: RS_H,
                touchAction: 'none',
                cursor: dragging ? 'grabbing' : 'grab',
              }}
              title="Drag a door from a tray into the wall, or drag one out to take it away"
              aria-label={`${st.word}: ${st.line}. Drag doors into the wall to change it.`}
            />
          </div>
          {/* ⚠ Nothing under the canvas at all now (user, 2026-08-30). The
              reading is ON the picture with its own speaker, and the reset sits
              beside it — a control marooned in a row of its own, away from
              everything it acts on, was spending a whole strip of height on one
              button. */}
        </div>
      </div>
    </SideDrawer>
  )
}
