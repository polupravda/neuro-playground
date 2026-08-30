import { useEffect, useRef } from 'react'
import { IONS, chargeTag, type IonKind } from '../core/ions'
import { drawGlossyIon, drawIonCharge, GLOSSY_COLORS } from '../stage/particleStyle'

// A KEY for a crowd of ions too small to label (see `needsIonKey`): one
// specimen of the species, drawn big enough to read, wearing the badge the
// crowd below is too small to show. Chrome, so it lives in the header where
// names belong — never over the stage, which carries no explanation.

const KEY_R = 9
const BOX = 30

export function IonKey({ kind }: { kind: IonKind }) {
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
    drawGlossyIon(ctx, kind, BOX * 0.44, BOX * 0.56, KEY_R)
    drawIonCharge(ctx, BOX * 0.44, BOX * 0.56, KEY_R, IONS[kind].charge)
  }, [kind])

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
