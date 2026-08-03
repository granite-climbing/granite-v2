import Link from "next/link";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 h-14 bg-[#121212] text-white">
      <div className="flex h-14 items-center px-4">
        <Link href="/" aria-label="Granite home">
          <img src="/images/figma/granite-logo.svg" alt="Granite" className="h-8 w-[62px]" />
        </Link>
      </div>
    </header>
  );
}
