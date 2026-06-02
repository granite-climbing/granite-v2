import type { GradeBand } from "@/lib/db/schema";

type StatBarProps = {
  gradeCounts?: readonly number[];
  gradeDistribution?: GradeBand[];
  variant?: "compact" | "full";
};

// ---------------------------------------------------------------------------
// StatBar — renders a grade-distribution bar chart.
//
// Two modes:
//   1. gradeDistribution (GradeBand[]) — preferred; uses 5 named bands from DB.
//   2. gradeCounts (number[])          — legacy; individual column heights.
//
// When neither is provided the component falls back to placeholder data so
// that existing call sites (home page, crag-card) continue to render without
// changes.
// ---------------------------------------------------------------------------

const PLACEHOLDER_COUNTS = [9, 11, 16, 19, 28, 33, 37, 25, 33, 33, 25, 13, 9] as const;
const PLACEHOLDER_LABELS = [
  "VB", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12+"
];
const LEGACY_COLORS = [
  "#B8B8B8", "#A7A7A7", "#989898", "#8C8C8C", "#7D7D7D", "#6E6E6E",
  "#606060", "#525252", "#454545", "#373737", "#2A2A2A", "#1B1B1B", "#0B0B0B"
];

// Five-band palette (light → dark): matches the 5 GradeBands V0-V2 … V12+
const BAND_COLORS = ["#B8B8B8", "#7D7D7D", "#454545", "#1B1B1B", "#0B0B0B"];

export function StatBar({
  gradeCounts,
  gradeDistribution,
  variant = "full"
}: StatBarProps) {
  // ----- GradeBand mode -----
  if (gradeDistribution && gradeDistribution.length > 0) {
    const totalCount = gradeDistribution.reduce((sum, b) => sum + b.count, 0);
    const maxCount = Math.max(...gradeDistribution.map((b) => b.count), 1);

    if (variant === "compact") {
      return (
        <div className="flex h-6 items-end gap-1" aria-label="V등급 분포">
          {gradeDistribution.map((band, index) => (
            <div
              key={band.band}
              className="w-3 rounded-[2px]"
              style={{
                backgroundColor: BAND_COLORS[index] ?? BAND_COLORS.at(-1),
                height: `${Math.max(4, Math.min(24, (band.count / maxCount) * 24))}px`
              }}
            />
          ))}
        </div>
      );
    }

    // full variant — horizontal proportional segments
    return (
      <div aria-label="V등급 분포">
        <div className="flex h-3 w-full overflow-hidden rounded-[4px]">
          {gradeDistribution.map((band, index) => {
            const widthPct = totalCount > 0 ? (band.count / totalCount) * 100 : 20;
            return (
              <div
                key={band.band}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: BAND_COLORS[index] ?? BAND_COLORS.at(-1)
                }}
              />
            );
          })}
        </div>
        <div className="mt-1 flex">
          {gradeDistribution.map((band, index) => {
            const widthPct = totalCount > 0 ? (band.count / totalCount) * 100 : 20;
            return (
              <div
                key={band.band}
                style={{ width: `${widthPct}%` }}
                className="flex flex-col items-center"
              >
                <span className="text-[8px] leading-3 text-[#B8B8B8]">{band.band}</span>
                <span className="text-[8px] leading-3 text-[#7A7A7A]">{band.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ----- Legacy gradeCounts mode (or placeholder) -----
  const counts = gradeCounts ?? PLACEHOLDER_COUNTS;
  const maxValue = Math.max(...counts, 1);

  if (variant === "compact") {
    return (
      <div className="flex h-6 w-20 items-end gap-1" aria-label="V등급 분포">
        {counts.map((count, index) => (
          <div
            key={`${count}-${index}`}
            className="w-2 rounded-[2px]"
            style={{
              backgroundColor: LEGACY_COLORS[index] ?? LEGACY_COLORS.at(-1),
              height: `${Math.max(5, Math.min(24, (count / maxValue) * 24))}px`
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-[52px] items-end gap-1" aria-label="V등급 분포">
      {counts.map((count, index) => (
        <div key={`${count}-${index}`} className="flex flex-col items-center gap-[2px]">
          <div className="flex h-10 w-4 items-end rounded-[2px] bg-[#F7F8F8]">
            <div
              className="w-4 rounded-[2px]"
              style={{
                backgroundColor: LEGACY_COLORS[index] ?? LEGACY_COLORS.at(-1),
                height: `${Math.max(5, (count / maxValue) * 40)}px`
              }}
            />
          </div>
          {variant === "full" ? (
            <span className="text-[8px] leading-3 text-[#B8B8B8]">{PLACEHOLDER_LABELS[index]}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
