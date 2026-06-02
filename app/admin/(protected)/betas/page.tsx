import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminTable, AdminTableRow, AdminTableCell } from "@/components/admin/admin-table";
import { btnPrimaryCls } from "@/components/admin/admin-field";
import { getAdminBetas } from "@/lib/db/beta-queries";
import { setBetaStatusAction } from "@/lib/actions/admin-beta";
import type { BetaStatus } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const FILTERS: BetaStatus[] = ["pending", "approved", "hidden", "removed"];

function parseStatus(value: string | undefined): BetaStatus | undefined {
  return FILTERS.find((s) => s === value);
}

function getStatusBadgeClasses(status: BetaStatus): string {
  switch (status) {
    case "approved":
      return "rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700";
    case "pending":
      return "rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700";
    case "hidden":
      return "rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700";
    case "removed":
      return "rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700";
  }
}

function getAvailableTransitions(current: BetaStatus): Array<{ status: BetaStatus; label: string }> {
  const transitions: Record<BetaStatus, Array<{ status: BetaStatus; label: string }>> = {
    pending: [
      { status: "approved", label: "Approve" },
      { status: "hidden", label: "Hide" },
      { status: "removed", label: "Remove" },
    ],
    approved: [
      { status: "pending", label: "Reset to Pending" },
      { status: "hidden", label: "Hide" },
      { status: "removed", label: "Remove" },
    ],
    hidden: [
      { status: "pending", label: "Reset to Pending" },
      { status: "approved", label: "Approve" },
      { status: "removed", label: "Remove" },
    ],
    removed: [
      { status: "pending", label: "Restore" },
      { status: "approved", label: "Approve" },
      { status: "hidden", label: "Hide" },
    ],
  };
  return transitions[current];
}

export default async function AdminBetasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const resolved = await searchParams;
  const status = parseStatus(resolved.status);
  const rows = await getAdminBetas({ status });

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Betas</h1>

      {/* Status filters */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        <Link
          href="/admin/betas"
          className={`rounded px-3 py-2 text-sm font-semibold ${
            !status
              ? "bg-[#0969DA] text-white"
              : "bg-[#F6F8FA] text-[#24292F] hover:bg-[#E6EBF0]"
          }`}
        >
          All
        </Link>
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/betas?status=${f}`}
            className={`rounded px-3 py-2 text-sm font-semibold capitalize ${
              status === f
                ? "bg-[#0969DA] text-white"
                : "bg-[#F6F8FA] text-[#24292F] hover:bg-[#E6EBF0]"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      {/* Betas table */}
      <AdminCard title={`Betas${status ? ` (${status})` : ""} (${rows.length})`}>
        {rows.length === 0 ? (
          <p className="text-sm text-[#6F7477]">No betas found.</p>
        ) : (
          <AdminTable headers={["Route", "Source", "Instagram", "Media", "Sent", "Status", "Actions"]}>
            {rows.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell>
                  <div className="font-semibold">{row.routeName}</div>
                  <div className="text-xs text-[#6F7477]">
                    {row.boulderName} / {row.cragName}
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="text-xs text-[#6F7477] capitalize">
                    {row.source} · {row.platform}
                  </div>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="text-xs font-semibold text-[#111827]">@{row.instagramId}</div>
                  <div className="text-xs text-[#6F7477]">{row.displayName}</div>
                </AdminTableCell>
                <AdminTableCell>
                  {row.mediaUrl && (
                    <a
                      href={row.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#0969DA] hover:underline"
                    >
                      Link
                    </a>
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-xs text-[#6F7477]">
                  {new Date(row.sentAt).toLocaleDateString()}
                </AdminTableCell>
                <AdminTableCell>
                  <span className={getStatusBadgeClasses(row.status)}>
                    {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                  </span>
                </AdminTableCell>
                <AdminTableCell>
                  <div className="flex flex-wrap gap-1">
                    {getAvailableTransitions(row.status).map((transition) => (
                      <form key={transition.status} action={setBetaStatusAction} className="inline">
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="status" value={transition.status} />
                        <button
                          type="submit"
                          className={`${btnPrimaryCls} text-xs`}
                        >
                          {transition.label}
                        </button>
                      </form>
                    ))}
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTable>
        )}
      </AdminCard>
    </AdminShell>
  );
}
