import type { UserRecordsModel } from "@/lib/db/schema";
import { formatDateDots } from "@/lib/format/date";

export function RecordSummary({ summary }: { summary: UserRecordsModel["summary"] }) {
  const metrics = [
    { label: "기록", value: String(summary.totalRecords) },
    { label: "최고", value: summary.highestGrade },
    { label: "최근", value: formatDateDots(summary.latestSentAt) },
    { label: "연결", value: String(summary.claimCandidateCount) }
  ];

  return (
    <section aria-label="기록 요약" className="grid grid-cols-4 border-y border-[#ECECEC] bg-white">
      {metrics.map((metric) => (
        <div key={metric.label} className="px-2 py-4 text-center">
          <div className="text-[18px] font-black leading-6 text-black">{metric.value}</div>
          <div className="mt-1 text-[11px] font-bold leading-4 text-[#8A8A8A]">{metric.label}</div>
        </div>
      ))}
    </section>
  );
}
