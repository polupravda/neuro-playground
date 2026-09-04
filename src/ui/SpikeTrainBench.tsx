import { ResetButton } from './ResetButton'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { usePatchStore } from '../state/patchStore'
import { useTrainStore } from '../state/trainStore'
import { useIonStore } from '../state/ionStore'
import { useMembraneStore } from '../state/membraneStore'
import { BENCH_PUSHES, STIMULI } from '../core/scenarios'
import {
  MAX_FRAME_MS,
  TRAIN_SLOWDOWN,
  TRAIN_WINDOW_MS,
  stimFlash,
  pressPush,
  trainAdvance,
  trainNarration,
  trainStart,
  type TrainState,
} from '../core/spikeTrain'
import { absoluteRefractoryMs, refractoryFacts, relativeRefractoryMs } from '../core/refractory'
import { drawNeuronInset, drawTrain, electrodeHitAt, insetBox } from '../stage/trainGraph'
import { thresholdStimulus, trajectory } from '../core/spikeModel'
import { ZOOM_TARGETS, regionOfZoom } from '../stage/layout'
import { useNeuronStore } from '../state/neuronStore'

// The spike-train bench: a membrane, three buttons, and a line that answers every
// press. Replaces two exhibits that a child could not read — see the long note at
// the top of `core/spikeTrain.ts` for why they could not.
//
// In a DRAWER, like the balance bench and for the same reason: the canvas is the
// neuron, and this is an instrument wheeled up to it. What is on screen here is a
// recording, not a place on the cell.

export function SpikeTrainBench() {
  const open = useTrainStore((s) => s.open)
  const openPatch = usePatchStore((s) => s.openBench)
  const closeTrain = useTrainStore((s) => s.closeTrain)
  const tally = useTrainStore((s) => s.tally)
  const counts = useIonStore((s) => s.counts)
  const leaksOn = useMembraneStore((s) => s.leaksOn)
  // Which patch of the cell the bench was opened from. The drawer covers the
  // column's map, so without this the child loses the only thing on the page
  // saying which part of which neuron this trace belongs to.
  const zoom = useNeuronStore((s) => s.zoom)
  const region = regionOfZoom(zoom)
  const ring = ZOOM_TARGETS.find((t) => t.id === zoom)?.center ?? null

  // Measured on THIS membrane, so blocking the leaks or flattening a gradient
  // moves the bands on the graph. Expensive (each one bisects over whole runs of
  // the model), which is exactly what useMemo is for — and why it is keyed on the
  // gradients rather than recomputed per frame.
  const absoluteMs = useMemo(() => absoluteRefractoryMs(counts, leaksOn), [counts, leaksOn])
  const relativeMs = useMemo(() => relativeRefractoryMs(counts, leaksOn), [counts, leaksOn])
  const threshold = useMemo(() => thresholdStimulus(counts, leaksOn), [counts, leaksOn])
  // What a full spike on THIS membrane rests at and reaches, so the little
  // cell's brightness is measured against the cell rather than against a
  // number typed in here.
  const { rest, peak } = useMemo(() => {
    const t = trajectory(counts, leaksOn, STIMULI.spike.amplitude)
    return { rest: t.rest, peak: t.peak }
  }, [counts, leaksOn])

  /** How brightly the little cell burns at this membrane voltage, 0→1.
   *
   *  Measured from THIS membrane's own resting voltage up to its own peak, and
   *  squared so the bottom of the range stays dark. Two things follow, both
   *  wanted: a real spike lights the cell for its whole upstroke and fall
   *  rather than only for the sliver above 0 mV (which is all the first
   *  version showed, and why the neuron looked as if it never fired), and a
   *  weak push — which barely leaves rest — still lights nothing at all,
   *  because nothing happened. */
  const glowAt = (v: number) => {
    const t = Math.max(0, Math.min(1, (v - rest) / Math.max(1, peak - rest)))
    return t * t
  }

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const cellRef = useRef<HTMLCanvasElement | null>(null)
  const stateRef = useRef<TrainState | null>(null)
  // The narration is a few sentences that change on a press, not per frame, so it
  // goes through React — but keyed on a counter the loop only bumps when there is
  // something new to say.
  //
  // "Something new" includes a push RESOLVING, which is not a change to either
  // tally. A refused push is not known to have been refused until a few model
  // milliseconds have gone by — the best part of a second of real time — so
  // watching the counts alone left the panel saying "just pushed, watch the line"
  // long after the line had finished answering.
  const [beat, setBeat] = useState(0)
  const sayingRef = useRef('')

  const reset = useCallback(() => {
    stateRef.current = trainStart(counts, leaksOn)
    sayingRef.current = ''
    tally(0, 0)
    setBeat((b) => b + 1)
  }, [counts, leaksOn, tally])

  // A fresh membrane whenever the bench opens or the gradients change underneath
  // it. Carrying a half-recovered membrane across a change to its own sodium
  // gradient would be quietly showing a trace of something that no longer exists.
  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  useEffect(() => {
    if (!open) return
    let frame = 0
    let last = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      const state = stateRef.current
      const canvas = canvasRef.current
      if (!state || !canvas) return
      if (last === 0) last = ms
      const real = Math.min(MAX_FRAME_MS, ms - last)
      last = ms
      trainAdvance(state, real / TRAIN_SLOWDOWN)

      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Measured each frame rather than once: the drawer's own entrance
        // animation changes this box's width while it slides in.
        const box = canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        if (canvas.width !== Math.round(box.width * dpr)) {
          canvas.width = Math.round(box.width * dpr)
          canvas.height = Math.round(box.height * dpr)
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        drawTrain(ctx, {
          width: box.width,
          height: box.height,
          nowMs: state.tMs,
          rest: state.rest,
          samples: state.samples,
          pushes: state.pushes,
          spikesAt: state.spikesAt,
          absoluteMs,
          relativeMs,
          showBands: state.spikes > 0,
          counts,
        })
      }

      // The cell in the corner, on its own canvas. Lit by the same rule the axon
      // and the column's map light by: above zero it lights, brightest at the
      // peak — so the little neuron brightens exactly as the line goes over the
      // top, and the two pictures are one statement.
      const cell = cellRef.current
      const cellCtx = cell?.getContext('2d')
      if (cell && cellCtx) {
        const box = cell.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        if (cell.width !== Math.round(box.width * dpr)) {
          cell.width = Math.round(box.width * dpr)
          cell.height = Math.round(box.height * dpr)
        }
        cellCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        cellCtx.clearRect(0, 0, box.width, box.height)
        drawNeuronInset(
          cellCtx,
          insetBox(box.width, box.height),
          region,
          glowAt(state.v),
          ring,
          stimFlash(state),
        )
      }

      const latest = state.pushes[state.pushes.length - 1]
      const saying = `${state.presses}/${state.spikes}/${
        latest ? `${latest.id}:${latest.fired}` : ''
      }`
      if (saying !== sayingRef.current) {
        sayingRef.current = saying
        tally(state.presses, state.spikes)
        setBeat((b) => b + 1)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, absoluteMs, relativeMs, counts, tally, region, ring, rest, peak])

  const press = (amplitude: number, label: string) => {
    const state = stateRef.current
    if (!state) return
    pressPush(state, amplitude, label)
    setBeat((b) => b + 1)
  }

  const state = stateRef.current
  const live = state ? trainNarration(state, absoluteMs, relativeMs) : []
  // `beat` is read so the narration re-renders on a press; the value itself is
  // not shown anywhere.
  void beat

  return (
    <SideDrawer open={open} onClose={closeTrain} ariaLabel="Fire it again">
      {/* The balance bench's grid, for the same reasons its own note gives:
          describer down the left at a fixed 16rem, controls in an auto row, and
          the exhibit taking every pixel that is left in a minmax(0,1fr) row. */}
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 pt-2">
        <div className="col-start-1 row-span-2 row-start-1 flex min-h-0 flex-col gap-3">
          {/* The whole cell, first thing in the column — where it is in every
              other view (2026-08-28). A drawer covers the column's permanent
              map, and this bench without it is a graph of nothing in
              particular: a child watching a line climb has no reason to
              connect it to a neuron. Same panel, same size, same place, and
              it lights with the very press that moves the line. */}
          <div className="shrink-0 rounded-xl border border-slate-700 bg-slate-800/60 p-2">
            <canvas
              ref={cellRef}
              className="h-[136px] w-full"
              style={{ cursor: 'pointer', touchAction: 'none' }}
              onPointerDown={(e) => {
                // The electrode is a DOOR: tapping the probe opens the patch
                // clamp (D13), which is what that probe is. It has been
                // sitting here unexplained since this bench was built.
                const box = e.currentTarget.getBoundingClientRect()
                if (
                  electrodeHitAt(
                    insetBox(box.width, box.height),
                    ring,
                    e.clientX - box.left,
                    e.clientY - box.top,
                  )
                ) {
                  openPatch()
                }
              }}
              role="img"
              aria-label="The whole neuron, with the patch this graph is recording from ringed, lighting up when it fires. Tap the probe to open the patch clamp."
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
            <Section title="Right now" paragraphs={live} />
          <Section
            title="What the bands mean"
            paragraphs={refractoryFacts(counts, leaksOn)}
          />
          <Section
            title="Why a weak push does nothing"
            paragraphs={[
              {
                icon: '📏',
                text: `This membrane needs about ${
                  Number.isFinite(threshold) ? threshold.toFixed(0) : 'more than anything on offer'
                } µA/cm² to fire. The weak push is ${
                  STIMULI.nudge.amplitude
                }, so on its own it never gets there — the line twitches and slides back. That is not the button failing. It is what a threshold IS: below it, nothing; above it, the same full-sized spike every time.`,
              },
              {
                icon: '➕',
                text: 'On its own. Press the weak one several times QUICKLY and it does fire — because each push lands before the last one has faded, and they add up. That is temporal summation, and it is the same thing that happens on the whole-neuron view when two input cells fire together. A cell is not deaf to small signals; it adds them.',
              },
              {
                icon: '🧪',
                text: 'Change the cell and the number changes with it. Block the potassium leaks back on the main view and the threshold falls far enough that a single weak push starts firing this membrane — which is what leak channels are for.',
              },
              ]}
            />
          </div>
        </div>

        <div className="col-start-2 row-start-1">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            {/* Named, and the bolts kept beside the names.
                
                These were bolts alone for a while, on the argument that a size is
                a thing a picture says better than a phrase. The ordering does read
                at a glance — but a control whose meaning you have to infer is a
                puzzle, and a child should not have to solve the interface before
                they can start on the biology. A label is not explanation; it is
                the button's name, and every button in this app has one now. The
                bolts still carry the ranking; the words say what each one is. */}
            {BENCH_PUSHES.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => press(STIMULI[id].amplitude, STIMULI[id].label)}
                title={`${STIMULI[id].label} — ${STIMULI[id].note}`}
                aria-label={STIMULI[id].label}
                className={`flex h-[46px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 transition ${
                  id === 'nudge'
                    ? 'border-amber-400/40 bg-amber-500/10 text-amber-100/90 hover:bg-amber-500/25'
                    : 'border-amber-400/80 bg-amber-500/30 text-amber-50 shadow-md hover:bg-amber-500/45'
                }`}
              >
                <span aria-hidden style={{ fontSize: STIMULI[id].bolt, lineHeight: 1 }}>
                  {id === 'hard' ? '⚡⚡' : '⚡'}
                </span>
                <span className="text-[13px] font-semibold">
                  {id === 'spike' ? 'Fire a spike' : STIMULI[id].label}
                </span>
              </button>
            ))}
            <span className="ml-auto flex items-center gap-3 text-[12px] text-slate-400">
              <span className="tabular-nums">
                {state?.presses ?? 0} pressed · {state?.spikes ?? 0} fired
              </span>
              <ResetButton onClick={reset} title="Clear the record and start the train again" />
            </span>
          </div>
        </div>

        <div className="col-start-2 row-start-2 flex min-h-0 min-w-0 flex-col rounded-xl border border-slate-700 bg-slate-900/70 p-2">
          <canvas ref={canvasRef} className="min-h-0 w-full flex-1" />
          {/* The one thing the picture cannot say about itself: how slowed down
              it is. Everything else the graph draws. */}
          <p className="px-1 pt-1 text-[11px] text-slate-500">
            {TRAIN_WINDOW_MS} thousandths of a second across, slowed {TRAIN_SLOWDOWN}× so a
            press can land where you meant it to.
          </p>
        </div>
      </div>
    </SideDrawer>
  )
}
