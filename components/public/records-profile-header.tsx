import type { UserRecordsProfile } from "@/lib/records/user-records-view";

type RecordsProfileHeaderProps = {
  profile: UserRecordsProfile;
  totalSends: number;
  highestGrade: string;
};

function BodyStat({ icon, value }: { icon: "armSpan" | "height" | "weight"; value: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] font-normal leading-[14px] text-white">
      {icon === "armSpan" ? (
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-none stroke-white" strokeWidth="1.2">
          <path d="M2 8h12M2 8l2-2M2 8l2 2M14 8l-2-2M14 8l-2 2" />
        </svg>
      ) : icon === "height" ? (
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-none stroke-white" strokeWidth="1.2">
          <path d="M8 2v12M8 2L6 4M8 2l2 2M8 14l-2-2M8 14l2-2" />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 16 16" className="size-4 fill-none stroke-white" strokeWidth="1.2">
          <path d="M5 5.5h6l1.5 7.5h-9L5 5.5Z" />
          <circle cx="8" cy="4" r="1.5" />
        </svg>
      )}
      {value}
    </span>
  );
}

export function RecordsProfileHeader({ profile, totalSends, highestGrade }: RecordsProfileHeaderProps) {
  const { displayName, instagramId, avatarUrl } = profile;
  const bodyStats = [
    profile.armSpanCm != null ? { icon: "armSpan" as const, value: `${profile.armSpanCm}cm` } : null,
    profile.heightCm != null ? { icon: "height" as const, value: `${profile.heightCm}cm` } : null,
    profile.weightKg != null ? { icon: "weight" as const, value: `${profile.weightKg}kg` } : null
  ].filter((stat) => stat !== null);

  return (
    <header className="bg-[#121212] pb-6 text-white">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-[18px] font-medium leading-6 text-white">기록</h1>
        <button type="button" className="flex size-6 flex-col justify-center gap-[4px]" aria-label="메뉴 열기">
          <span className="h-[2px] w-6 rounded-full bg-white" />
          <span className="h-[2px] w-6 rounded-full bg-white" />
          <span className="h-[2px] w-6 rounded-full bg-white" />
        </button>
      </div>
      <div className="flex items-center gap-3 px-4 pt-2">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[#2A2A2A]">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            <svg aria-hidden viewBox="0 0 40 40" className="size-10 fill-[#7A7A7A]">
              <circle cx="20" cy="15" r="7" />
              <path d="M8 34c1.5-7 6.5-10 12-10s10.5 3 12 10H8Z" />
            </svg>
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[16px] font-bold leading-6 text-white">{displayName}</p>
          {instagramId ? (
            <p className="mt-0 text-[10px] font-normal leading-[14px] text-[#7A7A7A]">@{instagramId}</p>
          ) : null}
          {bodyStats.length > 0 ? (
            <div className="mt-2 flex items-center gap-2">
              {bodyStats.map((stat, index) => (
                <span key={stat.icon} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden className="h-2 w-px bg-[#3A3A3A]" /> : null}
                  <BodyStat icon={stat.icon} value={stat.value} />
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <dl className="mx-4 mt-5 flex h-16 items-center justify-center gap-11 rounded-[4px] bg-[#2A2A2A]">
        <div className="w-[72px]">
          <dt className="text-[10px] font-normal leading-[14px] text-[#7A7A7A]">총 완등</dt>
          <dd className="text-[16px] font-bold leading-6 text-[#F7F8F8]">{totalSends}</dd>
        </div>
        <span aria-hidden className="h-6 w-px bg-[#3A3A3A]" />
        <div className="w-[72px]">
          <dt className="text-[10px] font-normal leading-[14px] text-[#7A7A7A]">최고 그레이드</dt>
          <dd className="text-[16px] font-bold leading-6 text-[#F7F8F8]">{highestGrade}</dd>
        </div>
      </dl>
    </header>
  );
}
