import Link from "next/link";

export function AppHeader() {
  return (
    <header className="h-24 bg-[#121212] text-white">
      <div className="flex h-10 items-center justify-between bg-white px-4 text-[#090909]">
        <span className="text-[12px] font-semibold leading-none">9:41</span>
        <span className="text-[11px] font-bold leading-none">⌁  ▪  ▰</span>
      </div>
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="text-[18px] font-black italic leading-8 tracking-[-0.14em]" aria-label="Granite home">
          Granite
        </Link>
        <button type="button" className="flex size-6 flex-col justify-center gap-[4px]" aria-label="메뉴 열기">
          <span className="h-[2px] w-6 rounded-full bg-white" />
          <span className="h-[2px] w-6 rounded-full bg-white" />
          <span className="h-[2px] w-6 rounded-full bg-white" />
        </button>
      </div>
    </header>
  );
}
