import type { RecordGradeBucket } from "@/lib/records/user-records-view";

const MAX_BAR_HEIGHT = 56;
const MIN_BAR_HEIGHT = 2;

// 완등 수가 많을수록 어두운 회색 막대 (#B8B8B8 → #606060, 디자인 그라데이션 근사)
function barColor(count: number, maxCount: number): string {
  if (count === 0 || maxCount === 0) {
    return "#B8B8B8";
  }

  const shade = Math.round(184 - (count / maxCount) * (184 - 96));
  return `rgb(${shade}, ${shade}, ${shade})`;
}

export function RecordSendChart({ buckets }: { buckets: RecordGradeBucket[] }) {
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 0);

  return (
    <section className="px-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold leading-6 text-[#090909]">완등 기록</h2>
        <button
          type="button"
          disabled
          title="기록 추가는 준비중입니다."
          className="flex items-center gap-1 text-[14px] font-medium leading-5 text-[#7A7A7A]"
        >
          기록 추가
          <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-none stroke-[#7A7A7A]" strokeWidth="1.4">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </button>
      </div>
      <div className="mt-3 rounded-[8px] bg-white px-3 pb-3 pt-4">
        {maxCount > 0 ? (
          <div className="flex items-end justify-between gap-1">
            {buckets.map((bucket) => {
              const height =
                bucket.count > 0
                  ? Math.max(MIN_BAR_HEIGHT, Math.round((bucket.count / maxCount) * MAX_BAR_HEIGHT))
                  : MIN_BAR_HEIGHT;

              return (
                <div key={bucket.grade} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="text-[8px] font-normal leading-3 text-[#7A7A7A]">{bucket.count}</span>
                  <span
                    aria-hidden
                    className="w-4 max-w-full rounded-[2px]"
                    style={{ height: `${height}px`, backgroundColor: barColor(bucket.count, maxCount) }}
                  />
                  <span className="text-[8px] font-normal leading-3 text-[#3A3A3A]">{bucket.grade}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-6 text-center text-[12px] font-medium leading-4 text-[#7A7A7A]">
            아직 완등 기록이 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}
