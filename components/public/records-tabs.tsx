import Link from "next/link";

export type RecordsTabId = "video" | "record";

const tabs: Array<{ id: RecordsTabId; label: string }> = [
  { id: "video", label: "나의 영상" },
  { id: "record", label: "나의 기록" }
];

export function RecordsTabs({ active }: { active: RecordsTabId }) {
  return (
    <nav aria-label="기록 탭" className="grid grid-cols-2 border-b border-[#E8E8E8] bg-[#F7F8F8]">
      {tabs.map((tab) => {
        const selected = tab.id === active;

        return (
          <Link
            key={tab.id}
            href={`/me/records?tab=${tab.id}`}
            aria-current={selected ? "page" : undefined}
            className={`border-b-2 pb-3 pt-4 text-center text-[14px] leading-5 ${
              selected ? "border-[#090909] font-bold text-[#090909]" : "border-transparent font-medium text-[#B8B8B8]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function resolveRecordsTab(tab: string | undefined): RecordsTabId {
  return tab === "record" ? "record" : "video";
}
