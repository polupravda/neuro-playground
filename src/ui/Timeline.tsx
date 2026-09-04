import { useEffect, useRef, useState } from 'react'
import { SpeakerIcon, speakAloud } from './SpeakButton'
import {
  activeIndex,
  chipCenter,
  chipWidth,
  glideAt,
  glideDuration,
  labelRows,
  type TimelinePoint,
} from './timelineMath'

// The timeline tool (user, 2026-09-01): one wide bar per run, dots at the main
// events, each with a named chip and a loudspeaker. It REPLACES the bare range
// slider the transports wore — same store contract (onScrub pauses, like
// scrubTo everywhere), one new verb: pressing an event GLIDES the run there.
//
// ⚠ REWIND, NEVER TELEPORT. The glide drives the store through every
// intermediate position with its own rAF clock (a clock belongs to the event
// it is timing — this one to the glide), so the picture visibly runs
// backwards or forwards to the chosen moment. A run that was PLAYING when
// pressed resumes on arrival, like a tape player; a paused one stays put.
//
// Two press targets per chip: the 🔊 corner speaks the name, the rest of the
// chip — and the dot — rewinds. Dragging is the thumb's job; pressing bare
// track glides there, because an instant jump anywhere would be the teleport
// the tool exists to remove.

/** A secondary marker on the bar — a labelled MOMENT rather than an event:
 *  drawn as a small diamond, gliding there like any point. D06 uses these for
 *  its label checkpoints (user, 2026-09-04: "add a dot on timeline where
 *  labels are visible — on the dot click, labels should be visible"). */
export interface TimelineMark {
  id: string
  u: number
  title?: string
}

interface TimelineProps {
  points: TimelinePoint[]
  /** Diamond markers for labelled moments; optional. */
  marks?: TimelineMark[]
  /** The transport's position, 0→1 of SCREEN time. */
  value: number
  playing: boolean
  onScrub: (u: number) => void
  onResume: () => void
  ariaLabel: string
}

export function Timeline({ points, marks, value, playing, onScrub, onResume, ariaLabel }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  // ⚠ FULL WIDTH OF WHATEVER HOLDS IT (user, 2026-09-01: "the timeline should
  // be full width of the canvas") — the bar fills its container and measures
  // itself, because the label stagger needs real pixels.
  const [width, setWidth] = useState(520)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const read = () => setWidth(el.clientWidth || 520)
    read()
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Per-frame state lives in refs: the glide's rAF must read the LIVE position
  // and playing flag, not the ones the closure rendered with.
  const live = useRef({ value, playing, onScrub, onResume })
  live.current = { value, playing, onScrub, onResume }
  const glide = useRef<{ raf: number; wasPlaying: boolean } | null>(null)
  const dragging = useRef(false)

  const cancelGlide = () => {
    if (glide.current) cancelAnimationFrame(glide.current.raf)
    glide.current = null
  }
  useEffect(() => cancelGlide, [])

  const glideTo = (target: number) => {
    // A press mid-glide retargets but keeps the ORIGINAL playing intent —
    // otherwise the first glide's pause makes every second press land paused.
    const wasPlaying = glide.current?.wasPlaying ?? live.current.playing
    cancelGlide()
    const from = live.current.value
    const t0 = performance.now()
    if (Math.abs(target - from) < 1e-4) {
      live.current.onScrub(target)
      if (wasPlaying) live.current.onResume()
      return
    }
    const step = (now: number) => {
      live.current.onScrub(glideAt(from, target, now - t0))
      if (now - t0 >= glideDuration(from, target)) {
        glide.current = null
        if (wasPlaying) live.current.onResume()
        return
      }
      if (glide.current) glide.current.raf = requestAnimationFrame(step)
    }
    glide.current = { raf: requestAnimationFrame(step), wasPlaying }
  }

  const uAtPointer = (clientX: number): number => {
    const box = trackRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return live.current.value
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width))
  }

  const rows = labelRows(
    points,
    width,
    points.map((p) => chipWidth(p.label)),
  )
  const rowsUsed = points.length === 0 ? 1 : Math.max(...rows) + 1
  const reached = activeIndex(points, value)

  return (
    <div ref={rootRef} className="w-full min-w-0 select-none" aria-label={ariaLabel}>
      {/* ── the bar: track, filled portion, event dots, drag thumb */}
      <div
        ref={trackRef}
        className="relative h-[12px] cursor-pointer"
        onPointerDown={(e) => {
          // Bare-track press: glide there. If the pointer then moves, the
          // press was a drag — hand over to live scrubbing.
          e.currentTarget.setPointerCapture(e.pointerId)
          glideTo(uAtPointer(e.clientX))
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
          if (!dragging.current) {
            dragging.current = true
            cancelGlide()
          }
          live.current.onScrub(uAtPointer(e.clientX))
        }}
        onPointerUp={() => {
          dragging.current = false
        }}
      >
        <div className="absolute inset-x-0 top-[4px] h-[4px] rounded-full bg-slate-700" />
        <div
          className="absolute left-0 top-[4px] h-[4px] rounded-full bg-amber-400/70"
          style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
        />
        {/* ⚠ THE ENDS ARE PLACES TOO (user, 2026-09-01): a larger, clickable
            point at each end of the bar — press to glide to the very start or
            the very end. An event that sits at an end is represented by the
            end point itself, so the two never stack. */}
        {([0, 1] as const).map((end) => (
          <button
            key={end}
            type="button"
            title={end === 0 ? 'Glide back to the very start' : 'Glide to the very end'}
            aria-label={end === 0 ? 'Go to the start' : 'Go to the end'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => glideTo(end)}
            className={`absolute top-[-1px] z-[5] h-[14px] w-[14px] -translate-x-1/2 rounded-full border-2 transition ${
              value >= end - 1e-6
                ? 'border-amber-300 bg-amber-400'
                : 'border-slate-300 bg-slate-800 hover:bg-slate-600'
            }`}
            style={{ left: `${end * 100}%` }}
          />
        ))}
        {points.map(
          (p, i) =>
            p.u > 0.02 &&
            p.u < 0.98 && (
              <button
                key={p.id}
                type="button"
                title={p.note ?? p.label}
                aria-label={`Go to: ${p.label}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => glideTo(p.u)}
                className={`absolute top-[2px] h-[9px] w-[9px] -translate-x-1/2 rounded-full border transition ${
                  i <= reached
                    ? 'border-amber-300 bg-amber-400'
                    : 'border-slate-400 bg-slate-800 hover:bg-slate-600'
                }`}
                style={{ left: `${p.u * 100}%` }}
              />
            ),
        )}
        {/* labelled-moment diamonds: press one to glide there (the view shows
            its labels while parked on it) */}
        {(marks ?? []).map((m) => (
          <button
            key={m.id}
            type="button"
            title={m.title ?? 'Labels are shown here — press to visit'}
            aria-label="Go to a labelled moment"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => glideTo(m.u)}
            className={`absolute top-[1.5px] z-[6] h-[9px] w-[9px] -translate-x-1/2 rotate-45 rounded-[2px] border transition ${
              value >= m.u - 1e-6
                ? 'border-amber-200 bg-amber-300/80'
                : 'border-amber-300/70 bg-slate-900 hover:bg-amber-500/40'
            }`}
            style={{ left: `${m.u * 100}%` }}
          />
        ))}
        {/* the drag control — grab it and pull */}
        <div
          role="slider"
          aria-label={ariaLabel}
          aria-valuemin={0}
          aria-valuemax={1000}
          aria-valuenow={Math.round(Math.max(0, Math.min(1, value)) * 1000)}
          onPointerDown={(e) => {
            e.stopPropagation()
            cancelGlide()
            dragging.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (dragging.current && e.currentTarget.hasPointerCapture(e.pointerId))
              live.current.onScrub(uAtPointer(e.clientX))
          }}
          onPointerUp={() => {
            dragging.current = false
          }}
          className="absolute top-[-2px] z-10 h-[15px] w-[15px] -translate-x-1/2 cursor-grab rounded-full border border-amber-200 bg-amber-300 shadow-md active:cursor-grabbing"
          style={{ left: `${Math.max(0, Math.min(1, value)) * 100}%`, touchAction: 'none' }}
        />
      </div>

      {/* ── the names, one chip per event, staggered onto a second row where
          neighbours would collide. 🔊 speaks; the name (and the dot) rewinds.
          Slim rows (user, 2026-09-01: "make the whole element slim"). */}
      {/* ⚠ ONLY the rows actually used (user, 2026-09-02: "no need to reserve
          space for additional rows" — superseding the same day's constant
          reserve). The gap to the plates below stays consistent anyway,
          because they FLOW under the bar with a fixed margin instead of
          sitting at a hardcoded offset. */}
      <div className="relative" style={{ height: rowsUsed * 14 + 1 }}>
        {/* ⚠ A LINE FROM EACH DOT TO ITS NAME (user, 2026-09-02): with two
            staggered rows, which chip belongs to which dot was a guess — the
            connector makes it a glance. Drawn under the chips. */}
        {points.map((p, i) => (
          <div
            key={`${p.id}-line`}
            aria-hidden
            className={i === reached ? 'absolute w-px bg-amber-400/60' : 'absolute w-px bg-slate-600'}
            style={{ left: `${p.u * 100}%`, top: -2, height: rows[i] * 14 + 4 }}
          />
        ))}
        {points.map((p, i) => (
          <div
            key={p.id}
            className={`absolute flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded border px-1 py-0 transition ${
              i === reached
                ? 'border-amber-400/50 bg-amber-500/20 text-amber-100'
                : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            style={{ left: chipCenter(p.u, width, chipWidth(p.label)), top: rows[i] * 14 + 1 }}
          >
            <span
              role="button"
              tabIndex={0}
              aria-label={`Pronounce ${p.label}`}
              title={`Hear "${p.label}"`}
              onClick={(e) => {
                e.stopPropagation()
                speakAloud(p.label)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  speakAloud(p.label)
                }
              }}
              className="flex h-[12px] w-[12px] shrink-0 cursor-pointer items-center justify-center rounded-full text-amber-300/90 transition hover:bg-amber-500/30"
            >
              <SpeakerIcon size={8} />
            </span>
            <button
              type="button"
              title={p.note ?? p.label}
              onClick={() => glideTo(p.u)}
              className="text-[10px] font-medium leading-none"
            >
              {p.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/** ⚠ THE ONE TRANSPORT PLATE (user, 2026-09-02: "extract the timeline into a
 *  representative component and reuse across the app") — every run's bar
 *  wears the SAME amber plate: the bar filling the width, the timer (when the
 *  run has one) at the right end, and nothing else inside — the action button
 *  and any switches float outside it (user, 2026-09-02: no extra buttons in
 *  the element). Callers position it with `className`; the look is owned
 *  here, once. */
export function TransportBar({
  className,
  timer,
  ...bar
}: {
  className?: string
  /** Right-end reading, e.g. "3.2 ms". Omit for a run with no clock. */
  timer?: string
  points: TimelinePoint[]
  marks?: TimelineMark[]
  value: number
  playing: boolean
  onScrub: (u: number) => void
  onResume: () => void
  ariaLabel: string
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-amber-400/60 bg-slate-950/90 px-3 py-1.5 shadow-lg backdrop-blur ${className ?? ''}`}
    >
      <div className="min-w-0 flex-1">
        <Timeline {...bar} />
      </div>
      {timer !== undefined && (
        <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-slate-400">
          {timer}
        </span>
      )}
    </div>
  )
}
