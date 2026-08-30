import { REAL_PHOTO_NOTE, photosFor, type RealPhoto } from '../core/realPhotos'
import { useAxonStore } from '../state/axonStore'
import { useNeuronStore } from '../state/neuronStore'

// "The real thing" — photographs of the tissue the simulation is drawing.
//
// The block appears when there is something on screen it can be a photograph OF,
// and its contents change with the view: wrap the axon and the sheath's own
// pictures arrive. That coupling is the point. A gallery that sat there regardless
// would be a picture book bolted to the side of a simulation; this is meant to
// answer "is any of this actually like that?" at the moment the question occurs.
//
// All of them stacked and scrolled, the way the sibling app's molecule photos are.
// A first version showed one at a time behind a row of buttons, which is fewer
// pixels and worse: the pictures are a set — the wraps, a node, both kinds of
// fibre, a whole cell — and their point is partly in seeing them together. Nobody
// clicks through a tab strip to find that out.

export function RealPhotoPanel() {
  const zoom = useNeuronStore((s) => s.zoom)
  // The race counts as sheathed here: both fibres are on screen, so the sheath's
  // own photographs have something to be photographs of.
  const myelin = useAxonStore((s) => s.mode) !== 'bare'
  const photos = photosFor({ zoom, myelin })
  if (photos.length === 0) return null
  return <RealPhotoBlock photos={photos} />
}

/** The figures themselves — the shared internals of RealPhotoBlock. Not for
 *  placing inside an info block: THE PHOTO BLOCK IS A SIBLING OF THE INFO
 *  BLOCK, never its child (user ruling, 27c, after four asks). */
export function PhotoFigures({
  photos,
  imgClass = 'h-44',
}: {
  photos: RealPhoto[]
  imgClass?: string
}) {
  return (
    <>
      {photos.map((photo) => (
        <figure key={photo.id} className="mb-4">
          <img
            src={`${import.meta.env.BASE_URL}real/${photo.id}.jpg`}
            alt={`${photo.caption} — ${photo.kind}`}
            loading="lazy"
            className={`${imgClass} w-full rounded-xl border border-slate-700 bg-slate-950 object-cover`}
          />
          <figcaption className="mt-1 px-0.5">
            <p className="text-[13px] leading-snug text-slate-200">
              {photo.caption} <span className="text-slate-500">· {photo.kind}</span>
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-slate-400">{photo.look}</p>
            {/* Somebody else took this and let us use it. Say who, out of which
                collection, under what, and link back — every time, not once in a
                credits screen. The collection is named because it is the part
                that can be checked. */}
            <p className="mt-1 text-right text-[9px] leading-snug text-slate-500">
              <a
                href={photo.source}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-slate-300"
              >
                {photo.creator}
              </a>{' '}
              · {photo.origin} ({photo.license})
            </p>
          </figcaption>
        </figure>
      ))}
      <p className="border-t border-slate-700/60 px-0.5 pt-1.5 text-[11px] leading-snug text-slate-500">
        {REAL_PHOTO_NOTE}
      </p>
    </>
  )
}

/** The photo panel, everywhere: its own bordered box with its own scroll,
 *  standing BESIDE the info block as a sibling — in the main column and in
 *  every drawer alike. */
export function RealPhotoBlock({ photos }: { photos: RealPhoto[] }) {
  return (
    <div className="flex max-h-[42vh] shrink-0 flex-col rounded-xl border border-slate-700 bg-slate-800/60 p-2">
      <h3 className="mb-1.5 shrink-0 px-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        The real thing
      </h3>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        <PhotoFigures photos={photos} imgClass="h-36" />
      </div>
    </div>
  )
}
