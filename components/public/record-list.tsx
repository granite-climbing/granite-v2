import Link from "next/link";
import React from "react";
import type { UserRecordListItem } from "@/lib/db/schema";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(new Date(value))
    .replace(/\.\s?/g, ".")
    .replace(/\.$/, "");
}

function platformLabel(platform: UserRecordListItem["platform"]): string {
  return platform === "instagram" ? "Instagram" : "YouTube";
}

export function RecordList({ records }: { records: UserRecordListItem[] }) {
  return (
    <section className="bg-white px-5 py-5">
      <h2 className="text-[15px] font-black leading-5 text-black">최근 기록</h2>
      {records.length > 0 ? (
        <div className="mt-3 divide-y divide-[#ECECEC]">
          {records.map((record) => {
            const routeHref = `/t/${record.topoId}?route=${record.routeId}`;
            const context = `${record.cragName} · ${record.sectorName} · ${record.boulderName}`;
            return (
              <article key={record.betaId} className="py-4">
                <div className="flex gap-3">
                  <a
                    href={record.mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="베타 영상 열기"
                    className="grid size-[64px] shrink-0 place-items-center overflow-hidden bg-[#D9D9D9]"
                  >
                    {record.thumbnailUrl ? (
                      <img src={record.thumbnailUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-black text-white">{platformLabel(record.platform)}</span>
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <Link href={routeHref} className="block" aria-label={`${record.routeName} ${record.routeGrade}`}>
                      <span className="block text-[16px] font-black leading-5 text-black">
                        {record.routeName} <span className="text-[#6F7477]">{record.routeGrade}</span>
                      </span>
                      <span className="mt-1 block text-[12px] font-semibold leading-4 text-[#6F7477]">{context}</span>
                    </Link>
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-[#8A8A8A]">
                      <span>{platformLabel(record.platform)}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={record.sentAt}>{formatDate(record.sentAt)}</time>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 text-[13px] font-semibold leading-5 text-[#6F7477]">아직 연결된 기록이 없습니다.</p>
      )}
    </section>
  );
}
