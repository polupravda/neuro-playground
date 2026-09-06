import { useEffect, useRef } from 'react'
import { useGatingStore, busyNow } from '../state/gatingStore'
import { useChannelStore } from '../state/channelStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { SideBySide } from './SideBySide'
import {
  PANEL_W,
  PANEL_H,
  drawFamilyPanel,
  lensChipAt,
  panelTerm,
} from '../stage/gatingScene'
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
//
// ⚠ THE LAYOUT ITSELF LIVES IN `SideBySide` NOW (21c-7, user: "analyze the
// layout 'Ion channel types', document it, create reusable component"). This
// bench is its reference user: the anatomy — headline with the speaker first,
// the fixed-height caption, the transparent canvas, the action at the foot, the
// empty slot where a panel has no action — is documented there, once, and this
// file keeps only what is D04's own: the families, their causes, their canvas.

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

function PanelCanvas({ id }: { id: FamilyId }) {
  const since = useGatingStore((s) => s.since[id])
  const openStructure = useChannelStore((s) => s.openBench)
  const family = FAMILIES.find((f) => f.id === id)!
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
    <canvas
      ref={ref}
      onPointerDown={(e) => {
        if (id !== 'leak') return
        const box = e.currentTarget.getBoundingClientRect()
        if (lensChipAt(e.clientX - box.left, e.clientY - box.top)) openStructure()
      }}
      style={{
        width: PANEL_W,
        height: PANEL_H,
        touchAction: 'none',
        cursor: id === 'leak' ? 'zoom-in' : 'default',
      }}
      aria-label={family.opensLine ?? `${family.name}: opens when ${family.opensWhen}`}
    />
  )
}

export function GatingBench() {
  const open = useGatingStore((s) => s.open)
  const closeBench = useGatingStore((s) => s.closeBench)
  const since = useGatingStore((s) => s.since)
  const poke = useGatingStore((s) => s.poke)

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="Ion channel types">
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section title="What this is" paragraphs={FRAMING} />
          <Section title="Right now" paragraphs={gatingRightNow(busyNow(since))} />
          <Section title="What opens what" paragraphs={GATING_PARTS} />
          <Section title="Keep in mind" paragraphs={GATING_HONESTY} />
        </div>

        {/* ⚠ A FIXED CAPTION HEIGHT, sized for THREE lines, not the two these
            sentences take on a wide screen: the panels narrow as the window
            does, and a height that fits exactly today's longest sentence clips
            it on a smaller display — swapping a moving membrane for a truncated
            one (user, 2026-08-30). */}
        <SideBySide
          captionH={46}
          panels={FAMILIES.map((family) => {
            const tint = GLOSSY_COLORS[family.tint]
            return {
              key: family.id,
              term: panelTerm(family.id),
              icon: family.icon,
              name: family.name,
              tint: { mid: tint.mid, light: tint.light, glow: tint.glow },
              caption: family.opensLine ?? `Opens when ${family.opensWhen}.`,
              canvas: <PanelCanvas id={family.id} />,
              action: isGated(family.id)
                ? {
                    label: CAUSE[family.id],
                    icon: family.icon,
                    title: `${CAUSE[family.id]} at this door and watch what happens`,
                    onClick: () => poke(family.id),
                  }
                : null,
            }
          })}
        />
      </div>
    </SideDrawer>
  )
}
