import Link from "next/link";

export function AppHeader() {
  return (
    <header className="h-14 bg-[#121212] text-white">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" aria-label="Granite home">
          <img src="/images/figma/granite-logo.svg" alt="Granite" className="h-8 w-[62px]" />
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
