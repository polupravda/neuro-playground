import { useEffect, useRef } from 'react'
import { useChannelStore } from '../state/channelStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { speakAloud } from './SpeakButton'
import { IonKey } from './IonKey'
import { LabelsSwitch } from './LabelsSwitch'
import { useLabelsStore } from '../state/labelsStore'
import { IonSizeKey } from './IonSizeKey'
import { spokenTermAt } from '../stage/spokenLabels'
import {
  filterZoomChipAt,
  SIDE_W,
  TOP_W,
  CH_H,
  drawSide,
  drawTop,
  sideLabels,
  topLabels,
  tryPoseAt,
} from '../stage/channelScene'
import {
  SELECTIVITY,
  CHANNEL_PARTS,
  CHANNEL_HONESTY,
  filterFacts,
  filterVerdict,
} from '../core/channelStructure'
import { IONS } from '../core/ions'
import { useFilterStore } from '../state/filterStore'

// D03 — the ion channel, cut open and looked down. Two pictures of one
// object, and an ion you can send at its filter.

const FRAMING = [
  {
    icon: '🔬',
    text: 'One channel out of the wall and opened up — a voltage-gated potassium channel, the kind this app draws as a little gate. This is what that gate really is.',
  },
  {
    icon: '🎯',
    text: `Send an ion up the pore with the two buttons and watch what the filter does with it. This channel passes potassium about ${SELECTIVITY.toLocaleString(
      'en-US',
    )} times more readily than sodium — the two buttons are that number, made watchable.`,
  },
]

export function ChannelBench() {
  const open = useChannelStore((s) => s.open)
  const closeBench = useChannelStore((s) => s.closeBench)
  const tried = useChannelStore((s) => s.tried)
  const tryIon = useChannelStore((s) => s.tryIon)
  const finishTry = useChannelStore((s) => s.finishTry)
  const said = useChannelStore((s) => s.said)
  const openFilter = useFilterStore((s) => s.openBench)

  const sideRef = useRef<HTMLCanvasElement>(null)
  const topRef = useRef<HTMLCanvasElement>(null)
  const msRef = useRef(0)
  const triedRef = useRef(tried)
  triedRef.current = tried

  useEffect(() => {
    if (!open) return
    const side = sideRef.current
    const top = topRef.current
    const sideCtx = side?.getContext('2d')
    const topCtx = top?.getContext('2d')
    if (!side || !top || !sideCtx || !topCtx) return
    const dpr = window.devicePixelRatio || 1
    side.width = SIDE_W * dpr
    side.height = CH_H * dpr
    top.width = TOP_W * dpr
    top.height = CH_H * dpr
    let frame = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      msRef.current = ms
      // An attempt that has finished is cleared here, by the loop that knows
      // it finished. The buttons used to be disabled on `busy`, computed
      // during render from a clock the render never saw again — so once an
      // ion had gone through, nothing re-rendered, nothing re-enabled, and
      // the exhibit was over (reported 2026-08-28). A control's enabled-ness
      // must not depend on a value only the animation loop can advance.
      const run = triedRef.current
      if (run && tryPoseAt(run, ms).done) finishTry()
      sideCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sideCtx.clearRect(0, 0, SIDE_W, CH_H)
      drawSide(sideCtx, triedRef.current, ms, labelsRef.current)
      topCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      topCtx.clearRect(0, 0, TOP_W, CH_H)
      drawTop(topCtx, triedRef.current, ms, labelsRef.current)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open, finishTry])

  // ⚠ The app's one 🏷 switch (2026-09-04). Read into a ref because the
  // drawing runs in an animation loop, not on React's clock.
  const labelsOn = useLabelsStore((st) => st.labelsOn)
  const labelsRef = useRef(labelsOn)
  labelsRef.current = labelsOn

  const speakFrom =
    (labels: () => ReturnType<typeof sideLabels>, chip = false) =>
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      // The magnifier on the filter opens the close-up. It is checked first:
      // it sits next to a name, and a control loses to nothing.
      if (chip && filterZoomChipAt(x, y)) {
        openFilter()
        return
      }
      const term = spokenTermAt(labels(), x, y)
      if (term) speakAloud(term)
    }

  /** What the last attempt showed. Written when it starts, and it STAYS —
   *  until the next attempt overwrites it or Reset clears it. */
  const verdictWords = () => {
    if (!said) return []
    const through = filterVerdict(said) === 'through'
    return [
      {
        icon: through ? '✅' : '🚫',
        text: `${IONS.k.name} took its water coat off and traded it for the filter's own oxygens — watch them close in and take the water's place — then filed through. The waters it left behind fall back into the cell's water; nothing is lost, they simply belong to the crowd again. And it is the BIGGER ion of the two that gets through.`,
      },
    ].map((p) =>
      through
        ? p
        : {
            icon: '🚫',
            text: `${IONS.na.name} came up the same pore and was turned back, still wearing its coat. It is the SMALLER ion, and being small is exactly its problem: the filter's oxygens cannot close in far enough to take its water's place, so there is nothing to trade, the coat stays on — and the coat will not fit.`,
          },
    )
  }

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="Ion channel structure">
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section title="What this is" paragraphs={FRAMING} />
          {said && <Section title="What just happened" paragraphs={verdictWords()} />}
          <Section title="What it is made of" paragraphs={CHANNEL_PARTS} />
          <Section title="Why potassium and not sodium" paragraphs={filterFacts()} />
          <Section title="Keep in mind" paragraphs={CHANNEL_HONESTY} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          {/* The two ions at true relative size, in a strip as wide as the
              pictures below it. This is where "sodium is the smaller ion" is
              checkable: the two are never drawn together anywhere else. */}
          <IonSizeKey width={SIDE_W + TOP_W + 16} />

          <div className="flex min-h-0 min-w-0 items-start gap-4">
            {/* The controls sit ON the picture they act on, in the same
                grammar as the ⚡ button at the membrane patch: an amber pill
                floating over the canvas (user, 2026-08-28). They used to be a
                row above it, which cost the drawing a band of height it could
                not spare and read as page furniture rather than as something
                you do to this channel.

                There is no Reset (removed 2026-08-28). Each button IS the way
                to start over — the pore empties itself when a run ends, and
                the account of what happened is replaced by the next run
                rather than needing to be dismissed. A control whose only job
                is to clear a sentence is furniture. */}
            <div className="relative min-w-0 rounded-xl border border-slate-700 bg-slate-950/40 p-2">
              <LabelsSwitch
                on={labelsOn}
                onToggle={() => useLabelsStore.getState().toggleLabels()}
                titleOn="Hide the names on the picture"
                titleOff="Show the names on the picture"
                className="absolute right-3 top-3 z-10"
              />
              <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2">
                {(['k', 'na'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => tryIon(kind, msRef.current)}
                    title={`Send ${IONS[kind].name} up the pore and see what the filter does`}
                    className="flex h-[40px] shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/80 bg-amber-500/40 px-2.5 text-amber-50 shadow-lg backdrop-blur transition hover:bg-amber-500/45"
                  >
                    <IonKey kind={kind} />
                    <span className="text-[13px] font-semibold">Send</span>
                  </button>
                ))}
              </div>
              <canvas
                ref={sideRef}
                onPointerDown={speakFrom(sideLabels, true)}
                style={{ width: SIDE_W, height: CH_H, touchAction: 'none' }}
                aria-label="A voltage-gated potassium channel cut open, seen from the side"
              />
            </div>
            <div className="shrink-0 rounded-xl border border-slate-700 bg-slate-950/40 p-2">
              <canvas
                ref={topRef}
                onPointerDown={speakFrom(topLabels)}
                style={{ width: TOP_W, height: CH_H, touchAction: 'none' }}
                aria-label="The same channel seen from outside the cell, looking down the pore"
              />
            </div>
          </div>
        </div>
      </div>
    </SideDrawer>
  )
}
