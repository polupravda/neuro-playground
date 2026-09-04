import { NeuronStage } from './stage/NeuronStage'
import { ControlPanel } from './ui/ControlPanel'
import { InfoPanel } from './ui/InfoPanel'
import { NeuronMapPanel } from './ui/NeuronMapPanel'
import { RealPhotoPanel } from './ui/RealPhotoPanel'
import { IonPanel } from './ui/IonPanel'
import { BalanceBench } from './ui/BalanceBench'
import { SpikeTrainBench } from './ui/SpikeTrainBench'
import { LipidLab } from './ui/LipidLab'
import { PermeaBench } from './ui/PermeaBench'
import { CapacitorBench } from './ui/CapacitorBench'
import { RestingBench } from './ui/RestingBench'
import { ChannelBench } from './ui/ChannelBench'
import { FilterBench } from './ui/FilterBench'
import { PatchBench } from './ui/PatchBench'
import { GatingBench } from './ui/GatingBench'
import { ScalesBench } from './ui/ScalesBench'
import { SnareBench } from './ui/SnareBench'
import { ReuptakeBench } from './ui/ReuptakeBench'
import { ContentsRail } from './ui/ContentsRail'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <main className="mx-auto flex w-fit items-start gap-2 py-5 pl-3 pr-5">
        {/* The second door onto everything: one container, slim by default,
            growing into the full contents and shrinking back. It sits in the
            flow rather than over it, so the growth pushes nothing about — the
            column beside it keeps its width.

            ⚠ THE ROW'S WIDTH IS A SUM, and it has to fit (2026-08-28). The
            stage is a fixed 1060 px — 1062 with its border — so everything
            else lives in whatever is left.

            Twice the canvas has ended up against the right edge, and the
            second time was subtler: `max-w-[1440px]` with a right padding
            LOOKS like it guarantees a gap, and it does not. Every child here
            is `shrink-0`, so once the viewport is a little under the cap they
            overflow straight through the padding rather than being held back
            by it. Padding does not defend a row of unshrinkable things.

            So the row is `w-fit` and centred rather than capped, and the sum
            is kept small: 12 + 40 + 8 + 264 + 8 + 1062 + 20 = 1414. Above
            that it centres with real margins either side; below it a fixed
            1060 px canvas simply cannot fit, which is a property of the
            canvas and not something padding can fix. Change any term here and
            re-add the sum. */}
        <ContentsRail />
        {/* One column of controls and explanation beside the canvas. There is
            no page switcher any more: other views are reached by zooming into
            a place on the neuron, so they never feel like separate apps. */}
        {/* The column itself does NOT scroll: each section scrolls inside its own
            border instead, so a section's heading and edges stay put while its
            contents move. The explanation block takes whatever height is left
            over and scrolls within it — which is what stops it being squeezed to
            nothing when the panels above are tall. */}
        <div
          className="flex w-[264px] shrink-0 flex-col gap-2 overflow-hidden pr-1"
          style={{ height: 'calc(100vh - 46px)' }}
        >
          {/* Where on the cell we are, always. It is the FIRST thing in the
              column because it is the thing that stops a view being disorienting,
              and a child who has just zoomed in ×140 should not have to scroll to
              find out what they are looking at. */}
          <NeuronMapPanel />
          <ControlPanel />
          {/* The exhibit list used to be here. Every one of them is now a
              door in the row at the foot of the canvas, where the thing they
              are about is (2026-08-28). */}
          {/* Only present at a membrane patch, where inside and outside are
              both on screen. During a spike this is the thing to watch: it
              holds still. */}
          <IonPanel />
          {/* And what the drawing is a drawing OF. Appears only where there is
              something on screen it can be a photograph of. */}
          <RealPhotoPanel />
          {/* Everything explanatory is one block now — what just changed, what
              is in this membrane, and what the selected thing does. */}
          <InfoPanel />
        </div>
        <NeuronStage />
        {/* Thought experiments, over the scene rather than instead of it. */}
        <BalanceBench />
        <SpikeTrainBench />
        <LipidLab />
        <PermeaBench />
        <CapacitorBench />
        <RestingBench />
        {/* ⚠ MOUNT ORDER IS Z-ORDER HERE. Every drawer is `fixed z-50`, so
            among equals the one written LATER paints on top — which makes this
            list an ordering, not a bag. A drawer that can be opened FROM
            another must come after it, or it opens behind the one that opened
            it and looks like a dead button.

            The chain is: types → structure → filter close-up. */}
        <GatingBench />
        <ChannelBench />
        {/* Reached from the filter inside the channel drawer, and from the
            magnifier on the gating bench's potassium panel — not from a list. */}
        <FilterBench />
        {/* Reached by tapping the electrode in the spike-train bench. */}
        <PatchBench />
        {/* Reached from the fusing vesicle on the synapse view. */}
        <SnareBench />
        <ReuptakeBench />
        {/* One signal at three sizes — draws its own views, touches nothing. */}
        <ScalesBench />
      </main>
    </div>
  )
}
