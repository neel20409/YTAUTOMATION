type RunStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";

const PHASES = [
  { key: "script", label: "Script" },
  { key: "scenes", label: "Scenes" },
  { key: "stitch", label: "Stitch" },
  { key: "upload", label: "Upload" },
] as const;

type PhaseKey = (typeof PHASES)[number]["key"];

/** Maps a Run.stage value (e.g. "scene_2_image") to which of the 4 visible phases it belongs to. */
function phaseForStage(stage: string | null): PhaseKey | null {
  if (!stage) return null;
  if (stage === "script") return "script";
  if (stage.startsWith("scene_")) return "scenes";
  if (stage === "stitch") return "stitch";
  if (stage === "youtube_upload" || stage === "thumbnail_upload" || stage === "mark_done" || stage === "cleanup") {
    return "upload";
  }
  return null;
}

type SegmentState = "pending" | "active" | "done" | "fault";

/**
 * The pipeline made visible: script -> scenes (voiceover/image/video per scene) -> stitch ->
 * upload, in the order they actually run. Segment state is derived from the Run's real
 * status/stage rather than a generic progress percentage, so this always reflects where the
 * job actually is.
 */
export function StageTimeline({ status, stage }: { status: RunStatus; stage: string | null }) {
  const currentPhase = phaseForStage(stage);
  const currentIndex = currentPhase ? PHASES.findIndex((p) => p.key === currentPhase) : -1;

  function stateFor(index: number): SegmentState {
    if (status === "SUCCEEDED") return "done";
    if (status === "QUEUED") return "pending";
    if (status === "FAILED") {
      if (index < currentIndex) return "done";
      if (index === currentIndex || (currentIndex === -1 && index === 0)) return "fault";
      return "pending";
    }
    // RUNNING
    if (index < currentIndex) return "done";
    if (index === currentIndex || (currentIndex === -1 && index === 0)) return "active";
    return "pending";
  }

  return (
    <div className="flex items-center">
      {PHASES.map((phase, i) => {
        const state = stateFor(i);
        return (
          <div key={phase.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-mono " +
                  (state === "done"
                    ? "border-phosphor bg-phosphor-dim text-phosphor"
                    : state === "active"
                      ? "border-signal bg-signal-dim text-signal animate-pulse"
                      : state === "fault"
                        ? "border-fault bg-fault-dim text-fault"
                        : "border-line text-dim")
                }
                aria-hidden
              >
                {state === "done" ? "✓" : state === "fault" ? "✕" : i + 1}
              </div>
              <span
                className={
                  "font-mono text-[10px] uppercase tracking-wide " +
                  (state === "pending" ? "text-dim" : "text-paper")
                }
              >
                {phase.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div
                className={
                  "mx-1.5 mb-4 h-px w-6 sm:w-10 " +
                  (stateFor(i + 1) === "pending" && state !== "done" ? "bg-line" : "bg-phosphor/50")
                }
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
