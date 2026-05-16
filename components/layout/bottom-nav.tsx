import Link from "next/link";

const navItems = [
  { href: "/", label: "홈", icon: "⌂" },
  { href: "/me/records", label: "기록", icon: "◷" },
  { href: "/me/projects", label: "프로젝트", icon: "☆" },
  { href: "/me", label: "마이", icon: "○" }
];

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-[#E8E8E8] bg-white px-2 py-2">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex flex-col items-center gap-1 rounded-2xl px-2 py-1 text-[11px] font-semibold text-[#6F7477]"
        >
          <span aria-hidden className="text-lg text-[#1A1A1A]">
            {item.icon}
          </span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
