type StatBarProps = {
  gradeCounts?: readonly number[];
};

export function StatBar({ gradeCounts = [2, 4, 7, 5, 3, 2, 1] }: StatBarProps) {
  const maxValue = Math.max(...gradeCounts, 1);

  return (
    <div className="flex h-12 items-end gap-1" aria-label="V등급 분포">
      {gradeCounts.map((count, index) => (
        <div key={`${count}-${index}`} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm bg-[#1A1A1A]"
            style={{ height: `${Math.max(8, (count / maxValue) * 38)}px` }}
          />
          <span className="text-[9px] text-[#8B8F91]">V{index}</span>
        </div>
      ))}
    </div>
  );
}
