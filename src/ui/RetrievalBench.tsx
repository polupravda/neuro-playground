import { useEffect, useRef } from 'react'
import { useRetrievalStore } from '../state/retrievalStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { SideBySide } from './SideBySide'
import { PANEL_H, PANEL_MS, PANEL_W, drawPanel } from '../stage/retrievalScene'
import {
  RETRIEVAL_HONESTY,
  RETRIEVAL_PARTS,
  RETRIEVALS,
  type RetrievalId,
} from '../core/retrieval'

// S14 — SYNAPTIC VESICLE ENDOCYTOSIS.
//
// Three containers, side by side, in the 'side-by-side interactive comparison'
// layout (user, 2026-09-06: "make buttons look exactly like in 'Ion channel
// types'… bring back icons to the headline"). The layout's whole anatomy —
// headline with the speaker first, transparent canvas on the container's own
// ground, the action at the foot — lives in `SideBySide`, documented once and
// shared with D04. This file keeps only what is S14's own: the mechanisms,
// their runs, their canvases.
//
// ⚠ AND NOTHING IS WRITTEN ON THE CANVASES. The mechanism's name is the
// headline; everything else is in the info block, which is written to be read
// aloud.

function PanelCanvas({
  route,
  uRef,
}: {
  route: RetrievalId
  uRef: { current: number }
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = PANEL_W * dpr
    canvas.height = PANEL_H * dpr
    let frame = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // ⚠ The thermal clock is SCREEN time, so the molecules keep jostling when
      // the run has finished — a membrane is a liquid at every moment, not only
      // while something is being demonstrated.
      drawPanel(ctx, { route, u: uRef.current, width: PANEL_W, height: PANEL_H, ms })
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [route, uRef])
  return (
    <canvas
      ref={ref}
      style={{ width: PANEL_W, height: PANEL_H, touchAction: 'none' }}
      aria-label={`A piece of the terminal's wall with one vesicle, showing ${route} endocytosis`}
    />
  )
}

export function RetrievalBench() {
  const open = useRetrievalStore((s) => s.open)
  const closeBench = useRetrievalStore((s) => s.closeBench)
  const nonce = useRetrievalStore((s) => s.nonce)
  const playing = useRetrievalStore((s) => s.playing)

  // ⚠ THE POSITIONS LIVE IN REFS, one per panel — a per-frame value, by this
  // app's own rule, and three of them through a store would be three writes a
  // frame for something no other component needs to know.
  const us = useRef<Record<RetrievalId, { current: number }>>({
    kiss: { current: 1 },
    clathrin: { current: 1 },
    ultrafast: { current: 1 },
  })
  const seen = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!open) return
    // A panel whose nonce has changed starts over; the rest carry on.
    for (const r of RETRIEVALS) {
      if (seen.current[r.id] !== nonce[r.id]) {
        seen.current[r.id] = nonce[r.id]
        if (nonce[r.id] > 0) us.current[r.id].current = 0
      }
    }
  }, [nonce, open])

  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    if (!open) return
    let frame = 0
    let last: number | null = null
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      const dt = last === null ? 0 : ms - last
      last = ms
      // ⚠ ONE CLOCK FOR ALL THREE — advanced from the frame's own elapsed time,
      // so panels started together stay together and a re-render cannot skip a
      // run. ⚠ And only the PLAYING ones advance (21c-11): pause is the clock
      // stopping, not the drawing stopping — the lipids keep jostling on the
      // thermal clock while a paused run holds its frame.
      for (const r of RETRIEVALS) {
        if (!playingRef.current[r.id]) continue
        const u = us.current[r.id]
        u.current = Math.min(1, u.current + dt / PANEL_MS)
        if (u.current >= 1) useRetrievalStore.getState().finished(r.id)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open])

  // ⚠ THE PRESSED BUTTON BECOMES PAUSE (21c-11). Three states, one button:
  // playing → pause it; paused mid-run → carry on; at the start or the end →
  // start over. The u lives in a ref, so the bench decides which of the three
  // this press is.
  const toggle = (id: RetrievalId) => {
    const st = useRetrievalStore.getState()
    if (playingRef.current[id]) st.pause(id)
    else if (us.current[id].current > 0 && us.current[id].current < 1) st.resume(id)
    else st.start(id)
  }
  const anyPlaying = RETRIEVALS.some((r) => playing[r.id])
  const toggleAll = () => {
    const st = useRetrievalStore.getState()
    if (anyPlaying) {
      st.pauseAll()
      return
    }
    // If every panel is parked at an end, one press restarts the comparison;
    // if any is frozen mid-run, the press lets them all carry on together.
    const anyMidway = RETRIEVALS.some(
      (r) => us.current[r.id].current > 0 && us.current[r.id].current < 1,
    )
    if (anyMidway) st.resumeAll()
    else st.startAll()
  }

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="Synaptic vesicle endocytosis">
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section title="What this is" paragraphs={RETRIEVAL_PARTS} />
          {RETRIEVALS.map((r) => (
            <Section
              key={r.id}
              title={r.label}
              paragraphs={[{ icon: r.icon, text: r.what }]}
            />
          ))}
          <Section title="Keep in mind" paragraphs={RETRIEVAL_HONESTY} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          {/* ⚠ ONE PRESS RUNS ALL THREE. Started at three different moments the
              panels cannot be compared, and comparing them is the whole point.
              The row's own control, in the panel-action grammar. */}
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={toggleAll}
              title={
                anyPlaying
                  ? 'Freeze all three where they are'
                  : 'Run all three together, so they can be compared'
              }
              className="h-[38px] whitespace-nowrap rounded-lg border border-amber-400/80 bg-amber-500/20 px-3 text-[12px] font-semibold text-amber-100 transition hover:bg-amber-500/30"
            >
              <span aria-hidden>{anyPlaying ? '⏸' : '▶'}</span>{' '}
              {anyPlaying ? 'Pause' : 'Run all three'}
            </button>
          </div>

          <SideBySide
            panels={RETRIEVALS.map((r) => ({
              key: r.id,
              term: r.label,
              icon: r.icon,
              name: r.label,
              canvas: <PanelCanvas route={r.id} uRef={us.current[r.id]} />,
              action: playing[r.id]
                ? {
                    label: 'Pause',
                    icon: '⏸',
                    title: 'Freeze this one where it is',
                    onClick: () => toggle(r.id),
                  }
                : {
                    label: 'Run this one',
                    icon: '▶',
                    title: 'Start exocytosis in this one only — or carry on where it paused',
                    onClick: () => toggle(r.id),
                  },
            }))}
          />
        </div>
      </div>
    </SideDrawer>
  )
}
