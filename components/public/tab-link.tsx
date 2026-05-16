import Link from "next/link";

type TabLinkProps = {
  href: string;
  label: string;
  active?: boolean;
};

export function TabLink({ href, label, active = false }: TabLinkProps) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
        active ? "bg-[#1A1A1A] text-white" : "bg-[#F1F1EF] text-[#6F7477]"
      }`}
    >
      {label}
    </Link>
  );
}
