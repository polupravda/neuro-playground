import { RESET_LABEL } from '../stage/resetChip'

// ⚠ THE ONE RESET, in DOM form — the same control the canvases draw
// (`stage/resetChip`), for benches whose reset lives in their chrome.
//
// It reads its label from there rather than repeating the string, so the word
// and the glyph cannot drift between a canvas button and a DOM one.

export function ResetButton({
  onClick,
  title,
  className,
  height = 28,
}: {
  onClick: () => void
  /** What this particular reset puts back, for the hover. The BUTTON says
   *  "↺ Reset" everywhere — a control that does the same thing in every
   *  exhibit has to read the same in every exhibit — and the sentence
   *  explaining what "back" means here belongs in `title`, not on the face of
   *  it. */
  title: string
  className?: string
  /** The chips in the axon views' floating control are 38 px tall; a bench's
   *  own row is 28. The LOOK never changes — only how tall the row it is
   *  sitting in happens to be. */
  height?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`shrink-0 rounded-lg border border-amber-500/60 bg-amber-500/15 px-3 text-[12px] font-semibold text-amber-200 transition hover:bg-amber-500/25 ${
        className ?? ''
      }`}
      style={{ height }}
    >
      {RESET_LABEL}
    </button>
  )
}
