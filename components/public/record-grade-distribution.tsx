import React from "react";
import type { UserRecordGradeBucket } from "@/lib/db/schema";

export function RecordGradeDistribution({ buckets }: { buckets: UserRecordGradeBucket[] }) {
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 0);

  return (
    <section className="bg-white px-5 py-5">
      <h2 className="text-[15px] font-black leading-5 text-black">난이도 분포</h2>
      {buckets.length > 0 ? (
        <div className="mt-4 space-y-3">
          {buckets.map((bucket) => {
            const width = maxCount > 0 ? `${Math.max(18, Math.round((bucket.count / maxCount) * 100))}%` : "18%";
            return (
              <div key={bucket.grade} className="grid grid-cols-[42px_1fr_24px] items-center gap-3">
                <span className="text-[12px] font-black text-black">{bucket.grade}</span>
                <div className="h-2 rounded-full bg-[#ECECEC]">
                  <div className="h-2 rounded-full bg-black" style={{ width }} />
                </div>
                <span className="text-right text-[12px] font-bold text-[#6F7477]">{bucket.count}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[13px] font-semibold leading-5 text-[#6F7477]">아직 분석할 기록이 없습니다.</p>
      )}
    </section>
  );
}
