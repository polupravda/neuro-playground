import type { TeachingPara } from './neuron'
import { FILTER_SITES, SELECTIVITY } from './channelStructure'
import { IONS } from './ions'

// D15 — inside the selectivity filter. The numbers, and the one derivation
// that makes the exhibit worth building.
//
// The channel bench can only ASSERT that potassium is preferred a thousand to
// one; here the preference is taken apart. An ion in water is not naked — it
// is held by a shell of water molecules, and it costs energy to take that
// shell off. The filter's job is to PAY THAT BACK: its backbone oxygens sit
// where the shell's oxygens sat, at the same distance, so the ion barely
// notices the change of clothes. For potassium the payment is essentially
// exact. For sodium — smaller, and held far more tightly by its water — the
// same rigid ring of oxygens cannot reach in close enough, and the payment
// falls short.
//
// The size of that shortfall is not asserted here. It is MEASURED, out of the
// selectivity the bench already showed: a preference of S to one is a free
// energy difference of RT·ln S, and nothing else. Which turns the exhibit's
// punchline into arithmetic a child can be shown the shape of — the shortfall
// is a few per cent of the cost, and a few per cent is a thousandfold.

/** Gas constant, J·mol⁻¹·K⁻¹. */
export const R_GAS = 8.314
/** Body temperature, K. Everything else in this app runs a mammal. */
export const BODY_K = 310

/** Free energy of hydration, kJ·mol⁻¹ — what it costs to strip an ion's water
 *  off it. Marcus's values. NEGATIVE because water is glad to hold them: the
 *  magnitude is the price of undressing.
 *
 *  Note which way round these are. SODIUM, the smaller ion, is the EXPENSIVE
 *  one: a smaller ball with the same charge pulls harder on water. That is
 *  the whole reason the smaller ion is the one that cannot get through. */
export const HYDRATION_KJ = { na: -365, k: -295 } as const

/** The preference, as a free energy: a channel that passes K⁺ S times more
 *  readily than Na⁺ differs in barrier by exactly RT·ln S. Derived, never
 *  typed in — change SELECTIVITY and this follows. */
export function selectivityKJ(selectivity = SELECTIVITY, tempK = BODY_K): number {
  return (R_GAS * tempK * Math.log(selectivity)) / 1000
}

/** What the filter gives back, kJ·mol⁻¹: for potassium, all of it (this is
 *  the reference — a channel that charged potassium anything at all would not
 *  conduct at the rate it does); for sodium, all of it BAR the shortfall the
 *  selectivity measures. */
export function paybackKJ(kind: 'na' | 'k'): number {
  const cost = Math.abs(HYDRATION_KJ[kind])
  return kind === 'k' ? cost : cost - selectivityKJ()
}

/** The shortfall as a fraction of the cost — the number the picture is drawn
 *  at, and the reason the exhibit is startling. */
export function shortfallFraction(): number {
  return selectivityKJ() / Math.abs(HYDRATION_KJ.na)
}

/** Does this ion get through? Same verdict as the channel bench's, reached
 *  the other way round — by the ledger rather than by the fit. The two must
 *  agree, and a test says so. */
export function paysItsWay(kind: 'na' | 'k'): boolean {
  return paybackKJ(kind) >= Math.abs(HYDRATION_KJ[kind])
}

const round = (n: number) => Math.round(n)

export const FILTER_ZOOM_PARTS: TeachingPara[] = [
  {
    icon: '🧥',
    text: 'No ion in water is bare. Each one wears a little jacket of water molecules, held on at a certain distance — and here is the first surprise: SODIUM\'S JACKET IS THE BIGGER ONE. Sodium is the smaller ion, and a smaller ball with the same charge pulls water in harder and holds more of it. Small ion, big jacket.',
  },
  {
    icon: '🚪',
    text: 'Neither of them fits through the filter with the jacket on — the way through is 0.3 nm wide and both jackets are more than twice that. So neither ion can just swim in. The jacket has to come off first.',
  },
  {
    icon: '🤝',
    text: `But a jacket does not just fall off — water holds on hard. It only comes off if something takes its place. That is what the ${FILTER_SITES} rungs are for: each one is a ring of oxygens that swings inward, and they are set at exactly the distance the water molecules were sitting at. An oxygen arrives where a water was, the water lets go, and the ion hardly notices the swap. A TRADE, not a squeeze.`,
  },
  {
    icon: '📏',
    text: 'Now watch the two panels, and watch the little round close-up in each. The filter does exactly the same thing in both — the same oxygens swing in the same distance, because it is the same machine and it cannot tell the two ions apart. For potassium they arrive right at its surface: touch, trade, in it goes. For sodium — smaller — they swing in the same amount and STOP SHORT. Nothing arrives to take the water\'s place. So the jacket never comes off, and with the jacket on, sodium cannot get in.',
  },
  {
    icon: '➖',
    text: 'Why do a lot of oxygens hold a PLUS at all? Because each of them is a little bit negative — that is the small minus on each one. Not a whole charge like an ion has: just one end of a bond pulling harder than the other. A little bit of minus, arriving right against the ion, is enough to do what a water molecule was doing. Almost reaching is not enough — pull it a hair further away and most of that hold is gone. That hair is sodium\'s whole problem.',
  },
  {
    icon: '🪶',
    text: `And the size of that hair: the filter comes up short for sodium by only about ${round(
      selectivityKJ(),
    )} out of ${Math.abs(
      HYDRATION_KJ.na,
    )} — around ${Math.round(
      shortfallFraction() * 100,
    )} in every hundred. A tiny shortfall. But a tiny shortfall in energy is an enormous difference in how often something happens: that few per cent IS the ${SELECTIVITY.toLocaleString(
      'en-US',
    )}-to-one preference you watched in the channel view.`,
  },
]

export function filterLedger(kinds: readonly ('na' | 'k')[] = ['k', 'na']): TeachingPara[] {
  return kinds.map((kind) => {
    const cost = Math.abs(HYDRATION_KJ[kind])
    const back = paybackKJ(kind)
    const ion = IONS[kind]
    return {
      icon: kind === 'k' ? '✅' : '❌',
      text:
        kind === 'k'
          ? `${ion.name}: coat costs ${round(cost)} to take off, oxygens hand back ${round(
              back,
            )}. Even — so the swap happens and through it goes, with another one right behind it, about a hundred million every second.`
          : `${ion.name}: coat costs ${round(cost)} to take off, oxygens can only hand back ${round(
              back,
            )}. ${round(
              cost - back,
            )} short, so the swap never happens. It keeps its coat on, and with the coat on it cannot get in — which is exactly what you watched it do.`,
    }
  })
}

export const FILTER_ZOOM_HONESTY: TeachingPara[] = [
  {
    icon: '🧮',
    text: `CALIBRATED: the hold-on numbers are real measured hydration free energies in kJ per mole (sodium ${Math.abs(
      HYDRATION_KJ.na,
    )}, potassium ${Math.abs(
      HYDRATION_KJ.k,
    )}), and the shortfall is not typed in — it is worked out from the ${SELECTIVITY.toLocaleString(
      'en-US',
    )}-to-one preference by RT·ln(${SELECTIVITY}) at body temperature, which comes to about ${round(
      selectivityKJ(),
    )} kJ per mole. The bars are drawn at true proportion: the small notch really is that small.`,
  },
  {
    icon: '⚖️',
    text: 'SIMPLIFIED: "the ring is too wide for sodium" is the classic story and it is most of the truth, but not all of it. A real filter can flex a little, and what really decides is how many oxygens get close at once and how much they wobble. The little minus on each oxygen is a PART charge — one end of a bond, not a whole extra electron — drawn with the same badge everything else in this app wears because this app draws charge one way. Nobody draws the wobble well yet, including us.',
  },
  {
    icon: '⏱️',
    text: 'SLOWED DOWN: a real ion crosses this filter in about ten nanoseconds. Watching it at that speed would be watching nothing at all, so both lanes run about a hundred million times slower than life.',
  },
]
