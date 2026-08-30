import { SOMA_DIAMETER_UM, MEMBRANE_THICKNESS_NM } from './membrane'
// The 5 nm thickness is not a term in the arithmetic — it is already baked
// into the ~1 µF/cm² every bilayer has, which is WHY that constant is so
// stable. Named here because the honesty note quotes it.
void MEMBRANE_THICKNESS_NM
import { IONS } from './ions'
import { VM_SETTLE_MS } from './voltage'
import type { TeachingPara } from './neuron'

// D12 — the membrane as a charge-holder, and the ratio that is the whole
// lesson: the voltage lives in a SLIVER of ions against the two faces, and
// the crowds inside the cell never notice them leaving.
//
// Everything here is DERIVED from numbers the app already commits to — the
// declared 20 µm soma, the 5 nm membrane, the real potassium concentration —
// times two constants of nature. Nothing is typed in because it looked right,
// and the tests sweep the derivation rather than trusting one figure.
//
// Deliberately absent from the child-facing words: "capacitance", "farad",
// "Q = C·V". The kid gets: the membrane holds charge on its faces, more
// voltage means more of it, and the amount is tiny. The electrical names are
// in the honesty note, for the adult reading aloud.

/** Specific membrane capacitance, F/cm² — ~1 µF/cm², one of the most stable
 *  numbers in cell biology, because every lipid bilayer is the same 5 nm of
 *  oil. Stated rather than fitted. */
export const SPECIFIC_CAP_F_PER_CM2 = 1e-6

/** Elementary charge, coulombs. */
export const ELEMENTARY_CHARGE = 1.602e-19

/** Avogadro's number, per mole. */
export const AVOGADRO = 6.022e23

/** The soma treated as a sphere of the app's own declared diameter. */
export function somaAreaCm2(): number {
  const rCm = (SOMA_DIAMETER_UM / 2) * 1e-4
  return 4 * Math.PI * rCm * rCm
}

export function somaVolumeL(): number {
  const rCm = (SOMA_DIAMETER_UM / 2) * 1e-4
  const cm3 = (4 / 3) * Math.PI * rCm ** 3
  return cm3 / 1000 // 1 cm³ = 1 mL = 1e-3 L
}

/** The whole soma's charge-holding, in farads (~13 pF for a 20 µm cell). */
export function somaCapacitanceF(): number {
  return somaAreaCm2() * SPECIFIC_CAP_F_PER_CM2
}

/** How many single charges have to sit on the faces to hold `mv` millivolts.
 *  Q = C·V, done once, in the one place that says the words. */
export function chargesFor(mv: number): number {
  const volts = Math.abs(mv) / 1000
  return (somaCapacitanceF() * volts) / ELEMENTARY_CHARGE
}

/** How many potassium ions are dissolved in the whole soma — the crowd the
 *  sliver is taken from. */
export function potassiumInside(): number {
  const molesPerL = IONS.k.insideMM / 1000
  return molesPerL * somaVolumeL() * AVOGADRO
}

/** One in how many: the ratio that IS the lesson. Infinite at zero volts,
 *  where no charge is held at all — the caller must not print that. */
export function oneInHowMany(mv: number): number {
  const q = chargesFor(mv)
  return q === 0 ? Infinity : potassiumInside() / q
}

/** The resting voltage this bench opens on — the app's own resting number. */
export const REST_MV = -72

/** Charge is drawn as marks; this is how many ions one mark stands for, so
 *  the canvas can say it. Derived from the resting count and the number of
 *  marks the scene draws per face. */
export function ionsPerMark(mv: number, marks: number): number {
  return chargesFor(mv) / Math.max(1, marks)
}

const fmtBig = (n: number): string => {
  if (n >= 1e12) return `${(n / 1e12).toFixed(n / 1e12 < 10 ? 1 : 0)} trillion`
  if (n >= 1e9) return `${(n / 1e9).toFixed(n / 1e9 < 10 ? 1 : 0)} billion`
  if (n >= 1e6) return `${(n / 1e6).toFixed(n / 1e6 < 10 ? 1 : 0)} million`
  if (n >= 1e3) return `${Math.round(n / 1e3)} thousand`
  return `${Math.round(n)}`
}

export { fmtBig }

/** Everyday crowds a child has a feel for, for saying what "one in N" means.
 *  Each is a real, checkable count — the phrase is chosen by whichever is
 *  nearest in powers of ten, so it CHANGES with the dial rather than being a
 *  fixed flourish, and it never claims to be more exact than "about". */
const EVERYDAY: Array<{ n: number; what: string }> = [
  { n: 30, what: 'one child in a classroom' },
  { n: 600, what: 'one child in a whole school' },
  { n: 8_000, what: 'one person in a small town' },
  { n: 63_000, what: 'one person in a packed football stadium' },
  { n: 500_000, what: 'one person in a big city' },
  { n: 9_000_000, what: 'one person in London' },
]

export function crowdComparison(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return ''
  let best = EVERYDAY[0]
  for (const e of EVERYDAY) {
    if (Math.abs(Math.log10(e.n / ratio)) < Math.abs(Math.log10(best.n / ratio))) best = e
  }
  return best.what
}

/** The live reading, in words, for whatever voltage the bench is set to. */
export function capacitorRightNow(mv: number, settling: boolean): TeachingPara[] {
  const ratio = oneInHowMany(mv)
  if (Math.abs(mv) < 1) {
    return [
      {
        icon: '➖',
        text: 'Zero. Both faces are bare, nothing is held apart, and there is no voltage — that is what zero looks like. Turn the dial and watch the skin build.',
      },
    ]
  }
  // Which face is drawn HOW is itself worth saying, because the two faces are
  // drawn differently on purpose: the negative one in marks, the positive
  // inner one as the potassium themselves (see capacitorScene).
  const out: TeachingPara[] = [
    {
      icon: mv < 0 ? '🔵' : '🔴',
      text: `The two FACES are the wall's two surfaces — the one facing out of the cell and the one facing in. At ${
        mv < 0 ? '−' : '+'
      }${Math.abs(Math.round(mv))} mV they are holding ${
        mv < 0 ? 'minus charges on the inside face and plus charges on the outside' : 'plus charges on the inside face and minus charges on the outside'
      }, pulling at each other straight through the thin wall between them. That pull is the voltage.`,
    },
    {
      icon: '🌊',
      text: `Count them against the crowd they came from — both numbers are written on the picture — and the voltage borrows about ONE ion in every ${fmtBig(
        ratio,
      )}. That is ${crowdComparison(
        ratio,
      )}: take that one away and nobody would notice a thing. Which is why the crowd looks the same at every setting of the dial.`,
    },
    mv > 0
      ? {
          icon: '👀',
          text: 'Look at the inside face: there are no plus marks drawn on it, because you can already SEE them. The potassium pressed up against the wall ARE the plus charge on that face. The little marks are only used for charge too small or too shy to draw — like the minus on the outside face.',
        }
      : {
          icon: '👀',
          text: 'Look at the inside face: the potassium have backed away from the wall, and the minus marks are what they left behind. Nothing was added — a minus face is a face the plus ions have moved off.',
        },
  ]
  if (settling) {
    out.push({
      icon: '⏳',
      text: 'Watch the meter lag behind the dial: charge has to be carried onto the faces before the voltage is there, and that takes a moment. It is the same delay that gives a nerve spike its shape instead of a square edge.',
    })
  }
  return out
}

export const CAPACITOR_FACTS: TeachingPara[] = [
  {
    icon: '🧲',
    text: 'A membrane holds charge on its two faces, like two sheets of stickers that cannot reach each other. Plus on one side, minus on the other, pulling across the wall — that pull IS the voltage.',
  },
  {
    icon: '📈',
    text: 'Twice the voltage, twice the charge held: the skin thickens in step with the dial, and thins to nothing at zero.',
  },
  {
    icon: '🫸',
    text: 'Watch the potassium crowd lean as you turn the dial. Potassium is POSITIVE: a negative inside pushes it back from the wall — and that retreat is exactly what leaves the negative skin behind — while a positive inside pulls it up against the wall. Nobody leaves the cell; they just shuffle.',
  },
  {
    icon: '🥄',
    text: `A charge that leaves the crowd is a charge missing from it — but the crowd is enormous. One ion in tens of thousands does the whole job, so the sliver against the wall matters electrically while being invisible chemically.`,
  },
  {
    icon: '⏳',
    text: 'Because charge has to be MOVED onto the faces, voltage cannot change instantly. Every jump the meter makes is a little slower than the thing that caused it — the reason a spike rises and falls in a curve.',
  },
]

export function capacitorHonesty(): TeachingPara[] {
  return [
    {
      icon: '🔢',
      text: `Where the numbers come from: this app's soma is declared 20 µm across, a membrane is 5 nm thin everywhere, and a bilayer holds about 1 microfarad of charge per square centimetre. Those three give a whole cell about ${(
        somaCapacitanceF() * 1e12
      ).toFixed(0)} picofarads — the grown-up name for this is CAPACITANCE, and the sum is Q = C × V.`,
    },
    {
      icon: '🎚️',
      text: `Each mark on a face stands for a crowd of charges, not one: at rest there are about ${fmtBig(
        chargesFor(REST_MV),
      )} of them, far more than could be drawn. The marks' NUMBER follows the voltage honestly; their individual identity does not.`,
    },
    {
      icon: '🧂',
      text: 'The crowd is counted as potassium, the ion the cell is fullest of. Sodium, chloride and the rest are there too, so the true "one in how many" is even larger than the one quoted.',
    },
    {
      icon: '🫸',
      text: `The crowd's LEAN is hugely exaggerated. Potassium is positive, so a negative inside really does push it back from the wall and a positive inside pulls it in — but the real shuffle involves about one ion in ${fmtBig(
        oneInHowMany(REST_MV),
      )}, which no picture can show. What is honest here is the DIRECTION, and that the ions never leave: count them and the number is the same at every setting.`,
    },
    {
      icon: '⏱️',
      text: `The settling here takes about ${VM_SETTLE_MS} ms, the same figure the membrane view uses. A real cell's is faster or slower depending on how leaky it is — this bench shows that the delay EXISTS, not exactly how long it lasts.`,
    },
  ]
}
