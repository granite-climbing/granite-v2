"use client";

import { usePathname } from "next/navigation";
import { BottomNav, getBottomNavActiveItem, shouldShowBottomNav } from "./bottom-nav";

export function SiteBottomNav() {
  const pathname = usePathname() ?? "/";

  if (!shouldShowBottomNav(pathname)) {
    return null;
  }

  return (
    <>
      <div aria-hidden className="h-[74px]" />
      <BottomNav activeItem={getBottomNavActiveItem(pathname)} />
    </>
  );
}
