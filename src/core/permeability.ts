import type { TeachingPara } from './neuron'

// D02 — what crosses a bare lipid wall, and what never does.
//
// The science is one number per traveller: the permeability coefficient of a
// pure lipid bilayer, in cm/s. The honest span is enormous — oxygen against
// sodium is about fourteen orders of magnitude — and that span is the whole
// lesson: the wall is not a sieve with a mesh size, it is an oily moat that
// charge cannot enter. Small and uncharged dissolves through; charged or big
// waits essentially forever.
//
// The values are ORDER-OF-MAGNITUDE figures from measurements on pure lipid
// films (they shift with the lipid mix); the ladder states them as such. The
// ORDERING is robust and is what the bench teaches.

export type TravellerId = 'o2' | 'co2' | 'water' | 'glucose' | 'na'

export interface Traveller {
  id: TravellerId
  name: string
  /** Spoken and printed beside the container (F04 voice term). */
  term: string
  /** The icon its info-block bullet leads with. */
  icon: string
  /** cm/s across a pure lipid bilayer, order of magnitude. */
  permeability: number
  /** How big it really is, nm — the kinetic diameter for the gases and water,
   *  the van der Waals span for glucose, the BARE ionic diameter for sodium
   *  (its water coat is explained in words; drawing the bare ion is what makes
   *  "smaller than water and still shut out" visible). Drawn to this size
   *  against a wall drawn to its own, so the comparison is honest. */
  sizeNm: number
  /** Why it crosses or does not — one clause, used by the describer. */
  why: string
  /** Charge, because charge is the verdict. */
  charged: boolean
  /** The odds the TANK animation uses per wall-touch. Deliberately compressed
   *  (see PERMEA_HONESTY): the tank shows the ORDER, the ladder the truth. */
  visualOdds: number
}

export const TRAVELLERS: Traveller[] = [
  {
    id: 'o2',
    sizeNm: 0.346,
    name: 'oxygen',
    icon: '🌬️',
    term: 'oxygen',
    permeability: 20,
    why: 'tiny and carries no charge — it dissolves straight through the oil',
    charged: false,
    visualOdds: 0.95,
  },
  {
    id: 'co2',
    sizeNm: 0.33,
    name: 'carbon dioxide',
    icon: '💨',
    term: 'carbon dioxide',
    permeability: 0.35,
    why: 'also small and uncharged — through the oil it goes',
    charged: false,
    visualOdds: 0.75,
  },
  // Water sits in the MIDDLE slot, so its tray is directly above the aquaporin
  // in the middle of the wall: its own door under its own container.
  {
    id: 'water',
    sizeNm: 0.265,
    name: 'water',
    icon: '💧',
    term: 'water',
    permeability: 3e-3,
    why: 'uncharged but polar — it dissolves in oil poorly, so only a trickle gets through',
    charged: false,
    visualOdds: 0.06,
  },
  {
    id: 'glucose',
    sizeNm: 0.86,
    name: 'glucose',
    icon: '🍬',
    term: 'glucose',
    permeability: 1e-7,
    why: 'no net charge, but big and covered in water-loving groups — the oil will not take it',
    charged: false,
    visualOdds: 0,
  },
  {
    id: 'na',
    sizeNm: 0.204,
    name: 'sodium ion',
    icon: '🧂',
    term: 'sodium',
    permeability: 1e-13,
    why: 'CHARGED — water clings to charge, so it wears a coat of water it cannot take off, and neither the coat nor the bare charge can enter oil',
    charged: true,
    visualOdds: 0,
  },
]

/** Print a coefficient the way a reading wants it: plain when plain, a power
 *  of ten when tiny. */
export function fmtPermeability(p: number): string {
  if (p >= 0.01) return `${p}`
  const e = Math.round(Math.log10(p))
  const sup: Record<string, string> = {
    '-': '⁻',
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  }
  const digits = `${e}`.split('').map((d) => sup[d] ?? d).join('')
  return `10${digits}`
}

/** Chart-only rows: on the ladder, no container. */
export const LADDER_EXTRAS: Array<{ id: string; name: string; permeability: number }> = [
  { id: 'cl', name: 'chloride ion', permeability: 1e-11 },
  { id: 'k', name: 'potassium ion', permeability: 5e-14 },
]

export const travellerOf = (id: TravellerId): Traveller =>
  TRAVELLERS.find((t) => t.id === id)!

/** How many times more easily oxygen crosses than sodium — derived, and huge. */
export function oxygenToSodiumRatio(): number {
  return travellerOf('o2').permeability / travellerOf('na').permeability
}

/** Water against sodium — the pair that kills the sieve idea, since the ion
 *  is the SMALLER of the two. Derived from the table, ~3×10¹⁰. */
export function waterToSodiumRatio(): number {
  return travellerOf('water').permeability / travellerOf('na').permeability
}

const waterVsNaBillions = Math.round(waterToSodiumRatio() / 1e9)

/** Roughly how much aquaporins multiply a membrane's water permeability when
 *  present in cell-like numbers. Order of magnitude. */
export const AQUAPORIN_WATER_BOOST = 10

export const PERMEA_FACTS: TeachingPara[] = [
  {
    icon: '🛢️',
    text: 'The wall’s middle is oil, and that is the whole test. Anything that can dissolve in oil can cross; anything that cannot must wait for a door. Size matters a little — charge decides.',
  },
  {
    icon: '⚡',
    text: `In water, an ion wears an invisible coat of clinging water molecules — water sticks to charge, and prying the ion out of its coat costs more energy than warm jostling can pay. Coat and all, it is far too water-loving for the oil. A bare sodium ion is SMALLER than a water molecule and still crosses about ${waterVsNaBillions} billion times less often — proof the wall is not a sieve.`,
  },
  {
    icon: '📏',
    text: 'Compare the sizes on the wall: everything here is drawn against the membrane at its true size. Oxygen and carbon dioxide are a THIRD of a nanometre — far smaller than the gaps between the lipid heads — so they are not squeezing past anything. And look at glucose: smaller than a lipid head, and it never crosses. Fitting is not the test. DISSOLVING is: a traveller must be able to melt into the oil, and only the small uncharged ones can.',
  },
  {
    icon: '💧',
    text: 'Water itself is the in-between case: no net charge, but polar, so it dissolves in oil badly. A bare lipid wall lets through only a trickle — and real cells that need water fast (kidneys, red blood cells) install AQUAPORIN channels, doors so picky they pass water single file and turn even charged protons away.',
  },
]

/** "How easily it crosses", one bullet per traveller — its own describer
 *  section since the 27b round, each line the measured number plus the
 *  one-clause reason. */
export const PERMEA_LADDER: TeachingPara[] = [
  ...[...TRAVELLERS]
    .sort((a, b) => b.permeability - a.permeability)
    .map((t) => ({
      icon: t.icon,
      text: `${t.name} — ${fmtPermeability(t.permeability)} cm/s: ${t.why}.`,
    })),
  {
    icon: '🪜',
    text: 'Every power of ten is another TEN TIMES harder — oxygen to sodium spans fourteen of them.',
  },
]

export const PERMEA_HONESTY: TeachingPara[] = [
  {
    icon: '🚰',
    text: 'The aquaporin gathers water toward itself, and no real one does that — water simply bumps into a door by chance. But a real membrane is peppered with MILLIONS of these pores, so a water molecule is always beside one; this bench can only draw a single pore in a wide wall, and left to chance almost nothing would ever find it. The drift stands in for the pores that are not drawn. What is honest: only water is gathered, only water crosses there, and it goes through in single file.',
  },
  {
    icon: '🔍',
    text: 'The membrane is the honest ruler here: it is drawn at its real thickness, with its molecules at their real size. The travellers are drawn twice life size against it — all of them by the SAME factor, so their sizes relative to each other are true, and each is built from real atoms at real distances, so a carbon is the same carbon in every molecule. At true size a carbon dioxide molecule is a fifth of a lipid head and you could not tell it from a speck of water. The samples sitting in the trays are drawn at exactly the size they will be when you fire them.',
  },
  {
    icon: '🎚️',
    text: 'The tank compresses the odds so there is something to watch: it shows the ORDER — gases easily, water rarely, glucose and ions never — but the true gaps are far bigger than any animation can show. The measured numbers are in “How easily it crosses”.',
  },
  {
    icon: '📏',
    text: 'Those numbers are order-of-magnitude figures measured on pure lipid films; they shift with the exact lipid mix. The ordering does not.',
  },
  {
    icon: '⏳',
    text: `Glucose and sodium are drawn crossing NEVER, and for a puff this size that is the honest picture: at the measured rates, for every sodium ion that ever sneaks through a bare wall, some ${waterVsNaBillions} billion water molecules have already trickled past it. A cell cannot run on "almost never" — the sodium that matters all travels through channels, which is the rest of this app.`,
  },
]
