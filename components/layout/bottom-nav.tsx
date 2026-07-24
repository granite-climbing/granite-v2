import React from "react";
import Link from "next/link";

export type BottomNavItemId = "home" | "projects" | "records" | "me";

const STORE_URL = "https://m.smartstore.naver.com/granite_kr";

const navItems: Array<{ id: BottomNavItemId; href: string; iconName: string; label: string }> = [
  { id: "home", href: "/", iconName: "home", label: "홈" },
  { id: "projects", href: "/me/projects", iconName: "project", label: "프로젝트" },
  { id: "records", href: "/me/records", iconName: "record", label: "기록" },
  { id: "me", href: "/me", iconName: "my", label: "마이" }
];

export function BottomNav({ activeItem = "home" }: { activeItem?: BottomNavItemId }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 grid h-[74px] w-full max-w-[430px] -translate-x-1/2 grid-cols-5 border-t border-[#E8E8E8] bg-white px-2 pb-2 pt-1">
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
            <NavIcon iconName={item.iconName} active={active} />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <a
        href={STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center justify-center gap-[5px] px-2 py-1 text-[11px] font-medium text-[#A8A8A8]"
      >
        <NavIcon iconName="store" active={false} />
        <span>STORE</span>
      </a>
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

function NavIcon({ iconName, active }: { iconName: string; active: boolean }) {
  const suffix = active ? "" : "_line";

  return (
    <img
      src={`/images/figma/icons/icon_${iconName}${suffix}.svg`}
      alt=""
      aria-hidden
      className="size-6"
    />
  );
}
