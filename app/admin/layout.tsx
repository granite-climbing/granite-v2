import Link from "next/link";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="min-h-screen bg-[#F7F8F8]">
      <header className="border-b border-[#E8E8E8] bg-white px-5 py-4">
        <h1 className="text-xl font-black">Granite Admin</h1>
        <nav className="mt-3 flex gap-2 overflow-x-auto text-sm font-bold text-[#6F7477]">
          <Link href="/admin/content">Content</Link>
          <Link href="/admin/announcements">Announcements</Link>
          <Link href="/admin/login">Login</Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
