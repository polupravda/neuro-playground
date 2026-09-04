// Speakable names on a canvas (F04): an amber 🔊 glyph before the name, and a
// tap inside the box says the term. Extracted from the lipid lab the moment a
// second exhibit needed them — one drawing of the affordance, never two.
//
// Positions are pure functions (no ctx), so a view's pointer handler hit-tests
// the exact boxes the drawing used.

const AMBER = '#f59e0b'
const LABEL = '#cbd5e1'

// ⚠ THE APP'S ONE LABEL STYLE (user, 2026-09-04: "unify labels across the
// app. Source of truth: vesicle view"). Every NAME drawn on any canvas is
// this plate, this font, this ink — the vesicle view's own — so a child who
// learns what a name looks like in one exhibit reads names everywhere. The
// whole-neuron scene used to run a second system entirely (13px
// `ui-sans-serif`, plate rgba(15,23,42,0.92), ink #64748b), which is how one
// visual language quietly became two.
//
// ⚠ WHAT "UNIFIED" DOES NOT COVER: which terms SPEAK. Voice is granted per
// term, on request ("add voice to term A" — CLAUDE.md), and unifying the
// look of labels must not hand forty terms a speaker nobody asked for
// (ruled by the user, 2026-09-04, against the reading that the vesicle
// view's speakers came with its style).
export const LABEL_PLATE = 'rgba(2, 6, 23, 0.72)'
export const LABEL_INK = LABEL
export const LABEL_PX = 11
export const labelFont = (px: number = LABEL_PX): string =>
  `${px}px system-ui, sans-serif`

/** The leader from a name to the thing it names. One ink, one weight, and it
 *  leaves the label's BOX CENTRE — the vesicle view's own geometry. Views
 *  used to start it at the ink's edge, which reads as a different idiom. */
export const CONNECTOR_INK = 'rgba(148, 163, 184, 0.85)'

export function drawConnector(
  ctx: CanvasRenderingContext2D,
  l: { x: number; y: number; w: number; h: number },
  to: { x: number; y: number },
): void {
  ctx.save()
  ctx.strokeStyle = CONNECTOR_INK
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(l.x + l.w / 2, l.y + l.h / 2)
  ctx.lineTo(to.x, to.y)
  ctx.stroke()
  ctx.restore()
}

export interface SpokenLabel {
  term: string
  /** Text anchor (baseline), in the canvas's CSS pixel space. */
  ax: number
  ay: number
  align: 'left' | 'right'
  /** Hit box. */
  x: number
  y: number
  w: number
  h: number
}

/** Generous padding round the glyph and the word. A name is 11 px tall and a
 *  child aiming with a finger is not; the box a tap has to land in is made
 *  comfortably bigger than the ink (2026-08-28, after the voice was reported
 *  as not working). */
const HIT_PAD_X = 8
const HIT_PAD_Y = 8

export const spoken = (
  term: string,
  ax: number,
  ay: number,
  align: 'left' | 'right' = 'left',
): SpokenLabel => {
  const tw = term.length * 6.2
  // The ink runs from the speaker glyph to the end of the word: for a
  // left-aligned name that is [ax − 18, ax + tw]; mirrored on the right.
  const inkFrom = align === 'left' ? ax - 18 : ax - tw - 2
  const inkTo = align === 'left' ? ax + tw : ax + 18
  return {
    term,
    ax,
    ay,
    align,
    x: inkFrom - HIT_PAD_X,
    y: ay - 12 - HIT_PAD_Y,
    w: inkTo - inkFrom + HIT_PAD_X * 2,
    h: 16 + HIT_PAD_Y * 2,
  }
}

export function spokenTermAt(
  labels: readonly SpokenLabel[],
  x: number,
  y: number,
): string | null {
  for (const l of labels) {
    if (x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h) return l.term
  }
  return null
}

export const speakerGlyph = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.fillStyle = AMBER
  ctx.beginPath()
  ctx.moveTo(x - 5.5, y - 2)
  ctx.lineTo(x - 2.5, y - 2)
  ctx.lineTo(x + 0.5, y - 4.5)
  ctx.lineTo(x + 0.5, y + 4.5)
  ctx.lineTo(x - 2.5, y + 2)
  ctx.lineTo(x - 5.5, y + 2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = AMBER
  ctx.lineWidth = 1.1
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(x + 2.2, y, 2.3, -0.9, 0.9)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + 2.2, y, 4.2, -0.9, 0.9)
  ctx.stroke()
}

export function drawSpoken(ctx: CanvasRenderingContext2D, l: SpokenLabel) {
  // A dark plate under every name (2026-08-28). These sit on whatever the
  // view happens to draw — pale lipid heads, a bright protein — and a name
  // that disappears into its background is a name nobody can tap.
  //
  // ⚠ NO OUTLINE ON THE PLATE (user, 2026-08-30: "on voicing labels, remove
  // outline on the container"). The plate's job is legibility — to stop a name
  // disappearing into whatever it lies on — and a dark wash does that on its
  // own. A rim round it makes the name look like a BUTTON, which it is not:
  // the speaker glyph beside it is the control, and boxing the word competes
  // with that. It also put a ruled rectangle on top of drawings the app has
  // taken a lot of trouble to keep unruled.
  ctx.save()
  ctx.fillStyle = LABEL_PLATE
  ctx.beginPath()
  ctx.roundRect(l.x + 2, l.y + 2, l.w - 4, l.h - 4, 5)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = LABEL_INK
  ctx.font = labelFont()
  ctx.textAlign = l.align
  ctx.fillText(l.term, l.ax, l.ay)
  speakerGlyph(ctx, l.align === 'left' ? l.ax - 11 : l.ax + 11, l.ay - 4)
}

/** A NAME that does not speak: the same plate, font and ink, without the F04
 *  glyph. Voice is per term (see above), so most names on most canvases are
 *  drawn with this — and they still look like every other name in the app. */
export function drawName(ctx: CanvasRenderingContext2D, l: SpokenLabel): void {
  ctx.save()
  ctx.fillStyle = LABEL_PLATE
  ctx.beginPath()
  ctx.roundRect(l.x + 2, l.y + 2, l.w - 4, l.h - 4, 5)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = LABEL_INK
  ctx.font = labelFont()
  ctx.textAlign = l.align
  ctx.fillText(l.term, l.ax, l.ay)
}

/** A name whose hit box is sized for a word with no speaker glyph in front of
 *  it — `spoken()` reserves 18 px for the glyph, which would leave a silent
 *  name sitting off-centre on its own plate. */
export const named = (
  term: string,
  ax: number,
  ay: number,
  align: 'left' | 'right' = 'left',
): SpokenLabel => {
  const tw = term.length * 6.2
  const inkFrom = align === 'left' ? ax : ax - tw
  const inkTo = align === 'left' ? ax + tw : ax
  return {
    term,
    ax,
    ay,
    align,
    x: inkFrom - HIT_PAD_X,
    y: ay - 12 - HIT_PAD_Y,
    w: inkTo - inkFrom + HIT_PAD_X * 2,
    h: 16 + HIT_PAD_Y * 2,
  }
}
