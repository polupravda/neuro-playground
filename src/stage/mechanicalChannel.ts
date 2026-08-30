import { makeSeparating } from './separatingChannel'

// THE MECHANICALLY-GATED CHANNEL, traced from the user's drawing (2026-08-30).
//
// Its two states carry the same motion as the ligand-gated one — the subunits
// separate, by the same measured 8 units — but a DIFFERENT SILHOUETTE: the
// subunits have flared shoulders and splayed feet where the ligand-gated one
// has a notch and a straight foot. Which is why it gets its own outline rather
// than a relabelled copy: two doors that open the same way can still be two
// different doors, and the child is being asked to tell them apart.
//
// What makes it mechanical is not in this file. It is that nothing here opens
// it — no charge, no messenger. The MEMBRANE around it is pushed, and the pull
// in the sheet is what parts the subunits. So the drawing has no gate, no
// sensor, and no socket; the cause is drawn in the bilayer beside it.

const PATHS = {
  back: 'm14-11.49c-1.66-0.14-4.41 0.2-6.35 3.34-2.96 4.8 0.78 5.98 0.63 10.73-0.16 4.75-2.13 4.48-1.99 15.62 0.13 11.14 4.09 11.9 4.09 20.24 0 8.34 0.63 7.1 0.63 7.1 0 0 1.19 0.93 2.71 1.46 0 0-4.94-2.45-8.31-2.45-3.36 0-7.81 2.45-7.81 2.45 1.52-0.53 2.71-1.46 2.71-1.46 0 0 0.63 1.24 0.63-7.1 0-8.34 3.96-9.1 4.1-20.24 0.13-11.14-1.84-10.87-2-15.62-0.15-4.75 3.6-5.93 0.63-10.73-2.07-3.36-5.06-3.51-6.67-3.3 0 0 2.32-1.01 3.88-0.26 1.57 0.75 2.2 2.32 4.69 2.23 2.49-0.09 3.34-1.19 5-2.02 1.66-0.83 3.43 0.01 3.43 0.01z',
  left: 'm-4.53-11.33c1.65-0.13 6.26-0.39 8.2 3.18 2.69 4.96-0.78 5.98-0.63 10.73 0.16 4.75 2.13 4.48 2 15.62-0.14 11.14-4.1 11.9-4.1 20.24 0 8.34-0.63 7.1-0.63 7.1 0 0-4.92 3.82-7.57 0.41-2.65-3.42-2.71-7.49-1.47-10.3 1.24-2.81 2.53-7.52 2.53-12.65 0-5.13-5.54-12.54-6.28-17.9-0.74-5.36 0.48-11.05 0.48-11.05 0.78-3.27 3.45-5.07 7.47-5.38z',
  right: 'm15.85-11.33c-1.65-0.13-6.26-0.39-8.2 3.18-2.69 4.96 0.78 5.98 0.63 10.73-0.16 4.75-2.13 4.48-1.99 15.62 0.13 11.14 4.09 11.9 4.09 20.24 0 8.34 0.63 7.1 0.63 7.1 0 0 4.92 3.82 7.57 0.41 2.65-3.42 2.71-7.49 1.47-10.3-1.24-2.81-2.53-7.52-2.53-12.65 0-5.13 5.54-12.54 6.28-17.9 0.74-5.36-0.48-11.05-0.48-11.05-0.78-3.27-3.45-5.07-7.47-5.38z',
  // No `seat`: nothing binds here. Leaving it off is what makes `socket: true`
  // impossible to switch on by accident.
}

const CHANNEL = makeSeparating(PATHS)

export const drawMechanicalChannel = CHANNEL.draw
export const mechanicalHalfWidth = CHANNEL.halfWidth
