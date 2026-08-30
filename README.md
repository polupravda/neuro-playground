# Neurobiology Playground

An interactive, kid-friendly journey into how neurons work — ions, membranes,
action potentials, synapses, circuits, and the brain. Sibling of the
[Atomic Playground](../atomic-playground) and built with the same stack and
philosophy: curated, scientifically honest scenes rather than a universal
simulator.

- Feature spec (source of truth, feature IDs): [docs/01-feature-spec.md](docs/01-feature-spec.md)
- Implementation roadmap & status: [docs/04-roadmap.md](docs/04-roadmap.md)

## Develop

```bash
npm install
npm run dev    # Vite dev server
npm test       # Vitest unit tests (core/ scientific rules)
npm run build  # typecheck + production build
```

Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml`.

## Running it with no internet

The app never reaches the network while it is running: the photographs are
bundled in `public/real/`, Tailwind is compiled into the bundle, there are no
web fonts and no CDN scripts. (The `https://` links in `core/realPhotos.ts` are
CREDITS — where each photograph came from, which its licence requires — not
things that get loaded.) A test in `src/__offline.test.ts` fails if a `fetch`,
an `XMLHttpRequest` or a remotely-loaded asset ever appears in the source.

So all that is needed is a copy of the built app and something to serve it.

```
npm run offline
```

builds it and serves it at <http://127.0.0.1:4173>. Both halves use packages
already in `node_modules`, so it works with the wifi off. `npm run dev` works
offline too, once `npm install` has been run once with a connection.

**To take it somewhere with no internet at all**, run `npm run build` while you
still have one and copy the `dist/` folder. It is self-contained and the paths
inside it are relative, so it works from any folder or any host. Serve it with
anything — for instance, from inside `dist/`:

```
python3 -m http.server 8000
```

**Opening `dist/index.html` by double-clicking will not work**, and that is a
browser rule rather than a fault here: ES modules are blocked over `file://`.
It needs to be served, which is what the two commands above do.

One caveat: the spoken names (the 🔊 buttons) use the browser's own
speech-synthesis voices. Voices installed on the machine speak offline; some
browsers offer extra cloud voices that will not.
