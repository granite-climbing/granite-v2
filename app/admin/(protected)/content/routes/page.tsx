import { getAdminRoutes, getAdminTopos } from "@/lib/db/admin-read-queries";
import {
  saveRouteAction,
  softDeleteRouteAction,
  restoreRouteAction,
  togglePublishAction,
} from "@/lib/actions/admin-content";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminTable, AdminTableRow, AdminTableCell } from "@/components/admin/admin-table";
import { AdminField, inputCls, selectCls, textareaCls, btnPrimaryCls } from "@/components/admin/admin-field";
import { PublishBadge } from "@/components/admin/publish-badge";
import { DeleteControls, RestoreControls } from "@/components/admin/delete-restore-controls";
import { ImageUploadField } from "@/components/admin/image-upload-field";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ topoId?: string }>;
}

export default async function AdminRoutesPage({ searchParams }: Props) {
  const { topoId } = await searchParams;
  const [routes, topos] = await Promise.all([
    getAdminRoutes(topoId || undefined),
    getAdminTopos(),
  ]);
  const liveTopos = topos.filter((t) => t.deletedAt === null);
  const selectedTopo = topoId ? liveTopos.find((t) => t.id === topoId) : undefined;

  return (
    <AdminShell>
      <h1 className="mb-6 text-2xl font-bold">Routes</h1>

      {/* Filter bar */}
      <form method="get" className="mb-4 flex items-center gap-2">
        <label className="text-sm font-semibold text-[#57606A]">Filter by Topo:</label>
        <select name="topoId" defaultValue={topoId ?? ""} className={`${selectCls} w-64`}>
          <option value="">All topos</option>
          {liveTopos.map((t) => (
            <option key={t.id} value={t.id}>{t.boulderName} / {t.name}</option>
          ))}
        </select>
        <button type="submit" className={btnPrimaryCls}>Filter</button>
        {topoId && (
          <a href="/admin/content/routes" className="text-xs text-[#0969DA] hover:underline">Clear</a>
        )}
      </form>

      {/* Create form */}
      <AdminCard title="Create Route">
        <form action={saveRouteAction} className="space-y-2">
          <AdminField label="Topo">
            <select name="topoId" required defaultValue={topoId ?? ""} className={selectCls}>
              <option value="">— select topo —</option>
              {liveTopos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.boulderName} / {t.name}
                </option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Name">
            <input name="name" required className={inputCls} placeholder="아나콘다" />
          </AdminField>
          <AdminField label="Slug">
            <input name="slug" required className={inputCls} placeholder="anaconda" />
          </AdminField>
          <AdminField label="Grade">
            <input name="grade" required className={inputCls} placeholder="V5" />
          </AdminField>
          <AdminField label="Grade Num">
            <input name="gradeNum" type="number" className={inputCls} placeholder="auto-derived from grade" />
          </AdminField>
          <AdminField label="FA">
            <input name="fa" className={inputCls} placeholder="홍길동" />
          </AdminField>
          <AdminField label="Description">
            <textarea name="description" className={textareaCls} rows={2} />
          </AdminField>
          <AdminField label="Line Image URL">
            <input name="lineImageUrl" className={inputCls} placeholder="https://cdn.granite.kr/..." />
          </AdminField>
          <AdminField label="Sort Order">
            <input name="sortOrder" type="number" defaultValue="0" className={inputCls} />
          </AdminField>
          <AdminField label="Published">
            <label className="flex items-center gap-2 text-sm">
              <input name="isPublished" type="checkbox" />
              Published
            </label>
          </AdminField>
          {/* Cache revalidation context */}
          <input type="hidden" name="cragSlug" value={selectedTopo?.cragSlug ?? ""} />
          <input type="hidden" name="boulderId" value={selectedTopo?.boulderId ?? ""} />
          <div className="pt-2">
            <button type="submit" className={btnPrimaryCls}>Create Route</button>
          </div>
        </form>
      </AdminCard>

      {/* Routes list */}
      <div className="mt-6">
        <AdminCard title={`Routes (${routes.length})`}>
          <AdminTable headers={["ID", "Topo / Boulder", "Name", "Slug", "Grade", "FA", "Sort", "Status", "Actions"]}>
            {routes.map((route) => (
              <AdminTableRow key={route.id} deleted={route.deletedAt !== null}>
                <AdminTableCell className="font-mono text-xs text-[#57606A]">{route.id}</AdminTableCell>
                <AdminTableCell className="text-xs text-[#57606A]">
                  <div>{route.boulderName}</div>
                  <div className="text-[#0969DA]">{route.topoName}</div>
                </AdminTableCell>
                <AdminTableCell className="font-semibold">{route.name}</AdminTableCell>
                <AdminTableCell className="font-mono text-xs">{route.slug}</AdminTableCell>
                <AdminTableCell className="font-bold">{route.grade}</AdminTableCell>
                <AdminTableCell className="text-xs">{route.fa}</AdminTableCell>
                <AdminTableCell>{route.sortOrder}</AdminTableCell>
                <AdminTableCell>
                  <PublishBadge published={route.isPublished} deleted={route.deletedAt !== null} />
                </AdminTableCell>
                <AdminTableCell className="min-w-[560px]">
                  <div className="flex flex-col gap-2">
                    {/* Edit form */}
                    <form action={saveRouteAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="id" value={route.id} />
                      <input type="hidden" name="cragSlug" value={route.cragSlug} />
                      <input type="hidden" name="boulderId" value={route.boulderId} />
                      <select name="topoId" defaultValue={route.topoId} className={`${selectCls} w-36`}>
                        {liveTopos.map((t) => (
                          <option key={t.id} value={t.id}>{t.boulderName}/{t.name}</option>
                        ))}
                      </select>
                      <input name="name" defaultValue={route.name} className={`${inputCls} w-24`} />
                      <input name="slug" defaultValue={route.slug} className={`${inputCls} w-24`} />
                      <input name="grade" defaultValue={route.grade} className={`${inputCls} w-14`} />
                      <input name="gradeNum" type="number" defaultValue={route.gradeNum} className={`${inputCls} w-14`} />
                      <input name="fa" defaultValue={route.fa} className={`${inputCls} w-20`} placeholder="FA" />
                      <input name="description" defaultValue={route.description} className={`${inputCls} w-36`} placeholder="desc" />
                      <ImageUploadField name="lineImageUrl" defaultValue={route.lineImageUrl ?? ""} entityType="routes" entityId={route.id} purpose="line" />
                      <input name="sortOrder" type="number" defaultValue={route.sortOrder} className={`${inputCls} w-14`} />
                      <label className="flex items-center gap-1 text-xs">
                        <input name="isPublished" type="checkbox" defaultChecked={route.isPublished} />
                        Pub
                      </label>
                      <button type="submit" className={btnPrimaryCls}>Save</button>
                    </form>

                    {/* Publish toggle */}
                    {route.deletedAt === null && (
                      <form action={togglePublishAction} className="flex items-center gap-1">
                        <input type="hidden" name="table" value="routes" />
                        <input type="hidden" name="id" value={route.id} />
                        <input type="hidden" name="isPublished" value={route.isPublished ? "off" : "on"} />
                        <button type="submit" className={btnPrimaryCls}>
                          {route.isPublished ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    )}

                    {/* Delete / Restore */}
                    {route.deletedAt === null ? (
                      <DeleteControls
                        action={softDeleteRouteAction}
                        hiddenInputs={{
                          id: route.id,
                          cragSlug: route.cragSlug,
                          boulderId: route.boulderId,
                          topoId: route.topoId,
                        }}
                      />
                    ) : (
                      <RestoreControls
                        action={restoreRouteAction}
                        hiddenInputs={{
                          id: route.id,
                          cragSlug: route.cragSlug,
                          boulderId: route.boulderId,
                          topoId: route.topoId,
                        }}
                      />
                    )}
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTable>
        </AdminCard>
      </div>
    </AdminShell>
  );
}
