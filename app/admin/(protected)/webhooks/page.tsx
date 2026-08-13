import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminTable, AdminTableRow, AdminTableCell } from "@/components/admin/admin-table";
import { btnPrimaryCls } from "@/components/admin/admin-field";
import { ManualMatchForm } from "@/components/admin/manual-match-form";
import { getAdminWebhookInbox, getRecentWebhookOperationalEvents, getOrphanedManualMatches, getOrphanedAutoMatches } from "@/lib/db/beta-queries";
import { getPublishedAdminRoutes } from "@/lib/db/admin-read-queries";
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

function formatKstDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value ?? "—";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function prettifyJson(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
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
  const [rows, routes, opEvents, orphans, autoOrphans] = await Promise.all([
    getAdminWebhookInbox(status),
    getPublishedAdminRoutes(),
    getRecentWebhookOperationalEvents(50),
    getOrphanedManualMatches(),
    getOrphanedAutoMatches(),
  ]);

  // Slim the route rows down to just what the search combobox needs so the
  // client payload stays small (rendered once per unmatched row).
  const routeOptions = routes.map((r) => ({
    id: r.id,
    grade: r.grade,
    name: r.name,
    boulderName: r.boulderName,
  }));

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
          <AdminTable headers={["Updated At", "IG User", "Caption", "Thumbnail", "Media", "Last Error"]}>
            {orphans.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell className="whitespace-nowrap">{formatKstDateTime(row.receivedAt)}</AdminTableCell>
                <AdminTableCell>@{row.igUsername || "-"}</AdminTableCell>
                <AdminTableCell>
                  <span className="line-clamp-2">{row.caption || "-"}</span>
                </AdminTableCell>
                <AdminTableCell>
                  {row.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.thumbnailUrl} alt="thumbnail" className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <span className="text-xs text-[#6F7477]">—</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-xs">
                  {row.permalinkUrl ? (
                    <a href={row.permalinkUrl} target="_blank" rel="noreferrer" className="text-[#0969DA] hover:underline">
                      IG 게시물
                    </a>
                  ) : (
                    <span className="text-[#6F7477]">—</span>
                  )}
                </AdminTableCell>
                <AdminTableCell>{row.lastErrorCode || "-"}</AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTable>
        </AdminCard>
      ) : null}

      {/* Auto-match orphan callout */}
      {autoOrphans.length > 0 ? (
        <AdminCard title={`자동 매칭 고립 Beta (${autoOrphans.length})`}>
          <p className="mb-2 text-[12px] font-bold text-[#B53A3A]">
            Worker 자동 매칭에서 Beta는 생성되었지만 webhook_inbox 링크가 실패한 행입니다. 운영자가 Beta 존재 여부 확인 후 직접 SQL로 재연결하거나, Beta를 삭제 후 거절해 주세요.
          </p>
          <AdminTable headers={["Received At", "IG User", "Caption", "Thumbnail", "Media", "Beta ID"]}>
            {autoOrphans.map((row) => (
              <AdminTableRow key={`${row.webhookId}-${row.betaId}`}>
                <AdminTableCell className="whitespace-nowrap">{formatKstDateTime(row.receivedAt)}</AdminTableCell>
                <AdminTableCell>@{row.igUsername || "-"}</AdminTableCell>
                <AdminTableCell>
                  <span className="line-clamp-2">{row.caption || "-"}</span>
                </AdminTableCell>
                <AdminTableCell>
                  {row.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.thumbnailUrl} alt="thumbnail" className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <span className="text-xs text-[#6F7477]">—</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="text-xs">
                  {row.permalinkUrl ? (
                    <a href={row.permalinkUrl} target="_blank" rel="noreferrer" className="text-[#0969DA] hover:underline">
                      IG 게시물
                    </a>
                  ) : (
                    <span className="text-[#6F7477]">—</span>
                  )}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-xs">{row.betaId}</AdminTableCell>
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
                  {formatKstDateTime(row.receivedAt)}
                </AdminTableCell>
                <AdminTableCell className="text-xs font-semibold text-[#111827]">
                  @{row.igUsername}
                </AdminTableCell>
                <AdminTableCell className="max-w-xs">
                  <p className="line-clamp-2 text-xs text-[#24292F]">{row.caption}</p>
                </AdminTableCell>
                <AdminTableCell className="text-xs">
                  <div className="flex flex-col gap-0.5">
                    {row.permalinkUrl ? (
                      <a
                        href={row.permalinkUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#0969DA] hover:underline"
                      >
                        IG 게시물
                      </a>
                    ) : row.mediaUrl ? (
                      <a
                        href={row.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#0969DA] hover:underline"
                      >
                        Media
                      </a>
                    ) : (
                      <span className="text-[#6F7477]">—</span>
                    )}
                    {row.externalMediaId ? (
                      <span className="font-mono text-[10px] text-[#9CA3AF]">
                        {row.externalMediaId}
                      </span>
                    ) : null}
                  </div>
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
                      <ManualMatchForm
                        webhookId={row.id}
                        routes={routeOptions}
                        action={manualMatchWebhookAction}
                      />
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
            <ul className="divide-y divide-[#E6EBF0] rounded border border-[#E6EBF0]">
              {opEvents.map((ev) => (
                <li key={ev.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-[#F6F8FA]">
                      <span className="text-[10px] text-[#6F7477] transition-transform group-open:rotate-90">
                        ▶
                      </span>
                      <span className="whitespace-nowrap text-xs text-[#6F7477]">
                        {formatKstDateTime(ev.createdAt)}
                      </span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-[#24292F]">
                        {ev.eventType}
                      </span>
                      <span className="text-xs text-[#6F7477]">
                        {ev.statusCode ?? "—"}
                      </span>
                      <span className="line-clamp-1 flex-1 text-xs text-[#24292F]">
                        {ev.message || "—"}
                      </span>
                    </summary>
                    <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 border-t border-[#E6EBF0] bg-[#FAFBFC] px-6 py-3 text-xs">
                      <dt className="text-[#6F7477]">ID</dt>
                      <dd className="break-all font-mono text-[#24292F]">{ev.id}</dd>

                      <dt className="text-[#6F7477]">Created</dt>
                      <dd className="text-[#24292F]">
                        {formatKstDateTime(ev.createdAt)}{" "}
                        <span className="text-[#9CA3AF]">({ev.createdAt})</span>
                      </dd>

                      <dt className="text-[#6F7477]">Event Type</dt>
                      <dd className="text-[#24292F]">{ev.eventType}</dd>

                      <dt className="text-[#6F7477]">Status Code</dt>
                      <dd className="text-[#24292F]">{ev.statusCode ?? "—"}</dd>

                      <dt className="text-[#6F7477]">Method · Path</dt>
                      <dd className="break-all text-[#24292F]">
                        {ev.method || "—"} {ev.path || ""}
                      </dd>

                      <dt className="text-[#6F7477]">Request ID</dt>
                      <dd className="break-all font-mono text-[#24292F]">
                        {ev.requestId || "—"}
                      </dd>

                      <dt className="text-[#6F7477]">Webhook ID</dt>
                      <dd className="break-all font-mono text-[#24292F]">
                        {ev.webhookId ?? "—"}
                      </dd>

                      <dt className="text-[#6F7477]">Beta ID</dt>
                      <dd className="break-all font-mono text-[#24292F]">
                        {ev.betaId ?? "—"}
                      </dd>

                      <dt className="text-[#6F7477]">Message</dt>
                      <dd className="whitespace-pre-wrap break-words text-[#24292F]">
                        {ev.message || "—"}
                      </dd>

                      <dt className="self-start text-[#6F7477]">Metadata</dt>
                      <dd>
                        <pre className="overflow-x-auto rounded bg-[#0D1117] p-3 text-[11px] leading-snug text-[#E6EDF3]">
                          {prettifyJson(ev.metadata) || "—"}
                        </pre>
                      </dd>
                    </dl>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminShell>
  );
}
