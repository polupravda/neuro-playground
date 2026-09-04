import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'

/** Reusable sliding overlay: slides in from the right edge at full screen
 *  height, over a dimmed backdrop. Closes on ✕, backdrop click, or Escape.
 *  The pattern for all "big view" overlays (periodic table, future bonding
 *  workspace, ...). */
export function SideDrawer({
  open,
  onClose,
  ariaLabel,
  widthClassName = 'w-[min(100vw,86rem)]',
  children,
}: {
  open: boolean
  onClose: () => void
  ariaLabel: string
  /** Tailwind width class for the panel. The default is the periodic table's
   *  size in the sibling app: most of a wide page, but capped, so the strip of
   *  dimmed scene down the left keeps it reading as a drawer pulled out over the
   *  neuron rather than a new screen. */
  widthClassName?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            className={`fixed right-0 top-0 z-50 flex h-screen ${widthClassName} flex-col overflow-auto border-l border-slate-700 bg-slate-900 p-5 shadow-2xl`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 33 }}
          >
            {/* ⚠ A DRAWER CLOSES; IT DOES NOT TRAVEL (user, 2026-09-04:
                "drawers do not need such"). It briefly carried the stage's
                own "⤢ back to the whole picture" — a misreading of a request
                that was about the synapse ZOOM view, not this container. The
                two are different acts: a zoom is somewhere you went, and the
                camera has to bring you back; a drawer is something you
                opened OVER where you already are, and closing it is the whole
                of the return. Naming it as travel would promise a journey
                that never happens. Escape and a backdrop click also close. */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-2 text-slate-400 transition hover:text-slate-200"
            >
              ✕
            </button>
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
