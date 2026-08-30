import { makeSeparating, SEPARATION } from './separatingChannel'

// THE LIGAND-GATED CHANNEL, traced from the user's drawing (2026-08-29).
//
// Two states, and it opens the way a real ligand-gated receptor does: the
// SUBUNITS THEMSELVES MOVE APART. No flap swings and nothing plugs — which is
// a different machine from the voltage-gated channel beside it, and the reason
// this bench draws each family rather than relabelling one picture.
//
// The motion lives in `separatingChannel`; what is here is the outline and
// where a messenger binds.

const PATHS = {
  back: 'm14-10.49c-1.66-0.14-4.41 0.2-6.35 3.34-2.96 4.8 0.78 5.98 0.63 10.73-0.16 4.75-2.13 4.48-1.99 15.62 0.13 11.14 4.09 11.9 4.09 20.24 0 8.34 0.63 7.1 0.63 7.1 0 0 1.19 0.93 2.71 1.46 0 0-4.94-2.45-8.31-2.45-3.36 0-7.81 2.45-7.81 2.45 1.52-0.53 2.71-1.46 2.71-1.46 0 0 0.63 1.24 0.63-7.1 0-8.34 3.96-9.1 4.1-20.24 0.13-11.14-1.84-10.87-2-15.62-0.15-4.75 3.6-5.93 0.63-10.73-2.07-3.36-5.06-3.51-6.67-3.3 0 0 2.32-1.01 3.88-0.26 1.57 0.75 2.2 2.32 4.69 2.23 2.49-0.09 3.34-1.19 5-2.02 1.66-0.83 3.43 0.01 3.43 0.01z',
  left: 'm-4.12-10.21c0 0 4.83-1.73 7.79 3.06 2.97 4.8-0.78 5.98-0.63 10.73 0.16 4.75 2.13 4.48 2 15.62-0.14 11.14-4.1 11.9-4.1 20.24 0 8.34-0.63 7.1-0.63 7.1 0 0-4.92 3.82-7.57 0.41-2.65-3.42-2.71-7.49-1.47-10.3 1.24-2.81 2.53-7.52 2.53-12.65 0-5.13-5.54-12.54-6.28-17.9-0.74-5.36 0.48-11.05 0.48-11.05 0 0 3.62 0.95 5.66-0.41 2.04-1.36 2.22-4.85 2.22-4.85z',
  right: 'm15.44-10.21c0 0-4.83-1.73-7.79 3.06-2.96 4.8 0.78 5.98 0.63 10.73-0.16 4.75-2.13 4.48-1.99 15.62 0.13 11.14 4.09 11.9 4.09 20.24 0 8.34 0.63 7.1 0.63 7.1 0 0 4.92 3.82 7.57 0.41 2.65-3.42 2.71-7.49 1.47-10.3-1.24-2.81-2.53-7.52-2.53-12.65 0-5.13 5.54-12.54 6.28-17.9 0.74-5.36-0.48-11.05-0.48-11.05 0 0-3.62 0.95-5.66-0.41-2.04-1.36-2.22-4.85-2.22-4.85z',
  /** The binding site, on the extracellular mouth of the left subunit — so it
   *  travels outward as the channel opens. */
  seat: { x: -4.5, y: -8, r: 3.4 },
}

const CHANNEL = makeSeparating(PATHS)

export { SEPARATION }
export const drawLigandChannel = CHANNEL.draw
export const ligandHalfWidth = CHANNEL.halfWidth
export const ligandSeat = CHANNEL.seat
