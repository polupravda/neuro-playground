// Photographs of the real thing (P-neuro, after the sibling app's P10).
//
// Everything else in this app is DRAWN. These are not: they are images of actual
// tissue, taken down a microscope, and that difference is the whole point of the
// block. A child who has watched a cartoon axon fire should get to see that the
// thing being cartooned exists.
//
// Which means two rules the drawings do not need:
//
//   1. SAY WHAT KIND OF IMAGE IT IS. An electron micrograph is grey because
//      electrons have no colour; a fluorescence image is coloured by whatever dye
//      was used, not by what the tissue looks like. Presenting either as "what it
//      looks like" would be a lie of exactly the kind this app avoids elsewhere,
//      so every entry carries its `kind` and the panel prints it.
//   2. CREDIT AND LICENCE, always, with a link. These are other people's work,
//      used under CC0 or CC BY.
//
// Fetched from the Openverse API (keyless, licence-filtered to CC0/CC BY), then
// normalised to 900 px JPEG in public/real/{id}.jpg. Attribution is transcribed
// from the API records rather than retyped.
//
// ---------------------------------------------------------- where they come from
//
// From INSTITUTIONS AND WIKIMEDIA COMMONS ONLY, and `TRUSTED_ORIGINS` makes that a
// rule the tests enforce rather than a habit anyone has to remember. A first pass
// took two of these from Flickr, where the licence was fine and the provenance was
// a stranger's caption; both were replaced. A photograph in a science app for
// children is a factual claim, and "somebody on a photo site said this was a
// nerve" is not a source. Commons images carry a file page with their own
// provenance and a community that corrects it; Wellcome and the Science Museum
// catalogue theirs.
//
// Still not reviewed by anyone who knows the tissue. Titles matching what is
// visible is a good sign and not a citation, and a specialist eye over the five
// remains worth having — but the sources can now at least be checked.

export type PhotoKind =
  | 'electron micrograph'
  | 'light micrograph'
  | 'fluorescence'
  | 'expansion microscopy'

export interface RealPhoto {
  id: string
  /** What it is, in the fewest words that are still true. */
  caption: string
  /** What kind of picture — never "what it looks like" unless it is. */
  kind: PhotoKind
  /** What to look for in it, tying the photo to what is on screen. */
  look: string
  creator: string
  /** 'CC0' or 'BY', with version. */
  license: string
  source: string
  /** Which collection it came out of. Must be one of TRUSTED_ORIGINS. */
  origin: Origin
}

/** Collections whose provenance can be checked: Wikimedia Commons, where every
 *  file has a page saying where it came from, and catalogued institutional
 *  collections. Photo-sharing sites are deliberately absent — see the note above. */
export const TRUSTED_ORIGINS = [
  'Wikimedia Commons',
  'Wellcome Collection',
  'Science Museum, London',
] as const

export type Origin = (typeof TRUSTED_ORIGINS)[number]

export const REAL_PHOTOS: Record<string, RealPhoto> = {
  myelin: {
    id: 'myelin',
    caption: 'the wraps in a real sheath',
    kind: 'electron micrograph',
    look: 'The dark rings stacked round the middle are the layers themselves — one cell’s membrane, wound round and round. Count them: that is the number the model uses.',
    creator: 'Wellcome Collection',
    license: 'BY 4.0',
    source: 'https://wellcomecollection.org/works/frffcrjd',
    origin: 'Wellcome Collection',
  },
  node: {
    id: 'node',
    caption: 'channels crowded at a real node',
    kind: 'expansion microscopy',
    look: 'The bright band is a stain for potassium channels, and it sits exactly where the gap between two sleeves is. That crowding is the thing the model gives its nodes.',
    creator: 'Kseniia Bondarenko',
    license: 'BY 4.0',
    source: 'https://commons.wikimedia.org/w/index.php?curid=126769026',
    origin: 'Wikimedia Commons',
  },
  'both-fibres': {
    id: 'both-fibres',
    caption: 'both kinds of fibre, in one nerve',
    kind: 'fluorescence',
    look: 'A real nerve carries both: the thick wrapped fibres and the thin bare ones, bundled side by side. The switch above is choosing between these two.',
    creator: 'Valeriia Ustymenko',
    license: 'BY 4.0',
    source: 'https://commons.wikimedia.org/w/index.php?curid=156897840',
    origin: 'Wikimedia Commons',
  },
  'nerve-bundle': {
    id: 'nerve-bundle',
    caption: 'wrapped axons, cut straight across',
    kind: 'electron micrograph',
    look: 'Every dark ring is one axon seen end-on with its sheath around it, and a nerve is a cable of hundreds. The canvas shows a single one of these, opened out lengthways.',
    creator: 'Wellcome Collection',
    license: 'BY 4.0',
    source: 'https://wellcomecollection.org/works/zmmzxhvu',
    origin: 'Wellcome Collection',
  },
  exosomes: {
    id: 'exosomes',
    caption: 'a real cell making bags of membrane',
    kind: 'electron micrograph',
    look: 'The crowds of little rings along the top edge are exosomes — closed bags of membrane, each made of the same double wall as the cell’s own edge — being shed by a real cell. The arrows, the names and the 500 nm bar are the researchers’ own, printed on the image.',
    creator: 'James R. Edgar',
    license: 'BY 4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:A_transmission_electron_micrograph_of_an_Epstein%E2%80%93Barr_virus-transformed_B_cell_displaying_newly_expelled_exosomes_at_the_plasma_membrane.jpg',
    origin: 'Wikimedia Commons',
  },
  'vesicle-pellet': {
    id: 'vesicle-pellet',
    caption: 'membrane bags, fished out of a liquid',
    kind: 'electron micrograph',
    look: 'Each pale ring is one closed bag of membrane collected from human saliva and spun down — the bubble in the small tank, for real, about a hundred nanometres across. Some look dented into cups: that is what drying for the microscope does to a soft bag, not what they look like floating in water.',
    creator: 'Gallo A, Tandon M, Alevizos I, Illei GG',
    license: 'CC0 1.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Confirmation_that_the_ultracentrifugation_pellet_contains_exosomes_cropped.png',
    origin: 'Wikimedia Commons',
  },
  axon: {
    id: 'axon',
    caption: 'a whole neuron, stained black',
    kind: 'light micrograph',
    look: 'A Golgi stain — the method that first showed anyone what a neuron looks like. The blot is the cell body, the bush around it the dendrites, and the long thin line leaving it is the axon.',
    creator: 'Wikimedia Commons contributor',
    license: 'BY 2.5',
    source: 'https://commons.wikimedia.org/w/index.php?curid=2542549',
    origin: 'Wikimedia Commons',
  },
}

/** What is on screen, as far as this block is concerned. */
export interface PhotoContext {
  /** Which zoom target the camera is on, or null for the whole scene. */
  zoom: string | null
  /** Whether the axon on show is wrapped. */
  myelin: boolean
}

/** Which photographs belong to what is currently on screen, best first.
 *
 *  A photograph earns its place by being of something the viewer can SEE right
 *  now — so the list changes when the view does, and the sheath's own pictures
 *  appear only when there is a sheath on screen to compare them with. Wrong-way
 *  round, a block of micrographs would be a gallery bolted to the side of a
 *  simulation rather than part of it.
 *
 *  Only the propagation view is mapped so far. Other views get their own photos
 *  when there are photos worth having: this returns nothing rather than showing a
 *  neuron a child cannot point to on the screen in front of them. */
export function photosFor(ctx: PhotoContext): RealPhoto[] {
  if (ctx.zoom !== 'axon-signal') return []
  const keys = ctx.myelin
    ? ['node', 'myelin', 'both-fibres', 'nerve-bundle', 'axon']
    : ['axon', 'both-fibres', 'nerve-bundle']
  return keys.map((k) => REAL_PHOTOS[k]).filter(Boolean)
}

/** The lipid lab's photographs — real membrane bags, because the lab's own
 *  vesicle is on screen whenever the drawer is open. The purified bags lead:
 *  they are the closest thing to the lab's lone bubble in a tank of water. */
export function photosForLipidLab(): RealPhoto[] {
  return [REAL_PHOTOS['vesicle-pellet'], REAL_PHOTOS.exosomes]
}

/** The line that has to sit near any of these, once, however many are shown. */
export const REAL_PHOTO_NOTE =
  'Everything else here is drawn. These are photographs of real tissue down a microscope — which is why they are grey or oddly coloured: an electron microscope has no colours to work with, and a fluorescence picture is coloured by the dye somebody chose, not by what the tissue looks like to the eye.'
