// The 🏷 labels switch — the app's one toggle affordance, named.
//
// It used to draw the track and knob itself; that drawing moved to
// `ToggleSwitch` when a second control (🔆 focus) wanted the same grammar.
// One drawing of the affordance, never two.
import { ToggleSwitch } from './ToggleSwitch'

export function LabelsSwitch({
  on,
  onToggle,
  titleOn,
  titleOff,
  className,
}: {
  on: boolean
  onToggle: () => void
  titleOn: string
  titleOff: string
  className?: string
}) {
  return (
    <ToggleSwitch
      icon="🏷"
      word="labels"
      on={on}
      onToggle={onToggle}
      titleOn={titleOn}
      titleOff={titleOff}
      className={className}
    />
  )
}
