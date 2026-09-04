import { useEffect, useRef } from 'react'
import { useGatingStore, busyNow } from '../state/gatingStore'
import { useChannelStore } from '../state/channelStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { SpeakButton } from './SpeakButton'
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
  const openStructure = useChannelStore((s) => s.openBench)
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
      {/* ⚠ THE SPEAKER SITS IN FRONT OF THE TITLE (user, 2026-08-30), not on
          the canvas. The word it pronounces is written right here; putting the
          button anywhere else made the child hunt for a word they could
          already read, and cost the drawing space it needed. */}
      <h3
        className="flex items-center gap-1.5 px-1 text-[13px] font-semibold"
        style={{ color: tint.mid }}
      >
        <SpeakButton text={panelTerm(id)} />
        <span aria-hidden>{family.icon}</span>
        <span className="min-w-0 truncate">{family.name}</span>
      </h3>
      {/* ⚠ A FIXED HEIGHT, so the four MEMBRANES line up (user, 2026-08-30:
          "because the text line got shorter, the image got lifted").
          Every panel's canvas is the same size and draws its wall at the same
          place inside it, so the walls agree only as long as the canvases
          start at the same y — and this line is the one thing above them whose
          height depends on what it says. Rewriting the leak's sentence shorter
          lifted its whole picture, which is a caption moving a membrane.
          Anything laid above a row of drawings has to be a fixed size, or the
          drawings are not a row.

          Sized for THREE lines, not the two these sentences take on a wide
          screen: the panels narrow as the window does, and a height that fits
          exactly today's longest sentence clips it on a smaller display —
          swapping a moving membrane for a truncated one. */}
      <p className="h-[46px] shrink-0 overflow-hidden px-1 text-[11px] leading-snug text-slate-400">
        {family.opensLine ?? `Opens when ${family.opensWhen}.`}
      </p>
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
        /* ⚠ AN EMPTY SLOT, and it has to stay exactly the button's height
           (user, 2026-08-30: "'How it is built' is incorrectly placed. It does
           a different action than the rest of the buttons").
           
           A magnifier that navigates elsewhere was sitting where the other
           three panels keep the CAUSE that opens their door — the wrong
           promise, right beside three buttons keeping it. It has moved onto
           the canvas as a magnifier chip, which is this app's own grammar for
           "there is more to see here" and cannot be mistaken for a cause.
           
           The space stays because the four canvases must start at the same y,
           or the membranes stop lining up. */
        <div className="h-[38px]" aria-hidden />
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
