export type BetaVideoItem = {
  id: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  displayName: string;
};

export function BetaVideoGrid({ items }: { items: BetaVideoItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#666]">
        아직 업로드된 베타가 없어요!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3">
      {items.map((item) => (
        <a
          key={item.id}
          href={item.mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="aspect-square overflow-hidden border border-white bg-[#D9D9D9]"
          aria-label={`${item.displayName} 베타 영상 열기`}
        >
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : null}
        </a>
      ))}
    </div>
  );
}
