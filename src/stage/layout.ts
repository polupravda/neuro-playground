import type { NeuronPartId, TeachingPara } from '../core/neuron'
import {
  AXON_DIAMETER_UM,
  LIPID_HEAD_NM,
  MEMBRANE_FACTS,
  MEMBRANE_THICKNESS_UM,
  SOMA_DIAMETER_UM,
} from '../core/membrane'
import { ION_FACTS } from '../core/ions'
import { LEAK_FACTS, PUMP_FACTS } from '../core/proteins'
import { CHANNELS, CHANNEL_OVERVIEW } from '../core/channels'
import { VOLTAGE_FACTS } from '../core/voltage'
import { SPINE_HONESTY, SPINE_PARTS } from '../core/spine'

// Geometry of the whole scene: three input neurons, the focus neuron, and its
// target. Partners are drawn small and clipped by the canvas edges — the
// frame is a window on a network that keeps going, not the whole world.
export const STAGE_W = 1060
export const STAGE_H = Math.max(
  660,
  (typeof window !== 'undefined' ? window.innerHeight : 660) - 46,
)

export interface Pt {
  x: number
  y: number
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

const len = (p: Pt): number => Math.hypot(p.x, p.y)
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
const norm = (p: Pt): Pt => {
  const l = len(p) || 1
  return { x: p.x / l, y: p.y / l }
}

/** Sample a polyline by arc length, t ∈ [0, 1]. */
export function polylinePoint(path: Pt[], t: number): Pt {
  if (path.length < 2) return path[0]
  const lens = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y))
  const total = lens.reduce((a, b) => a + b, 0)
  let d = clamp01(t) * total
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] === 0 ? 0 : clamp01(d / lens[i])
      return {
        x: path[i].x + (path[i + 1].x - path[i].x) * f,
        y: path[i].y + (path[i + 1].y - path[i].y) * f,
      }
    }
    d -= lens[i]
  }
  return path[path.length - 1]
}

/** Total length of a polyline, in scene pixels. */
export function pathLength(path: Pt[]): number {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  }
  return total
}

/** The prefix of a polyline covered after travelling fraction `f` of its arc
 *  length — a wave's lit portion, for partial strokes. Endpoints exact: 0 is
 *  just the start, 1 is the whole path. */
export function partialPath(path: Pt[], f: number): Pt[] {
  const t = clamp01(f)
  if (t >= 1) return path
  const lens = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y))
  let d = t * lens.reduce((a, b) => a + b, 0)
  const out: Pt[] = [path[0]]
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const g = lens[i] === 0 ? 0 : clamp01(d / lens[i])
      out.push({
        x: path[i].x + (path[i + 1].x - path[i].x) * g,
        y: path[i].y + (path[i + 1].y - path[i].y) * g,
      })
      return out
    }
    out.push(path[i + 1])
    d -= lens[i]
  }
  return out
}

export interface WallSample {
  /** Point on the wall — the middle of the membrane. */
  at: Pt
  /** Unit vector along the membrane. */
  tangent: Pt
  /** Unit vector from the membrane toward the cell interior. */
  inward: Pt
}

/** A point on one wall of a tube-shaped process, with the local directions
 *  needed to draw membrane structure there. `side` picks which wall. */
export function wallSample(centre: Pt[], halfWidth: number, side: 1 | -1, t: number): WallSample {
  const eps = 0.002
  const a = polylinePoint(centre, Math.max(0, t - eps))
  const b = polylinePoint(centre, Math.min(1, t + eps))
  const tangent = norm(sub(b, a))
  const normal = { x: -tangent.y, y: tangent.x }
  const here = polylinePoint(centre, t)
  return {
    at: {
      x: here.x + normal.x * side * halfWidth,
      y: here.y + normal.y * side * halfWidth,
    },
    tangent,
    // The interior is always back toward the centreline.
    inward: { x: -normal.x * side, y: -normal.y * side },
  }
}

// ------------------------------------------------------------- traced glyphs

/** One traced cubic as [x0,y0, cx1,cy1, cx2,cy2, x1,y1] — the shared currency
 *  of every glyph machine-extracted from the user's SVG handovers (the
 *  neuron, the astrocyte). ONE flattener serves them all: a second private
 *  copy of a fixed bug is a bug that comes back. */
export type TraceCubic = [number, number, number, number, number, number, number, number]

const traceBez = (c: TraceCubic, t: number): Pt => {
  const u = 1 - t
  return {
    x: u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6],
    y: u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7],
  }
}
const traceFlat = (cs: TraceCubic[], n: number): Pt[] => {
  const out: Pt[] = []
  for (const [k, c] of cs.entries())
    for (let i = k === 0 ? 0 : 1; i <= n; i++) out.push(traceBez(c, i / n))
  return out
}

// ---------------------------------------------------------------- focus cell

/** ⚠ THE NEURON TRACE — machine-extracted from the user's neuron (1).svg
 *  (2026-09-04, see 05 → Reconciliation — neuron (1).svg): the whole cell as
 *  drawn — the seven-point star soma with concave valleys, seventeen dendrite
 *  strokes (eleven rooted on the soma, six twigs hanging on siblings, sketch
 *  gaps kept), one arcing axon, eight terminal-branch strokes and seven
 *  teardrop boutons. Coordinates are soma-centred SVG units, already rotated
 *  a quarter-turn so dendrites face left and the axon runs right (the
 *  handover is portrait; the scene reads left→right — user's alignment
 *  answer). `terminalPaths` are the model's travel routes, chained through
 *  the limbs by measured endpoint affinity (every join < 3.1 units). */
const NEURON_TRACE: {
  soma: TraceCubic[]
  axon: TraceCubic[]
  trunkStrokes: TraceCubic[][]
  twigStrokes: TraceCubic[][]
  branchStrokes: TraceCubic[][]
  terminalPaths: Pt[][]
  boutons: { outline: TraceCubic[]; c: Pt }[]
} = {
  soma: [
    [13.89, 23.89, 13.89, 23.89, 10.2, 17.91, 12.99, 10.29],
    [12.99, 10.29, 15.77, 2.68, 22.94, -1.52, 22.94, -1.52],
    [22.94, -1.52, 22.94, -1.52, 13.06, 1.46, 11.24, -3.26],
    [11.24, -3.26, 9.42, -7.98, 16.11, -16.72, 16.11, -16.72],
    [16.11, -16.72, 16.11, -16.72, 9.02, -12.73, 5.21, -13.68],
    [5.21, -13.68, 1.41, -14.64, -0.8, -18.45, -0.8, -18.45],
    [-0.8, -18.45, -0.8, -18.45, -0.29, -16.46, -4.78, -12.86],
    [-4.78, -12.86, -9.28, -9.26, -16.69, -10.68, -16.69, -10.68],
    [-16.69, -10.68, -16.69, -10.68, -11.72, -6.96, -13.76, -3.07],
    [-13.76, -3.07, -15.81, 0.82, -21.11, 6.47, -21.11, 6.47],
    [-21.11, 6.47, -21.11, 6.47, -15.75, 3.9, -12.89, 7.77],
    [-12.89, 7.77, -10.03, 11.63, -11.79, 17.12, -11.79, 17.12],
    [-11.79, 17.12, -11.79, 17.12, -7.96, 13.32, -0.61, 14.71],
    [-0.61, 14.71, 6.73, 16.1, 13.89, 23.89, 13.89, 23.89],
  ],
  axon: [
    [12.48, 23.12, 12.48, 23.12, 27.61, 63.53, 50.76, 53.22],
    [50.76, 53.22, 73.92, 42.92, 99.65, 9.1, 121.95, 14.9],
    [121.95, 14.9, 144.25, 20.7, 142.38, 22.02, 142.38, 22.02],
  ],
  trunkStrokes: [
    [
      [31.93, -39.44, 31.93, -39.44, 23.49, -39.86, 21.83, -31.31],
      [21.83, -31.31, 20.17, -22.75, 19.5, -19.22, 15.7, -16.41],
    ],
    [
      [10.66, -52.82, 10.66, -52.82, 8.12, -38.71, 3.41, -33.01],
      [3.41, -33.01, -1.31, -27.3, -0.65, -18.07, -0.65, -18.07],
    ],
    [
      [-12.61, -38.47, -12.61, -38.47, -11.89, -32.33, -7.07, -28.24],
      [-7.07, -28.24, -2.26, -24.15, -0.86, -19.61, -0.86, -19.61],
    ],
    [
      [-24.99, -44.49, -24.99, -44.49, -28.01, -32.64, -25.03, -24.41],
      [-25.03, -24.41, -22.06, -16.18, -16.01, -10.27, -16.01, -10.27],
    ],
    [
      [-40.37, -13.45, -40.37, -13.45, -41.18, -11.73, -35.96, -11.83],
      [-35.96, -11.83, -30.74, -11.93, -23.99, -16.16, -19.15, -13.33],
    ],
    [
      [-45.03, -6.03, -45.03, -6.03, -39.68, -6.22, -36.09, 1.89],
      [-36.09, 1.89, -32.5, 9.99, -23.99, 7.03, -23.99, 7.03],
    ],
    [
      [-52.02, 12.58, -52.02, 12.58, -42.47, 13.21, -37.13, 11.73],
      [-37.13, 11.73, -31.79, 10.26, -20.28, 5.78, -20.28, 5.78],
    ],
    [
      [-33.93, 23.06, -33.93, 23.06, -34.52, 30.85, -28.05, 29.18],
      [-28.05, 29.18, -21.59, 27.51, -10.96, 16.41, -10.96, 16.41],
    ],
    [
      [-22.56, 44.15, -22.56, 44.15, -23.81, 37.12, -20.69, 30.37],
      [-20.69, 30.37, -17.57, 23.62, -14.39, 19.96, -14.39, 19.96],
    ],
    [
      [45.08, -14.23, 45.08, -14.23, 35.06, -10.83, 30.34, -7.15],
      [30.34, -7.15, 25.62, -3.47, 21.73, -1.15, 21.73, -1.15],
    ],
    [
      [46.1, 2.82, 46.1, 2.82, 43.25, -0.9, 37.73, -2.35],
      [37.73, -2.35, 32.22, -3.8, 24.55, -3.38, 24.55, -3.38],
    ],
  ],
  twigStrokes: [
    [
      [40.9, -25.19, 40.9, -25.19, 33.4, -23.25, 28.88, -26.55],
      [28.88, -26.55, 24.36, -29.86, 20.83, -26.93, 20.83, -26.93],
    ],
    [
      [16.32, -44.22, 16.32, -44.22, 18.97, -40.88, 14.25, -39.22],
      [14.25, -39.22, 9.53, -37.56, 4.33, -34.28, 4.33, -34.28],
    ],
    [
      [-9.82, -43.04, -9.82, -43.04, -3.73, -44.88, -1.73, -40.97],
      [-1.73, -40.97, 0.27, -37.06, 0.6, -26.78, 0.6, -26.78],
    ],
    [
      [-36.87, -31.17, -36.87, -31.17, -37.93, -24.57, -33.58, -24.21],
      [-33.58, -24.21, -29.24, -23.84, -24.18, -21.77, -24.18, -21.77],
    ],
    [
      [-44.55, 26.75, -44.55, 26.75, -39.31, 24.41, -36.3, 19],
      [-36.3, 19, -33.3, 13.59, -26.66, 8.68, -26.66, 8.68],
    ],
    [
      [38.86, -18.2, 38.86, -18.2, 35.65, -18.29, 33.68, -14.23],
      [33.68, -14.23, 31.71, -10.16, 29.89, -6.73, 29.89, -6.73],
    ],
  ],
  branchStrokes: [
    [
      [141.81, 21.51, 141.81, 21.51, 152.06, 23.56, 163.68, 16.86],
      [163.68, 16.86, 175.3, 10.16, 180.28, 4.27, 180.28, 4.27],
    ],
    [
      [142.23, 21.4, 142.23, 21.4, 145.29, 21.52, 150.86, 31.49],
      [150.86, 31.49, 156.42, 41.45, 158.25, 46, 158.25, 46],
    ],
    [
      [166.09, 2.35, 166.09, 2.35, 165.28, 7.2, 162.69, 11.11],
      [162.69, 11.11, 160.1, 15.03, 151.06, 21.88, 151.06, 21.88],
    ],
    [
      [178.79, 31.38, 178.79, 31.38, 178.14, 26.1, 173.98, 21.32],
      [173.98, 21.32, 169.82, 16.54, 164.13, 16.71, 164.13, 16.71],
    ],
    [
      [169.11, 33.89, 169.11, 33.89, 169.09, 37.49, 163.51, 36.69],
      [163.51, 36.69, 157.94, 35.88, 152.03, 33.89, 152.03, 33.89],
    ],
    [
      [176.92, 44.97, 176.92, 44.97, 168.11, 47.49, 163.13, 46.67],
      [163.13, 46.67, 158.14, 45.85, 157.48, 44.44, 157.48, 44.44],
    ],
    [[156.01, 56.87, 156.01, 56.87, 159.22, 50.54, 158.09, 45.76]],
    [[151.4, 46.52, 151.4, 46.52, 154.92, 38.65, 152.55, 33.89]],
  ],
  terminalPaths: [
    [
      { x: 142.38, y: 22.02 },
      { x: 141.81, y: 21.51 },
      { x: 142.11, y: 21.56 },
      { x: 142.97, y: 21.67 },
      { x: 144.34, y: 21.77 },
      { x: 146.17, y: 21.8 },
      { x: 148.39, y: 21.7 },
      { x: 150.97, y: 21.39 },
      { x: 153.84, y: 20.82 },
      { x: 156.95, y: 19.92 },
      { x: 160.25, y: 18.62 },
      { x: 163.68, y: 16.86 },
      { x: 166.97, y: 14.88 },
      { x: 169.87, y: 12.98 },
      { x: 172.39, y: 11.19 },
      { x: 174.55, y: 9.53 },
      { x: 176.34, y: 8.05 },
      { x: 177.79, y: 6.77 },
      { x: 178.89, y: 5.72 },
      { x: 179.67, y: 4.94 },
      { x: 180.13, y: 4.44 },
      { x: 180.28, y: 4.27 },
      { x: 182.15, y: 2.25 },
    ],
    [
      { x: 142.38, y: 22.02 },
      { x: 141.81, y: 21.51 },
      { x: 142.11, y: 21.56 },
      { x: 142.97, y: 21.67 },
      { x: 144.34, y: 21.77 },
      { x: 146.17, y: 21.8 },
      { x: 148.39, y: 21.7 },
      { x: 150.97, y: 21.39 },
      { x: 151.06, y: 21.88 },
      { x: 151.32, y: 21.68 },
      { x: 152.02, y: 21.14 },
      { x: 153.09, y: 20.29 },
      { x: 154.41, y: 19.22 },
      { x: 155.91, y: 17.96 },
      { x: 157.48, y: 16.59 },
      { x: 159.04, y: 15.16 },
      { x: 160.49, y: 13.73 },
      { x: 161.74, y: 12.36 },
      { x: 162.69, y: 11.11 },
      { x: 163.42, y: 9.91 },
      { x: 164.04, y: 8.7 },
      { x: 164.57, y: 7.49 },
      { x: 165.01, y: 6.34 },
      { x: 165.36, y: 5.26 },
      { x: 165.64, y: 4.31 },
      { x: 165.85, y: 3.5 },
      { x: 165.99, y: 2.88 },
      { x: 166.07, y: 2.49 },
      { x: 166.09, y: 2.35 },
      { x: 166.73, y: 0.3 },
    ],
    [
      { x: 142.38, y: 22.02 },
      { x: 141.81, y: 21.51 },
      { x: 142.11, y: 21.56 },
      { x: 142.97, y: 21.67 },
      { x: 144.34, y: 21.77 },
      { x: 146.17, y: 21.8 },
      { x: 148.39, y: 21.7 },
      { x: 150.97, y: 21.39 },
      { x: 153.84, y: 20.82 },
      { x: 156.95, y: 19.92 },
      { x: 160.25, y: 18.62 },
      { x: 163.68, y: 16.86 },
      { x: 164.13, y: 16.71 },
      { x: 164.3, y: 16.71 },
      { x: 164.76, y: 16.73 },
      { x: 165.47, y: 16.8 },
      { x: 166.4, y: 16.96 },
      { x: 167.5, y: 17.22 },
      { x: 168.72, y: 17.63 },
      { x: 170.02, y: 18.22 },
      { x: 171.36, y: 19 },
      { x: 172.7, y: 20.03 },
      { x: 173.98, y: 21.32 },
      { x: 175.13, y: 22.76 },
      { x: 176.08, y: 24.2 },
      { x: 176.86, y: 25.6 },
      { x: 177.47, y: 26.93 },
      { x: 177.95, y: 28.14 },
      { x: 178.3, y: 29.21 },
      { x: 178.54, y: 30.11 },
      { x: 178.69, y: 30.79 },
      { x: 178.77, y: 31.23 },
      { x: 178.79, y: 31.38 },
      { x: 180.82, y: 32.31 },
    ],
    [
      { x: 142.38, y: 22.02 },
      { x: 142.23, y: 21.4 },
      { x: 142.32, y: 21.41 },
      { x: 142.6, y: 21.49 },
      { x: 143.04, y: 21.69 },
      { x: 143.67, y: 22.08 },
      { x: 144.46, y: 22.71 },
      { x: 145.42, y: 23.63 },
      { x: 146.54, y: 24.91 },
      { x: 147.83, y: 26.61 },
      { x: 149.27, y: 28.78 },
      { x: 150.86, y: 31.49 },
      { x: 152.42, y: 34.32 },
      { x: 153.77, y: 36.82 },
      { x: 154.91, y: 39.02 },
      { x: 155.87, y: 40.9 },
      { x: 156.64, y: 42.48 },
      { x: 157.25, y: 43.76 },
      { x: 157.71, y: 44.75 },
      { x: 157.48, y: 44.44 },
      { x: 157.51, y: 44.48 },
      { x: 157.59, y: 44.59 },
      { x: 157.76, y: 44.77 },
      { x: 158.04, y: 44.99 },
      { x: 158.44, y: 45.25 },
      { x: 158.99, y: 45.53 },
      { x: 159.71, y: 45.83 },
      { x: 160.63, y: 46.12 },
      { x: 161.76, y: 46.41 },
      { x: 163.13, y: 46.67 },
      { x: 164.73, y: 46.82 },
      { x: 166.48, y: 46.81 },
      { x: 168.31, y: 46.66 },
      { x: 170.14, y: 46.43 },
      { x: 171.9, y: 46.13 },
      { x: 173.5, y: 45.8 },
      { x: 174.89, y: 45.49 },
      { x: 175.97, y: 45.22 },
      { x: 176.67, y: 45.04 },
      { x: 176.92, y: 44.97 },
      { x: 179.39, y: 44.31 },
    ],
    [
      { x: 142.38, y: 22.02 },
      { x: 142.23, y: 21.4 },
      { x: 142.32, y: 21.41 },
      { x: 142.6, y: 21.49 },
      { x: 143.04, y: 21.69 },
      { x: 143.67, y: 22.08 },
      { x: 144.46, y: 22.71 },
      { x: 145.42, y: 23.63 },
      { x: 146.54, y: 24.91 },
      { x: 147.83, y: 26.61 },
      { x: 149.27, y: 28.78 },
      { x: 150.86, y: 31.49 },
      { x: 152.42, y: 34.32 },
      { x: 152.03, y: 33.89 },
      { x: 152.2, y: 33.95 },
      { x: 152.69, y: 34.1 },
      { x: 153.46, y: 34.34 },
      { x: 154.47, y: 34.64 },
      { x: 155.68, y: 34.99 },
      { x: 157.07, y: 35.35 },
      { x: 158.58, y: 35.73 },
      { x: 160.18, y: 36.09 },
      { x: 161.84, y: 36.41 },
      { x: 163.51, y: 36.69 },
      { x: 165.03, y: 36.81 },
      { x: 166.24, y: 36.71 },
      { x: 167.18, y: 36.44 },
      { x: 167.9, y: 36.05 },
      { x: 168.41, y: 35.59 },
      { x: 168.75, y: 35.11 },
      { x: 168.96, y: 34.65 },
      { x: 169.07, y: 34.26 },
      { x: 169.11, y: 33.99 },
      { x: 169.11, y: 33.89 },
      { x: 170.48, y: 32.52 },
    ],
    [
      { x: 142.38, y: 22.02 },
      { x: 142.23, y: 21.4 },
      { x: 142.32, y: 21.41 },
      { x: 142.6, y: 21.49 },
      { x: 143.04, y: 21.69 },
      { x: 143.67, y: 22.08 },
      { x: 144.46, y: 22.71 },
      { x: 145.42, y: 23.63 },
      { x: 146.54, y: 24.91 },
      { x: 147.83, y: 26.61 },
      { x: 149.27, y: 28.78 },
      { x: 150.86, y: 31.49 },
      { x: 152.42, y: 34.32 },
      { x: 153.77, y: 36.82 },
      { x: 154.91, y: 39.02 },
      { x: 155.87, y: 40.9 },
      { x: 156.64, y: 42.48 },
      { x: 157.25, y: 43.76 },
      { x: 157.71, y: 44.75 },
      { x: 158.02, y: 45.45 },
      { x: 158.2, y: 45.86 },
      { x: 158.09, y: 45.76 },
      { x: 158.31, y: 47.23 },
      { x: 158.31, y: 48.75 },
      { x: 158.14, y: 50.27 },
      { x: 157.85, y: 51.73 },
      { x: 157.48, y: 53.11 },
      { x: 157.07, y: 54.34 },
      { x: 156.68, y: 55.37 },
      { x: 156.34, y: 56.17 },
      { x: 156.1, y: 56.69 },
      { x: 156.01, y: 56.87 },
      { x: 155.43, y: 58.44 },
    ],
    [
      { x: 142.38, y: 22.02 },
      { x: 142.23, y: 21.4 },
      { x: 142.32, y: 21.41 },
      { x: 142.6, y: 21.49 },
      { x: 143.04, y: 21.69 },
      { x: 143.67, y: 22.08 },
      { x: 144.46, y: 22.71 },
      { x: 145.42, y: 23.63 },
      { x: 146.54, y: 24.91 },
      { x: 147.83, y: 26.61 },
      { x: 149.27, y: 28.78 },
      { x: 150.86, y: 31.49 },
      { x: 152.42, y: 34.32 },
      { x: 152.55, y: 33.89 },
      { x: 153.1, y: 35.4 },
      { x: 153.34, y: 37.03 },
      { x: 153.35, y: 38.72 },
      { x: 153.17, y: 40.39 },
      { x: 152.87, y: 41.99 },
      { x: 152.49, y: 43.44 },
      { x: 152.1, y: 44.69 },
      { x: 151.75, y: 45.66 },
      { x: 151.5, y: 46.29 },
      { x: 151.4, y: 46.52 },
      { x: 148.9, y: 48.38 },
    ],
  ],
  boutons: [
    {
      outline: [
        [180.29, 4.35, 180.29, 4.35, 181.19, -3.61, 184.32, -0.2],
        [184.32, -0.2, 187.44, 3.21, 180.29, 4.35, 180.29, 4.35],
      ],
      c: { x: 182.15, y: 2.25 },
    },
    {
      outline: [
        [165.62, 2.57, 165.62, 2.57, 171.56, -2.01, 168.01, -2.35],
        [168.01, -2.35, 164.47, -2.69, 165.62, 2.57, 165.62, 2.57],
      ],
      c: { x: 166.73, y: 0.3 },
    },
    {
      outline: [
        [178.99, 30.95, 178.99, 30.95, 186.46, 31.1, 182.95, 33.89],
        [182.95, 33.89, 179.44, 36.68, 178.99, 30.95, 178.99, 30.95],
      ],
      c: { x: 180.82, y: 32.31 },
    },
    {
      outline: [
        [176.97, 45.08, 176.97, 45.08, 181.44, 39.8, 182.21, 43.42],
        [182.21, 43.42, 182.97, 47.04, 176.97, 45.08, 176.97, 45.08],
      ],
      c: { x: 179.39, y: 44.31 },
    },
    {
      outline: [
        [168.8, 33.89, 168.8, 33.89, 170.18, 27.96, 172.42, 30.92],
        [172.42, 30.92, 174.67, 33.89, 168.8, 33.89, 168.8, 33.89],
      ],
      c: { x: 170.48, y: 32.52 },
    },
    {
      outline: [
        [156.2, 56.08, 156.2, 56.08, 150.29, 60.37, 154.53, 61.2],
        [154.53, 61.2, 158.77, 62.04, 156.2, 56.08, 156.2, 56.08],
      ],
      c: { x: 155.43, y: 58.44 },
    },
    {
      outline: [
        [150.92, 46.72, 150.92, 46.72, 143.95, 47.46, 146.54, 50.32],
        [146.54, 50.32, 149.14, 53.17, 150.92, 46.72, 150.92, 46.72],
      ],
      c: { x: 148.9, y: 48.38 },
    },
  ],
}

/** ⚠ THE NEURON'S SCALE AND PLACE, SOLVED FROM THE STAGE BUDGET, never taken
 *  from the SVG's page box: the cell spans from the column the input cells
 *  need on the left to where the target's dendrites take over on the right,
 *  and its soma radius (hence PX_PER_UM and everything derived from it)
 *  falls out of that. Measured off the trace at load. */
const NEURON_BUDGET = { left: 190, right: 950 }
const NEURON_SPAN = (() => {
  const xs = [
    ...traceFlat(NEURON_TRACE.soma, 4),
    ...traceFlat(NEURON_TRACE.axon, 8),
    ...NEURON_TRACE.trunkStrokes.flatMap((s) => traceFlat(s, 4)),
    ...NEURON_TRACE.twigStrokes.flatMap((s) => traceFlat(s, 4)),
    ...NEURON_TRACE.boutons.flatMap((b) => traceFlat(b.outline, 4)),
  ].map((p) => p.x)
  return { minX: Math.min(...xs), maxX: Math.max(...xs) }
})()
const NEURON_K =
  (NEURON_BUDGET.right - NEURON_BUDGET.left) / (NEURON_SPAN.maxX - NEURON_SPAN.minX)

export const SOMA: Pt = {
  x: NEURON_BUDGET.left - NEURON_SPAN.minX * NEURON_K,
  y: STAGE_H * 0.46,
}
/** The trace's mean soma radius, scaled — the cell's nominal radius, which
 *  the honest scale (PX_PER_UM) is derived from exactly as before. */
export const SOMA_R = Math.round(
  (traceFlat(NEURON_TRACE.soma, 6)
    .map((p) => Math.hypot(p.x, p.y))
    .reduce((s, r) => s + r, 0) /
    (NEURON_TRACE.soma.length * 6 + 1)) *
    NEURON_K,
)
export const BOUTON_R = 10

/** Trace units → scene pixels. */
const nxf = (p: Pt): Pt => ({
  x: SOMA.x + p.x * NEURON_K,
  y: SOMA.y + p.y * NEURON_K,
})
const nxfAll = (cs: TraceCubic[], n: number): Pt[] => traceFlat(cs, n).map(nxf)

/** The soma's own traced outline (closed), for every renderer that used to
 *  draw a circle of SOMA_R. */
export const SOMA_OUTLINE: Pt[] = nxfAll(NEURON_TRACE.soma, 5)

/** The trace's mean soma radius in its own units, and the direction the cell
 *  PROJECTS as drawn — soma centre to the far end of its axon, which is the
 *  axis a whole reduced copy is turned about. (It was the hillock cone's own
 *  direction until 2026-09-04, which turned the fan by the 53° between the
 *  cone and the axon's exit.) Measured off the data, never asserted. */
const NEURON_R_UNITS = SOMA_R / NEURON_K
/** How far the traced fan reaches from the soma centre, in trace units — the
 *  distance a partner cell must stand off if its own dendrites are to touch
 *  what it listens to without being stretched out of scale. */
const NEURON_FAN_UNITS = Math.max(
  ...NEURON_TRACE.trunkStrokes.map((st) => Math.hypot(st[0][0], st[0][1])),
)
const NEURON_FACING = Math.atan2(
  NEURON_TRACE.axon[NEURON_TRACE.axon.length - 1][7],
  NEURON_TRACE.axon[NEURON_TRACE.axon.length - 1][6],
)

/** ⚠ A SIMILARITY THAT MAKES A TRACED PROCESS LAND WHERE THE MODEL SAYS:
 *  rotate-and-scale about `fix` so that `from` arrives exactly on `onto`.
 *  Extracted 2026-09-04 — the astrocyte's reach, an input's axon and the
 *  target's dendrites are all the same move, and a second private copy of it
 *  would be a second copy of every bug in it. */
export function reachTransform(fix: Pt, from: Pt, onto: Pt): (p: Pt) => Pt {
  const dx = from.x - fix.x
  const dy = from.y - fix.y
  const d2 = dx * dx + dy * dy || 1
  const qr = ((onto.x - fix.x) * dx + (onto.y - fix.y) * dy) / d2
  const qi = ((onto.y - fix.y) * dx - (onto.x - fix.x) * dy) / d2
  return (p) => ({
    x: fix.x + (p.x - fix.x) * qr - (p.y - fix.y) * qi,
    y: fix.y + (p.x - fix.x) * qi + (p.y - fix.y) * qr,
  })
}

/** The traced axon's ends, in trace units. */
const TRACE_AXON_ROOT: Pt = {
  x: NEURON_TRACE.axon[0][0],
  y: NEURON_TRACE.axon[0][1],
}
const TRACE_AXON_TIP: Pt = {
  x: NEURON_TRACE.axon[NEURON_TRACE.axon.length - 1][6],
  y: NEURON_TRACE.axon[NEURON_TRACE.axon.length - 1][7],
}

/** ⚠ A NEIGHBOUR IS A WHOLE NEURON, REDUCED (user, 2026-09-04: "neighbour
 *  neurons require more detailed visualisation, as at the moment they look
 *  like astrocytes" — a star body with processes radiating evenly IS the
 *  astrocyte glyph). Every partner is now the same traced cell the focus
 *  neuron is: soma, the whole bushy fan, its axon, its arbor — scaled down
 *  and turned so its axon points `facing`, cropped by the frame. What tells
 *  it from an astrocyte is POLARITY, which only a whole cell has. */
interface PartnerParts {
  /** Trace units → this cell's scene coordinates. */
  T: (p: Pt) => Pt
  outline: Pt[]
  /** Every traced dendrite stroke, each running far-tip → soma so a renderer
   *  can fade the far end where the cell leaves the story. */
  fan: Pt[][]
  /** Where its axon leaves the soma, and where the traced axon ends. */
  coneRoot: Pt
  axonTip: Pt
  axon: Pt[]
}
function partnerParts(c: Pt, r: number, facing: number): PartnerParts {
  const k = r / NEURON_R_UNITS
  const rot = facing - NEURON_FACING
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const T = (p: Pt): Pt => ({
    x: c.x + (p.x * cos - p.y * sin) * k,
    y: c.y + (p.x * sin + p.y * cos) * k,
  })
  return {
    T,
    outline: traceFlat(NEURON_TRACE.soma, 4).map(T),
    fan: [...NEURON_TRACE.trunkStrokes, ...NEURON_TRACE.twigStrokes].map((s) =>
      traceFlat(s, 4).map(T),
    ),
    coneRoot: T(TRACE_AXON_ROOT),
    axonTip: T(TRACE_AXON_TIP),
    axon: traceFlat(NEURON_TRACE.axon, 12).map(T),
  }
}

/** ⚠ THE POSTSYNAPTIC SPECIALIZATION AT THE SCENE'S REGISTER (user,
 *  2026-09-04: "let dendrites start with thickenings — to imitate the way we
 *  displayed postsynaptic specialization"). A dendrite that receives a
 *  synapse does not simply end: it swells into a spine head on a narrow
 *  neck, which is the object the synapse view magnifies. So the stand-in now
 *  looks like what it dissolves into, and a thickening means exactly one
 *  thing — a synapse lands HERE.
 *
 *  `site` is the apposed face (the model's synapse point) and `towards` the
 *  presynaptic bouton, so the head is seated BEHIND the face — it never
 *  grows across the cleft it is supposed to be facing. */
export const SPINE_HEAD_R = BOUTON_R * 0.62

/** ⚠ THE HEAD IS SEATED ON THE DENDRITE'S OWN TIP, and takes its bearing from
 *  the dendrite alone (user, 2026-09-04: "thickening on the ends of dendrites
 *  look misaligned"). It used to be offset by a head's radius along the line
 *  to the PARTNER's bouton — a direction the dendrite knows nothing about —
 *  so on a two-pixel branch the swelling sat visibly beside the end of its
 *  own line. Centred on the tip it cannot be out of line with anything: the
 *  clearance from the terminal across the gap is made by placing the BOUTON,
 *  which is the thing that is free to move. */
export function spineHead(
  /** The receiving dendrite, running soma → tip. */
  dendrite: Pt[],
): { head: Pt; neck: Pt } {
  const head = dendrite[dendrite.length - 1]
  // ⚠ The neck's direction is taken over a real ARC DISTANCE back down the
  // dendrite, never from the neighbouring sample: the traced strokes are
  // sampled every few pixels, so a one-sample tangent is noise.
  const back = [...dendrite].reverse()
  const inward = polylinePoint(back, Math.min(1, (SPINE_HEAD_R * 4) / (pathLength(back) || 1)))
  const dir = norm(sub(inward, head))
  return {
    head,
    neck: {
      x: head.x + dir.x * SPINE_HEAD_R * 1.7,
      y: head.y + dir.y * SPINE_HEAD_R * 1.7,
    },
  }
}

// The scene has ONE honest scale, set by the soma, and the axon's drawn width
// follows from real biology rather than from what looks nice. Everything
// smaller (the membrane, a lipid head) is then genuinely too thin to see until
// the camera zooms in — which is the point.
export const PX_PER_UM = (2 * SOMA_R) / SOMA_DIAMETER_UM
export const AXON_W = AXON_DIAMETER_UM * PX_PER_UM
/** Membrane thickness in scene pixels: about a fortieth of a pixel. */
export const MEMBRANE_PX = MEMBRANE_THICKNESS_UM * PX_PER_UM
/** One phospholipid head, in scene pixels. */
export const LIPID_PX = (LIPID_HEAD_NM / 1000) * PX_PER_UM
/** Centre-to-centre spacing of neighbouring lipids, as a fraction of a head.
 *  Slightly over 1, leaving a small gap: a bilayer is a LIQUID, and drawing it
 *  as a seamless wall of bricks is its own misconception. The gaps are kept
 *  narrow and are jittered per molecule (see drawScene) so they read as a
 *  jostling crowd rather than a row of fixed pores — ions never cross through
 *  gaps at all, whatever their size. */
export const LIPID_PACKING = 1.16
/** How much each lipid is nudged along and across the membrane, as a fraction
 *  of a head. Deterministic per molecule, so the crowd looks irregular without
 *  shimmering every frame. */
export const LIPID_JITTER = 0.2

/** Magnification at which a process stops being a line and reads as a tube. */
export const TUBE_SCALE = 5
/** Magnification at which a membrane resolves into individual lipids. */
export const BILAYER_SCALE = 500
/** Magnification that renders the bilayer at a comfortable ~68 px — big enough
 *  that an ion (smaller than a lipid head, honestly so) is still legible. */
export const MEMBRANE_ZOOM = Math.round(68 / MEMBRANE_PX / 100) * 100
/** Width of a synaptic gap on screen (hugely exaggerated: a real cleft is
 *  ~20 nm, about a thousandth of the soma's width). */
export const CLEFT = 14

/** The axon as traced: one sweeping arc from the soma's hillock cone, dipping
 *  below the cell and rising to the terminal arbor. Sampled densely enough
 *  that the wall-frame and marker guards measure the curve, not the chords. */
export const AXON_POLYLINE: Pt[] = nxfAll(NEURON_TRACE.axon, 20)

/** Where the axon ends — the terminal arbor's hub. */
export const AXON_END: Pt = AXON_POLYLINE[AXON_POLYLINE.length - 1]

/** Point on the traced axon, by arc length, t ∈ [0, 1]. */
export function axonPoint(t: number): Pt {
  return polylinePoint(AXON_POLYLINE, t)
}

/** Where along the axon the propagation view is entered. Far enough from the
 *  soma to be plainly "the cable" rather than "where the cable starts", and
 *  clear of the membrane-patch marker further along. */
export const AXON_SIGNAL_T = 0.3

/** ⚠ WHERE THE SECOND AXON EXHIBIT LIVES (user, 2026-08-31: "let's follow
 *  'Axonal conduction and myelin' pattern, and add another entry point:
 *  magnifying glass on the 'big neuron'").
 *
 *  Passive spread is a place on this cell, not a thought about it, so it gets a
 *  marker of its own — the app's own dashed ring with a 🔎 inside it — rather
 *  than a drawer over the scene. It sits FURTHER DOWN the axon than the
 *  conduction view, chosen so the axon's three doors never overlap on the
 *  traced arc (re-measured 2026-09-04, the guard in layout.test measures every
 *  pair): conduction at t = 0.3, here at 0.62, the membrane patch at 0.86 on
 *  the gentle tail. */
export const AXON_PASSIVE_T = 0.62

/** How wide the axon is drawn when the camera is at the propagation view, px.
 *  Fat enough to be a tube with an inside, rather than a line. */
const AXON_VIEW_PX = 86

/** Magnification of the propagation view — derived, so it is whatever it takes
 *  to draw this axon's real width at a readable size, rather than a number
 *  chosen to make a picture work. */
export const AXON_VIEW_SCALE = Math.round(AXON_VIEW_PX / AXON_W)

/** What the camera settles at for the synapse view.
 *
 *  The bouton is ~1 µm across (`BOUTON_DIAMETER_UM`) and the drawing gives it
 *  about 42% of a 1060 px stage, so the magnification is what makes a
 *  micrometre fill four hundred pixels. Derived rather than picked: change how
 *  big the terminal is drawn and the camera follows it. */
export const SYNAPSE_VIEW_SCALE = Math.round((STAGE_W * 0.42) / (1 * PX_PER_UM))

/** The spine framing's magnification — see the target for why it is this. */
export const SPINE_VIEW_SCALE = SYNAPSE_VIEW_SCALE * 2.4
/** Where the presynaptic wall lands on screen at that framing: just under the
 *  view's top chrome, so the membrane is not sitting behind the timeline. */
export const SPINE_TOP_PX = 120

/** ⚠ HOW FAR DOWN THE CAMERA DROPS to leave the terminal behind and put the
 *  spine in the middle of the frame, in scene units.
 *
 *  ⚠ AND IT IS SET BY THE MARKER RULE, not by taste. Two doors at one place
 *  need a marker's own diameter of clearance between them; at 34 this sat 22px
 *  from the active zone's marker and the guard rejected it. It has to clear the
 *  cleft anyway — this is the first synapse place on the FAR side of it — so
 *  the two requirements point the same way. */
export const SPINE_DROP = 52


/** Which way this stretch of axon runs, radians. Measured over the STRETCH a
 *  view frames (±1% of the cable), not at a point — the traced arc curves,
 *  and it is the stretch that has to lie level on screen. */
function axonSlopeAt(t: number): number {
  const a = axonPoint(Math.max(0, t - 0.01))
  const b = axonPoint(Math.min(1, t + 0.01))
  return Math.atan2(b.y - a.y, b.x - a.x)
}

/** How far the camera turns on arriving at the propagation view: exactly enough
 *  to bring this stretch of axon level. Level matters here in a way it does not
 *  at a membrane patch — a ruler in millimetres and a graph of voltage against
 *  distance both have to be square to the screen to be readable, and the axon
 *  they belong to has to be square to them. */
export const AXON_SIGNAL_TURN = -axonSlopeAt(AXON_SIGNAL_T)
export const AXON_PASSIVE_TURN = -axonSlopeAt(AXON_PASSIVE_T)
export const AXON_FLAT: number[] = AXON_POLYLINE.flatMap((p) => [p.x, p.y])
/** Where the axon leaves the soma — where an action potential is born. */
export const HILLOCK: Pt = axonPoint(0.015)

/** How long the drawn axon is, in the scene's own honest micrometres.
 *
 *  Measured off the curve rather than stated, and it comes out at well under a
 *  tenth of a millimetre — which is why propagation cannot be shown on this
 *  stage at any magnification, and why the view that does show it puts THIS
 *  number on its ruler as a tick. See core/cable.ts. */
export const DRAWN_AXON_UM = pathLength(AXON_POLYLINE) / PX_PER_UM

export interface DendriteSeg {
  x1: number
  y1: number
  x2: number
  y2: number
  w: number
  trunk: number
  /** 0 = trunk, 1 = branch, 2 = twig — drives the growth animation. */
  depth: number
}

export interface DendriteTrunk {
  segs: DendriteSeg[]
  /** Root→tip chain used for travelling ripples. */
  path: Pt[]
}

/** A traced stroke as straight segs (round caps make the chain read as the
 *  curve), width tapering from the soma side out. */
function strokeToSegs(
  pts: Pt[],
  trunk: number,
  depth: number,
  w0: number,
  w1: number,
): DendriteSeg[] {
  const segs: DendriteSeg[] = []
  for (let i = 1; i < pts.length; i++) {
    const f = (i - 0.5) / (pts.length - 1)
    segs.push({
      x1: pts[i - 1].x,
      y1: pts[i - 1].y,
      x2: pts[i].x,
      y2: pts[i].y,
      w: w0 + (w1 - w0) * f,
      trunk,
      depth,
    })
  }
  return segs
}

/** ⚠ THE DENDRITE FAN, AS TRACED (neuron (1).svg): eleven trunks rooted on
 *  the soma outline, drawn tip→soma in the handover and reversed here so
 *  `path` runs soma→tip — the route the graded ripple travels back along.
 *  The six twig strokes hang on siblings (measured at extraction); each is
 *  drawn with, and lights with, the trunk it sits nearest. */
/** ⚠ A BRANCH IS ONE STROKE, and the drawing needs it that way (user,
 *  2026-09-04: "dendrites of the main neuron have visible dots on the places
 *  where its pieces collide").
 *
 *  The fan is modelled as SEGMENTS — a hit region, a ripple's route, a
 *  miniature's line all want segments — and the scene drew them one at a
 *  time with a round cap at each end. Under the fan's own `globalAlpha` that
 *  double-composites every join: at α = 0.85 the overlap of two round caps
 *  paints 1 − 0.15² = 0.98, so each of the ~30 joins on a branch came out as
 *  a bright dot. The ink was right; drawing it thirty times was not.
 *
 *  So the strokes are exported as well as the segments, tapering widths and
 *  all, and the two cannot drift because the segments are BUILT from these. */
export interface DendriteStroke {
  pts: Pt[]
  /** Width at the soma end and at the tip — the taper, as drawn. */
  w0: number
  w1: number
  trunk: number
  depth: number
}

export const DENDRITE_STROKES: DendriteStroke[] = (() => {
  const strokes: DendriteStroke[] = NEURON_TRACE.trunkStrokes.map((stroke, i) => ({
    pts: nxfAll(stroke, 5).reverse(),
    w0: 5,
    w1: 1.8,
    trunk: i,
    depth: 0,
  }))
  for (const twig of NEURON_TRACE.twigStrokes) {
    const pts = nxfAll(twig, 5)
    // The trunk this twig hangs on: nearest trunk point to the twig's own
    // soma-side end — measured, not assigned.
    let best = 0
    let bd = Infinity
    strokes.forEach((t, i) => {
      if (t.depth !== 0) return
      for (const p of t.pts) {
        const d = Math.hypot(p.x - pts[pts.length - 1].x, p.y - pts[pts.length - 1].y)
        if (d < bd) {
          bd = d
          best = i
        }
      }
    })
    strokes.push({ pts, w0: 1.8, w1: 1.8, trunk: best, depth: 1 })
  }
  return strokes
})()

export const DENDRITE_TRUNKS: DendriteTrunk[] = NEURON_TRACE.trunkStrokes.map((_, i) => {
  const own = DENDRITE_STROKES.filter((st) => st.trunk === i)
  const path = own.find((st) => st.depth === 0)!.pts
  return {
    segs: own.flatMap((st) => strokeToSegs(st.pts, st.trunk, st.depth, st.w0, st.w1)),
    path,
  }
})
export const DENDRITE_SEGS: DendriteSeg[] = DENDRITE_TRUNKS.flatMap((t) => t.segs)

/** The width of a stroke at fraction `f` of its length — the same taper
 *  `strokeToSegs` gives the segments, so a ribbon and a hit region agree. */
export function strokeWidthAt(st: DendriteStroke, f: number): number {
  return st.w0 + (st.w1 - st.w0) * clamp01(f)
}

export interface Terminal {
  end: Pt
  /** Unit vector pointing away from the axon — the way vesicles drift. */
  dir: Pt
  /** The route the lighting travels, axon tip → bouton centre — the traced
   *  arbor chain, not a straight spoke. */
  path: Pt[]
  /** The bouton's own traced teardrop outline (closed). */
  outline: Pt[]
}

/** ⚠ THE TERMINAL ARBOR, AS TRACED: seven boutons, each reached from the
 *  axon tip through the drawn limbs (see NEURON_TRACE.terminalPaths). The
 *  drawn ink is TERMINAL_BRANCHES; the model travels `path`. */
export const TERMINALS: Terminal[] = NEURON_TRACE.terminalPaths.map((raw, i) => {
  const path = raw.map(nxf)
  const end = nxf(NEURON_TRACE.boutons[i].c)
  const prev = path[path.length - 2]
  return {
    end,
    dir: norm(sub(end, prev)),
    path,
    outline: nxfAll(NEURON_TRACE.boutons[i].outline, 5),
  }
})

/** The arbor's eight branch strokes, verbatim from the trace — what the
 *  renderers draw between the axon tip and the boutons. */
export const TERMINAL_BRANCHES: Pt[][] = NEURON_TRACE.branchStrokes.map((s) => nxfAll(s, 6))

/** Each terminal route's arc length, and the longest — the ruler the arbor
 *  wave's clock is measured against. */
const TERMINAL_LENS = TERMINALS.map((t) => pathLength(t.path))
export const ARBOR_MAX_LEN = Math.max(...TERMINAL_LENS)

/** ⚠ HOW FAR THE ARBOR WAVE HAS COVERED TERMINAL ti's ROUTE, 0→1
 *  (corrections 2026-09-04: "the whole thing lights up at once… not
 *  consistent with the rest of the neuron"). `head` is the ONE wave's
 *  travelled distance as a fraction of the LONGEST route; every route is
 *  covered at the same speed, so nearer boutons finish first — the spike
 *  INVADES the arborization, forking at the branch points, exactly as it
 *  moved down the cable. Null means no wave has entered. */
export function terminalReach(head: number | null, ti: number): number {
  if (head === null) return 0
  return clamp01((head * ARBOR_MAX_LEN) / TERMINAL_LENS[ti])
}

/** A bouton's own arrival: the last fifth of its route lighting it up — so
 *  seven boutons light in the order the wave actually reaches them. */
export function terminalArrival(head: number | null, ti: number): number {
  return clamp01((terminalReach(head, ti) - 0.8) / 0.2)
}

/** ⚠ WHERE THE TRAVELLING SIGNALS ARE IN THE ARBOR RIGHT NOW (user,
 *  2026-09-04: "a yellow glowing dot with white tail moves along the lines,
 *  same as on axon body"). Seven routes share their first stretches, and
 *  because every route is covered at one speed the heads on a shared stretch
 *  are the SAME POINT — drawing one signal per route would stack seven glows
 *  on the shared limb and read as a flare, not a spike. So the fronts are
 *  DEDUPED by position: one dot leaves the axon, and it becomes two, then
 *  more, at the forks — which is the thing the picture is for. A route that
 *  has already arrived drops out; its bouton's own glow takes over. */
export function arborFronts(head: number | null): { ti: number; t: number }[] {
  const out: { ti: number; t: number; at: Pt }[] = []
  for (let ti = 0; ti < TERMINALS.length; ti++) {
    const t = terminalReach(head, ti)
    if (t <= 0 || t >= 1) continue
    const at = polylinePoint(TERMINALS[ti].path, t)
    if (out.some((o) => Math.hypot(o.at.x - at.x, o.at.y - at.y) < BOUTON_R * 0.35)) continue
    out.push({ ti, t, at })
  }
  return out.map(({ ti, t }) => ({ ti, t }))
}

/** How long the arbor's travelling tail is, in scene pixels — the axon's own
 *  tail (0.11 of the cable), so the two read as one journey at one speed. */
export const ARBOR_TAIL_PX = 0.11 * pathLength(AXON_POLYLINE)

/** Three vesicles per bouton, at fixed offsets so they never jitter. */
export const VESICLE_OFFSETS: Pt[] = [
  { x: -3.2, y: -2.4 },
  { x: 2.6, y: -3 },
  { x: -0.6, y: 3 },
]
export const VESICLE_R = 2

// -------------------------------------------------------------- input cells

/** Dendrite trunks that carry an incoming synapse — SOLVED onto the traced
 *  fan (2026-09-04): for each input cell's row on the left edge, the
 *  input-facing trunk whose tip lies nearest that row, each trunk used once.
 *  Only tips left of the soma qualify: an input's axon must not reach across
 *  the cell. */
export const SYNAPSE_TRUNKS: number[] = (() => {
  const chosen: number[] = []
  for (const f of [0.17, 0.5, 0.83]) {
    const rowY = STAGE_H * f
    let best = -1
    let bd = Infinity
    DENDRITE_TRUNKS.forEach((t, i) => {
      if (chosen.includes(i)) return
      const tip = t.path[t.path.length - 1]
      if (tip.x > SOMA.x - SOMA_R) return
      const d = Math.abs(tip.y - rowY)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    chosen.push(best)
  }
  return chosen
})()

/** The far tip of a trunk's root→tip chain. It MUST be a point on `path`,
 *  because that is the route the graded ripple travels back to the soma —
 *  picking the tree's leftmost endpoint instead would put the synapse on a
 *  branch the ripple never follows. */
function synapseSite(trunk: DendriteTrunk): Pt {
  return trunk.path[trunk.path.length - 1]
}

export interface InputNeuron {
  id: number
  label: string
  soma: Pt
  somaR: number
  /** Its own traced soma outline. */
  outline: Pt[]
  /** Its WHOLE traced dendrite fan, reduced, each stroke running far-tip →
   *  soma so the far end can fade where the cell leaves the frame. */
  fan: Pt[][]
  /** Its axon, soma cone → the bouton it makes on our dendrite, running
   *  through its own arbor — so the spike travels the route it really takes. */
  axon: Pt[]
  /** The rest of its terminal arbor: this axon contacts other cells too. */
  branches: Pt[][]
  otherBoutons: Pt[]
  bouton: Pt
  /** The point on OUR dendrite it talks to. */
  site: Pt
  /** Which of our trunks carries this synapse. */
  trunk: number
}

const PARTNER_SOMA_R = 24

export const INPUTS: InputNeuron[] = SYNAPSE_TRUNKS.map((trunk) => ({
  trunk,
  site: synapseSite(DENDRITE_TRUNKS[trunk]),
}))
  // Top-to-bottom, so each input sits beside the branch it contacts and the
  // axons do not cross each other.
  .sort((a, b) => a.site.y - b.site.y)
  .map(({ trunk, site }, i) => {
    const soma: Pt = { x: 58, y: STAGE_H * [0.17, 0.5, 0.83][i] }
    const toSite = norm(sub(site, soma))
    // ⚠ The terminal stands off by the SPINE'S radius as well as the cleft
    // (2026-09-04): the postsynaptic head is centred on the dendrite's tip,
    // so the gap the child sees between the two membranes is the same as it
    // ever was — the bouton moved, not the drawn gap.
    const bouton: Pt = {
      x: site.x - toSite.x * (CLEFT + SPINE_HEAD_R),
      y: site.y - toSite.y * (CLEFT + SPINE_HEAD_R),
    }
    const parts = partnerParts(soma, PARTNER_SOMA_R, Math.atan2(toSite.y, toSite.x))
    // ⚠ THE ARBOR IS SEATED, NOT AIMED. The terminal that contacts us is the
    // one FARTHEST along its arbor, so the cell's other endings trail BACK
    // along its axon instead of sprawling across our dendrite. Its hub is
    // then wherever that puts it, and the traced axon is stretched to reach.
    const bFar = NEURON_TRACE.boutons
      .map((b, bi) => ({
        bi,
        d: Math.hypot(b.c.x - TRACE_AXON_TIP.x, b.c.y - TRACE_AXON_TIP.y),
      }))
      .sort((a, b) => b.d - a.d)[0].bi
    const far = parts.T(NEURON_TRACE.boutons[bFar].c)
    const hub: Pt = {
      x: bouton.x - (far.x - parts.axonTip.x),
      y: bouton.y - (far.y - parts.axonTip.y),
    }
    // The arbor, at the cell's own scale, hung off that hub.
    const A = (p: Pt): Pt => {
      const q = parts.T(p)
      return {
        x: q.x + hub.x - parts.axonTip.x,
        y: q.y + hub.y - parts.axonTip.y,
      }
    }
    const stretch = reachTransform(parts.coneRoot, parts.axonTip, hub)
    return {
      id: i,
      label: `input ${i + 1}`,
      soma,
      somaR: PARTNER_SOMA_R,
      outline: parts.outline,
      fan: parts.fan,
      // Soma cone → hub along its own traced arc, then hub → bouton along the
      // traced arbor route: one continuous path, ending exactly on the cleft.
      axon: [...parts.axon.map(stretch), ...NEURON_TRACE.terminalPaths[bFar].map(A).slice(1)],
      branches: NEURON_TRACE.branchStrokes.map((s) => traceFlat(s, 5).map(A)),
      otherBoutons: NEURON_TRACE.boutons.filter((_, bi) => bi !== bFar).map((b) => A(b.c)),
      bouton,
      site,
      trunk,
    }
  })

// -------------------------------------------------------------- target cell

export interface OutputNeuron {
  label: string
  soma: Pt
  somaR: number
  /** Its own traced soma outline. */
  outline: Pt[]
  /** The dendrites that receive our boutons. `path` runs soma → tip along a
   *  traced stroke stretched to land exactly on the postsynaptic point;
   *  `from`/`to` are its two ends. */
  dendrites: Array<{ from: Pt; to: Pt; fromTerminal: number; path: Pt[] }>
  /** The rest of its traced fan — the branches this synapse is not on. */
  fan: Pt[][]
  /** Its own axon, running off the right edge. */
  axon: Pt[]
}

const OUT_R = 28

/** ⚠ THE SYNAPSE STANDS THE WAY THE RELEASE VIEW DRAWS IT (user, 2026-09-04:
 *  "the vesicle release view is horizontally aligned, whereas the acting
 *  connection on the whole neuron view is vertical… place astrocyte and a
 *  receiving neuron under it").
 *
 *  The vesicle view puts the terminal's wall ACROSS the frame and sends the
 *  cargo DOWN through it. The scene had the same synapse lying along x —
 *  bouton left, target right — and made up the difference with a quarter turn
 *  of the camera on the way in. The picture was right at both ends and the
 *  child had to rotate it in their head to get from one to the other.
 *
 *  So the terminal now speaks DOWNWARD: its target sits under the arbor, the
 *  cleft lies across, and the camera flies in without turning at all. Which
 *  way a neuron's axon points is arbitrary — nothing here is less true for
 *  standing this way, and one less rotation is one less thing that is only
 *  true after you have thought about it. */
const OUT_DROP = CLEFT + BOUTON_R

/** ⚠ WHICH BOUTONS THE TARGET LISTENS TO — SOLVED from where it stands, not
 *  picked: a cell UNDER the arbor meets the arbor's LOWEST endings, so those
 *  three are its three, ordered left→right so its dendrites never cross. The
 *  one it stands nearest is put at index 1, because `OUTPUT.dendrites[1]` is
 *  the app-wide literal for "the outgoing synapse" (the zoom target, the LOD
 *  dissolve, the astrocytes and the whole synapse view all anchor to it). */
const TARGET_TERMINALS: number[] = (() => {
  const lowest = TERMINALS.map((t, ti) => ({ ti, y: t.end.y }))
    .sort((a, b) => b.y - a.y)
    .slice(0, 3)
    .map((e) => e.ti)
    .sort((a, b) => TERMINALS[a].end.x - TERMINALS[b].end.x)
  return lowest
})()

/** The postsynaptic points: straight DOWN from each bouton, across a cleft.
 *  One axis for the whole synapse, and it is the release view's axis. */
const TARGET_TIPS: Pt[] = TARGET_TERMINALS.map((ti) => ({
  x: TERMINALS[ti].end.x,
  y: TERMINALS[ti].end.y + OUT_DROP,
}))

/** ⚠ WHERE THE TARGET STANDS — SOLVED from its own reach: far enough under
 *  the lowest of those endings that its traced fan arrives at them without
 *  being stretched out of its own scale, centred under the three. */
const OUT_SOMA: Pt = {
  x: TARGET_TIPS.reduce((a, p) => a + p.x, 0) / TARGET_TIPS.length,
  y: Math.max(...TARGET_TIPS.map((p) => p.y)) + NEURON_FAN_UNITS * (OUT_R / NEURON_R_UNITS),
}

/** The target is a whole traced cell too, turned so it PROJECTS onward — away
 *  from the terminal driving it, off the bottom edge — which puts its own
 *  dendrite fan back UP toward our boutons, exactly where it belongs. */
const OUT_PARTS = partnerParts(
  OUT_SOMA,
  OUT_R,
  Math.atan2(
    OUT_SOMA.y - TARGET_TIPS.reduce((a, p) => a + p.y, 0) / TARGET_TIPS.length,
    OUT_SOMA.x - TARGET_TIPS.reduce((a, p) => a + p.x, 0) / TARGET_TIPS.length,
  ),
)

export const OUTPUT: OutputNeuron = (() => {
  // Which of its traced dendrites receives which of our boutons: SOLVED —
  // for each postsynaptic point, the nearest of its own unused fan strokes,
  // then that stroke is STRETCHED (fixed at the soma end) so its tip lands
  // exactly on the point. The drawing is never nudged; the transform is.
  const used: number[] = []
  const dendrites = TARGET_TERMINALS.map((ti, i) => {
    const tip = TARGET_TIPS[i]
    let best = 0
    let bd = Infinity
    NEURON_TRACE.trunkStrokes.forEach((s, si) => {
      if (used.includes(si)) return
      const end = OUT_PARTS.T({ x: s[0][0], y: s[0][1] })
      const d = Math.hypot(end.x - tip.x, end.y - tip.y)
      if (d < bd) {
        bd = d
        best = si
      }
    })
    used.push(best)
    // Traced strokes run tip → soma; reversed, this is soma → tip.
    const raw = traceFlat(NEURON_TRACE.trunkStrokes[best], 5).map(OUT_PARTS.T).reverse()
    const path = raw.map(reachTransform(raw[0], raw[raw.length - 1], tip))
    return { from: path[0], to: path[path.length - 1], fromTerminal: ti, path }
  })
  // ⚠ THE INDEX-1 CONTRACT. `OUTPUT.dendrites[1]` is the app-wide literal for
  // "the outgoing synapse", so the one the target stands NEAREST is put there
  // — while the left→right order the stubs need is otherwise kept.
  const nearest = dendrites
    .map((d, i) => ({
      i,
      d: Math.hypot(d.to.x - OUT_SOMA.x, d.to.y - OUT_SOMA.y),
    }))
    .sort((a, b) => a.d - b.d)[0].i
  if (nearest !== 1) {
    ;[dendrites[1], dendrites[nearest]] = [dendrites[nearest], dendrites[1]]
  }
  return {
    label: 'target neuron',
    soma: OUT_SOMA,
    somaR: OUT_R,
    outline: OUT_PARTS.outline,
    dendrites,
    // Everything else it has, drawn where the frame lets it be seen.
    fan: OUT_PARTS.fan.filter((_, i) => !used.includes(i)),
    axon: OUT_PARTS.axon,
  }
})()

/** The synapse our neuron makes onto the target: used for the zoom target and
 *  the outgoing-transmitter animation. */
export const OUTGOING = {
  bouton: TERMINALS[OUTPUT.dendrites[1].fromTerminal].end,
  tip: OUTPUT.dendrites[1].to,
}

/** ⚠ THE ASTROCYTE'S OWN INK — the glial green, in ONE place.
 *
 *  ⚠ PINK WAS TRIED AND REJECTED, ON THE PICTURE (2026-09-05). The user asked
 *  for pink tones, matching their reference figure; seen in the app the answer
 *  came back the same day: "the pink tint of astrocytes conflicts with red &
 *  blue charge color-coding. Bring back the previous color, for all views."
 *  The palette reserves red for POSITIVE charge and sky for negative, and a
 *  large pink cell in the same frame as those badges reads as charge. The
 *  green sits in a hue no charge mark uses, which is exactly why 21b-1d chose
 *  it when the first astrocyte handover arrived red. Recorded so pink is not
 *  proposed a third time.
 *
 *  What the pink round DID leave behind is this constant. The ink used to be a
 *  literal repeated in six places across four files; a colour CODE only works
 *  if every register asks the same question, so the scene, the big neuron, the
 *  miniature, the dendrite cells and D17 now all read it from here. */
export const ASTRO_INK = '134, 184, 158'

/** ⚠ THE TWO ASTROCYTES at the outgoing synapse (21b-1b, user: "since we
 *  display 2 fingers, draw 2 astrocytes").
 *
 *  One cell per glial finger of the synapse view, and which way they flank
 *  follows the synapse's axis: the camera no longer turns on the way in
 *  (2026-09-04), so the view's left/right flanks ARE the scene's left and
 *  right. They used to sit above and below, because the landing turn was a
 *  quarter — the same two cells, read through the rotation that is now gone.
 *  Bodies toward the frame's edge (a part may crop off, per the user), and
 *  `reach` is where each cell's synapse-bound process ends: at the cleft's
 *  own left and right mouths. */
export const ASTROCYTES: { soma: Pt; r: number; reach: Pt }[] = (() => {
  // (Midpoint inlined: the `mid` helper is declared further down the module.)
  const s = {
    x: (OUTGOING.bouton.x + OUTGOING.tip.x) / 2,
    y: (OUTGOING.bouton.y + OUTGOING.tip.y) / 2,
  }
  // ⚠ ONE CELL, ON THE RIGHT (21c-1, user: "place one astrocyte on the right")
  // — the left one is gone with the left finger it owned. A marker's job is to
  // say what is on screen, so the map may not keep a cell the scene no longer
  // draws.
  // ⚠ ABOVE the synapse, not below (user, 2026-09-05: "map astrocyte, same as
  // the whole-picture astrocyte, are located below the synapse. Demo one —
  // above. Align on either of the views, for consistency"). Aligned ON THE
  // DEMO, because the demo's placement is the MEASURED one: the bouton is on
  // the presynaptic side, so a body below the synapse throws the processes
  // across the postsynaptic spine. In this view the presynaptic side is up,
  // because `OUTGOING.bouton` sits above `OUTGOING.tip`.
  return [
    {
      soma: { x: s.x + 86, y: s.y - 46 },
      r: 23,
      reach: { x: s.x + 11, y: s.y - 2 },
    },
  ]
})()

/** Whether the whole-cell MINIATURE shows the astrocytes: only on the views
 *  whose story needs them (the synapse framings) — a map marker's job is to
 *  say what is on screen, and everywhere else they are not. */
export function mapShowsAstrocytes(zoom: string | null): boolean {
  return zoom === 'outgoing-synapse' || zoom === 'active-zone'
}

/** ⚠ THE MAP'S OWN ASTROCYTE SPOTS: the true scene cells sit half off the
 *  miniature's box, and a star the kid cannot see is a star the kid cannot
 *  recognise — so the map pulls each cell inboard, flanking the synapse left
 *  and right (the scene's own arrangement since the camera stopped turning),
 *  bodies on the sheet. Declared in 05's reconciliation. */
export const MAP_ASTROCYTES: { soma: Pt; r: number; reach: Pt }[] = (() => {
  const s = {
    x: (OUTGOING.bouton.x + OUTGOING.tip.x) / 2,
    y: (OUTGOING.bouton.y + OUTGOING.tip.y) / 2,
  }
  // One cell, on the right — the scene's own arrangement since 21c-1.
  return [
    {
      soma: { x: s.x + 48, y: s.y - 20 },
      r: 14,
      reach: { x: s.x + 8, y: s.y - 2 },
    },
  ]
})()

/** ⚠ THE ASTROCYTE GLYPH — TRACED from the user's astrocyte.svg (re-created
 *  2026-09-04; the first pass approximated it procedurally and miscounted its
 *  points — see 05 → Reconciliation): the handover's own SIX-point star soma
 *  with concave valleys, and its six processes, each a wavy main with one
 *  short side-branch, flattened from the SVG's own cubics. ONE geometry in
 *  scene coordinates, consumed by BOTH renderers — the canvas scene and the
 *  miniature's SVG — so the kid meets the same cell shape everywhere without
 *  reading a word. The top arm as drawn is the REACH: the glyph turns so that
 *  arm faces the synapse, and a similarity about its soma-side end stretches
 *  it to land exactly on the cell's fingertip, side-branch riding along. */

/** Cubics absolute in the SVG's own 100×125 box — Shape 13 (the soma) and the
 *  six main/branch pairs, verbatim (machine-extracted; see 05 →
 *  Reconciliation — astrocyte.svg). */
const ASTRO_TRACE: {
  soma: TraceCubic[]
  arms: { main: TraceCubic[]; branch: TraceCubic[] }[]
} = {
  soma: [
    [33.93, 40.65, 33.93, 40.65, 40.75, 43.96, 38.97, 52.34],
    [38.97, 52.34, 37.2, 60.72, 35.27, 62, 35.27, 62],
    [35.27, 62, 35.27, 62, 41.65, 59.92, 45.17, 62],
    [45.17, 62, 48.69, 64.08, 52.54, 69.14, 52.54, 69.14],
    [52.54, 69.14, 52.54, 69.14, 53.68, 64.86, 57.73, 62],
    [57.73, 62, 61.78, 59.14, 67.85, 60.62, 67.85, 60.62],
    [67.85, 60.62, 67.85, 60.62, 64.68, 58, 64.75, 51.93],
    [64.75, 51.93, 64.81, 45.86, 69.84, 40.72, 69.84, 40.72],
    [69.84, 40.72, 69.84, 40.72, 61.9, 41.41, 58.42, 39.34],
    [58.42, 39.34, 54.93, 37.28, 51.79, 31.35, 51.79, 31.35],
    [51.79, 31.35, 51.79, 31.35, 50.15, 36.69, 45.7, 39.5],
    [45.7, 39.5, 41.24, 42.31, 33.93, 40.65, 33.93, 40.65],
  ],
  arms: [
    // arm 0 = the top arm as drawn — becomes the reach.
    {
      main: [
        [50, 6.41, 50, 6.41, 47.98, 12.04, 50, 17.05],
        [50, 17.05, 52.02, 22.06, 51.97, 28.92, 51.82, 31.93],
      ],
      branch: [[55.32, 11.69, 55.32, 11.69, 55.65, 16.35, 51.2, 20.14]],
    },
    {
      main: [
        [11.47, 27.57, 11.47, 27.57, 13.44, 32.28, 20.25, 33.53],
        [20.25, 33.53, 27.05, 34.79, 34.93, 41.6, 34.93, 41.6],
      ],
      branch: [[13.21, 39.42, 13.21, 39.42, 21.1, 41.71, 25.41, 35.61]],
    },
    {
      main: [
        [7.44, 68.84, 7.44, 68.84, 12.68, 75.36, 23.05, 68.68],
        [23.05, 68.68, 33.42, 62, 35.8, 62, 35.8, 62],
      ],
      branch: [[14.13, 62, 14.13, 62, 22.82, 61.66, 26.29, 66.71]],
    },
    {
      main: [
        [82.32, 18.03, 82.32, 18.03, 87.08, 26.12, 82.48, 31.63],
        [82.48, 31.63, 77.87, 37.15, 75.61, 33.64, 68.94, 41.34],
      ],
      branch: [[79.42, 24.61, 79.42, 24.61, 75.96, 30.89, 78.93, 34.73]],
    },
    {
      main: [
        [50, 93.56, 50, 93.56, 56.12, 88.65, 53.06, 82.88],
        [53.06, 82.88, 50, 77.12, 52.55, 68.85, 52.55, 68.85],
      ],
      branch: [[42.89, 87.11, 42.89, 87.11, 45.34, 80.19, 51.83, 79.86]],
    },
    {
      main: [
        [93.04, 74.62, 93.04, 74.62, 89.71, 65.87, 81.68, 66.43],
        [81.68, 66.43, 73.65, 67, 67.06, 60.1, 67.06, 60.1],
      ],
      branch: [[82.26, 74.81, 82.26, 74.81, 77.67, 73.19, 77.67, 66.18]],
    },
  ],
}

/** The trace's own frame, MEASURED off the data at load, never asserted: the
 *  star-anchor centroid is the glyph's centre, the farthest soma sample the
 *  unit radius `r` scales to, and the reach arm's outer end fixes the
 *  as-drawn direction the glyph is turned from. */
const ASTRO_FRAME = (() => {
  const anchors = ASTRO_TRACE.soma.map((c) => ({ x: c[6], y: c[7] }))
  const c = {
    x: anchors.reduce((s, p) => s + p.x, 0) / anchors.length,
    y: anchors.reduce((s, p) => s + p.y, 0) / anchors.length,
  }
  const rTip = Math.max(
    ...traceFlat(ASTRO_TRACE.soma, 6).map((p) => Math.hypot(p.x - c.x, p.y - c.y)),
  )
  const out = ASTRO_TRACE.arms[0].main[0]
  return { c, rTip, reachAng: Math.atan2(out[1] - c.y, out[0] - c.x) }
})()

/** ⚠ THE ASTROCYTE'S NUCLEUS (user, 2026-09-04: "draw nucleus in astrocytes
 *  too"). Every neuron in the app already carries one, and it earns its place
 *  twice over here: a nucleus is what makes a cell BODY read as a body rather
 *  than as the knot where processes happen to meet — and an astrocyte's soma
 *  is genuinely tiny against its bushy territory, so it is often the only
 *  thing that says where the cell actually IS.
 *
 *  ONE decision, asked by both renderers (the canvas and the miniature's
 *  SVG), so the two cannot drift. Its size is a real proportion of the soma,
 *  not a chosen radius — and like everything at the whole-cell register it is
 *  drawn larger relative to the cell than life, as the scene's other
 *  exaggerations are.
 *
 *  Off the star's own valleys rather than its points: a nucleus has to sit
 *  inside the body at every register, and the body is only ~0.6 r where the
 *  outline dips. */
export const ASTRO_NUCLEUS_F = 0.3
export function astroNucleus(a: { soma: Pt; r: number }): {
  at: Pt
  r: number
} {
  return { at: a.soma, r: a.r * ASTRO_NUCLEUS_F }
}

export function astroShape(a: { soma: Pt; r: number; reach: Pt }): {
  soma: Pt[]
  processes: Pt[][]
} {
  const k = a.r / ASTRO_FRAME.rTip
  const rot = Math.atan2(a.reach.y - a.soma.y, a.reach.x - a.soma.x) - ASTRO_FRAME.reachAng
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const T = (p: Pt): Pt => ({
    x: a.soma.x + ((p.x - ASTRO_FRAME.c.x) * cos - (p.y - ASTRO_FRAME.c.y) * sin) * k,
    y: a.soma.y + ((p.x - ASTRO_FRAME.c.x) * sin + (p.y - ASTRO_FRAME.c.y) * cos) * k,
  })
  const soma = traceFlat(ASTRO_TRACE.soma, 6).map(T)
  // The reach arm is drawn from its far tip IN toward its star point; reversed
  // it runs soma → out, and a similarity about its soma-side end carries the
  // far end exactly onto the fingertip (the elongation the reconciliation
  // allows), the side-branch riding the same map so it stays attached.
  const main0 = traceFlat(ASTRO_TRACE.arms[0].main, 10).map(T).reverse()
  const S = reachTransform(main0[0], main0[main0.length - 1], a.reach)
  const processes: Pt[][] = [main0.map(S), traceFlat(ASTRO_TRACE.arms[0].branch, 8).map(T).map(S)]
  for (const arm of ASTRO_TRACE.arms.slice(1)) {
    processes.push(traceFlat(arm.main, 10).map(T))
    processes.push(traceFlat(arm.branch, 8).map(T))
  }
  return { soma, processes }
}

// ------------------------------------------------------------------- labels

// Re-anchored to the traced anatomy (2026-09-04): the fan now spreads
// up-left, the axon DIPS below the cell before rising to the arbor, and the
// seven boutons hang to the right of AXON_END.
export const LABELS: Array<{
  part: NeuronPartId
  text: string
  x: number
  y: number
}> = [
  { part: 'dendrites', text: 'dendrites', x: SOMA.x - 130, y: SOMA.y - 190 },
  // Down-LEFT of the soma, clear of the axon's dip on the right.
  { part: 'soma', text: 'soma', x: SOMA.x - 36, y: SOMA.y + SOMA_R + 36 },
  // Under the dip's outside — the axon's own lowest reach.
  {
    part: 'axon',
    text: 'axon',
    x: axonPoint(0.25).x - 14,
    y: axonPoint(0.25).y + 36,
  },
  // Below the arbor's lowest bouton.
  {
    part: 'terminals',
    text: 'axon terminals',
    x: AXON_END.x + 30,
    y: AXON_END.y + 160,
  },
]

/** ⚠ WHICH TERMS THE SCENE SAYS ALOUD (F04) — one predicate, asked by every
 *  label the scene draws (user, 2026-09-04: "add voice on the labels, which
 *  name neuron parts (not navigation)").
 *
 *  Voice is granted per term, on request, so this is a LIST of what was asked
 *  for rather than a rule about label kinds. It lives here, and both the part
 *  names and the zoom markers consult it, so "does this speak?" has exactly
 *  one answer and a marker cannot quietly acquire a voice by being given a
 *  `speak` field. A marker's label names a DOOR — "Passive spread" is
 *  somewhere to go, not a piece of a neuron — and teaching it as a part is
 *  the thing this keeps out. */
export const SPOKEN_SCENE_TERMS: readonly string[] = LABELS.map((l) => l.text)

export function sceneTermSpeaks(text: string): boolean {
  return SPOKEN_SCENE_TERMS.includes(text)
}

// -------------------------------------------------------------- zoom targets

export interface ZoomTarget {
  id: string
  label: string
  center: Pt
  /** Magnification applied to the whole scene. */
  scale: number
  /** What the kid sees once zoomed — honest about what is not built yet. */
  promise: string
  /** Which upcoming milestone lives here. */
  roadmap: string
  /** Teaching content for a target whose view is actually built. When this is
   *  present the panel shows it instead of the promise. */
  content?: TeachingPara[]
  /** For a membrane patch: the local frame of the wall it sits on, so ions can
   *  be placed relative to the membrane rather than to the canvas. */
  frame?: WallSample
  /** How far the camera turns on arriving, radians. A membrane patch works its
   *  own out from the wall it sits on; anything else says so here. */
  turn?: number
  /** Arriving here replaces the scene with a view of its own, so the
   *  whole-neuron controls have nothing left to act on. A membrane patch is one
   *  of these already, by having a `frame`; this names the others. */
  presents?: 'axon' | 'synapse' | 'spine'
}

/** Whether arriving at this target puts up a view of its own rather than a
 *  closer look at the scene. Used by the side panels to decide what is worth
 *  showing: out there you can fire an input and pick a part of the neuron, and
 *  in here neither means anything. */
export function isOwnView(target: ZoomTarget | undefined): boolean {
  return target !== undefined && (target.frame !== undefined || target.presents !== undefined)
}

const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Frame for a membrane zoom: a point ON the wall of a process, so the
 *  membrane lands in the middle of the canvas with the outside on one side and
 *  the cytoplasm on the other. */
function membraneFrame(centre: Pt[], halfWidth: number, t: number): WallSample {
  // Prefer the wall whose outside faces up, so "outside" reads above the
  // membrane the way every textbook draws it.
  const upper = wallSample(centre, halfWidth, 1, t)
  return upper.inward.y > 0 ? upper : wallSample(centre, halfWidth, -1, t)
}

/** ⚠ THE HALF-WIDTH THE RIBBON REGISTER USES AT THIS POINT ON A TRUNK — the
 *  low-zoom `taperedRibbon`, NOT the membrane zoom's tube, which draws at the
 *  stroke's constant max width (see `tubeHalfWidthOf`, 21c-8).
 *
 *  A dendrite TAPERS since the trace landed (2026-09-04), and the patch frame
 *  was still being cut with `segs[0].w` — the width at the soma end. At the
 *  patch's own t the drawn branch is thinner, so the frame's wall and the
 *  drawn wall were 0.59 scene pixels apart: nothing at ×1, and 1348 SCREEN
 *  pixels at the membrane view's ×2300, which is why that view arrived on
 *  empty water with no lipids in it (user, 2026-09-04: "dendrite membrane
 *  zoomed in view is missing lipids").
 *
 *  A frame and the drawing it frames must be cut from ONE measurement. The
 *  trunk's own segs are built over its own `path` in order, so the seg that
 *  owns `t` is the seg the drawing puts there. */
export function trunkHalfWidthAt(trunk: DendriteTrunk, t: number): number {
  const path = trunk.path
  const lens = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y))
  let d = clamp01(t) * lens.reduce((a, b) => a + b, 0)
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) return trunk.segs[i].w / 2
    d -= lens[i]
  }
  return trunk.segs[0].w / 2
}

/** Where along the dendrite trunk the patch is cut. */
export const DENDRITE_MEMBRANE_T = 0.3

/** ⚠ THE WIDTH THE MEMBRANE ZOOM ACTUALLY SEES (21c-8, user: "'dendrite
 *  membrane' zoomed view is missing lipids, fix" — the second time this view
 *  has arrived on empty water).
 *
 *  At ×2300 a branch is drawn by `drawProcessTube` at its stroke's MAX width;
 *  the tapered ribbon — whose width `trunkHalfWidthAt` reads — is the LOW-zoom
 *  register, handed over long before the bilayer appears. The 2026-09-04 fix
 *  stated the right rule ("a frame and the drawing it frames must be cut from
 *  ONE measurement") and then measured the wrong drawing: the ribbon, not the
 *  tube. Measured this time at the zoom the frame exists for: the tube's wall
 *  sat 0.56 scene px — 1288 SCREEN px — from the frame cut at the tapered
 *  width. The frame is cut from the tube's own constant. */
export function tubeHalfWidthOf(trunk: DendriteTrunk): number {
  return Math.max(...trunk.segs.map((sg) => sg.w)) / 2
}

const DENDRITE_MEMBRANE = membraneFrame(
  DENDRITE_TRUNKS[1].path,
  tubeHalfWidthOf(DENDRITE_TRUNKS[1]),
  DENDRITE_MEMBRANE_T,
)
/** Where along the axon the membrane patch is cut, 0→1.
 *
 *  Exported because the whole-cell miniature needs it: the ring marking "the
 *  camera is here" has to sit at the same point along the axon that the camera is
 *  actually looking at, and a second 0.55 typed into the panel would be a second
 *  place for it to drift. */
export const AXON_MEMBRANE_T = 0.86
const AXON_MEMBRANE = membraneFrame(AXON_POLYLINE, AXON_W / 2, AXON_MEMBRANE_T)

/** Most tilt a membrane patch is allowed to keep on screen, radians.
 *
 *  A patch inherits the angle of the wall it sits on — 1.3° on the axon, 132° on
 *  a dendrite trunk — and that difference is worth keeping: arriving at a patch
 *  that is plainly slanted says you have come to a particular place on a
 *  particular branch, not to a diagram. But it cannot be kept in full. At 132° the
 *  ion crowd's rectangle no longer matches the screen and the corners empty out,
 *  and a "+" charge mark reads as a multiplication sign. A plus is unmistakably a
 *  plus up to about this much and ambiguous past 30°, so this is the constraint
 *  that sets the cap.
 *
 *  The crowd's extent is derived from the same number (see stage/ions.ts), so the
 *  two cannot drift apart. */
export const MAX_PATCH_TILT = (20 * Math.PI) / 180

/** A membrane is a line, so 132° and −48° are the same slope. Brings a slope into
 *  (−90°, 90°]. */
function wrapSlope(a: number): number {
  let t = a
  while (t > Math.PI / 2) t -= Math.PI
  while (t <= -Math.PI / 2) t += Math.PI
  return t
}

/** How far the camera turns on arriving at this patch, radians: enough to bring
 *  the membrane's tilt within MAX_PATCH_TILT, and no further. The tilt that is
 *  left keeps its direction, so two patches still look different from each other.
 *
 *  This has to mirror what the renderer does on entering a patch, INCLUDING its Y
 *  flip: a flipped frame needs the extra half-turn, or the cytoplasm ends up above
 *  the membrane instead of below it. */
export function patchTurnAngle(frame: WallSample): number {
  const theta = Math.atan2(frame.tangent.y, frame.tangent.x)
  const localY = { x: -frame.tangent.y, y: frame.tangent.x }
  const flipped = frame.inward.x * localY.x + frame.inward.y * localY.y < 0
  // The slope it would have with no turn at all.
  const natural = wrapSlope(flipped ? theta - Math.PI : theta)
  const kept = Math.max(-MAX_PATCH_TILT, Math.min(MAX_PATCH_TILT, natural))
  return kept + (flipped ? Math.PI : 0) - theta
}

export const ZOOM_TARGETS: ZoomTarget[] = [
  {
    id: 'incoming-synapse',
    label: 'Incoming synapse',
    center: mid(INPUTS[1].bouton, INPUTS[1].site),
    scale: 7,
    promise:
      'The gap where an input neuron talks to this one. Vesicles, chemical messengers and the receptors that catch them get built here.',
    roadmap: 'Synapse & neurotransmitter milestones',
  },
  {
    id: 'dendrite-membrane',
    label: 'Dendrite membrane',
    center: DENDRITE_MEMBRANE.at,
    scale: MEMBRANE_ZOOM,
    promise:
      'A patch of dendrite membrane. Receptor channels open here when messengers land, which is what starts a ripple.',
    roadmap: 'Ion-channel milestone',
    content: [
      ...MEMBRANE_FACTS,
      ...ION_FACTS,
      ...PUMP_FACTS,
      ...LEAK_FACTS,
      ...CHANNEL_OVERVIEW,
      ...CHANNELS['voltage-na'].facts,
      ...CHANNELS['voltage-k'].facts,
      ...CHANNELS.ligand.facts,
      ...VOLTAGE_FACTS,
    ],
    frame: DENDRITE_MEMBRANE,
  },
  {
    id: 'hillock',
    label: 'Axon hillock',
    center: HILLOCK,
    scale: 6,
    promise:
      'Where the added-up ripples are tested and an action potential is born. The threshold rule and the voltage trace live here.',
    roadmap: 'Action-potential milestone',
  },
  {
    id: 'axon-membrane',
    label: 'Axon membrane',
    center: AXON_MEMBRANE.at,
    scale: MEMBRANE_ZOOM,
    promise:
      'A patch of axon membrane: the oily bilayer, the sodium and potassium on either side, the pump and the channels. This is where the resting potential comes from.',
    roadmap: 'Membrane & ions milestones',
    content: [
      ...MEMBRANE_FACTS,
      ...ION_FACTS,
      ...PUMP_FACTS,
      ...LEAK_FACTS,
      ...CHANNEL_OVERVIEW,
      ...CHANNELS['voltage-na'].facts,
      ...CHANNELS['voltage-k'].facts,
      ...CHANNELS.ligand.facts,
      ...VOLTAGE_FACTS,
    ],
    frame: AXON_MEMBRANE,
  },
  {
    id: 'axon-signal',
    label: 'Along the axon',
    center: axonPoint(AXON_SIGNAL_T),
    scale: AXON_VIEW_SCALE,
    turn: AXON_SIGNAL_TURN,
    presents: 'axon',
    promise:
      'Follow one signal down the cable and watch how it gets to the far end — which is not by travelling. Every patch of membrane along the way wakes up the next one.',
    roadmap: 'Action-potential milestone',
  },
  {
    id: 'axon-passive',
    label: 'Passive spread',
    center: axonPoint(AXON_PASSIVE_T),
    scale: AXON_VIEW_SCALE,
    turn: AXON_PASSIVE_TURN,
    presents: 'axon',
    promise:
      'What a voltage does with nothing rebuilding it: two stretches of the same cable, one bare and one wrapped, and the same push sent down both.',
    roadmap: 'Cable-theory milestone',
  },
  {
    id: 'outgoing-synapse',
    // ⚠ A VIEW OF ITS OWN AGAIN (2026-08-31, milestone 4 step 20), built on
    // the user's own bouton drawing.
    presents: 'synapse',
    label: 'Outgoing synapse',
    center: mid(OUTGOING.bouton, OUTGOING.tip),
    scale: SYNAPSE_VIEW_SCALE,
    // ⚠ NO TURN AT ALL, and the history that removed it.
    //
    // This synapse used to lie along the scene's x axis — bouton left, target
    // right — while the landed view draws a cleft the textbook way, across
    // the middle with the target below. The camera made up the difference
    // with a quarter turn (+π/2 on a y-down canvas, the sign itself a user
    // correction of 2026-09-01: −π/2 landed the world upside down).
    //
    // The scene now STANDS that way (user, 2026-09-04: the release view "is
    // horizontally aligned, whereas the acting connection on the whole neuron
    // view is vertical"), so the rotation has nothing left to correct. A
    // camera that does not turn is one less thing that is only true after the
    // child has thought about it — and the two pictures now agree before the
    // flight rather than because of it.
    turn: 0,
    promise:
      'Where this neuron stops being electrical. An action potential arrives, calcium doors open, and a packet of chemical crosses a gap to the next cell.',
    roadmap: 'Synapse milestone',
  },
  {
    // ⚠ THE SAME PLACE, DEEPER (user, 2026-09-01: "the same demo, but at the
    // scale in the image"). Not a new view: the synapse view itself keeps
    // running and the camera continues into it, four times closer, framed on
    // the active zone. Same run, same balls, same clock — watched closer.
    // The marker is offset a diameter DOWN the dendrite from the synapse's
    // own marker — the synapse's own axis, now that it stands vertically:
    // two doors at one place need two icons.
    id: 'active-zone',
    presents: 'synapse',
    label: 'Active zone',
    center: {
      x: mid(OUTGOING.bouton, OUTGOING.tip).x + 38,
      y: mid(OUTGOING.bouton, OUTGOING.tip).y + 12,
    },
    scale: SYNAPSE_VIEW_SCALE * 4,
    turn: 0,
    promise:
      'The release machinery at working distance: one calcium door, the vesicles it serves, and the receptors across the gap.',
    roadmap: 'Synapse milestone',
  },
  {
    // ⚠ S13 — THE RECEIVING SIDE, AND THE CAMERA GOES DOWN AS WELL AS IN
    // (user, 2026-09-11: "shift the camera position down, in comparison to
    // 'synapse' view. place dendritic spine in focus"). Everything the other
    // three synapse places show happens in the TERMINAL; this is the first that
    // crosses the gap, so the camera has to leave the bouton behind rather than
    // magnify it.
    id: 'spine',
    // ⚠ A VIEW OF ITS OWN (user, 2026-09-11: "Do not place 'spine' in the same
    // wiev, it represents a different neuron and a different concept"). It
    // re-implements only its FRAME; every membrane, bubble, receptor and ion in
    // it is drawn by the round trip's own code — see `stage/spineScene.ts`.
    presents: 'spine',
    label: 'The receiving spine',
    center: {
      x: mid(OUTGOING.bouton, OUTGOING.tip).x + 38,
      y: mid(OUTGOING.bouton, OUTGOING.tip).y + SPINE_DROP,
    },
    // ⚠ x2.4, SOLVED, NOT CHOSEN (21c-37). The three things this framing has to
    // do — spine dominant, presynaptic membrane visible under the chrome, and
    // the receptors ON SCREEN — pick the magnification between them. Measured
    // across the candidates: at x4 the five receptors span 1365px of a 1060px
    // stage and the outer ones are simply not in the picture; x3 still overruns
    // at 1024px; x2 fits but leaves the spine only 45% of the frame. x2.4 is
    // the only one that does all three, at 819px and 54%.
    scale: SPINE_VIEW_SCALE,
    turn: 0,
    promise:
      'What the message does when it lands: two kinds of receptor, the magnesium that guards one of them, and what it takes to get past it.',
    content: [...SPINE_PARTS, ...SPINE_HONESTY],
    roadmap: 'Synapse milestone',
  },
]

/** How far the camera has arrived within a RANGE of magnifications — 1 inside
 *  [lo, hi], falling off over ARRIVE_DECADES beyond either end. The synapse
 *  view spans two places (the whole synapse and its active zone); a
 *  single-scale band would blink the view out midway between them. */
export function arrivalSpan(scale: number, lo: number, hi: number): number {
  if (scale <= 0 || lo <= 0 || hi <= 0) return 0
  const out = Math.max(0, Math.max(Math.log10(lo / scale), Math.log10(scale / hi)))
  return clamp01(1 - out / ARRIVE_DECADES)
}

/** Radius of a zoom marker on SCREEN (counter-scaled while zoomed). */
export const MARKER_R = 14

/** ⚠ THE ASTROCYTES AMONG THE DENDRITES (user, 2026-09-04: "draw more
 *  astrocytes next to main neuron dendritic arborization"). Scientifically
 *  the right correction: glia are not a decoration of the synapse the app
 *  happens to teach — a protoplasmic astrocyte's territory tiles the whole
 *  neuropil, and the dendritic field is exactly where they are densest. Two
 *  of them at one synapse and nowhere else said the opposite.
 *
 *  Their spots are SOLVED, not placed: a grid over the fan's own bounding
 *  box, keeping only spots that are clear of every dendrite, of the soma and
 *  the axon, of every zoom marker, and inside the stage — then the roomiest
 *  first, each a cell's width from the last. Each reaches to the nearest
 *  point on a dendrite, because that contact is what an astrocyte is for. */
export const DENDRITE_ASTROCYTES: { soma: Pt; r: number; reach: Pt }[] = (() => {
  const R = 21
  const pts: Pt[] = DENDRITE_SEGS.flatMap((s) => [
    { x: s.x1, y: s.y1 },
    { x: s.x2, y: s.y2 },
  ])
  const nearest = (p: Pt) => {
    let bd = Infinity
    let best = pts[0]
    for (const q of pts) {
      const d = Math.hypot(q.x - p.x, q.y - p.y)
      if (d < bd) {
        bd = d
        best = q
      }
    }
    return { d: bd, at: best }
  }
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const cands: { p: Pt; d: number; at: Pt }[] = []
  for (let x = Math.min(...xs) - R; x <= Math.max(...xs) + R; x += 7) {
    for (let y = Math.min(...ys) - R; y <= Math.max(...ys) + R; y += 7) {
      const p = { x, y }
      if (x - R < 10 || x + R > STAGE_W - 10 || y - R < 10 || y + R > STAGE_H - 10) continue
      if (Math.hypot(p.x - SOMA.x, p.y - SOMA.y) < SOMA_R + R + 8) continue
      if (AXON_POLYLINE.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < R + 10)) continue
      if (ZOOM_TARGETS.some((t) => Math.hypot(t.center.x - p.x, t.center.y - p.y) < R + MARKER_R))
        continue
      if (INPUTS.some((n) => n.axon.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < R + 6)))
        continue
      const n = nearest(p)
      // Clear of the branches, yet plainly among them.
      if (n.d < R + 5 || n.d > R * 2.1) continue
      cands.push({ p, d: n.d, at: n.at })
    }
  }
  cands.sort((a, b) => b.d - a.d)
  const out: { soma: Pt; r: number; reach: Pt }[] = []
  for (const c of cands) {
    if (out.every((o) => Math.hypot(o.soma.x - c.p.x, o.soma.y - c.p.y) > R * 3.4)) {
      out.push({ soma: c.p, r: R, reach: c.at })
      if (out.length === 4) break
    }
  }
  return out
})()

// -------------------------------------------------------------------- timing

/** How long a camera move takes. A hop to ×7 and a plunge to ×2400 cannot
 *  share a duration: the length follows how many powers of ten are crossed, so
 *  every zoom feels like the same rate of travel. */
export function cameraDuration(fromScale: number, toScale: number): number {
  const decades = Math.abs(Math.log10(toScale / fromScale))
  return Math.min(3000, 650 + 700 * decades)
}

/** ⚠ THE SCENE'S OWN INK, top to bottom — what a viewport may never crop.
 *
 *  `STAGE_H` follows the browser window, so on a tall screen the scene gains
 *  vertical MARGIN rather than vertical content: the cell, its partners and
 *  the glia occupy a band inside it and the rest is water. An exhibit that has
 *  to fit the scene into a room of a different shape may trim that margin —
 *  and must be able to prove it trimmed only margin, which is what this is
 *  for. (The 2026-08-28 report behind the rule: fitting by width alone
 *  "cropped the bottom off". It cropped CONTENT, because nothing measured
 *  where the content ended.) */
export const SCENE_INK_Y: { min: number; max: number } = (() => {
  const ys = [
    SOMA.y - SOMA_R,
    SOMA.y + SOMA_R,
    ...AXON_POLYLINE.map((p) => p.y),
    ...DENDRITE_SEGS.flatMap((sg) => [sg.y1, sg.y2]),
    ...TERMINALS.flatMap((t) => t.path.map((p) => p.y)),
    ...INPUTS.flatMap((n) => [
      n.soma.y - n.somaR,
      n.soma.y + n.somaR,
      ...n.fan.flat().map((p) => p.y),
    ]),
    OUTPUT.soma.y - OUTPUT.somaR,
    OUTPUT.soma.y + OUTPUT.somaR,
    ...OUTPUT.dendrites.flatMap((d) => d.path.map((p) => p.y)),
    ...[...ASTROCYTES, ...DENDRITE_ASTROCYTES].flatMap((a) => [a.soma.y - a.r, a.soma.y + a.r]),
    ...LABELS.map((l) => l.y),
  ]
  return { min: Math.min(...ys), max: Math.max(...ys) }
})()

// ------------------------------------------------- the whole cell, in miniature

/** Breathing room round the cell in the miniature, in scene units. */
export const MAP_PAD = 14
/** Width-to-height of the miniature. A real compromise: the map panel is
 *  permanent, so every pixel it takes is a pixel the describer below it does not
 *  get. At 2.2 it keeps about five sixths of the dendrite fan — enough that the
 *  shape still reads as a neuron — and costs the column ~136 px. */
export const MAP_ASPECT = 2.2

/** The box the whole-cell miniature is drawn in — scene coordinates.
 *
 *  Measured off the geometry rather than typed in, and it lives here rather than
 *  in the panel because there are now two miniatures: the permanent map at the top
 *  of the column, and the inset on the spike-train bench's graph. Two hand-picked
 *  boxes would be two pictures of the same cell that could drift apart.
 *
 *  Every ZOOM_TARGET centre is inside it by construction. The hand-picked box this
 *  replaces was cropped to the axon's own story and cut the left edge off at the
 *  soma, so the incoming synapse's "you are here" ring would have been drawn
 *  outside the picture. */
export const NEURON_MAP_BOX = (() => {
  // ⚠ THE TARGET CELL IS IN THE PICTURE TOO (user, 2026-09-04: "in 'small
  // neuron' view, add postsynaptic neuron as well, since it's an actor in
  // this demo"). It is the last link of the chain the map lights up, so a map
  // that crops it off is a map of half the story — and the box has to make
  // room for it, or the cell would be drawn outside the sheet.
  const post = [
    { x: OUTPUT.soma.x - OUTPUT.somaR, y: OUTPUT.soma.y - OUTPUT.somaR },
    { x: OUTPUT.soma.x + OUTPUT.somaR, y: OUTPUT.soma.y + OUTPUT.somaR },
    ...OUTPUT.dendrites.flatMap((d) => d.path),
    ...MAP_ASTROCYTES.map((a) => ({ x: a.soma.x, y: a.soma.y + a.r })),
  ]
  const xs = [
    SOMA.x - SOMA_R,
    SOMA.x + SOMA_R,
    ...AXON_POLYLINE.map((p) => p.x),
    ...TERMINALS.map((t) => t.end.x),
    ...DENDRITE_SEGS.flatMap((seg) => [seg.x1, seg.x2]),
    ...ZOOM_TARGETS.map((t) => t.center.x),
    ...post.map((p) => p.x),
  ]
  const ys = [
    SOMA.y - SOMA_R,
    SOMA.y + SOMA_R,
    ...AXON_POLYLINE.map((p) => p.y),
    ...TERMINALS.map((t) => t.end.y),
    ...DENDRITE_SEGS.flatMap((seg) => [seg.y1, seg.y2]),
    ...ZOOM_TARGETS.map((t) => t.center.y),
    ...post.map((p) => p.y),
  ]
  // ⚠ THE BOX IS SOLVED TO CONTAIN ITS CONTENT, at a fixed shape — it is not
  // a fixed shape laid over the content and allowed to crop (2026-09-04).
  // Keeping MAP_ASPECT while taking the width from x alone quietly cut the
  // top and bottom off, which is how the postsynaptic cell ended up drawn
  // outside its own sheet the moment it moved under the arbor. So the width
  // is whichever the two demands need: the cell's own span, or the span the
  // height requires at this aspect.
  const spanX = Math.max(...xs) - Math.min(...xs) + MAP_PAD * 2
  const spanY = Math.max(...ys) - Math.min(...ys) + MAP_PAD * 2
  const width = Math.max(spanX, spanY * MAP_ASPECT)
  const height = width / MAP_ASPECT
  const midX = (Math.min(...xs) + Math.max(...xs)) / 2
  const midY = (Math.min(...ys) + Math.max(...ys)) / 2
  return { minX: midX - width / 2, minY: midY - height / 2, width, height }
})()

/** The parts of the cell a miniature can light up. */
export type NeuronRegion = 'dendrites' | 'soma' | 'hillock' | 'axon' | 'terminals'

/** Where to put a glow for each region, in scene coordinates. More than one point
 *  for the parts that are more than one thing. */
export function regionPoints(region: NeuronRegion): Pt[] {
  switch (region) {
    case 'dendrites':
      return SYNAPSE_TRUNKS.map((trunk) => polylinePoint(DENDRITE_TRUNKS[trunk].path, 0.45))
    case 'soma':
      return [SOMA]
    case 'hillock':
      return [HILLOCK]
    case 'axon':
      return [0.25, 0.5, 0.75].map((t) => axonPoint(t))
    case 'terminals':
      return TERMINALS.map((t) => t.end)
  }
}

/** WHICH DENDRITE TRUNKS CARRY A SIGNAL on a given run.
 *
 *  ⚠ The miniature used to light every synapse-bearing trunk whenever anything
 *  fired, so choosing ONE input made all three dendrites flash (user,
 *  2026-08-28). That is the axon rule one structure earlier: a fan lighting as
 *  a unit says every input arrives whenever any input arrives — and it
 *  contradicts the control the child just used, which offered them a choice
 *  and then ignored it.
 *
 *  `null` means there is no run to ask about (a dendrite zoom, say), and then
 *  the whole fan is the honest answer: the view is about a patch of dendrite
 *  membrane, not about which branch was chosen.
 *
 *  The main canvas already read `run.inputs`; this is the one place that did
 *  not, which is exactly why it lives here now — one function, both readers. */
export function litTrunks(firedInputs: readonly number[] | null): number[] {
  if (firedInputs === null) return [...SYNAPSE_TRUNKS]
  return firedInputs.map((i) => INPUTS[i]?.trunk).filter((t): t is number => t !== undefined)
}

/** Which part of the cell a zoom target sits on, for lighting a miniature. Null
 *  where the target is not a place a spike happens (the synapses get their own
 *  milestones). */
export function regionOfZoom(id: string | null): NeuronRegion | null {
  if (id === 'dendrite-membrane') return 'dendrites'
  if (id === 'axon-membrane' || id === 'axon-signal' || id === 'axon-passive') return 'axon'
  if (id === 'outgoing-synapse' || id === 'active-zone') return 'terminals'
  if (id === 'hillock') return 'hillock'
  return null
}

/** How near the camera has to be to a view's own magnification before that view is
 *  drawn, in decades of scale.
 *
 *  0.3 decades is a factor of two either side, which is exactly the ramp the axon
 *  view used when it only had to worry about being zoomed INTO. */
export const ARRIVE_DECADES = 0.3

/** How far a view of its own has faded in at this camera scale, 0→1.
 *
 *  Measured in DECADES, and from EITHER side, and both of those were bugs.
 *
 *  The old test was `(scale / viewScale - 0.5) / 0.5`, which is a ramp from half the
 *  view's magnification up to it. Approaching from below — zooming in from the whole
 *  cell — that is right. Approaching from ABOVE it is saturated: flying out from a
 *  membrane patch at ×3100 towards the axon at ×14, it read 1.00 for the entire
 *  journey, so the axon view was painted at full strength while the camera was still
 *  at ×2300. What should have been a zoom out was a cross-fade, and the shrinking
 *  membrane the scene was drawing underneath never got to be seen.
 *
 *  Decades rather than a ratio because that is how the camera actually moves: scale
 *  interpolates geometrically, so a fixed number of decades is a fixed portion of the
 *  flight whichever direction it is going and however far it has to travel. */
export function arrivalAt(scale: number, viewScale: number): number {
  if (scale <= 0 || viewScale <= 0) return 0
  return clamp01(1 - Math.abs(Math.log10(scale / viewScale)) / ARRIVE_DECADES)
}

/** Magnification below which the molecular bilayer has completely dissolved.
 *
 *  It used to be a hard switch at BILAYER_SCALE: lipids above it, a plain line
 *  below, nothing in between. Flying out of a membrane patch, a wall made of
 *  molecules therefore vanished in one frame and was replaced by a stroke — which
 *  is what "appears and disappears out of thin air" describes. Magnification does
 *  not work like that; things get smaller until you cannot see them. */
export const BILAYER_FADE_TO = 200

/** How much of the molecular bilayer to show at this magnification, 0→1. */
export function bilayerBlend(scale: number): number {
  if (scale >= BILAYER_SCALE) return 1
  if (scale <= BILAYER_FADE_TO) return 0
  const t = (scale - BILAYER_FADE_TO) / (BILAYER_SCALE - BILAYER_FADE_TO)
  // Smoothstep, so it neither starts nor ends abruptly.
  return t * t * (3 - 2 * t)
}
