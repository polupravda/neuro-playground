import { useEffect, useMemo, useRef } from 'react'
import { useTourStore } from '../state/tourStore'
import { useIonStore } from '../state/ionStore'
import { useMembraneStore } from '../state/membraneStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { speakAloud } from './SpeakButton'
import { spokenTermAt } from '../stage/spokenLabels'
import {
  SCALES,
  SC_FIT,
  SC_STAGE_W,
  SC_STAGE_H,
  drawScale,
  scaleBits,
  scaleLabels,
} from '../stage/scalesScene'
import { TOUR_STOPS, scaleAgreement, tourFacts } from '../core/tour'
import { trajectory, FIRE_STIMULUS } from '../core/spikeModel'
import { apTrace, apRestMv } from '../core/actionPotential'
import { fibreRun } from '../core/fibre'
import { viewFibre } from '../stage/axonRibbon'

// C05 — one signal at three sizes, as a self-contained exhibit.
//
// The switch does not restart anything. Stepping from the patch to the axon to
// the whole cell keeps the clock exactly where it was, because the exhibit's
// whole claim is that these are ONE event seen three ways — and a switch that
// reset the run would be quietly saying they are three events.

const RUN_MS = 5200

const FRAMING = [
  {
    icon: '🧭',
    text: 'The same signal, three times, at three different sizes. Fire it once and then step between the pictures — the clock does not start over, because it is all one thing happening.',
  },
]

export function ScalesBench() {
  const open = useTourStore((s) => s.open)
  const closeBench = useTourStore((s) => s.closeBench)
  const which = useTourStore((s) => s.which)
  const show = useTourStore((s) => s.show)
  const u = useTourStore((s) => s.u)
  const playing = useTourStore((s) => s.playing)
  const fire = useTourStore((s) => s.fire)

  const counts = useIonStore((s) => s.counts)
  const leaksOn = useMembraneStore((s) => s.leaksOn)

  const traj = useMemo(
    () => trajectory(counts, leaksOn, FIRE_STIMULUS),
    [counts, leaksOn],
  )
  const run = useMemo(
    () => fibreRun(counts, leaksOn, FIRE_STIMULUS, viewFibre(false)),
    [counts, leaksOn],
  )
  const agreement = useMemo(
    () => scaleAgreement(counts, leaksOn, run),
    [counts, leaksOn, run],
  )
  const pumpOn = useMembraneStore((s) => s.pumpOn)
  // Everything the scene needs, from the same functions the stage builds it
  // from — so this is the app's own picture at two of its own cameras, not a
  // second drawing of the same biology.
  const bits = useMemo(
    () =>
      scaleBits(
        counts,
        leaksOn,
        pumpOn,
        traj,
        run,
        apTrace(counts, leaksOn, 96, FIRE_STIMULUS),
        apRestMv(counts, leaksOn),
      ),
    [counts, leaksOn, pumpOn, traj, run],
  )

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const view = useRef({ which, u, bits })
  view.current = { which, u, bits }

  useEffect(() => {
    if (!open) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = SC_STAGE_W * dpr
    canvas.height = SC_STAGE_H * dpr
    let frame = 0
    let last = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      const dt = last === 0 ? 16 : ms - last
      last = ms
      // The clock belongs to the run, not to whatever is re-rendering.
      if (useTourStore.getState().playing) useTourStore.getState().step(dt / RUN_MS)
      const s = view.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, SC_STAGE_W, SC_STAGE_H)
      drawScale(ctx, s.which, s.bits, s.u, ms)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open])

  const running = u !== null && u < 1

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="One signal, three sizes">
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section title="What this is" paragraphs={FRAMING} />
          {/* The measured agreement between the three sizes: `scaleAgreement`
              SHOWS they are describing one event rather than asserting it. */}
          <Section
            title={TOUR_STOPS[which].title}
            paragraphs={tourFacts(TOUR_STOPS[which], agreement)}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div
              role="radiogroup"
              aria-label="Which size"
              className="flex h-[42px] shrink-0 items-center gap-1 rounded-lg border border-slate-700 p-0.5"
            >
              {SCALES.map((scale) => {
                const on = which === scale.i
                return (
                  <button
                    key={scale.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => show(scale.i)}
                    title={scale.watch}
                    className={`h-full whitespace-nowrap rounded-md px-3 text-[13px] font-semibold transition ${
                      on
                        ? 'bg-sky-500 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {scale.title}
                  </button>
                )
              })}
            </div>

            {!running && (
              <button
                type="button"
                onClick={fire}
                title="Send one signal, and watch it at whichever size you like"
                className="flex h-[42px] items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-400/80 bg-amber-500/30 px-3 text-[13px] font-semibold text-amber-50 transition hover:bg-amber-500/45"
              >
                <span aria-hidden>⚡</span> Send one signal
              </button>
            )}
            {running && (
              <button
                type="button"
                onClick={() =>
                  playing ? useTourStore.getState().pause() : useTourStore.getState().resume()
                }
                className="h-[42px] w-[104px] shrink-0 rounded-lg border border-amber-400/50 bg-amber-500/15 text-[13px] font-semibold text-amber-100 transition hover:bg-amber-500/30"
              >
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>
            )}

            <input
              type="range"
              min={0}
              max={1000}
              value={Math.round((u ?? 0) * 1000)}
              onChange={(e) => useTourStore.getState().scrubTo(Number(e.target.value) / 1000)}
              aria-label="Position through the signal"
              className="w-44 cursor-pointer"
              style={{ accentColor: '#fcd34d' }}
            />
          </div>

          <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/40 p-2">
            <canvas
              ref={canvasRef}
              onPointerDown={(e) => {
                const box = e.currentTarget.getBoundingClientRect()
                const term = spokenTermAt(
                  scaleLabels(which),
                  e.clientX - box.left,
                  e.clientY - box.top,
                )
                if (term) speakAloud(term)
              }}
              // Drawn at the scene's own size and scaled down by CSS, so each
              // of the three is literally that view's picture.
              // ⚠ FIT BY BOTH SIDES. Scaling to the available WIDTH alone
              // cropped the bottom off (user, 2026-08-28): the scene is
              // taller than it is wide once the drawer's control row has
              // taken its share, so the height is the binding constraint.
              style={{
                width: SC_FIT.w,
                height: SC_FIT.h,
                touchAction: 'none',
              }}
              aria-label={`${TOUR_STOPS[which].title}: ${TOUR_STOPS[which].watch}`}
            />
          </div>
        </div>
      </div>
    </SideDrawer>
  )
}
