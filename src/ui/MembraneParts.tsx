import { CHANNELS, CHANNEL_IDS, OPEN_FRACTION, type ChannelId } from '../core/channels'
import { PUMP_FACTS, PUMP_K_IN, PUMP_NA_OUT } from '../core/proteins'
import type { TeachingPara } from '../core/neuron'
import { useMembraneStore, type ProteinId } from '../state/membraneStore'
import { useApStore } from '../state/apStore'
import { releaseTransmitter, toggleLeaks, togglePump } from '../state/experiment'

// N11–N15, as navigation rather than a control board. The list says what is in
// the membrane; clicking a name opens its explanation in the info panel, and
// whatever intervention that protein actually allows lives THERE, beside the
// words that explain it.
//
// Notice what is still not here: a button that opens a channel. The pump can be
// stopped, the leaks can be blocked, a messenger can be dropped in — but the two
// voltage-gated channels answer only to a spike.

const GATING_ICON = { always: '🕳️', voltage: '⚡', ligand: '🥄' } as const

const PUMP_LABEL = 'Sodium-potassium pump'

export function proteinLabel(id: ProteinId): string {
  return id === 'pump' ? PUMP_LABEL : CHANNELS[id].name
}

export function proteinFacts(id: ProteinId): TeachingPara[] {
  return id === 'pump' ? PUMP_FACTS : CHANNELS[id].facts
}

/** The list. One row per thing embedded in this membrane. */
export function MembraneParts() {
  const pumpOn = useMembraneStore((s) => s.pumpOn)
  const leaksOn = useMembraneStore((s) => s.leaksOn)
  const selected = useMembraneStore((s) => s.selected)
  const select = useMembraneStore((s) => s.select)
  // Only the open/shut answer is wanted, not the conductance behind it —
  // subscribing to the live reading itself would re-render the list 60 times
  // a second to print the same two words.
  const naOpen = useApStore((s) => (s.live ? s.live.naOpen > OPEN_FRACTION : null))
  const kOpen = useApStore((s) => (s.live ? s.live.kOpen > OPEN_FRACTION : null))
  // The list dims in step with the canvas, from the same published numbers, so
  // the two never disagree about which protein is doing the work. Read, not
  // derived: computing this in the selector builds a new object per call, which
  // defeats zustand's equality check and spins the render loop.
  const emphasis = useApStore((s) => s.emphasis)

  const row = (
    id: ProteinId,
    icon: string,
    label: string,
    right: string,
    rightTone: string,
    colour: string,
  ) => (
    <button
      key={id}
      type="button"
      onClick={() => select(id)}
      aria-pressed={selected === id}
      style={{
        opacity: emphasis?.[id] ?? 1,
        transition: 'opacity 150ms',
      }}
      className={`w-full rounded-lg px-2 py-1.5 text-left transition ${
        selected === id ? 'bg-sky-600/25 ring-1 ring-sky-500/50' : 'hover:bg-slate-700/60'
      }`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: colour }}>
          {icon} {label}
        </span>
        <span className={`shrink-0 text-[11px] ${rightTone}`}>{right}</span>
      </span>
    </button>
  )

  return (
    <div className="flex flex-col gap-0.5">
      {row(
        'pump',
        '⚙️',
        PUMP_LABEL,
        pumpOn ? 'working' : 'stopped',
        pumpOn ? 'text-emerald-300' : 'text-slate-500',
        pumpOn ? '#e0a56a' : '#64748b',
      )}
      {CHANNEL_IDS.map((id) => {
        const channel = CHANNELS[id]
        const shut = channel.gating === 'always' && !leaksOn
        // Voltage-gated rows report what the running spike is doing to them, so
        // the list and the picture never disagree.
        const open = id === 'voltage-na' ? naOpen : kOpen
        const state =
          channel.gating === 'voltage' && open !== null
            ? open
              ? 'open now'
              : 'shut'
            : shut
              ? 'blocked'
              : `passes ${channel.passes.map((i) => (i === 'na' ? 'Na⁺' : 'K⁺')).join(', ')}`
        return row(
          id,
          GATING_ICON[channel.gating],
          channel.short,
          state,
          state === 'open now'
            ? 'text-amber-300'
            : state === 'blocked'
              ? 'text-slate-500'
              : 'text-slate-500',
          shut ? '#64748b' : '#b9a985',
        )
      })}
    </div>
  )
}

/** The one thing you are allowed to do to this particular protein — sitting with
 *  its explanation, not on a separate control board. */
export function ProteinControl({ id }: { id: ProteinId }) {
  const pumpOn = useMembraneStore((s) => s.pumpOn)
  const leaksOn = useMembraneStore((s) => s.leaksOn)

  // The note goes UNDER the button, not inside it. A description inside a thing
  // you press is a paragraph in a place built for a press — and this one was a
  // full sentence, sometimes with live numbers in it. The button keeps its icon
  // and its name; the sentence sits below, where the rest of this panel's words
  // already are.
  const button = (label: string, note: string, onClick: () => void, on?: boolean) => (
    <div className="mt-1">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        title={note}
        className="w-full rounded-lg bg-slate-900/50 px-2 py-1.5 text-left text-sm text-slate-200 transition hover:bg-slate-900/80"
      >
        {label}
      </button>
      <p className="mt-0.5 px-2 text-[11px] leading-snug text-slate-400">{note}</p>
    </div>
  )

  if (id === 'pump') {
    return button(
      pumpOn ? '⏸️ Stop the pump' : '▶️ Start the pump again',
      pumpOn
        ? `Stop spending ATP. It is carrying ${PUMP_NA_OUT} sodium out and ${PUMP_K_IN} potassium in right now.`
        : 'Start carrying sodium out and potassium in again.',
      togglePump,
      pumpOn,
    )
  }
  if (id === 'leak-k') {
    return button(
      leaksOn ? '🚫 Block the leak channels' : '🕳️ Unblock the leak channels',
      leaksOn
        ? 'Take away the only easy way out for potassium, and watch the voltage.'
        : 'Let potassium wander out again.',
      toggleLeaks,
      leaksOn,
    )
  }
  if (id === 'ligand') {
    return button(
      '🥄 Release a messenger',
      'Drops one into the cup. The gate opens with no change in voltage at all.',
      releaseTransmitter,
    )
  }
  // The two voltage-gated channels, deliberately.
  return (
    <p className="mt-1 rounded-lg bg-slate-900/40 px-2 py-1.5 text-[11px] leading-snug text-slate-400">
      There is no button for this one. It answers only to the voltage across the
      membrane — press <span className="text-amber-200">Fire an action potential</span>{' '}
      on the canvas and watch it open on its own.
    </p>
  )
}

export type { ChannelId }
