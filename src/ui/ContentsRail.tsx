import { useEffect, useRef, useState } from 'react'
import { PARTS, builtIn, entriesIn, notBuiltYet, type Entry, type PartId } from '../core/contents'
import { goTo } from '../state/contentsNav'

// THE CONTENTS RAIL — a slim strip of icons down the left edge that GROWS into
// the full contents and shrinks back (user's own design, 2026-08-28).
//
// One container, not two. It was a rail with a panel appearing beside it,
// which read as two things — a strip, and a popup that belonged to something
// else. It is one box whose width animates, so the thing you hovered is the
// thing that opened: same border, same background, same corners, more of it.
//
// The icon column stays put through the whole movement and never re-lays-out,
// which is what makes the growth read as one object opening rather than as a
// swap. Each icon is also a jump link: click one and its Part scrolls into
// view, so the column is a way of getting about inside the menu as well as a
// picture of what is in it.
//
// Every row goes somewhere REAL: picking one flies the camera to the place and
// opens the exhibit when it lands (see `contentsNav`). The menu never becomes
// the app — it is a way into the world, and each exhibit still has its own
// door out on the canvas.

/** Kept narrow on purpose: it is one of the terms in the page-width sum in
 *  `App.tsx`, and the stage takes 1062 of whatever there is. */
const RAIL_W = 40
const OPEN_W = 320
/** Long enough to read as movement, short enough not to be in the way. */
const SLIDE_MS = 230

// ⚠ ONE ROW COMPONENT FOR BOTH KINDS (user, 2026-08-31: "make it look as
// similar to active chapters as the plan allows, but make it inactive"). A
// separate component for the planned rows would have drifted into a different
// row — different padding, different type size — and the whole point is that a
// Part reads as ONE list of what it will contain.
//
// What separates them is: dimmed, no hover, `disabled`, and a small `planned`
// tag. And it is genuinely inert — `entry.to` is null, so there is nothing for
// it to navigate to even if something did press it. A greyed-out button that
// still works is the worst of both.
function Row({ entry, onGo }: { entry: Entry; onGo: () => void }) {
  const planned = entry.planned === true
  return (
    <button
      type="button"
      disabled={planned}
      aria-disabled={planned || undefined}
      onClick={planned ? undefined : onGo}
      title={planned ? `${entry.asks} — planned, not built yet` : entry.asks}
      className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
        planned ? 'cursor-default opacity-40' : 'hover:bg-slate-700/70'
      }`}
    >
      <span aria-hidden className="mt-0.5 shrink-0 text-lg leading-none">
        {entry.icon}
      </span>
      <span className="min-w-0">
        {/* The concept's name for the adult, the question for the kid — the
            same split every button in this app uses. */}
        <span className="block text-[13px] font-medium leading-snug text-slate-100">
          {entry.title}
          {planned && (
            <span className="ml-1.5 align-middle text-[9px] font-semibold uppercase tracking-wider text-slate-500">
              planned
            </span>
          )}
        </span>
        <span className="block text-[11px] leading-snug text-slate-400">{entry.asks}</span>
      </span>
    </button>
  )
}

export function ContentsRail() {
  const [open, setOpen] = useState(false)
  const nav = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollTo = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const sections = useRef<Partial<Record<PartId, HTMLElement | null>>>({})

  useEffect(
    () => () => {
      for (const t of [nav, closing, scrollTo]) if (t.current) clearTimeout(t.current)
    },
    [],
  )

  const hold = () => {
    if (closing.current) clearTimeout(closing.current)
  }
  const release = () => {
    if (closing.current) clearTimeout(closing.current)
    // A beat before folding away, so crossing a gap on the way to a row does
    // not slam it shut.
    closing.current = setTimeout(() => setOpen(false), 260)
  }

  const go = (entry: Entry) => {
    if (entry.to === null) return
    if (nav.current) clearTimeout(nav.current)
    nav.current = goTo(entry.to)
    setOpen(false)
  }

  /** Clicking a Part's icon opens the menu and brings that Part into view —
   *  after the growth, or the scroll would be measured against a box that is
   *  still the wrong width. */
  const jump = (part: PartId) => {
    setOpen(true)
    hold()
    if (scrollTo.current) clearTimeout(scrollTo.current)
    scrollTo.current = setTimeout(() => {
      sections.current[part]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, SLIDE_MS + 20)
  }

  return (
    // The rail KEEPS ITS SLIM WIDTH IN THE LAYOUT and the growing box floats
    // over it. Left in the flow, growing from 44 to 320 would shove the
    // column and the whole stage sideways every time a pointer crossed it —
    // the menu is supposed to cover the column beside it, not move it.
    <div className="relative shrink-0" style={{ width: RAIL_W, height: 'calc(100vh - 46px)' }}>
    <div
      className="absolute left-0 top-0 z-30 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur"
      style={{
        width: open ? OPEN_W : RAIL_W,
        height: '100%',
        transition: `width ${SLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
      onPointerEnter={() => {
        hold()
        setOpen(true)
      }}
      onPointerLeave={release}
      onFocus={hold}
    >
      <div className="flex h-full" style={{ width: OPEN_W }}>
        {/* The column that never moves. */}
        <div
          className="flex shrink-0 flex-col items-center gap-1 py-2"
          style={{ width: RAIL_W }}
        >
          <span aria-hidden className="mb-1 text-base leading-none" title="Contents">
            ☰
          </span>
          {PARTS.map((part) => {
            // ⚠ THE FIRST BUILT ONE. Every Part has rows now, so an icon taken
            // from the whole list would light up a Part with nothing in it yet
            // and the spine would stop saying how far the app reaches.
            const first = builtIn(part.id)[0]
            return (
              <button
                key={part.id}
                type="button"
                onClick={() => jump(part.id)}
                title={`Part ${part.id} — ${part.title}`}
                aria-label={`Part ${part.id}, ${part.title}`}
                className={`rounded-md px-1 py-0.5 text-lg leading-none transition hover:bg-slate-700/70 ${
                  first ? '' : 'opacity-25'
                }`}
              >
                <span aria-hidden>{first?.icon ?? '·'}</span>
              </button>
            )
          })}
        </div>

        {/* The contents, REVEALED by the container growing round it rather
            than resized with it.
            ⚠ This was `flex-1` alongside an inline width, and `flex-1` wins:
            it sets `flex: 1 1 0%`, so the list was being re-sized on every
            frame of the animation and every paragraph rewrapped as it went —
            which is the jitter the user saw (2026-08-28). It is `shrink-0` at
            a fixed width now, and the box's `overflow-hidden` does the
            revealing. Nothing inside ever changes width, so nothing inside
            can reflow.
            `scrollbarGutter: stable` for the same reason one level down: a
            scrollbar appearing would narrow the text column under it. */}
        <div
          ref={listRef}
          className="min-h-0 shrink-0 overflow-y-auto py-2 pr-2"
          style={{
            width: OPEN_W - RAIL_W,
            scrollbarGutter: 'stable',
            opacity: open ? 1 : 0,
            transition: `opacity ${SLIDE_MS}ms ease`,
            pointerEvents: open ? 'auto' : 'none',
          }}
          onPointerEnter={hold}
        >
          <h2 className="px-1 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Contents
          </h2>
          {PARTS.map((part) => {
            const rows = entriesIn(part.id)
            return (
              <section
                key={part.id}
                ref={(el) => {
                  sections.current[part.id] = el
                }}
                className="scroll-mt-2 border-t border-slate-700 pt-2 first:border-t-0"
              >
                <h3 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Part {part.id} — {part.title}
                </h3>
                <p className="mb-1 px-1 text-[11px] leading-snug text-slate-500">{part.gist}</p>
                {/* ⚠ THE ONE CLAIM ABOUT WHAT EXISTS still stands, above the
                    planned rows rather than instead of them: a Part with
                    nothing built says so, and then shows what is coming. That
                    keeps `FRONTIER` the single source of "how far does this
                    app go" while the rows below say what the PLAN is. */}
                {builtIn(part.id).length === 0 && (
                  <p className="px-1 pb-1 text-[11px] italic leading-snug text-slate-600">
                    {notBuiltYet()}
                  </p>
                )}
                {rows.map((entry) => (
                  <Row key={entry.id} entry={entry} onGo={() => go(entry)} />
                ))}
              </section>
            )
          })}
          <p className="px-1 pb-1 pt-2 text-[11px] leading-snug text-slate-500">
            Everything here is also out on the picture — look for the magnifiers.
          </p>
        </div>
      </div>
    </div>
    </div>
  )
}
