import { useEffect, useRef } from 'react'
import { useFilterStore } from '../state/filterStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { speakAloud } from './SpeakButton'
import { IonKey } from './IonKey'
import { spokenTermAt } from '../stage/spokenLabels'
import {
  LANE_W,
  LANE_H,
  LANE_KIND,
  drawLane,
  laneLabels,
  runOver,
  RUN_MS,
  type LaneKind,
} from '../stage/filterScene'
import {
  FILTER_ZOOM_PARTS,
  FILTER_ZOOM_HONESTY,
  filterLedger,
} from '../core/filterZoom'
import { IONS } from '../core/ions'

// D15 — inside the selectivity filter. Reached by tapping the magnifier on
// the filter in the channel view, never from a list: you get to another view
// by going to the place on the object.

const FRAMING = [
  {
    icon: '🔎',
    text: 'The filter from the channel view, right up close. Two goes at the same door: potassium on the left, sodium on the right. Send one, send the other, or send both together and watch them race.',
  },
]

const BUTTONS: { label: string; lanes: readonly LaneKind[]; kind?: LaneKind }[] = [
  { label: 'Send potassium', lanes: ['k'], kind: 'k' },
  { label: 'Send sodium', lanes: ['na'], kind: 'na' },
  { label: 'Send both at once', lanes: LANE_KIND },
]

export function FilterBench() {
  const open = useFilterStore((s) => s.open)
  const closeBench = useFilterStore((s) => s.closeBench)
  const startedMs = useFilterStore((s) => s.startedMs)
  const ran = useFilterStore((s) => s.ran)
  const start = useFilterStore((s) => s.start)
  const finish = useFilterStore((s) => s.finish)

  const kRef = useRef<HTMLCanvasElement>(null)
  const naRef = useRef<HTMLCanvasElement>(null)
  const refs = [kRef, naRef] as const
  const msRef = useRef(0)
  const startedRef = useRef(startedMs)
  startedRef.current = startedMs

  useEffect(() => {
    if (!open) return
    const dpr = window.devicePixelRatio || 1
    const ctxs = refs.map((r) => {
      const c = r.current
      const ctx = c?.getContext('2d')
      if (!c || !ctx) return null
      c.width = LANE_W * dpr
      c.height = LANE_H * dpr
      return ctx
    })
    if (ctxs.some((c) => c === null)) return
    let frame = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      msRef.current = ms
      LANE_KIND.forEach((kind, i) => {
        const ctx = ctxs[i]
        if (!ctx) return
        const began = startedRef.current[kind]
        const into = began === null ? null : ms - began
        // Each lane ends its own run; the account of it stays on screen,
        // because a story outlives the animation that showed it.
        if (into !== null && runOver(into)) finish(kind)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, LANE_W, LANE_H)
        drawLane(ctx, kind, into === null ? null : Math.min(into, RUN_MS))
      })
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, finish])

  const watched = LANE_KIND.filter((k) => ran[k])

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="Inside the selectivity filter">
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section title="What this is" paragraphs={FRAMING} />
          {watched.length > 0 && (
            <Section title="What just happened" paragraphs={filterLedger(watched)} />
          )}
          <Section title="How the door works" paragraphs={FILTER_ZOOM_PARTS} />
          <Section title="Keep in mind" paragraphs={FILTER_ZOOM_HONESTY} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          {/* The controls are their OWN row above the two panels, not floating
              over one of them (user, 2026-08-28): two of them act on the left
              panel, one on the right, one on both, and a control sitting on
              top of one picture would say it belongs to that picture. */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {BUTTONS.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => start(msRef.current, b.lanes)}
                title={`${b.label} into the filter and watch what the oxygens do`}
                className="flex h-[42px] shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/80 bg-amber-500/30 px-3 text-[13px] font-semibold text-amber-50 shadow-md transition hover:bg-amber-500/45"
              >
                {b.kind ? (
                  <IonKey kind={b.kind} size="bare" />
                ) : (
                  <span aria-hidden className="text-base leading-none">
                    ⚖️
                  </span>
                )}
                <span>{b.label}</span>
              </button>
            ))}
          </div>

          <div className="flex min-h-0 min-w-0 gap-4">
            {LANE_KIND.map((kind, i) => (
              <div
                key={kind}
                className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/40 p-2"
              >
                <canvas
                  ref={refs[i]}
                  onPointerDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const term = spokenTermAt(
                      laneLabels(kind),
                      e.clientX - rect.left,
                      e.clientY - rect.top,
                    )
                    if (term) speakAloud(term)
                  }}
                  style={{ width: LANE_W, height: LANE_H, touchAction: 'none', cursor: 'pointer' }}
                  aria-label={`${IONS[kind].name} entering the selectivity filter`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SideDrawer>
  )
}
