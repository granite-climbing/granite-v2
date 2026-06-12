import React from "react";
import Link from "next/link";

export type BottomNavItemId = "home" | "projects" | "records" | "me";

const navItems: Array<{ id: BottomNavItemId; href: string; label: string }> = [
  { id: "home", href: "/", label: "홈" },
  { id: "projects", href: "/me/projects", label: "프로젝트" },
  { id: "records", href: "/me/records", label: "기록" },
  { id: "me", href: "/me", label: "마이" }
];

export function BottomNav({ activeItem = "home" }: { activeItem?: BottomNavItemId }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 grid h-[74px] w-full max-w-[430px] -translate-x-1/2 grid-cols-4 border-t border-[#E8E8E8] bg-white px-2 pb-2 pt-1">
      {navItems.map((item) => {
        const active = item.id === activeItem;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-[5px] px-2 py-1 text-[11px] font-medium ${
              active ? "text-black" : "text-[#A8A8A8]"
            }`}
          >
            <NavIcon id={item.id} active={active} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function getBottomNavActiveItem(pathname: string): BottomNavItemId {
  if (pathname === "/me/projects" || pathname.startsWith("/me/projects/")) {
    return "projects";
  }

  if (pathname === "/me/records" || pathname.startsWith("/me/records/")) {
    return "records";
  }

  if (pathname === "/me" || pathname.startsWith("/me/")) {
    return "me";
  }

  return "home";
}

export function shouldShowBottomNav(pathname: string): boolean {
  return pathname !== "/login" && pathname !== "/signup";
}

function NavIcon({ id, active }: { id: BottomNavItemId; active: boolean }) {
  const className = `size-[22px] ${active ? "text-black" : "text-[#A8A8A8]"}`;

  if (id === "home") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path d="M4 11.2 12 4l8 7.2V20h-5.3v-5.6H9.3V20H4v-8.8Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (id === "projects") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path d="M7 4.5h10v15l-5-3-5 3v-15Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M10 8h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      </svg>
    );
  }

  if (id === "records") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path d="M5 5h14v14H5V5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M9 15v-4m3 4V8m3 7v-6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="7.3" r="4.1" fill="currentColor" />
      <path d="M4.5 21c.8-5 3.4-7.5 7.5-7.5s6.7 2.5 7.5 7.5h-15Z" fill="currentColor" />
    </svg>
  );
}
