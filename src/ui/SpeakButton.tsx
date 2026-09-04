// 🔊 pronunciation button, styled like the amber 💡 affordance. Uses the
// browser's built-in speech synthesis — no downloads, works offline.
// Rendered as a span[role=button] so it can live inside other buttons
// (e.g. the element badge) without invalid nesting.

/** Bright amber vector speaker — same glyph as the bonding lab's canvas
 *  badge (the 🔊 emoji is natively dark gray and looked dull). */
export function SpeakerIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-9 -9 18 18" aria-hidden>
      <path
        d="M -5.5 -2 L -2.5 -2 L 0.5 -4.5 L 0.5 4.5 L -2.5 2 L -5.5 2 Z"
        fill="#fcd34d"
      />
      <path
        d="M 2.916 -1.953 A 2.6 2.6 0 0 1 2.916 1.953"
        fill="none"
        stroke="#fcd34d"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M 4.236 -3.456 A 4.6 4.6 0 0 1 4.236 3.456"
        fill="none"
        stroke="#fcd34d"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Say a term aloud — the F04 voice, callable from canvas hit-handlers too.
 *
 *  Three browser quirks are handled here, all of which produce SILENCE rather
 *  than an error, which is why this looked like "speaking is not working":
 *
 *   1. **Voices load asynchronously.** In Chrome `getVoices()` is empty for
 *      the first moments of a page's life, and speaking then does nothing at
 *      all. We wait for `voiceschanged` — with a timeout, because Safari
 *      populates them synchronously and never fires the event.
 *   2. **A paused queue stays paused.** `resume()` before speaking clears a
 *      queue that an earlier interrupted utterance, or Chrome's own idle
 *      pause, left stuck.
 *   3. **Safari wants `speak()` inside the gesture.** So the normal path is
 *      SYNCHRONOUS — no timers between the tap and the speaking. Only the
 *      voices-not-ready path defers, and by then the gesture's activation is
 *      still sticky.
 */
/** Spellings to hand the SYNTHESISER instead of the ones on screen.
 *
 *  ⚠ The voice is `en-US` and this app is written in British English, and the
 *  two disagree about `-ise` (user, 2026-08-30: "voicing says [depolarEIsed]
 *  instead of [AI]"). An American voice given "depolarised" mangles the vowel;
 *  given "depolarized" it says it correctly — and what the child HEARS is the
 *  point, so the sound wins over the spelling. What is written on screen does
 *  not change.
 *
 *  Keyed case-insensitively, so a heading and a caption need only one entry. */
const SAY_AS: Record<string, string> = {
  depolarised: 'depolarized',
  hyperpolarised: 'hyperpolarized',
  repolarised: 'repolarized',
  depolarisation: 'depolarization',
  hyperpolarisation: 'hyperpolarization',
  repolarisation: 'repolarization',
  // D06's cast (2026-09-03): written the way the field writes them, said the
  // way the field says them — an en-US voice reads "Munc18" as one mangled
  // word and "GTP" as a syllable.
  'rab-gtp': 'rab, G T P',
  'v-snare': 'vee snare',
  't-snare': 'tee snare',
  munc18: 'munk eighteen',
  munc13: 'munk thirteen',
  nsf: 'N S F',
}

/** The spelling to say, for a term that is written differently. */
export function sayAs(text: string): string {
  return SAY_AS[text.trim().toLowerCase()] ?? text
}

export function speakAloud(text: string) {
  const synth: SpeechSynthesis | undefined =
    typeof globalThis !== 'undefined'
      ? (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis
      : undefined
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return

  let spoken = false
  const say = () => {
    if (spoken) return
    spoken = true
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(sayAs(text))
    utterance.lang = 'en-US'
    utterance.rate = 0.85 // a touch slower, for young ears
    const voice = synth.getVoices().find((v) => v.lang?.startsWith('en'))
    if (voice) utterance.voice = voice
    synth.resume()
    synth.speak(utterance)
  }

  if (synth.getVoices().length === 0) {
    synth.addEventListener?.('voiceschanged', say, { once: true })
    setTimeout(say, 250)
    return
  }
  say()
}

export function SpeakButton({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const speak = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    e.preventDefault()
    speakAloud(text)
  }
  return (
    <span
      role="button"
      tabIndex={0}
      title={`Hear "${text}"`}
      aria-label={`Pronounce ${text}`}
      onClick={speak}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') speak(e)
      }}
      className={`flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-amber-400/60 bg-amber-500/20 text-sm shadow-md shadow-amber-900/40 transition hover:bg-amber-500/35 ${
        className ?? ''
      }`}
    >
      <SpeakerIcon />
    </span>
  )
}
