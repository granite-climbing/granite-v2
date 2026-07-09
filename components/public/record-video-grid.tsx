import type { RecordVideoItem } from "@/lib/records/user-records-view";

export function RecordVideoGrid({ videos }: { videos: RecordVideoItem[] }) {
  if (videos.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-[13px] font-medium leading-5 text-[#7A7A7A]">
        아직 등록된 영상이 없습니다.
      </p>
    );
  }

  return (
    <ul aria-label="나의 영상" className="grid grid-cols-3 gap-px bg-[#E8E8E8]">
      {videos.map((video) => (
        <li key={video.id} className="relative aspect-[3/4] overflow-hidden bg-[#2A2A2A]">
          {video.thumbnailUrl ? (
            <img src={video.thumbnailUrl} alt={video.title} className="size-full object-cover" />
          ) : (
            <span className="absolute inset-x-2 bottom-2 truncate text-[10px] font-bold uppercase leading-[14px] text-white">
              {video.title}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
