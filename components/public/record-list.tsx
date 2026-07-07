import type { MockRecentRecord } from "@/lib/mock/records";

export function RecordList({ records }: { records: MockRecentRecord[] }) {
  return (
    <section className="px-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-bold leading-6 text-[#090909]">최근 기록</h2>
        <button
          type="button"
          disabled
          title="전체 기록 보기는 준비중입니다."
          className="flex items-center text-[14px] font-medium leading-5 text-[#7A7A7A]"
        >
          All
          <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-none stroke-[#7A7A7A]" strokeWidth="1.4">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>
      </div>
      <div className="mt-3 rounded-[8px] bg-white px-4 py-2">
        {records.length > 0 ? (
          <ul className="divide-y divide-[#E8E8E8]">
            {records.map((record) => (
              <li key={record.id} className="py-3 text-[12px] font-medium leading-4 text-[#7A7A7A]">
                {record.routeName} · {record.grade} · {record.location}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-[12px] font-medium leading-4 text-[#7A7A7A]">
            아직 완등 기록이 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}
