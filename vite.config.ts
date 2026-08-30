import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// RELATIVE BASE, so the built app runs from ANYWHERE — including a folder on
// a laptop with no internet (2026-08-29).
//
// It used to build with an absolute `/neuro-playground/`, which is the path
// GitHub Pages serves it from and the only path it would then work at: copy
// `dist/` somewhere else and every script, stylesheet and photograph 404s.
// A relative base resolves each asset against `index.html` itself, so the same
// build works on Pages, in a folder, and behind any local server.
//
// Nothing in this app reaches the network at runtime: the photographs are
// bundled in `public/real/`, the URLs in `core/realPhotos.ts` are CREDITS
// rather than sources, Tailwind is compiled into the bundle and there are no
// web fonts. So a relative base is the whole of what offline needed.
export default defineConfig(() => ({
  base: './',
  plugins: [react(), tailwindcss()],
}))
