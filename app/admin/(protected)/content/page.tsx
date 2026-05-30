import Link from "next/link";
import { getAdminContentOverview } from "@/lib/db/admin-read-queries";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCard } from "@/components/admin/admin-card";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  const overview = await getAdminContentOverview();

  const entities = [
    { label: "Areas", href: "/admin/content/areas", counts: overview.areas },
    { label: "Crags", href: "/admin/content/crags", counts: overview.crags },
    { label: "Sectors", href: "/admin/content/sectors", counts: overview.sectors },
    { label: "Boulders", href: "/admin/content/boulders", counts: overview.boulders },
    { label: "Topos", href: "/admin/content/topos", counts: overview.topos },
    { label: "Routes", href: "/admin/content/routes", counts: overview.routes },
  ] as const;

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold text-[#111827]">Content Overview</h1>
      <div className="grid grid-cols-3 gap-4">
        {entities.map(({ label, href, counts }) => (
          <AdminCard key={label} title={label}>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[#57606A]">Total</span>
                <span className="font-semibold">{counts.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Published</span>
                <span className="font-semibold text-green-700">{counts.published}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#57606A]">Draft</span>
                <span className="font-semibold">{counts.draft}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600">Deleted</span>
                <span className="font-semibold text-red-600">{counts.deleted}</span>
              </div>
            </div>
            <div className="mt-4">
              <Link
                href={href}
                className="text-xs font-semibold text-[#0969DA] hover:underline"
              >
                Manage {label} →
              </Link>
            </div>
          </AdminCard>
        ))}
      </div>
    </AdminShell>
  );
}
