import { useEffect, useRef } from 'react'
import { useLipidStore } from '../state/lipidStore'
import { SideDrawer } from './SideDrawer'
import { Section } from './InfoPanel'
import { speakAloud } from './SpeakButton'
import { RealPhotoBlock } from './RealPhotoPanel'
import { photosForLipidLab } from '../core/realPhotos'
import {
  LAB_W,
  LAB_H,
  LAB_SCALE,
  MOLECULE_W,
  MOLECULE_H,
  VES_W,
  VES_H,
  VES_SCALE,
  LAB_LIPIDS,
  VES_LIPIDS,
  drawLab,
  drawVesicle,
  drawMolecule,
  lipidAt,
  clampHeldY,
  vesLipidAt,
  clampVesHeld,
  transitDone,
  labRightNow,
  LIPID_MOLECULE_FACTS,
  LIPID_HONESTY,
  moleculeLabels,
  vesicleLabels,
  tankLabels,
  spokenTermAt,
  type LabState,
} from '../stage/lipidLabScene'

// D01 — the lipid lab, in a drawer over the scene. The scene stays the neuron;
// this is a tank of water with sixty of the membrane's own molecules in it.
//
// Semantic state (phase, seed, holding) lives in the store; everything
// per-frame — the pointer, the held molecule, the returning one, the clock —
// lives in refs here and is drawn straight from pure functions of it. React
// re-renders when the describer's words change, and for nothing else.

const FRAMING = [
  {
    icon: '🧪',
    // The counts are derived: the tanks hold as many molecules as fit at the
    // real spacing, so a number typed here would go stale on any resize.
    text: `A lab bench — ${LAB_LIPIDS} phospholipids in a tank of water and ${VES_LIPIDS} more in the small one, not a picture of your neuron. The wall they build is the same wall every membrane view in this app is made of.`,
  },
]

export function LipidLab() {
  const open = useLipidStore((s) => s.open)
  const phase = useLipidStore((s) => s.phase)
  const phaseStart = useLipidStore((s) => s.phaseStart)
  const seed = useLipidStore((s) => s.seed)
  const holding = useLipidStore((s) => s.holding)
  const closeLab = useLipidStore((s) => s.closeLab)
  const scatter = useLipidStore((s) => s.scatter)
  const settle = useLipidStore((s) => s.settle)
  const finishTransit = useLipidStore((s) => s.finishTransit)
  const setHolding = useLipidStore((s) => s.setHolding)
  const slots = useLipidStore((s) => s.slots)
  const reinsert = useLipidStore((s) => s.reinsert)
  const vesSlots = useLipidStore((s) => s.vesSlots)
  const vesReinsert = useLipidStore((s) => s.vesReinsert)

  const labRef = useRef<HTMLCanvasElement>(null)
  const vesRef = useRef<HTMLCanvasElement>(null)
  const molRef = useRef<HTMLCanvasElement>(null)
  const heldRef = useRef<LabState['held']>(null)
  const returningRef = useRef<LabState['returning']>(null)
  const vesHeldRef = useRef<LabState['vesHeld']>(null)
  const vesReturningRef = useRef<LabState['vesReturning']>(null)
  const msRef = useRef(0)
  const storeRef = useRef({ phase, phaseStart, seed, slots, vesSlots })
  storeRef.current = { phase, phaseStart, seed, slots, vesSlots }

  const stateNow = (): LabState => ({
    ...storeRef.current,
    held: heldRef.current,
    returning: returningRef.current,
    vesHeld: vesHeldRef.current,
    vesReturning: vesReturningRef.current,
  })

  // One loop for all three canvases — the wall, the vesicle and the vibrating
  // molecule share one phase and one clock, so they must never be loops that
  // could drift. The run's clock is whatever the store stamped when a
  // transport began.
  useEffect(() => {
    if (!open) return
    const lab = labRef.current
    const ves = vesRef.current
    const mol = molRef.current
    const labCtx = lab?.getContext('2d')
    const vesCtx = ves?.getContext('2d')
    const molCtx = mol?.getContext('2d')
    if (!lab || !ves || !mol || !labCtx || !vesCtx || !molCtx) return
    const dpr = window.devicePixelRatio || 1
    lab.width = LAB_W * LAB_SCALE * dpr
    lab.height = LAB_H * LAB_SCALE * dpr
    ves.width = VES_W * LAB_SCALE * dpr
    ves.height = VES_H * LAB_SCALE * dpr
    mol.width = MOLECULE_W * dpr
    mol.height = MOLECULE_H * dpr
    let frame = 0
    const tick = (ms: number) => {
      frame = requestAnimationFrame(tick)
      msRef.current = ms
      const s = stateNow()
      if (transitDone(s, ms)) finishTransit()
      if (returningRef.current && ms - returningRef.current.at > 900) {
        returningRef.current = null
      }
      if (vesReturningRef.current && ms - vesReturningRef.current.at > 900) {
        vesReturningRef.current = null
      }
      labCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      labCtx.clearRect(0, 0, LAB_W * LAB_SCALE, LAB_H * LAB_SCALE)
      drawLab(labCtx, s, ms)
      vesCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      vesCtx.clearRect(0, 0, VES_W * LAB_SCALE, VES_H * LAB_SCALE)
      drawVesicle(vesCtx, s, ms)
      molCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      molCtx.clearRect(0, 0, MOLECULE_W, MOLECULE_H)
      drawMolecule(molCtx, ms)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, finishTransit])

  const toCss = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const toLab = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = toCss(e)
    return { x: c.x / LAB_SCALE, y: c.y / LAB_SCALE }
  }

  // The canvas names speak themselves (F04): a tap inside a labelled name's
  // box says the term. Each canvas checks its own labels.
  const speakFrom =
    (labels: () => ReturnType<typeof tankLabels>) =>
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const c = toCss(e)
      const term = spokenTermAt(labels(), c.x, c.y)
      if (term) speakAloud(term)
      return term !== null
    }
  const onMolDown = speakFrom(moleculeLabels)
  const speakVes = speakFrom(vesicleLabels)
  const speakTank = speakFrom(tankLabels)

  // The vesicle's drag mirrors the wall's, in its own coordinate space.
  const toVes = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = toCss(e)
    return { x: c.x / VES_SCALE, y: c.y / VES_SCALE }
  }
  const onVesDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (speakVes(e)) return
    if (vesReturningRef.current) return
    const { x, y } = toVes(e)
    const k = vesLipidAt(stateNow(), msRef.current, x, y)
    if (k === null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    vesHeldRef.current = { k, ...clampVesHeld(k, x, y), since: msRef.current }
    setHolding(true)
  }
  const onVesMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const held = vesHeldRef.current
    if (!held) return
    const { x, y } = toVes(e)
    vesHeldRef.current = { ...held, ...clampVesHeld(held.k, x, y) }
  }
  const onVesUp = () => {
    const held = vesHeldRef.current
    if (!held) return
    vesReinsert(held.k, held.x, held.y)
    vesReturningRef.current = { k: held.k, x: held.x, y: held.y, at: msRef.current }
    vesHeldRef.current = null
    setHolding(false)
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (speakTank(e)) return
    if (returningRef.current) return
    const { x, y } = toLab(e)
    const i = lipidAt(stateNow(), msRef.current, x, y)
    if (i === null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    heldRef.current = { i, x, y, since: msRef.current }
    setHolding(true)
  }
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const held = heldRef.current
    if (!held) return
    const { x, y } = toLab(e)
    heldRef.current = {
      ...held,
      x: Math.min(LAB_W - 8, Math.max(8, x)),
      // The wall is not crossable: a molecule stays in its own side's water.
      y: clampHeldY(held.i, Math.min(LAB_H - 8, Math.max(8, y))),
    }
  }
  const onUp = () => {
    const held = heldRef.current
    if (!held) return
    // Shortest path back: the molecule takes the wall slot nearest to where it
    // was let go, not the one it came from.
    reinsert(held.i, held.x)
    returningRef.current = { i: held.i, x: held.x, y: held.y, at: msRef.current }
    heldRef.current = null
    setHolding(false)
  }

  const inTransit = phase === 'settling' || phase === 'scattering'
  const nextIsScatter = phase === 'wall' || phase === 'settling'

  return (
    <SideDrawer open={open} onClose={closeLab} ariaLabel="Phospholipid bilayer">
      {/* overflow-hidden + min-w-0: a fixed-width canvas must never widen the
          column and set the drawer scrolling sideways. */}
      <div className="grid min-h-0 flex-1 grid-cols-[16rem_minmax(0,1fr)] gap-x-6 overflow-hidden pt-2">
        {/* The left column: the info block and the photo block as SIBLING
            panels — the main column's own arrangement (RealPhotoPanel beside
            InfoPanel). User ruling, 2026-08-27, after two wrong readings:
            the photo block is NEVER a child of the info block. */}
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-800/40 p-3">
            <Section title="What this is" paragraphs={FRAMING} />
            <Section title="Right now" paragraphs={labRightNow(phase, holding)} />
            <Section title="The molecule" paragraphs={LIPID_MOLECULE_FACTS} />
            <Section title="Keep in mind" paragraphs={LIPID_HONESTY} />
          </div>
          <RealPhotoBlock photos={photosForLipidLab()} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={inTransit}
              onClick={() =>
                nextIsScatter ? scatter(msRef.current) : settle(msRef.current)
              }
              title={
                nextIsScatter
                  ? 'Tear the wall apart and see the pieces'
                  : 'Let the water jostle them and see what survives'
              }
              className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 transition enabled:hover:bg-slate-700 disabled:opacity-40"
            >
              {nextIsScatter ? <>💨 Scatter them</> : <>🌊 Let them settle</>}
            </button>
          </div>

          {/* Row 1 — the molecule and the bag it can close into, side by side
              and given the height; row 2 — the wall, shorter, given the width. */}
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-2">
              <canvas
                ref={molRef}
                onPointerDown={onMolDown}
                style={{ width: MOLECULE_W, height: MOLECULE_H }}
                aria-label="One phospholipid, magnified, with its parts named"
              />
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-2">
              <canvas
                ref={vesRef}
                onPointerDown={onVesDown}
                onPointerMove={onVesMove}
                onPointerUp={onVesUp}
                onPointerCancel={onVesUp}
                style={{
                  width: VES_W * VES_SCALE,
                  height: VES_H * VES_SCALE,
                  touchAction: 'none',
                  cursor: phase === 'wall' ? (holding ? 'grabbing' : 'grab') : 'default',
                }}
                aria-label="A vesicle: the same molecules closed into a bag"
              />
            </div>
          </div>
          <div className="self-start rounded-xl border border-slate-700 bg-slate-950/40 p-2">
            <canvas
              ref={labRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              style={{
                width: LAB_W * LAB_SCALE,
                height: LAB_H * LAB_SCALE,
                touchAction: 'none',
                cursor: phase === 'wall' ? (holding ? 'grabbing' : 'grab') : 'default',
              }}
              aria-label="A tank of water with a bilayer wall of phospholipids"
            />
          </div>
        </div>
      </div>
    </SideDrawer>
  )
}
