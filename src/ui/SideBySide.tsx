import type { ReactNode } from 'react'
import { SpeakButton } from './SpeakButton'

// ⚠ THE 'SIDE-BY-SIDE INTERACTIVE COMPARISON' LAYOUT (21c-7, user: "analyze the
// layout 'Ion channel types', document it, create reusable component… so I can
// refer to it in the future").
//
// One container per THING BEING COMPARED, in a row, each with the same four
// slots top to bottom — and the discipline is that the slots are FIXED SIZE, so
// the pictures line up as a row. The layout was born in the equilibrium bench,
// matured in 'Ion channel types' (D04), and is now shared by 'Synaptic vesicle
// endocytosis' (S14). Its anatomy, as measured off D04:
//
//   ┌──────────────────────────────────────────────── the ROW
//   │  flex min-h-0 min-w-0 items-stretch gap-2.5
//   │  — containers STRETCH to the drawer's bottom; panel heights are
//   │    measured from the drawer's own height in the scene module, never
//   │    typed in the component (the 2026-08-28 rule: a layout is SOLVED
//   │    from a budget).
//   │
//   │  ┌───────────────────────────────────────────── one CONTAINER
//   │  │  flex min-h-0 min-w-0 flex-1 flex-col gap-2
//   │  │  rounded-xl border border-slate-700 bg-slate-950/40 p-2
//   │  │
//   │  │  1. HEADLINE, inside the container: <h3> flex, gap-1.5, px-1,
//   │  │     text-[13px] font-semibold, tinted per panel.
//   │  │     ⚠ THE SPEAKER SITS IN FRONT OF THE TITLE (user, 2026-08-30) —
//   │  │     the word it pronounces is written right there, and the child
//   │  │     must not hunt for it. Then the icon, then the name.
//   │  │  2. CAPTION, optional and FIXED-HEIGHT (user, 2026-08-30: "because
//   │  │     the text line got shorter, the image got lifted"). Anything laid
//   │  │     above a row of drawings must be a fixed size, or the drawings
//   │  │     are not a row. text-[11px] leading-snug text-slate-400.
//   │  │  3. THE CANVAS — transparent background, so the container's own
//   │  │     bg-slate-950/40 is the picture's ground. A scene may wash only
//   │  │     what its meaning needs (a compartment, a lumen), never the
//   │  │     whole frame.
//   │  │  4. ACTION, at the container's foot: h-[38px] w-full rounded-lg
//   │  │     border px-2 text-[12px] font-semibold, tinted like its panel;
//   │  │     the icon rides INSIDE the label. A panel with no action keeps
//   │  │     an EMPTY SLOT of the same height (user, 2026-08-30) — the
//   │  │     canvases must start at the same y or the pictures stop being
//   │  │     comparable, which is the layout's whole point.
//   │  └─────────────────────────────────────────────
//   └────────────────────────────────────────────────
//
// What the component does NOT own: the canvas element and its animation loop
// (each bench keeps its own rAF and draw call — clocks belong to events), the
// panel sizing (the scene's budget arithmetic), and the info column (the
// drawer's own grammar).

export interface SideBySideTint {
  /** Border and headline ink. */
  mid: string
  /** The action's text ink. */
  light: string
  /** The action's wash, as "r, g, b". */
  glow: string
}

export interface SideBySidePanelSpec {
  key: string
  /** What the speaker says — often longer than the printed name. */
  term: string
  icon: string
  name: string
  /** Headline and action tint; slate when the comparison has no colour code. */
  tint?: SideBySideTint
  /** The fixed-height caption. Give `captionH` on the row when any panel has
   *  one; every panel then reserves the height, text or no text. */
  caption?: string
  /** The picture: a <canvas> the bench animates itself. */
  canvas: ReactNode
  /** The one thing to do to THIS panel — or null for the reference panel,
   *  which keeps an empty slot of the same height. */
  action: {
    label: string
    icon?: string
    title: string
    onClick: () => void
  } | null
}

const SLATE: SideBySideTint = {
  mid: '#94a3b8',
  light: '#e2e8f0',
  glow: '148, 163, 184',
}

export function SideBySide({
  panels,
  captionH = 0,
}: {
  panels: SideBySidePanelSpec[]
  /** Height of the caption slot, px — sized for MORE lines than today's
   *  longest caption takes, because panels narrow with the window and a
   *  height that fits exactly clips on a smaller display. */
  captionH?: number
}) {
  return (
    <div className="flex min-h-0 min-w-0 items-stretch gap-2.5">
      {panels.map((p) => {
        const tint = p.tint ?? SLATE
        return (
          <div
            key={p.key}
            className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 rounded-xl border border-slate-700 bg-slate-950/40 p-2"
          >
            <h3
              className="flex items-center gap-1.5 px-1 text-[13px] font-semibold"
              style={{ color: tint.mid }}
            >
              <SpeakButton text={p.term} />
              <span aria-hidden>{p.icon}</span>
              <span className="min-w-0 truncate">{p.name}</span>
            </h3>
            {captionH > 0 && (
              <p
                className="shrink-0 overflow-hidden px-1 text-[11px] leading-snug text-slate-400"
                style={{ height: captionH }}
              >
                {p.caption}
              </p>
            )}
            {p.canvas}
            {p.action ? (
              <button
                type="button"
                onClick={p.action.onClick}
                title={p.action.title}
                className="h-[38px] w-full whitespace-nowrap rounded-lg border px-2 text-[12px] font-semibold transition"
                style={{
                  borderColor: tint.mid,
                  color: tint.light,
                  background: `rgba(${tint.glow}, 0.18)`,
                }}
              >
                {p.action.icon && <span aria-hidden>{p.action.icon}</span>}{' '}
                {p.action.label}
              </button>
            ) : (
              <div className="h-[38px]" aria-hidden />
            )}
          </div>
        )
      })}
    </div>
  )
}
