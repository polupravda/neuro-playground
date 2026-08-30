import { useEffect, useRef } from 'react'
import { IONS } from '../core/ions'
import { drawGlossyIon, drawIonCharge } from '../stage/particleStyle'
import { drawTraveller, TRAVELLER_MAG } from '../stage/permeaScene'
import { PX_PER_NM } from '../stage/bilayer'
import { PX_PER_UM } from '../stage/layout'
import { WATERS_IN_COAT, KEY_H } from '../stage/channelScene'
import { spoken, drawSpoken, spokenTermAt, type SpokenLabel } from '../stage/spokenLabels'
import { speakAloud } from './SpeakButton'

// A TO-SCALE SIZE KEY for the two ions (2026-08-28, the user: "Na+ ion is a
// smaller ion, but it is not displayed on the visual").
//
// The bench draws its ions at their true size, which is right, and which is
// also exactly why the point of the exhibit could not be seen: bare sodium is
// 3.4 screen pixels against potassium's 4.8, the charge badge is bigger than
// either of them, and the two are never on screen at the same moment anyway —
// you try one, then you try the other. "Sodium is the smaller ion" was a
// sentence in the info block with nothing in the picture to check it against.
//
// So they go side by side here, bare and coated, at their true RATIO,
// magnified until the difference is one a child can see. The magnification is
// written on the strip, because every exaggeration in this app is declared
// beside the real number — and it is the only number here: the nanometre
// readings and the column headings were removed as clutter a child does not
// read (user, 2026-08-28). What tells the two columns apart is that one of
// them is wearing water.
//
// And the water is MAGNIFIED AGAIN, in the app's own two-frame grammar: a
// small amber frame round one of the coat's molecules, a big one beside it,
// dashed lines between. A child who has met water in the permeability bench
// should be able to recognise it here, and a child who has not should be able
// to find out what it is by tapping its name.

const AMBER = '#f59e0b'
/** Enough that the biggest thing here — sodium in its coat, 0.72 nm across —
 *  is a legible 46 px. */
const KEY_PX_PER_NM = 46 / IONS.na.hydratedNm
/** Times life size, the same way every other magnification here is quoted. */
const KEY_MAG = Math.round(KEY_PX_PER_NM / (PX_PER_UM / 1000))
/** The blown-up water, and the frame it sits in. Big, because the point of
 *  blowing it up is that a child can see what it is made of. */
const BIG_BOX = 88
const BIG_WATER_MAG = 18

export function IonSizeKey({ width }: { width: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  const bigCx = width - BIG_BOX / 2 - 22
  const labels = (): SpokenLabel[] => [
    spoken('water', bigCx, KEY_H - 14, 'right'),
  ]

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = KEY_H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, KEY_H)

    // ONE ROW, in two groups (user, 2026-08-28): the two ions on their own,
    // side by side so the smaller one is obviously the smaller one — then a
    // gap — then the same two wearing their water, side by side so the order
    // is obviously the other way round. The comparison the exhibit turns on
    // is a left-to-right one, and stacking it in a grid hid it.
    const y = KEY_H * 0.46
    const BARE_GAP = 62
    const COAT_GAP = 74
    const bareX = 46
    const coatX = bareX + BARE_GAP + 96
    let waterAnchor = { x: coatX, y }

    const symbol = (x: number, text: string) => {
      ctx.textAlign = 'center'
      ctx.fillStyle = '#cbd5e1'
      ctx.font = '13px system-ui, sans-serif'
      ctx.fillText(text, x, KEY_H - 12)
    }

    for (const [i, kind] of (['na', 'k'] as const).entries()) {
      const ion = IONS[kind]
      const bare = (ion.bareNm / 2) * KEY_PX_PER_NM
      const bx = bareX + i * BARE_GAP
      drawGlossyIon(ctx, kind, bx, y, bare)
      drawIonCharge(ctx, bx, y, bare, ion.charge)
      symbol(bx, ion.symbol)

      const cx = coatX + i * COAT_GAP
      const coatR = (ion.hydratedNm / 2) * KEY_PX_PER_NM
      ctx.save()
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 2.5])
      ctx.beginPath()
      ctx.arc(cx, y, coatR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      const waterMag = KEY_PX_PER_NM / (TRAVELLER_MAG * PX_PER_NM)
      for (let w = 0; w < WATERS_IN_COAT; w++) {
        const a = (Math.PI * 2 * w) / WATERS_IN_COAT - Math.PI / 2
        const wx = cx + Math.cos(a) * (coatR - bare * 0.35)
        const wy = y + Math.sin(a) * (coatR - bare * 0.35)
        drawTraveller(ctx, 'water', wx, wy, waterMag)
        // The one that gets magnified: on the last ion, on its outer side, so
        // the connectors run away from everything else.
        if (kind === 'k' && w === 1) waterAnchor = { x: wx, y: wy }
      }
      drawGlossyIon(ctx, kind, cx, y, bare)
      symbol(cx, ion.symbol)
    }

    // The magnification, in two frames joined by dashed lines — the pattern
    // this app uses everywhere a small thing is shown big.
    const srcR = 11
    ctx.strokeStyle = AMBER
    ctx.lineWidth = 1.4
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.roundRect(waterAnchor.x - srcR, waterAnchor.y - srcR, srcR * 2, srcR * 2, 5)
    ctx.stroke()

    const bx = bigCx - BIG_BOX / 2
    // Up against the top edge, so the name can sit clear underneath it.
    const by = 6
    ctx.beginPath()
    ctx.roundRect(bx, by, BIG_BOX, BIG_BOX, 10)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)'
    ctx.lineWidth = 2.2
    ctx.setLineDash([7, 6])
    ctx.beginPath()
    ctx.moveTo(waterAnchor.x + srcR, waterAnchor.y - srcR)
    ctx.lineTo(bx, by)
    ctx.moveTo(waterAnchor.x + srcR, waterAnchor.y + srcR)
    ctx.lineTo(bx, by + BIG_BOX)
    ctx.stroke()
    ctx.setLineDash([])

    drawTraveller(ctx, 'water', bigCx, by + BIG_BOX / 2, BIG_WATER_MAG)

    // The declaration. It stays when the other numbers go: a magnification
    // that is not written down is a lie about size.
    ctx.fillStyle = '#64748b'
    ctx.font = '9px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`×${KEY_MAG.toLocaleString('en-US')} life size`, 8, 14)

    for (const l of labels()) drawSpoken(ctx, l)
  }, [width, bigCx])

  return (
    <canvas
      ref={ref}
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const term = spokenTermAt(labels(), e.clientX - rect.left, e.clientY - rect.top)
        if (term) speakAloud(term)
      }}
      style={{ width, height: KEY_H, touchAction: 'none', cursor: 'pointer' }}
      aria-label="Sodium and potassium at true relative size, on their own and wearing their coats of water"
    />
  )
}
