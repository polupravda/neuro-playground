import { useEffect, useRef } from 'react'
import { useReceptorStore } from '../state/receptorStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { SideBySide } from './SideBySide'
import { TRANSMITTER_INK } from '../stage/synapseScene'
import { CAPTION_H, RECEPTOR_H, RECEPTOR_W, drawReceptor } from '../stage/receptorScene'
import { GLOSSY_COLORS, chargeColour, polarityT } from '../stage/particleStyle'
import { SPINE_CEILING_MV } from '../core/spine'
import {
  MV_MAX,
  MV_MIN,
  RECEPTORS,
  RECEPTOR_HONESTY,
  RECEPTOR_KINDS,
  RECEPTOR_PARTS,
  receptorsFire,
  receptorsSetMv,
  receptorsStart,
  receptorsStep,
  type ReceptorKind,
  type ReceptorsState,
} from '../core/receptors'

// D07 — AMPA AND NMDA, SIDE BY SIDE.
//
// ⚠ ONE PUFF, ONE VOLTAGE, TWO RECEPTORS. Neither control belongs to a panel:
// the glutamate reaches both receptors because they sit in one membrane under
// one gap, and the voltage IS that membrane's. So both panels keep the layout's
// empty action slot and the two controls live on a shared bar beneath the row —
// which is also what makes the comparison honest, because the child cannot
// give one receptor a different stimulus from the other even by accident.

// ⚠ EACH PANEL WEARS ITS RECEPTOR'S ION — sodium for AMPA, calcium for NMDA,
// the same inks the drawings use. See `receptorScene.ts` → PANEL_INK.
const TINT = {
  ampa: {
    mid: GLOSSY_COLORS.na.mid,
    light: GLOSSY_COLORS.na.light,
    glow: GLOSSY_COLORS.na.glow,
  },
  nmda: {
    mid: GLOSSY_COLORS.ca.mid,
    light: GLOSSY_COLORS.ca.light,
    glow: GLOSSY_COLORS.ca.glow,
  },
} as const

function ReceptorCanvas({
  kind,
  model,
}: {
  kind: ReceptorKind
  model: { current: ReceptorsState }
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = RECEPTOR_W * dpr
    canvas.height = RECEPTOR_H * dpr
    let frame = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawReceptor(ctx, { kind, state: model.current, ms })
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [kind, model])
  return (
    <canvas
      ref={ref}
      style={{ width: RECEPTOR_W, height: RECEPTOR_H, touchAction: 'none' }}
      aria-label={`${RECEPTORS[kind].name} in the receiving cell's wall, with the gap above it`}
    />
  )
}

export function ReceptorBench() {
  const open = useReceptorStore((s) => s.open)
  const closeBench = useReceptorStore((s) => s.closeBench)
  const mv = useReceptorStore((s) => s.mv)

  const model = useRef<ReceptorsState>(receptorsStart())

  useEffect(() => {
    if (!open) return
    model.current = receptorsStart()
    let frame = 0
    let last: number | null = null
    let sinceBeat = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      const dt = last === null ? 0 : ms - last
      last = ms
      // ⚠ THE FRAME CLAMP LIVES HERE, not in the model — a backgrounded tab
      // must not hand the receptors a ten-second step, and the model must take
      // whatever time it is given so a test can walk it.
      receptorsSetMv(model.current, useReceptorStore.getState().mv)
      receptorsStep(model.current, Math.min(100, dt))
      sinceBeat += dt
      if (sinceBeat > 180) {
        sinceBeat = 0
        useReceptorStore.getState().tick()
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [open])

  const fire = () => receptorsFire(model.current)

  const ink = chargeColour(polarityT(mv))

  return (
    <SideDrawer open={open} onClose={closeBench} ariaLabel="AMPA and NMDA receptors">
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        <div className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
          <Section title="What this is" paragraphs={RECEPTOR_PARTS} />
          <Section title="Keep in mind" paragraphs={RECEPTOR_HONESTY} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          <SideBySide
            captionH={CAPTION_H}
            panels={RECEPTOR_KINDS.map((kind) => ({
              key: kind,
              term: RECEPTORS[kind].term,
              icon: RECEPTORS[kind].icon,
              name: RECEPTORS[kind].name,
              tint: TINT[kind],
              caption: RECEPTORS[kind].caption,
              canvas: <ReceptorCanvas kind={kind} model={model} />,
              action: null,
            }))}
          />

          {/* ⚠ THE SHARED BAR. One button, one slider, both reaching both
              panels — see the note at the top of this file. */}
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-1.5">
            <button
              type="button"
              onClick={fire}
              title="Release a puff of glutamate into the gap — it reaches both receptors at once"
              className="h-[38px] shrink-0 whitespace-nowrap rounded-lg border px-3 text-[12px] font-semibold transition"
              style={{
                borderColor: TRANSMITTER_INK.mid,
                color: TRANSMITTER_INK.light,
                background: 'rgba(45, 212, 191, 0.18)',
              }}
            >
              <span aria-hidden>💧</span> Send the chemical
            </button>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-[12px] font-medium text-slate-300">
              <span className="shrink-0">Voltage inside</span>
              {/* ⚠ WHERE ONE SYNAPSE CAN GET TO ON ITS OWN, marked on the knob
                  (user, 2026-09-13: "'the block lifts, it never opens' … this is
                  not what you have displayed in 'AMPA & NMDA receptors' drawer.
                  Align across visualisations").
                  The two views are not drawing the block differently — they
                  share `mgBlock` and `stoneSeated` and agree exactly at any
                  given voltage. What differs is how far each can go: this knob
                  reaches +20 mV, where the stone is out nine times in ten, and
                  a spine driven by its own catchers stops at −16, where it is
                  still in the way over half the time. Past the mark the child
                  is turning it somewhere one synapse cannot take itself, and
                  that is the fact, not a discrepancy. */}
              <span className="relative min-w-0 flex-1">
                <input
                  type="range"
                  min={MV_MIN}
                  max={MV_MAX}
                  step={1}
                  value={mv}
                  onChange={(e) => useReceptorStore.getState().setMv(Number(e.target.value))}
                  aria-label="The membrane potential inside the receiving cell, in millivolts"
                  className="w-full cursor-pointer"
                  style={{ accentColor: ink }}
                />
                <span
                  aria-hidden
                  title="One synapse, working on its own, cannot make itself less negative than this. Past here you are doing what other synapses — or the cell's own spike — would have to do."
                  className="pointer-events-none absolute top-0 h-full border-l border-dashed border-slate-400/70"
                  style={{
                    left: `${((SPINE_CEILING_MV - MV_MIN) / (MV_MAX - MV_MIN)) * 100}%`,
                  }}
                />
              </span>
              <span
                className="w-16 shrink-0 text-right text-[13px] font-semibold tabular-nums"
                style={{ color: ink }}
              >
                {mv > 0 ? '+' : ''}
                {mv} mV
              </span>
            </label>
          </div>
        </div>
      </div>
    </SideDrawer>
  )
}
