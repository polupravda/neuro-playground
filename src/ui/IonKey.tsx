import { useEffect, useRef } from 'react'
import { IONS, chargeTag, type IonKind } from '../core/ions'
import { drawGlossyIon, drawIonCharge, GLOSSY_COLORS } from '../stage/particleStyle'

// A KEY for a crowd of ions too small to label (see `needsIonKey`): one
// specimen of the species, drawn big enough to read, wearing the badge the
// crowd below is too small to show. Chrome, so it lives in the header where
// names belong — never over the stage, which carries no explanation.

const KEY_R = 9
const BOX = 30

/** The widest bare ion in the cast, so `bare` keys are scaled against a fixed
 *  ruler rather than against whichever two happen to be on screen. */
const WIDEST_BARE_NM = Math.max(...Object.values(IONS).map((i) => i.bareNm))

export function IonKey({ kind, size = 'same' }: { kind: IonKind; size?: 'same' | 'bare' }) {
  // ⚠ `bare` DRAWS THE ION AT ITS REAL BARE SIZE, RELATIVE TO THE OTHERS
  // (user, 2026-08-30: "in 'selectivity filter', on the button, make Na ion
  // look smaller than K ion").
  //
  // Everywhere else a key is a SPECIMEN — one of a crowd, drawn big enough to
  // read a badge on, and all keys the same size so none looks more important.
  // The selectivity filter is the one exhibit where the size IS the subject:
  // its whole answer is that a bare sodium ion is SMALLER than a bare
  // potassium ion and still cannot get through. A button that drew them the
  // same size was contradicting the picture it opened.
  //
  // Bare, not hydrated: inside the filter the coat is off, and that is the
  // comparison the exhibit is making. (Hydrated, the order reverses — sodium
  // is the BIGGER one — which is exactly why the two must never be muddled.)
  const r = size === 'bare' ? KEY_R * (IONS[kind].bareNm / WIDEST_BARE_NM) : KEY_R
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = BOX * dpr
    canvas.height = BOX * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, BOX, BOX)
    // Off-centre a touch: the badge sits up and right, and needs the room.
    drawGlossyIon(ctx, kind, BOX * 0.44, BOX * 0.56, r)
    drawIonCharge(ctx, BOX * 0.44, BOX * 0.56, r, IONS[kind].charge)
  }, [kind, r])

  return (
    <span className="flex items-center gap-1.5">
      <canvas
        ref={ref}
        style={{ width: BOX, height: BOX }}
        aria-label={`${IONS[kind].name}, charge ${chargeTag(kind)}`}
      />
      <span className="text-base font-semibold" style={{ color: GLOSSY_COLORS[kind].mid }}>
        {IONS[kind].symbol}
      </span>
    </span>
  )
}
