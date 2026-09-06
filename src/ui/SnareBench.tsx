import { useEffect, useRef } from 'react'
import { useSnareStore } from '../state/snareStore'
import { useLabelsStore } from '../state/labelsStore'
import { LabelsSwitch } from './LabelsSwitch'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { speakAloud } from './SpeakButton'
import { spokenTermAt } from '../stage/spokenLabels'
import {
  LABEL_HOLD_MS,
  LABEL_STOPS,
  SNARE_SCREEN_MS,
  SN_H,
  SN_W,
  drawSnare2,
  snareGeometry,
  snareLabels,
} from '../stage/snareScene'
import {
  SNARE_HONESTY,
  SNARE_PARTS,
  STAGES,
  STAGE_SPANS,
  stageAt,
} from '../core/vesicleCycle'
import { TransportBar } from './Timeline'

// D06 — the vesicle life cycle and the SNARE machinery.
//
// The one thing to do is watch it, and the one thing to control is where in it
// you are. The stage buttons are a way of GETTING somewhere in the sequence,
// not nine separate demos: pressing one moves the same run to that point.

export function SnareBench() {
  const open = useSnareStore((s) => s.open)
  const closeBench = useSnareStore((s) => s.closeBench)
  const u = useSnareStore((s) => s.u)
  const playing = useSnareStore((s) => s.playing)
  const labelsOn = useLabelsStore((s) => s.labelsOn)

  const ref = useRef<HTMLCanvasElement>(null)
  const state = useRef({ u, playing, labelsOn })
  state.current = { u, playing, labelsOn }
  // ⚠ THE LABELLED CHECKPOINTS' CLOCK (user, 2026-09-04: "stop the animation
  // …display labels, pause…, animation continues"). Per-frame state, so it
  // lives in refs, not the store: which stops this run has already paid, and
  // until when the current hold lasts. A stop is re-armed by any travel
  // backwards past it (replay, scrub back).
  const hold = useRef({ until: 0, active: false })
  const passed = useRef(new Set<number>())

  useEffect(() => {
    if (!open) return
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = SN_W * dpr
    canvas.height = SN_H * dpr
    let frame = 0
    let last: number | null = null
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      const dt = last === null ? 0 : ms - last
      last = ms
      // Travelling backwards (replay from the end, a scrub back) re-arms the
      // stops behind the new position.
      for (const stop of passed.current) {
        if (state.current.u < stop) passed.current.delete(stop)
      }
      // ⚠ THE CLOCK BELONGS TO THE EVENT, not to whatever is re-rendering: the
      // position is advanced from the frame's own elapsed time and pushed into
      // the store, so a re-render cannot restart or skip the cycle.
      if (state.current.playing) {
        if (hold.current.active) {
          if (ms >= hold.current.until) hold.current.active = false
          // The picture holds, labels up; u does not advance.
        } else {
          let next = state.current.u + dt / SNARE_SCREEN_MS
          // ⚠ The labels switch (user, 2026-09-04): off = no checkpoint ever
          // pauses the run.
          if (state.current.labelsOn) {
            for (const stop of LABEL_STOPS) {
              if (!passed.current.has(stop) && state.current.u <= stop && next > stop) {
                next = stop
                passed.current.add(stop)
                hold.current = { until: ms + LABEL_HOLD_MS, active: true }
                break
              }
            }
          }
          if (next >= 1) useSnareStore.setState({ u: 1, playing: false })
          else useSnareStore.setState({ u: next })
        }
      } else {
        hold.current.active = false
      }
      // Labels show while a checkpoint holds the run, AND while parked (by a
      // diamond press or a scrub) exactly on a checkpoint. With the switch
      // off they show nowhere — rest and end stills included.
      const atStop =
        !state.current.playing &&
        LABEL_STOPS.some((s) => Math.abs(state.current.u - s) < 0.002)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawSnare2(ctx, {
        u: state.current.u,
        ms,
        labelAlpha: !state.current.labelsOn
          ? 0
          : hold.current.active || atStop
            ? 1
            : undefined,
      })
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open])

  const here = stageAt(u)

  return (
    <SideDrawer
      open={open}
      onClose={closeBench}
      ariaLabel="Vesicle life cycle and SNARE machinery"
    >
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section
            title="Right now"
            paragraphs={[
              { icon: '👀', text: `${here.stage.title}. ${here.stage.watch}` },
            ]}
          />
          <Section title="What this is" paragraphs={SNARE_PARTS} />
          <Section title="Keep in mind" paragraphs={SNARE_HONESTY} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          {/* ⚠ THE CONTROLS SIT ON THE CANVAS (user, 2026-09-02: "place button
              bars onto the canvas") — the same overlay grammar as the AP and
              synapse views: the TransportBar across the top, ▶ under its left
              end, in a pointer-transparent column so the picture beneath the
              empty middle stays clickable (the spoken labels live there).
              No timer — the cycle is a schematic sequence, not a clocked run.
              ⚠ NO RESET BUTTON (user, 2026-09-02: no extra buttons in the
              element) — the bar's start point and ▶-at-end cover it. */}
          <div className="relative min-w-0 rounded-xl border border-slate-700 bg-slate-950/40 p-2">
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10">
              <TransportBar
                className="pointer-events-auto"
                points={STAGES.map((s, i) => ({
                  id: s.id,
                  label: s.title,
                  u: STAGE_SPANS[i].from,
                  note: s.watch,
                }))}
                marks={
                  labelsOn
                    ? LABEL_STOPS.map((su, i) => ({
                        id: `labels-${i}`,
                        u: su,
                        title: 'Labels are shown here — press to visit',
                      }))
                    : []
                }
                value={u}
                playing={playing}
                onScrub={(v) => useSnareStore.getState().scrubTo(v)}
                onResume={() => useSnareStore.getState().play()}
                ariaLabel="Position through the cycle"
              />
              {/* ⚠ Labels to the RIGHT, under the timeline (user, 2026-09-04).
                  The action button and the switch are different kinds of
                  control — one starts the run, one changes how it is read —
                  and pushing them to opposite ends says so, while leaving the
                  middle of the bar free of chrome. */}
              <div className="mt-2 flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    playing
                      ? useSnareStore.getState().pause()
                      : useSnareStore.getState().play()
                  }
                  className="pointer-events-auto h-[38px] w-[104px] shrink-0 rounded-lg border border-amber-400/50 bg-amber-500/15 text-[13px] font-semibold text-amber-100 shadow-lg backdrop-blur transition hover:bg-amber-500/30"
                >
                  {playing ? '⏸ Pause' : '▶ Play'}
                </button>
                {/* ⚠ The labels switch (user, 2026-09-04): off = the run never
                    pauses to name things and no label is drawn anywhere. The
                    shared track-and-knob affordance — see LabelsSwitch. */}
                <LabelsSwitch
                  on={labelsOn}
                  onToggle={() => useLabelsStore.getState().toggleLabels()}
                  titleOn="Labels on: the run pauses at the marked moments to name things"
                  titleOff="Labels off: the run plays through without naming pauses"
                />
              </div>
            </div>
            <canvas
              ref={ref}
              onPointerDown={(e) => {
                if (!state.current.labelsOn) return
                const atStop =
                  !state.current.playing &&
                  LABEL_STOPS.some((s) => Math.abs(state.current.u - s) < 0.002)
                const box = e.currentTarget.getBoundingClientRect()
                const term = spokenTermAt(
                  snareLabels(
                    snareGeometry(),
                    state.current.u,
                    hold.current.active || atStop,
                  ),
                  e.clientX - box.left,
                  e.clientY - box.top,
                )
                if (term) speakAloud(term)
              }}
              style={{
                width: SN_W,
                height: SN_H,
                touchAction: 'none',
                cursor: 'pointer',
              }}
              aria-label="A synaptic vesicle fusing with the terminal membrane, and the proteins that pull it in"
            />
          </div>
        </div>
      </div>
    </SideDrawer>
  )
}
