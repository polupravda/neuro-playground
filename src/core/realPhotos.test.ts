import { describe, expect, it } from 'vitest'
import {
  REAL_PHOTOS,
  REAL_PHOTO_NOTE,
  TRUSTED_ORIGINS,
  photosFor,
  photosForLipidLab,
} from './realPhotos'

// The image files, found by Vite rather than by the filesystem — this project has
// no Node types and does not need them for one assertion.
const FILES = import.meta.glob('../../public/real/*.jpg', { eager: true, query: '?url' })
const NAMES = new Set(
  Object.keys(FILES).map((path) => path.split('/').pop()!.replace('.jpg', '')),
)

const ALL = Object.values(REAL_PHOTOS)

describe('the photographs themselves', () => {
  it('has a file for every entry, and no file without one', () => {
    // A manifest entry with no image is a broken picture in a panel whose whole
    // point is that the thing is real; a file with no entry is an image shown
    // with nobody credited for it.
    expect(NAMES.size).toBeGreaterThan(0)
    for (const photo of ALL) expect(NAMES.has(photo.id), photo.id).toBe(true)
    for (const name of NAMES) expect(REAL_PHOTOS[name], name).toBeDefined()
  })

  it('keys itself consistently, so the file name cannot drift from the entry', () => {
    for (const [key, photo] of Object.entries(REAL_PHOTOS)) expect(photo.id).toBe(key)
  })

  it('comes only from a collection whose provenance can be checked', () => {
    // The rule, enforced rather than remembered. A first pass took two of these
    // from a photo-sharing site: the licence was fine and the provenance was a
    // stranger's caption. In a science app for children a photograph is a factual
    // claim, and "somebody said this was a nerve" is not a source. Wikimedia files
    // carry a page saying where they came from; institutions catalogue theirs.
    for (const photo of ALL) {
      expect(TRUSTED_ORIGINS, photo.id).toContain(photo.origin)
    }
  })

  it('links to the collection it claims to come from', () => {
    // An origin that does not match the link would be the label doing no work.
    const host: Record<string, string> = {
      'Wikimedia Commons': 'commons.wikimedia.org',
      'Wellcome Collection': 'wellcomecollection.org',
      'Science Museum, London': 'sciencemuseumgroup.org.uk',
    }
    for (const photo of ALL) {
      expect(photo.source, photo.id).toContain(host[photo.origin])
    }
  })

  it('credits somebody, under a licence, with a link — every one', () => {
    // These are other people's work. Attribution is not a nicety here, it is the
    // condition of use.
    for (const photo of ALL) {
      expect(photo.creator.length).toBeGreaterThan(2)
      expect(photo.license).toMatch(/^(CC0|BY)/)
      expect(photo.source).toMatch(/^https:\/\//)
    }
  })

  it('says what kind of picture each one is, and never calls it a plain photo', () => {
    // The honesty rule this block needs and the drawings do not: an electron
    // micrograph is grey because electrons have no colour, and a fluorescence
    // image is coloured by the dye somebody chose. Either passed off as "what it
    // looks like" would be the sort of claim this app refuses everywhere else.
    for (const photo of ALL) {
      expect(photo.kind.length).toBeGreaterThan(3)
      expect(photo.caption.toLowerCase()).not.toMatch(/what it looks like/)
      expect(photo.look.length).toBeGreaterThan(40)
    }
    expect(REAL_PHOTO_NOTE).toMatch(/electron microscope has no colours/)
    expect(REAL_PHOTO_NOTE).toMatch(/Everything else here is drawn/)
  })
})

describe('which photographs belong to what is on screen', () => {
  it('shows nothing where there is nothing to be a photograph of', () => {
    // Better an absent block than a micrograph of something the viewer cannot
    // point to on the screen in front of them.
    expect(photosFor({ zoom: null, myelin: false })).toEqual([])
    expect(photosFor({ zoom: 'axon-membrane', myelin: true })).toEqual([])
    expect(photosFor({ zoom: 'incoming-synapse', myelin: false })).toEqual([])
  })

  it('brings the sheath’s own pictures out only when there is a sheath on screen', () => {
    const bare = photosFor({ zoom: 'axon-signal', myelin: false }).map((p) => p.id)
    const wrapped = photosFor({ zoom: 'axon-signal', myelin: true }).map((p) => p.id)
    expect(bare).not.toContain('myelin')
    expect(bare).not.toContain('node')
    expect(wrapped).toContain('myelin')
    expect(wrapped).toContain('node')
  })

  it('leads with the picture of whatever the view is about', () => {
    // Wrap the axon and the sheath should be the photo you are looking at, not
    // the one that happened to be open.
    // The node leads: it is the one photograph that shows the feature itself —
    // real channels, crowded into a real gap — which is what the sheathed view is
    // about. The sheath's own layers come second.
    expect(photosFor({ zoom: 'axon-signal', myelin: true })[0].id).toBe('node')
    expect(photosFor({ zoom: 'axon-signal', myelin: false })[0].id).toBe('axon')
  })

  it('never offers an entry it has no image for', () => {
    for (const myelin of [false, true]) {
      for (const photo of photosFor({ zoom: 'axon-signal', myelin })) {
        expect(REAL_PHOTOS[photo.id]).toBeDefined()
      }
    }
  })

  it('gives the lipid lab real membrane bags, purified ones first', () => {
    // The drawer always has a vesicle on screen, so its photographs always have
    // something to be photographs of — and the isolated bags in liquid lead,
    // because they are the closest thing to the lab's own lone bubble.
    const lab = photosForLipidLab()
    expect(lab.length).toBeGreaterThanOrEqual(2)
    expect(lab[0].id).toBe('vesicle-pellet')
    for (const photo of lab) expect(REAL_PHOTOS[photo.id]).toBeDefined()
  })
})
