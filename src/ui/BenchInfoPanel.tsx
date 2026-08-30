import { IONS, ION_KINDS, type IonKind } from '../core/ions'
import type { TeachingPara } from '../core/neuron'
import { calciumNote, chamberAt } from '../core/balance'
import { fieldDirection, marksPerSide } from '../stage/benchScene'
import { BENCH_START_MV } from '../state/benchStore'
import type { IonCounts } from '../state/ionStore'
import { Section } from './InfoPanel'

// The bench's describer, in the app's own house style rather than a floating
// note of its own invention: one bordered block beside the experiment, "Right
// now" first and live, then what the picture is, then the footnotes.
//
// The floating panel this replaces was wrong in a way worth recording. It could
// be shut, so the live half — the half that says what the dial just did — was
// only there for someone who already knew to ask. "Right now" earns its place by
// never needing to be opened.

const fmt = (mv: number): string => `${mv < 0 ? '−' : '+'}${Math.abs(Math.round(mv))} mV`

const name = (kind: IonKind) => IONS[kind].name

/** The live half. Every line here is read off the same numbers the canvas draws
 *  from, so the words and the picture cannot come apart. */
function rightNow(
  vm: number,
  counts: IonCounts,
  channels: Record<IonKind, boolean>,
): TeachingPara[] {
  const out: TeachingPara[] = []
  const marks = marksPerSide(vm)
  const inward = fieldDirection(vm) === 1

  out.push({
    icon: '🔋',
    text: `The battery is holding all four patches at ${fmt(vm)}: ${
      Math.abs(vm) < 4
        ? 'near enough nothing across the membrane, so there is nothing to call polarized'
        : vm < 0
          ? 'the inside is negative, which is what polarized means — a resting cell sits here'
          : 'the inside is POSITIVE, so the polarity is reversed'
    }.`,
  })

  out.push(
    marks === 0
      ? {
          icon: '➖',
          text: 'Both faces of every membrane are bare. Nothing is being held apart, so there is no voltage — that is what zero looks like.',
        }
      : {
          icon: inward ? '➕' : '➖',
          text: `Count the marks hugging the membrane: ${
            vm < 0 ? 'minuses inside, plusses outside' : 'plusses inside, minuses outside'
          }. Move the dial further from zero and more of them arrive — twice the voltage really is twice the charge held apart.`,
        },
  )

  if (marks > 0) {
    out.push({
      icon: inward ? '⬇️' : '⬆️',
      text: `The arrows inside the wall point ${
        inward ? 'inward' : 'outward'
      } — that is the way the voltage on its own shoves a POSITIVE ion. It is only half of what decides where an ion goes.`,
    })
  }

  const open = ION_KINDS.filter((kind) => channels[kind])
  if (open.length === 0) {
    out.push({
      icon: '🚪',
      text: 'Every door is shut, so nothing is crossing anywhere — however hard the voltage is pushing. Open one and find out whether the push or the crowding wins.',
    })
  } else {
    for (const kind of open) {
      const c = chamberAt(kind, counts, vm, true)
      out.push({
        icon: c.solved ? '🎯' : c.flow === 'in' ? '⬇️' : '⬆️',
        text: c.solved
          ? `${name(kind)} is balanced. Its crowding and the voltage cancel exactly, so the door is wide open and nothing gets anywhere — the balls still jostle, they just no longer go.`
          : `${name(kind)} is crossing ${
              c.flow === 'in' ? 'inward' : 'outward'
            }. It would be content at ${fmt(c.balance)}, and the battery is ${Math.abs(
              Math.round(c.offBy),
            )} mV off that.`,
      })
    }
  }

  const shut = ION_KINDS.filter((kind) => !channels[kind])
  if (open.length > 0 && shut.length > 0) {
    out.push({
      icon: '⏸️',
      text: `Still shut: ${shut.map(name).join(', ')}. Those chambers are showing you where each one WOULD go, not where it is going.`,
    })
  }

  return out
}

/** What the picture is. Grows a line at a time as the bench is used, so it stays
 *  the length of what is actually on screen. */
function seeing(vm: number, channels: Record<IonKind, boolean>): TeachingPara[] {
  const out: TeachingPara[] = [
    {
      icon: '🔬',
      text: 'Four separate patches of membrane, one battery. This is NOT your neuron — it is a bench, so both sides of each membrane are finite and both are allowed to change.',
    },
    {
      icon: '⚡',
      text: 'The ➕ and ➖ marks on the two faces are the charge itself, and that charge held apart IS the voltage. Only a vanishingly thin skin of ions is ever involved, which is why the piles of balls barely move.',
    },
  ]
  if (marksPerSide(vm) > 0) {
    out.push({
      icon: '↕️',
      text: 'The arrows between the two rows of marks are the field they make. They span the wall and nothing else — a stronger voltage makes a heavier arrow across the same gap, never a longer one reaching into the water.',
    })
  }
  out.push({
    icon: '⚖️',
    text: 'The two little arrows in each chamber’s corner are the two pushes on that ion — its crowding, and the voltage — drawn separately so you can see them argue. Where they cancel is that ion’s own voltage.',
  })
  if (ION_KINDS.some((kind) => channels[kind])) {
    out.push({
      icon: '🔴',
      text: 'A ball only crosses when the count on one side really drops by one. Nothing fades in from off-screen: what you see moving is the ball whose side changed.',
    })
  }
  return out
}

function tips(counts: IonCounts): TeachingPara[] {
  return [
    {
      icon: '🎯',
      text: 'Potassium is the easiest to start with — open its door and hunt for the voltage where it stops moving.',
    },
    {
      icon: '🔋',
      text: `The battery starts at ${BENCH_START_MV} mV, where a real resting membrane sits. Notice how close potassium already is to content there: that is not a coincidence, it is where the resting voltage comes from.`,
    },
    {
      icon: '📊',
      text: 'Each chamber spreads its OWN ion over the same number of balls, so the two piles show a ratio — not how much of that ion there is compared with the others. Calcium fills its chamber because nearly all the calcium is outside, not because there is a lot of it.',
    },
    { icon: '⚠️', text: calciumNote(counts) },
  ]
}

export function BenchInfoPanel({
  vm,
  counts,
  channels,
  drained,
}: {
  vm: number
  counts: IonCounts
  channels: Record<IonKind, boolean>
  drained: boolean
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
      {/* The ending, in the same sky-tinted box the main panel uses for a
          consequence — first, because a payoff below the fold goes unread. */}
      {drained && (
        <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-2">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-sky-300/80">
            Everything has settled — and that is the problem
          </h3>
          <p className="text-[13px] leading-snug text-slate-200">
            Leave a door open and the balls sort themselves out until nothing is pushing
            any more. Nice and tidy — and a real cell that reached this point would be
            dead. A neuron needs its piles kept lopsided, ready to move, and left alone
            they always drain to here. So something has to keep hauling them back, all
            day, for your whole life: that is the sodium-potassium pump’s job.
          </p>
        </div>
      )}
      <Section title="Right now" paragraphs={rightNow(vm, counts, channels)} />
      <Section title="What am I seeing?" paragraphs={seeing(vm, channels)} />
      <Section title="Tips" paragraphs={tips(counts)} />
    </div>
  )
}
