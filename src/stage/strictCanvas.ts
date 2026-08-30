// A stand-in canvas context for tests that FAILS WHERE A REAL ONE FAILS.
//
// The permissive mock this replaces accepted everything, and that is exactly why it
// could not catch the bug it was written to catch. `mix` was handing back
// `rgb(NaN, NaN, NaN)` for any colour that was not hexadecimal. As a `fillStyle`
// that is silently ignored by the spec, so it went unnoticed for months — and the
// first time such a string reached `addColorStop`, which THROWS on a colour it
// cannot parse, it took down the scene function, and the scene function took the
// Konva animation down with it. A frozen camera, a blank view, and a dead button,
// all from one bad colour.
//
// So this one checks the two things a browser checks and a noop cannot:
//
//   • every colour handed to addColorStop, fillStyle or strokeStyle parses;
//   • no radius or gradient is given a negative or non-finite size.
//
// It is deliberately strict about NaN everywhere. A NaN coordinate does not throw in
// a browser — it silently draws nothing, which is the hardest kind of blank screen
// to diagnose.

const COLOUR = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)$/i

function checkColour(where: string, value: unknown): void {
  if (typeof value !== 'string') return
  if (!COLOUR.test(value.trim())) throw new Error(`${where}: cannot parse colour "${value}"`)
  if (/NaN|undefined/.test(value)) throw new Error(`${where}: colour contains NaN — "${value}"`)
}

function checkNumbers(where: string, args: unknown[]): void {
  args.forEach((a, i) => {
    if (typeof a === 'number' && !Number.isFinite(a)) {
      throw new Error(`${where}: argument ${i} is ${a}`)
    }
  })
}

export interface StrictCanvas {
  ctx: CanvasRenderingContext2D
  calls: string[]
  /** Every path vertex asked for, in DEVICE coordinates — the current
   *  transform already applied.
   *
   *  It is here so a test can ask the one question a list of method names
   *  cannot answer: did this thing MOVE smoothly, or did it jump? Several of
   *  this app's drawings come from sources that give a part twice, in its two
   *  end positions, and drawing those two positions is not an animation. The
   *  only way to catch that is to compare where the shape actually landed from
   *  one frame to the next — and it has to be in device coordinates, because
   *  a part that moves by having the whole context translated under it looks
   *  perfectly still in its own local frame. */
  points: Array<{ x: number; y: number }>
}

/** A context that records what it was asked to do and complains about anything a
 *  browser would complain about. */
/** A stand-in for `getTransform`, tracked well enough for the one thing the
 *  scene asks it: how much the layer is magnified, so screen-space chrome can
 *  be counter-scaled. It is not a full matrix stack — it is honest about
 *  scale and rotation, which is what `Math.hypot(m.a, m.b)` reads.
 *
 *  It exists because a stand-in must fail where the real thing fails, and it
 *  was failing where the real thing does NOT: `drawScene` at a real camera
 *  threw "getTransform is not a function" on a context a browser is perfectly
 *  happy with (2026-08-28). A missing method is not strictness. */
interface Matrix {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export function strictCanvas(): StrictCanvas {
  const calls: string[] = []
  let m: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  const stack: Matrix[] = []
  const gradient = {
    addColorStop: (offset: number, colour: string) => {
      checkNumbers('addColorStop', [offset])
      checkColour('addColorStop', colour)
    },
  }

  const methods: Record<string, (...args: unknown[]) => unknown> = {}
  const points: Array<{ x: number; y: number }> = []
  /** Through the current transform, so a caller sees where the ink went. */
  const put = (x: number, y: number) => {
    points.push({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f })
  }
  /** How many leading arguments of this call are an (x, y) pair. */
  const VERTICES: Record<string, number> = {
    moveTo: 1, lineTo: 1, rect: 1, arc: 1, roundRect: 1,
    quadraticCurveTo: 2, bezierCurveTo: 3,
  }
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      checkNumbers(name, args)
      for (let i = 0; i < (VERTICES[name] ?? 0); i++) {
        put(args[i * 2] as number, args[i * 2 + 1] as number)
      }
      calls.push(name)
      return undefined
    }
  for (const name of [
    'beginPath', 'closePath', 'moveTo', 'lineTo', 'rect',
    'fill', 'stroke', 'fillRect', 'clearRect', 'strokeRect', 'fillText',
    'strokeText', 'clip',
    'setLineDash', 'quadraticCurveTo', 'bezierCurveTo',
  ]) {
    methods[name] = record(name)
  }

  // The transform, tracked. Only scale and rotation are followed with any
  // care, because that is what `getTransform` is asked for here.
  methods.save = (...args: unknown[]) => {
    checkNumbers('save', args)
    stack.push({ ...m })
    calls.push('save')
  }
  methods.restore = (...args: unknown[]) => {
    checkNumbers('restore', args)
    m = stack.pop() ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    calls.push('restore')
  }
  methods.translate = (...args: unknown[]) => {
    checkNumbers('translate', args)
    const [x, y] = args as [number, number]
    m = { ...m, e: m.e + m.a * x + m.c * y, f: m.f + m.b * x + m.d * y }
    calls.push('translate')
  }
  methods.scale = (...args: unknown[]) => {
    checkNumbers('scale', args)
    const [x, y] = args as [number, number]
    m = { ...m, a: m.a * x, b: m.b * x, c: m.c * y, d: m.d * y }
    calls.push('scale')
  }
  methods.rotate = (...args: unknown[]) => {
    checkNumbers('rotate', args)
    const [r] = args as [number]
    const cos = Math.cos(r)
    const sin = Math.sin(r)
    m = {
      ...m,
      a: m.a * cos + m.c * sin,
      b: m.b * cos + m.d * sin,
      c: m.c * cos - m.a * sin,
      d: m.d * cos - m.b * sin,
    }
    calls.push('rotate')
  }
  methods.setTransform = (...args: unknown[]) => {
    checkNumbers('setTransform', args)
    const [a, b, c, d, e, f] = args as number[]
    if (typeof a === 'number') m = { a, b, c, d, e, f }
    calls.push('setTransform')
  }
  methods.getTransform = () => ({ ...m })
  // Radii must be non-negative — a browser throws IndexSizeError, and a silent
  // mock turns that into a shape that simply never appears.
  methods.arc = (...args: unknown[]) => {
    checkNumbers('arc', args)
    if ((args[2] as number) < 0) throw new Error(`arc: negative radius ${args[2]}`)
    put(args[0] as number, args[1] as number)
    calls.push('arc')
  }
  methods.arcTo = record('arcTo')
  methods.ellipse = record('ellipse')
  // Rounded rects throw in a browser on a negative size or radius.
  methods.roundRect = (...args: unknown[]) => {
    checkNumbers('roundRect', args)
    if ((args[2] as number) < 0 || (args[3] as number) < 0) {
      throw new Error('roundRect: negative size')
    }
    put(args[0] as number, args[1] as number)
    calls.push('roundRect')
  }
  methods.createRadialGradient = (...args: unknown[]) => {
    checkNumbers('createRadialGradient', args)
    if ((args[2] as number) < 0 || (args[5] as number) < 0) {
      throw new Error('createRadialGradient: negative radius')
    }
    calls.push('createRadialGradient')
    return gradient
  }
  methods.createLinearGradient = (...args: unknown[]) => {
    checkNumbers('createLinearGradient', args)
    calls.push('createLinearGradient')
    return gradient
  }
  methods.measureText = () => ({ width: 10 })

  const state: Record<string, unknown> = { globalAlpha: 1 }
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        if (prop in methods) return methods[prop]
        if (prop === 'canvas') return { width: 1000, height: 800 }
        return state[prop]
      },
      set: (_t, prop: string, value: unknown) => {
        if (prop === 'fillStyle' || prop === 'strokeStyle') checkColour(prop, value)
        if (prop === 'globalAlpha' && typeof value === 'number' && !Number.isFinite(value)) {
          throw new Error('globalAlpha is NaN')
        }
        state[prop] = value
        return true
      },
    },
  ) as unknown as CanvasRenderingContext2D

  return { ctx, calls, points }
}
