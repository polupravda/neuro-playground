import { create } from 'zustand'

// Which exhibit the membrane view is showing.
//
// Two kinds of exhibit, and the difference is what they CLAIM TO BE. An on-canvas
// demo is the neuron doing something — the spike. A drawer exhibit is a thought
// experiment about membranes, so it slides in over the scene instead of replacing
// it, and the canvas never stops being the neuron.
//
// The clamp demo that used to live here is gone. It offered a voltage slider
// beside concentration sliders, which the app elsewhere teaches are coupled — two
// knobs on coupled quantities read as a contradiction even when the physics is
// fine, and it never showed the one idea worth showing: that an ion is pushed by
// crowding AND charge, and its Nernst voltage is where those cancel. The balance
// bench replaces it, in a drawer, where a battery holding four separate patches
// is an honest picture rather than unexplained magic.
//
// What does NOT change with an on-canvas demo: the cell. The concentrations, the
// pump and the leaks are the membrane's own state. The bench is the exception and
// keeps its own, because a lab bench must not reach into the cell it teaches
// about.

export type DemoId =
  | 'spike'
  | 'balance'
  | 'train'
  | 'lipid'
  | 'permea'
  | 'capacitor'
  | 'channel'
  | 'gating'
  | 'patch'
  | 'resting'
  | 'leaky'
  | 'snare'

/** The exhibits that take over the canvas. All of the others open a drawer, and
 *  typing that distinction stops a drawer exhibit ever being set as the canvas's
 *  mode by accident — which would blank the neuron. */
export type CanvasDemoId = Exclude<
  DemoId,
  | 'balance'
  | 'train'
  | 'lipid'
  | 'permea'
  | 'capacitor'
  | 'channel'
  | 'gating'
  | 'patch'
  | 'resting'
  | 'leaky'
  | 'snare'
>

export interface Demo {
  id: DemoId
  /** Named for the scientific concept it demos, addressed to the adult
   *  (03-architecture → *Who reads what*); the icon carries it for the kid,
   *  so each exhibit gets its own rather than a shared 🔬. */
  name: string
  icon: string
  /** The question this exhibit answers. */
  asks: string
  /** True when this exhibit is a thought experiment rather than a view of the
   *  neuron, and therefore opens in a drawer with the scene left untouched
   *  underneath. See "the scene is the world" in the architecture notes.
   *
   *  Propagation is NOT in this list, though it opens a drawer too. An exhibit
   *  here answers "what else can this patch of membrane show me", and the answer
   *  is about a length of axon rather than about this patch — so it is reached
   *  from a marker on the axon itself, where a child can see which part of the
   *  neuron is being talked about. A word in a list cannot point at anything. */
  drawer?: boolean
  /** ⚠ WHICH VIEW'S CHROME THIS DRAWER BELONGS TO (2026-08-31). A drawer is
   *  "triggered from the view it extends", and until now every one of them
   *  extended the membrane patch, so the patch's shelf could simply be "all the
   *  drawers". D06 extends the SYNAPSE — its door is the magnifier beside the
   *  active zone — so the shelf needs to know which drawers are its own rather
   *  than claiming every drawer in the app. */
  home?: 'membrane' | 'synapse'
}

export const DEMOS: Demo[] = [
  {
    id: 'resting',
    name: 'What sets the membrane voltage',
    icon: '🪑',
    asks: 'Build a wall out of doors and see where the voltage settles.',
    drawer: true,
  },
  {
    id: 'leaky',
    // ⚠ THE NAME THE CONTENTS USES (user, 2026-08-30: "we've agreed to use
    // more precise terms; 'how far a signal can reach' is not the one"). The
    // menu was renamed and this was not, so the same exhibit had two names.
    name: 'Passive spread & the length constant',
    icon: '🫗',
    asks: 'Why a voltage fades as it spreads, and what myelin changes.',
    // ⚠ NOT A DRAWER ANY MORE (user, 2026-08-31), for exactly the reason
    // written above `drawer`: this exhibit is about a length of axon rather
    // than about the patch you would open it from, so it is reached from a
    // marker on the axon itself. It has joined propagation on that side.
  },
  {
    id: 'snare',
    name: 'Vesicles & the SNARE machinery',
    icon: '🫧',
    asks: 'How a bubble of chemical gets out of the cell, and what pulls it in.',
    drawer: true,
    home: 'synapse',
  },
  {
    id: 'spike',
    name: 'Fire an action potential',
    icon: '⚡',
    asks: 'What happens, step by step, when a spike runs?',
  },
  {
    id: 'balance',
    name: 'Equilibrium potential',
    icon: '⚖️',
    asks: 'Find the voltage at which an ion stops caring about its own crowd.',
    drawer: true,
  },
  {
    id: 'train',
    name: 'Spike trains & refractory period',
    icon: '📈',
    asks: 'Push it as often as you like, and watch the line answer every push.',
    drawer: true,
  },
  {
    id: 'lipid',
    name: 'Phospholipid bilayer',
    icon: '🫧',
    asks: 'What is this wall actually made of — and what holds it together with no glue?',
    drawer: true,
  },
  {
    id: 'permea',
    name: 'Membrane permeability',
    icon: '🫗',
    asks: 'What gets through a bare lipid wall — and what decides?',
    drawer: true,
  },
  {
    // What actually opens a door — the word "gated" made watchable.
    id: 'gating',
    name: 'Ion channel types',
    icon: '🎛️',
    asks: 'What actually makes a door in the wall open?',
    drawer: true,
  },
  {
    // The patch clamp is ABOUT a patch of membrane, so it belongs on the
    // patch's own shelf. Its only other door out on the picture is the
    // magnifier on the probe INSIDE the spike-train bench — which is a door
    // nobody finds unless they are already there (user, 2026-08-28).
    id: 'patch',
    name: 'Patch clamp recording',
    icon: '🔬',
    asks: 'How does anybody know any of this is true?',
    drawer: true,
  },
  {
    id: 'channel',
    name: 'Ion channel structure',
    icon: '🚪',
    asks: 'What is a channel actually built out of, and how is it so picky?',
    drawer: true,
  },
  {
    id: 'capacitor',
    name: 'Membrane charge',
    icon: '🧲',
    asks: 'How few ions does it take to make the voltage?',
    drawer: true,
  },
]

// The bench above carries what used to be TWO controls on the canvas: the weak
// stimulus beside the ⚡ button, and the paired-pulse slider. Both were removed
// rather than moved, because both were unreadable in place — a push that does
// nothing has nothing to draw on a view built out of doors and crowds, and a gap
// in milliseconds is a quantity no child has a feel for. Neither problem survives
// being put on a time axis, which is why the bench exists.

interface DemoState {
  /** Which ON-CANVAS exhibit is showing. A drawer exhibit does not change this:
   *  the canvas keeps being the neuron while a drawer is thinking about it. */
  demo: CanvasDemoId
  setDemo: (demo: CanvasDemoId) => void
}

export const useDemoStore = create<DemoState>((set) => ({
  demo: 'spike',
  setDemo: (demo) => set({ demo }),
}))
