import Link from "next/link";
import { logoutAdminAction } from "@/lib/actions/admin-auth";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const admin = await requireAdmin();

  return (
    <main className="min-h-screen bg-[#F7F8F8]">
      <header className="sticky top-0 z-50 border-b border-[#E8E8E8] bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-black">Granite Admin</h1>
            <p className="text-xs font-semibold text-[#6F7477]">{admin.displayName}</p>
          </div>
          <form action={logoutAdminAction}>
            <button className="h-9 rounded-full border border-[#D0D5D8] px-3 text-sm font-bold" type="submit">
              Logout
            </button>
          </form>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto text-sm font-bold text-[#6F7477]">
          <Link href="/admin/content">Content</Link>
          <Link href="/admin/announcements">Announcements</Link>
          <Link href="/admin/audit">Audit</Link>
          <Link href="/admin/betas">Betas</Link>
          <Link href="/admin/webhooks">Webhooks</Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
