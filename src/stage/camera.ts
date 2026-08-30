import { AXON_W, STAGE_H, STAGE_W, ZOOM_TARGETS, patchTurnAngle } from './layout'
import { ribbonGeometry } from './axonRibbon'

// THE CAMERA — where it is, and what it can see.
//
// Lifted out of `NeuronStage` (2026-08-28) because a second caller appeared:
// the "one signal, three sizes" exhibit draws the REAL SCENE at two of its
// camera positions rather than inventing pictures of its own, and a second
// copy of this arithmetic would be a second thing to keep true.

/** The camera is a scene point held in the middle of the canvas, at a
 *  magnification. Keeping it in scene coordinates (rather than as a layer
 *  offset) is what lets the zoom interpolate sensibly. */
export interface Camera {
  center: { x: number; y: number }
  /** How far below the middle of the canvas that point is held, px.
   *
   *  Zero everywhere but the propagation view, which lays itself out from the
   *  bottom of the canvas up and so wants its axon low rather than centred.
   *  Without this the scene's axon and the view's axon sit in different places
   *  and the hand-over between them is a jump. */
  drop: number
  scale: number
  /** Radians. Non-zero only for a membrane patch, where the camera turns part of
   *  the way towards the membrane — see patchTurnAngle for why only part. */
  angle: number
}

export const FIT: Camera = {
  center: { x: STAGE_W / 2, y: STAGE_H / 2 },
  drop: 0,
  scale: 1,
  angle: 0,
}

/** Where the propagation view puts its axon, as an offset from the middle of the
 *  canvas — asked of the view itself rather than guessed, so the two cannot
 *  drift apart. */
function axonDrop(scale: number): number {
  return ribbonGeometry(STAGE_W, STAGE_H, AXON_W * scale).tubeMid - STAGE_H / 2
}

export function cameraFor(id: string | null): Camera {
  const target = ZOOM_TARGETS.find((t) => t.id === id)
  if (!target) return FIT
  return {
    center: target.center,
    drop: target.presents === 'axon' ? axonDrop(target.scale) : 0,
    scale: target.scale,
    angle: target.frame ? patchTurnAngle(target.frame) : (target.turn ?? 0),
  }
}

/** What the camera can see, in scene coordinates. */
export function viewRect(camera: Camera) {
  const c = Math.abs(Math.cos(camera.angle))
  const s = Math.abs(Math.sin(camera.angle))
  const halfW = (c * STAGE_W + s * STAGE_H) / (2 * camera.scale)
  const halfH = (s * STAGE_W + c * STAGE_H) / (2 * camera.scale)
  return {
    left: camera.center.x - halfW,
    right: camera.center.x + halfW,
    top: camera.center.y - halfH,
    bottom: camera.center.y + halfH,
  }
}
