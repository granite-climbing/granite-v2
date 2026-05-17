type StatBarProps = {
  gradeCounts?: readonly number[];
  variant?: "compact" | "full";
};

export function StatBar({
  gradeCounts = [9, 11, 16, 19, 28, 33, 37, 25, 33, 33, 25, 13, 9],
  variant = "full"
}: StatBarProps) {
  const maxValue = Math.max(...gradeCounts, 1);
  const labels = ["VB", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12+"];
  const barWidth = variant === "compact" ? "w-2" : "w-4";
  const gap = variant === "compact" ? "gap-1" : "gap-1";
  const colors = [
    "#B8B8B8",
    "#A7A7A7",
    "#989898",
    "#8C8C8C",
    "#7D7D7D",
    "#6E6E6E",
    "#606060",
    "#525252",
    "#454545",
    "#373737",
    "#2A2A2A",
    "#1B1B1B",
    "#0B0B0B"
  ];

  return (
    <div className={`flex h-[52px] items-end ${gap}`} aria-label="V등급 분포">
      {gradeCounts.map((count, index) => (
        <div key={`${count}-${index}`} className="flex flex-col items-center gap-[2px]">
          <div className={`${barWidth} flex h-10 items-end rounded-[2px] bg-[#F7F8F8]`}>
            <div
              className={`${barWidth} rounded-[2px]`}
              style={{
                backgroundColor: colors[index] ?? colors.at(-1),
                height: `${Math.max(5, (count / maxValue) * 40)}px`
              }}
            />
          </div>
          {variant === "full" ? <span className="text-[8px] leading-3 text-[#B8B8B8]">{labels[index]}</span> : null}
        </div>
      ))}
    </div>
  );
}
