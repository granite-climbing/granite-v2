import { getRecentAdminAuditLogs } from "@/lib/db/admin-read-queries";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCard } from "@/components/admin/admin-card";

export const dynamic = "force-dynamic";

function formatMetadata(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default async function AdminAuditPage() {
  const logs = await getRecentAdminAuditLogs(100);

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Audit Log</h1>

      <AdminCard title="Recent Actions">
        {logs.length === 0 ? (
          <p className="text-sm text-[#6F7477]">No audit logs found.</p>
        ) : (
          <ul className="space-y-4">
            {logs.map((log) => (
              <li key={log.id} className="border-b border-[#E8E8E8] pb-4 last:border-b-0">
                <p className="text-sm font-bold text-[#111827]">{log.action}</p>
                <p className="mt-1 text-xs text-[#6F7477]">
                  {log.targetType}:{log.targetId} · {log.adminEmail} · {log.createdAt}
                </p>
                {log.metadata && log.metadata !== "{}" && (
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-[#F7F8F8] p-3 text-xs font-mono text-[#111827]">
                    {formatMetadata(log.metadata)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </AdminShell>
  );
}
