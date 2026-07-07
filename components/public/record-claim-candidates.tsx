import React from "react";
import type { UserRecordClaimCandidate } from "@/lib/db/schema";

export function RecordClaimCandidates({
  instagramId,
  candidates
}: {
  instagramId: string | null;
  candidates: UserRecordClaimCandidate[];
}) {
  return (
    <section className="bg-white px-5 py-5">
      <h2 className="text-[15px] font-black leading-5 text-black">연결 가능한 기록</h2>
      {!instagramId ? (
        <p className="mt-3 text-[13px] font-semibold leading-5 text-[#6F7477]">
          Instagram ID를 등록하면 연결 가능한 기록을 확인할 수 있습니다.
        </p>
      ) : candidates.length > 0 ? (
        <div className="mt-3 divide-y divide-[#ECECEC]">
          {candidates.map((candidate) => (
            <article key={candidate.betaId} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold leading-4 text-[#8A8A8A]">@{candidate.instagramId}</p>
                <p className="mt-1 truncate text-[15px] font-black leading-5 text-black">{candidate.routeName}</p>
                <p className="mt-1 text-[12px] font-semibold leading-4 text-[#6F7477]">
                  {candidate.cragName} · {candidate.routeGrade}
                </p>
              </div>
              <button
                type="button"
                disabled
                className="h-8 shrink-0 rounded-full bg-[#ECECEC] px-3 text-[12px] font-bold text-[#8A8A8A]"
              >
                연결 준비중
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] font-semibold leading-5 text-[#6F7477]">연결 가능한 기록이 없습니다.</p>
      )}
    </section>
  );
}
