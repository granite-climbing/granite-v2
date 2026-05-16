import Link from "next/link";

const navItems = [
  { href: "/", label: "홈", icon: "⌂", active: true },
  { href: "/me/records", label: "기록", icon: "◷", active: false },
  { href: "/me/projects", label: "프로젝트", icon: "◇", active: false },
  { href: "/me", label: "마이", icon: "○", active: false }
];

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-20 grid h-[74px] grid-cols-4 border-t border-[#E8E8E8] bg-white px-2 pb-2 pt-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1 text-[11px] font-bold ${
            item.active ? "text-[#1A1A1A]" : "text-[#9A9EA1]"
          }`}
        >
          <span aria-hidden className={`text-[21px] leading-none ${item.active ? "text-[#1A1A1A]" : "text-[#B5B8BA]"}`}>
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
