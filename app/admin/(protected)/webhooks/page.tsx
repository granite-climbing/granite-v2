import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminTable, AdminTableRow, AdminTableCell } from "@/components/admin/admin-table";
import { btnPrimaryCls, selectCls } from "@/components/admin/admin-field";
import { getAdminWebhookInbox, getRecentWebhookOperationalEvents, getOrphanedManualMatches } from "@/lib/db/beta-queries";
import { getAdminRoutes } from "@/lib/db/admin-read-queries";
import { manualMatchWebhookAction, rejectWebhookAction } from "@/lib/actions/admin-beta";
import type { WebhookInboxStatus } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const FILTERS: WebhookInboxStatus[] = [
  "received",
  "processing",
  "unmatched",
  "rejected",
  "manual_matched",
  "matched",
  "duplicate",
  "failed",
];

function parseStatus(value: string | undefined): WebhookInboxStatus {
  return FILTERS.find((s) => s === value) ?? "unmatched";
}

function getStatusBadgeClasses(status: WebhookInboxStatus): string {
  switch (status) {
    case "matched":
    case "manual_matched":
      return "rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700";
    case "unmatched":
    case "received":
    case "processing":
      return "rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700";
    case "duplicate":
      return "rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700";
    case "rejected":
    case "failed":
      return "rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700";
  }
}

export default async function AdminWebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const resolved = await searchParams;
  const status = parseStatus(resolved.status);
  const [rows, routes, opEvents, orphans] = await Promise.all([
    getAdminWebhookInbox(status),
    getAdminRoutes(),
    getRecentWebhookOperationalEvents(50),
    getOrphanedManualMatches(),
  ]);

  return (
    <AdminShell>
      <h1 className="mb-2 text-2xl font-bold">Webhook Inbox</h1>
      <p className="mb-2 text-sm text-[#6F7477]">
        Phase 5에선 자동 재시도가 없으므로 <code className="rounded bg-gray-100 px-1 text-xs">failed</code> 행은 운영자가 거절하거나 Meta 대시보드에서 재전송해야 합니다.
      </p>
      <p className="mb-6 text-[12px] text-[#7A7A7A]">
        `received`/`processing` 상태가 5분 이상 유지되는 행이 있으면 Worker 또는 Graph API 장애를 의심하세요.
      </p>

      {/* Status filters */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/webhooks?status=${f}`}
            className={`rounded px-3 py-2 text-sm font-semibold ${
              status === f
                ? "bg-[#0969DA] text-white"
                : "bg-[#F6F8FA] text-[#24292F] hover:bg-[#E6EBF0]"
            }`}
          >
            {f.replace("_", "_​")}
          </Link>
        ))}
      </div>

      {/* Orphaned manual matches callout */}
      {orphans.length > 0 ? (
        <AdminCard title={`고립된 매칭 (${orphans.length})`}>
          <p className="mb-2 text-[12px] font-bold text-[#B53A3A]">
            `manual_matched` 상태인데 `matched_beta_id`가 비어 있는 행입니다. 매뉴얼 매칭 finalize 단계 실패 가능성이 있습니다. 운영자가 Beta 존재 여부를 직접 확인하고 SQL로 재연결하거나 거절해 주세요.
          </p>
          <AdminTable headers={["Updated At", "IG User", "Caption", "Last Error"]}>
            {orphans.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell>{row.receivedAt}</AdminTableCell>
                <AdminTableCell>@{row.igUsername || "-"}</AdminTableCell>
                <AdminTableCell>
                  <span className="line-clamp-2">{row.caption || "-"}</span>
                </AdminTableCell>
                <AdminTableCell>{row.lastErrorCode || "-"}</AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTable>
        </AdminCard>
      ) : null}

      {/* Webhooks table */}
      <AdminCard title={`Webhooks (${status}) (${rows.length})`}>
        {rows.length === 0 ? (
          <p className="text-sm text-[#6F7477]">No webhooks found.</p>
        ) : (
          <AdminTable
            headers={["Received", "IG User", "Caption", "Media", "Thumbnail", "Status", "Attempts", "Last Error", "Actions"]}
          >
            {rows.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell className="text-xs text-[#6F7477] whitespace-nowrap">
                  {new Date(row.receivedAt).toLocaleDateString()}
                </AdminTableCell>
                <AdminTableCell className="text-xs font-semibold text-[#111827]">
                  @{row.igUsername}
                </AdminTableCell>
                <AdminTableCell className="max-w-xs">
                  <p className="line-clamp-2 text-xs text-[#24292F]">{row.caption}</p>
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
                <AdminTableCell>
                  {row.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.thumbnailUrl}
                      alt="thumbnail"
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <span className="text-xs text-[#6F7477]">—</span>
                  )}
                </AdminTableCell>
                <AdminTableCell>
                  <span className={getStatusBadgeClasses(row.status)}>{row.status}</span>
                </AdminTableCell>
                <AdminTableCell className="text-xs text-center text-[#6F7477]">
                  {row.processingAttempts}
                </AdminTableCell>
                <AdminTableCell className="max-w-[180px]">
                  {row.lastErrorCode && (
                    <div>
                      <span className="rounded bg-red-50 px-1 py-0.5 text-xs font-semibold text-red-700">
                        {row.lastErrorCode}
                      </span>
                      {row.lastErrorMessage && (
                        <p className="line-clamp-2 mt-1 text-xs text-[#6F7477]">{row.lastErrorMessage}</p>
                      )}
                    </div>
                  )}
                  {!row.lastErrorCode && <span className="text-xs text-[#6F7477]">—</span>}
                </AdminTableCell>
                <AdminTableCell>
                  {status === "unmatched" && (
                    <div className="flex flex-col gap-2">
                      <form action={manualMatchWebhookAction} className="flex items-center gap-2">
                        <input type="hidden" name="webhookId" value={row.id} />
                        <select name="routeId" required className={selectCls}>
                          <option value="">루트 선택</option>
                          {routes.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.grade} {r.name} — {r.boulderName}
                            </option>
                          ))}
                        </select>
                        <button className={btnPrimaryCls} type="submit">
                          수동 매칭
                        </button>
                      </form>
                      <form action={rejectWebhookAction} className="mt-1">
                        <input type="hidden" name="id" value={row.id} />
                        <button className={btnPrimaryCls} type="submit">
                          거절
                        </button>
                      </form>
                    </div>
                  )}
                  {status === "failed" && (
                    <form action={rejectWebhookAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button className={btnPrimaryCls} type="submit">
                        거절
                      </button>
                    </form>
                  )}
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTable>
        )}
      </AdminCard>

      {/* Recent operational events */}
      <div className="mt-8">
        <AdminCard title={`Recent Operational Events (${opEvents.length})`}>
          {opEvents.length === 0 ? (
            <p className="text-sm text-[#6F7477]">No operational events recorded.</p>
          ) : (
            <AdminTable
              headers={["Date", "Event Type", "Status", "Message", "Webhook ID", "Beta ID", "Metadata"]}
            >
              {opEvents.map((ev) => (
                <AdminTableRow key={ev.id}>
                  <AdminTableCell className="text-xs text-[#6F7477] whitespace-nowrap">
                    {new Date(ev.createdAt).toLocaleDateString()}
                  </AdminTableCell>
                  <AdminTableCell>
                    <span className="rounded bg-gray-100 px-1 py-0.5 text-xs font-semibold text-[#24292F]">
                      {ev.eventType}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell className="text-xs text-[#6F7477]">
                    {ev.statusCode ?? "—"}
                  </AdminTableCell>
                  <AdminTableCell className="max-w-xs">
                    <p className="line-clamp-2 text-xs text-[#24292F]">{ev.message}</p>
                  </AdminTableCell>
                  <AdminTableCell className="text-xs text-[#6F7477]">
                    {ev.webhookId ?? "—"}
                  </AdminTableCell>
                  <AdminTableCell className="text-xs text-[#6F7477]">
                    {ev.betaId ?? "—"}
                  </AdminTableCell>
                  <AdminTableCell className="max-w-xs">
                    <p className="line-clamp-2 text-xs text-[#6F7477]">{ev.metadata}</p>
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTable>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}
