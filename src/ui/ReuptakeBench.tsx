import { useEffect, useRef } from 'react'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { LabelsSwitch } from './LabelsSwitch'
import { TransportBar } from './Timeline'
import { speakAloud } from './SpeakButton'
import { useLabelsStore } from '../state/labelsStore'
import { useReuptakeStore } from '../state/reuptakeStore'
import { spokenTermAt } from '../stage/spokenLabels'
import {
  REUPTAKE_SCREEN_MS,
  RU_H,
  RU_W,
  drawReuptake,
  reuptakeGeometry,
  reuptakeLabels,
} from '../stage/reuptakeScene'
import {
  REUPTAKE_HONESTY,
  REUPTAKE_PARTS,
  REUPTAKE_SPANS,
  REUPTAKE_STAGES,
  reuptakeStageAt,
} from '../core/reuptake'

// D17 — where the transmitter goes. D06's sibling on the same shelf, and
// deliberately its twin in shape: the same drawer, the same transport bar with
// the stages as its points, the same ▶ and the same 🏷 switch. Two drawers
// opened from one view should not be two different kinds of thing.
//
// ⚠ The 🏷 switch is EARNED here by the placement rule (03): this canvas
// carries six or seven names over a moving cast, and at several moments a
// name sits where a molecule is about to be. It goes in the existing control
// row, right-aligned, opposite the action button — rule 1 of that list.
//
// ⚠ The picture is the SYNAPSE VIEW's own (rebuilt 2026-09-04), so the frame
// is that view's frame — `RU_W`/`RU_H` are `SYN_W`/`SYN_H`. A child opening
// this drawer should feel they have stayed where they were and been handed a
// new question, not been moved somewhere else.

export function ReuptakeBench() {
  const open = useReuptakeStore((s) => s.open)
  const u = useReuptakeStore((s) => s.u)
  const playing = useReuptakeStore((s) => s.playing)
  const closeBench = useReuptakeStore((s) => s.closeBench)
  const labelsOn = useLabelsStore((s) => s.labelsOn)

  const ref = useRef<HTMLCanvasElement>(null)
  const state = useRef({ u, playing, labelsOn })
  state.current = { u, playing, labelsOn }

  useEffect(() => {
    if (!open) return
    let frame = 0
    let last = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      const dt = last === 0 ? 16 : ms - last
      last = ms
      if (state.current.playing) {
        const next = state.current.u + dt / REUPTAKE_SCREEN_MS
        if (next >= 1) useReuptakeStore.getState().scrubTo(1)
        else useReuptakeStore.setState({ u: next })
      }
      const canvas = ref.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== RU_W * dpr) {
        canvas.width = RU_W * dpr
        canvas.height = RU_H * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, RU_W, RU_H)
      drawReuptake(ctx, {
        width: RU_W,
        height: RU_H,
        u: state.current.u,
        labelsOn: state.current.labelsOn,
      })
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open])

  const here = reuptakeStageAt(u)

  return (
    <SideDrawer
      open={open}
      onClose={closeBench}
      ariaLabel="Where the transmitter goes: uptake and the glutamine cycle"
    >
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section
            title="Right now"
            paragraphs={[
              { icon: '👀', text: `${here.stage.title}. ${here.stage.watch}` },
            ]}
          />
          <Section title="What this is" paragraphs={REUPTAKE_PARTS} />
          <Section title="Keep in mind" paragraphs={REUPTAKE_HONESTY} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          <div className="relative min-w-0 rounded-xl border border-slate-700 bg-slate-950/40 p-2">
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10">
              <TransportBar
                className="pointer-events-auto"
                points={REUPTAKE_STAGES.map((s, i) => ({
                  id: s.id,
                  label: s.title,
                  u: REUPTAKE_SPANS[i].from,
                  note: s.watch,
                }))}
                value={u}
                playing={playing}
                onScrub={(v) => useReuptakeStore.getState().scrubTo(v)}
                onResume={() => useReuptakeStore.getState().play()}
                ariaLabel="Position through the journey"
              />
              <div className="mt-2 flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    playing
                      ? useReuptakeStore.getState().pause()
                      : useReuptakeStore.getState().play()
                  }
                  className="pointer-events-auto h-[38px] w-[104px] shrink-0 rounded-lg border border-amber-400/50 bg-amber-500/15 text-[13px] font-semibold text-amber-100 shadow-lg backdrop-blur transition hover:bg-amber-500/30"
                >
                  {playing ? '⏸ Pause' : '▶ Play'}
                </button>
                <LabelsSwitch
                  on={labelsOn}
                  onToggle={() => useLabelsStore.getState().toggleLabels()}
                  titleOn="Labels on: each name points at the thing it names"
                  titleOff="Labels off: the picture carries no names"
                />
              </div>
            </div>
            <canvas
              ref={ref}
              onPointerDown={(e) => {
                if (!state.current.labelsOn) return
                const box = e.currentTarget.getBoundingClientRect()
                const term = spokenTermAt(
                  reuptakeLabels(reuptakeGeometry(RU_W, RU_H), state.current.u),
                  e.clientX - box.left,
                  e.clientY - box.top,
                )
                if (term) speakAloud(term)
              }}
              style={{ width: RU_W, height: RU_H, touchAction: 'none' }}
              aria-label="A synapse with an astrocyte beside it, collecting the released transmitter and sending it home"
            />
          </div>
        </div>
      </div>
    </SideDrawer>
  )
}
