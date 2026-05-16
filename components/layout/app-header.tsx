import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#E8E8E8] bg-white/95 px-5 backdrop-blur">
      <Link href="/" className="text-lg font-black tracking-[-0.04em]" aria-label="Granite home">
        GRANITE
      </Link>
      <button
        type="button"
        className="grid size-10 place-items-center rounded-full border border-[#E8E8E8]"
        aria-label="메뉴 열기"
      >
        <span className="text-xl leading-none">☰</span>
      </button>
    </header>
  );
}
