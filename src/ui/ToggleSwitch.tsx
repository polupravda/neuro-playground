// The track-and-knob switch — the aquaporin toggle's grammar (sky-500 on, a
// sliding knob, on/off readable without reading).
//
// It began as `LabelsSwitch`, extracted the moment a SECOND view needed the
// labels toggle. When a THIRD control wanted the same affordance — 🔆 focus,
// which was a press-to-light chip while 🏷 labels beside it was a switch
// (user, 2026-09-04: "turn 'focus' into a switch toggle, same as 'labels'") —
// the thing to extract was the affordance itself, not to copy it again. Two
// controls that do the same kind of thing must look like the same kind of
// thing.

export function ToggleSwitch({
  icon,
  word,
  on,
  onToggle,
  titleOn,
  titleOff,
  className,
}: {
  /** The glyph that RANKS it in a row. Never the only thing it carries. */
  icon: string
  /** The name. A switch with only an icon is a switch nobody can name. */
  word: string
  on: boolean
  onToggle: () => void
  titleOn: string
  titleOff: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={on ? titleOn : titleOff}
      onClick={onToggle}
      className={`pointer-events-auto flex h-[38px] shrink-0 items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/85 px-3 text-[13px] font-semibold text-slate-200 shadow-lg backdrop-blur transition hover:bg-slate-800 ${className ?? ''}`}
    >
      <span>
        {icon} {word}
      </span>
      <span
        aria-hidden
        className={`relative h-[18px] w-[34px] rounded-full border transition ${
          on ? 'border-sky-400 bg-sky-500' : 'border-slate-600 bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-[2px] h-[13px] w-[13px] rounded-full transition-all ${
            on ? 'left-[17px] bg-slate-50' : 'left-[2px] bg-slate-400'
          }`}
        />
      </span>
    </button>
  )
}
