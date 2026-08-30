import { useEffect, useRef } from 'react'
import { useGatingStore, busyNow } from '../state/gatingStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { speakAloud } from './SpeakButton'
import { spokenTermAt } from '../stage/spokenLabels'
import { PANEL_W, PANEL_H, drawFamilyPanel, panelLabels } from '../stage/gatingScene'
import {
  FAMILIES,
  GATING_PARTS,
  GATING_HONESTY,
  gatingRightNow,
  isGated,
  type FamilyId,
} from '../core/gating'
import { GLOSSY_COLORS } from '../stage/particleStyle'

// D04 — ion channel types.
//
// One container per family, side by side, in the equilibrium bench's grammar
// (user, 2026-08-28). Each panel has its own button, and the button does not
// "set" anything: it sends the cause in to DO something to the door. Watching
// the messenger land, the charge flash over, the finger press the wall — that
// is the exhibit.
//
// The leak has no button, because it has no gate. It is the control the other
// three are read against.

const FRAMING = [
  {
    icon: '🚪',
    text: 'Four doors in the same wall. One of them has no gate at all and is simply always open. The other three are shut until something comes and opens them — and each one only listens for its OWN something.',
  },
  {
    icon: '👀',
    text: 'Press a button and watch what arrives: a flash of charge, a messenger landing, a finger pressing the wall. Then watch the other three doors. Nothing.',
  },
]

const CAUSE: Record<FamilyId, string> = {
  leak: '',
  voltage: 'Flash the charge',
  ligand: 'Send a messenger',
  mechanical: 'Push the wall',
}

function Panel({ id }: { id: FamilyId }) {
  const since = useGatingStore((s) => s.since[id])
  const poke = useGatingStore((s) => s.poke)
  const family = FAMILIES.find((f) => f.id === id)!
  const tint = GLOSSY_COLORS[family.tint]
  const ref = useRef<HTMLCanvasElement>(null)
  const sinceRef = useRef(since)
  sinceRef.current = since

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
      const began = sinceRef.current
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, PANEL_W, PANEL_H)
      drawFamilyPanel(ctx, id, began === null ? null : ms - began, ms)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [id])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-xl border border-slate-700 bg-slate-950/40 p-2">
      <h3 className="px-1 text-[13px] font-semibold" style={{ color: tint.mid }}>
        <span aria-hidden>{family.icon}</span> {family.name}
      </h3>
      <p className="px-1 text-[11px] leading-snug text-slate-400">
        Opens when {family.opensWhen}.
      </p>
      <canvas
        ref={ref}
        onPointerDown={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const term = spokenTermAt(panelLabels(id), e.clientX - box.left, e.clientY - box.top)
          if (term) speakAloud(term)
        }}
        style={{ width: PANEL_W, height: PANEL_H, touchAction: 'none', cursor: 'pointer' }}
        aria-label={`${family.name}: opens when ${family.opensWhen}`}
      />
      {isGated(id) ? (
        <button
          type="button"
          onClick={() => poke(id)}
          title={`${CAUSE[id]} at this door and watch what happens`}
          className="h-[38px] w-full whitespace-nowrap rounded-lg border px-2 text-[12px] font-semibold transition"
          style={{
            borderColor: tint.mid,
            color: tint.light,
            background: `rgba(${tint.glow}, 0.18)`,
          }}
        >
          <span aria-hidden>{family.icon}</span> {CAUSE[id]}
        </button>
      ) : (
        <p className="flex h-[38px] items-center justify-center px-2 text-center text-[11px] leading-snug text-slate-500">
          No button — it has no gate to open.
        </p>
      )}
    </div>
  )
}

export function GatingBench() {
  const open = useGatingStore((s) => s.open)
  const closeBench = useGatingStore((s) => s.closeBench)
  const since = useGatingStore((s) => s.since)

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="Ion channel types">
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section title="What this is" paragraphs={FRAMING} />
          <Section title="Right now" paragraphs={gatingRightNow(busyNow(since))} />
          <Section title="What opens what" paragraphs={GATING_PARTS} />
          <Section title="Keep in mind" paragraphs={GATING_HONESTY} />
        </div>

        {/* One container per door, side by side — the equilibrium bench's own
            layout, and the reference figure's. */}
        {/* The four containers STRETCH to the bottom of the page (user,
            2026-08-28) rather than sitting in a band across the top: the
            panel heights are measured from the drawer's own height in
            `gatingScene`, and the row is stretched to match. */}
        <div className="flex min-h-0 min-w-0 items-stretch gap-2.5">
          {FAMILIES.map((family) => (
            <Panel key={family.id} id={family.id} />
          ))}
        </div>
      </div>
    </SideDrawer>
  )
}
