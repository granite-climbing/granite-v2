import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-[64px] items-center justify-between bg-white px-4">
      <Link href="/" className="flex items-center gap-2" aria-label="Granite home">
        <span className="grid size-7 place-items-center rounded-full bg-[#1A1A1A] text-[10px] font-black text-white">
          G
        </span>
        <span className="text-[18px] font-black leading-none tracking-[-0.08em]">granite</span>
      </Link>
      <button
        type="button"
        className="flex size-10 flex-col items-center justify-center gap-[5px]"
        aria-label="메뉴 열기"
      >
        <span className="h-[2px] w-6 rounded-full bg-[#1A1A1A]" />
        <span className="h-[2px] w-6 rounded-full bg-[#1A1A1A]" />
        <span className="h-[2px] w-6 rounded-full bg-[#1A1A1A]" />
      </button>
    </header>
  );
}
